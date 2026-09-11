/**
 * js/franqueado/chat.js
 *
 * Fluxo conversacional completo: fStartChat, fNextStep, fAddBot, fAddUser,
 * fSend, fQR, fTyping, fGoBack, upload de imagem, confirm card, fGerarArte.
 * Depende de: 00-config.js, 01-state.js, franqueado/chat-input.js
 */

let fNextTimeout = null;

// Atalhos de validade com DATAS REAIS calculadas na hora (uma sugestão estática vira
// mentira amanhã). As frases já vêm com "Válido" → passam intactas pelo humanizador de
// data (gSmartHumanizeDate ignora quem já contém "válid").
function fValidadeSuggestions(){
  const now=new Date();
  const d7=new Date(now.getTime()+7*24*60*60*1000);
  const dd=String(d7.getDate()).padStart(2,'0'), mm=String(d7.getMonth()+1).padStart(2,'0');
  return ['Válido só hoje','Válido neste fim de semana',`Válido até ${dd}/${mm}`,'Válido até o fim do mês'];
}
function fGetSuggestionsForVar(varName, camp){
  // ⛔ Campo de DINHEIRO não recebe sugestão de valor. Um chip "R$ 29,90" ao lado da
  // pergunta lê como se o template impusesse uma faixa de preço — e preço é decisão da
  // loja, não do material. Cortado aqui (o único gerador) e não no fNextStep: assim vale
  // também pra edição pelo card de revisão, que lê o mesmo p.sugestoes. O placeholder
  // do input segue mostrando o FORMATO ("Ex: R$ 9,90"), que é ajuda de digitação.
  let _tipo=''; try{ _tipo=(typeof fGetFieldType==='function')?fGetFieldType(varName).type:''; }catch(e){}
  if(_tipo==='price') return [];
  // Validade é sensível ao tempo → sempre datas calculadas, antes de qualquer default estático.
  if(varName==='validade') return fValidadeSuggestions();
  // Tenta achar sugestões nas perguntas da campanha original
  const orig = camp.perguntas?.find(p=>p.id===varName);
  if(orig && orig.sugestoes) return orig.sugestoes;
  // Defaults básicos
  const defaults = {
    produto: ['Combo Smash', 'X-Bacon', 'Pizza Calabresa', 'Sushi Combo'],
    // precoPor/precoDe saíram: campo de preço não sugere valor (guarda no topo).
    desconto: ['20% off', '30% off', '50% off'],
    codigo: ['PROMO10', 'DM20', 'SUPER30'],
    detalhes: ['Frete grátis', 'Combo família', 'Edição limitada'],
  };
  return defaults[varName] || [];
}
/* ── OS CHIPS DO CHAT VIRAM BOTÃO DE VERDADE ──
   Os quick-replies são `<div class="qr" onclick>` em 9 pontos deste arquivo. O TOQUE sempre
   funcionou (e os alvos já são de 38px no celular, `chat.css`), mas sem `role`/`tabindex` o
   VoiceOver lê "Começar do zero" como texto solto — não como algo que se aperta — e o Tab
   passa por cima. Quem navega por leitor de tela ficava sem o caminho principal do chat:
   recuperar rascunho, usar a última arte, pular um passo, escolher uma sugestão.
   O `role="button" tabindex="0"` está no markup dos 9 (greppável por `class="qr`); o
   `.qr:focus-visible` já existia no CSS desde antes, esperando um elemento focável.
   O Enter/Espaço fica AQUI, delegado no documento uma única vez: cobre os 9 e os que vierem,
   sem que nenhum dos pontos de montagem precise saber disso. `.qr` só existe no chat. */
document.addEventListener('keydown', (e)=>{
  if(e.key !== 'Enter' && e.key !== ' ') return;
  const qr = e.target && e.target.closest && e.target.closest('.qr');
  if(!qr) return;
  e.preventDefault();   // Espaço em elemento focável rolaria a conversa
  qr.click();
});

/* ── O TECLADO NÃO PODE LEVAR A PERGUNTA EMBORA ──
   Medido a 390×844: com a tela cheia a conversa CABE (scrollHeight 661 = clientHeight 661,
   folga 0). O teclado abre, o `interactive-widget=resizes-content` encolhe o layout para
   ~420px, `#f-messages` cai para 237px de caixa com 460px de conteúdo — e o `scrollTop`
   continua 0. Resultado: 223px de conversa abaixo da dobra, incluindo a pergunta do passo e
   os chips ("Frete grátis", "Pular"). A pessoa toca o campo para responder e a pergunta some.
   O `chat.js` re-ancora no fim a cada mensagem nova (8 chamadas de `scrollTop=scrollHeight`),
   mas nenhuma delas roda quando o que muda é o TAMANHO da caixa.
   Mesmo instrumento que o Sheets já usa (`_fBulkBindTeclado`): o `visualViewport`. */
function _fChatBindTeclado(){
  const vv = window.visualViewport;
  if(!vv || vv._fChatBound) return;
  vv._fChatBound = true;
  const fim = ()=>{
    // Só o layout de celular. No desktop `resize` é a pessoa mexendo na janela — puxar a
    // conversa para o fim ali roubaria a leitura de quem está olhando um passo anterior.
    if(!window.matchMedia || !matchMedia('(max-width:680px)').matches) return;
    const msgs = document.getElementById('f-messages');
    if(!msgs || !msgs.offsetParent) return;   // chat fora de cena → nada a re-ancorar
    msgs.scrollTop = msgs.scrollHeight;
  };
  // Duas passadas: a imediata resolve o caso já assentado; a de 120ms cobre o navegador que
  // ainda estava refazendo o layout quando o evento chegou (medir cedo devolve o
  // scrollHeight velho e a âncora erra por uma tela inteira).
  const sync = ()=>{ fim(); setTimeout(fim, 120); };
  vv.addEventListener('resize', sync);
  // ⚠ O `resizes-content` do `index.html` encolhe o viewport de LAYOUT: no Chrome/Android o
  // teclado aparece como `window.resize`, e o `visualViewport` pode nem disparar. No iOS é o
  // contrário. Os dois ouvintes chamam o mesmo `sync`.
  window.addEventListener('resize', sync);
  const box = document.getElementById('f-msg-box');
  // O foco cobre o iOS, que ignora `interactive-widget` e nem sempre dispara `resize` a tempo.
  if(box && !box._fChatFocusBound){ box._fChatFocusBound = true; box.addEventListener('focus', ()=>setTimeout(fim, 250)); }
}

function fStartChatComMaterial(material){
  document.getElementById('f-messages').innerHTML='';
  // Mobile: ao começar o chat, traz o painel do chat pra frente (o layout de 2 colunas colapsa).
  try{ document.body.classList.add('f-mobile-chat'); }catch(e){}
  try{ _fChatBindTeclado(); }catch(e){}
  const _b=document.getElementById('f-msg-box'); if(_b){ _b.disabled=false; }

  fState.material = material;
  /* ⚠ O cartão da arte (celular) mora FORA do `#f-messages` desde 11/09, então o
     `innerHTML=''` logo abaixo deixou de apagá-lo. Sem esta linha ele seguiria mostrando a
     arte do material ANTERIOR até o render novo terminar — e o render é async. O
     `_fLpPaintCartao` o recria sozinho no primeiro render bom. */
  try{ const _c=document.getElementById('f-chat-art'); if(_c) _c.remove(); }catch(e){}

  // Verifica se há rascunho salvo para esta combinação de campanha e material
  let draft = null;
  try {
    const saved = localStorage.getItem('luma_chat_draft');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.materialId === material.id && parsed.campId === fState.camp.id) {
        draft = parsed;
      }
    }
  } catch(e){}

  if (draft && Object.keys(draft.dados).length > 0) {
    fState.stepIdx = -1;
    fState.done = false;
    fState.extractedColors = {};
    fUpdateProg();
    fState._pendingDraft = draft;

    let recoverMsg = `Identifiquei que você tem um rascunho em andamento para a arte <strong>${gEsc(material.name)}</strong>. Deseja continuar de onde parou?`;
    fAddBot(recoverMsg, []);

    const msgs = document.getElementById('f-messages');
    const w = document.createElement('div');
    w.className = 'msg bot';
    w.innerHTML = `<div class="qr-wrap">
      <div class="qr" role="button" tabindex="0" onclick="fApplyRecoverDraft(true)">Sim, continuar</div>
      <div class="qr" role="button" tabindex="0" onclick="fApplyRecoverDraft(false)" style="background:var(--gray-light);border-color:var(--gray-mid);color:var(--text-2)">Não, começar do zero</div>
    </div>`;
    msgs.appendChild(w);
    msgs.scrollTop = msgs.scrollHeight;
    return;
  }

  fState.stepIdx=-1;fState.done=false;fUpdateProg();
  fState.extractedColors={};
  fLpRefresh();
  try { fAttachInputGuard(); } catch(e){}
  // Antes de perguntar, oferece atalhos: reusar uma loja salva (logo/cor) e/ou os dados
  // da última arte deste material. Se não houver nada a oferecer, vai direto às perguntas.
  fMaterialPreStart(material);
}

/* ── Atalhos de pré-início (perfil de loja salva + reusar última arte) ──
   O atalho é "só um passo no chat". Não há mais tela de gestão de loja nem de
   fotos — a aba "Minhas fotos" do painel de conta saiu em 09/09/2026. */
function _fPergExists(id){ return (fState.camp.perguntas||[]).some(p=>p.id===id); }

/* Os campos que um perfil de loja sabe responder. Nomes variam por template
   (o designer batiza o campo), então cada dado tem seus apelidos conhecidos. */
const F_LOJA_CAMPOS = {
  logo:     ['logo_loja'],
  nome:     ['nome_loja','nomeLoja','loja','nome_da_loja','estabelecimento'],
  whatsapp: ['whatsapp','telefone','contato'],
  cor:      ['cor','cor_marca','cor_loja']
};
// A loja tem algo a oferecer neste material? (antes só olhava o logo — nome/whatsapp/cor
// também são redigitação, e material sem campo de logo ficava sem o atalho.)
function _fLojaServeMaterial(){
  return Object.keys(F_LOJA_CAMPOS).some(k=>F_LOJA_CAMPOS[k].some(_fPergExists));
}

function fMaterialPreStart(material){
  const lojas = (typeof fGetLojas==='function') ? fGetLojas() : [];
  const lojaOffer = _fLojaServeMaterial() && lojas.length;
  // Última arte: entrada mais recente do histórico com o MESMO material.
  let lastArte=null;
  try{ lastArte=(typeof fGetHist==='function') ? fGetHist().find(h=>h.materialId===material.id) : null; }catch(e){}
  if(!lojaOffer && !lastArte){ _fProceedMaterialStart(material); return; }

  const msgs=document.getElementById('f-messages');
  const w=document.createElement('div'); w.className='msg bot active-prompt'; w.id='prestart-msg';
  const _lojaIco='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/></svg>';
  const _rewindIco='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>';
  let chips='';
  if(lojaOffer){
    chips += lojas.map(l=>`<div class="qr qr-loja" role="button" tabindex="0" onclick="fPickLoja('${l.id}')">${_lojaIco}${gEsc(l.nome||'Minha loja')}</div>`).join('');
  }
  if(lastArte){
    chips += `<div class="qr" role="button" tabindex="0" onclick="fUseLastArte(${lastArte.id})">${_rewindIco}Usar dados da última arte</div>`;
  }
  chips += `<div class="qr" role="button" tabindex="0" onclick="fSkipPreStart()" style="background:var(--gray-light);border-color:var(--gray-mid);color:var(--text-2)">Começar do zero</div>`;
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div>
    <div class="bbl">Antes de começar a arte de <strong>${gEsc(material.name)}</strong>, quer adiantar?</div>
    <div class="qr-wrap">${chips}</div>
  </div>`;
  msgs.querySelectorAll('.msg').forEach(m=>m.classList.remove('active-prompt'));
  msgs.appendChild(w); msgs.scrollTop=msgs.scrollHeight;
}
function _fClearPreStart(){ const m=document.getElementById('prestart-msg'); if(m) m.remove(); }
function fSkipPreStart(){ _fClearPreStart(); _fProceedMaterialStart(fState.material); }
// Aplica uma loja salva: preenche logo (e whatsapp/cor se o template os tiver) e remove
// essas perguntas do fluxo — o franqueado não redigita o que já é da loja.
function fPickLoja(lojaId){
  _fClearPreStart();
  const loja=(typeof fGetLojas==='function') ? fGetLojas().find(l=>l.id===lojaId) : null;
  if(!loja){ _fProceedMaterialStart(fState.material); return; }
  /* Só preenche campo VAZIO. Escolher a loja é uma ação explícita sobre o conjunto, não sobre
     cada campo: se a pessoa já tinha escrito o nome da loja (pela prévia ou vindo de outro
     material), o perfil salvo não pode passar por cima — valor novo vence valor guardado. */
  const _preenche=(valor,chaves)=>{ if(!valor) return; chaves.forEach(k=>{
    if(_fPergExists(k) && (fState.dados[k]==null || fState.dados[k]==='')) fState.dados[k]=valor;
  }); };
  _preenche(loja.logo,     F_LOJA_CAMPOS.logo);
  _preenche(loja.nome,     F_LOJA_CAMPOS.nome);      // o nome da loja também é dado da loja
  _preenche(loja.whatsapp, F_LOJA_CAMPOS.whatsapp);
  _preenche(loja.cor,      F_LOJA_CAMPOS.cor);
  // Remove do fluxo tudo que já está respondido (pela loja agora ou pela prévia antes).
  fState.camp.perguntas = (fState.camp.perguntas||[]).filter(p=>fState.dados[p.id]==null||fState.dados[p.id]==='');
  if(typeof gToast==='function') gToast(`Dados de ${loja.nome||'sua loja'} aplicados`);
  fLpRefresh();
  _fProceedMaterialStart(fState.material);
}
// Reusa os dados de uma arte anterior deste material e pula direto pro resumo.
function fUseLastArte(histId){
  _fClearPreStart();
  const h=(typeof fGetHist==='function') ? fGetHist().find(x=>x.id===histId) : null;
  if(!h){ _fProceedMaterialStart(fState.material); return; }
  fState.dados={...fState.dados, ...h.dados};   // mesma regra do rascunho: mescla, não descarta o atual
  fState.stepIdx=fState.camp.perguntas.length; // pula as perguntas → confirmação
  fState.done=false; fState.editIdx=null;
  fUpdateProg();
  fAddBot(`Peguei os dados da sua última arte de <strong>${gEsc(fState.material.name)}</strong>.`,[]);
  setTimeout(()=>fGerarArte(),500);
}
function _fProceedMaterialStart(material){
  fState.stepIdx=-1; fState.done=false; fUpdateProg();
  const total = fState.camp.perguntas.length;
  let intro = total > 0
    ? `Vamos preencher sua arte em <strong>${total} passo${total>1?'s':''} rápido${total>1?'s':''}</strong>.`
    : `Já tenho o que preciso — é só conferir e gerar.`;
  if(material.publishMeta?.instrucoes){
    intro += `<br><br><em style="display:block;margin-top:6px;padding:8px 10px;background:var(--dm-orange-bg);border-left:3px solid var(--dm-orange);font-size:12px;color:var(--text-2);border-radius:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> ${gEsc(material.publishMeta.instrucoes)}</em>`;
  }
  fAddBot(intro, []);
  clearTimeout(fNextTimeout);
  fNextTimeout = setTimeout(()=>fNextStep(),900);
}
// `fSaveLojaPrompt` e `fConfirmSaveLoja` (~35 linhas) saíram com o botão "Salvar loja" em
// 09/09. Ver o porquê no `_fUploadPreviewHTML`.
// fAskCampSwitch/fApplyCampSwitch/fCancelSwitch saíram: trocar de pasta não pergunta
// mais nada (o reset de estado mora no fSelectCamp, em catalog.js).
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
    fAddBot(`Trocando pra <strong>${novoFmt.name}</strong> mantendo as respostas…`,[]);
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
  fLpRefresh();
}
function fUpdateProg(){
  const tot=(fState.camp&&fState.camp.perguntas)?fState.camp.perguntas.length:0, done=Math.max(0,fState.stepIdx);
  const el=document.getElementById('prog-fill'); if(el) el.style.width=(tot>0?Math.round(done/tot*100):0)+'%';
  /* O "2/6" do celular. No desktop o número continua onde sempre esteve (o `.step-label`
     dentro do balão); aqui ele sobe pro cabeçalho porque o balão virou o painel e não abre
     com selo de sistema. O elemento existe nos dois, e o CSS decide quem o vê. */
  /* Acessibilidade: a mudança de modo é visual e precisa ser DITA. O `#f-arte-status` é um
     `aria-live="polite"` que só existe para isto — anuncia uma vez, quando o modo entra. */
  try{
    const av=document.getElementById('f-arte-status');
    if(av){
      const texto = fState.done ? 'Sua arte está pronta. Baixar PNG e publicar no Instagram estão disponíveis.' : '';
      if(av.textContent !== texto) av.textContent = texto;
    }
  }catch(e){}
  const n=document.getElementById('f-mob-prog');
  if(n){
    const ativo = tot>0 && !!fState.material;
    n.hidden = !ativo;
    n.textContent = ativo ? (fState.done ? 'pronta' : Math.min(done+1,tot)+'/'+tot) : '';
  }
  _fSheetSync();
}

/* ══ O CELULAR É OUTRA COMPOSIÇÃO, NÃO OUTRO FLUXO (2026-09-11) ══════════════════════════
   A arte subiu para o topo e a conversa virou um painel embaixo dela. Nada aqui cria estado:
   as funções abaixo leem `fState` e mexem em classe/DOM. O único estado novo é se o painel
   de respostas está aberto — e isso é uma classe no `<body>`, não uma variável.
   ⚠ `_fCelular()` repete o `matchMedia` que outros 6 pontos desta base já fazem inline. Não
   refatorei os 6 (fora do escopo desta rodada); código novo usa esta. */
function _fCelular(){ return !!(window.matchMedia && matchMedia('(max-width:680px)').matches); }

/* Já mostramos o "Como vai fica" desta conclusão? (ver o bloco no `_fSheetSync`) */
let _fProntaCtxAberto = false;

/* ── ONDE A CONVERSA ANCORA DEPOIS DE UMA MENSAGEM NOVA ──
   Desktop: no FIM, como todo chat — a mensagem nova chega por baixo.
   Celular: no COMEÇO, e do `#f-sheet`. Duas diferenças, uma por motivo:
   · começo, porque só a pergunta atual fica em cena — ancorar no fim corta a PRIMEIRA linha
     quando ela é longa, e o começo da frase é o que a pessoa precisa ler (visto na
     recuperação de rascunho, a mensagem mais longa do fluxo);
   · o `#f-sheet`, porque o `#f-messages` virou `display:contents` para os chips poderem
     ficar abaixo do campo — sem caixa, ele não rola mais, e `msgs.scrollTop` é no-op. */
function _fChatAncora(msgs){
  if(!_fCelular()){ if(msgs) msgs.scrollTop = msgs.scrollHeight; return; }
  const sheet = document.getElementById('f-sheet');
  if(sheet) sheet.scrollTop = 0;
}

/* Rodapé do painel: "Anterior" só existe quando o `fGoBack` de fato pode agir — botão que
   não faz nada ensina a ignorar botão (mesma regra do `#f-undo-btn`). */
function _fSheetSync(){
  const b=document.getElementById('f-sheet-back');
  if(b) b.hidden = !(fState.stepIdx>0 && !fState.done && fState.editIdx===null);
  /* Arte pronta: a caixa de resposta some. Não é estética — com `fState.done` o `fSaveAdv`
     corta na primeira linha e devolve "Quer gerar outra arte?", ou seja, digitar ali não faz
     nada além de empurrar o card de entrega para fora da vista. E o painel ganha altura,
     porque a entrega (legenda + três ações) é mais alta que uma pergunta. */
  try{ document.body.classList.toggle('f-arte-pronta', !!fState.done); }catch(e){}
  /* ── "COMO VAI FICAR" APARECE SOZINHO ─────────────────────────────────────────────────
     O contexto é a resposta para "terminei, como isso vai ficar?" — e essa pergunta nasce no
     instante em que a arte fica pronta, não quando alguém acha um botão. Por isso ele ABRE
     sozinho aqui, uma vez, na virada de `done` para true.
     ⚠ NÃO É UM PASSO A MAIS: o "Baixar PNG" continua no painel, visível e clicável atrás do
     contexto; quem não quer olhar fecha e baixa. O contexto existe para dar confiança ANTES
     do download, nunca para ficar no caminho dele.
     ⚠ `_fProntaCtxAberto` é a guarda contra reabrir: o `fUpdateProg` roda a cada passo, e sem
     ela o modal voltaria à tela toda vez que a pessoa fechasse e o estado repintasse. Zera
     quando o modo sai, então concluir de novo mostra de novo. */
  try{
    if(fState.done && !_fProntaCtxAberto && typeof fOpenPosted==='function'
       && typeof fPostedContextForFormat==='function' && fPostedContextForFormat(null)){
      _fProntaCtxAberto = true;
      setTimeout(()=>{ try{ fOpenPosted(); }catch(e){} }, 420);
    }
    if(!fState.done) _fProntaCtxAberto = false;
  }catch(e){}
}

/* ── VOLTAR PARA EDIÇÃO ──────────────────────────────────────────────────────────────────
   ⛔ NÃO É O "REFAZER", E A DIFERENÇA IMPORTA. `fRefazer` → `fAskRestartArt` → `fRestartArt`
   APAGA todas as respostas (com `gConfirm` e snapshot para desfazer). Quem só quer corrigir
   uma palavra não pode cair nisso — e trocar a semântica do Refazer em silêncio seria pior
   ainda, porque quem já conhece o botão perderia o trabalho sem aviso.
   Esta é o caminho de volta: desliga o modo "arte pronta" e devolve a interface de criação
   com os dados INTACTOS. Não mexe em `fState.dados`, não re-renderiza a arte, não cria
   registro nenhum — só o `done` muda, e o `_fSheetSync` (via `fUpdateProg`) apaga a classe
   que segura o estado final. Concluir de novo devolve o estado final, sem duplicar nada.
   ⚠ `editIdx=null` porque o estado final pode ter sido alcançado no meio de uma edição.
   ⚠ Este botão já nasceu e morreu uma vez hoje, como "Ajustar arte". Voltou porque sem ele o
   único caminho de correção era o Refazer, que apaga tudo. */
function fVoltarParaEdicao(){
  if(!fState.done) return;
  fState.done = false;
  fState.editIdx = null;
  try{ fSaveChatDraft(); }catch(e){}
  fUpdateProg();
  const box=document.getElementById('f-msg-box');
  if(box && !box.disabled){ try{ box.focus(); }catch(e){} }
  if(typeof gToast==='function') gToast('Voltamos para a edição. Sua arte continua salva.');
}

function fSheetToggle(){
  const aberto = document.body.classList.toggle('f-sheet-max');
  const g=document.getElementById('f-sheet-grip');
  if(g) g.setAttribute('aria-expanded', aberto?'true':'false');
}

/* ── AS RESPOSTAS SÃO UMA LISTA DE CAMPOS, NÃO UMA TIMELINE ──
   No celular só a pergunta atual fica em cena, então o histórico precisa de um lugar. Ele
   não reproduz "Luma: qual preço? / você: R$ 39,90" — mostra rótulo e valor, que é o que a
   pessoa quer conferir, e reforça que ela está preenchendo uma arte.
   ⚠ Zero estado próprio: lê `fState.camp.perguntas` + `fState.dados` (a mesma verdade da
   prévia) e o lápis chama o `fEditCampo` que já existe. */
function fToggleRespostas(){
  const box=document.getElementById('f-respostas'); if(!box) return;
  const abrir = box.hidden;
  if(abrir) fRenderRespostas();
  box.hidden = !abrir;
  document.body.classList.toggle('f-respostas-abertas', abrir);
  document.body.classList.toggle('f-sheet-max', abrir);
  const b=document.getElementById('f-sheet-hist');
  if(b) b.setAttribute('aria-expanded', abrir?'true':'false');
  const l=document.getElementById('f-sheet-hist-lbl');
  if(l) l.textContent = abrir ? 'Fechar' : 'Respostas';
}

function fRenderRespostas(){
  const box=document.getElementById('f-respostas'); if(!box) return;
  const pergs=(fState.camp&&fState.camp.perguntas)||[];
  const linhas=pergs.map((p,i)=>{
    const v=fState.dados?fState.dados[p.id]:null;
    const tem=v!=null&&v!=='';
    const rot=(typeof gFieldLabel==='function')?gFieldLabel(p.id,p):(p.label||p.id);
    // Foto não vira data-url na tela: vira a miniatura da própria foto + uma palavra.
    const val = p.isImage
      ? (tem?`<img class="fr-mini" src="${gEsc(v)}" alt="">Foto enviada`:'<i>sem foto</i>')
      : (tem?gEsc(String(v)):'<i>ainda não respondido</i>');
    return `<div class="fr-row${i===fState.stepIdx?' atual':''}">
      <span class="fr-lbl">${gEsc(rot)}</span>
      <span class="fr-val${tem?'':' vazia'}">${val}</span>
      <button type="button" class="fr-ed" onclick="fRespostaEditar(${i})" aria-label="Alterar ${gEsc(rot)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
      </button>
    </div>`;
  }).join('');
  box.innerHTML=`<h3 class="fr-h">Respostas</h3>${linhas}`
    +`<button type="button" class="fr-reset" onclick="fResetFlow()">Recomeçar esta arte</button>`;
}

/* O lápis fecha a lista antes de editar: o passo alvo abre no painel, e deixar a lista por
   cima dele esconderia justamente a pergunta que o clique pediu. */
function fRespostaEditar(i){
  if(document.body.classList.contains('f-respostas-abertas')) fToggleRespostas();
  fEditCampo(i);
}
// Boas-vindas no boot: NÃO interroga sobre campanha nenhuma — só recebe o franqueado e o convida
// a escolher uma campanha. O chat real (fStartChat) só dispara após a escolha.
function fShowWelcome(){
  const msgs=document.getElementById('f-messages'); if(msgs) msgs.innerHTML='';
  fState.stepIdx=-1; fState.dados={}; fState.done=false; fState.material=null;
  try{ fUpdateProg(); }catch(e){}
  try{ fUpdateCtx(); }catch(e){}
  /* ⚠ "ao lado" / "aqui do lado" saiu das duas frases: no celular o catálogo é a tela
     ANTERIOR, não uma coluna ao lado — a instrução apontava para um lugar que não existe.
     A correção é tirar a palavra, não ramificar por `matchMedia`: sem ela a frase fica
     verdadeira nos dois layouts e não há dois textos para manter em sincronia. */
  const box=document.getElementById('f-msg-box');
  if(box){ box.disabled=true; box.placeholder=_fCelular()?'Escolha uma campanha':'Escolha uma campanha para começar'; }
  try{ fAddBot('Oi! Eu sou a <strong>Luma</strong>. Escolha uma campanha que eu monto a arte com você — leva ~1 minutinho.',[]); }catch(e){}
}


/* ── CHAT ── */
function fStartChat(){
  if(!fState.camp){ fShowWelcome(); return; } // sem campanha → boas-vindas, nunca interroga
  document.getElementById('f-messages').innerHTML='';
  /* Reabilita (o welcome desabilitou) — e DEVOLVE o placeholder junto. Sem isto o campo
     voltava habilitado ainda dizendo "Escolha uma campanha para começar", com a campanha
     já escolhida: instrução falsa em cima de um campo que aceita digitação. O placeholder
     por passo é reposto depois pelo `fUpdateInputPlaceholder`. */
  const _b=document.getElementById('f-msg-box'); if(_b){ _b.disabled=false; _b.placeholder=_fCelular()?'Sua resposta':'Digite sua resposta...'; }
  fState.stepIdx=-1;fState.dados={};fState.done=false;fUpdateProg();
  fState.extractedColors={};
  fLpRefresh();
  try { fAttachInputGuard(); } catch(e){}
  // F-05: mensagem inicial com contexto (quantas perguntas, tempo estimado)
  const total = fState.camp.perguntas.length;
  fAddBot(`Oi! Vou te fazer <strong>${total} pergunta${total>1?'s':''} rápida${total>1?'s':''}</strong> sobre <strong>${gEsc(fState.camp.name)}</strong> (formato ${gEsc(fState.fmt.name)}) e gerar a arte. Leva ~1 minuto.<br>
  <div style="margin-top:8px;border-top:1px dashed var(--gray-mid);padding-top:6px;display:flex;align-items:center;justify-content:space-between;gap:8px">
    <span style="font-size:11px;color:var(--text-3)">Quer pular as perguntas?</span>
    <button class="f-bulk-entrada" onclick="fBulkOpen()" style="background:var(--dm-orange-bg);border:1px solid var(--dm-orange-tint);color:var(--dm-orange-d);font-size:11px;font-weight:600;padding:4px 10px;border-radius:var(--r-pill);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all 0.15s ease" onmouseover="this.style.background='var(--dm-orange-tint)'" onmouseout="this.style.background='var(--dm-orange-bg)'">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Gerar em Lote
    </button>
  </div>`,[]);
  clearTimeout(fNextTimeout);
  fNextTimeout = setTimeout(()=>fNextStep(),900);
}
/* ── O PASSO QUE CHEGA COM RESPOSTA ────────────────────────────────────────────────────────
   Contrato do teste de usabilidade: chat e prévia são duas interfaces da MESMA verdade
   (`fState.dados`). Quando o passo abre num campo que já tem valor — digitado na prévia,
   vindo do rascunho ou do perfil da loja —, o chat RECONHECE em vez de perguntar do zero:
   o campo já vem preenchido (`jaTem`, no fNextStep) e o chip "Manter" fecha o passo sem
   inventar mudança nenhuma. Nada aqui escreve valor: só reencaminha o que já está lá. */
/* ⚠ `_ICO_CHECK` JÁ EXISTE em `js/core/user-profile.js:544` — e como TODO arquivo desta base
   compartilha o escopo global (sem módulos, 1ª lei), um segundo `const` com o mesmo nome derruba
   o arquivo inteiro com "Identifier has already been declared". Prefixo `_F_` porque este é do
   chat do franqueado; o outro é do painel de conta. Achado abrindo o app no navegador — o
   `node --check` de cada arquivo passa, porque a colisão só existe quando os dois carregam juntos. */
const _F_ICO_CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg>';
function fManterValor(){
  const p = fState.camp && fState.camp.perguntas && fState.camp.perguntas[fState.stepIdx];
  if(!p) return;
  const atual = fState.dados ? fState.dados[p.id] : null;
  if(atual==null || atual==='') return;
  fAddUser(String(atual));
  fSaveAdv(String(atual));   // grava o MESMO valor: o fluxo anda, a resposta não muda
}

/* Texto da pergunta NA HORA DE PERGUNTAR — e não na hora de montar o material. O preço
   promocional precisa do preço original JÁ RESPONDIDO na frase, e esse valor só existe agora.
   Era a queixa literal do teste: "preço cheio e preço promocional pareciam campos soltos". */
function fPerguntaTexto(p){
  if(!p) return '';
  if(p.precoPar !== 'por') return p.texto;
  const pergs = (fState.camp && fState.camp.perguntas) || [];
  const pDe = pergs.find(x=>x && x.precoPar==='de');
  const de = pDe && fState.dados ? fState.dados[pDe.id] : null;
  if(!de) return p.texto;   // ainda não respondeu o "de" (pulou, voltou) → pergunta sem contexto
  return `${p.texto}<span class="perg-ctx">O preço original é ${gEsc(String(de))}.</span>`;
}

function fNextStep(){
  fState.stepIdx++;fUpdateProg();
  const pergs=fState.camp.perguntas;
  if(fState.stepIdx>=pergs.length){fGerarArte();return;}
  const p=pergs[fState.stepIdx];
  fLpRefresh();
  try { fUpdateCharCount(); } catch(e){}
  // A prévia ao vivo grava direto em fState.dados (clique no campo no canvas). O passo
  // chegava em branco e a resposta seguinte apagava o que o franqueado já tinha posto lá
  // — parecia que a edição na prévia "não valia". Se já tem valor, o passo chega com ele.
  const jaTem = fState.dados && fState.dados[p.id]!=null && fState.dados[p.id]!=='';
  // F-05: prefixo "Passo X de Y" pra dar senso de progresso numérico
  const stepLabel = `<span class="step-label">Passo ${fState.stepIdx+1} de ${pergs.length}</span>`;
  // F-07: botão "Voltar" aparece quando não é o primeiro passo
  const canGoBack = fState.stepIdx > 0 && fState.editIdx === null;
  // Pergunta de imagem: usa fAddBotImageUpload
  if(p.isImage){
    fAddBotImageUpload(stepLabel, p, canGoBack);
    /* Foto já enviada (pela prévia, pelo rascunho ou pelo perfil da loja): o passo mostra a
       imagem e ESPERA. Antes pulava sozinho — a pessoa via o passo passar em branco e ficava
       sem saber se o que estava lá era o que ela tinha escolhido. Mesmo contrato do chip
       "Manter" do passo de texto: reconhecer o que existe, e deixar manter, trocar ou ajustar. */
    if(jaTem){ return; }
    // Desabilita input de texto
    const box=document.getElementById('f-msg-box');
    if(box){box.disabled=true;box.placeholder='Use o botão de upload acima';}
    const snd=document.getElementById('f-snd'); if(snd) snd.disabled=true;
    const mic=document.getElementById('f-chat-mic'); if(mic) mic.disabled=true;
    return;
  }
  // Pergunta de texto normal
  const box=document.getElementById('f-msg-box');
  if(box){box.disabled=false;}
  const snd=document.getElementById('f-snd'); if(snd) snd.disabled=false;
  const mic=document.getElementById('f-chat-mic'); if(mic) mic.disabled=false;
  const cfg = fGetFieldType(p.id);
  const typeIcon = {price:'R$', discount:'%', code:'#', text:'Aa'}[cfg.type] || 'Aa';
  /* No celular essa nota sai: o rótulo é uma linha só em maiúscula e "PREÇO PROMO · JÁ
     PREENCHIDO — MANTENHA OU EDITE" estourava a tela (medido a 375px: cortava no meio).
     E ela diz o que o chip "Manter “23”", logo abaixo do campo, já diz melhor — com o valor
     de verdade dentro e um alvo de toque. No desktop o rótulo tem largura de sobra e a nota
     continua, porque lá o chip fica longe, no meio da conversa. */
  const jaTemNota = (jaTem && !_fCelular()) ? ' · <strong>já preenchido</strong> — mantenha ou edite' : '';
  const fieldHint = `<div class="field-hint"><span class="field-hint-type">${typeIcon}</span><span class="field-hint-text">${gEsc(cfg.label)}${jaTemNota}</span></div>`;
  
  // Sugestões ricas automáticas baseadas no tipo de dado da variável (UX do franqueado)
  let sugestoes = p.sugestoes ? p.sugestoes.slice() : [];

  /* ⛔ NO CELULAR O CHIP DE CONTEÚDO SAI (pedido do Ryan, 11/09). "Combo família",
     "Frete grátis", "X-Bacon" custavam duas linhas do painel — espaço que a ARTE usa
     melhor — e ofereciam uma resposta antes de a pessoa pensar na dela. O campo passa a
     ser a resposta.
     ⚠ A LINHA É UM `= []` E NÃO UM `if` EM VOLTA DE TUDO, de propósito: os três blocos
     logo abaixo re-derivam a lista a partir do TIPO do campo, e só disparam quando ela
     está vazia. Ou seja, booleano (Sim/Não), seleção e paleta de cor voltam sozinhos — e
     precisam voltar: neles o chip não é sugestão, é o único controle que responde a
     pergunta. Quem some é só o palpite de texto livre.
     "Manter" e "Pular" entram DEPOIS disto e também sobrevivem: falam do que já existe. */
  if (_fCelular()) sugestoes = [];
  
  if (cfg.type === 'boolean' && (!sugestoes || !sugestoes.length)) {
    sugestoes = ['Sim', 'Não'];
  } else if (cfg.type === 'select' && Array.isArray(cfg.options) && cfg.options.length && (!sugestoes || !sugestoes.length)) {
    sugestoes = cfg.options;
  } else if (cfg.type === 'color' && Array.isArray(cfg.palette) && cfg.palette.length && (!sugestoes || !sugestoes.length)) {
    sugestoes = cfg.palette;
  }
  
  // Sugestão inteligente de cores a partir da foto do produto
  if (cfg.type === 'color') {
    const fotoColor = fState.extractedColors && (fState.extractedColors['foto_produto'] || Object.values(fState.extractedColors)[0]);
    if (fotoColor && !sugestoes.includes(fotoColor)) {
      sugestoes.unshift(fotoColor);
    }
  }
  
  /* ⛔ "PULAR" NUNCA APARECE EM CIMA DE UM VALOR QUE JÁ EXISTE. Pular grava string vazia
     (`fSaveAdv`), então num campo que a pessoa preencheu PELA PRÉVIA o chip apagava a resposta
     — e ela lê "pular esta pergunta", não "apagar o que escrevi". Campo já preenchido ganha
     o chip MANTER no lugar; campo vazio e opcional continua com o Pular de sempre. */
  if (jaTem) {
    const _atual = String(fState.dados[p.id]);
    const _curto = _atual.length > 24 ? _atual.slice(0,22)+'…' : _atual;
    sugestoes = [{html:`${_F_ICO_CHECK}Manter “${gEsc(_curto)}”`, acao:'fManterValor()'}].concat(sugestoes);
  } else if (!cfg.required && !sugestoes.includes('Pular')) {
    sugestoes.push('Pular');
  }

  /* ⚠ O `<span>` em volta da frase NÃO é decoração. No celular o balão é `flex-direction:
     column` (para o rótulo do campo subir acima da pergunta), e em flex CADA `<strong>` vira
     um item próprio e cada trecho de texto solto vira um item anônimo — em coluna, cada um
     ganha sua própria linha. "Antes de começar a arte de <strong>X</strong>, quer adiantar?"
     saía em três linhas, com a vírgula órfã no começo da terceira. Com a frase dentro de um
     elemento, o flex vê UM item e a linha volta a fluir normalmente. */
  fAddBot(`${stepLabel}<span class="perg-frase">${fPerguntaTexto(p)}</span>${fieldHint}`, sugestoes, canGoBack);
  // Atualiza placeholder do input com dica do tipo
  fUpdateInputPlaceholder(p.id);
  // Rehidrata o input com o que já existe (prévia, rascunho ou perfil da loja): o valor
  // fica visível e um Enter mantém. Cursor no fim (não seleciona: digitar não apaga tudo).
  if(box && cfg.type!=='image'){
    /* ⚠ A CAIXA PERTENCE AO PASSO — e o `else` é a metade que faltava. Só o `fSend` limpava o
       campo; chip de sugestão (`fQR`) e "Manter" (`fManterValor`) avançavam deixando o texto
       do passo ANTERIOR ali. O passo novo abria com o valor do vizinho na caixa e, na primeira
       tecla, o `input` do `chat-input.js` gravava "<texto velho>+letra" no campo NOVO — valor
       mudando porque o fluxo andou, exatamente o que este contrato proíbe.
       Aparecia mais agora porque o "Manter" nasce em cima de uma caixa JÁ preenchida (o
       `jaTem`), então o texto velho era a regra e não a exceção. Achado pela sonda da bancada. */
    box.value = jaTem ? String(fState.dados[p.id]) : '';
    try { box.setSelectionRange(box.value.length, box.value.length); } catch(e){}
    try { fUpdateCharCount(); } catch(e){}
  }
}

/* Markup ÚNICO da foto já aplicada no passo — usado tanto pelo upload novo
   (_fApplyImageToField) quanto pelo passo que chega com foto vinda da prévia
   (fAddBotImageUpload). Dois markups iguais viravam duas verdades. */
function _fUploadPreviewHTML(varId, url, opts){
  opts = opts || {};
  const ehLogo = (typeof gCampoEhLogo==='function') && gCampoEhLogo(varId);
  /* O botão "Salvar loja" saiu a pedido do Ryan (09/09) — feature morta, e era mesmo: a tela
     de GESTÃO de lojas já tinha saído do painel de conta ("não faz sentido no momento do
     produto"), então sobrava um botão que criava um perfil que ninguém podia
     renomear nem apagar. Com ele saem `fSaveLojaPrompt` e `fConfirmSaveLoja`, que não tinham
     outro chamador.
     ⚠ CONSEQUÊNCIA, para quem for ler isto depois: `fAddLoja` era o ÚNICO ponto de criação.
     Sem ele, ninguém cria loja nova — o atalho de pré-início (`fPickLoja`) só aparece para
     quem já tem uma salva no aparelho. A leitura fica de pé de propósito, para não sumir com
     o dado de quem já usou. */
  /* ── O ARQUIVO À VISTA ANTES DE AVANÇAR ─────────────────────────────────────────────────
     O upload avançava sozinho 600ms depois de aplicar a imagem: quem escolheu o arquivo errado
     só descobria adiante, e no celular a arte nem estava na tela (a prévia é gaveta). Agora o
     passo PARA aqui, mostra o arquivo escolhido e espera uma ação — "é essa imagem que vai
     entrar" tem que ser uma resposta que a pessoa dá, não uma suposição do sistema.
     O aviso de logo, quando existe, entra ACIMA e traz as duas saídas que o pedido define:
     trocar o arquivo ou seguir mesmo assim. Nunca bloqueia — só informa (logo horizontal
     legítimo é comum, e reprovar por proporção seria pior que o problema). */
  const aviso = opts.aviso ? `<div class="f-upload-aviso" role="status">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>${gEsc(opts.aviso)}</span>
    </div>` : '';
  const barra = `<div class="f-upload-confirm">
      ${aviso}
      <div class="f-upload-confirm-row">
        <button class="f-upload-ok" onclick="fConfirmarImagem('${gEsc(varId)}')">${opts.aviso ? 'Usar mesmo assim' : (opts.jaEstava ? 'Manter esta imagem' : 'Usar esta imagem')}</button>
        <button class="f-upload-replace" onclick="fReplaceImage('${gEsc(varId)}',this)">${opts.aviso ? 'Trocar arquivo' : 'Trocar'}</button>
      </div>
    </div>`;
  return `<div class="f-upload-preview f-upload-preview-pop">
      <img src="${gEsc(url)}" alt="Imagem enviada"/>
      <div class="f-upload-preview-overlay">
        <span style="display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg>${ehLogo?'Logo enviado':'Foto enviada'}</span>
        <span style="display:inline-flex;gap:6px"><button class="f-upload-frame" onclick="fAjustarFoto('${gEsc(varId)}')" title="Reposicionar e dar zoom na imagem dentro da arte"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>Ajustar</button></span>
      </div>
    </div>${opts.semConfirmar ? '' : barra}`;
}

/* ── LOGO: validação DETERMINÍSTICA (nada de IA para classificar imagem) ───────────────────
   Três perguntas objetivas, medidas nos pixels do arquivo:
   · resolução mínima — logo abaixo de 200px no maior lado sai serrilhado em arte de 1080px;
   · proporção absurda — acima de 12:1 é fita/linha, não marca. ⚠ 12:1 é DE PROPÓSITO folgado:
     logo horizontal legítimo (assinatura, wordmark) vive entre 3:1 e 6:1 e não pode ser
     reprovado — o pedido é explícito nisso;
   · área útil — imagem quase toda vazia costuma ser um print com a marca perdida no meio.
   Nenhuma delas bloqueia: todas devolvem TEXTO, e a decisão continua sendo de quem publica. */
function fValidarLogo(url, cb){
  const im = new Image();
  im.onerror = ()=>cb('');
  im.onload = ()=>{
    const w = im.naturalWidth||0, h = im.naturalHeight||0;
    if(!w || !h) return cb('');
    const maior = Math.max(w,h), razao = Math.max(w/h, h/w);
    if(maior < 200) return cb(`Esse arquivo é pequeno (${w}×${h}px) e pode ficar difícil de ler nesta área.`);
    if(razao > 12)  return cb(`Esse arquivo é muito alongado (${w}×${h}px) e pode ficar difícil de ler nesta área.`);
    cb('');
  };
  im.src = url;
}

/* Confirmação do passo de imagem: é AQUI que o fluxo anda, e só por ação da pessoa. */
function fConfirmarImagem(varId){
  if(!fState.dados || !fState.dados[varId]) return;
  if(fState.editIdx !== null){ fState.editIdx=null; fTyping(()=>fGerarArte()); return; }
  fTyping(()=>fNextStep());
}
// Pergunta especial de upload de imagem
function fAddBotImageUpload(stepLabel, pergunta, canGoBack){
  const msgs=document.getElementById('f-messages');
  const w=document.createElement('div');w.className='msg bot active-prompt';
  const uploadId='f-upload-'+Date.now();
  const fieldHint = `<div class="field-hint"><span class="field-hint-type"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span><span class="field-hint-text">${gEsc(pergunta.label)}${_fCelular()?'':' · imagem (PNG/JPG, máx 20MB)'}</span></div>`;
  let back='';
  if(canGoBack){
    back = `<div class="qr-back-wrap"><button class="qr-back" onclick="fGoBack()" title="Voltar uma pergunta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>Voltar uma pergunta</button></div>`;
  }
  // Já tem foto (veio da prévia ao vivo / rascunho / perfil da loja): mostra a foto no
  // lugar da zona de upload — pedir de novo o que já está na arte é o bug, não a feature.
  const jaTemFoto = fState.dados && fState.dados[pergunta.id];
  // `jaEstava`: a imagem não acabou de ser escolhida, ela já estava no campo → "Manter", não "Usar".
  const zoneHtml = jaTemFoto ? _fUploadPreviewHTML(pergunta.id, fState.dados[pergunta.id], {jaEstava:true})
    : `<div class="f-upload-zone" id="${uploadId}-zone" data-var="${pergunta.id}" data-upload="${uploadId}" onclick="fOpenUploadPanel('${pergunta.id}','${uploadId}')">
      <!-- O input fica DENTRO da zona, que abre o painel no clique. O clique
           programático de fUploadPanelNewFile borbulhava até aqui e REABRIA o
           painel que acabara de fechar — por isso o stopPropagation. -->
      <input type="file" id="${uploadId}-input" accept="image/png,image/jpeg,image/webp" style="display:none" onclick="event.stopPropagation()" onchange="fHandleImageUpload(event,'${pergunta.id}','${uploadId}')">
      <div class="f-upload-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <!-- A copy muda no celular: a pergunta logo acima já diz "Envie a foto do produto", e
           repetir "Toque pra enviar uma foto" aqui é a mesma frase duas vezes em 40px. No
           telefone o título vira o RÓTULO DA AÇÃO ("Escolher foto") e o sub diz de onde a
           foto pode vir — que é a dúvida real de quem toca. -->
      <div class="f-upload-title">${_fCelular()?'Escolher foto':'Toque pra enviar uma foto'}</div>
      <div class="f-upload-sub">recentes, lojas salvas ou novo arquivo<span class="f-upload-cola"> · ou cole com ${_F_TECLA_COLAR}, ou arraste pra cá</span></div>
    </div>`;
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div>
    <div class="bbl">${stepLabel}<span class="perg-frase">${pergunta.texto}</span>${fieldHint}</div>
    ${zoneHtml}
    ${back}
  </div>`;
  msgs.querySelectorAll('.msg').forEach(m=>m.classList.remove('active-prompt'));
  _fApplyMessageGrouping(msgs,w,'bot');
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
  /* ⛔ O drag & drop NÃO é registrado aqui. Ele mora em `_fInitChatSoltarColar`, na COLUNA
     inteira do chat: uma zona de 24px de respiro é um alvo pequeno demais para um arquivo
     vindo do desktop, e um listener por mensagem significa um listener por passo de foto,
     todos vivos ao mesmo tempo, disputando o mesmo gesto. A zona só precisa DIZER de que
     campo ela é — é o que os `data-var`/`data-upload` acima fazem. */
}
/* ══ COLAR E ARRASTAR NO CHAT ══════════════════════════════════════════════════════════
   Pedido do Ryan (10/09): "Ctrl+C em alguma coisa e Ctrl+V no chat do Luma, e poder
   arrastar algo pra dentro."

   Um caminho só, e ele termina no motor que já existe: `fProcessImageFile` — o mesmo do
   clique na zona e do painel de recentes. Colar e arrastar não são um segundo jeito de
   receber foto, são duas PORTAS para o jeito que já havia (esqueleto, barra de progresso,
   redimensionamento, extração de cor, validação de logo, "recentes"). Criar um segundo
   caminho de imagem aqui seria o bug, não a feature (`03_ENGINEERING` §1).

   Quem é o alvo? A ZONA DE UPLOAD que estiver na tela. O chat só mostra uma por vez, e ela
   é literalmente o passo que está pedindo foto — não há o que adivinhar, nem por que
   escrever num campo que a pessoa ainda não viu. Sem zona na tela, o gesto é recusado com
   uma frase que diz o porquê.
*/
// Mac usa ⌘V. O texto da dica é o único lugar que precisa saber disso.
const _F_TECLA_COLAR = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '') ? '⌘V' : 'Ctrl+V';
const _fSheetsAberto = () => !!document.querySelector('#f-bulk-modal.open');
/* A zona viva: tem `data-var` (foi montada pelo passo), ainda não virou esqueleto E ESTÁ NA
   TELA. A última condição não é preciosismo: no catálogo, no histórico e na home o chat
   continua montado, só escondido — sem `offsetParent` o colar cairia num passo que a pessoa
   não está vendo. `offsetParent` é null para qualquer ancestral com `display:none`. */
function _fZonaDeFotoAtiva(){
  const z = document.querySelector('#f-messages .f-upload-zone[data-var]:not(.f-upload-loading)');
  return (z && z.offsetParent !== null) ? z : null;
}
/* Porta única de colar/arrastar. Devolve `true` quando a foto entrou — o chamador não
   precisa saber mais nada. */
function fReceberFotoNoChat(file){
  const z = _fZonaDeFotoAtiva();
  if(!z){
    if(typeof gToast==='function') gToast('Nenhum passo está pedindo foto agora. Cole ou arraste quando o Luma pedir a imagem.');
    return false;
  }
  fProcessImageFile(file, z.dataset.var, z.dataset.upload);
  return true;
}
const _fArrastaArquivo = (e)=>{
  /* `types` e não `files`: durante o arrasto o navegador ESCONDE os arquivos por privacidade
     e só expõe a lista de tipos. Ler `files` no dragover devolve vazio e o realce nunca
     aparece — a mesma armadilha documentada no `canvas.js` do Estúdio. */
  const t = e.dataTransfer && e.dataTransfer.types;
  return !!(t && Array.prototype.indexOf.call(t,'Files') >= 0);
};
function _fInitChatSoltarColar(){
  const col = document.getElementById('f-chat-col');
  if(!col || col._fSoltarOk) return;
  col._fSoltarOk = true;
  const realce = (liga)=>{
    col.classList.toggle('f-chat-solta', liga);
    const z = _fZonaDeFotoAtiva();
    if(z) z.classList.toggle('drag-over', liga);
  };
  col.addEventListener('dragover', (e)=>{
    if(!_fArrastaArquivo(e)) return;
    e.preventDefault();                       // sem isto o navegador RECUSA o drop
    e.dataTransfer.dropEffect = 'copy';
    realce(true);
  });
  col.addEventListener('dragleave', (e)=>{
    /* Só apaga quando o ponteiro sai da coluna DE VERDADE: cruzar uma bolha de mensagem
       dispara `dragleave` e o realce piscaria a cada elemento atravessado. */
    if(e.relatedTarget && col.contains(e.relatedTarget)) return;
    realce(false);
  });
  col.addEventListener('drop', (e)=>{
    if(!_fArrastaArquivo(e)) return;
    e.preventDefault();                       // sem isto o navegador ABRE o arquivo e abandona a sessão
    realce(false);
    const f = (e.dataTransfer.files || [])[0];
    if(f) fReceberFotoNoChat(f);
  });
}
/* ⚠ REDE DE SEGURANÇA, e é ela que justifica o handler no documento: soltar um arquivo
   FORA da coluna faz o navegador NAVEGAR para ele — a pessoa perde a tela com a arte
   pela metade. Aqui só o `preventDefault` e uma frase dizendo onde soltar.
   `defaultPrevented` desiste do que a coluna (ou o Estúdio, ou o calendário) já tratou. */
['dragover','drop'].forEach((tipo)=>{
  document.addEventListener(tipo, (e)=>{
    if(e.defaultPrevented) return;
    if(!document.body.classList.contains('mode-franqueado')) return;
    if(_fSheetsAberto()) return;              // o Sheets tem os campos dele; não é assunto deste patch
    /* Arquivo do computador: cair fora da coluna é mira ruim, e a frase diz onde acertar. */
    if(_fArrastaArquivo(e)){
      e.preventDefault();
      if(tipo==='drop' && typeof gToast==='function')
        gToast('Solte a foto dentro da conversa, no passo que pede a imagem.');
      return;
    }
    /* IMAGEM ARRASTADA DE OUTRA ABA (Google Imagens, cardápio do concorrente): não vem
       arquivo nenhum, vem uma URL — e o navegador NAVEGA para ela, levando embora a arte
       pela metade. Aqui não dá para buscar a imagem: é outro domínio, o CORS barra a
       conversão para dataURL na maioria dos sites, e um recurso que funciona em um site e
       falha calado em nove é pior que não existir. Então o gesto é recusado dizendo o
       porquê e o que fazer. Arrastar texto para dentro de um campo continua nativo. */
    const alvo = e.target;
    if(alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA)$/.test(alvo.tagName||''))) return;
    const tipos = e.dataTransfer && e.dataTransfer.types;
    if(!(tipos && Array.prototype.indexOf.call(tipos,'text/uri-list') >= 0)) return;
    e.preventDefault();
    if(tipo==='drop' && typeof gToast==='function')
      gToast('Não consigo pegar imagem direto de um site. Salve o arquivo e arraste ele, ou cole com ' + _F_TECLA_COLAR + '.');
  });
});
/* COLAR. Imagem primeiro (é o gesto do print de tela, o motivo do pedido); texto depois, e
   só quando o foco NÃO está num campo — sequestrar o Ctrl+V de quem está digitando seria
   pior que não ter o recurso. É a mesma guarda que o `publish.js` do Estúdio usa, e ele já
   se desliga fora do `mode-designer` justamente para este handler existir. */
document.addEventListener('paste', (e)=>{
  if(!document.body.classList.contains('mode-franqueado')) return;
  if(_fSheetsAberto()) return;
  const cb = e.clipboardData; if(!cb) return;
  const img = Array.from(cb.items || [])
    .filter(i => i.kind==='file' && /^image\//.test(i.type||''))
    .map(i => i.getAsFile()).find(Boolean);
  if(img){ e.preventDefault(); fReceberFotoNoChat(img); return; }
  const alvo = e.target;
  if(alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName||''))) return;
  const box = document.getElementById('f-msg-box');
  if(!box || box.disabled || box.offsetParent === null) return;   // chat escondido: o Ctrl+V não é nosso
  /* Uma linha só: o campo do chat é de uma linha, e texto colado de planilha vem com
     tabulação e quebra que viram caractere invisível dentro da arte. */
  const txt = (cb.getData('text/plain') || '').replace(/\s+/g,' ').trim();
  if(!txt) return;
  e.preventDefault();
  box.value = box.value ? (box.value + ' ' + txt) : txt;
  box.focus();
  /* Despacha `input` em vez de mexer no contador/prévia daqui: é o mesmo caminho da
     digitação (máscara, limite de caracteres, prévia ao vivo), e o `fFitApply` já usa este
     truque. Um segundo dono desse estado é o que produz contador mentindo. */
  box.dispatchEvent(new Event('input',{bubbles:true}));
});
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _fInitChatSoltarColar);
else _fInitChatSoltarColar();

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
  if(file.size > 20*1024*1024){
    fShowFieldError(`Imagem muito grande (${(file.size/1024/1024).toFixed(1)}MB). Máximo 20MB.`);
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
      zEl.innerHTML=`<input type="file" id="${uploadId}-input" accept="image/png,image/jpeg,image/webp" style="display:none" onclick="event.stopPropagation()" onchange="fHandleImageUpload(event,'${varId}','${uploadId}')">
        <div class="f-upload-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
        <div class="f-upload-title">Toque pra tentar de novo</div>
        <div class="f-upload-sub">PNG ou JPG, até 20MB</div>`;
    }
  };
  reader.onload=(e)=>{
    if(_bar)_bar.style.width='85%';
    const dataUrl=e.target.result;
    // Redimensiona se for muito grande (>2500px). 2500 cobre story a 2× (2160px) sem
    // esticar a foto — 1500 antes borrava em arte grande. Ainda limita o peso do draft.
    const _ehLogo = (typeof gCampoEhLogo==='function') && gCampoEhLogo(varId);
    fResizeImageIfNeeded(dataUrl, 2500, (resizedUrl)=>{
      _fApplyImageToField(varId, uploadId, resizedUrl);
      // Guarda nos "recentes" (referência no IndexedDB + thumb leve; NUNCA base64 cru no
      // localStorage — regra da casa §7). O painel de upload reusa esta lista.
      if(typeof fRecordRecentImg==='function') fRecordRecentImg(resizedUrl, varId);
    }, _ehLogo);   // logo mantém a transparência (ver fResizeImageIfNeeded)
  };
  reader.readAsDataURL(file);
}
/* Aplica uma imagem (já redimensionada) ao campo do chat: preview, cor, avança.
   Extraído do onload do upload para o painel de upload (imagens recentes / lojas)
   reusar EXATAMENTE o mesmo finishing — um caminho só. */
function _fApplyImageToField(varId, uploadId, resizedUrl){
  fState.dados[varId]=resizedUrl;
  fSaveChatDraft();
  // EXTRAÇÃO DE CORES COM COLOR THIEF
  try {
    if(window.ColorThief) {
      const imgTemp = new Image();
      imgTemp.onload = () => {
        try {
          const thief = new ColorThief();
          const rgb = thief.getColor(imgTemp);
          if (rgb && rgb.length === 3) {
            const hex = '#' + rgb.map(x => { const s = x.toString(16); return s.length === 1 ? '0' + s : s; }).join('');
            if(!fState.extractedColors) fState.extractedColors = {};
            fState.extractedColors[varId] = hex;
          }
        } catch(thiefErr) { console.warn('[ColorThief] Erro ao extrair cor:', thiefErr); }
      };
      imgTemp.src = resizedUrl;
    }
  } catch(colorThiefErr) { console.warn('[ColorThief] Falha ao ler imagem:', colorThiefErr); }
  // Substitui a zona de upload pela prévia da imagem escolhida
  const zone=document.getElementById(uploadId+'-zone');
  const pintaPreview=(aviso)=>{
    const z=document.getElementById(uploadId+'-zone');
    const alvo=z||document.getElementById(uploadId+'-preview');
    if(!alvo) return;
    const wrap=document.createElement('div');
    wrap.id=uploadId+'-preview';
    wrap.innerHTML=_fUploadPreviewHTML(varId, resizedUrl, {aviso});
    alvo.replaceWith(wrap);
    const msgs=document.getElementById('f-messages'); if(msgs) msgs.scrollTop=msgs.scrollHeight;
  };
  if(zone) pintaPreview('');
  const box=document.getElementById('f-msg-box');
  if(box){box.disabled=false;}
  try { fUpdateLivePreview({animateField:varId}); } catch(e){}
  if(typeof window.gPlayPhotoSnapSound==='function') window.gPlayPhotoSnapSound();
  /* ⛔ O `setTimeout(600)` que avançava sozinho saiu. O passo agora ESPERA a confirmação
     (`fConfirmarImagem`, no botão do próprio preview): quem subiu o arquivo errado descobre
     aqui, olhando, e não três passos adiante. Campo de logo ainda passa pela validação
     determinística antes — o aviso repinta o preview com as duas saídas do pedido. */
  if(typeof gCampoEhLogo==='function' && gCampoEhLogo(varId) && typeof fValidarLogo==='function'){
    fValidarLogo(resizedUrl, (aviso)=>{ if(aviso) pintaPreview(aviso); });
  }
}
/* `preservarAlpha`: a saída sai em PNG em vez de JPEG. Existe por causa do LOGO — o JPEG NÃO
   TEM canal alfa, então um logo PNG com fundo transparente acima do teto voltava daqui com
   fundo PRETO chapado atrás da marca. O caminho passava despercebido porque só dispara acima de
   `maxDim` (logo pequeno nunca redimensiona e escapava íntegro), mas quando disparava
   estragava justamente o arquivo que mais precisa da transparência.
   ⚠ Continua opcional e desligado por padrão: foto de produto em PNG pesaria muitas vezes mais
   que o JPEG a 0,88, e ela não tem transparência nenhuma a preservar. */
function fResizeImageIfNeeded(dataUrl, maxDim, cb, preservarAlpha){
  const tipo = preservarAlpha ? 'image/png' : 'image/jpeg';
  const paraUrl = (canvasOuRes) => preservarAlpha
    ? canvasOuRes.toDataURL('image/png')
    : canvasOuRes.toDataURL('image/jpeg', 0.88);
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
          .then(res => cb(paraUrl(res)))
          .catch(err => {
            console.warn('[Pica] Erro de render, fallback nativo:', err);
            const ctx=cv.getContext('2d');
            ctx.imageSmoothingQuality='high';
            ctx.drawImage(img,0,0,cv.width,cv.height);
            cb(paraUrl(cv));
          });
        return;
      } catch(e) {
        console.warn('[Pica] Falha ao iniciar, fallback nativo:', e);
      }
    }

    const ctx=cv.getContext('2d');
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,0,0,cv.width,cv.height);
    cb(paraUrl(cv));
    void tipo;
  };
  img.onerror=()=>cb(dataUrl);
  img.src=dataUrl;
}
function fReplaceImage(varId, btn){
  // Apaga o dado atual e força nova pergunta
  delete fState.dados[varId];
  fSaveChatDraft();
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
  /* ⛔ APAGAR AS RESPOSTAS SEGUINTES SAIU (teste de usabilidade, 09/2026). Este laço limpava
     o dado de TODOS os passos a partir do alvo — inclusive o que a pessoa tinha acabado de
     escrever PELA PRÉVIA, num campo à frente. Voltar uma pergunta apagava trabalho que o chat
     nem sabia que existia: é exatamente o "a prévia não vale" que o time relatou.
     Voltar é mover o CURSOR, não desfazer. O motivo original ("evita valor velho na preview")
     morreu quando o `fNextStep` passou a chegar com o valor no campo (o `jaTem`): o passo alvo
     abre preenchido, e um Enter mantém — quem quer trocar, digita por cima. */
  const target = fState.stepIdx - 1;
  fState.stepIdx = target - 1; // fNextStep incrementa pra chegar no alvo
  fSaveChatDraft();
  fNextStep();
}

function fUpdateInputPlaceholder(id){
  const box = document.getElementById('f-msg-box');
  if(!box) return;
  const cfg = fGetFieldType(id);
  /* TECLADO DO CELULAR POR TIPO DE CAMPO. O `#f-msg-box` é um `type="text"` só — sem
     `inputmode`, o passo de preço abria o QWERTY para digitar "29,90". O Sheets já resolveu
     isto e o porquê está lá (`png-generator.js`, `fBulkRenderFolhaCampos`): `type="text"` e
     NÃO `number`, porque o campo numérico do celular recusa a vírgula em boa parte dos
     aparelhos; `inputmode="decimal"` traz o teclado de números sem impor formato — quem
     julga o valor continua sendo o `fValidate`. Aqui é o mesmo campo, o caminho principal.
     Desconto ("20% off ou R$ 5 off") e código ("BURGER10") precisam de letras: seguem texto. */
  box.setAttribute('inputmode', cfg.type === 'price' ? 'decimal' : 'text');
  // Exemplo definido pelo designer (no campo) tem prioridade — é o que ele escolheu mostrar aqui.
  const vDef = (typeof dVars!=='undefined' && dVars) ? dVars.find(x=>x.name===id) : null;
  const ex = (vDef && vDef.example!=null && String(vDef.example).trim()!=='') ? String(vDef.example).trim() : '';
  /* ── A DICA ENCOLHE NO CELULAR ──
     A caixa tem ~250px num telefone: "Ex: 20% off ou R$ 5 off" era cortado no meio e virava
     "Ex: 20% off ou R$ 5..." — uma dica pela metade ensina menos que nenhuma. E o prefixo
     "Ex:" ficou redundante desde que o RÓTULO do campo subiu para cima da pergunta ("PREÇO
     PROMOCIONAL"): quem lê o rótulo já sabe que o cinza da caixa é exemplo, não valor.
     No desktop a caixa é larga e a frase completa continua cabendo — nada muda lá. */
  const cel = _fCelular();
  if(ex){ box.placeholder = cel ? ex : ('Ex: '+ex); return; }
  const hints = cel ? {
    price:    'R$ 9,90',
    discount: '20% off',
    code:     'BURGER10',
    text:     'Sua resposta'
  } : {
    price:    'Ex: R$ 9,90',
    discount: 'Ex: 20% off ou R$ 5 off',
    code:     'Ex: BURGER10',
    text:     'Digite sua resposta...'
  };
  box.placeholder = hints[cfg.type] || hints.text;
}
function fMostrarConfirm(){
  // Balão de revisão removido: gera a arte diretamente sem etapa intermediária de confirmação
  const existing=document.getElementById('confirm-msg'); if(existing) existing.remove();
  fGerarArte();
}
function fEditCampo(idx){
  /* ⚠ `done` PRECISA CAIR AQUI. Com a arte já gerada, `fSaveAdv` corta na primeira linha
     ("Quer gerar outra arte?") e a resposta da edição nunca era salva — o campo abria, a
     pessoa digitava e nada acontecia. O `fReplaceImage` já zerava `done` na mão antes de
     chamar; agora quem edita não precisa lembrar disso, porque editar É voltar ao fluxo.
     Sem isto, o lápis da lista de campos seria um botão que não faz nada. */
  fState.done=false;
  fState.stepIdx=idx;fState.editIdx=idx;
  fSaveChatDraft();
  /* ⚠ `done` e `editIdx` acabaram de mudar, e o rodapé do painel (celular) lê os dois: sem
     isto o "Anterior" some e a caixa de resposta continua escondida — justamente no caminho
     do lápis da lista de Respostas, que é quando se edita DEPOIS da arte pronta. */
  try{ _fSheetSync(); }catch(e){}
  const p=fState.camp.perguntas[idx];
  // Mapa próprio + `|| p.id` no fim: era o quarto lugar com sua própria tabela de rótulos, e o
  // único cujo fallback mostrava o nome da variável. Agora é o motor único (00-config.js).
  const label = (typeof gFieldLabel==='function') ? gFieldLabel(p.id, p) : (p.label || 'Campo');
  
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
    const snd=document.getElementById('f-snd'); if(snd) snd.disabled=true;
    const mic=document.getElementById('f-chat-mic'); if(mic) mic.disabled=true;
  } else {
    fAddBot(`Qual é o novo valor para <strong>${gEsc(label)}</strong>?`,p.sugestoes);
    const box=document.getElementById('f-msg-box');
    if(box){box.disabled=false;}
    const snd=document.getElementById('f-snd'); if(snd) snd.disabled=false;
    const mic=document.getElementById('f-chat-mic'); if(mic) mic.disabled=false;
    try { fUpdateInputPlaceholder(p.id); } catch(e){}
    try { fUpdateCharCount(); } catch(e){}
  }
}
// fEditarTudo saiu: era um TERCEIRO reset, sem confirmação e sem nenhum chamador desde que
// o card de revisão foi removido. Restart agora tem uma porta só (fAskRestartArt).
function fConfirmarGerar(){
  const wrap = document.querySelector('.lp-canvas-wrap');
  if(wrap){
    wrap.classList.remove('is-rendering');
    void wrap.offsetWidth;
    wrap.classList.add('is-rendering');
    setTimeout(() => wrap.classList.remove('is-rendering'), 650);
  }
  const m=document.getElementById('confirm-msg');if(m)m.remove();
  fGerarArte();
}
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
  // Desativado: devolve lista vazia em vez de bloquear — quem chama trata o
  // vazio e a arte continua sendo gerada. A legenda é acessório, não o fluxo.
  if (typeof gFeatureCan === 'function' && !gFeatureCan('franqueado.legendas','execute')) return [];
  const prod = dados.produto || dados.categoria || dados.brinde || dados.oferta || camp.name;
  // Mapeamento assertivo dos slots: preço é preço; DESCONTO vai pro slot de desconto (ativa o
  // pool comPercentual — antes virava {por} e saía "por 20% off"). Sem preço → pool semPreco.
  const por = dados.precoPor || '';
  const de = dados.precoDe || '';
  const val = dados.validade || '';
  const desc = dados.desconto || dados.detalhes || '';

  // Unificação com o avançado motor de copy gastronômica do Luma Sheets (fBuildCopy)
  if (typeof fBuildCopy === 'function') {
    const copys = fBuildCopy(prod, de, por, val, desc, formato?.id || 'feed', camp && camp.name);
    return [
      { id: 'promo', label: 'Promo', text: copys.op1 },
      { id: 'engajar', label: 'Engajar', text: copys.op2 },
      { id: 'whatsapp', label: 'WhatsApp', text: copys.op3 }
    ];
  }

  // Fallback simples caso fBuildCopy não esteja disponível
  return [
    { id: 'promo', label: 'Promo', text: `Hoje tem *${prod}* por apenas *${por}*! Aproveite!` },
    { id: 'engajar', label: 'Engajar', text: `Marque aquele amigo que vai pagar esse *${prod}* pra você hoje!` },
    { id: 'whatsapp', label: 'WhatsApp', text: `Olá! *${prod}* por apenas *${por}*! Peça no app!` }
  ];
}

// Selo de ORIGEM da legenda. O painel dizia "Gerado por IA" SEMPRE — inclusive quando
// a legenda vinha do motor local (sem rede/sem chave). App que mente é bug (luma-brain §1.4);
// agora o selo segue o flag _ia que fFetchAICaptionSuggestions já devolvia.
const _ICO_SPARK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';
const _ICO_PEN = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
/* Substitui a legenda do motor local pela da IA quando ela chega. Se a IA falhou (o
   `fFetchAICaptionSuggestions` devolve o fallback com `_ia:false`), não mexe em nada —
   trocar texto igual por texto igual só piscaria a tela. */
function _fAplicarLegendaIA(canvasId, sug){
  if(!sug || !sug._ia || !sug.length) return;
  const painel = document.querySelector(`.caption-assistant-panel[data-canvas-id="${canvasId}"]`);
  if(!painel) return;                       // a pessoa já saiu da tela — nada a fazer
  _fArtCaptions[canvasId] = sug;
  const aba = painel.dataset.activeTab || sug[0].id;
  const sel = sug.find(x => x.id === aba) || sug[0];
  const box = document.getElementById('caption-content-' + canvasId);
  if(box){
    box.innerHTML = gEsc(sel.text).replace(/\n/g, '<br>');
    box.classList.remove('is-trocando'); void box.offsetWidth; box.classList.add('is-trocando');
  }
  const selo = painel.querySelector('.caption-src');
  if(selo) selo.outerHTML = _fCaptionSrcTag(sug);   // o rótulo passa a dizer a verdade
  /* ⚠ A legenda da IA chega DEPOIS do card (é async) e NÃO passa pelo `fSetCaption` — ela
     escreve direto na caixa. Sem esta linha, o contexto "Feed" do Ver como fica ficaria com a
     legenda do motor local enquanto o painel já mostrava a da IA: duas legendas para a mesma
     arte, que é exatamente o que a sincronia veio impedir. */
  try{ if(typeof fPostedRepintaLegenda==='function') fPostedRepintaLegenda(); }catch(e){}
}

function _fCaptionSrcTag(suggestions){
  const ia = !!(suggestions && suggestions._ia);
  const modelo = (typeof gAiModel === 'function') ? gAiModel() : '';
  return ia
    ? `<span class="caption-src is-ia" title="Texto gerado por Inteligência Artificial${modelo ? ' (' + gEsc(modelo) + ')' : ''} — confira antes de publicar">${_ICO_SPARK}Gerado por IA</span>`
    : `<span class="caption-src" title="Escrito pelo motor de copy do Luma (sem IA)">${_ICO_PEN}Sugestão do Luma</span>`;
}

/**
 * Agente Copywriter do Luma. Transporte e chave ficam no motor único (core/ai.js);
 * aqui vive só o PROMPT — o que a legenda tem que ser.
 *
 * Regras que o prompt carrega (e por quê):
 * - Zero emoji: regra de marca antiga desta base (o SVG é o ícone, o emoji não).
 * - Nada de inventar preço, validade ou benefício: a legenda acompanha uma arte
 *   com dados reais; texto que promete o que a peça não diz vira reclamação na loja.
 * - Uma ANGULAÇÃO por opção (vender / engajar / lista de WhatsApp) e formato certo
 *   por canal — story é curto, feed é completo, WhatsApp usa *negrito*.
 * - Ancorado na cidade: é a alavanca real do franqueado (hiperlocal, 00_PRODUCT §1).
 * O motor local (fBuildCopy, via fGenCaptionSuggestions) segue sendo o fallback —
 * sem rede, sem chave ou com resposta torta, a legenda continua saindo.
 */
/* ══ JEITO LOCAL — as expressões da cidade, pesquisadas uma vez ═══════════════════════════
   O franqueado é vizinho de quem lê ("o dono do app mora na cidade", 00_PRODUCT §1). Uma
   legenda escrita em português neutro perde exatamente isso. Aqui o modelo levanta as
   expressões da cidade UMA vez por franqueado, e elas entram no prompt da legenda como
   TEMPERO — no máximo uma, e só quando couber sozinha.

   ⚠ O QUE ISTO É E O QUE NÃO É. Não há busca na web: o modelo responde do que sabe, e para
   cidade pequena ele pode não saber. Por isso o prompt pede lista CURTA e certa em vez de
   longa, aceita `[]` como resposta legítima, e a legenda nunca depende da lista para sair.
   A revisão final é de quem publica — a legenda já é oferecida como sugestão editável.

   Cache no localStorage por CIDADE. Sumiu (aba limpa, outro aparelho, franqueado mudou a
   cidade) → pesquisa de novo na próxima legenda. Prazo de 180 dias porque lista errada não
   pode ficar para sempre; gíria não muda em um mês. */
const F_GIRIAS_KEY = 'dm_girias_v1';
const F_GIRIAS_DIAS = 180;
const F_GIRIAS_MAX = 6;

/* A cidade do franqueado NÃO é entidade do Luma (01_BUSINESS §1) — ela aparece de raspão em
   dois lugares que já existem. Aqui é só a leitura, na ordem do mais específico: o campo da
   arte que está sendo feita, o "Sua cidade" do Sheets, e o que já foi visto antes. Sem
   nenhum dos três não há cidade — e sem cidade o recurso simplesmente não roda. */
const F_CIDADE_KEY = 'dm_cidade_v1';
function fCidadeAtual(){
  let c = '';
  try{ c = (fState && fState.dados && fState.dados.cidade) || ''; }catch(e){}
  try{ c = c || localStorage.getItem('luma_bulk_city') || localStorage.getItem(F_CIDADE_KEY) || ''; }catch(e){}
  c = String(c || '').trim();
  // Lembra pra próxima sessão quando a cidade veio da arte — a cobertura cresce com o uso,
  // sem inventar uma tela de cadastro pra um dado que mora no Portal.
  if(c){ try{ localStorage.setItem(F_CIDADE_KEY, c); }catch(e){} }
  return c;
}
const _fGiriaChave = (c) => String(c||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function fGiriasCache(cidade){
  try{
    const g = JSON.parse(localStorage.getItem(F_GIRIAS_KEY) || 'null');
    if(!g || !Array.isArray(g.termos)) return null;
    if(_fGiriaChave(g.cidade) !== _fGiriaChave(cidade)) return null;         // outra cidade
    if(Date.now() - (g.ts||0) > F_GIRIAS_DIAS*864e5) return null;            // venceu
    return g.termos;
  }catch(e){ return null; }
}

/* Pesquisa (uma vez por cidade) e guarda. Devolve [] quando não há nada confiável — e `[]`
   também é resposta guardada: sem isso, cidade que o modelo não conhece viraria uma chamada
   nova a cada legenda, para sempre. */
async function fGiriasDaCidade(cidade){
  if(!cidade) return [];
  const cache = fGiriasCache(cidade);
  if(cache) return cache;
  if(typeof gAskAI !== 'function' || typeof gAiReady !== 'function' || !gAiReady()) return [];

  const prompt = `Você conhece o modo de falar das cidades do interior do Brasil. Liste expressões REALMENTE usadas no dia a dia em ${cidade}.

REGRAS:
1. Só entra expressão que você tem certeza de que é usada nessa cidade ou na região dela. Na dúvida, devolva MENOS — lista curta e certa vale mais que lista longa e inventada.
2. Nada de gíria nacional genérica que se fala no Brasil inteiro, nada de palavrão e nada que possa soar pejorativo ou debochado com quem mora lá.
3. Só serve o que caberia numa legenda sobre comida, pedido ou promoção.
4. No máximo ${F_GIRIAS_MAX} expressões.
5. Se você não conhece nada específico dessa cidade, devolva a lista vazia — é resposta certa.

Responda APENAS com JSON válido:
{"termos":[{"termo":"a expressão","significado":"o que quer dizer, em 4 palavras","exemplo":"frase curta de delivery usando a expressão"}]}`;

  let termos = [];
  try{
    const txt = await gAskAI('girias', prompt, { json:true });
    const parsed = txt && (typeof gAiParseJson==='function' ? gAiParseJson(txt) : null);
    termos = (parsed && Array.isArray(parsed.termos) ? parsed.termos : [])
      .map(t => ({ termo:String((t&&t.termo)||'').trim(), significado:String((t&&t.significado)||'').trim() }))
      // Filtro de formato, não de conteúdo: expressão é curta. Frase inteira aqui é o modelo
      // devolvendo outra coisa — e emoji nunca entra em nada desta base.
      .filter(t => t.termo && t.termo.length <= 24
        && !/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t.termo + t.significado))
      .slice(0, F_GIRIAS_MAX);
  }catch(e){ termos = []; }
  try{ localStorage.setItem(F_GIRIAS_KEY, JSON.stringify({cidade, ts:Date.now(), termos})); }catch(e){}
  return termos;
}

async function fFetchAICaptionSuggestions(dados, camp, formato) {
  const fallback = fGenCaptionSuggestions(dados, camp, formato);
  fallback._ia = false;   // marca a ORIGEM: a UI rotula IA x motor local (ver painel de legenda)
  if (typeof gAskAI !== 'function' || !gAiReady()) return fallback;

  const prod = dados.produto || dados.item || dados.categoria || dados.oferta || (camp && camp.name) || 'Oferta especial';
  const de = dados.precoDe ? `R$ ${dados.precoDe}` : '';
  const por = dados.precoPor ? `R$ ${dados.precoPor}` : (dados.preco ? `R$ ${dados.preco}` : '');
  const val = dados.validade || '';
  const desc = dados.desconto || dados.detalhes || '';
  const campName = (camp && camp.name) ? camp.name : 'Delivery Much';
  const cidade = dados.cidade || (typeof fState !== 'undefined' && fState.dados && fState.dados.cidade) || ''
    || (typeof fCidadeAtual === 'function' ? fCidadeAtual() : '');
  const cidadeTag = cidade.replace(/[^a-zA-Z0-9]/g, '');
  const fmtId = (formato && formato.id) || (typeof fState !== 'undefined' && fState.fmt && fState.fmt.id) || 'feed';
  const ehStory = fmtId === 'story';

  // Só entra no prompt o que EXISTE — campo vazio virava "por undefined" / "validade: Tempo limitado"
  // inventado, e o modelo repetia a invenção na legenda.
  const fatos = [
    `Produto: ${prod}`,
    de ? `Preço antigo: ${de}` : '',
    por ? `Preço promocional: ${por}` : '',
    desc ? `Vantagem: ${desc}` : '',
    val ? `Validade: ${val}` : '',
    `Campanha: ${campName}`,
    cidade ? `Cidade do franqueado: ${cidade}` : ''
  ].filter(Boolean).join('\n');

  const hashtags = cidadeTag
    ? `Termine com hashtags: #${cidadeTag} #Delivery${cidadeTag} #DeliveryMuch`
    : `Termine com hashtags: #DeliveryMuch #Delivery`;

  /* O tempero local. Pesquisado uma vez por cidade (fGiriasDaCidade) e guardado; daqui em
     diante é leitura de localStorage. Sem cidade, sem IA ou sem lista confiável, o bloco
     simplesmente não existe e a legenda sai como sempre saiu. */
  let blocoGirias = '';
  try{
    const girias = await fGiriasDaCidade(cidade);
    if(girias && girias.length){
      const lista = girias.map(g => `"${g.termo}"${g.significado ? ` (${g.significado})` : ''}`).join(', ');
      blocoGirias = `\n\nJEITO DE FALAR EM ${cidade.toUpperCase()} (opcional): ${lista}.`;
    }
  }catch(e){}

  const prompt = `Você escreve legendas para o Delivery Much, o app de delivery das cidades do interior do Brasil. Quem publica é o franqueado da cidade — dono do app ali, vizinho do cliente. Tom: simples, amigável, direto e próximo; português do Brasil; frase curta; nada de jargão de agência nem de "imperdível/incrível".

FATOS DA PEÇA (a legenda acompanha uma arte com estes dados):
${fatos}

REGRAS OBRIGATÓRIAS:
1. NUNCA use emoji — nenhum, em nenhuma opção.
2. NÃO invente preço, prazo, brinde, frete ou benefício que não esteja nos fatos acima. Sem preço nos fatos, escreva sem citar valor.
3. As 3 opções têm ângulos DIFERENTES entre si — não reescreva a mesma frase.
4. ${ehStory ? 'Formato STORY: no máximo 2 linhas curtas em "promo" e "engajar" (texto que caiba num story, leitura de 2 segundos).' : 'Formato FEED: "promo" e "engajar" podem ter 2 a 4 linhas.'}
5. ${hashtags} — só em "promo" e "engajar". A opção "whatsapp" NÃO leva hashtag.
6. "whatsapp" é mensagem pra lista de transmissão: usa *asteriscos* pra negrito e chama pra pedir no app.${blocoGirias ? `
7. Sobre o jeito de falar da cidade: use NO MÁXIMO UMA dessas expressões, em UMA das três opções, e só se ela couber com naturalidade na frase. Se nenhuma couber, NÃO force — gíria enfiada soa falsa e o franqueado é vizinho de quem lê. Nunca explique a expressão nem use mais de uma.` : ''}${blocoGirias}

Responda APENAS com JSON válido:
{"promo":"legenda que vende (foco na oferta)","engajar":"legenda que puxa comentário/marcação de amigo","whatsapp":"mensagem curta pra lista do WhatsApp com *negrito*"}`;

  const texto = await gAskAI('legenda', prompt, { json: true });
  const parsed = texto && (typeof gAiParseJson === 'function' ? gAiParseJson(texto) : null);
  if (!parsed) return fallback;

  const limpa = (v, i) => {
    let s = (typeof v === 'string' ? v : '').trim();
    // Cinto de segurança da regra 1: modelo às vezes escorrega um emoji. Tira em vez de
    // devolver peça fora do padrão de marca.
    s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '').replace(/[ \t]{2,}/g, ' ').trim();
    return s || fallback[i].text;
  };
  const out = [
    { id: 'promo', label: 'Promo', text: limpa(parsed.promo, 0) },
    { id: 'engajar', label: 'Engajar', text: limpa(parsed.engajar, 1) },
    { id: 'whatsapp', label: 'WhatsApp', text: limpa(parsed.whatsapp, 2) }
  ];
  // Regra 3 conferida no código, não só pedida no prompt: opção repetida cai pro motor local.
  if (out[1].text === out[0].text) out[1].text = fallback[1].text;
  if (out[2].text === out[0].text) out[2].text = fallback[2].text;
  out._ia = true;
  return out;
}

/**
 * Pinta uma das legendas geradas no card. A variação (promo/engajar/whatsapp) deixou de
 * ser chip na superfície — virou o botão discreto "Gerar outra sugestão", que cicla a
 * lista. `data-active-tab` continua sendo a fonte da verdade de qual texto está ativo
 * (usado por fCopyCaption, _fActiveCaptionText e pelo download/compartilhar).
 */
/* ⚠ Toda troca de legenda passa por aqui (o `fCycleCaption` chama este), então este é o
   ponto único para manter o contexto "Feed" do Ver como fica em sincronia com o painel.
   Sem isto, trocar a sugestão mudava o texto no painel e o mockup seguia com o antigo. */
function fSetCaption(canvasId, tabId) {
  const container = document.querySelector(`.caption-assistant-panel[data-canvas-id="${canvasId}"]`);
  const box = document.getElementById('caption-content-' + canvasId);
  const caps = _fArtCaptions[canvasId];
  if (!container || !box || !caps) return;
  const selected = caps.find(c => c.id === tabId) || caps[0];
  if (!selected) return;
  container.dataset.activeTab = selected.id;
  box.innerHTML = gEsc(selected.text).replace(/\n/g, '<br>');
  box.classList.remove('is-swapping');
  void box.offsetWidth;
  box.classList.add('is-swapping');
  // O "Ver como fica" no ambiente Feed mostra a legenda de verdade: repinta junto.
  try{ if(typeof fPostedRepintaLegenda==='function') fPostedRepintaLegenda(); }catch(e){}
}

/** Avança para a próxima sugestão de legenda (ciclo). */
function fCycleCaption(canvasId) {
  const caps = _fArtCaptions[canvasId];
  if (!caps || caps.length < 2) return;
  const container = document.querySelector(`.caption-assistant-panel[data-canvas-id="${canvasId}"]`);
  const atual = (container && container.dataset.activeTab) || caps[0].id;
  const i = caps.findIndex(c => c.id === atual);
  fSetCaption(canvasId, caps[(i + 1 + caps.length) % caps.length].id);
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
      
      gToast('Legenda copiada!');
      
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
    gToast('Não consegui copiar sozinha — selecione o texto e copie na mão.', 'error');
  }
  document.body.removeChild(ta);
}

// Texto da legenda ativa de uma bolha de arte (para copiar junto no download / compartilhar).
function _fActiveCaptionText(snapId){
  const caps=_fArtCaptions[snapId]; if(!caps||!caps.length) return '';
  const panel=document.querySelector(`.caption-assistant-panel[data-canvas-id="${snapId}"]`);
  const tab=(panel&&panel.dataset.activeTab)||'promo';
  const sel=caps.find(c=>c.id===tab)||caps[0];
  return sel?sel.text:'';
}
// Copia texto (Clipboard API com fallback execCommand). Reusa fCopyFallback.
function _fCopyText(text){
  if(!text) return;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).catch(()=>fCopyFallback(text,()=>{}));
  } else fCopyFallback(text,()=>{});
}

function fGerarArte(){
  fState.done=true;fUpdateProg();
  fClearChatDraft();
  fState.editIdx=null;
  const wrap = document.querySelector('.lp-canvas-wrap');
  if(wrap){
    wrap.classList.remove('is-rendering');
    void wrap.offsetWidth;
    wrap.classList.add('is-rendering');
    setTimeout(() => wrap.classList.remove('is-rendering'), 650);
  }
  const existing=document.getElementById('confirm-msg'); if(existing) existing.remove();
  const box=document.getElementById('f-msg-box');
  if(box){box.disabled=false;box.placeholder='Arte gerada! Escolha um formato ou gere outra…';}
  const snd=document.getElementById('f-snd'); if(snd) snd.disabled=false;
  const mic=document.getElementById('f-chat-mic'); if(mic) mic.disabled=false;
  const d=fState.dados,c=fState.camp;
  fAddBot('Gerando sua arte agora…',[]);
  setTimeout(async ()=>{
    const prod=d.produto||d.categoria||d.brinde||d.oferta||c.name;
    const por=d.precoPor||d.desconto||'Ver no app';
    const de=d.precoDe?`De ${d.precoDe}`:'';
    const val=d.validade||'';
    fState._lastHistId = fAddHist(d,c,fState.fmt,'rascunho'); // id correto mesmo com dedup (C8)
    if(typeof gTrackEvent==='function') gTrackEvent('arte_gerada',{camp_id:c.id,camp_name:c.name,fmt_id:fState.fmt.id,template_id:(fState.material&&(fState.material.remoteId||fState.material.id))||null});
    const msgs=document.getElementById('f-messages');
    const w=document.createElement('div');w.className='msg bot';
    // ID único pro canvas thumbnail
    const previewCanvasId = 'art-preview-'+Date.now();
    // Congela os dados desta arte pra os botões da bolha não usarem o estado futuro.
    // Inclui o MATERIAL: fRenderCanvasHelper lê fState.material — sem congelar, baixar
    // de uma bolha antiga após trocar de material renderizava o template errado.
    _fArtSnapshots[previewCanvasId] = {dados:{...d}, camp:c, fmt:fState.fmt, histId:fState._lastHistId, material:fState.material};
    
    /* ⚠ A ARTE NÃO ESPERA A LEGENDA. Antes havia um `await` da IA aqui: a bolha inteira —
       arte, botões, tudo — só nascia depois que a legenda voltasse. Medido com a IA fora do
       ar: 13,5s até a arte aparecer, e num 4G ruim vai a 60s (dois timeouts de 30s em
       série, gírias + legenda). O franqueado do interior ficava olhando "Gerando sua arte
       agora…" com a arte pronta em memória.
       Agora a bolha nasce com a legenda do MOTOR LOCAL (síncrona, sempre boa o bastante) e
       a versão da IA entra por cima quando chega — `_fAplicarLegendaIA` faz a troca. */
    const suggestions = fGenCaptionSuggestions(d, c, fState.fmt);
    suggestions._ia = false;
    _fArtCaptions[previewCanvasId] = suggestions;
    const _legendaIA = fFetchAICaptionSuggestions(d, c, fState.fmt);

    // ENTREGA FINAL, parte 2 de 3: a legenda. Card editorial (título + selo de origem +
    // descrição curta + bloco de texto) em vez da textarea com chips Promo/Engajar/WhatsApp:
    // o franqueado copia e publica, não escolhe taxonomia. As 3 variações continuam sendo
    // geradas — viraram o "Gerar outra sugestão" discreto no rodapé do card.
    const temAlt = suggestions.length > 1;
    const captionHtml = `<section class="caption-assistant-panel" data-canvas-id="${previewCanvasId}" data-active-tab="${suggestions[0].id}">
      <header class="caption-card-head">
        <div class="caption-card-heads">
          <h4 class="caption-card-title">Legenda pronta</h4>
          <p class="caption-card-sub">Copie e publique junto com a arte.</p>
        </div>
        ${_fCaptionSrcTag(suggestions)}
      </header>
      <div class="caption-content-box" id="caption-content-${previewCanvasId}">
        ${gEsc(suggestions[0].text).replace(/\n/g, '<br>')}
      </div>
      <footer class="caption-card-foot">
        ${temAlt ? `<button type="button" class="caption-alt-btn" onclick="fCycleCaption('${previewCanvasId}')" title="Trocar por outra sugestão de legenda">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Gerar outra sugestão
        </button>` : '<span></span>'}
        <button type="button" class="caption-copy-btn" onclick="fCopyCaption('${previewCanvasId}')" title="Copiar legenda">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copiar legenda
        </button>
      </footer>
    </section>`;

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
      canvasBlock = `<div class="art-canvas-real" style="background:${gSafeColor(c.color)};width:${previewW}px;height:${previewH}px"><canvas id="${previewCanvasId}" width="${previewW}" height="${previewH}" style="display:block;width:100%;height:100%"></canvas></div>`;
    } else {
      // Fallback HTML antigo
      const fotoProduto = d.foto_produto;
      const logoLoja = d.logo_loja;
      const fotoBlock = (fotoProduto && fotoProduto.startsWith('data:image'))
        ? `<div class="art-foto-wrap"><img class="art-foto" src="${gEsc(fotoProduto)}" alt=""/></div>` : '';
      const logoBlock = (logoLoja && logoLoja.startsWith('data:image'))
        ? `<img class="art-logo-loja" src="${gEsc(logoLoja)}" alt=""/>` : '';
      canvasBlock = `<div class="art-canvas ${fotoProduto?'has-foto':''}" style="background:${gSafeColor(c.color)}">
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
    w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div>
      <div class="bbl art-ok">
        <span class="art-ok-tick" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
        <span class="art-ok-copy"><strong>Sua arte está pronta</strong><!--
          O "Salva em Minhas artes" só aparece no CELULAR (CSS). No desktop essa mesma frase
          chega logo depois, na mensagem de rodapé do fGerarArte; no celular aquela mensagem
          não existe (ela roubaria a cena da entrega), então a informação mora aqui.
       --><small class="art-ok-sub">Salva em Minhas artes</small></span>
      </div>
      <div class="art-wrap">
        <div class="art-preview-mat">${canvasBlock}</div>
        <div class="multi-fmt-row" style="${(fState.material && fState.material.fmt) ? 'display:none;' : ''}">
          ${FMTS.map(f=>`<div class="fmt-mini ${f.id===fState.fmt.id?'current':''}" onclick="fOutroFormato('${f.id}','${previewCanvasId}')">
            <div class="fmt-mini-thumb" style="background:${gSafeColor(c.color)}">${f.name.toUpperCase()}</div>
            <div class="fmt-mini-label" style="display:flex;align-items:center;justify-content:center;gap:3px">${f.name}${f.id===fState.fmt.id?' <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
          </div>`).join('')}
        </div>
        ${captionHtml}
        <section class="art-actions">
          <!-- Baixar e Refazer com o MESMO PESO, a pedido do Ryan (09/09): mesma caixa, mesma
               altura, mesmo corpo de texto, cada um com metade da linha. O Refazer era um link
               cinza de 12px ao lado de uma barra laranja de largura cheia — não era hierarquia,
               era um sumindo ao lado do outro.
               O laranja fica só no Baixar porque ele é a cor da MARCA na ação de entrega; o que
               igualou foi a geometria e a tipografia, que é o que o olho pesa primeiro. Se for
               para igualar também o preenchimento, é tirar o 'pri' da classe.
               ATENÇÃO: comentário DENTRO de template literal — nada de crase aqui. -->
          <div class="art-actions-dupla">
            <button type="button" class="art-btn pri art-download" onclick="fBaixar(this,'${previewCanvasId}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="4" x2="12" y2="16"/><polyline points="18 11 12 17 6 11"/><path d="M5 20h14"/></svg>Baixar PNG</button>
            <button type="button" class="art-btn art-redo" onclick="fRefazer()" title="Reiniciar as respostas desta arte"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Refazer</button>
          </div>
          <!-- ATENÇÃO: comentário DENTRO de template literal — nada de crase aqui.
               ⛔ NÃO EXISTE "Publicar no Instagram" AQUI, e é deliberado (Ryan, 11/09).
               O botão chegou a existir por algumas horas nesta mesma data e saiu: publicação
               direta não existe no Luma. O fPostarInstagram faz share NATIVO do sistema, que
               é outra coisa — mas o rótulo prometia publicar, e promessa maior que a
               capacidade é o que esta regra corta. Enquanto não houver integração de verdade,
               a entrega oferece o que entrega: baixar o arquivo e copiar a legenda.
               O motor segue vivo em png-generator.js, sem chamador, de propósito. -->
          <button type="button" class="art-btn art-voltar" onclick="fVoltarParaEdicao()" title="Voltar para a edição sem perder nada do que você já respondeu">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>Voltar para edição
          </button>
        </section>
        <!-- Gerar em lote DE VOLTA no card, a pedido do Ryan (09/09). Ele saiu na rodada de
             enxugamento e é uma ação de outra natureza (produção em escala), então volta como
             faixa própria embaixo das duas ações da arte — não disputa a linha com elas. -->
        <button type="button" class="art-bulk-btn" onclick="fBulkOpenFromArt()" title="Gerar dezenas de variações desta arte em lote">
          <span class="art-bulk-ico"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
          <span class="art-bulk-txt"><strong>Gerar em lote</strong><em>Dezenas de variações desta arte de uma vez</em></span>
          <svg class="art-bulk-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>`;
    /* ⚠ Finalizar DE NOVO (voltar para a edição e concluir outra vez) gera um SEGUNDO card:
       isto aqui é `appendChild`, não substituição. No estado "arte pronta" os dois ficavam em
       cena, cada um com seu Baixar PNG — medido indo e voltando três vezes: três cards.
       A entrega anterior vira `art-superada` e o CSS a tira de cena SÓ naquele modo; na
       conversa normal ela continua lá, que é o histórico honesto do que aconteceu. */
    try{ msgs.querySelectorAll('.art-wrap').forEach(el=>{ const m=el.closest('.msg'); if(m) m.classList.add('art-superada'); }); }catch(e){}
    msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
    _legendaIA.then(sug => _fAplicarLegendaIA(previewCanvasId, sug)).catch(()=>{});
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
          await fRenderTemplateLayers(octx, fState.material.layers, mw, mh, d, c, null,
            {scope:'franqueado',purpose:'preview'});
          await fDrawDMLogo(octx, mw, mh);
          const ctx = cv.getContext('2d');
          ctx.clearRect(0,0,cv.width,cv.height);
          ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
          ctx.drawImage(off, 0,0,mw,mh, 0,0,cv.width,cv.height);
        }
      } catch(e){ console.warn('Erro ao renderizar preview:', e); }
    }
    fLpRefresh();
    /* ⛔ O FEEDBACK SAIU DA ENTREGA. Aqui ele era montado dentro do `.art-wrap` no momento da
       GERAÇÃO — grudado na arte, em toda arte, antes mesmo de a pessoa baixar. Virou convite
       pós-download com carência (`fFeedbackAfterDownload`, feedback.js). A feature é a mesma;
       o que mudou é quando e onde ela pede. */
    /* ⚠ ESTA MENSAGEM NÃO PODE EXISTIR NO CELULAR. Lá o painel mostra só a bolha
       `.active-prompt`, e esta chega 500ms DEPOIS da entrega — ela roubaria o `active-prompt`
       do card que acabou de nascer e o "Baixar PNG" sumiria da tela meio segundo depois de
       aparecer. Além disso ela fala de "clique em outro formato", que é a fileira de formatos
       do próprio card: no celular a orientação viria antes do olho chegar no controle.
       No desktop a conversa inteira continua em cena e a mensagem segue fazendo sentido. */
    /* ⛔ ESTA MENSAGEM SAIU DE VEZ (11/09). Ela era um balão de chat inteiro dizendo o que o
       card de entrega agora diz numa linha discreta ("Salva em Minhas artes", no `.art-ok-sub`),
       e chegava 500ms DEPOIS da entrega — no estado final ela reabria a conversa que o modo
       "arte pronta" acabou de encerrar. A parte útil ("clique em outro formato") mora na
       própria fileira de formatos do card, ao alcance do olho.
       ⚠ O `.art-ok-sub` deixou de ser só-celular por causa disto: ele passou a ser o ÚNICO
       lugar que comunica a persistência. A persistência em si não mudou (ver `fSaveHist`). */
  },800);
}
async function fOutroFormato(id, snapId){
  const f=FMTS.find(x=>x.id===id);if(!f)return;
  const snap=(snapId&&_fArtSnapshots[snapId])||{dados:fState.dados,camp:fState.camp,fmt:fState.fmt,material:fState.material};
  // Guarda por BOLHA: compara com o formato desta arte, não com o global (outra bolha pode ter outro fmt)
  if(snap.fmt && f.id===snap.fmt.id) return;
  const prevFmt=fState.fmt;         // p/ reverter se a geração falhar (senão o rail fica num fmt que não saiu)
  fState.fmt=f;fRenderFmts();fUpdateCtx();

  // Atualiza as sugestões de legenda para o novo formato
  const suggestions = await fFetchAICaptionSuggestions(snap.dados, snap.camp, f);
  _fArtCaptions[snapId] = suggestions;

  // Atualiza a UI se o card correspondente estiver no DOM
  const panel = document.querySelector(`.caption-assistant-panel[data-canvas-id="${snapId}"]`);
  if (panel) {
    // Mantém a variação que o franqueado já estava lendo, agora com o texto do novo formato
    fSetCaption(snapId, panel.dataset.activeTab || suggestions[0].id);

    // Origem pode mudar entre formatos (a IA pode falhar só numa das chamadas)
    const srcOld = panel.querySelector('.caption-src');
    if (srcOld) srcOld.outerHTML = _fCaptionSrcTag(suggestions);

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
    if(typeof gTrackEvent==='function') gTrackEvent('arte_baixada',{camp_id:snap.camp.id,fmt_id:f.id,tipo:'png',outro_formato:true});
    snap.fmt=f; // a bolha agora "é" deste formato — o Baixar PNG dela acompanha
    gToast(`${f.name} baixado!`);
    await _fRerenderArtThumb(snapId, snap, f); // thumb acompanha a nova geometria
  }catch(e){
    console.warn('Falha ao gerar no formato '+f.name+':', e);
    if(typeof gHandleLayoutUnsafeError==='function'&&gHandleLayoutUnsafeError(e)){
      fState.fmt=prevFmt; fRenderFmts(); fUpdateCtx();
      return;
    }
    gToast('Não consegui gerar nesse formato. Tente de novo.','error');
    fState.fmt=prevFmt; fRenderFmts(); fUpdateCtx(); // reverte o rail ao formato que estava
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
    await fRenderTemplateLayers(octx, mat.layers, mw, mh, snap.dados, snap.camp, null,
      {scope:'franqueado',purpose:'preview'});
    const ctx=cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(off, 0,0,mw,mh, 0,0,cv.width,cv.height);
  }catch(e){ console.warn('Thumb re-render falhou:', e); }
  finally{ fState.material=prevMat; }
}
async function fBaixar(btn, snapId){
  // Controle do produto: o download é o entregável do franqueado — o guard fica
  // no funil, não só no botão, para cobrir atalho e chamada programática.
  if(typeof gFeatureCan==='function' && !gFeatureCan('franqueado.export.png','execute')){
    if(typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback('franqueado.export.png');
    return;
  }
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
    if(typeof gTrackEvent==='function') gTrackEvent('arte_baixada',{camp_id:snap.camp.id,fmt_id:snap.fmt.id,tipo:'png'});
    if(typeof fFeedbackAfterDownload==='function') fFeedbackAfterDownload(snap,btn,snapId,'png');
    // Baixa a imagem e já deixa a legenda na área de transferência — 1 passo a menos pra postar.
    const cap=_fActiveCaptionText(snapId);
    if(cap){ _fCopyText(cap); gToast('Arte baixada • legenda copiada!'); }
    else gToast('Arte baixada!');
    if (typeof gTriggerOnboardingStep === 'function') {
      gTriggerOnboardingStep('downloadedPng');
    }
  }catch(e){
    console.warn('Falha ao gerar PNG:', e);
    if(typeof gHandleLayoutUnsafeError==='function'&&gHandleLayoutUnsafeError(e))return;
    gToast('Não consegui gerar o arquivo. Tente enviar a foto de novo pelo botão de upload, ou escolha outra imagem.','error','ajuda-upload');
  }finally{ fState.material=prevMat; restore(); }
}
/* ══ CONTROLE E CONFIANÇA — o desfazer de UMA ação do franqueado ═══════════════════════════
   Achado do teste: a pessoa clicou em "Refazer minha arte", se arrependeu e não achou volta.

   ⛔ ISTO NÃO É UM HISTÓRICO, e não tem parentesco com o undo do Estúdio
   (`js/designer/undo-redo.js`, `dUndo`/`dRedo`, que empilha estados de camada). Aqui é UM
   SLOT: a última ação desfazível do franqueado, com o estado necessário para voltar e um
   rótulo para a UI. Slot novo a cada ação; sem pilha, sem redo, sem memória entre sessões.
   Foi de propósito — pilha aqui significaria decidir o que acontece quando a pessoa desfaz
   três passos e digita, e o V1 não precisa dessa pergunta.

   Quem registra chama `_fUndoRegistra(rotulo, restaurar)`. Quem oferece são os dois lugares
   onde a ação acontece: o toast (`gToast` com ação) e o botão do cabeçalho do chat. O atalho
   Ctrl/Cmd+Z entra pelo mesmo funil.  */
let _fUndoSlot = null;   // {rotulo, restaurar, ts}

function _fUndoRegistra(rotulo, restaurar){
  if(typeof restaurar !== 'function') return;
  _fUndoSlot = { rotulo: String(rotulo||'ação'), restaurar, ts: Date.now() };
  _fUndoSyncBotao();
}
function _fUndoLimpa(){ _fUndoSlot = null; _fUndoSyncBotao(); }
function fUndoDisponivel(){ return !!_fUndoSlot; }

/* O botão do cabeçalho é a metade DESCOBRÍVEL do desfazer: o toast passa, ele fica.
   Só existe quando há o que desfazer — botão permanentemente desabilitado ensina a ignorar. */
function _fUndoSyncBotao(){
  const btn = document.getElementById('f-undo-btn');
  if(!btn) return;
  const tem = !!_fUndoSlot;
  btn.hidden = !tem;
  if(tem){
    const t = 'Desfazer: ' + _fUndoSlot.rotulo;
    btn.title = t;
    btn.setAttribute('aria-label', t);
  }
}
function fDesfazer(){
  const slot = _fUndoSlot;
  if(!slot){ if(typeof gToast==='function') gToast('Não há nada para desfazer agora.'); return false; }
  _fUndoSlot = null;                 // consome ANTES de restaurar: restaurar repinta e pode registrar de novo
  _fUndoSyncBotao();
  try { slot.restaurar(); }
  catch(e){ console.warn('[Luma] desfazer falhou:', e); if(typeof gToast==='function') gToast('Não consegui desfazer.'); return false; }
  if(typeof gToast==='function') gToast(slot.rotulo + ' — desfeito.');
  return true;
}

/* Ctrl/Cmd+Z SÓ do lado do franqueado e só quando não se está digitando: no Estúdio a mesma
   tecla é do `dUndo`, e dentro de um campo ela é o desfazer do NAVEGADOR (que a pessoa espera
   ao corrigir uma palavra). Sem essas duas guardas o atalho roubaria os dois. */
document.addEventListener('keydown', (e)=>{
  if(!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
  if(String(e.key).toLowerCase() !== 'z') return;
  if(!document.body.classList.contains('mode-franqueado')) return;
  const alvo = e.target;
  if(alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName||''))) return;
  if(!_fUndoSlot) return;            // nada a desfazer → deixa o atalho passar
  e.preventDefault();
  fDesfazer();
});

/* ══ REFAZER A ARTE — o que ele faz hoje, medido antes de mexer ════════════════════════════
   Levantamento pedido, feito nos três caminhos que existiam:
     · `fRefazer()`   (botão "Refazer" no card da arte): zerava `dados`, `stepIdx`, `done`,
       `_fArtSnapshots`, `_fArtCaptions`, o cache de imagem e a conversa inteira — SEM PERGUNTAR.
     · `fResetFlow()` (botão "Recomeçar" no cabeçalho): mesma destruição, mas com confirmação
       por chips no chat — e só quando já havia dados.
     · `fEditarTudo()`: um terceiro reset, sem confirmação e SEM NENHUM CHAMADOR (código morto
       desde que o card de revisão saiu). Removido.
   O que NENHUM deles fazia: limpar o rascunho do localStorage (ficava um fantasma até a
   próxima gravação), trocar o material ou o formato (esses sobrevivem, e é o certo), ou
   guardar como voltar atrás.
   Daí o desenho novo: UMA porta de UI (`fAskRestartArt`) que confirma, e UM motor
   (`fRestartArt`) que executa. Teste e código interno podem chamar o motor direto. */

// Tudo que precisa voltar junto para o chat e a prévia contarem a MESMA história. Cópia rasa
// de `dados` é suficiente porque os valores são strings/dataURLs; `__fit__*` é objeto e por
// isso vai clonado — sem isso, cancelar um enquadramento depois do undo mexeria no snapshot.
function _fSnapshotArte(){
  const d = fState.dados || {};
  const dados = {};
  Object.keys(d).forEach(k=>{
    const v = d[k];
    dados[k] = (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
  });
  return {
    dados,
    stepIdx: fState.stepIdx,
    done: !!fState.done,
    editIdx: fState.editIdx,
    material: fState.material,           // referência: o material é imutável nesta sessão
    fmt: fState.fmt,
    camp: fState.camp,                   // carrega as `perguntas` — o fPickLoja as filtra
    extractedColors: Object.assign({}, fState.extractedColors || {}),
    // A CONVERSA também é estado: sem ela o chat volta vazio com a prévia cheia — as duas
    // metades contando histórias diferentes, que é o defeito que a rodada anterior matou.
    mensagens: (document.getElementById('f-messages')||{}).innerHTML || '',
    snapshots: Object.assign({}, _fArtSnapshots),
    captions: Object.assign({}, _fArtCaptions),
    draft: (()=>{ try{ return localStorage.getItem('luma_chat_draft'); }catch(e){ return null; } })()
  };
}

function _fRestauraArte(s){
  if(!s) return;
  fState.dados = s.dados;
  fState.stepIdx = s.stepIdx;
  fState.done = s.done;
  fState.editIdx = s.editIdx;
  fState.material = s.material;
  fState.fmt = s.fmt;
  fState.camp = s.camp;
  fState.extractedColors = s.extractedColors;
  _fArtSnapshots = s.snapshots;
  _fArtCaptions = s.captions;
  const msgs = document.getElementById('f-messages');
  if(msgs) msgs.innerHTML = s.mensagens;
  try{
    if(s.draft == null) localStorage.removeItem('luma_chat_draft');
    else localStorage.setItem('luma_chat_draft', s.draft);
  }catch(e){}
  clearTimeout(fNextTimeout);            // o reset agendou o passo 1; ele não pode chegar depois
  try{ fUpdateProg(); }catch(e){}
  try{ fUpdateCtx(); }catch(e){}
  try{ fLpRefresh(); }catch(e){}
  if(msgs) msgs.scrollTop = msgs.scrollHeight;
}

/* A PORTA DE UI. Todo CTA visível de refazer/recomeçar entra por aqui — é o que impede o
   "às vezes não avisa" que o time relatou (eram dois botões, um com confirmação e outro sem). */
async function fAskRestartArt(){
  // Nada respondido ainda: não há o que perder, então perguntar é só uma porta a mais.
  const temDados = fState.dados && Object.keys(fState.dados).some(k=>!/^__/.test(k) && fState.dados[k]!=='' && fState.dados[k]!=null);
  if(!temDados && !fState.done){ fRestartArt({silencioso:true}); return true; }
  const ok = (typeof gConfirm==='function')
    ? await gConfirm('Isso vai reiniciar as respostas desta arte. A versão atual fica disponível para desfazer logo depois.',
        { title:'Refazer esta arte?', okLabel:'Refazer arte', cancelLabel:'Cancelar', danger:true })
    : true;
  if(!ok) return false;
  fRestartArt();
  return true;
}

/* O MOTOR. Não pergunta nada — quem pergunta é o fAskRestartArt. */
function fRestartArt(opts){
  opts = opts || {};
  const antes = opts.silencioso ? null : _fSnapshotArte();
  fState.stepIdx = -1;
  fState.dados = {};
  fState.done = false;
  fState.editIdx = null;
  fState.extractedColors = {};
  try{ fClearImgCache(); }catch(e){}
  _fArtSnapshots = {};
  _fArtCaptions = {};
  try{ fClearChatDraft(); }catch(e){}   // o rascunho velho não pode sobreviver ao reset
  const msgs = document.getElementById('f-messages');
  if(msgs) msgs.innerHTML = '';
  fUpdateProg();
  try{ fLpRefresh(); }catch(e){}
  clearTimeout(fNextTimeout);
  if(fState.camp && fState.camp.perguntas && fState.camp.perguntas.length){
    fAddBot(`Vamos refazer a arte da <strong>${gEsc(fState.camp.name||'campanha')}</strong>.`,[]);
    fNextTimeout = setTimeout(()=>fNextStep(), 500);
  } else {
    fStartChat();
  }
  if(antes){
    _fUndoRegistra('Refazer arte', ()=>_fRestauraArte(antes));
    if(typeof gToast==='function')
      gToast('Arte reiniciada.', null, null, { acao:{ rotulo:'Desfazer', onClick:fDesfazer } });
  }
}

// Mobile: volta do chat para o catálogo (desfaz o colapso de colunas).
/* "← Campanhas" — o caminho de volta do modo focado de criação.
   ⛔ NÃO reinicia nada: não mexe em `fState.dados`, não apaga o rascunho, não troca o material
   e não fecha a arte. Só devolve a coluna do catálogo à cena (no celular, a tela anterior;
   no desktop, a coluna que o modo focado colapsou). Voltar para a arte é reabrir o material —
   e ela continua exatamente onde estava, porque o estado nunca saiu do lugar.
   Segundo toque fecha de novo: o botão é o interruptor do catálogo, não uma viagem só de ida. */
function fMobileBackToCatalog(){
  try{
    document.body.classList.remove('f-mobile-chat');
    document.body.classList.toggle('f-catalogo-aberto');
  }catch(e){}
}
/* Os três nomes antigos continuam existindo porque HTML e código chamam por eles — mas agora
   são a MESMA porta. Era aqui que morava a inconsistência que o time viu: `fResetFlow` pedia
   confirmação por chips no chat (e só quando havia dados) enquanto o `fRefazer` do card não
   pedia nada. Dois botões, dois comportamentos, o mesmo estrago. */
function fResetFlow(){ return fAskRestartArt(); }
function fRefazer(){ return fAskRestartArt(); }
// fConfirmReset/fCancelReset eram os chips da confirmação inline, que saiu em favor do
// gConfirm (o diálogo da casa). Mantidos como no-op defensivo: há markup antigo em cache de
// navegador chamando por nome, e um onclick que estoura mata o resto do handler.
function fConfirmReset(){ fRestartArt(); }
function fCancelReset(){ const m=document.getElementById('reset-confirm-msg'); if(m) m.remove(); }

function _fApplyMessageGrouping(msgs,message,type){
  const previous=msgs&&msgs.lastElementChild;
  if(!previous||!previous.classList.contains('msg')||!previous.classList.contains(type)) return;
  previous.classList.add('msg-has-continuation');
  message.classList.add('msg-continuation');
}

function fAddBot(html,qrs,canGoBack){
  const msgs=document.getElementById('f-messages');
  if(!msgs) return;
  const w=document.createElement('div');w.className='msg bot active-prompt';
  let q='';
  if(qrs&&qrs.length){
    q=`<div class="qr-wrap">${qrs.map(x=>{
      /* Chip de AÇÃO (objeto `{html, acao}`) em vez de chip de VALOR (string). Nasceu com o
         "Manter" do passo já preenchido: ele não responde a pergunta com um texto novo, ele
         confirma o que já existe. Os 9 pontos que passam string continuam idênticos. */
      if(x && typeof x === 'object' && x.html){
        return `<div class="qr qr-acao" role="button" tabindex="0" onclick="${gEsc(x.acao)}">${x.html}</div>`;
      }
      const isColor = /^#[0-9A-F]{6}$/i.test(x.trim());
      if(isColor) {
        return `<div class="qr qr-color" role="button" tabindex="0" data-qr="${gEsc(x)}" onclick="fQR(this.dataset.qr,this)" style="background:${gEsc(x)} !important; color:${fGetContrastColor(x)} !important; border-color:${gEsc(x)} !important; font-family:'Roboto',sans-serif; display:inline-flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:50%; background:var(--white); border:1px solid rgba(0,0,0,0.25); display:inline-block;"></span>${gEsc(x)}</div>`;
      }
      return `<div class="qr" role="button" tabindex="0" data-qr="${gEsc(x)}" onclick="fQR(this.dataset.qr,this)">${gEsc(x)}</div>`;
    }).join('')}</div>`;
  }
  // F-07: botão Voltar quando habilitado
  let back = '';
  if(canGoBack){
    back = `<div class="qr-back-wrap"><button class="qr-back" onclick="fGoBack()" title="Voltar uma pergunta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>Voltar uma pergunta</button></div>`;
  }
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="16" y1="16" x2="16.01" y2="16"/></svg></div><div class="msg-content"><div class="bbl">${html}</div>${q}${back}</div>`;
  msgs.querySelectorAll('.msg').forEach(m => m.classList.remove('active-prompt'));
  _fApplyMessageGrouping(msgs,w,'bot');
  msgs.appendChild(w);
  _fChatAncora(msgs);
}

function fGetContrastColor(hex) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  // Tokens, nao hex: o retorno so alimenta style inline (a bolinha da cor no chat), onde
  // var() resolve. NAO use esta funcao para ctx.fillStyle -- Canvas 2D ignora var().
  return (yiq >= 128) ? 'var(--text)' : 'var(--white)';
}

async function fBaixarPDF(btn, snapId){
  if(typeof gFeatureCan==='function' && !gFeatureCan('franqueado.export.pdf','execute')){
    if(typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback('franqueado.export.pdf');
    return;
  }
  const snap=(snapId&&_fArtSnapshots[snapId])||{dados:fState.dados,camp:fState.camp,fmt:fState.fmt,histId:fState._lastHistId,material:fState.material};
  const restore=gBtnLoading(btn,'Gerando…');
  const prevMat=fState.material;
  if(snap.material) fState.material=snap.material; // gera com o material DESTA arte
  try{
    await fGenPDF(snap.dados, snap.camp, snap.fmt);
    if(snap.histId){ fMarkHistBaixada(snap.histId); }
    else { fAddHist(snap.dados,snap.camp,snap.fmt,'baixada'); }
    if(typeof gTrackEvent==='function') gTrackEvent('arte_baixada',{camp_id:snap.camp.id,fmt_id:snap.fmt.id,tipo:'pdf'});
    if(typeof fFeedbackAfterDownload==='function') fFeedbackAfterDownload(snap,btn,snapId,'pdf');
    gToast('PDF baixado!');
    if (typeof gTriggerOnboardingStep === 'function') {
      gTriggerOnboardingStep('downloadedPng');
    }
  }catch(e){
    console.error('Falha ao gerar PDF:', e);
    if(typeof gHandleLayoutUnsafeError==='function'&&gHandleLayoutUnsafeError(e))return;
    gToast('Não consegui gerar o PDF. Se a foto veio de um link, reenvie pelo botão de upload e tente de novo.','error');
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
// Mesma foto do perfil (topbar/modal usam a chave __luma_user_photo_<email>).
// Sem foto, cai nas iniciais — é o mesmo contrato do gUpdateUserTopbar.
function _fUserAvatarInner(){
  try{
    const u=(typeof gCurrentUser==='function')?gCurrentUser():null;
    const photo=u&&u.email?localStorage.getItem('__luma_user_photo_'+u.email):'';
    if(photo) return `<img src="${gEsc(photo)}" alt="${gEsc(u.displayName||'Você')}">`;
  }catch(e){}
  return _fUserInitials();
}
function fAddUser(txt){
  const msgs=document.getElementById('f-messages');
  if(!msgs) return;
  const w=document.createElement('div');w.className='msg user active-prompt';
  w.innerHTML=`<div class="msg-content"><div class="bbl">${gEsc(txt)}</div></div><div class="av u">${_fUserAvatarInner()}</div>`;
  msgs.querySelectorAll('.msg').forEach(m => m.classList.remove('active-prompt'));
  _fApplyMessageGrouping(msgs,w,'user');
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
}
function fTyping(cb){
  const msgs=document.getElementById('f-messages');
  const botCircles = document.querySelectorAll('.bot-circle');
  botCircles.forEach(c => c.classList.add('thinking'));
  const w=document.createElement('div');w.className='msg bot active-prompt';w.id='typing-el';
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div class="bbl"><div class="typing-row"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  msgs.querySelectorAll('.msg').forEach(m => m.classList.remove('active-prompt'));
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
  setTimeout(()=>{
    const t=document.getElementById('typing-el');if(t)t.remove();
    botCircles.forEach(c => c.classList.remove('thinking'));
    cb();
  },900);
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
  // Controle do produto: funil único do chat gerador. Bloqueia o AVANÇO; o
  // histórico e as artes já geradas continuam visíveis e baixáveis.
  if(typeof gFeatureCan==='function' && !gFeatureCan('franqueado.chat','create')){
    if(typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback('franqueado.chat');
    return;
  }
  const b=document.getElementById('f-msg-box');
  const v=b.value.trim();
  if(!v)return;
  /* ⚠ `stepIdx < 0` é PERGUNTA DE FLUXO, não de campo — "quer continuar o rascunho?" e o
     pré-início ("usar dados da última arte" / "começar do zero"). Elas se respondem por chip,
     mas a barra de digitar fica HABILITADA ao lado. Quem digitava ali e mandava caía no
     `fSaveAdv`, que lê `perguntas[-1].id` e ESTOURA: a bolha do usuário entrava na conversa,
     o erro morria no console e o chat parava — sem resposta, sem aviso, sem avançar.
     No celular é o caso provável, não o raro: o teclado já está aberto e os chips são o alvo
     menor. A guarda aqui (e não no `fSaveAdv`) evita a bolha órfã — `fAddUser` vem depois. */
  if(fState.stepIdx < 0){ fShowFieldError('Escolha uma das opções acima para começar.'); return; }
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

function fSaveChatDraft() {
  /* ⚠ GUARDA CONTRA CONTAMINAÇÃO (03/09). Quando o Luma Sheets toma emprestado o painel
     de prévia ao vivo, o `fState.dados` passa a APONTAR para a linha ativa da planilha —
     é assim que o mesmo painel serve os dois lugares sem duplicar motor. Só que o
     `live-preview.js` chama esta função em SEIS pontos (todo commit de edição pela
     prévia), e sem este `return` o texto de uma linha da planilha era gravado dentro do
     rascunho do CHAT: reabrir o chat traria a oferta errada. Verificado nos 6 chamadores
     antes de escrever isto.
     A edição não se perde: ela pertence à linha, então vai para o rascunho do SHEETS. */
  if (typeof _fBulkDonoDaPrevia !== 'undefined' && _fBulkDonoDaPrevia) {
    try { if (typeof fBulkScheduleAutosave === 'function') fBulkScheduleAutosave(); } catch (e) {}
    /* E repinta a planilha: editar pela prévia mudava a arte e deixava a CÉLULA com o
       valor velho — a mesma linha dizendo duas coisas. Este é o funil certo porque é
       exatamente por aqui que passam os 6 commits de edição do painel. */
    try { if (typeof fBulkRenderPreview === 'function') fBulkRenderPreview(); } catch (e) {}
    return;
  }
  try {
    if (!fState.camp || fState.done) {
      localStorage.removeItem('luma_chat_draft');
      return;
    }
    const draft = {
      campId: fState.camp.id,
      fmtId: fState.fmt ? fState.fmt.id : null,
      materialId: fState.material ? fState.material.id : null,
      stepIdx: fState.stepIdx,
      dados: fState.dados || {},
      extractedColors: fState.extractedColors || {}
    };
    localStorage.setItem('luma_chat_draft', JSON.stringify(draft));
  } catch (e) {
    console.warn('[Luma Draft] Erro ao salvar rascunho:', e);
  }
}

function fClearChatDraft() {
  try {
    localStorage.removeItem('luma_chat_draft');
  } catch (e) {}
}

function fApplyRecoverDraft(confirm) {
  const qrWrap = document.querySelector('.qr-wrap');
  if (qrWrap && qrWrap.parentElement) qrWrap.parentElement.remove();
  
  const draft = fState._pendingDraft;
  delete fState._pendingDraft;
  
  if (confirm && draft) {
    /* Mescla, não substitui: o `fSelectMaterial` preserva o que a pessoa já respondeu ao trocar
       de formato/material, e um `=` aqui jogava esses valores fora em silêncio. O rascunho vence
       nas chaves que ele conhece (é o que a pessoa mandou recuperar); o resto sobrevive. */
    fState.dados = Object.assign({}, fState.dados || {}, draft.dados || {});
    fState.extractedColors = draft.extractedColors || {};
    fState.stepIdx = draft.stepIdx - 1; // fNextStep incrementa para o passo correto
    fAddBot("Rascunho recuperado! Vamos continuar…", []);
    fLpRefresh();
    clearTimeout(fNextTimeout);
    fNextTimeout = setTimeout(() => fNextStep(), 900);
  } else {
    fClearChatDraft();
    fState.stepIdx = -1;
    fState.dados = {};
    fState.done = false;
    fState.extractedColors = {};
    fUpdateProg();
    fLpRefresh();
    
    const total = fState.camp.perguntas.length;
    let intro = `Vamos preencher sua arte em <strong>${total} passo${total>1?'s':''} rápido${total>1?'s':''}</strong>.`;
    if(fState.material.publishMeta?.instrucoes){
      intro += `<br><br><em style="display:block;margin-top:6px;padding:8px 10px;background:var(--dm-orange-bg);border-left:3px solid var(--dm-orange);font-size:12px;color:var(--text-2);border-radius:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> ${gEsc(fState.material.publishMeta.instrucoes)}</em>`;
    }
    fAddBot(intro, []);
    clearTimeout(fNextTimeout);
    fNextTimeout = setTimeout(() => fNextStep(), 900);
  }
}
