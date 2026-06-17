// ============================================================
//  Luma – Motor de Blend Modes (Pixel Math Engine)
//  Implementa todos os 27 modos de mesclagem do Photoshop.
//  Vanilla JS, escopo global, sem dependências.
// ============================================================

// ------------------------------------------------------------
//  Constantes de mapeamento
// ------------------------------------------------------------

// Mapeamento modo Photoshop → CSS mix-blend-mode
const DBLEND_TO_CSS = {
    normal:       'normal',
    darken:       'darken',
    multiply:     'multiply',
    colorBurn:    'color-burn',
    linearBurn:   null,           // sem equivalente CSS
    darkerColor:  null,
    lighten:      'lighten',
    screen:       'screen',
    colorDodge:   'color-dodge',
    linearDodge:  null,
    lighterColor: null,
    overlay:      'overlay',
    softLight:    'soft-light',
    hardLight:    'hard-light',
    vividLight:   null,
    linearLight:  null,
    pinLight:     null,
    hardMix:      null,
    difference:   'difference',
    exclusion:    'exclusion',
    subtract:     null,
    divide:       null,
    hue:          'hue',
    saturation:   'saturation',
    color:        'color',
    luminosity:   'luminosity'
};

// Mapeamento modo PSD (ag-psd library) → nome interno
const DBLEND_PSD_MAP = {
    'normal':           'normal',
    'darken':           'darken',
    'multiply':         'multiply',
    'color burn':       'colorBurn',
    'linear burn':      'linearBurn',
    'darker color':     'darkerColor',
    'lighten':          'lighten',
    'screen':           'screen',
    'color dodge':      'colorDodge',
    'linear dodge':     'linearDodge',
    'lighter color':    'lighterColor',
    'overlay':          'overlay',
    'soft light':       'softLight',
    'hard light':       'hardLight',
    'vivid light':      'vividLight',
    'linear light':     'linearLight',
    'pin light':        'pinLight',
    'hard mix':         'hardMix',
    'difference':       'difference',
    'exclusion':        'exclusion',
    'subtract':         'subtract',
    'divide':           'divide',
    'hue':              'hue',
    'saturation':       'saturation',
    'color':            'color',
    'luminosity':       'luminosity'
};

// Lista agrupada para UI (dropdown)
const DBLEND_GROUPS = [
    { label: 'Normal',        modes: ['normal'] },
    { label: 'Escurecimento', modes: ['darken', 'multiply', 'colorBurn', 'linearBurn', 'darkerColor'] },
    { label: 'Clareamento',   modes: ['lighten', 'screen', 'colorDodge', 'linearDodge', 'lighterColor'] },
    { label: 'Contraste',     modes: ['overlay', 'softLight', 'hardLight', 'vividLight', 'linearLight', 'pinLight', 'hardMix'] },
    { label: 'Comparação',    modes: ['difference', 'exclusion', 'subtract', 'divide'] },
    { label: 'Cor (HSL)',     modes: ['hue', 'saturation', 'color', 'luminosity'] }
];

// ------------------------------------------------------------
//  Helpers internos
// ------------------------------------------------------------

/**
 * Clamp valor entre 0 e 1.
 * @param {number} v
 * @returns {number}
 */
function _dBlendClamp(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

/**
 * Luminância percebida (Rec. 601) — retorna 0-255.
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {number}
 */
function _dBlendLuminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Converte RGB (0-255) → HSL (0-1).
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {{h:number, s:number, l:number}}
 */
function _dBlendRgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0; // acromático
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: h, s: s, l: l };
}

/**
 * Converte HSL (0-1) → RGB (0-255).
 * @param {number} h 0-1
 * @param {number} s 0-1
 * @param {number} l 0-1
 * @returns {{r:number, g:number, b:number}}
 */
function _dBlendHslToRgb(h, s, l) {
    var r, g, b;
    if (s === 0) {
        r = g = b = l; // acromático
    } else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = _dBlendHue2Rgb(p, q, h + 1 / 3);
        g = _dBlendHue2Rgb(p, q, h);
        b = _dBlendHue2Rgb(p, q, h - 1 / 3);
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

/** Helper interno para conversão HSL→RGB. */
function _dBlendHue2Rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

// ------------------------------------------------------------
//  Fórmulas de blend por canal (valores normalizados 0-1)
//  A = top (camada superior),  B = bottom (camada inferior)
// ------------------------------------------------------------

/** @type {Object<string, function(number,number):number>} */
var _dBlendFormulas = {

    // --- Normal ---
    normal: function (a, b) { return a; },

    // --- Escurecimento ---
    darken:     function (a, b) { return Math.min(a, b); },
    multiply:   function (a, b) { return a * b; },
    colorBurn:  function (a, b) {
        if (a <= 0) return 0;
        return _dBlendClamp(1 - (1 - b) / a);
    },
    linearBurn: function (a, b) { return _dBlendClamp(a + b - 1); },
    // darkerColor e lighterColor tratados à parte (operam no pixel inteiro)

    // --- Clareamento ---
    lighten:     function (a, b) { return Math.max(a, b); },
    screen:      function (a, b) { return 1 - (1 - a) * (1 - b); },
    colorDodge:  function (a, b) {
        if (a >= 1) return 1;
        return _dBlendClamp(b / (1 - a));
    },
    linearDodge: function (a, b) { return _dBlendClamp(a + b); },
    // lighterColor tratado à parte

    // --- Contraste ---
    overlay: function (a, b) {
        return b < 0.5
            ? 2 * a * b
            : 1 - 2 * (1 - a) * (1 - b);
    },
    softLight: function (a, b) {
        // Fórmula Photoshop (não W3C)
        if (a <= 0.5) {
            return b - (1 - 2 * a) * b * (1 - b);
        } else {
            var d = b <= 0.25
                ? ((16 * b - 12) * b + 4) * b
                : Math.sqrt(b);
            return b + (2 * a - 1) * (d - b);
        }
    },
    hardLight: function (a, b) {
        // overlay com A e B trocados
        return a < 0.5
            ? 2 * a * b
            : 1 - 2 * (1 - a) * (1 - b);
    },
    vividLight: function (a, b) {
        if (a <= 0.5) {
            // colorBurn(2A, B)
            var a2 = 2 * a;
            return a2 <= 0 ? 0 : _dBlendClamp(1 - (1 - b) / a2);
        } else {
            // colorDodge(2A-1, B)
            var a2m = 2 * a - 1;
            return a2m >= 1 ? 1 : _dBlendClamp(b / (1 - a2m));
        }
    },
    linearLight: function (a, b) {
        if (a <= 0.5) {
            return _dBlendClamp(b + 2 * a - 1); // linearBurn(2A, B)
        } else {
            return _dBlendClamp(b + 2 * a - 1); // linearDodge(2A-1, B) = B + (2A-1)
        }
    },
    pinLight: function (a, b) {
        if (a <= 0.5) {
            return Math.min(b, 2 * a);
        } else {
            return Math.max(b, 2 * a - 1);
        }
    },
    hardMix: function (a, b) {
        return (a + b >= 1) ? 1 : 0;
    },

    // --- Comparação ---
    difference: function (a, b) { return Math.abs(a - b); },
    exclusion:  function (a, b) { return a + b - 2 * a * b; },
    subtract:   function (a, b) { return _dBlendClamp(b - a); },
    divide:     function (a, b) {
        if (a <= 0) return 1; // divisão por zero → branco
        return _dBlendClamp(b / a);
    }
};

// ------------------------------------------------------------
//  Modos HSL (operam no pixel inteiro, não por canal)
// ------------------------------------------------------------

/**
 * Aplica blend HSL. Troca componentes H/S/L entre top e bottom.
 * @param {string} mode  hue|saturation|color|luminosity
 * @param {{r:number,g:number,b:number}} top  0-255
 * @param {{r:number,g:number,b:number}} bot  0-255
 * @returns {{r:number,g:number,b:number}} resultado 0-255
 */
function _dBlendHsl(mode, top, bot) {
    var tHsl = _dBlendRgbToHsl(top.r, top.g, top.b);
    var bHsl = _dBlendRgbToHsl(bot.r, bot.g, bot.b);
    var h, s, l;
    switch (mode) {
        case 'hue':
            h = tHsl.h; s = bHsl.s; l = bHsl.l;
            break;
        case 'saturation':
            h = bHsl.h; s = tHsl.s; l = bHsl.l;
            break;
        case 'color':
            h = tHsl.h; s = tHsl.s; l = bHsl.l;
            break;
        case 'luminosity':
            h = bHsl.h; s = bHsl.s; l = tHsl.l;
            break;
    }
    return _dBlendHslToRgb(h, s, l);
}

// ------------------------------------------------------------
//  Função principal: dBlendPixel
// ------------------------------------------------------------

/**
 * Aplica o blend mode pixel a pixel.
 * @param {string} mode  Nome do modo (ex: 'multiply', 'overlay')
 * @param {{r:number,g:number,b:number,a:number}} topRGBA  0-255
 * @param {{r:number,g:number,b:number,a:number}} botRGBA  0-255
 * @returns {{r:number,g:number,b:number,a:number}} pixel mesclado
 */
function dBlendPixel(mode, topRGBA, botRGBA) {
    // Alpha normalizado (0-1)
    var aT = topRGBA.a / 255;
    var aB = botRGBA.a / 255;

    // Camada superior totalmente transparente → retorna inferior
    if (aT === 0) return { r: botRGBA.r, g: botRGBA.g, b: botRGBA.b, a: botRGBA.a };
    // Camada inferior totalmente transparente → retorna superior
    if (aB === 0) return { r: topRGBA.r, g: topRGBA.g, b: topRGBA.b, a: topRGBA.a };

    var rR, gR, bR;

    // --- Modos que operam no pixel inteiro ---
    if (mode === 'darkerColor') {
        var lumT = _dBlendLuminance(topRGBA.r, topRGBA.g, topRGBA.b);
        var lumB = _dBlendLuminance(botRGBA.r, botRGBA.g, botRGBA.b);
        if (lumT < lumB) {
            rR = topRGBA.r; gR = topRGBA.g; bR = topRGBA.b;
        } else {
            rR = botRGBA.r; gR = botRGBA.g; bR = botRGBA.b;
        }
    } else if (mode === 'lighterColor') {
        var lumT = _dBlendLuminance(topRGBA.r, topRGBA.g, topRGBA.b);
        var lumB = _dBlendLuminance(botRGBA.r, botRGBA.g, botRGBA.b);
        if (lumT > lumB) {
            rR = topRGBA.r; gR = topRGBA.g; bR = topRGBA.b;
        } else {
            rR = botRGBA.r; gR = botRGBA.g; bR = botRGBA.b;
        }
    } else if (mode === 'hue' || mode === 'saturation' || mode === 'color' || mode === 'luminosity') {
        // Modos HSL
        var hslResult = _dBlendHsl(mode, topRGBA, botRGBA);
        rR = hslResult.r; gR = hslResult.g; bR = hslResult.b;
    } else {
        // Modos por canal — normalizar para 0-1
        var fn = _dBlendFormulas[mode];
        if (!fn) fn = _dBlendFormulas.normal; // fallback seguro

        var tR = topRGBA.r / 255, tG = topRGBA.g / 255, tB = topRGBA.b / 255;
        var bR_ = botRGBA.r / 255, bG = botRGBA.g / 255, bB = botRGBA.b / 255;

        rR = fn(tR, bR_) * 255;
        gR = fn(tG, bG) * 255;
        bR = fn(tB, bB) * 255;
    }

    // --- Composição alpha (Porter-Duff source-over) ---
    var aOut = aT + aB * (1 - aT);
    if (aOut === 0) return { r: 0, g: 0, b: 0, a: 0 };

    // Interpolar resultado do blend com a cor inferior usando alpha do topo
    var rOut = (aT * rR + aB * (1 - aT) * botRGBA.r) / aOut;
    var gOut = (aT * gR + aB * (1 - aT) * botRGBA.g) / aOut;
    var bOut = (aT * bR + aB * (1 - aT) * botRGBA.b) / aOut;

    return {
        r: Math.round(Math.min(255, Math.max(0, rOut))),
        g: Math.round(Math.min(255, Math.max(0, gOut))),
        b: Math.round(Math.min(255, Math.max(0, bOut))),
        a: Math.round(aOut * 255)
    };
}

// ------------------------------------------------------------
//  Canvas 2D composite mapper
// ------------------------------------------------------------

/** Mapa interno: modo → globalCompositeOperation */
var _dBlendCompositeMap = {
    normal:     'source-over',
    multiply:   'multiply',
    screen:     'screen',
    overlay:    'overlay',
    darken:     'darken',
    lighten:    'lighten',
    colorDodge: 'color-dodge',
    colorBurn:  'color-burn',
    hardLight:  'hard-light',
    softLight:  'soft-light',
    difference: 'difference',
    exclusion:  'exclusion',
    hue:        'hue',
    saturation: 'saturation',
    color:      'color',
    luminosity: 'luminosity'
};

/**
 * Retorna o equivalente `globalCompositeOperation` do Canvas 2D API.
 * Retorna null se não há equivalente nativo (precisa fallback pixel-a-pixel).
 * @param {string} mode
 * @returns {string|null}
 */
function dBlendToComposite(mode) {
    return _dBlendCompositeMap[mode] || null;
}

// ------------------------------------------------------------
//  Blending de ImageData inteiro (fallback software)
// ------------------------------------------------------------

/**
 * Aplica blend mode a uma imagem inteira (ImageData).
 * Usado como fallback quando Canvas2D não suporta o modo.
 * Modifica botData in-place e também o retorna.
 * @param {string} mode
 * @param {ImageData} topData  Camada superior
 * @param {ImageData} botData  Camada inferior (será modificada)
 * @returns {ImageData} botData com o resultado
 */
function dBlendImageData(mode, topData, botData) {
    var tD = topData.data;
    var bD = botData.data;
    var len = tD.length; // 4 bytes por pixel (RGBA)

    // Pré-resolver a função de blend para evitar lookup repetido
    var fn = _dBlendFormulas[mode];
    var isPerPixel = (mode === 'darkerColor' || mode === 'lighterColor');
    var isHsl = (mode === 'hue' || mode === 'saturation' || mode === 'color' || mode === 'luminosity');

    for (var i = 0; i < len; i += 4) {
        var aT = tD[i + 3] / 255;
        var aB = bD[i + 3] / 255;

        // Skip se top totalmente transparente
        if (aT === 0) continue;

        var rR, gR, bR;

        if (isPerPixel) {
            // darkerColor / lighterColor
            var lumT = _dBlendLuminance(tD[i], tD[i + 1], tD[i + 2]);
            var lumB = _dBlendLuminance(bD[i], bD[i + 1], bD[i + 2]);
            if (mode === 'darkerColor') {
                if (lumT < lumB) {
                    rR = tD[i]; gR = tD[i + 1]; bR = tD[i + 2];
                } else {
                    rR = bD[i]; gR = bD[i + 1]; bR = bD[i + 2];
                }
            } else {
                if (lumT > lumB) {
                    rR = tD[i]; gR = tD[i + 1]; bR = tD[i + 2];
                } else {
                    rR = bD[i]; gR = bD[i + 1]; bR = bD[i + 2];
                }
            }
        } else if (isHsl) {
            var hslRes = _dBlendHsl(mode,
                { r: tD[i], g: tD[i + 1], b: tD[i + 2] },
                { r: bD[i], g: bD[i + 1], b: bD[i + 2] }
            );
            rR = hslRes.r; gR = hslRes.g; bR = hslRes.b;
        } else {
            // Modo por canal
            var useFn = fn || _dBlendFormulas.normal;
            var tR = tD[i] / 255, tG = tD[i + 1] / 255, tB = tD[i + 2] / 255;
            var bR_ = bD[i] / 255, bG = bD[i + 1] / 255, bB_ = bD[i + 2] / 255;
            rR = useFn(tR, bR_) * 255;
            gR = useFn(tG, bG) * 255;
            bR = useFn(tB, bB_) * 255;
        }

        // Composição alpha (Porter-Duff source-over)
        var aOut = aT + aB * (1 - aT);
        if (aOut === 0) {
            bD[i] = 0; bD[i + 1] = 0; bD[i + 2] = 0; bD[i + 3] = 0;
            continue;
        }

        var invAout = 1 / aOut;
        bD[i]     = Math.round(Math.min(255, Math.max(0, (aT * rR + aB * (1 - aT) * bD[i]) * invAout)));
        bD[i + 1] = Math.round(Math.min(255, Math.max(0, (aT * gR + aB * (1 - aT) * bD[i + 1]) * invAout)));
        bD[i + 2] = Math.round(Math.min(255, Math.max(0, (aT * bR + aB * (1 - aT) * bD[i + 2]) * invAout)));
        bD[i + 3] = Math.round(aOut * 255);
    }

    return botData;
}
