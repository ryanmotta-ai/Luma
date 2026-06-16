/**
 * js/tutorial/mocks.js
 *
 * tutMockCampaign, tutMockMaterial, tutMockHist —
 * builders de HTML de mock usados nas cenas de tutorial.
 * Depende de: nada (retorna strings HTML).
 */

function tutMockCampaign(name, gradient, prod, price, highlight){
  return `<div class="tut-mock-camp ${highlight?'highlight-target highlighted':''}">
    <div class="tut-mock-camp-thumb" style="background:${gradient}">
      <div class="tut-mock-camp-prod">${prod}</div>
      <div class="tut-mock-camp-por">${price}</div>
    </div>
    <div class="tut-mock-camp-body">
      <div class="tut-mock-camp-name">${name}</div>
      <div class="tut-mock-camp-sub">3 materiais</div>
    </div>
  </div>`;
}
function tutMockMaterial(fmt, name, highlight){
  const fmtClass = fmt==='story' ? 'tut-mock-fmt-canvas story' : fmt==='feed' ? 'tut-mock-fmt-canvas feed' : 'tut-mock-fmt-canvas wide';
  const dim = fmt==='story' ? '1080×1920' : fmt==='feed' ? '1080×1080' : '1200×628';
  return `<div class="tut-mock-camp tut-mock-mat ${highlight?'highlight-target highlighted':''}">
    <div class="${fmtClass}" style="width:100%;height:100px;border-radius:0">
      <div style="font-size:7px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;font-family:'Roboto',sans-serif;font-weight:700;z-index:1">${name.split(' — ')[0]||name}</div>
      <div style="font-size:10px;text-transform:uppercase;z-index:1;margin-top:3px">PRODUTO</div>
      <div style="font-size:14px;color:var(--dm-yellow);z-index:1">R$ XX</div>
    </div>
    <div class="tut-mock-camp-body">
      <div class="tut-mock-camp-name">${name}</div>
      <div class="tut-mock-camp-sub">${dim}</div>
    </div>
  </div>`;
}
function tutMockHist(name, camp, date, highlight, btnHighlight){
  return `<div class="tut-mock-hist ${highlight?'highlight-target highlighted':''}">
    <div class="tut-mock-hist-thumb">${camp.toUpperCase().slice(0,8)}</div>
    <div class="tut-mock-hist-info">
      <div class="tut-mock-hist-name">${name}</div>
      <div class="tut-mock-hist-meta">
        <span class="tut-mock-hist-badge">baixada</span>
        <span style="opacity:.4">·</span>
        <span>${date}</span>
      </div>
    </div>
    <div class="tut-mock-hist-actions">
      <div class="tut-mock-hist-btn ${btnHighlight?'highlighted':''}">✎ Editar</div>
    </div>
  </div>`;
}

