/**
 * js/franqueado/chat-input.js
 *
 * F-02: tipos de campo, mascaras de input, validacao por campo.
 * F_FIELD_TYPES define o comportamento de cada variavel do template.
 * Depende de: 00-config.js
 */

/* ── F-02: tipos, máscaras, validação por campo ── */
// Mapa centralizado: id da pergunta → tipo/regras
const F_FIELD_TYPES = {
  produto:   {type:'text',     maxLen:32,  label:'produto'},
  categoria: {type:'text',     maxLen:32,  label:'categoria'},
  brinde:    {type:'text',     maxLen:40,  label:'brinde'},
  oferta:    {type:'text',     maxLen:40,  label:'oferta'},
  codigo:    {type:'code',     maxLen:16,  label:'código do cupom'},
  precoDe:   {type:'price',    maxLen:14,  label:'preço original'},
  precoPor:  {type:'price',    maxLen:14,  label:'preço promocional'},
  pedidoMin: {type:'price',    maxLen:18,  label:'pedido mínimo'},
  desconto:  {type:'discount', maxLen:24,  label:'desconto'},
  validade:  {type:'text',     maxLen:40,  label:'validade'},
  bairros:   {type:'text',     maxLen:60,  label:'cobertura'},
  condicao:  {type:'text',     maxLen:60,  label:'condição'},
};

function fGetFieldType(id){
  // 3.2: o TIPO da variável (dVars[id].type) dirige o comportamento. F_FIELD_TYPES
  // vira só fallback por nome (legado), eliminando a dependência de nomes mágicos.
  const vDef = (typeof dVars !== 'undefined' && dVars) ? dVars.find(x=>x.name===id) : null;
  const fallback = F_FIELD_TYPES[id] || {type:'text', maxLen:60, label:id};

  // maxLen: permissão do designer > maxLen da var > fallback por nome
  let maxLen = fallback.maxLen;
  const perm = fState.material?.publishMeta?.permissoes?.[id];
  if(perm && perm.maxLen) maxLen = perm.maxLen;
  else if(vDef && vDef.maxLen) maxLen = vDef.maxLen;

  // tipo de comportamento: dVars.type manda; senão cai no mapa por nome
  let type = fallback.type;
  if(vDef && vDef.type){
    if(vDef.type === 'number' || vDef.type === 'currency') type = 'price'; // número/moeda → máscara R$
    else if(vDef.type === 'image')  type = 'image';   // imagem → upload (não passa por máscara de texto)
    else if(vDef.type === 'text')   type = fallback.type; // texto → mantém nuance por nome (code/discount/price)
    else                            type = vDef.type; // tipos ricos (4.1): date/select/color/boolean
  }

  const label = vDef?.label || fallback.label;
  // required: se a var existe no catálogo, honra dVars.required; senão (campo legado) exige por padrão
  const required = vDef ? !!vDef.required : true;
  return {type, maxLen, label, required, vDef, options:vDef?.options, palette:vDef?.palette};
}

// Máscara aplicada no valor antes de salvar — formata sem rejeitar
function fApplyMask(id, raw){
  if(raw==null) return '';
  const cfg = fGetFieldType(id);
  // Tipos não-texto (imagem e tipos ricos da 4.1) não passam por máscara de texto:
  // o valor (ex.: data URL, opção de select) deve ser preservado como veio.
  if(cfg.type === 'image' || cfg.type === 'date' || cfg.type === 'select' || cfg.type === 'color' || cfg.type === 'boolean'){
    return String(raw);
  }
  let v = String(raw).replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim();

  if(cfg.type === 'price'){
    // Aceita "9,90", "9.90", "R$ 9,90", "R$9,90", "qualquer valor" etc.
    const low = v.toLowerCase();
    if(low === 'qualquer valor' || low === 'sem valor' || low === 'grátis' || low === 'gratis'){
      return v.charAt(0).toUpperCase()+v.slice(1);
    }
    // Parsing de moeda BR: '.' = milhar, ',' = decimal. Trata milhar e inteiros.
    let s = v.replace(/[^\d.,]/g,'');
    if(!s) return v.slice(0, cfg.maxLen);
    // O último separador (',' ou '.') seguido de 1-2 dígitos no fim é o decimal
    const sepPos = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    const tail = sepPos>=0 ? s.length-sepPos-1 : -1;
    let intPart, decPart='';
    if(sepPos>=0 && tail>=1 && tail<=2){
      decPart = s.slice(sepPos+1).replace(/\D/g,'');
      intPart = s.slice(0,sepPos).replace(/\D/g,'');
    }else{
      intPart = s.replace(/\D/g,''); // sem decimal → valor inteiro em reais
    }
    intPart = String(parseInt(intPart||'0',10)); // remove zeros à esquerda
    const intFmt = parseInt(intPart,10).toLocaleString('pt-BR'); // agrupa milhar
    decPart = decPart.padEnd(2,'0').slice(0,2);
    return `R$ ${intFmt},${decPart}`;
  }
  if(cfg.type === 'discount'){
    // Aceita "20% off", "20%", "20", "R$ 5,00 off"
    const hasMoney = /r\$/i.test(v) || (/\d+,\d+/.test(v) && !/%/.test(v)); // "1,5%" é percentual, não R$
    if(hasMoney){
      const m = v.replace(/\./g,',').match(/(\d+)[,]?(\d{0,2})/);
      if(m){
        const dec = (m[2]||'00').padEnd(2,'0').slice(0,2);
        return `R$ ${m[1]},${dec} off`;
      }
    }
    const pct = v.match(/(\d{1,3})/);
    if(pct){
      const n = Math.min(parseInt(pct[1],10), 100); // permite 100% (item grátis), não trunca pra 99
      // Se já tem "off" mantém, senão adiciona
      return `${n}% off`;
    }
    return v.slice(0, cfg.maxLen);
  }
  if(cfg.type === 'code'){
    // Código de cupom: maiúscula, sem espaço, alfanumérico
    return v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0, cfg.maxLen);
  }
  // text genérico: só trunca
  return v.slice(0, cfg.maxLen);
}

// Validação pós-máscara — retorna mensagem de erro ou null
function fValidate(id, val){
  const cfg = fGetFieldType(id);
  // 3.3: campo vazio só bloqueia se a variável for obrigatória (honra dVars.required).
  if(!val || !val.trim()) return cfg.required ? `Preencha o campo de ${cfg.label}.` : null;
  if(cfg.type!=='price' && cfg.type!=='discount' && val.length > cfg.maxLen) return `O ${cfg.label} ficou muito longo (máx ${cfg.maxLen} caracteres).`; // preço/desconto: tamanho vem da máscara, não do usuário
  if(cfg.type === 'price'){
    const ok = /r\$\s?\d/i.test(val) || /qualquer|grátis|gratis|sem valor/i.test(val);
    if(!ok) return `Use um valor em R$ (ex: R$ 9,90).`;
  }
  if(cfg.type === 'discount'){
    const ok = /\d+%|r\$/i.test(val);
    if(!ok) return `Use um percentual (ex: 20% off) ou valor em R$.`;
  }
  if(cfg.type === 'code' && val.length < 3) return `O código precisa ter pelo menos 3 caracteres.`;
  // 4.1: select só aceita uma das opções definidas pelo designer
  if(cfg.type === 'select' && cfg.options && cfg.options.length){
    const ok = cfg.options.some(o=>o.toLowerCase()===val.trim().toLowerCase());
    if(!ok) return `Escolha uma das opções: ${cfg.options.join(', ')}.`;
  }
  return null;
}

// Mostra erro inline no chat sem quebrar o fluxo
function fShowFieldError(msg){
  const existing = document.getElementById('field-err-msg');
  if(existing) existing.remove();
  const msgs = document.getElementById('f-messages');
  const w = document.createElement('div');
  w.className = 'msg bot';
  w.innerHTML = `<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div><div class="bbl bbl-err"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${msg}</div></div>`;
  msgs.appendChild(w);
  msgs.scrollTop = msgs.scrollHeight;
  // Auto-remove depois de 4s
  setTimeout(()=>{const e=document.getElementById('field-err-msg');if(e)e.remove();}, 4000);
}

// Limite de caracteres + sanitização no input — atualiza contador visual
function fAttachInputGuard(){
  const box = document.getElementById('f-msg-box');
  if(!box || box._guarded) return;
  box._guarded = true;
  // F-10: sanitização de paste
  box.addEventListener('paste', (e)=>{
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const clean = text.replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim();
    // Insere texto limpo respeitando seleção atual
    const start = box.selectionStart;
    const end = box.selectionEnd;
    const newVal = box.value.slice(0,start) + clean + box.value.slice(end);
    const id = fState.camp?.perguntas?.[fState.stepIdx]?.id;
    const cfg = id ? fGetFieldType(id) : {maxLen:120};
    box.value = newVal.slice(0, cfg.maxLen);
    box.setSelectionRange(start + clean.length, start + clean.length);
    fUpdateCharCount();
  });
  // Limite vivo
  box.addEventListener('input', ()=>{
    const id = fState.camp?.perguntas?.[fState.stepIdx]?.id;
    if(!id) return;
    const cfg = fGetFieldType(id);
    if(box.value.length > cfg.maxLen){
      box.value = box.value.slice(0, cfg.maxLen);
    }
    fUpdateCharCount();
  });
}
function fUpdateCharCount(){
  const box = document.getElementById('f-msg-box');
  const counter = document.getElementById('f-char-count');
  if(!box || !counter) return;
  const id = fState.camp?.perguntas?.[fState.stepIdx]?.id;
  if(!id || fState.done){counter.textContent=''; counter.classList.remove('warn'); return;}
  const cfg = fGetFieldType(id);
  const len = box.value.length;
  if(len === 0){counter.textContent=''; counter.classList.remove('warn'); return;}
  counter.textContent = `${len}/${cfg.maxLen}`;
  
  const isWarn = len >= cfg.maxLen * 0.90;
  if (isWarn) {
    // Remove e re-adiciona com reflow para re-disparar a animação de shake
    counter.classList.remove('warn');
    void counter.offsetWidth;
    counter.classList.add('warn');
  } else {
    counter.classList.remove('warn');
  }
}

function fSaveAdv(val){
  if(fState.done){fTyping(()=>fAddBot('Quer gerar outra arte? Escolha uma campanha ou clique em Reiniciar.',[]));return;}
  const pergs=fState.camp.perguntas;
  let savedField = null;
  if(fState.stepIdx<pergs.length){
    savedField = pergs[fState.stepIdx].id;
    fState.dados[savedField]=val;
  }
  // Atualiza live preview com animação no campo que acabou de ser preenchido
  try { fUpdateLivePreview({animateField: savedField}); } catch(e){}
  // Reseta contador de caracteres
  try { fUpdateCharCount(); } catch(e){}
  if(fState.editIdx!==null){
    fState.editIdx=null;
    const confirmMsg = document.getElementById('confirm-msg');
    if (confirmMsg) confirmMsg.remove();
    fTyping(()=>fMostrarConfirm());
  }
  else{fTyping(()=>fNextStep());}
}

