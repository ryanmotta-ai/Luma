/**
 * js/tutorial/mocks-studio.js
 *
 * Mocks dark do ESTÚDIO (designer) para as cenas de tutorial:
 * tutStudio, tutStudioTool, tutArtCanvas, tutLayerRow, tutPanelCard,
 * tutVarPill, tutKey, tutChip. Retornam strings HTML (como mocks.js).
 * Depende de: nada. CSS em css/components/tutorial.css (.tut-studio*).
 */

// Um botão da toolbar vertical do estúdio. icon = caractere/emoji, key = atalho.
function tutStudioTool(icon, key, active, highlight){
  return `<div class="tut-studio-tool ${active?'active':''} ${highlight?'highlight-target highlighted':''}" title="${key||''}">
    <span>${icon}</span>${key?`<span class="tut-studio-tool-key">${key}</span>`:''}
  </div>`;
}

// Moldura do estúdio: toolbar esquerda + canvas central + painel direito opcional.
// opts = { tools: [{icon,key,active,highlight}], panel: htmlString|null, width }
function tutStudio(canvasHtml, opts){
  opts = opts || {};
  const tools = opts.tools || [
    {icon:'⌖',key:'V',active:true},{icon:'T',key:'T'},{icon:'▭',key:'R'},
    {icon:'🖼',key:'F'},{icon:'🖌',key:'B'},{icon:'💧',key:'I'},
  ];
  const toolbar = tools.map(t=>tutStudioTool(t.icon,t.key,t.active,t.highlight)).join('');
  return `<div class="tut-studio" style="${opts.width?`width:${opts.width}px`:''}">
    <div class="tut-studio-toolbar">${toolbar}</div>
    <div class="tut-studio-canvas">${canvasHtml}</div>
    ${opts.panel?`<div class="tut-studio-panel">${opts.panel}</div>`:''}
  </div>`;
}

// Mini arte estilo DM (fundo vermelho, faixa laranja, título, badge de preço).
// opts = { highlight: 'title'|'badge'|'frame'|'band'|'canvas'|null, w, h, titleText, priceText, selected: 'title'|... }
function tutArtCanvas(opts){
  opts = opts || {};
  const w = opts.w || 150, h = opts.h || 200;
  const hl = k => (opts.highlight===k?'highlight-target highlighted':'')+(opts.selected===k?' tut-art-selected':'');
  return `<div class="tut-art ${opts.highlight==='canvas'?'highlight-target highlighted':''}" style="width:${w}px;height:${h}px">
    <div class="tut-art-frame ${hl('frame')}"><span>📷</span></div>
    <div class="tut-art-band ${hl('band')}"></div>
    <div class="tut-art-title ${hl('title')}">${opts.titleText||'{{produto}}'}</div>
    <div class="tut-art-badge ${hl('badge')}">${opts.priceText||'R$ 9,90'}</div>
  </div>`;
}

// Linha do painel de camadas. opts = {active, highlight, badge}
function tutLayerRow(icon, name, opts){
  opts = opts || {};
  return `<div class="tut-layer-row ${opts.active?'active':''} ${opts.highlight?'highlight-target highlighted':''}">
    <span class="tut-layer-ico">${icon}</span>
    <span class="tut-layer-name">${name}</span>
    ${opts.badge?`<span class="tut-layer-badge">${opts.badge}</span>`:''}
    <span class="tut-layer-eye">👁</span>
  </div>`;
}

// Cartão de painel dark (título pequeno + corpo livre).
function tutPanelCard(title, bodyHtml, highlight){
  return `<div class="tut-panel-card ${highlight?'highlight-target highlighted':''}">
    <div class="tut-panel-card-title">${title}</div>
    <div class="tut-panel-card-body">${bodyHtml}</div>
  </div>`;
}

// Pill de variável {{nome}} com tipo.
function tutVarPill(name, type, highlight){
  return `<span class="tut-var-pill ${highlight?'highlight-target highlighted':''}">
    <span class="tut-var-pill-name">{{${name}}}</span>${type?`<span class="tut-var-pill-type">${type}</span>`:''}
  </span>`;
}

// Tecla de teclado estilizada.
function tutKey(k){ return `<span class="tut-key">${k}</span>`; }

// Chip/botão genérico. opts = {primary, highlight, id}
function tutChip(label, opts){
  opts = opts || {};
  return `<span ${opts.id?`id="${opts.id}"`:''} class="tut-chip ${opts.primary?'primary':''} ${opts.highlight?'highlight-target highlighted':''}">${label}</span>`;
}
