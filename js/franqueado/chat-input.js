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

// Converte um número básico por extenso para algarismo (PT-BR). Só converte quando o
// valor é UMA palavra-número isolada (ex.: "vinte" → "20"); frases compostas como
// "vinte e cinco" ficam intactas — antes viravam "20 e 5" e o mask extraía 20 (preço
// errado silencioso). Melhor falhar limpo do que inventar. `meio`/`metade` (=50) só
// fazem sentido como PERCENTUAL, então só valem para desconto.
function fCleanTextNumber(v, type) {
  const s = String(v).trim();
  if (!s || /\s/.test(s)) return v; // vazio ou mais de uma palavra → não mexe
  const numbers = {
    'zero': '0', 'um': '1', 'dois': '2', 'tres': '3', 'três': '3',
    'quatro': '4', 'cinco': '5', 'seis': '6', 'sete': '7', 'oito': '8',
    'nove': '9', 'dez': '10', 'quinze': '15', 'vinte': '20', 'trinta': '30',
    'quarenta': '40', 'cinquenta': '50', 'cem': '100'
  };
  if (type === 'discount') { numbers['meio'] = '50'; numbers['metade'] = '50'; }
  const key = s.toLowerCase();
  return Object.prototype.hasOwnProperty.call(numbers, key) ? numbers[key] : v;
}

// Máscara aplicada no valor antes de salvar — formata sem rejeitar
function fApplyMask(id, raw){
  if(raw==null) return '';
  if(String(raw).toLowerCase() === 'pular') return 'Pular';
  const cfg = fGetFieldType(id);
  // Limpa números por extenso para apoiar digitação livre do usuário
  let rawCleaned = raw;
  if(cfg.type === 'price' || cfg.type === 'discount') {
    rawCleaned = fCleanTextNumber(raw, cfg.type);
  }
  // Tipos não-texto (imagem e tipos ricos da 4.1) não passam por máscara de texto:
  // o valor (ex.: data URL, opção de select) deve ser preservado como veio.
  if(cfg.type === 'image' || cfg.type === 'date' || cfg.type === 'select' || cfg.type === 'color' || cfg.type === 'boolean'){
    return String(rawCleaned);
  }
  let v = String(rawCleaned).replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim();

  if(cfg.type === 'price'){
    // Aceita "9,90", "9.90", "R$ 9,90", "R$9,90", "qualquer valor" etc.
    const low = v.toLowerCase();
    if(low === 'qualquer valor' || low === 'sem valor' || low === 'grátis' || low === 'gratis'){
      return v.charAt(0).toUpperCase()+v.slice(1);
    }

    // Helper interno para formatar um valor numérico em R$
    const formatSinglePrice = (valStr) => {
      if (!valStr) return '';
      let s = valStr.replace(/[^\d.,]/g,'');
      if(!s) return '';
      const sepPos = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
      const tail = sepPos>=0 ? s.length-sepPos-1 : -1;
      let intPart, decPart='';
      if(sepPos>=0 && tail>=1 && tail<=2){
        decPart = s.slice(sepPos+1).replace(/\D/g,'');
        intPart = s.slice(0,sepPos).replace(/\D/g,'');
      }else{
        intPart = s.replace(/\D/g,''); // sem decimal
      }
      if(!intPart || intPart === '0'){
        if(decPart) return `R$ 0,${decPart.padEnd(2,'0').slice(0,2)}`;
        return '';
      }
      intPart = String(parseInt(intPart||'0',10));
      const intFmt = parseInt(intPart,10).toLocaleString('pt-BR');
      decPart = decPart.padEnd(2,'0').slice(0,2);
      return `R$ ${intFmt},${decPart}`;
    };

    // Helper interno para formatar o segmento (preço ou texto especial)
    const formatSegmentValue = (valStr) => {
      const trimmed = valStr.trim();
      const formatted = formatSinglePrice(trimmed);
      if (formatted) return formatted;
      const lowVal = trimmed.toLowerCase();
      if(lowVal === 'qualquer valor' || lowVal === 'sem valor' || lowVal === 'grátis' || lowVal === 'gratis'){
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      }
      return trimmed;
    };

    // Detecta se contém prefixos "de" ou "por"
    const hasDe = /(?:^|[^a-zA-Z0-9_])de\b/i.test(v);
    const hasPor = /(?:^|[^a-zA-Z0-9_])por\b/i.test(v);

    if (hasDe || hasPor) {
      const deSegmentMatch = v.match(/(?:^|[^a-zA-Z0-9_])de\s*(?::|\s)\s*(.*?)(?=\s*por\b|$)/i);
      const porSegmentMatch = v.match(/(?:^|[^a-zA-Z0-9_])por\s*(?::|\s)\s*(.*)/i);

      const getPrefix = (matchStr, defaultVal) => {
        const clean = matchStr.trim();
        const hasColon = clean.includes(':');
        const isUpper = clean.includes(defaultVal.toUpperCase());
        return (isUpper ? defaultVal.toUpperCase() : defaultVal) + (hasColon ? ':' : '');
      };

      if (deSegmentMatch && porSegmentMatch) {
        const deVal = formatSegmentValue(deSegmentMatch[1]);
        const porVal = formatSegmentValue(porSegmentMatch[1]);
        if (deVal && porVal) {
          const origDe = getPrefix(deSegmentMatch[0], 'De');
          const origPor = getPrefix(porSegmentMatch[0], 'Por');
          return `${origDe} ${deVal} ${origPor} ${porVal}`;
        }
      }
      if (deSegmentMatch) {
        const deVal = formatSegmentValue(deSegmentMatch[1]);
        if (deVal) {
          const origDe = getPrefix(deSegmentMatch[0], 'De');
          return `${origDe} ${deVal}`;
        }
      }
      if (porSegmentMatch) {
        const porVal = formatSegmentValue(porSegmentMatch[1]);
        if (porVal) {
          const origPor = getPrefix(porSegmentMatch[0], 'Por');
          return `${origPor} ${porVal}`;
        }
      }
    }

    // Caso não tenha nenhum prefixo, formata como preço padrão único
    return formatSinglePrice(v) || v.slice(0, cfg.maxLen);
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
  // text genérico: aplica as máscaras semânticas de capitalização e data humanizada
  if (id === 'validade' || cfg.type === 'date') {
    v = (typeof gSmartHumanizeDate === 'function') ? gSmartHumanizeDate(v) : v;
  } else {
    v = (typeof gSmartTitleCase === 'function') ? gSmartTitleCase(v) : v;
  }
  return v.slice(0, cfg.maxLen);
}

// Validação pós-máscara — retorna mensagem de erro ou null
function fValidate(id, val){
  const cfg = fGetFieldType(id);
  // Se o franqueado escolheu pular o campo opcional, valida com sucesso (retorna null)
  if(val && String(val).toLowerCase() === 'pular') return null;
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
  w.id = 'field-err-msg';
  w.innerHTML = `<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div><div class="bbl bbl-err"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${gEsc(msg)}</div></div>`;
  msgs.appendChild(w);
  msgs.scrollTop = msgs.scrollHeight;

  // Vibra a barra de entrada do chat para alertar o usuário
  const inputRow = document.getElementById('f-input-row');
  if (inputRow) {
    inputRow.classList.remove('g-shake');
    void inputRow.offsetWidth; // Força reflow para reiniciar animação
    inputRow.classList.add('g-shake');
    setTimeout(() => inputRow.classList.remove('g-shake'), 400);
  }

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
    const cursor = Math.min(box.value.length, start + clean.length);
    box.setSelectionRange(cursor, cursor);
    box.dispatchEvent(new Event('input', {bubbles:true}));
  });
  // Limite vivo + prévia ao vivo do texto digitado.
  box.addEventListener('input', ()=>{
    const id = fState.camp?.perguntas?.[fState.stepIdx]?.id;
    if(!id) return;
    const cfg = fGetFieldType(id);
    if(box.value.length > cfg.maxLen){
      box.value = box.value.slice(0, cfg.maxLen);
    }
    fUpdateCharCount();
    // Só espelha na prévia campos de TEXTO (imagem/select/cor/boolean não vêm de digitação).
    // O valor final mascarado é gravado no submit (fSaveAdv); aqui é só espelho cru p/ ver
    // o encaixe ao vivo, sanitizado como o paste (sem \n\t que divergem do PNG). Não mexe
    // no flag de skip — isso é decisão do submit, não de cada tecla.
    if(cfg.type==='image'||cfg.type==='select'||cfg.type==='color'||cfg.type==='boolean') return;
    if(!fState.dados) fState.dados={};
    fState.dados[id]=box.value.replace(/[\r\n\t]/g,' ');
    // Debounce leve: gSmartWrapText mede texto por tecla; sem isso trava em texto longo.
    clearTimeout(box._lpPreviewT);
    box._lpPreviewT=setTimeout(()=>{ try{ fUpdateLivePreview(); }catch(e){} }, 110);
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
    // "Pular" mantém a variável vazia para não renderizar texto na arte. O metadado
    // separado evita que a prévia trate uma escolha explícita como campo esquecido.
    const skipped = String(val).toLowerCase() === 'pular';
    const finalVal = skipped ? '' : val;
    fState.dados[savedField]=finalVal;
    if(skipped) fState.dados['__skipped__'+savedField]=true;
    else delete fState.dados['__skipped__'+savedField];
    if (typeof fSaveChatDraft === 'function') fSaveChatDraft();
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

// Inicializador da Formatação Inteligente do Input do Franqueado (Ideia 2)
function fInitSmartInputFormatter() {
  const b = document.getElementById('f-msg-box');
  if(!b) return;
  
  let fInputFormatTimeout = null;
  
  const formatFn = () => {
    const v = b.value.trim();
    if(!v) return;
    const id = fState.camp?.perguntas?.[fState.stepIdx]?.id;
    if (!id) return;
    
    // Só formata se o tipo de campo for numérico/monetário/desconto ou pedidoMin
    const cfg = fGetFieldType(id);
    const isNumberType = cfg.type === 'price' || cfg.type === 'discount' || id === 'pedidoMin';
    if (!isNumberType) return;
    
    // Ignora se o valor for muito curto ou incompleto para não incomodar a digitação
    if (v.length < 2 && !/^\d+$/.test(v)) return;
    
    const masked = fApplyMask(id, v);
    if (masked === v) return;
    
    // Se o usuário estiver no meio da digitação (termina em vírgula ou ponto), não formata
    if (v.endsWith(',') || v.endsWith('.')) return;
    
    // Transição suave
    b.classList.add('f-msg-box-transition');
    setTimeout(() => {
      const start = b.selectionStart;
      const end = b.selectionEnd;
      b.value = masked;
      try { b.setSelectionRange(start, end); } catch(e){}
      b.classList.remove('f-msg-box-transition');
    }, 130);
  };
  
  b.addEventListener('input', () => {
    clearTimeout(fInputFormatTimeout);
    fInputFormatTimeout = setTimeout(formatFn, 1200); // 1.2s após parar de digitar
  });
  
  b.addEventListener('blur', () => {
    clearTimeout(fInputFormatTimeout);
    const v = b.value.trim();
    if(!v) return;
    const id = fState.camp?.perguntas?.[fState.stepIdx]?.id;
    if (!id) return;
    
    const cfg = fGetFieldType(id);
    const isNumberType = cfg.type === 'price' || cfg.type === 'discount' || id === 'pedidoMin';
    if (!isNumberType) return;
    
    const masked = fApplyMask(id, v);
    if (masked === v) return;
    
    b.classList.add('f-msg-box-transition');
    setTimeout(() => {
      b.value = masked;
      b.classList.remove('f-msg-box-transition');
    }, 130);
  });
}

// Inicializa quando a DOM estiver carregada ou imediatamente se já carregou
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fInitSmartInputFormatter);
} else {
  fInitSmartInputFormatter();
}

