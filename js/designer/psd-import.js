/**
 * js/designer/psd-import.js
 *
 * REVISÃO e IMPORTAÇÃO do .psd — a metade do importador que é tela.
 * Memória de mapeamento por nome de camada, modal de revisão (abas de prancheta, lista
 * de camadas com modo por camada, busca), prévia no motor real, relatório de fidelidade
 * contra o composto do Photoshop, e a criação das pranchetas/templates.
 *
 * O parse e a fidelidade de leitura moram em `psd-parse.js`, carregado ANTES deste.
 * Depende de: designer/templates.js, core/layout.js, core/toast.js, 00-config.js.
 *
 * ⛔ NENHUMA função de parse (`_dPsd*` de leitura, `dPsdParseItems`, `dItemToLayer`) pode ser
 * definida aqui. Este arquivo carrega DEPOIS, então uma cópia local não dá erro: ela SOBRESCREVE
 * a de psd-parse.js em silêncio. Foi exatamente o que aconteceu entre 29/07 e 05/08/2026 — 36
 * funções duplicadas, e o parse refinado (luz global, máscara de grupo, avisos de fidelidade)
 * ficou inteiro sem efeito. Precisa mexer na leitura? Mexa em psd-parse.js.
 * dLoadAgPsd/_agPsdPromise, pelo mesmo motivo, também só vivem lá.
 */

/* ── estado da revisão (só aqui; o parse mora em psd-parse.js) ── */
let dPsdItems=[]; let dPsdMeta=null;
// Nº de camadas de ajuste (Levels/Curves/Hue…) vistas no último parse. O Luma não tem pipeline
// de ajuste, então elas são dropadas e as cores podem diferir do PSD → vira aviso na revisão.
let _dPsdAdjustCount=0;
/* ── Memória de mapeamento (Fase D) ──
   Persiste {layerName → {mode, varName}} em localStorage para reusar entre sessões.
   REGRAS (a v1 salvava o modo de TODAS as camadas e contaminava PSDs diferentes):
   • só guarda DECISÃO real do usuário (modo ≠ padrão do parser);
   • nomes genéricos do Photoshop ("Retângulo 2", "Camada 5"…) nunca entram nem
     são aplicados — o "Retângulo 2" de um PSD não é o de outro;
   • reverter pro padrão APAGA a memória daquele nome.
   Chave v2 = começa limpa (a v1 estava poluída por defaults).                    ── */
const _PSD_MEM_KEY='yngs_psd_mem_v2';
// Nome default/genérico do Photoshop (pt/en) — não identifica a camada entre arquivos.
function _dPsdMemIsGeneric(key){
  return !key || /^(camada|layer|ret[âa]ngulo|rectangle|elipse|ellipse|oval|forma|shape|pol[íi]gono|polygon|linha|line|grupo|group|texto|text|imagem|image|smart\s?object|objeto\s?inteligente|frame|fundo|background)?\s*\d*(\s+c[óo]pia(\s*\d+)?|\s+copy(\s*\d+)?)?$/i.test(key);
}
function _dPsdMemLoad(){ try{ return JSON.parse(localStorage.getItem(_PSD_MEM_KEY)||'{}'); }catch(e){ return {}; } }
function _dPsdMemApply(items){
  const mem=_dPsdMemLoad(); if(!Object.keys(mem).length) return;
  items.forEach(it=>{
    const key=it.name.toLowerCase().trim().slice(0,48);
    if(_dPsdMemIsGeneric(key)) return;
    const s=mem[key]; if(!s) return;
    const validText=['text','var','raster'], validShape=['shape','raster','frame'], validRaster=['raster','frame'];
    if(s.mode==='var' && it.kind==='text'){
      // Converter texto → variável REESCREVE o conteúdo por {{var}}. Entre PSDs diferentes, uma
      // camada "valor" que num arquivo era var e noutro é um disclaimer teria o texto destruído.
      // Só converte se o conteúdo for compatível (vazio/curto ou a heurística sugere a mesma var);
      // senão preserva o texto e apenas pré-preenche o varName.
      const sug=(typeof _dPsdSuggestVar==='function')?_dPsdSuggestVar(it.name,it.content):null;
      if(!it.content || String(it.content).length<=24 || (sug&&sug.name===s.varName)) it.mode='var';
    } else if(s.mode&&(
      (it.kind==='text'&&validText.includes(s.mode))||
      (it.kind==='shape'&&validShape.includes(s.mode))||
      (it.kind==='raster'&&validRaster.includes(s.mode))
    )) it.mode=s.mode;
    if(s.varName&&it.kind==='text') it.varName=s.varName;
  });
}
// Aceita UM array de itens ou vários (multi-prancheta). Importar 14 pranchetas fazia 14
// leituras + 14 gravações do mapa inteiro no localStorage; agora é uma de cada.
function _dPsdMemSave(...listas){
  const mem=_dPsdMemLoad();
  listas.forEach(items=>(items||[]).forEach(it=>{
    const key=it.name.toLowerCase().trim().slice(0,48);
    if(_dPsdMemIsGeneric(key)) return;
    const isDecision=(it._defaultMode!=null && it.mode!==it._defaultMode);
    const hasVar=(it.kind==='text' && it.mode==='var' && it.varName);
    if(isDecision||hasVar){
      mem[key]={mode:it.mode};
      if(hasVar) mem[key].varName=it.varName;
    } else if(mem[key]){
      delete mem[key]; // voltou pro padrão → esquece a decisão antiga
    }
  }));
  const keys=Object.keys(mem); if(keys.length>500) keys.slice(0,keys.length-500).forEach(k=>delete mem[k]);
  try{ localStorage.setItem(_PSD_MEM_KEY,JSON.stringify(mem)); }catch(e){}
}

// Heurística de z-order: retorna true se a lista de itens precisar ser invertida.
// Os itens chegam aqui TOPO-PRIMEIRO (o parse faz out.reverse em :1069 pra exibir a
// revisão como o painel do Photoshop), mas dLayers[0] é o FUNDO visual em Luma → o
// caso NORMAL é inverter de volta pra base-primeiro.
// Empírico (2026-07, round-trip ag-psd writePsd/readPsd): ag-psd devolve base-primeiro
// (children[0] = fundo), então após o out.reverse a lista fica topo-primeiro e precisa
// inverter — inclusive quando não há um "fundo" óbvio. O default era `false` (não
// inverter), o que deixava pilhas sem fundo nomeado/grande com z-order TROCADO (o
// designer reordenava na mão). O toggle manual (#d-psd-invert) cobre o PSD atípico.
function _dPsdShouldInvert(items, w, h){
  if(!items||items.length<2) return false;
  const first=items[0], last=items[items.length-1];
  const bgRe=/^(background|fundo|bg|base|backdrop|plano[\s\-]*de[\s\-]*fundo)$/i;
  const canvasArea=Math.max(1,w*h);
  const firstCov=(first.w*first.h)/canvasArea;
  const lastCov=(last.w*last.h)/canvasArea;
  const bgKinds=new Set(['shape','raster']);
  const firstIsBg=bgRe.test((first.name||'').trim())||(firstCov>=0.7&&bgKinds.has(first.kind));
  const lastIsBg =bgRe.test((last.name||'').trim()) ||(lastCov >=0.7&&bgKinds.has(last.kind));
  if(firstIsBg&&!lastIsBg)  return false; // fundo NO TOPO da lista → PSD atípico já em base-primeiro
  return true; // caso normal (topo-primeiro) → inverter pra base-primeiro. Cobre o sem-sinal.
}

/* ── tela de revisão ── */
// Aplica a prancheta ATIVA (dPsdItems/dPsdMeta) na tela: cabeçalho, formato, inverter e
// lista. Extraído de dPsdOpenReview porque trocar de prancheta precisa exatamente disto —
// e NÃO precisa re-injetar busca/botões nem re-bindar o hover do canvas.
function _dPsdApplyBoardToUI(){
  if(!dPsdMeta) return;
  const _nT=dPsdItems.filter(i=>i.kind==='text').length;
  const _nS=dPsdItems.filter(i=>i.kind==='shape').length;
  const _nI=dPsdItems.filter(i=>i.kind==='raster').length;
  const _adjItems=dPsdItems.filter(i=>i.kind==='adjustment');
  const _nA=_adjItems.length, _nAOk=_adjItems.filter(i=>i.adjustmentSupported!==false).length, _nABad=_nA-_nAOk;
  const _warnIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16h.01"/></svg>';
  // Badge DPI: aviso visual quando o doc não é 72dpi (fontes em pontos serão escaladas)
  const _hiDpi=dPsdMeta.res&&dPsdMeta.res>90;
  const _dpiHtml=_hiDpi
    ?`<span class="psd-dpi-warn" title="Fontes em pontos serão escaladas automaticamente (${Math.round(dPsdMeta.res)}dpi para 72dpi)">${_warnIcon}${Math.round(dPsdMeta.res)} dpi</span>`
    :(dPsdMeta.res&&dPsdMeta.res!==72?`<span class="psd-meta-chip">${Math.round(dPsdMeta.res)} dpi</span>`:'');
  // Ajuste deixou de ser sinônimo de perda: nove tipos são camadas editáveis de verdade. O badge
  // separa o que o motor aplica do que ainda entra como no-op honesto, sem um alerta genérico.
  const _adjHtml=(_nAOk?`<span class="psd-meta-chip" title="Camadas de ajuste preservadas e recalculadas sobre o conteúdo editável">${_nAOk} ajuste${_nAOk===1?' editável':'s editáveis'}</span>`:'')
    +(_nABad?`<span class="psd-dpi-warn" title="${_nABad} camada(s) de ajuste usam tipos que o Luma ainda não reproduz; elas ficam identificadas na lista.">${_warnIcon}${_nABad} ajuste${_nABad===1?'':'s'} não aplicado${_nABad===1?'':'s'}</span>`:'');
  // Camadas que falharam no parse entraram como imagem fiel (ou foram puladas). Avisar é
  // obrigatório: silêncio aqui vira "a camada sumiu do nada" pro designer.
  const _errHtml=(_dPsdErrorCount>0)
    ?`<span class="psd-dpi-warn" title="${_dPsdErrorCount} camada(s) não puderam ser interpretadas; entraram como imagem fiel ou foram puladas.">${_warnIcon}${_dPsdErrorCount} camada(s) com falha</span>`
    :'';
  const _metaEl=document.getElementById('d-psd-meta');
  if(_metaEl) _metaEl.innerHTML=`<strong class="psd-meta-name">${_dPsdEsc(dPsdMeta.name||'PSD')}</strong><span class="psd-meta-chip">${dPsdMeta.w} × ${dPsdMeta.h}px</span><span class="psd-meta-chip">${_nT} texto${_nT===1?'':'s'}</span><span class="psd-meta-chip">${_nS} forma${_nS===1?'':'s'}</span><span class="psd-meta-chip">${_nI} imagem${_nI===1?'':'ens'}</span>${_dpiHtml}${_adjHtml}${_errHtml}`;
  // Detecção de formato com tolerância ±2px (PSDs com 1079×1921 ainda mapeiam para 'story').
  // Sem match exato → 'orig': preserva o tamanho real do PSD (1:1) em vez de forçar um preset.
  // Numa prancheta já visitada, respeita o que o usuário escolheu; só na primeira
  // passagem é que o formato/inversão vêm da detecção automática.
  const _b=_dPsdBoards[_dPsdBoardIdx];
  const fmt=(_b && _b.fmt!=null) ? _b.fmt : _dPsdExactFmt(dPsdMeta.w, dPsdMeta.h);
  const sel=document.getElementById('d-psd-fmt'); if(sel) sel.value=fmt;
  const inv=document.getElementById('d-psd-invert');
  if(inv){
    inv.checked=(_b && _b.invert!=null) ? !!_b.invert : _dPsdShouldInvert(dPsdItems, dPsdMeta.w, dPsdMeta.h);
    inv.onchange=()=>dPsdRenderPreview();
  }
  const _sf0=document.getElementById('d-psd-search'); if(_sf0) _sf0.value='';
  _dPsdLastHoverIdx=-1;
  _dPsdMemApply(dPsdItems);
  dPsdRenderRows();
}
function dPsdOpenReview(){
  const modal=document.getElementById('d-psd-modal'); if(!modal) return;
  // Campo de busca (injetado dinamicamente, acima de #d-psd-rows)
  const rowsEl=document.getElementById('d-psd-rows');
  if(rowsEl&&!document.getElementById('d-psd-search')){
    const si=document.createElement('input'); si.id='d-psd-search'; si.type='search';
    si.placeholder='Buscar por nome, conteúdo, fonte ou tipo de camada'; si.className='psd-search-input';
    si.setAttribute('aria-label','Buscar camadas do PSD');
    si.oninput=()=>dPsdRenderRows(si.value.trim().toLowerCase());
    rowsEl.parentNode.insertBefore(si,rowsEl);
  }
  // Botões Todas / Nenhuma (injetados uma vez; ficam acima da lista)
  if(rowsEl&&!document.getElementById('d-psd-sel-btns')){
    const tb=document.createElement('div'); tb.id='d-psd-sel-btns'; tb.className='psd-sel-btns';
    tb.innerHTML='<button type="button" class="psd-sel-btn" onclick="dPsdSelectAll()">Selecionar todas</button><button type="button" class="psd-sel-btn" onclick="dPsdSelectNone()">Limpar seleção</button><span id="d-psd-sel-info" class="psd-sel-info" aria-live="polite"></span>';
    rowsEl.parentNode.insertBefore(tb,rowsEl);
  }
  // Canvas hover: hover sobre preview canvas → destaca camada + scroll na lista
  // Os mesmos eventos servem o mapeamento: arrastar um campo sobre a arte realça a camada
  // que vai receber (e pinta em vermelho se ela não aceitar), e soltar/clicar ali liga o campo.
  const _pCv=document.getElementById('d-psd-preview-canvas');
  if(_pCv&&!_pCv._psdHoverBound){
    _pCv._psdHoverBound=true;
    _pCv.addEventListener('mousemove',_dPsdCanvasHover);
    _pCv.addEventListener('mouseleave',()=>{ _dPsdLastHoverIdx=-1; dPsdHoverLayer(-1); });
    _pCv.addEventListener('dragover',_dPsdCanvasDragOver);
    _pCv.addEventListener('drop',_dPsdCanvasDrop);
    _pCv.addEventListener('click',_dPsdCanvasClick);
  }
  _dPsdRenderBoards();   // faixa de pranchetas + campo de destino (só no multi-prancheta)
  _dPsdApplyBoardToUI();
  modal.classList.add('open');
}
// Converte blend mode do ag-psd (camelCase) → CSS (kebab-case); 'normal'→'' (sem propriedade)
function _dPsdBlendModeCSS(bm){ return bm?bm.replace(/([A-Z])/g,c=>'-'+c.toLowerCase()):''; }
function dPsdRenderRows(filter){
  const wrap=document.getElementById('d-psd-rows'); if(!wrap) return;
  const ico={
    text:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 6V4h14v2M12 4v16M8 20h8"/></svg>',
    shape:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
    raster:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 17 4-4 3 3 3-3 6 5"/></svg>',
    adjustment:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" stroke="none"/></svg>'
  };
  const kindOrder={text:0,shape:1,raster:2,adjustment:3};
  const kindLabel={text:'Textos',shape:'Formas',raster:'Imagens',adjustment:'Ajustes de cor'};
  // Indexar, filtrar por busca (nome, conteúdo, fontName, tipo em PT-BR) e agrupar por tipo
  const indexed=dPsdItems.map((it,i)=>({it,i})).filter(({it})=>!it.isMaskBase);
  const visible=filter?indexed.filter(({it})=>{
    return it.name.toLowerCase().includes(filter)||
      (it.content&&it.content.toLowerCase().includes(filter))||
      (it.fontName&&it.fontName.toLowerCase().includes(filter))||
      (it.kind==='shape'&&'forma'.includes(filter))||
      (it.kind==='raster'&&'imagem'.includes(filter))||
      (it.kind==='adjustment'&&('ajuste cor '+(it.adjustmentType||'')).includes(filter))||
      (it.kind==='text'&&'texto'.includes(filter));
  }):indexed;
  const grouped=[...visible].sort((a,b)=>(kindOrder[a.it.kind]||0)-(kindOrder[b.it.kind]||0));
  const count={}; visible.forEach(({it})=>{ count[it.kind]=(count[it.kind]||0)+1; });
  let lastKind=null;
  wrap.innerHTML=grouped.map(({it,i})=>{
    let header='';
    if(it.kind!==lastKind){ lastKind=it.kind;
      header=`<div class="psd-group-header">${kindLabel[it.kind]||'Outros'} <span class="psd-group-count">${count[it.kind]||0}</span></div>`; }
    let modeSel='';
    if(it.kind==='text'){
      // "Campo editável" em vez de "Variável {{ }}": nome técnico e chaves não aparecem
      // para o usuário (03_ENGINEERING §5) — o glossário da casa é "campo".
      modeSel=`<select class="psd-mode" aria-label="Como importar a camada ${_dPsdEsc(it.name)}" onchange="dPsdSetMode(${i},this.value)">
        <option value="text" ${it.mode==='text'?'selected':''}>Texto editável</option>
        <option value="var" ${it.mode==='var'?'selected':''}>Campo editável</option>
        <option value="raster" ${it.mode==='raster'?'selected':''}>Imagem fiel</option></select>`;
    } else if(it.kind==='shape'){
      modeSel=`<select class="psd-mode" aria-label="Como importar a camada ${_dPsdEsc(it.name)}" onchange="dPsdSetMode(${i},this.value)">
        <option value="shape" ${it.mode==='shape'?'selected':''}>Cor (editável)</option>
        <option value="frame" ${it.mode==='frame'?'selected':''}>Moldura de foto</option>
        <option value="raster" ${it.mode==='raster'?'selected':''}>Imagem</option></select>`;
    } else if(it.kind==='adjustment'){
      modeSel=`<span class="psd-textinfo">Ajuste vinculado</span>`;
    } else { // raster/imagem: pode virar Imagem fiel OU moldura de foto (o franqueado preenche)
      modeSel=`<select class="psd-mode" aria-label="Como importar a camada ${_dPsdEsc(it.name)}" onchange="dPsdSetMode(${i},this.value)">
        <option value="raster" ${it.mode!=='frame'?'selected':''}>Imagem</option>
        <option value="frame" ${it.mode==='frame'?'selected':''}>Moldura de foto</option></select>`;
    }
    const swatchRadius=it.shapeKind==='circle'||it.shapeKind==='ellipse'?'50%':'3px';
    const swatch=it.kind==='shape'?`<span class="psd-swatch" style="background:${it.fill};border-radius:${swatchRadius}"></span>`:'';
    // O nome do campo agora vive no seletor de campo. O input de texto livre só aparece quando
    // o vínculo NÃO é um campo do catálogo — ou seja, no caminho "Criar campo…" (nome sendo
    // digitado). Mostrar os dois deixava o mesmo dado em duplicado na linha.
    const isVarVisible = (it.mode==='var'||it.mode==='frame') && !_dPsdFieldByName(it.varName);
    const varIn=it.kind==='adjustment'?'':`<input class="psd-var-input ${isVarVisible?'visible':''}" value="${_dPsdEsc(it.varName||'')}" placeholder="nome_do_campo" aria-label="Nome do campo editável da camada ${_dPsdEsc(it.name)}" oninput="dPsdSetVar(${i},this.value,this)">`;
    // O aviso é de PERDA, então só aparece quando há perda de verdade: ou o rich text não
    // resolveu (it.multiStyle), ou resolveu mas a camada virou variável — e `runs` não vai
    // junto com {{campo}} (ver dItemToLayer), então aí o estilo misto some mesmo.
    const _perdeEstilo=(it.kind==='text') && (it.multiStyle || (it.runs && it.mode==='var'));
    const multiStyleBadge=_perdeEstilo
      ?`<span class="psd-multistyle" title="${it.runs?'Como campo editável, o texto assume um estilo único':'O estilo dominante será preservado'}">Estilos mistos</span>`:'';
    const blendBadge=it.blendMode?`<span class="psd-blend" title="Modo de mesclagem: ${_dPsdEsc(it.blendMode)}">Mesclagem · ${_dPsdEsc(_dPsdBlendModeCSS(it.blendMode))}</span>`:'';
    let fontWarn='';
    if(it.kind==='text'&&it.fontName&&!/roboto/i.test(it.fontName)){
      const fn=_dPsdEsc(it.fontName);
      if(it.fontRemapped) fontWarn=`<span class="psd-fontok" title="Fonte '${fn}' vinculada">Fonte vinculada · ${fn}</span>`;
      else fontWarn=`<span class="psd-fontwarn">Fonte ausente · ${fn} <label class="psd-font-upload-btn" title="Enviar '${fn}' agora">Enviar<input type="file" accept=".ttf,.otf,.woff,.woff2" style="display:none" onchange="dPsdUploadFont(${i},this)"></label></span>`;
    }
    const opacityBadge=it.opacity<95?`<span class="psd-opacity-badge">Opacidade ${it.opacity}%</span>`:'';
    const _adjPt={'brightness/contrast':'Brilho/Contraste',levels:'Níveis',curves:'Curvas',exposure:'Exposição',vibrance:'Vibração','hue/saturation':'Matiz/Saturação',invert:'Inverter',posterize:'Posterizar',threshold:'Limiar'};
    const adjustmentBadge=it.kind==='adjustment'
      ?(it.adjustmentSupported===false
        ?`<span class="psd-fontwarn" title="Este tipo permanece identificado na pilha, mas ainda não altera os pixels no Luma">${_dPsdEsc(it.adjustmentType||'Ajuste')} ainda não aplicado</span>`
        :`<span class="psd-fontok" title="Este ajuste acompanha qualquer edição feita nas camadas abaixo">${_dPsdEsc(_adjPt[it.adjustmentType]||it.adjustmentType||'Ajuste')} · editável</span>${it.adjustmentApprox?'<span class="psd-fontwarn" title="O ajuste é dinâmico, mas esta variação usa matemática aproximada do Photoshop">Aproximação identificada</span>':''}`)
      :'';
    const effectsStackBadge=(it.layerEffects&&it.kind==='shape')
      ?`<span class="psd-fontok" title="Sombras, contornos e sobreposições repetidas foram preservados na ordem e podem ser editados individualmente no Estilo de Camada">${it.layerEffects.length} efeitos em pilha · editáveis</span>`:'';
    const vectorPathBadge=it.vectorPath
      ?`<span class="psd-fontok" title="Âncoras e alças Bézier foram preservadas; a forma continua nítida ao redimensionar">Path Bézier · editável</span>`:'';
    const fxWarns=[
      it.fxSatin?'Cetim não aplicado':'',
      it.fxContour?'Contorno de efeito ignorado':'',
      it.fxScale?('Efeitos a '+it.fxScale+'%'):'',
      it.strokeApprox?'Traço aproximado (cor sólida)':'',
      it.gradientUnsupported?('Gradiente '+(it.gradientUnsupported==='angle'?'cônico':'losango')+' → imagem fiel'):'',
      it.gradientOverlayApprox?('Sobreposição '+(it.gradientOverlayApprox==='angle'?'cônica':'losango')+' aproximada'):'',
      it.layerEffectsApprox?'Mesclagem da pilha aproximada':'',
      (it.layerEffects&&it.kind!=='shape')?'Pilha de efeitos → imagem fiel':'',
      it.textOnPath?'Texto em curva → imagem fiel':'',
      it.flipped?'Camada espelhada → imagem fiel':'',
      it.textJustifyAll?'Justificado total → última linha não estica':''
    ].filter(Boolean).map(t=>`<span class="psd-fontwarn" title="O Photoshop aplica isso de um jeito que o Luma não reproduz; o resto da camada entra fiel">${t}</span>`).join('');
    const grpBlendBadge=it.groupBlendApprox?`<span class="psd-fontwarn" title="A mesclagem vinha de um grupo do Photoshop e foi aplicada camada a camada — onde as camadas do grupo se sobrepõem o resultado pode diferir do PSD">Mesclagem de grupo aproximada</span>`:'';
    const errBadge=it.parseError?`<span class="psd-fontwarn" title="Esta camada não pôde ser interpretada e entrou como imagem fiel do que o Photoshop compôs">Camada recuperada</span>`:'';
    const flatBadge=it.flattened?`<span class="psd-fontwarn" title="O PSD não tem camadas editáveis — a arte entrou achatada, como imagem única">Arte achatada</span>`:'';
    const vecWarn=it.vectorMaskFailed?`<span class="psd-fontwarn" title="O recorte vetorial não pôde ser rasterizado">Máscara simplificada</span>`:'';
    const clipWarn=it.maskFallback?`<span class="psd-fontwarn" title="A forma complexa de base não pôde ser rasterizada">Recorte simplificado</span>`:'';
    // Alinhamento em PT-BR: o valor do modelo é técnico ('left'/'justify') e não vai pra tela.
    const _alinhoPt={left:'esquerda',center:'centro',right:'direita',justify:'justificado'};
    const textInfoBadge=it.kind==='text'?`<span class="psd-textinfo">${it.fontSize}px · ${_alinhoPt[it.textAlign]||'esquerda'}</span>`:'';
    const thumb=it.kind==='raster'&&it.imgUrl?`<img class="psd-thumb" src="${it.imgUrl}" alt="" loading="lazy">`:'';
    const textPrev=it.kind==='text'&&it.content
      ?`<span class="psd-text-prev" style="color:${it.color||'#aaa'}">${_dPsdEsc(it.content.replace(/\n/g,' ').slice(0,60))}</span>`:'';
    const groupCrumb=it.group?`<span class="psd-group-crumb" title="Grupo: ${_dPsdEsc(it.group)}">${_dPsdEsc(it.group.slice(0,28))}</span>`:'';
    // Sugestão que o parser (ou a IA) achou mas ninguém aceitou: vira um botão de um clique
    // em vez de ficar escondida num input que o designer nem sabia que era editável.
    // A ORIGEM aparece no rótulo: uma sugestão de IA merece mais desconfiança que um nome de
    // camada que casou exatamente com o catálogo — e o "motivo" que a IA deu vai no title.
    let sugBadge='';
    if(_dPsdPendingSug(it)){
      const _ia=(it.varSource==='ia');
      const _why=_ia
        ? (it.varWhy?('A IA leu a arte e concluiu: '+it.varWhy+'. Clique para transformar em campo editável.')
                    :'Sugestão da IA a partir da imagem da arte — clique para transformar em campo editável')
        : 'O Luma reconheceu este conteúdo pelo nome da camada — clique para transformar em campo editável';
      sugBadge=`<button type="button" class="psd-sug${_ia?' psd-sug-ia':''}" onclick="dPsdAcceptSug(${i})" title="${_dPsdEsc(_why)}">${_ia?'IA sugere':'Sugerido'}: ${_dPsdEsc(_dPsdFieldLabel(it.varName))}</button>`;
    }
    return header+`<div class="psd-row ${it.include?'':'psd-row-off'}" data-psd-idx="${i}" onmouseenter="typeof dPsdHoverLayer==='function'&&dPsdHoverLayer(${i})" onmouseleave="typeof dPsdHoverLayer==='function'&&dPsdHoverLayer(-1)" ondragover="dPsdRowDragOver(event,${i})" ondragleave="dPsdRowDragLeave(event)" ondrop="dPsdRowDrop(event,${i})" onclick="dPsdRowClick(event,${i})">
      <input type="checkbox" aria-label="Importar camada ${_dPsdEsc(it.name)}" ${it.include?'checked':''} onchange="dPsdSetInclude(${i},this.checked)">
      <span class="psd-row-ico psd-row-ico-${it.kind}">${swatch||ico[it.kind]||ico.raster}</span>
      ${thumb}
      <span class="psd-row-name" title="${_dPsdEsc(it.name)}">
        <span class="psd-row-name-top">${_dPsdEsc(it.name)}${errBadge}${flatBadge}${multiStyleBadge}${blendBadge}${grpBlendBadge}${fxWarns}${fontWarn}${opacityBadge}${adjustmentBadge}${effectsStackBadge}${vectorPathBadge}${vecWarn}${clipWarn}${textInfoBadge}${sugBadge}</span>
        ${groupCrumb}${textPrev}
      </span>
      ${_dPsdFieldSelHTML(it,i)}${modeSel}${varIn}</div>`;
  }).join('');
  _dPsdRenderFieldRail(); // contadores da trilha vivem do mesmo estado da lista
  dPsdUpdateCount();
  if(typeof dPsdRenderPreview === 'function') dPsdRenderPreview();
}
function dPsdSetMode(i,v){
  if(dPsdItems[i]){
    dPsdItems[i].mode=v;
    // O modo governa o vínculo (seletor de campo, badge de sugestão, contador da trilha), então
    // a linha inteira é re-renderizada em vez de remendada em três lugares. O foco volta pro
    // mesmo seletor porque re-render troca o DOM e jogaria o teclado pro começo do modal.
    _dPsdAfterMap('');
    const back=document.querySelector('#d-psd-rows [data-psd-idx="'+i+'"] .psd-mode');
    if(back) back.focus();
  }
}
function dPsdSetVar(i,v,el){ if(dPsdItems[i]){ const clean=v.trim().replace(/[^a-zA-Z0-9_]/g,''); dPsdItems[i].varName=clean; if(el&&el.value!==clean) el.value=clean; } } // reescreve o input p/ refletir o valor sanitizado
function dPsdSetInclude(i,on){ if(dPsdItems[i]){ dPsdItems[i].include=on; const f=document.getElementById('d-psd-search'); dPsdRenderRows(f&&f.value.trim().toLowerCase()||''); } }
function dPsdSelectAll(){ dPsdItems.forEach(it=>{ if(!it.isMaskBase) it.include=true; }); const f=document.getElementById('d-psd-search'); dPsdRenderRows(f&&f.value.trim().toLowerCase()||''); }
function dPsdSelectNone(){ dPsdItems.forEach(it=>{ it.include=false; }); const f=document.getElementById('d-psd-search'); dPsdRenderRows(f&&f.value.trim().toLowerCase()||''); }
// Hover interativo sobre o canvas de preview: destaca a camada sob o cursor e rola a lista até ela.
let _dPsdLastHoverIdx=-1;
function _dPsdCanvasHover(e){
  if(_dPsdDragField) return; // durante o arrasto quem pinta o realce é o _dPsdCanvasDragOver
  // Hit-test compartilhado com o drop na arte (_dPsdHitLayer) — antes esta busca era local e
  // ignorava o "Inverter ordem", pegando a camada de baixo em área sobreposta.
  const found=_dPsdHitLayer(e.clientX, e.clientY);
  if(found===_dPsdLastHoverIdx) return;
  _dPsdLastHoverIdx=found;
  dPsdHoverLayer(found);
  if(found>=0){
    const row=document.querySelector('#d-psd-rows [data-psd-idx="'+found+'"]');
    if(row) row.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
}
// Upload de fonte direto da tela de revisão: registra no sistema de fontes e remapeia
// automaticamente todas as camadas do PSD que usam o mesmo fontName.
function dPsdUploadFont(layerIdx, input){
  const file=input.files&&input.files[0]; input.value='';
  if(!file) return;
  if(!/\.(ttf|otf|woff2?|woff)$/i.test(file.name)){ gToast('⚠ Use .ttf, .otf, .woff ou .woff2','error'); return; }
  if(file.size>3*1024*1024){ gToast('⚠ Fonte muito grande (máx 3MB). Prefira .woff2.','error'); return; }
  const r=new FileReader();
  r.onload=e=>{
    const base=file.name.replace(/\.[^.]+$/,'');
    const family=(typeof dFontUniqueFamily==='function')?dFontUniqueFamily(base):base;
    // Peso inferido do nome do arquivo — registrar "Obviously-Black.woff2" como 400
    // fazia o navegador sintetizar o peso errado no render.
    const weight=/black|heavy|900/i.test(base)?900:/extra\s?bold|800/i.test(base)?800:/bold|700/i.test(base)?700:/medium|500/i.test(base)?500:/light|300/i.test(base)?300:400;
    const f={name:base,family,dataUrl:e.target.result,weight};
    if(typeof dCustomFonts!=='undefined') dCustomFonts.push(f);
    if(typeof dFontRegister==='function') dFontRegister(f);
    if(typeof dFontsPersist==='function') dFontsPersist();
    if(typeof dFontsRenderList==='function') dFontsRenderList();
    if(typeof dPopFontSelects==='function') dPopFontSelects();
    const mapped='custom:'+family;
    const fname=(dPsdItems[layerIdx]||{}).fontName||'';
    dPsdItems.forEach(it=>{
      if(it.kind!=='text') return;
      if(it.fontName===fname){ it.font=mapped; it.fontRemapped=true; }
      // Texto rico: remapeia também os trechos (runs) que usam a mesma fonte
      if(Array.isArray(it.runs)) it.runs.forEach(run=>{ if(run._fontName===fname) run.font=mapped; });
    });
    dPsdRenderRows();
    gToast('✓ Fonte "'+base+'" enviada e aplicada às camadas');
  };
  r.readAsDataURL(file);
}
function dPsdUpdateCount(){
  // n e total no MESMO universo (sem mask-bases, que são ocultas da lista) —
  // senão o contador podia mostrar "13/12 selecionadas".
  const n=dPsdItems.filter(it=>it.include&&!it.isMaskBase).length, total=dPsdItems.filter(it=>!it.isMaskBase).length;
  const vars=dPsdItems.filter(it=>it.include&&!it.isMaskBase&&(it.mode==='var'||it.mode==='frame')).length;
  const pendingFonts=dPsdItems.filter(it=>it.include&&it.kind==='text'&&it.fontName&&!/roboto/i.test(it.fontName)&&!it.fontRemapped).length;
  const c=document.getElementById('d-psd-count'); if(c) c.textContent=n+' camada'+(n===1?'':'s');
  const info=document.getElementById('d-psd-sel-info'); if(info) info.textContent=n+' de '+total+' selecionadas';
  const _multi=_dPsdBoards.length>1;
  const _nB=_multi?_dPsdBoards.filter(b=>b.selected).length:0;
  const summary=document.getElementById('d-psd-footer-summary');
  if(summary){
    // No multi-prancheta o contador de camadas é da prancheta ABERTA — dizer só "12 de 14
    // camadas" esconderia que o botão vai importar outras pranchetas junto.
    let txt=_multi?('Esta prancheta: '+n+' de '+total+' camadas'):(n+' de '+total+' camadas');
    txt+=' · '+vars+' campo'+(vars===1?' editável':'s editáveis');
    // Sugestão pendente é trabalho parado: o parser reconheceu o conteúdo e ninguém aceitou.
    const _pendSug=dPsdItems.filter(_dPsdPendingSug).length;
    if(_pendSug) txt+=' · '+_pendSug+(_pendSug===1?' sugestão pendente':' sugestões pendentes');
    if(_multi) txt+=' · '+_nB+' prancheta'+(_nB===1?'':'s')+' no import';
    if(pendingFonts) txt+=' · '+pendingFonts+' fonte'+(pendingFonts===1?' pendente':'s pendentes');
    summary.textContent=txt;
  }
  const actionLabel=document.getElementById('d-psd-action-label');
  if(actionLabel) actionLabel.textContent=_multi?('Importar '+_nB+' prancheta'+(_nB===1?'':'s')):'Importar';
  const cta=document.querySelector('#d-psd-modal .psd-import-cta');
  if(cta){
    // Multi: o que habilita é ter prancheta marcada — a prancheta aberta pode estar
    // toda desmarcada e ainda assim haver outras com camadas pra importar.
    const off=_multi?(_nB===0):(n===0);
    cta.disabled=off; cta.setAttribute('aria-disabled',off?'true':'false');
  }
  const cnt=document.getElementById('d-psd-count');
  if(cnt&&_multi) cnt.textContent='';
}
function dPsdCancel(){
  const nBoards=_dPsdBoards.length;
  _dPsdCloseReviewUI();
  dPsdItems=[]; dPsdMeta=null;
  _dPsdBoards=[]; _dPsdBoardIdx=0; _dPsdDocCanvas=null;
  if(nBoards>1) gToast('Importação de pranchetas cancelada');
}
// Auto-cria no catálogo os campos que as layers usam: tokens {{}} no conteúdo (inclusive
// texto misto, não só camada inteiramente ligada) e a variável de cada moldura de foto.
// Extraído porque o import de N pranchetas precisa rodar isto por prancheta.
function _dPsdSyncVarsFromLayers(layers){
  let mudou=false;
  if(typeof dSyncVarsFromContent==='function'){
    layers.forEach(l=>{
      if(l.type==='text'&&l.content&&gVarRegex().test(l.content)){
        if(dSyncVarsFromContent(l.content, true)) mudou=true;
      }
    });
  }
  layers.forEach(l=>{
    if(l.type==='frame'&&l.imgVar&&typeof dVars!=='undefined'&&dVars){
      const name=l.imgVar;
      if(!dVars.some(v=>v.name.toLowerCase()===name.toLowerCase())){
        dVars.push({name, label:name.replace(/_/g,' '), type:'image', required:false});
        mudou=true;
      }
    }
  });
  if(mudou){
    if(typeof dVarsRender==='function') dVarsRender();
    if(typeof dPersistVars==='function') dPersistVars();
  }
  return mudou;
}
// Fecha o modal e zera os canvases. Comum aos dois caminhos de saída (importar/cancelar).
function _dPsdCloseReviewUI(){
  clearTimeout(_dPsdPreviewTimer); // nada de render órfão depois de fechar
  // Campo "pego"/em arrasto não pode sobreviver ao fechamento: a classe psd-arming ficaria
  // no modal e o próximo PSD abriria com o cursor de copiar e uma linha armada.
  _dPsdDragField=null; _dPsdArmedField=null;
  const _m=document.getElementById('d-psd-modal');
  if(_m) _m.classList.remove('psd-arming','psd-mapping');
  _dPsdShowFidelity(null);
  const m=document.getElementById('d-psd-modal'); if(m) m.classList.remove('open');
  const cv=document.getElementById('d-psd-preview-canvas'); if(cv){ cv.width=0; cv.height=0; cv._renderId=(cv._renderId||0)+1; }
  const ov=document.getElementById('d-psd-preview-overlay'); if(ov){ ov.width=0; ov.height=0; }
}
async function dPsdConfirmImport(){
  // ── multi-prancheta: importa TODAS as marcadas de uma vez, uma por template ──
  if(_dPsdBoards.length>1){
    _dPsdBoardSaveActive();
    const marcadas=_dPsdBoards.filter(b=>b.selected);
    if(!marcadas.length){ gToast('Marque ao menos uma prancheta','error'); return; }
    const fSel=document.getElementById('d-psd-folder');
    const folderId=fSel?fSel.value:null;
    if(!folderId){ gToast('⚠ Crie uma campanha antes de importar','error'); return; }
    // Trava o botão: preparar N pranchetas leva tempo e um segundo clique duplicaria tudo.
    const cta=document.querySelector('#d-psd-modal .psd-import-cta');
    if(cta) cta.disabled=true;
    const lbl=document.getElementById('d-psd-action-label');
    // O feedback vai no botão e no rodapé — o overlay d-psd-busy está oculto nesta fase
    // (o modal de revisão é que está na tela), então escrever nele não mostraria nada.
    const foot=document.getElementById('d-psd-footer-summary');
    const results=await _dPsdCollectBoards((i,t,nome)=>{
      if(lbl) lbl.textContent='Preparando '+i+'/'+t+'…';
      if(foot) foot.textContent='Preparando "'+nome+'" ('+i+' de '+t+')…';
    });
    const vazias=results.filter(r=>r.vazia).map(r=>r.name);
    const bons=results.filter(r=>!r.vazia);
    if(!bons.length){
      if(cta) cta.disabled=false;
      if(lbl) lbl.textContent='Importar '+marcadas.length+' prancheta'+(marcadas.length===1?'':'s');
      gToast('Nenhuma prancheta tem camada selecionada','error'); return;
    }
    _dPsdCloseReviewUI();
    dPsdSaveArtboardTemplates(bons, folderId, _dPsdBaseName);
    // Prancheta marcada mas sem camada nenhuma não pode sumir calada.
    if(vazias.length) gToast('⚠ Sem camadas selecionadas: '+vazias.join(', '));
    _dPsdBoards=[]; _dPsdBoardIdx=0; _dPsdDocCanvas=null;
    dPsdItems=[]; dPsdMeta=null;
    return;
  }
  // ── prancheta única: cria a prancheta no editor (caminho original) ──
  const chosen=dPsdItems.filter(it=>it.include && !it.isMaskBase);
  if(!chosen.length){ gToast('Selecione ao menos uma camada','error'); return; }
  _dPsdMemSave(dPsdItems); // persiste mapeamentos para próximas importações
  // #4a — inverter z-order se a ordem do PSD vier trocada
  const inv=document.getElementById('d-psd-invert');
  const ordered=(inv&&inv.checked)?chosen.slice().reverse():chosen;
  let layers=dPsdItemsToLayers(ordered,false);
  _dPsdSyncVarsFromLayers(layers);
  const fmtChoice=(document.getElementById('d-psd-fmt')||{}).value||'orig';
  const _w=dPsdMeta.w, _h=dPsdMeta.h, _name=dPsdMeta.name, _res=dPsdMeta.res||72;
  _dPsdCloseReviewUI();
  dImportLayersAsArtboard(_w, _h, layers, _name, fmtChoice, _res);
  const nVar=layers.filter(l=>l.isVar).length, nTxt=layers.filter(l=>l.type==='text').length;
  gToast('✓ PSD importado: '+layers.length+' camadas · '+nTxt+' texto · '+nVar+' variável(is)');
  _dPsdBoards=[]; _dPsdDocCanvas=null;
  dPsdItems=[]; dPsdMeta=null;
}

/* ── cria a prancheta (com reflow opcional pro formato — 5.2) ── */
function dImportLayersAsArtboard(w,h,layers,name,fmtChoice,dpi){
  if(typeof dSyncLayersToAB==='function') dSyncLayersToAB();
  let outW=w, outH=h, fmt=Object.keys(DFMT_SIZES).find(k=>DFMT_SIZES[k].w===w&&DFMT_SIZES[k].h===h)||fmtChoice||'orig';
  let clone=JSON.parse(JSON.stringify(layers));
  if(typeof gEnsureAnchors==='function') gEnsureAnchors(clone,w,h);
  if(fmtChoice && fmtChoice!=='orig' && DFMT_SIZES[fmtChoice] && (DFMT_SIZES[fmtChoice].w!==w||DFMT_SIZES[fmtChoice].h!==h)){
    const to=DFMT_SIZES[fmtChoice];
    if(typeof gReflowLayers==='function') clone=gReflowLayers(clone,{w,h},to,{fmtKey:gFmtKey(fmtChoice)});
    outW=to.w; outH=to.h; fmt=fmtChoice;
  }
  const id='ab-'+Date.now();
  const ab={id,name:(name||'PSD').slice(0,30),x:80,y:60,w:outW,h:outH,fmt,dpi:dpi||72,layers:JSON.parse(JSON.stringify(clone))};
  // CANVAS ÚNICO: substitui a prancheta (como dNewArtboardCustom) — push acumulava
  // pranchetas órfãs e dGetActiveAB (que só usa dArtboards[0]) mantinha o TAMANHO antigo.
  dArtboards=[ab]; dActiveABId=id;
  // dCustomFmt: fonte da verdade do tamanho em dGetActiveAB. Sem isso, um dCustomFmt
  // velho (de um "Novo documento" anterior) vencia o formato do PSD importado; e um
  // PSD 'orig' caía nas dimensões da prancheta antiga.
  const _preset=DFMT_SIZES[fmt];
  dCustomFmt=(_preset && _preset.w===outW && _preset.h===outH) ? null : {w:outW,h:outH};
  dLayers=JSON.parse(JSON.stringify(clone)); dFmt=fmt; dSelId=null;
  if(typeof dMultiSel!=='undefined') dMultiSel=[];
  if(typeof dHistoryReset==='function') dHistoryReset();
  if(typeof dRenderWorkspace==='function') dRenderWorkspace();
  dApplyFormat(); dRenderCanvas(); dRenderLayersList();
  if(typeof dRenderABList==='function') dRenderABList();
  if(typeof dStats==='function') dStats();
  if(typeof dMarkUnsaved==='function') dMarkUnsaved();
  setTimeout(()=>{ if(typeof dFitToScreen==='function') dFitToScreen(); },80);
}

/* ── Renderização do Preview no Modal (PARTE A) ── */
// Itens do PSD → layers Luma pra PREVIEW: mesma conversão do import (dItemToLayer —
// máscaras, radii, gradientes, efeitos, blend), exceto que texto marcado como
// variável mostra o TEXTO ORIGINAL do PSD (não o token {{}}), fiel ao arquivo fonte.
function _dPsdItemsToPreviewLayers(items){
  try{return dPsdItemsToLayers(items,true);}catch(e){return [];}
}
// Fallback simplificado (caixas/cores/1ª linha) — só quando o motor fiel não está disponível.
async function _dPsdDrawItemsBasic(canvas, items, w, h){
  const renderId=++canvas._renderId || (canvas._renderId=1);
  canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);
  for(const it of items){
    if(canvas._renderId!==renderId) return; // abortado por render mais recente
    ctx.save();
    ctx.globalAlpha=(it.opacity!=null?it.opacity:100)/100;
    if(it.imgUrl){
      await new Promise(resolve=>{
        const img=new Image();
        img.onload=()=>{ try{ctx.drawImage(img, it.x, it.y, it.w, it.h);}catch(e){} resolve(); };
        img.onerror=resolve;
        img.src=it.imgUrl;
      });
    } else if(it.kind==='shape' && it.fill){
      ctx.fillStyle=it.fill;
      if(it.shapeKind==='path'&&it.vectorPath&&typeof gTraceVectorPath==='function'){
        gTraceVectorPath(ctx,it.vectorPath,it.x,it.y,it.w,it.h); ctx.fill(gVectorPathFillRule(it.vectorPath));
      } else if(it.shapeKind==='circle' || it.shapeKind==='ellipse'){
        ctx.beginPath(); ctx.ellipse(it.x+it.w/2, it.y+it.h/2, it.w/2, it.h/2, 0, 0, Math.PI*2); ctx.fill();
      } else if(it.radius && ctx.roundRect){
        ctx.beginPath(); ctx.roundRect(it.x, it.y, it.w, it.h, it.radius); ctx.fill();
      } else { ctx.fillRect(it.x, it.y, it.w, it.h); }
    } else if(it.kind==='text'){
      ctx.fillStyle=it.color||'#000000';
      ctx.font=`${it.fontSize||20}px sans-serif`;
      ctx.textBaseline='top';
      ctx.textAlign=it.textAlign==='center'?'center':(it.textAlign==='right'?'right':'left');
      const tx=it.textAlign==='center'?it.x+it.w/2:(it.textAlign==='right'?it.x+it.w:it.x);
      _dPsdFillTextLines(ctx, it, tx);
    }
    ctx.restore();
  }
}
// #16 — DEBOUNCE. Cada tecla na busca, cada troca de modo e cada (des)marcar camada chamava
// dPsdRenderRows, que re-renderizava a ARTE INTEIRA no motor fiel (+ agora o diff de fidelidade).
// Numa rajada de digitação isso era uma composição completa por caractere. Agrupa num render só.
let _dPsdPreviewTimer=null;
function dPsdRenderPreview(){
  clearTimeout(_dPsdPreviewTimer);
  _dPsdPreviewTimer=setTimeout(_dPsdRenderPreviewNow, 140);
}
async function _dPsdRenderPreviewNow(){
  const canvas=document.getElementById('d-psd-preview-canvas');
  if(!canvas || !dPsdMeta) return;
  const inv=document.getElementById('d-psd-invert');
  // Mesmo universo do import: sem mask-bases (a máscara já está composta nos itens).
  // Guarda o índice original de cada item — o relatório de fidelidade precisa dele p/ achar a linha.
  let ordered=dPsdItems.map((it,i)=>({it,i})).filter(o=>o.it.include && !o.it.isMaskBase);
  if(inv && inv.checked) ordered=ordered.slice().reverse();
  const items=ordered.map(o=>o.it);
  // Caminho FIEL: converte pra layers Luma e renderiza com o motor da arte final —
  // o preview mostra exatamente o que o import vai produzir.
  let drawn=false;
  if(typeof fRenderPreviewToCanvas==='function'){
    const layers=_dPsdItemsToPreviewLayers(items);
    if(layers.length){
      const ok=await fRenderPreviewToCanvas(canvas, {layers, w:dPsdMeta.w, h:dPsdMeta.h}, {maxPx:1100});
      drawn=(ok!==false);
    }
  }
  if(!drawn) await _dPsdDrawItemsBasic(canvas, items, dPsdMeta.w, dPsdMeta.h);
  if(!dPsdMeta) return; // modal fechou durante o render assíncrono
  _dPsdShowFidelity(_dPsdFidelity(canvas, dPsdMeta.ref, ordered, dPsdMeta.w, dPsdMeta.h));
}

/* ── #17 — RELATÓRIO DE FIDELIDADE ────────────────────────────────────────────────
   Compara a prévia renderizada contra `psd.canvas` — o composto que o PRÓPRIO Photoshop
   gravou no arquivo, ou seja, a verdade do que o designer viu. Cada perda que hoje é
   silenciosa (efeito não representado, fonte substituída, camada desmarcada, gradiente
   aproximado) vira um número na tela e um nome de camada. É a "vitrine honesta" aplicada
   ao importador: onde o modelo não chega, o Luma AVISA em vez de fingir.
   A referência é guardada JÁ recortada e reduzida — o composto em tamanho real de um PSD
   grande custaria centenas de MB de RAM parados durante toda a revisão.                  */
const _DPSD_FID_PX=400;   // lado maior da imagem de análise
const _DPSD_FID_TOL=16;   // 0–255: abaixo disso é ruído de anti-alias/JPEG dos nossos rasters
// Recorta (x,y,w,h) do composto do documento e reduz p/ o tamanho de análise.
function _dPsdRefCanvas(src, x, y, w, h){
  try{
    if(!src || !src.width || !src.height || !(w>8) || !(h>8)) return null;
    const scale=Math.min(1, _DPSD_FID_PX/Math.max(w,h));
    const tw=Math.max(1,Math.round(w*scale)), th=Math.max(1,Math.round(h*scale));
    const c=document.createElement('canvas'); c.width=tw; c.height=th;
    const cx=c.getContext('2d'); cx.imageSmoothingQuality='high';
    // Fosco branco (não é cor de marca — é o fundo neutro que iguala o alpha dos dois lados
    // da comparação; sem ele, área transparente x área branca acusaria divergência falsa).
    cx.fillStyle='#fff'; cx.fillRect(0,0,tw,th);
    cx.drawImage(src, x||0, y||0, w, h, 0, 0, tw, th);
    return c;
  }catch(e){ return null; }
}
// → {pct, worst:[{idx,name,pct}]} ou null. pct = % dos pixels que BATEM com o Photoshop.
// Medimos cobertura (pixels acima da tolerância), não média de erro: a média diria "98% fiel"
// mesmo com um logo inteiro errado, porque o resto da arte dilui — número bonito e inútil.
// `ordered` = [{it,i}…] na MESMA ordem de desenho da prévia (fundo → topo).
function _dPsdFidelity(rendered, ref, ordered, metaW, metaH){
  try{
    if(!ref || !rendered || !rendered.width || !rendered.height) return null;
    const w=ref.width, h=ref.height;
    const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h;
    const tx=tmp.getContext('2d'); tx.imageSmoothingQuality='high';
    tx.fillStyle='#fff'; tx.fillRect(0,0,w,h);
    tx.drawImage(rendered,0,0,w,h);
    const A=tx.getImageData(0,0,w,h).data;
    const B=ref.getContext('2d').getImageData(0,0,w,h).data;
    // Mapa de divergência por pixel (1/0), reaproveitado no ranking por camada.
    const bad=new Uint8Array(w*h); let nBad=0;
    for(let p=0,i=0;p<bad.length;p++,i+=4){
      const d=(Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]))/3;
      if(d>_DPSD_FID_TOL){ bad[p]=1; nBad++; }
    }
    const pct=Math.max(0, Math.min(100, Math.round(100-(nBad/bad.length)*100)));
    // Culpa por camada. Atribuir por SOBREPOSIÇÃO de caixa não serve: o fundo cobre a arte
    // inteira e herdaria a divergência de todo mundo — apareceria sempre no pódio sendo
    // pixel-perfeito. Cada pixel pertence à camada mais ao TOPO cuja caixa o contém (a última
    // a desenhar ali), e a camada totalmente coberta some do ranking: não se vê, não diverge.
    const list=ordered||[];
    const sx=w/Math.max(1,metaW), sy=h/Math.max(1,metaH);
    const owner=new Int32Array(w*h).fill(-1);
    list.forEach((o,k)=>{
      const it=o.it;
      const x0=Math.max(0,Math.floor(it.x*sx)), y0=Math.max(0,Math.floor(it.y*sy));
      const x1=Math.min(w,Math.ceil((it.x+it.w)*sx)), y1=Math.min(h,Math.ceil((it.y+it.h)*sy));
      for(let y=y0;y<y1;y++){ const row=y*w; for(let x=x0;x<x1;x++) owner[row+x]=k; }
    });
    const tot=new Int32Array(list.length), div=new Int32Array(list.length);
    for(let p=0;p<owner.length;p++){ const k=owner[p]; if(k<0) continue; tot[k]++; if(bad[p]) div[k]++; }
    const worst=list.map((o,k)=>(tot[k]<16)?null:{idx:o.i, name:o.it.name, pct:Math.round(div[k]/tot[k]*100)})
      .filter(o=>o&&o.pct>=8).sort((a,b)=>b.pct-a.pct).slice(0,3);
    return {pct, worst};
  }catch(e){ return null; } // canvas contaminado / sem composto: some o número, o import segue
}
// Pinta o resultado: o selo do painel de prévia vira a medição real e as 3 piores camadas
// ganham um aviso na própria linha da lista.
function _dPsdShowFidelity(rep){
  document.querySelectorAll('#d-psd-rows .psd-fid-badge').forEach(el=>el.remove()); // medição anterior
  const badge=document.querySelector('#d-psd-modal .psd-fidelity-badge');
  if(!badge) return;
  if(!rep){ badge.innerHTML='<span></span>Fiel ao arquivo'; badge.removeAttribute('title'); return; }
  // Semáforo por token (nunca hex): verde bate, laranja merece olhada, vermelho pede ação.
  const dot=rep.pct>=95?'var(--green)':(rep.pct>=85?'var(--dm-orange)':'var(--dm-red)');
  badge.innerHTML='<span style="background:'+dot+'"></span>Fidelidade '+rep.pct+'%';
  badge.title='Comparação com o composto do Photoshop: '+rep.pct+'% dos pixels batem.'
    +(rep.worst.length?(' Maior divergência: '+rep.worst.map(o=>o.name+' ('+o.pct+'%)').join(', ')+'.')
                      :' Nenhuma camada com divergência relevante.');
  // Marca as linhas direto no DOM em vez de re-renderizar a lista: dPsdRenderRows dispara
  // dPsdRenderPreview, que dispararia esta função de novo — laço infinito.
  rep.worst.forEach(o=>{
    const top=document.querySelector('#d-psd-rows [data-psd-idx="'+o.idx+'"] .psd-row-name-top');
    if(!top) return;
    const b=document.createElement('span');
    b.className='psd-fontwarn psd-fid-badge';
    b.title='Das camadas selecionadas, esta é uma das que mais se afasta do que o Photoshop mostra ('+o.pct+'% dos pixels da caixa divergem).';
    b.textContent='Divergência '+o.pct+'%';
    top.appendChild(b);
  });
}
// Texto multilinha nos previews: canvas fillText ignora '\n' (glifos colados numa linha).
// Desenha linha a linha com o lineHeight do item (fallback 1.2).
function _dPsdFillTextLines(ctx, it, tx){
  const lines=String(it.content||'').split('\n');
  const lh=(it.fontSize||20)*(it.lineHeight||1.2);
  lines.forEach((ln,li)=>ctx.fillText(ln, tx, it.y+li*lh));
}

/* ── Hover Tracking no Modal (PARTE B) ── */
// Cor via token: o canvas não lê CSS, então o valor é resolvido do tema atual em vez de
// hardcodado (04_DESIGN_SYSTEM). O hex fica só como rede se o token não existir.
function _dPsdToken(name, fb){
  try{ const v=getComputedStyle(document.body).getPropertyValue(name).trim(); return v||fb; }catch(e){ return fb; }
}
// `bad` pinta o realce em vermelho: usado no arrasto de campo sobre uma camada INCOMPATÍVEL,
// pra a recusa aparecer antes de soltar em vez de virar um toast depois.
function dPsdHoverLayer(idx, bad) {
  const overlay = document.getElementById('d-psd-preview-overlay');
  if (!overlay || !dPsdMeta) return;

  // Sincroniza dimensões nativas
  if (overlay.width !== dPsdMeta.w || overlay.height !== dPsdMeta.h) {
    overlay.width = dPsdMeta.w;
    overlay.height = dPsdMeta.h;
  }

  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  if (idx >= 0 && dPsdItems[idx]) {
    const it = dPsdItems[idx];
    if (it.include) {
      const cor = bad ? _dPsdToken('--dm-red','#C81818') : _dPsdToken('--dm-orange','#FF9000');
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = cor;
      ctx.fillRect(it.x, it.y, it.w, it.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = cor;
      const lw = Math.max(2, Math.min(overlay.width, overlay.height) * 0.003);
      ctx.lineWidth = lw;
      ctx.strokeRect(it.x - lw/2, it.y - lw/2, it.w + lw, it.h + lw); // stroke por fora para n sobrepor as bordas diretas
      ctx.restore();
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   MAPEAMENTO POR ARRASTAR — campo do catálogo → camada do PSD
   O motor de sugestão já existia (`_dPsdSuggestVar`/`_dPsdSuggestImgVar` em psd-parse.js,
   que consultam o `dVars` REAL antes do dicionário fixo) e a memória entre importações
   também (`_dPsdMemSave`). O que faltava era o CORPO: o vínculo era um input de texto livre
   onde o designer digitava o nome do campo no escuro — sem ver o catálogo, sem saber se o
   campo existia e sem descobrir quais campos ficaram órfãos antes de importar.
   Aqui entram: a trilha de campos arrastáveis, os dois alvos de soltura (a linha da camada
   e a própria arte), o caminho por clique/teclado (arrastar nunca pode ser o único gesto),
   e as sugestões pendentes que o parser tinha mas ninguém via.
   ⚠ Nada aqui persiste sozinho: toda decisão vira `it.mode`/`it.varName`, que o
   `_dPsdMemSave` já grava no import — o 2º PSD da campanha abre pré-mapeado de graça.
══════════════════════════════════════════════════════════════ */
let _dPsdDragField=null;   // campo em arrasto. Necessário porque o `dragover` NÃO pode ler o
                           // dataTransfer (o navegador só libera no drop) e a compatibilidade
                           // tem que ser checada ANTES de soltar.
let _dPsdArmedField=null;  // campo "pego" por clique — o mesmo gesto para quem não arrasta.

function _dPsdVarsList(){ return (typeof dVars!=='undefined' && Array.isArray(dVars)) ? dVars : []; }
function _dPsdFieldByName(name){
  const n=String(name||'').toLowerCase();
  if(!n) return null;
  return _dPsdVarsList().find(v=>v&&v.name&&v.name.toLowerCase()===n)||null;
}
// Rótulo PT-BR do campo. Nome técnico não aparece na tela (03_ENGINEERING §5) — mas se o
// campo ainda não existe no catálogo (sugestão do parser), o nome é o que temos.
function _dPsdFieldLabel(name){ const v=_dPsdFieldByName(name); return (v&&v.label)||name||''; }

// A guarda que impede a arte de quebrar: sem ela, `dItemToLayer` gera uma moldura sem imagem
// (buraco na arte) ou troca um gráfico por {{campo}}.
// A regra de compatibilidade em si mora em `gFieldFitCheck` (00-config.js) — é a MESMA da
// prancheta, e estava duplicada aqui. Aqui fica só o que é do PSD: traduzir `it.kind` para o
// vocabulário da regra e barrar a base de recorte, que não existe como camada sozinha.
function _dPsdBindCheck(it, v){
  if(!it || !v) return {ok:false, why:'Campo não encontrado no catálogo'};
  if(it.kind==='adjustment') return {ok:false, why:'Ajustes de cor não recebem campos'};
  if(it.isMaskBase) return {ok:false, why:'Esta camada é base de recorte e não entra sozinha'};
  const chk=(typeof gFieldFitCheck==='function')
    ? gFieldFitCheck(v, it.kind==='text'?'text':'imagem')
    : {ok:true};
  if(!chk.ok) return chk;
  return {ok:true, mode:(v.type==='image')?'frame':'var'};
}
// Modo que a camada assume ao receber um campo, pelo tipo dela. Usado quando o campo ainda
// não está no catálogo (sugestão do parser), onde não há `v.type` para consultar.
function _dPsdModeForKind(it){ return (it.kind==='text')?'var':'frame'; }

function dPsdBindField(i, name){
  const it=dPsdItems[i], v=_dPsdFieldByName(name);
  const chk=_dPsdBindCheck(it, v);
  if(!chk.ok){ gToast('⚠ '+chk.why,'error'); return false; }
  it.include=true; // ligar um campo é dizer "quero esta camada" — desmarcada, ela nem importaria
  it.mode=chk.mode; it.varName=v.name;
  it.varSource='user'; it.varWhy=''; // decisão humana: apaga a marca de "IA sugere" da camada
  _dPsdAfterMap('“'+(v.label||v.name)+'” ligado à camada “'+it.name+'”');
  return true;
}
function dPsdUnbindField(i){
  const it=dPsdItems[i]; if(!it) return;
  // Volta ao modo que o PARSER havia decidido, não a um chute fixo — senão uma forma que o
  // parser leu como cor editável voltaria como imagem. Se o padrão já era var/frame (o vínculo
  // veio do próprio parser), cai no modo neutro do tipo.
  const d=it._defaultMode;
  it.mode=(d && d!=='var' && d!=='frame') ? d : (it.kind==='text'?'text':(it.kind==='shape'?'shape':'raster'));
  it.varName=''; it.varSource=''; it.varWhy='';
  // Recusou a sugestão: não pode voltar como "pendente" no próximo re-render.
  _dPsdAfterMap('Campo removido da camada “'+it.name+'”');
}
// Camada com sugestão que o designer ainda NÃO aceitou: o parser achou um campo (`varName`)
// mas não teve certeza suficiente pra ligar sozinho (`auto:false` — ex.: um rodapé que só
// cita "R$"). Antes isso era invisível: o nome ficava no input e o designer tinha que
// adivinhar que bastava trocar o modo.
function _dPsdPendingSug(it){
  return !!(it && !it.isMaskBase && it.varName && it.mode!=='var' && it.mode!=='frame');
}
function dPsdAcceptSug(i){
  const it=dPsdItems[i]; if(!it||!it.varName) return;
  it.include=true; it.mode=_dPsdModeForKind(it);
  _dPsdAfterMap('“'+_dPsdFieldLabel(it.varName)+'” ligado à camada “'+it.name+'”');
}
function dPsdAcceptAllSug(){
  let n=0;
  dPsdItems.forEach(it=>{ if(_dPsdPendingSug(it)){ it.include=true; it.mode=_dPsdModeForKind(it); n++; } });
  if(!n){ gToast('Nenhuma sugestão pendente'); return; }
  _dPsdAfterMap(n+(n===1?' sugestão aplicada':' sugestões aplicadas'));
  gToast('✓ '+n+(n===1?' sugestão aplicada':' sugestões aplicadas'));
}
// Ponto único de "mudou o mapeamento": re-renderiza a lista (que já repinta trilha, contadores
// e prévia) preservando a busca, e anuncia no aria-live. Chamar dPsdRenderRows direto de cada
// handler perdia o filtro digitado e deixava o leitor de tela muda.
function _dPsdAfterMap(msg){
  const f=document.getElementById('d-psd-search');
  dPsdRenderRows((f&&f.value.trim().toLowerCase())||'');
  const live=document.getElementById('d-psd-map-live');
  if(live) live.textContent=msg||'';
}

/* ── trilha de campos ── */
// Varinha (o mesmo símbolo de IA que o resto do Luma usa). SVG e não emoji — 03_ENGINEERING §5.
const _DPSD_AI_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21 12 12M12.2 6.2 11 5"/><circle cx="15" cy="9" r="3"/></svg>';
// Quantas camadas SELECIONADAS estão ligadas em cada campo (chave em minúsculas: o vínculo
// aceita o nome como o parser sugeriu, que pode diferir do catálogo na caixa).
function _dPsdFieldCounts(){
  const c={};
  dPsdItems.forEach(it=>{
    if(it.include && !it.isMaskBase && (it.mode==='var'||it.mode==='frame') && it.varName){
      const k=it.varName.toLowerCase(); c[k]=(c[k]||0)+1;
    }
  });
  return c;
}
function _dPsdRenderFieldRail(){
  const wrap=document.getElementById('d-psd-fields'); if(!wrap) return;
  const vars=_dPsdVarsList();
  const cover=document.getElementById('d-psd-fields-cover');
  const sugBtn=document.getElementById('d-psd-sug-all');
  const pend=dPsdItems.filter(_dPsdPendingSug).length;
  if(sugBtn){
    sugBtn.hidden=!pend;
    sugBtn.textContent=pend?('Aplicar '+pend+(pend===1?' sugestão':' sugestões')):'';
  }
  // Botão de IA: só aparece se existe caminho real pra IA (gAiReady). Botão que aparece e
  // falha é pior que botão que não existe — a regra é do próprio core/ai.js.
  const aiBtn=document.getElementById('d-psd-ai-btn');
  if(aiBtn){
    const temIA=(typeof gAiReady==='function') && gAiReady() && (typeof gAskAI==='function');
    aiBtn.hidden=!temIA || !vars.length; // sem catálogo não há o que sugerir
    aiBtn.disabled=_dPsdAiBusy;
    // O estado "analisando" é pintado AQUI e não no handler: o handler re-renderiza a trilha,
    // o que recria este botão — patch direto lá viraria referência órfã.
    aiBtn.innerHTML=_dPsdAiBusy
      ? '<span class="psd-ai-spin" aria-hidden="true"></span>Analisando a arte…'
      : _DPSD_AI_ICON+'Mapear com IA';
  }
  if(!vars.length){
    wrap.innerHTML='<p class="psd-fields-empty">Nenhum campo no catálogo ainda — use “Criar campo…” na linha da camada.</p>';
    if(cover) cover.textContent='';
    return;
  }
  const c=_dPsdFieldCounts();
  const livres=vars.filter(v=>!c[v.name.toLowerCase()]).length;
  if(cover){
    // O número que ninguém tinha antes de importar: campo do catálogo que nenhuma camada usa.
    cover.textContent=livres
      ? (livres+(livres===1?' campo sem camada':' campos sem camada'))
      : 'Todos os campos com camada';
  }
  wrap.innerHTML=vars.map(v=>{
    const n=c[v.name.toLowerCase()]||0;
    const meta=(typeof gFieldTypeMeta==='function')?gFieldTypeMeta(v.type):{svg:'',label:''};
    const armed=(_dPsdArmedField===v.name);
    // data-field em vez de interpolar o nome no onclick: nome de campo vem do usuário e
    // montar JS com ele é convite a quebra de string.
    return '<button type="button" class="psd-field-chip'+(n?' is-used':' is-free')+'" draggable="true"'
      +' data-field="'+_dPsdEsc(v.name)+'" aria-pressed="'+(armed?'true':'false')+'"'
      +' title="'+_dPsdEsc((v.label||v.name)+' · '+(meta.label||'')+(n?(' · '+n+(n===1?' camada':' camadas')):' · nenhuma camada ainda'))+'"'
      +' ondragstart="dPsdFieldDragStart(event,this)" ondragend="dPsdFieldDragEnd()"'
      +' onclick="dPsdFieldArm(this)">'
      +'<span class="psd-field-ico" aria-hidden="true">'+(meta.svg||'')+'</span>'
      +'<strong>'+_dPsdEsc(v.label||v.name)+'</strong>'
      // Contador só quando há camada: uma bolinha vazia em todo campo livre era só ruído.
      +(n?('<span class="psd-field-count">'+n+'</span>'):'')+'</button>';
  }).join('');
}
// Seletor de campo da linha: o caminho ACESSÍVEL do mesmo mapeamento (teclado e leitor de
// tela). Arrastar é só atalho. Só lista campos compatíveis com o tipo da camada — a guarda
// de tipo aparece como ausência de opção, não como erro depois do gesto.
function _dPsdFieldSelHTML(it, i){
  if(it.kind==='adjustment')return '';
  const vars=_dPsdVarsList();
  const querImg=(it.kind!=='text');
  const opts=vars.filter(v=>querImg?(v.type==='image'):(v.type!=='image'));
  const bound=(it.mode==='var'||it.mode==='frame')?(it.varName||''):'';
  // Campo ligado que não está no catálogo (sugestão do parser, ou nome novo digitado) entra
  // como opção própria — senão o select diria "sem campo" numa camada que ESTÁ mapeada.
  const extra=(bound && !opts.some(v=>v.name.toLowerCase()===bound.toLowerCase()))?bound:'';
  const sel=v=>(bound&&bound.toLowerCase()===v.toLowerCase())?' selected':'';
  return '<select class="psd-field-sel'+(bound?' is-bound':'')+'"'
    +' aria-label="Campo editável da camada '+_dPsdEsc(it.name)+'" onchange="dPsdFieldSelect('+i+',this)">'
    +'<option value=""'+(bound?'':' selected')+'>Sem campo</option>'
    +(extra?('<option value="'+_dPsdEsc(extra)+'"'+sel(extra)+'>'+_dPsdEsc(_dPsdFieldLabel(extra))+'</option>'):'')
    +opts.map(v=>'<option value="'+_dPsdEsc(v.name)+'"'+sel(v.name)+'>'+_dPsdEsc(v.label||v.name)+'</option>').join('')
    +'<option value="__new__">+ Criar campo…</option></select>';
}
function dPsdFieldSelect(i, el){
  const it=dPsdItems[i]; if(!it) return;
  const v=el.value;
  if(!v){ dPsdUnbindField(i); return; }
  if(v==='__new__'){
    // Revela o input de nome livre que já existe na linha (visível quando o modo é var/frame)
    // e deixa o `dPsdSetVar` sanitizar. O campo novo é criado no import por _dPsdSyncVarsFromLayers.
    it.include=true; it.mode=_dPsdModeForKind(it); it.varName='';
    _dPsdAfterMap('Digite o nome do novo campo da camada “'+it.name+'”');
    const inp=document.querySelector('#d-psd-rows [data-psd-idx="'+i+'"] .psd-var-input');
    if(inp) inp.focus(); // depois do re-render: o input de antes já é elemento órfão
    return;
  }
  if(_dPsdFieldByName(v)){ dPsdBindField(i, v); return; }
  // Nome fora do catálogo (a sugestão do parser): aceita e deixa o import criar o campo.
  it.include=true; it.varName=v; it.mode=_dPsdModeForKind(it); it.varSource='user'; it.varWhy='';
  _dPsdAfterMap('“'+v+'” ligado à camada “'+it.name+'”');
}

/* ── arrastar e soltar ── */
function dPsdFieldDragStart(ev, el){
  _dPsdDragField=(el&&el.dataset)?el.dataset.field:'';
  _dPsdDisarm(true); // arrastar cancela o campo "pego": um gesto por vez
  try{ ev.dataTransfer.setData('text/plain', _dPsdDragField); ev.dataTransfer.effectAllowed='copy'; }catch(e){}
  el.classList.add('is-dragging');
  const m=document.getElementById('d-psd-modal'); if(m) m.classList.add('psd-mapping');
}
function dPsdFieldDragEnd(){
  _dPsdDragField=null; _dPsdDragPaint='';
  document.querySelectorAll('#d-psd-fields .is-dragging').forEach(el=>el.classList.remove('is-dragging'));
  document.querySelectorAll('#d-psd-rows .is-drop,#d-psd-rows .is-drop-bad')
    .forEach(el=>el.classList.remove('is-drop','is-drop-bad'));
  const m=document.getElementById('d-psd-modal'); if(m) m.classList.remove('psd-mapping');
  dPsdHoverLayer(-1);
}
// `dragover` dispara continuamente enquanto o cursor se move: sem esta chave o realce da arte
// era repintado dezenas de vezes por segundo num canvas do tamanho do PSD.
let _dPsdDragPaint='';
function _dPsdPaintTarget(i, bad){
  const key=i+'/'+(bad?1:0);
  if(key===_dPsdDragPaint) return;
  _dPsdDragPaint=key;
  dPsdHoverLayer(i, bad);
}
function dPsdRowDragOver(ev, i){
  if(!_dPsdDragField) return; // arrasto que não é de campo (arquivo, texto) passa direto
  const chk=_dPsdBindCheck(dPsdItems[i], _dPsdFieldByName(_dPsdDragField));
  ev.preventDefault();
  try{ ev.dataTransfer.dropEffect=chk.ok?'copy':'none'; }catch(e){}
  const row=ev.currentTarget;
  row.classList.toggle('is-drop', chk.ok);
  row.classList.toggle('is-drop-bad', !chk.ok);
  _dPsdPaintTarget(i, !chk.ok); // a arte mostra QUAL camada vai receber, e se ela aceita
}
function dPsdRowDragLeave(ev){
  ev.currentTarget.classList.remove('is-drop','is-drop-bad');
}
function dPsdRowDrop(ev, i){
  const name=_dPsdDragField||((ev.dataTransfer&&ev.dataTransfer.getData('text/plain'))||'');
  if(!name) return;
  ev.preventDefault(); ev.stopPropagation();
  dPsdFieldDragEnd();
  dPsdBindField(i, name);
}
// Hit-test do cursor → índice da camada. Extraído do hover porque o drop na ARTE precisa da
// mesma resposta ("qual camada está sob o cursor") — duas cópias divergiriam.
// A ordem de busca segue o desenho: a camada de cima é a ÚLTIMA a desenhar. Com "Inverter
// ordem" ligado a prévia desenha a lista de trás pra frente, então quem está no topo é o
// PRIMEIRO item — sem isto o clique em área sobreposta pegava a camada de baixo.
function _dPsdHitLayer(clientX, clientY){
  const canvas=document.getElementById('d-psd-preview-canvas');
  if(!canvas || !dPsdMeta) return -1;
  const rect=canvas.getBoundingClientRect();
  if(!rect.width || !rect.height) return -1;
  const cx=(clientX-rect.left)*(dPsdMeta.w/rect.width);
  const cy=(clientY-rect.top)*(dPsdMeta.h/rect.height);
  const inv=document.getElementById('d-psd-invert');
  const topoPrimeiro=!!(inv && inv.checked);
  const hit=it=>it && it.include && !it.isMaskBase
    && cx>=it.x && cx<=it.x+it.w && cy>=it.y && cy<=it.y+it.h;
  if(topoPrimeiro){
    for(let i=0;i<dPsdItems.length;i++) if(hit(dPsdItems[i])) return i;
  } else {
    for(let i=dPsdItems.length-1;i>=0;i--) if(hit(dPsdItems[i])) return i;
  }
  return -1;
}
function _dPsdCanvasDragOver(ev){
  if(!_dPsdDragField) return;
  ev.preventDefault();
  const i=_dPsdHitLayer(ev.clientX, ev.clientY);
  const chk=(i<0)?{ok:false}:_dPsdBindCheck(dPsdItems[i], _dPsdFieldByName(_dPsdDragField));
  try{ ev.dataTransfer.dropEffect=chk.ok?'copy':'none'; }catch(e){}
  _dPsdPaintTarget(i, !chk.ok);
}
function _dPsdCanvasDrop(ev){
  const name=_dPsdDragField||((ev.dataTransfer&&ev.dataTransfer.getData('text/plain'))||'');
  ev.preventDefault();
  const i=_dPsdHitLayer(ev.clientX, ev.clientY);
  dPsdFieldDragEnd();
  if(!name) return;
  if(i<0){ gToast('Solte sobre uma camada da arte'); return; }
  if(dPsdBindField(i, name)) _dPsdScrollToRow(i); // mostra na lista o que acabou de acontecer
}
function _dPsdScrollToRow(i){
  const row=document.querySelector('#d-psd-rows [data-psd-idx="'+i+'"]');
  if(row) row.scrollIntoView({block:'nearest',behavior:'smooth'});
}

/* ══ MAPEAR COM IA (Gemini, entrada de imagem) ══
   Por que a IMAGEM e não só os nomes: o motor de sugestão por nome (`_dPsdSuggestVar`) só
   acerta quando o designer nomeou a camada. Em PSD de verdade metade se chama "Camada 5" /
   "Retângulo 2" — o nome não diz nada e o `_dPsdMemIsGeneric` inclusive proíbe usá-lo. O que
   sobra pra decidir é o PAPEL VISUAL do elemento na peça, e isso está na arte. Então manda-se
   a arte + a lista de camadas (tipo, conteúdo, caixa) + o catálogo real, e volta índice→campo.
   ⛔ A IA PROPÕE, não decide: o resultado entra como sugestão pendente (o mesmo caminho do
   parser), o designer vê "IA sugere: X" com o motivo e aceita — uma a uma ou no botão de
   aplicar todas. Nada é aplicado calado, e camada que o designer já ligou não é tocada.
   Motor único: passa por `gAskAI` (core/ai.js) → Edge Function `ai`, onde a chave mora. */
let _dPsdAiBusy=false;
// A arte que vai pro modelo. Prefere a PRÉVIA (é o que o designer está olhando e vem em até
// 1100px, legível) e cai no composto do Photoshop (`dPsdMeta.ref`, ≤400px) quando ela não
// renderizou. Sempre repinta sobre branco: JPEG não tem alpha, e um PNG transparente
// direto viraria fundo PRETO — o modelo leria uma peça que não existe.
function _dPsdArtePart(){
  try{
    let src=document.getElementById('d-psd-preview-canvas');
    if(!src || !src.width || !src.height) src=(dPsdMeta&&dPsdMeta.ref)||null;
    if(!src || !src.width || !src.height) return null;
    const esc=Math.min(1, 900/Math.max(src.width, src.height)); // 900px basta pro papel visual
    const cv=document.createElement('canvas');
    cv.width=Math.max(1,Math.round(src.width*esc));
    cv.height=Math.max(1,Math.round(src.height*esc));
    const cx=cv.getContext('2d');
    cx.imageSmoothingQuality='high';
    cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height);
    cx.drawImage(src,0,0,cv.width,cv.height);
    const url=cv.toDataURL('image/jpeg',0.82);
    const v=url.indexOf(',');
    return v<0?null:{mimeType:'image/jpeg', data:url.slice(v+1)};
  }catch(e){ return null; } // canvas contaminado por imagem de outra origem
}
// Prompt montado no CLIENTE de propósito: a Edge Function repassa o prompt em vez de montá-lo
// (ver o cabeçalho de supabase/functions/ai/index.ts) — montar lá viraria prompt duplicado,
// porque o caminho de transição com a chave do front precisa dele aqui.
function _dPsdMapPrompt(itens){
  const cat=_dPsdVarsList()
    .map(v=>'- '+v.name+' ('+((v.type==='image')?'imagem':'texto')+') — '+(v.label||v.name))
    .join('\n');
  const tipoPt={text:'texto',shape:'forma',raster:'imagem'};
  const cam=itens.map(o=>{
    const it=o.it;
    let l=o.i+' · '+(tipoPt[it.kind]||it.kind)+' · "'+String(it.name||'').slice(0,60)+'"';
    if(it.kind==='text'&&it.content) l+=' · texto: "'+String(it.content).replace(/\s+/g,' ').slice(0,90)+'"';
    l+=' · caixa '+Math.round(it.x)+','+Math.round(it.y)+','+Math.round(it.w)+','+Math.round(it.h);
    return l;
  }).join('\n');
  // As regras 2 e 3 são domínio, não estilo: são as mesmas que o parse aprendeu na dor —
  // rodapé que cita "R$" não é preço, e fundo NUNCA é foto do produto (isso já fez a foto
  // do franqueado cobrir a arte inteira; ver _dPsdSuggestImgVar em psd-parse.js).
  return 'Você recebe a IMAGEM de uma peça de marketing de delivery (a arte final montada no Photoshop) e a lista de CAMADAS que a compõem. Diga qual campo editável do catálogo corresponde a cada camada, para o mesmo layout servir a várias promoções.\n'
    +'\nCAMPOS DO CATÁLOGO (use só estes nomes, exatamente como estão escritos):\n'+cat
    +'\n\nCAMADAS da arte ('+(dPsdMeta?dPsdMeta.w:0)+'×'+(dPsdMeta?dPsdMeta.h:0)+'px) — índice · tipo · nome · conteúdo · caixa x,y,largura,altura:\n'+cam
    +'\n\nREGRAS\n'
    +'1. Campo de imagem só em camada do tipo imagem ou forma. Campo de texto só em camada do tipo texto.\n'
    +'2. Relacione APENAS o que muda de uma promoção para outra: nome do produto, preços, validade, desconto, cupom, foto do produto, logo da loja.\n'
    +'3. NÃO relacione texto fixo da marca, assinatura, disclaimer, rótulo curto ("de", "por", "a partir de"), selo nem elemento gráfico decorativo. O fundo da arte NUNCA é foto do produto.\n'
    +'4. Cada camada no máximo uma vez. Se nenhum campo servir, omita a camada — omitir é melhor que errar.\n'
    +'5. Decida pela IMAGEM: o nome da camada costuma ser genérico ("Camada 5"); o que vale é o papel visual do elemento na peça, e a caixa diz onde ele está.\n'
    +'\nResponda APENAS JSON: {"vinculos":[{"camada":1,"campo":"produto","motivo":"título principal da oferta"}]}';
}
// A camada é o FUNDO da arte? `_dPsdSuggestImgVar` (psd-parse.js) já proíbe ligar fundo em
// campo de imagem, e por bug real: a foto do franqueado cobria a arte inteira e, numa forma de
// cor sólida, a cor sumia. A regra vale igual pra IA — e o prompt não serve de guarda: pedir
// "não faça" ao modelo é sugestão, não garantia. Vale só pro mapeamento AUTOMÁTICO; se o
// designer arrastar um campo de foto pro fundo, é decisão dele e passa.
// Dois sinais, como no `_dPsdShouldInvert`: o nome, ou cobrir quase toda a prancheta.
function _dPsdLooksBackground(it){
  if(!it) return false;
  if(/^(background|fundo|bg|base|backdrop|plano[\s\-]*de[\s\-]*fundo)$/i.test(String(it.name||'').trim())) return true;
  if(!dPsdMeta) return false;
  const area=Math.max(1, dPsdMeta.w*dPsdMeta.h);
  return ((it.w*it.h)/area) >= 0.7;
}
async function dPsdMapWithAI(){
  if(_dPsdAiBusy) return;
  if(typeof gAskAI!=='function'){ gToast('⚠ IA não disponível nesta sessão','error'); return; }
  const itens=dPsdItems.map((it,i)=>({it,i})).filter(o=>o.it.include && !o.it.isMaskBase);
  if(!itens.length){ gToast('Selecione ao menos uma camada','error'); return; }
  if(!_dPsdVarsList().length){ gToast('⚠ Crie campos no catálogo antes de mapear com IA','error'); return; }
  const part=_dPsdArtePart();
  if(!part){ gToast('⚠ Não foi possível preparar a imagem da arte','error'); return; }
  _dPsdAiBusy=true; _dPsdRenderFieldRail();
  let resp=null;
  try{
    // cache:false — a mesma arte revisada de novo pode ter outro catálogo/seleção de camadas.
    resp=await gAskAI('mapear-psd', _dPsdMapPrompt(itens), {parts:[part], json:true, cache:false});
  }catch(e){ console.warn('[psd] mapeamento por IA falhou:', e); }
  _dPsdAiBusy=false;
  if(!dPsdMeta){ return; } // modal fechou durante a chamada
  const parsed=resp && (typeof gAiParseJson==='function'?gAiParseJson(resp):null);
  const lista=(parsed && Array.isArray(parsed.vinculos))?parsed.vinculos:[];
  if(!resp || !lista.length){
    _dPsdRenderFieldRail();
    gToast(resp?'A IA não encontrou campo para esta arte':'⚠ A IA não respondeu — tente de novo','error');
    return;
  }
  // ⛔ Nada do que o modelo devolve é confiável por si: índice, nome de campo e tipo passam
  // pela MESMA guarda do arrasto (_dPsdBindCheck). O que não passa é descartado em silêncio.
  const vistos=new Set();
  let n=0, fora=0;
  lista.forEach(o=>{
    const i=Number(o&&o.camada);
    if(!Number.isInteger(i) || i<0 || i>=dPsdItems.length){ fora++; return; }
    if(vistos.has(i)) return;                       // regra 4: uma camada, um campo
    const it=dPsdItems[i];
    if(!it.include || it.isMaskBase){ fora++; return; }
    // Camada que o designer JÁ ligou não é tocada: sobrescrever a decisão dele seria
    // trabalho perdido sem aviso. A IA só preenche o que está vazio.
    if(it.mode==='var' || it.mode==='frame') return;
    const v=_dPsdFieldByName(o&&o.campo);
    if(!_dPsdBindCheck(it, v).ok){ fora++; return; }
    // Fundo virando moldura de foto é o erro que estraga a arte inteira — e o tipo é legal
    // (forma aceita campo de imagem), então a guarda de tipo não pega. Aqui pega.
    if(v.type==='image' && _dPsdLooksBackground(it)){ fora++; return; }
    vistos.add(i);
    it.varName=v.name; it.varSource='ia';
    it.varWhy=String((o&&o.motivo)||'').replace(/\s+/g,' ').slice(0,140);
    n++; // o MODO fica como está: vira sugestão pendente, o designer é quem aplica
  });
  if(!n){
    _dPsdRenderFieldRail();
    gToast('A IA não trouxe vínculo novo — o que ela sugeriu já estava ligado ou não encaixou');
    return;
  }
  _dPsdAfterMap('IA sugeriu '+n+(n===1?' vínculo':' vínculos')+'. Revise e aplique.');
  gToast('✓ IA sugeriu '+n+(n===1?' vínculo':' vínculos')+' — revise e clique em Aplicar'
    +(fora?(' · '+fora+' descartado'+(fora===1?'':'s')):''));
  if(fora) console.warn('[psd] mapeamento por IA: '+fora+' sugestão(ões) descartada(s) por índice/campo/tipo inválido');
}

/* ── pegar e clicar (o mesmo mapeamento sem arrastar) ── */
function dPsdFieldArm(el){
  const name=(el&&el.dataset)?el.dataset.field:'';
  _dPsdArmedField=(_dPsdArmedField===name)?null:name;
  const m=document.getElementById('d-psd-modal');
  if(m) m.classList.toggle('psd-arming', !!_dPsdArmedField);
  _dPsdRenderFieldRail();
  const live=document.getElementById('d-psd-map-live');
  if(live) live.textContent=_dPsdArmedField
    ? ('“'+_dPsdFieldLabel(_dPsdArmedField)+'” pego. Clique numa camada da lista ou da arte para ligar.')
    : 'Campo solto.';
}
function _dPsdDisarm(quieto){
  if(!_dPsdArmedField) return;
  _dPsdArmedField=null;
  const m=document.getElementById('d-psd-modal'); if(m) m.classList.remove('psd-arming');
  if(!quieto) _dPsdRenderFieldRail();
}
function dPsdRowClick(ev, i){
  if(!_dPsdArmedField) return;
  // Os controles da linha (checkbox, selects, botão de sugestão) seguem sendo deles.
  if(ev.target && ev.target.closest && ev.target.closest('input,select,button,label,a')) return;
  if(dPsdBindField(i, _dPsdArmedField)) _dPsdDisarm();
}
function _dPsdCanvasClick(ev){
  if(!_dPsdArmedField) return;
  const i=_dPsdHitLayer(ev.clientX, ev.clientY);
  if(i<0){ gToast('Clique sobre uma camada da arte'); return; }
  if(dPsdBindField(i, _dPsdArmedField)){ _dPsdDisarm(); _dPsdScrollToRow(i); }
}

/* ══════════════════════════════════════════════════════════════
   PSD MULTI-PRANCHETA — seleção + revisão em sequência → templates
   Cada artboard selecionado vira um template (rascunho) na pasta escolhida.
══════════════════════════════════════════════════════════════ */
// Delega ao _dEsc global (library.js) — UM escape só (03_ENGINEERING). Mantém o
// guard de null (_dEsc faz String(null)→"null"; aqui null/undefined vira "").
function _dPsdEsc(s){ return (typeof _dEsc==='function') ? _dEsc(s==null?'':s) : String(s==null?'':s); }

/* ══ PRANCHETAS NA MESMA TELA ══
   Antes: uma tela só pra escolher as pranchetas ("Etapa 1 de 2") e, ao confirmar, a
   revisão por camada REABRIA uma vez por prancheta — 1 + N telas pra um arquivo de N
   pranchetas, sem como voltar e sem ver o conjunto. Agora as pranchetas são abas da
   própria revisão: cada uma guarda suas decisões, o preview troca na hora e um único
   "Importar" cria todos os templates.
   _dPsdBoards vazio = PSD de prancheta única (o caminho comum, que não muda em nada). */
let _dPsdBoards=[];       // [{name,w,h,left,top,fmt,invert,selected,layer,items,ref,parsed}]
let _dPsdBoardIdx=0;
let _dPsdDocCanvas=null;  // composto do documento — recortado por prancheta p/ a fidelidade
let _dPsdDocRes=72;
let _dPsdBaseName='';

// Monta as pranchetas a partir dos nós de artboard do ag-psd. Não parseia camada nenhuma
// aqui: parse é caro e a maioria dos arquivos tem uma prancheta que o designer nem abre.
function _dPsdBuildBoards(artboards){
  return artboards.map((ab,i)=>{
    const r=(ab.artboard&&ab.artboard.rect)||{};
    const w=Math.max(1,Math.round((r.right||0)-(r.left||0)));
    const h=Math.max(1,Math.round((r.bottom||0)-(r.top||0)));
    return { name:(ab.name||('Prancheta '+(i+1))).toString().slice(0,48),
      w, h, left:Math.round(r.left||0), top:Math.round(r.top||0),
      fmt:_dPsdExactFmt(w,h), invert:null, selected:true, layer:ab,
      items:null, ref:undefined };
  });
}
// Recorta a referência de fidelidade de TODAS as pranchetas de uma vez e solta o composto
// do documento. Cada recorte tem ≤400px (~600KB); o composto de um doc grande passa de
// 100MB e ficaria parado na memória durante toda a revisão só para ser recortado depois.
function _dPsdBoardsPrepRefs(){
  if(!_dPsdDocCanvas) return;
  _dPsdBoards.forEach(b=>{ if(b.ref===undefined) b.ref=_dPsdRefCanvas(_dPsdDocCanvas, b.left, b.top, b.w, b.h); });
  _dPsdDocCanvas=null;
}
// Preview de prancheta no seletor de artboards.
// Acionado por CLICK (não hover) para evitar renders espásticos.
// Usa dPsdParseItems lazy (parseado na 1ª seleção, cacheado em item._parsedItems)
// para cobrir shapes, texto e imagens — render em tamanho nativo, igual ao dPsdRenderPreview.
async function dPsdAbSelectPreview(itemIdx){
  const canvas=document.getElementById('d-psd-ab-preview-canvas');
  const overlay=document.getElementById('d-psd-ab-overlay');
  if(!canvas||!overlay||!overlay._psdData) return;
  const {items,res}=overlay._psdData;
  const item=items[itemIdx]; if(!item) return;

  // Highlight row ativa
  document.querySelectorAll('.psd-ab-row').forEach((r,i)=>r.classList.toggle('active',i===itemIdx));
  const lbl=document.getElementById('d-psd-ab-preview-label');
  if(lbl) lbl.textContent=item.name+' · '+item.w+'×'+item.h+'px';

  // Parse lazy: só na primeira seleção desta prancheta
  if(!item._parsedItems){
    item._parsedItems=dPsdParseItems(
      {children:(item.layer&&item.layer.children)||[], width:item.w, height:item.h},
      res||72, item.left, item.top
    );
  }
}

// Parse sob demanda + memória do recorte de fidelidade. Guarda no board, então reabrir
// uma prancheta já visitada preserva TODAS as decisões de camada que o usuário tomou.
function _dPsdBoardLoad(b){
  if(!b.items){
    // width/height da PRANCHETA (não do doc): é deles que sai o teto de raster adaptativo no
    // parse. Sem passar, toda prancheta caía no piso de 1600px e o herói saía mole no export 2×.
    b.items=dPsdParseItems({children:(b.layer&&b.layer.children)||[], width:b.w, height:b.h}, _dPsdDocRes, b.left, b.top);
    b.adjust=_dPsdAdjustCount; b.errors=_dPsdErrorCount; // contadores viram badge na revisão
    // Solta o nó cru do ag-psd: ele carrega UM CANVAS POR CAMADA (o que pesa de verdade num
    // PSD grande) e, depois do parse, tudo que a revisão e o import usam já está em b.items
    // — raster, máscara composta, efeitos. Com 14 pranchetas isto era a diferença entre
    // alguns MB e alguns GB retidos até o modal fechar.
    b.layer=null;
  }
  if(b.ref===undefined) b.ref=_dPsdRefCanvas(_dPsdDocCanvas, b.left, b.top, b.w, b.h);
  return b;
}
// Congela na prancheta ativa o que está na tela agora (formato, inversão). As decisões de
// camada já vivem em b.items — dPsdItems é a MESMA referência, não uma cópia.
function _dPsdBoardSaveActive(){
  const b=_dPsdBoards[_dPsdBoardIdx]; if(!b) return;
  const sel=document.getElementById('d-psd-fmt'); if(sel) b.fmt=sel.value;
  const inv=document.getElementById('d-psd-invert'); if(inv) b.invert=inv.checked;
}
function dPsdBoardSelect(i){
  if(!_dPsdBoards.length || i===_dPsdBoardIdx || !_dPsdBoards[i]) return;
  _dPsdBoardSaveActive();
  _dPsdBoardIdx=i;
  const b=_dPsdBoardLoad(_dPsdBoards[i]);
  dPsdItems=b.items;
  _dPsdAdjustCount=b.adjust||0; _dPsdErrorCount=b.errors||0;
  dPsdMeta={w:b.w, h:b.h, name:b.name, res:_dPsdDocRes, ref:b.ref};
  _dPsdRenderBoards();
  _dPsdApplyBoardToUI();
}
/* Teclado na faixa de pranchetas (padrão ARIA de tablist):
   ← → andam entre abas, Home/End vão às pontas, Enter/Espaço abrem a aba focada. O foco
   acompanha a troca porque o repaint recria os elementos — sem o focus() explícito o Tab
   voltaria pro começo do modal a cada seta. */
function _dPsdBoardsKey(ev,i){
  const k=ev.key, ult=_dPsdBoards.length-1;
  let alvo=null;
  if(k==='ArrowRight') alvo=Math.min(ult,i+1);
  else if(k==='ArrowLeft') alvo=Math.max(0,i-1);
  else if(k==='Home') alvo=0;
  else if(k==='End') alvo=ult;
  else if(k==='Enter'||k===' '){ ev.preventDefault(); dPsdBoardSelect(i); return; }
  else return;
  ev.preventDefault();
  if(alvo===i) return;
  dPsdBoardSelect(alvo);
  const el=document.querySelector('#d-psd-boards .psd-board-tab[data-board="'+alvo+'"]');
  if(el) el.focus();
}
// Desmarcar não impede de inspecionar: a aba continua clicável, só não entra no import.
function dPsdBoardToggle(i,on){
  const b=_dPsdBoards[i]; if(!b) return;
  b.selected=!!on;
  _dPsdRenderBoards(); dPsdUpdateCount();
}
function _dPsdRenderBoards(){
  const wrap=document.getElementById('d-psd-boards');
  const fField=document.getElementById('d-psd-folder-field');
  if(!wrap) return;
  const multi=_dPsdBoards.length>1;
  wrap.hidden=!multi;
  if(fField) fField.hidden=!multi;
  if(!multi){ wrap.innerHTML=''; return; }
  const nSel=_dPsdBoards.filter(b=>b.selected).length;
  // Check no padrão da casa: input real (acessível, focável) escondido + span irmão pintado
  // por CSS — o mesmo esquema do toggle "Inverter ordem". O checkbox nativo era o elemento
  // mais pesado da aba e competia com o nome da prancheta.
  const _tick='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4 10-10"/></svg>';
  wrap.innerHTML='<span class="psd-boards-label"><strong>'+_dPsdBoards.length+'</strong>'
      +'<small>prancheta'+(_dPsdBoards.length===1?'':'s')+'<br>'+nSel+' no import</small></span>'
    +'<div class="psd-boards-track">'
    +_dPsdBoards.map((b,i)=>{
      const on=i===_dPsdBoardIdx;
      // aria-controls aponta pro painel que a aba governa (a lista de camadas), e o keydown
      // vai pro _dPsdBoardsKey: setas andam entre abas, como manda o padrão de tablist.
      return '<div class="psd-board-tab'+(on?' is-active':'')+(b.selected?'':' is-off')+'" role="tab"'
        +' aria-selected="'+(on?'true':'false')+'" tabindex="'+(on?'0':'-1')+'"'
        +' aria-controls="d-psd-rows" data-board="'+i+'"'
        +' title="'+_dPsdEsc(b.name)+' · '+b.w+' × '+b.h+'px"'
        +' onclick="dPsdBoardSelect('+i+')" onkeydown="_dPsdBoardsKey(event,'+i+')">'
        +'<label class="psd-board-check" onclick="event.stopPropagation()">'
        +'<input type="checkbox" '+(b.selected?'checked':'')+' onchange="dPsdBoardToggle('+i+',this.checked)"'
        +' aria-label="Incluir a prancheta '+_dPsdEsc(b.name)+' no import">'
        +'<span class="psd-board-box" aria-hidden="true">'+_tick+'</span></label>'
        +'<span class="psd-board-tab-copy"><strong>'+_dPsdEsc(b.name)+'</strong>'
        +'<small>'+b.w+' × '+b.h+'</small></span></div>';
    }).join('')
    +'</div>';
  // Popular o destino uma vez (as pastas não mudam com o modal aberto).
  const fSel=document.getElementById('d-psd-folder');
  if(fSel && !fSel.options.length){
    const folders=(typeof dFolders!=='undefined'&&dFolders)?dFolders:[];
    const tgt=(typeof dImportTargetFolderId!=='undefined')?dImportTargetFolderId:null;
    fSel.innerHTML=folders.length
      ? folders.map(f=>'<option value="'+_dPsdEsc(f.id)+'"'+(f.id===tgt?' selected':'')+'>'+_dPsdEsc(f.name)+'</option>').join('')
      : '<option value="">Crie uma campanha primeiro</option>';
  }
}

// Substitui o antigo dPsdProcessArtboardsSequence: em vez de reabrir a revisao uma vez
// por prancheta, o import percorre as pranchetas MARCADAS, gera as layers de cada uma e
// entrega tudo de uma vez pro dPsdSaveArtboardTemplates.
// Assíncrona por causa do pior caso: importar 14 pranchetas onde o designer abriu só uma
// dispara 13 parses seguidos (getImageData, composição de máscara e toDataURL por camada)
// num bloco só — a aba congelava sem dizer nada. Agora cede o controle entre pranchetas e
// informa qual está sendo preparada.
// O parse de UMA prancheta segue síncrono: é o trabalho que o usuário pediu ao clicar, e
// fatiar o walk por dentro exigiria refazer o laço recursivo que é o coração do importador.
async function _dPsdCollectBoards(onProgress){
  const out=[]; const memAll=[];
  const marcadas=_dPsdBoards.filter(b=>b.selected);
  for(let k=0;k<marcadas.length;k++){
    const b=marcadas[k];
    if(onProgress) onProgress(k+1, marcadas.length, b.name);
    const jaTinha=!!b.items;
    // Prancheta nunca aberta ainda nao foi parseada: parseia agora (sem UI, so dados).
    _dPsdBoardLoad(b);
    // Só cede o controle quando houve trabalho pesado (parse novo) — pausar por prancheta
    // já pronta só somaria latência.
    if(!jaTinha) await _dPsdYield();
    const chosen=(b.items||[]).filter(it=>it.include && !it.isMaskBase);
    if(!chosen.length){ out.push({name:b.name, vazia:true}); continue; }
    memAll.push(b.items); // uma gravação só, no fim
    // invert null = usuario nunca abriu esta prancheta: cai na heuristica de z-order.
    const inv=(b.invert!=null)?b.invert:_dPsdShouldInvert(b.items,b.w,b.h);
    const ordered=inv?chosen.slice().reverse():chosen;
    let layers=dPsdItemsToLayers(ordered,false);
    _dPsdSyncVarsFromLayers(layers);
    out.push({name:b.name, fmt:(b.fmt||'orig'), layers, nativeW:b.w, nativeH:b.h});
  }
  if(memAll.length) _dPsdMemSave.apply(null, memAll);
  return out;
}

// Reflow das layers (coords nativas da prancheta) pro espaço DFMT_SIZES[fmt] — o gerador
// do franqueado assume que o template vive no tamanho do seu material.fmt.
function _dPsdReflowToFmt(layers, w, h, fmt){
  let clone=JSON.parse(JSON.stringify(layers));
  if(typeof gEnsureAnchors==='function') gEnsureAnchors(clone, w, h);
  const to=DFMT_SIZES[fmt];
  if(to && (to.w!==w || to.h!==h) && typeof gReflowLayers==='function'){
    clone=gReflowLayers(clone, {w,h}, to, {fmtKey:(typeof gFmtKey==='function'?gFmtKey(fmt):fmt)});
  }
  return clone;
}

// Cria um template (rascunho) por prancheta revisada, na pasta escolhida, e persiste.
function dPsdSaveArtboardTemplates(results, folderId, baseName){
  if(!results.length){ gToast('Nenhuma prancheta importada'); return; }
  const folder=(typeof dFolders!=='undefined'&&dFolders)
    ? (dFolders.find(f=>f.id===folderId)||dFolders[0]) : null;
  if(!folder){ gToast('⚠ Pasta não encontrada — selecione outra campanha','error'); return; }
  // Pranchetas com o MESMO nome viram templates indistinguíveis — o designer edita um
  // variante achando que é o outro. Sufixa o formato só quando o nome colide.
  const _nameCount={};
  results.forEach(r=>{ const k=(r.name||'').toLowerCase().trim(); _nameCount[k]=(_nameCount[k]||0)+1; });
  const _fmtSuffix={story:'Story',feed:'Feed',wide:'Wide',horizontal:'Horizontal',orig:'Original'};
  results.forEach((r,i)=>{
    // 'orig' (sem match exato) preserva o tamanho REAL do PSD — 1:1. Era forçado a 'story'.
    const fmt=DFMT_SIZES[r.fmt]?r.fmt:'orig';
    // _dPsdReflowToFmt só reflua quando DFMT_SIZES[fmt] existe; p/ 'orig' mantém coords nativas.
    const layers=_dPsdReflowToFmt(r.layers, r.nativeW, r.nativeH, fmt);
    // Tamanho do espaço de coordenadas das layers = onde elas vivem (preset reflua, ou nativo p/ orig).
    const sz=DFMT_SIZES[fmt]||{w:r.nativeW, h:r.nativeH};
    let _tname=(r.name||baseName||'Prancheta').toString();
    if(_nameCount[(_tname||'').toLowerCase().trim()]>1) _tname+=' — '+(_fmtSuffix[fmt]||fmt);
    const tmpl={
      id:'tmpl-psd-'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2,7),
      name:_tname.slice(0,30),
      fmt:fmt,
      w:sz.w, h:sz.h, // tamanho real do template — o gerador do franqueado renderiza 1:1 quando presente
      layers:JSON.parse(JSON.stringify(layers)),
      publishMeta:(typeof dDefaultPublishMeta==='function')?dDefaultPublishMeta():{publicado:false,permissoes:{}}
    };
    folder.templates.push(tmpl);
  });
  if(typeof dFolderOpen!=='undefined') dFolderOpen[folder.id]=true;
  const ok=(typeof dPersistFolders==='function')?dPersistFolders():true;
  if(typeof dRenderFolders==='function') dRenderFolders();
  if(ok===false) return; // quota cheia: erro já exibido por dPersistFolders
  // Abre o último template importado no editor.
  const last=folder.templates[folder.templates.length-1];
  if(last && typeof dLoadTemplate==='function') dLoadTemplate(last, folder);
  gToast('✓ '+results.length+' template(s) importado(s) → '+folder.name);
}

/* ── estado de leitura e análise do arquivo ── */
function _dPsdBusy(on,file){
  let el=document.getElementById('d-psd-busy');
  if(on){
    if(!el){ el=document.createElement('div'); el.id='d-psd-busy';
      el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
      // Botão Cancelar: um arquivo de 400MB leva minutos e antes não havia como desistir —
      // quem abriu o PSD errado ficava preso olhando a barra até o fim.
      el.innerHTML='<div class="d-psd-busy-box"><div class="d-psd-busy-head"><span class="psd-product-mark" aria-hidden="true">Ps</span><div class="d-psd-busy-copy"><strong>Preparando seu arquivo</strong><span id="d-psd-busy-file">PSD</span></div></div><div class="d-psd-busy-progress" aria-hidden="true"><span></span></div><div class="d-psd-busy-stage"><strong id="d-psd-busy-stage">Verificando o arquivo…</strong><span id="d-psd-busy-hint">Isso pode levar alguns segundos</span></div><button type="button" class="d-psd-busy-cancel" id="d-psd-busy-cancel" onclick="dPsdCancelLoad()">Cancelar</button></div>';
      document.body.appendChild(el); }
    const cBtn=document.getElementById('d-psd-busy-cancel');
    if(cBtn){ cBtn.disabled=false; cBtn.textContent='Cancelar'; }
    const fileEl=document.getElementById('d-psd-busy-file');
    if(fileEl&&file){
      const mb=file.size/(1024*1024);
      fileEl.textContent=file.name+' · '+(mb>=1?mb.toFixed(1)+' MB':Math.max(1,Math.round(file.size/1024))+' KB');
      // Expectativa honesta: um PSD de 150MB não leva "alguns segundos".
      const hint=document.getElementById('d-psd-busy-hint');
      // Três faixas, porque com o limite em 500MB "alguns minutos" cobria coisas muito
      // diferentes: 45MB abre rápido, 400MB pode passar de cinco minutos.
      if(hint) hint.textContent = mb>=200 ? 'Arquivo muito grande — pode levar vários minutos; deixe esta aba aberta'
                                : mb>=40  ? 'Arquivo grande — pode levar alguns minutos'
                                          : 'Isso pode levar alguns segundos';
    }
    _dPsdBusyUpdate('Verificando o arquivo…');
    el.style.display='flex';
  } else if(el){ el.style.display='none'; }
}
function _dPsdBusyUpdate(message){
  const stage=document.getElementById('d-psd-busy-stage'); if(stage) stage.textContent=message;
}

/* ── handler do input ── */
async function dImportPSD(input){
  const file=input.files && input.files[0];
  input.value='';
  if(!file) return;
  // .psb (Large Document) é o MESMO formato pro ag-psd — recusá-lo só barrava, sem motivo
  // técnico, os arquivos grandes de campanha (que são justamente os que o designer traz).
  if(!/\.ps[db]$/i.test(file.name)){ gToast('Selecione um arquivo .psd ou .psb','error'); return; }
  if(file.size > _DPSD_MAX_MB*1024*1024){
    gToast('⚠ PSD muito grande ('+Math.round(file.size/(1024*1024))+'MB) — o limite é '+_DPSD_MAX_MB+'MB. Achate camadas ou salve sem histórico.','error');
    return;
  }
  _dPsdCancelled=false; // cada abertura começa com o cancelamento limpo
  _dPsdBusy(true,file);
  let agPsd;
  try{ agPsd=await dLoadAgPsd(); }catch(e){ _dPsdBusy(false); console.error('PSD lib:',e); gToast('⚠ Não foi possível carregar o leitor de PSD — recarregue a página','error'); return; }
  if(_dPsdCancelled){ _dPsdBusy(false); gToast('Importação cancelada'); return; }
  _dPsdBusyUpdate('Lendo estrutura, imagens e fontes…');
  let buf;
  try{ buf=await file.arrayBuffer(); }catch(e){ _dPsdBusy(false); gToast('⚠ Não foi possível ler o arquivo — verifique se é um .psd válido','error'); return; }
  if(_dPsdCancelled){ _dPsdBusy(false); gToast('Importação cancelada'); return; }
  let result;
  try{ result=await _dPsdReadPsd(buf, agPsd); }
  catch(e){ result={error:e}; }
  // Cancelado no meio: sai quieto (o usuário sabe o que fez), sem erro assustador.
  if(_dPsdCancelled || (result&&result.cancelled)){ _dPsdBusy(false); gToast('Importação cancelada'); return; }
  if(!result || result.error || !result.psd || !result.psd.width){
    _dPsdBusy(false); console.error('PSD:',result&&result.error); gToast('⚠ Não foi possível ler este PSD (formato não suportado)','error'); return;
  }
  try{
    _dPsdBusyUpdate('Preparando camadas editáveis…');
    // Luz global do DOCUMENTO, fixada antes de qualquer parse: os fluxos de prancheta chamam
    // dPsdParseItems com um psd sintético que não a carrega.
    _dPsdGlobalLight=_dPsdReadGlobalLight(result.psd);
    const baseName=file.name.replace(/\.ps[db]$/i,'');
    // PSD com múltiplas pranchetas (artboards) → tela de seleção antes da revisão.
    const artboards=(result.psd.children||[]).filter(c=>c && c.artboard && c.artboard.rect);
    _dPsdDocCanvas=result.psd.canvas||null;
    _dPsdDocRes=result.res||72;
    _dPsdBaseName=baseName;
    if(artboards.length>1){
      // Multi-prancheta abre DIRETO na revisão, com as pranchetas como abas. A primeira já
      // vem parseada; as outras só quando o designer clicar (ou no import).
      _dPsdBoards=_dPsdBuildBoards(artboards);
      _dPsdBoardIdx=0;
      _dPsdBoardsPrepRefs(); // recorta as referências e solta o composto do doc
      const b0=_dPsdBoardLoad(_dPsdBoards[0]);
      dPsdItems=b0.items;
      _dPsdAdjustCount=b0.adjust||0; _dPsdErrorCount=b0.errors||0;
      dPsdMeta={w:b0.w, h:b0.h, name:b0.name, res:_dPsdDocRes, ref:b0.ref};
      _dPsdBusy(false);
      if(!dPsdItems.length) gToast('⚠ "'+b0.name+'" não tem camadas utilizáveis — veja as outras pranchetas');
      dPsdOpenReview();
      return;
    }
    _dPsdBoards=[];
    if(artboards.length===1){
      // Prancheta única: usa rect da artboard como dimensões e offset.
      // Sem isso, PSDs exportados de docs multi-artboard herdariam o tamanho do doc inteiro.
      const abNode=artboards[0], r=abNode.artboard.rect;
      const abL=Math.round(r.left||0), abT=Math.round(r.top||0);
      const abW=Math.max(1,Math.round((r.right||0)-(r.left||0)));
      const abH=Math.max(1,Math.round((r.bottom||0)-(r.top||0)));
      // Só os filhos da PRANCHETA — não o doc inteiro. Passar result.psd trazia camadas soltas na
      // raiz (pasteboard/notas) deslocadas por (abL,abT). Igual ao multi-artboard e ao preview.
      dPsdItems=dPsdParseItems({children:(abNode.children||[]), width:abW, height:abH}, result.res||72, abL, abT);
      dPsdMeta={w:abW, h:abH, name:baseName, res:result.res||72, worker:result.worker===true,
        // ref: recorte da prancheta no composto do doc → base do relatório de fidelidade (#17)
        ref:_dPsdRefCanvas(result.psd.canvas, abL, abT, abW, abH)};
    } else {
      // PSD simples sem artboards.
      dPsdItems=dPsdParseItems(result.psd, result.res||72);
      dPsdMeta={w:result.psd.width, h:result.psd.height, name:baseName, res:result.res||72, worker:result.worker===true,
        ref:_dPsdRefCanvas(result.psd.canvas, 0, 0, result.psd.width, result.psd.height)};
    }
    _dPsdBusy(false);
    if(!dPsdItems.length){
      // Último recurso antes de recusar: a arte achatada do próprio Photoshop.
      const flat=_dPsdFlatItem(result.psd, dPsdMeta&&dPsdMeta.w, dPsdMeta&&dPsdMeta.h);
      if(!flat){ gToast('⚠ Nenhuma camada utilizável neste PSD','error'); return; }
      dPsdItems=[flat];
      gToast('PSD sem camadas editáveis — importando a arte achatada');
    }
    dPsdOpenReview();
  }catch(e){ _dPsdBusy(false); console.error('PSD parse:',e); gToast('⚠ Não foi possível interpretar as camadas do PSD','error'); }
}
