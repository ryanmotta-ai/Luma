/**
 * Rich Tooltip Engine for Luma Toolbar (With CSS Demos)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Demo Catalog (HTML + CSS Animations)
  window.LumaTooltipDemos = {
    'select': `
      <style>
        .demo-select-scene { width:100%; height:100%; position:relative; background:#1A1A1A; overflow:hidden; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5); }
        .demo-select-box { width:50px; height:30px; background:var(--dm-red); border-radius:4px; position:absolute; left:20px; top:40px; animation: ds-move 3s infinite cubic-bezier(0.4, 0, 0.2, 1); }
        .demo-select-border { position:absolute; inset:-2px; border:1.5px dashed rgba(255,255,255,0.8); border-radius:6px; opacity:0; animation: ds-border 3s infinite; }
        .demo-select-cursor { position:absolute; width:14px; height:20px; background:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2"><path d="M5 3l14 9-7 1-4 7z"/></svg>') no-repeat center; background-size:contain; animation: ds-cursor 3s infinite cubic-bezier(0.4, 0, 0.2, 1); z-index:10; left:30px; top:60px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
        @keyframes ds-move { 0%, 20% { transform:translate(0,0); } 40%, 80% { transform:translate(40px, 15px); } 100% { transform:translate(0,0); } }
        @keyframes ds-cursor { 0% { transform:translate(0,0); } 15%, 25% { transform:translate(15px, -15px); } 40%, 80% { transform:translate(55px, 0px); } 100% { transform:translate(0,0); } }
        @keyframes ds-border { 0%, 15% { opacity:0; } 16%, 85% { opacity:1; } 86%, 100% { opacity:0; } }
      </style>
      <div class="demo-select-scene">
        <div class="demo-select-box"><div class="demo-select-border"></div></div>
        <div class="demo-select-cursor"></div>
      </div>
    `,
    'text': `
      <style>
        .demo-text-scene { width:100%; height:100%; position:relative; background:#1A1A1A; overflow:hidden; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5); }
        .demo-text-box { font-family:'Inter', 'Roboto', sans-serif; font-size:20px; font-weight:800; color:#fff; position:relative; display:flex; letter-spacing: 1px;}
        .demo-text-char { opacity:0; animation: dt-type 3s infinite; }
        .demo-text-char:nth-child(1) { animation-delay: 0.4s; }
        .demo-text-char:nth-child(2) { animation-delay: 0.6s; }
        .demo-text-char:nth-child(3) { animation-delay: 0.8s; }
        .demo-text-char:nth-child(4) { animation-delay: 1.0s; }
        .demo-text-cursor { width:2px; height:24px; background:var(--dm-orange); margin-left:4px; animation: dt-blink 0.6s infinite; }
        @keyframes dt-type { 0% { opacity:0; } 5%, 85% { opacity:1; } 100% { opacity:0; } }
        @keyframes dt-blink { 0%, 49% { opacity:1; } 50%, 100% { opacity:0; } }
      </style>
      <div class="demo-text-scene">
        <div class="demo-text-box">
          <span class="demo-text-char">L</span><span class="demo-text-char">U</span><span class="demo-text-char">M</span><span class="demo-text-char">A</span>
          <div class="demo-text-cursor"></div>
        </div>
      </div>
    `,
    'magic-wand': `
      <style>
        .demo-mw-scene { width:100%; height:100%; position:relative; background:#1A1A1A; overflow:hidden; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);}
        .demo-mw-block { width:24px; height:24px; border-radius:4px; background:var(--dm-orange); opacity:0.4; transition:all 0.2s;}
        .demo-mw-block.blue { background:#2196F3; }
        .dmw-anim-active { animation: dmw-active 3s infinite; }
        .demo-mw-cursor { position:absolute; width:16px; height:16px; background:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2"><path d="M3 21l10-10M13 3l1.5 3 3 1.5-3 1.5L13 12l-1.5-3-3-1.5 3-1.5z"/></svg>') no-repeat center; background-size:contain; animation: dmw-cursor 3s infinite cubic-bezier(0.4, 0, 0.2, 1); z-index:10; left:20%; top:70%; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
        @keyframes dmw-cursor { 0%, 20% { transform:translate(0,0); } 30%, 70% { transform:translate(35px, -35px); } 100% { transform:translate(0,0); } }
        @keyframes dmw-active { 0%, 31% { opacity:0.4; transform:scale(1); box-shadow:none; } 32%, 69% { opacity:1; transform:scale(1.15); box-shadow:0 0 0 2px #fff, 0 0 12px var(--dm-orange); z-index:2; } 70%, 100% { opacity:0.4; transform:scale(1); box-shadow:none; } }
      </style>
      <div class="demo-mw-scene">
        <div class="demo-mw-block"></div>
        <div class="demo-mw-block dmw-anim-active"></div>
        <div class="demo-mw-block blue"></div>
        <div class="demo-mw-cursor"></div>
      </div>
    `
  };

  // Inject the Rich Tooltip container into the body
  const rtHtml = `
  <style>
    #d-rich-tooltip {
      position:fixed; z-index:999999; background:var(--d-dark); border:1px solid var(--d-border2); 
      border-radius:12px; box-shadow:0 16px 48px rgba(0,0,0,0.6); display:flex; flex-direction:column; font-family:'Roboto',sans-serif; 
      pointer-events:none; opacity:0; visibility:hidden; transition:opacity 0.15s ease-in, transform 0.2s ease-out; transform:translateX(-10px);
      width: 260px;
    }
    #d-rich-tooltip::before {
      content: ''; position: absolute; left: -6px; top: 24px;
      border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-right: 6px solid var(--d-border2);
    }
    #d-rich-tooltip::after {
      content: ''; position: absolute; left: -5px; top: 24px;
      border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-right: 6px solid var(--d-dark);
    }
    .d-rt-content { padding:16px; flex:1; display:flex; flex-direction:column; justify-content:center; }
    .d-rt-stage { width:100%; height:140px; border-bottom:1px solid var(--d-border2); padding:12px; display:none; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.2); border-radius:12px 12px 0 0; }
  </style>
  <div id="d-rich-tooltip">
    <div class="d-rt-stage" id="d-rt-stage"></div>
    <div class="d-rt-content">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
        <strong id="d-rt-title" style="color:var(--dm-orange); font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; line-height:1.2;"></strong>
        <span id="d-rt-shortcut" style="color:var(--d-text3); font-size:10px; background:var(--d-surf); border:1px solid var(--d-border2); padding:2px 6px; border-radius:4px; font-weight:600; margin-left:8px; display:none;"></span>
      </div>
      <div id="d-rt-desc" style="color:#fff; font-size:12px; line-height:1.5; font-weight:500;"></div>
    </div></div>`;
  
  document.body.insertAdjacentHTML('beforeend', rtHtml);

  const elTooltip = document.getElementById('d-rich-tooltip');
  const elTitle = document.getElementById('d-rt-title');
  const elDesc = document.getElementById('d-rt-desc');
  const elShortcut = document.getElementById('d-rt-shortcut');
  const elStage = document.getElementById('d-rt-stage');

  let hoverTimer = null;
  let currentTarget = null;

  const triggerElements = document.querySelectorAll('[data-tooltip-title]');

  triggerElements.forEach(el => {
    el.addEventListener('mouseenter', (e) => {
      currentTarget = el;
      if(hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        showTooltip(el);
      }, 500);
    });

    el.addEventListener('mouseleave', () => {
      if(hoverTimer) clearTimeout(hoverTimer);
      hideTooltip();
    });
  });

  function showTooltip(el) {
    const title = el.getAttribute('data-tooltip-title');
    const desc = el.getAttribute('data-tooltip-desc');
    const shortcut = el.getAttribute('data-tooltip-shortcut');
    const demoKey = el.getAttribute('data-tooltip-demo');

    if(!title) return;

    elTitle.innerHTML = title;
    
    if(desc) {
      elDesc.innerHTML = desc;
      elDesc.style.display = 'block';
    } else {
      elDesc.style.display = 'none';
    }

    if(shortcut) {
      elShortcut.textContent = shortcut;
      elShortcut.style.display = 'block';
    } else {
      elShortcut.style.display = 'none';
    }

    // CSS Demo Injection
    if(demoKey && window.LumaTooltipDemos[demoKey]) {
      elStage.innerHTML = window.LumaTooltipDemos[demoKey];
      elStage.style.display = 'flex';
    } else {
      elStage.innerHTML = '';
      elStage.style.display = 'none';
    }

    // Calcula posiÃ§Ã£o (Ã  direita do botÃ£o)
    const rect = el.getBoundingClientRect();
    
    let left = rect.right + 14; 
    let top = rect.top - 14; // Alinhar seta com a nova altura

    const estimatedHeight = demoKey ? 240 : 100;
    if (top + estimatedHeight > window.innerHeight) {
      top = window.innerHeight - estimatedHeight - 12;
    }

    elTooltip.style.left = left + 'px';
    elTooltip.style.top = top + 'px';
    
    elTooltip.style.visibility = 'visible';
    elTooltip.style.opacity = '1';
    elTooltip.style.transform = 'translateX(0)';
  }

  function hideTooltip() {
    elTooltip.style.opacity = '0';
    elTooltip.style.transform = 'translateX(-10px)';
    setTimeout(() => {
      if(elTooltip.style.opacity === '0') {
        elTooltip.style.visibility = 'hidden';
      }
    }, 200);
  }
});

