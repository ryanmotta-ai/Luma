/**
 * Custom Color Picker for Luma
 */

const LumaColorPicker = (function() {
  let isOpen = false;
  let currentTargetInput = null;
  let currentTargetSwatch = null;

  // State
  let h = 0; // 0-360
  let s = 100; // 0-100
  let v = 100; // 0-100

  // Elements
  let elPicker, elSvArea, elSvCursor, elHueArea, elHueCursor, elPreview, elHexInput, elSwatches;

  const defaultSwatches = [
    '#FF9000', '#F85400', '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF',
    '#5856D6', '#FF2D55', '#1A1A1A', '#333333', '#888888', '#CCCCCC', '#F5F5F5', '#FFFFFF'
  ];

  function init() {
    elPicker = document.getElementById('d-color-picker');
    if (!elPicker) return;

    elSvArea = document.getElementById('dcp-sv-area');
    elSvCursor = document.getElementById('dcp-sv-cursor');
    elHueArea = document.getElementById('dcp-hue-area');
    elHueCursor = document.getElementById('dcp-hue-cursor');
    elPreview = document.getElementById('dcp-preview');
    elHexInput = document.getElementById('dcp-hex-input');
    elSwatches = document.getElementById('dcp-swatches');

    // Populate swatches
    elSwatches.innerHTML = defaultSwatches.map(color => 
      `<div style="width:100%; aspect-ratio:1; border-radius:3px; background:${color}; cursor:pointer; box-shadow:inset 0 0 0 1px rgba(0,0,0,0.1);" onclick="LumaColorPicker.setHex('${color}')"></div>`
    ).join('');
    // Botão EyeDropper do sistema (conta-gotas universal — captura cor fora do navegador)
    if(typeof window.EyeDropper!=='undefined'){
      const edBtn=document.createElement('div');
      edBtn.style.cssText='grid-column:1/-1;display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;font-size:10px;color:rgba(255,255,255,.6);font-family:Roboto,sans-serif;letter-spacing:.03em;';
      edBtn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg> Capturar cor da tela';
      edBtn.addEventListener('click',()=>LumaColorPicker.eyedrop());
      elSwatches.appendChild(edBtn);
    }

    // Events
    document.addEventListener('mousedown', onDocMouseDown);
    
    // SV Area drag
    let draggingSV = false;
    elSvArea.addEventListener('mousedown', (e) => { draggingSV = true; updateSVFromMouse(e); });
    document.addEventListener('mousemove', (e) => { if(draggingSV) updateSVFromMouse(e); });
    document.addEventListener('mouseup', () => { draggingSV = false; });

    // Hue Area drag
    let draggingHue = false;
    elHueArea.addEventListener('mousedown', (e) => { draggingHue = true; updateHueFromMouse(e); });
    document.addEventListener('mousemove', (e) => { if(draggingHue) updateHueFromMouse(e); });
    document.addEventListener('mouseup', () => { draggingHue = false; });

    // Hex Input
    elHexInput.addEventListener('change', (e) => {
      let val = e.target.value;
      if(!val.startsWith('#')) val = '#' + val;
      setHex(val);
    });

    // Global interception of native color pickers
    document.addEventListener('click', (e) => {
      if(e.target && e.target.tagName === 'INPUT' && e.target.type === 'color') {
        e.preventDefault();
        open(e.target, e.target.id);
      }
    }, true); // Capture phase to prevent native picker
  }

  function onDocMouseDown(e) {
    if(!isOpen) return;
    if(elPicker.contains(e.target)) return;
    if(currentTargetSwatch && currentTargetSwatch.contains(e.target)) return;
    close();
  }

  function updateSVFromMouse(e) {
    const rect = elSvArea.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));

    s = (x / rect.width) * 100;
    v = 100 - ((y / rect.height) * 100);
    
    updateUI();
    triggerChange();
  }

  function updateHueFromMouse(e) {
    const rect = elHueArea.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));

    h = (x / rect.width) * 360;
    if(h >= 360) h = 0; // 360≡0 (vermelho puro); o clamp antigo em 359 gerava #FF0004

    updateUI();
    triggerChange();
  }

  function HSVtoRGB(h, s, v) {
    let r, g, b;
    let i = Math.floor(h / 60);
    let f = h / 60 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v, g = t, b = p; break;
      case 1: r = q, g = v, b = p; break;
      case 2: r = p, g = v, b = t; break;
      case 3: r = p, g = q, b = v; break;
      case 4: r = t, g = p, b = v; break;
      case 5: r = v, g = p, b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function RGBtoHSV(r, g, b) {
    let max = Math.max(r, g, b), min = Math.min(r, g, b),
        d = max - min,
        h,
        s = (max === 0 ? 0 : d / max),
        v = max / 255;

    switch (max) {
      case min: h = 0; break;
      case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break;
      case g: h = (b - r) + d * 2; h /= 6 * d; break;
      case b: h = (r - g) + d * 4; h /= 6 * d; break;
    }
    return [h * 360, s * 100, v * 100];
  }

  function RGBtoHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
  }

  function HexToRGB(hex) {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
      c = hex.substring(1).split('');
      if(c.length === 3){
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c = '0x' + c.join('');
      return [(c>>16)&255, (c>>8)&255, c&255];
    }
    return [0,0,0];
  }

  function updateUI() {
    const rgb = HSVtoRGB(h, s/100, v/100);
    const hex = RGBtoHex(rgb[0], rgb[1], rgb[2]);
    
    // Update SV background to pure hue
    const hueRgb = HSVtoRGB(h, 1, 1);
    elSvArea.style.background = `rgb(${hueRgb[0]}, ${hueRgb[1]}, ${hueRgb[2]})`;

    // Update cursors
    elSvCursor.style.left = s + '%';
    elSvCursor.style.top = (100 - v) + '%';
    elHueCursor.style.left = (h / 360 * 100) + '%';

    elPreview.style.background = hex;
    elHexInput.value = hex.substring(1);
  }

  function triggerChange() {
    const rgb = HSVtoRGB(h, s/100, v/100);
    const hex = RGBtoHex(rgb[0], rgb[1], rgb[2]);

    if(currentTargetInput) {
      currentTargetInput.value = hex;
      // Dispara o evento input nativo
      currentTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function setHex(hex) {
    const rgb = HexToRGB(hex);
    const hsv = RGBtoHSV(rgb[0], rgb[1], rgb[2]);
    h = hsv[0] || 0;
    s = hsv[1];
    v = hsv[2];
    updateUI();
    triggerChange();
  }

  function open(swatchEl, pickId) {
    if(!elPicker) init();
    
    currentTargetSwatch = swatchEl;
    currentTargetInput = document.getElementById(pickId);
    
    if(currentTargetInput && currentTargetInput.value) {
      const rgb = HexToRGB(currentTargetInput.value);
      const hsv = RGBtoHSV(rgb[0], rgb[1], rgb[2]);
      h = hsv[0] || 0;
      s = hsv[1];
      v = hsv[2];
    }
    
    updateUI();

    let rect = swatchEl.getBoundingClientRect();
    if(rect.width === 0 && rect.height === 0) {
      // Input está oculto, tentar pegar o elemento visual irmão (swatch) ou o pai
      const sibling = swatchEl.previousElementSibling;
      if(sibling && sibling.getBoundingClientRect().width > 0) {
        rect = sibling.getBoundingClientRect();
      } else {
        rect = swatchEl.parentElement.getBoundingClientRect();
      }
    }
    
    // Calcula posição para não vazar da tela
    let left = rect.left + rect.width + 12;
    let top = rect.top;

    elPicker.style.display = 'flex';
    elPicker.style.flexDirection = 'column';
    
    const pickerRect = elPicker.getBoundingClientRect();
    if(left + pickerRect.width > window.innerWidth) {
      left = rect.left - pickerRect.width - 12;
    }
    if(top + pickerRect.height > window.innerHeight) {
      top = window.innerHeight - pickerRect.height - 12;
    }

    elPicker.style.left = left + 'px';
    elPicker.style.top = top + 'px';
    
    isOpen = true;
  }

  function close() {
    if(elPicker) elPicker.style.display = 'none';
    isOpen = false;
  }

  // EyeDropper do sistema — captura cor de qualquer lugar da tela (fora do
  // navegador inclusive). Usa a API nativa EyeDropper (Chrome 95+/Edge 95+).
  function eyedrop(){
    if(typeof window.EyeDropper==='undefined'){
      gToast('Conta-gotas do sistema não suportado neste navegador (use Chrome ou Edge)');
      return;
    }
    const dropper=new window.EyeDropper();
    dropper.open().then(result=>{
      if(result&&result.sRGBHex){
        setHex(result.sRGBHex);
        gToast('Cor capturada: '+result.sRGBHex);
      }
    }).catch(()=>{/* usuário cancelou (Esc) — silencia */});
  }

  return {
    open,
    close,
    setHex,
    eyedrop,
    init
  };
})();

// Sobrescreve a função global para usar o novo Color Picker
window.dOpenColorPicker = function(swatchEl, pickId) {
  LumaColorPicker.open(swatchEl, pickId);
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  LumaColorPicker.init();
});
