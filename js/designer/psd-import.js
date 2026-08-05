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
  const _warnIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16h.01"/></svg>';
  // Badge DPI: aviso visual quando o doc não é 72dpi (fontes em pontos serão escaladas)
  const _hiDpi=dPsdMeta.res&&dPsdMeta.res>90;
  const _dpiHtml=_hiDpi
    ?`<span class="psd-dpi-warn" title="Fontes em pontos serão escaladas automaticamente (${Math.round(dPsdMeta.res)}dpi para 72dpi)">${_warnIcon}${Math.round(dPsdMeta.res)} dpi</span>`
    :(dPsdMeta.res&&dPsdMeta.res!==72?`<span class="psd-meta-chip">${Math.round(dPsdMeta.res)} dpi</span>`:'');
  // Aviso de camadas de ajuste: o Luma não aplica ajustes de cor/tom (Levels/Curves/Hue…),
  // então as cores podem diferir levemente do PSD. (Fidelidade total exigiria achatar — futuro.)
  const _adjHtml=(_dPsdAdjustCount>0)
    ?`<span class="psd-dpi-warn" title="O Photoshop tem ${_dPsdAdjustCount} camada(s) de ajuste que o Luma não reproduz; as cores podem variar.">${_warnIcon}${_dPsdAdjustCount} ajuste(s) de cor</span>`
    :'';
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
  const _pCv=document.getElementById('d-psd-preview-canvas');
  if(_pCv&&!_pCv._psdHoverBound){
    _pCv._psdHoverBound=true;
    _pCv.addEventListener('mousemove',_dPsdCanvasHover);
    _pCv.addEventListener('mouseleave',()=>{ _dPsdLastHoverIdx=-1; dPsdHoverLayer(-1); });
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
    raster:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 17 4-4 3 3 3-3 6 5"/></svg>'
  };
  const kindOrder={text:0,shape:1,raster:2};
  const kindLabel={text:'Textos',shape:'Formas',raster:'Imagens'};
  // Indexar, filtrar por busca (nome, conteúdo, fontName, tipo em PT-BR) e agrupar por tipo
  const indexed=dPsdItems.map((it,i)=>({it,i})).filter(({it})=>!it.isMaskBase);
  const visible=filter?indexed.filter(({it})=>{
    return it.name.toLowerCase().includes(filter)||
      (it.content&&it.content.toLowerCase().includes(filter))||
      (it.fontName&&it.fontName.toLowerCase().includes(filter))||
      (it.kind==='shape'&&'forma'.includes(filter))||
      (it.kind==='raster'&&'imagem'.includes(filter))||
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
      modeSel=`<select class="psd-mode" aria-label="Como importar a camada ${_dPsdEsc(it.name)}" onchange="dPsdSetMode(${i},this.value)">
        <option value="text" ${it.mode==='text'?'selected':''}>Texto editável</option>
        <option value="var" ${it.mode==='var'?'selected':''}>Variável {{ }}</option>
        <option value="raster" ${it.mode==='raster'?'selected':''}>Imagem fiel</option></select>`;
    } else if(it.kind==='shape'){
      modeSel=`<select class="psd-mode" aria-label="Como importar a camada ${_dPsdEsc(it.name)}" onchange="dPsdSetMode(${i},this.value)">
        <option value="shape" ${it.mode==='shape'?'selected':''}>Cor (editável)</option>
        <option value="frame" ${it.mode==='frame'?'selected':''}>Moldura de foto</option>
        <option value="raster" ${it.mode==='raster'?'selected':''}>Imagem</option></select>`;
    } else { // raster/imagem: pode virar Imagem fiel OU moldura de foto (o franqueado preenche)
      modeSel=`<select class="psd-mode" aria-label="Como importar a camada ${_dPsdEsc(it.name)}" onchange="dPsdSetMode(${i},this.value)">
        <option value="raster" ${it.mode!=='frame'?'selected':''}>Imagem</option>
        <option value="frame" ${it.mode==='frame'?'selected':''}>Moldura de foto</option></select>`;
    }
    const swatchRadius=it.shapeKind==='circle'||it.shapeKind==='ellipse'?'50%':'3px';
    const swatch=it.kind==='shape'?`<span class="psd-swatch" style="background:${it.fill};border-radius:${swatchRadius}"></span>`:'';
    const isVarVisible = (it.kind==='text'&&it.mode==='var')||(it.mode==='frame');
    const varIn=`<input class="psd-var-input ${isVarVisible?'visible':''}" value="${_dPsdEsc(it.varName||'')}" placeholder="nome_do_campo" aria-label="Nome do campo editável da camada ${_dPsdEsc(it.name)}" oninput="dPsdSetVar(${i},this.value,this)">`;
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
    const fxWarns=[
      it.fxSatin?'Cetim não aplicado':'',
      it.fxContour?'Contorno de efeito ignorado':'',
      it.fxScale?('Efeitos a '+it.fxScale+'%'):'',
      it.strokeApprox?'Traço aproximado (cor sólida)':'',
      it.gradientUnsupported?('Gradiente '+(it.gradientUnsupported==='angle'?'cônico':'losango')+' → imagem fiel'):'',
      it.gradientOverlayApprox?('Sobreposição '+(it.gradientOverlayApprox==='angle'?'cônica':'losango')+' aproximada'):'',
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
    return header+`<div class="psd-row ${it.include?'':'psd-row-off'}" data-psd-idx="${i}" onmouseenter="typeof dPsdHoverLayer==='function'&&dPsdHoverLayer(${i})" onmouseleave="typeof dPsdHoverLayer==='function'&&dPsdHoverLayer(-1)">
      <input type="checkbox" aria-label="Importar camada ${_dPsdEsc(it.name)}" ${it.include?'checked':''} onchange="dPsdSetInclude(${i},this.checked)">
      <span class="psd-row-ico psd-row-ico-${it.kind}">${swatch||ico[it.kind]||ico.raster}</span>
      ${thumb}
      <span class="psd-row-name" title="${_dPsdEsc(it.name)}">
        <span class="psd-row-name-top">${_dPsdEsc(it.name)}${errBadge}${flatBadge}${multiStyleBadge}${blendBadge}${grpBlendBadge}${fxWarns}${fontWarn}${opacityBadge}${vecWarn}${clipWarn}${textInfoBadge}</span>
        ${groupCrumb}${textPrev}
      </span>
      ${modeSel}${varIn}</div>`;
  }).join('');
  dPsdUpdateCount();
  if(typeof dPsdRenderPreview === 'function') dPsdRenderPreview();
}
function dPsdSetMode(i,v){
  if(dPsdItems[i]){
    dPsdItems[i].mode=v;
    const row=document.querySelector(`#d-psd-rows [data-psd-idx="${i}"]`);
    if(row){
      const varIn=row.querySelector('.psd-var-input');
      if(varIn){
        const isVarVisible=(dPsdItems[i].kind==='text'&&v==='var')||(v==='frame');
        if(isVarVisible){
          varIn.classList.add('visible');
        } else {
          varIn.classList.remove('visible');
        }
      }
    }
    dPsdUpdateCount();
    if(typeof dPsdRenderPreview === 'function') dPsdRenderPreview();
  }
}
function dPsdSetVar(i,v,el){ if(dPsdItems[i]){ const clean=v.trim().replace(/[^a-zA-Z0-9_]/g,''); dPsdItems[i].varName=clean; if(el&&el.value!==clean) el.value=clean; } } // reescreve o input p/ refletir o valor sanitizado
function dPsdSetInclude(i,on){ if(dPsdItems[i]){ dPsdItems[i].include=on; const f=document.getElementById('d-psd-search'); dPsdRenderRows(f&&f.value.trim().toLowerCase()||''); } }
function dPsdSelectAll(){ dPsdItems.forEach(it=>{ if(!it.isMaskBase) it.include=true; }); const f=document.getElementById('d-psd-search'); dPsdRenderRows(f&&f.value.trim().toLowerCase()||''); }
function dPsdSelectNone(){ dPsdItems.forEach(it=>{ it.include=false; }); const f=document.getElementById('d-psd-search'); dPsdRenderRows(f&&f.value.trim().toLowerCase()||''); }
// Hover interativo sobre o canvas de preview: destaca a camada sob o cursor e rola a lista até ela.
let _dPsdLastHoverIdx=-1;
function _dPsdCanvasHover(e){
  const canvas=document.getElementById('d-psd-preview-canvas');
  if(!canvas||!dPsdMeta) return;
  const rect=canvas.getBoundingClientRect();
  const sx=dPsdMeta.w/Math.max(1,rect.width), sy=dPsdMeta.h/Math.max(1,rect.height);
  const cx=(e.clientX-rect.left)*sx, cy=(e.clientY-rect.top)*sy;
  let found=-1;
  for(let i=dPsdItems.length-1;i>=0;i--){
    const it=dPsdItems[i]; if(!it.include||it.isMaskBase) continue;
    if(cx>=it.x&&cx<=it.x+it.w&&cy>=it.y&&cy<=it.y+it.h){ found=i; break; }
  }
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
  let layers=chosen.map(dItemToLayer).filter(Boolean);
  // #4a — inverter z-order se a ordem do PSD vier trocada
  const inv=document.getElementById('d-psd-invert'); if(inv&&inv.checked) layers=layers.reverse();
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
  return items.map(it=>{
    const src=(it.kind==='text'&&it.mode==='var')?Object.assign({},it,{mode:'text'}):it;
    try{ return dItemToLayer(src); }catch(e){ return null; }
  }).filter(Boolean);
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
      if(it.shapeKind==='circle' || it.shapeKind==='ellipse'){
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
function dPsdHoverLayer(idx) {
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
      ctx.save();
      ctx.fillStyle = 'rgba(255, 144, 0, 0.2)';
      ctx.strokeStyle = '#FF9000';
      const lw = Math.max(2, Math.min(overlay.width, overlay.height) * 0.003);
      ctx.lineWidth = lw;
      ctx.fillRect(it.x, it.y, it.w, it.h);
      ctx.strokeRect(it.x - lw/2, it.y - lw/2, it.w + lw, it.h + lw); // stroke por fora para n sobrepor as bordas diretas
      ctx.restore();
    }
  }
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
    let layers=chosen.map(dItemToLayer).filter(Boolean);
    // invert null = usuario nunca abriu esta prancheta: cai na heuristica de z-order.
    const inv=(b.invert!=null)?b.invert:_dPsdShouldInvert(b.items,b.w,b.h);
    if(inv) layers=layers.reverse();
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
