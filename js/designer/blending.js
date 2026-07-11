// ============================================================
//  Luma – Motor de Blend Modes (Pixel Math Engine)
//  27 modos de mesclagem do Photoshop. Funções 100% puras.
//  Sem dependências externas. Sem efeitos colaterais.
// ============================================================

// ------------------------------------------------------------
//  Metadados: mapa CSS e mapa PSD
// ------------------------------------------------------------

const DBLEND_TO_CSS = {
    normal:       'normal',
    darken:       'darken',
    multiply:     'multiply',
    colorBurn:    'color-burn',
    linearBurn:   null,
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

// Mapa: nome PSD (ag-psd) → nome interno
const DBLEND_PSD_MAP = {
    'normal':        'normal',
    'darken':        'darken',
    'multiply':      'multiply',
    'color burn':    'colorBurn',
    'linear burn':   'linearBurn',
    'darker color':  'darkerColor',
    'lighten':       'lighten',
    'screen':        'screen',
    'color dodge':   'colorDodge',
    'linear dodge':  'linearDodge',
    'lighter color': 'lighterColor',
    'overlay':       'overlay',
    'soft light':    'softLight',
    'hard light':    'hardLight',
    'vivid light':   'vividLight',
    'linear light':  'linearLight',
    'pin light':     'pinLight',
    'hard mix':      'hardMix',
    'difference':    'difference',
    'exclusion':     'exclusion',
    'subtract':      'subtract',
    'divide':        'divide',
    'hue':           'hue',
    'saturation':    'saturation',
    'color':         'color',
    'luminosity':    'luminosity'
};

// Grupos para UI (dropdown agrupado)
const DBLEND_GROUPS = [
    { label: 'Normal',        modes: ['normal'] },
    { label: 'Escurecimento', modes: ['darken', 'multiply', 'colorBurn', 'linearBurn', 'darkerColor'] },
    { label: 'Clareamento',   modes: ['lighten', 'screen', 'colorDodge', 'linearDodge', 'lighterColor'] },
    { label: 'Contraste',     modes: ['overlay', 'softLight', 'hardLight', 'vividLight', 'linearLight', 'pinLight', 'hardMix'] },
    { label: 'Comparação',    modes: ['difference', 'exclusion', 'subtract', 'divide'] },
    { label: 'Cor (HSL)',     modes: ['hue', 'saturation', 'color', 'luminosity'] }
];

// Labels PT-BR (nomes do Photoshop em português)
const _DBLEND_LABELS = {
    normal:       'Normal',
    darken:       'Escurecer',
    multiply:     'Multiplicar',
    colorBurn:    'Queimar Cor',
    linearBurn:   'Queimar Linear',
    darkerColor:  'Cor Mais Escura',
    lighten:      'Clarear',
    screen:       'Tela',
    colorDodge:   'Clarear Cor',
    linearDodge:  'Clarear Linear',
    lighterColor: 'Cor Mais Clara',
    overlay:      'Sobrepor',
    softLight:    'Luz Suave',
    hardLight:    'Luz Intensa',
    vividLight:   'Luz Vibrante',
    linearLight:  'Luz Linear',
    pinLight:     'Luz de Pino',
    hardMix:      'Mistura Intensa',
    difference:   'Diferença',
    exclusion:    'Exclusão',
    subtract:     'Subtrair',
    divide:       'Dividir',
    hue:          'Matiz',
    saturation:   'Saturação',
    color:        'Cor',
    luminosity:   'Luminosidade'
};

// Ordem canônica dos 27 modos (igual ao painel do Photoshop)
const _DBLEND_ORDER = [
    'normal',
    'darken', 'multiply', 'colorBurn', 'linearBurn', 'darkerColor',
    'lighten', 'screen', 'colorDodge', 'linearDodge', 'lighterColor',
    'overlay', 'softLight', 'hardLight', 'vividLight', 'linearLight', 'pinLight', 'hardMix',
    'difference', 'exclusion', 'subtract', 'divide',
    'hue', 'saturation', 'color', 'luminosity'
];

// ------------------------------------------------------------
//  Helper de baixo nível
// ------------------------------------------------------------

function _dBlendClamp(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

// ------------------------------------------------------------
//  Spec Photoshop HSL – funções auxiliares (valores 0–1)
//  Fonte: Adobe PDF Reference, seção "Non-Separable Blend Modes"
// ------------------------------------------------------------

/**
 * Luminância percebida (Rec. 601), valores 0–1.
 * @param {number[]} C  [r, g, b] normalizados 0–1
 * @returns {number}
 */
function _dLum(C) {
    return 0.299 * C[0] + 0.587 * C[1] + 0.114 * C[2];
}

/**
 * Recorta componentes fora de [0,1] preservando luminância.
 * @param {number[]} C  [r, g, b] 0–1 (pode ter valores fora do range)
 * @returns {number[]}
 */
function _dClipColor(C) {
    var l = _dLum(C);
    var n = Math.min(C[0], C[1], C[2]);
    var x = Math.max(C[0], C[1], C[2]);
    var r = C[0], g = C[1], b = C[2];
    if (n < 0) {
        var lMinusN = l - n;
        r = l + (r - l) * l / lMinusN;
        g = l + (g - l) * l / lMinusN;
        b = l + (b - l) * l / lMinusN;
    }
    if (x > 1) {
        var xMinusL = x - l;
        var oneMinusL = 1 - l;
        r = l + (r - l) * oneMinusL / xMinusL;
        g = l + (g - l) * oneMinusL / xMinusL;
        b = l + (b - l) * oneMinusL / xMinusL;
    }
    return [r, g, b];
}

/**
 * Ajusta a luminância de C para o valor alvo l.
 * @param {number[]} C  [r, g, b] 0–1
 * @param {number}   l  luminância alvo 0–1
 * @returns {number[]}
 */
function _dSetLum(C, l) {
    var d = l - _dLum(C);
    return _dClipColor([C[0] + d, C[1] + d, C[2] + d]);
}

/**
 * Ajusta a saturação (max−min) de C para o valor alvo s.
 * @param {number[]} C  [r, g, b] 0–1
 * @param {number}   s  saturação alvo 0–1
 * @returns {number[]}
 */
function _dSetSat(C, s) {
    // Ordena índices por valor para identificar min/mid/max
    var ch = [
        { idx: 0, val: C[0] },
        { idx: 1, val: C[1] },
        { idx: 2, val: C[2] }
    ];
    ch.sort(function(a, b) { return a.val - b.val; });
    // ch[0]=min, ch[1]=mid, ch[2]=max
    var res = [0, 0, 0];
    if (ch[2].val > ch[0].val) {
        res[ch[1].idx] = (ch[1].val - ch[0].val) * s / (ch[2].val - ch[0].val);
        res[ch[2].idx] = s;
    }
    // res[ch[0].idx] permanece 0
    return res;
}

// ------------------------------------------------------------
//  Conversão RGB ↔ HSL (r,g,b em 0–255; h,s,l em 0–1)
// ------------------------------------------------------------

/** Helper interno da conversão HSL→RGB. */
function _dHslHue2Rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

/**
 * Converte RGB (0–255) para HSL (0–1).
 * @param {number} r 0–255
 * @param {number} g 0–255
 * @param {number} b 0–255
 * @returns {number[]} [h, s, l]
 */
function _dRgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h, s;
    var l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else                h = ((r - g) / d + 4) / 6;
    }
    return [h, s, l];
}

/**
 * Converte HSL (0–1) para RGB (0–255).
 * @param {number} h 0–1
 * @param {number} s 0–1
 * @param {number} l 0–1
 * @returns {number[]} [r, g, b]
 */
function _dHslToRgb(h, s, l) {
    var r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = _dHslHue2Rgb(p, q, h + 1 / 3);
        g = _dHslHue2Rgb(p, q, h);
        b = _dHslHue2Rgb(p, q, h - 1 / 3);
    }
    return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
    ];
}

// ------------------------------------------------------------
//  Fórmulas por canal (valores normalizados 0–1)
//  a = Cs (camada superior/blend), b = Cb (camada inferior/base)
// ------------------------------------------------------------

var _dBlendFormulas = {

    // --- Normal ---
    normal: function(a, b) { return a; },

    // --- Escurecimento ---
    darken:     function(a, b) { return Math.min(a, b); },
    multiply:   function(a, b) { return a * b; },
    colorBurn:  function(a, b) {
        if (a <= 0) return 0;
        return _dBlendClamp(1 - (1 - b) / a);
    },
    linearBurn: function(a, b) { return _dBlendClamp(a + b - 1); },

    // --- Clareamento ---
    lighten:     function(a, b) { return Math.max(a, b); },
    screen:      function(a, b) { return 1 - (1 - a) * (1 - b); },
    colorDodge:  function(a, b) {
        if (a >= 1) return 1;
        return _dBlendClamp(b / (1 - a));
    },
    linearDodge: function(a, b) { return _dBlendClamp(a + b); },

    // --- Contraste ---
    overlay: function(a, b) {
        return b < 0.5
            ? 2 * a * b
            : 1 - 2 * (1 - a) * (1 - b);
    },
    softLight: function(a, b) {
        // Fórmula Photoshop (≠ W3C)
        if (a <= 0.5) {
            return b - (1 - 2 * a) * b * (1 - b);
        }
        var d = b <= 0.25
            ? ((16 * b - 12) * b + 4) * b
            : Math.sqrt(b);
        return b + (2 * a - 1) * (d - b);
    },
    hardLight: function(a, b) {
        // Overlay com Cs/Cb invertidos
        return a < 0.5
            ? 2 * a * b
            : 1 - 2 * (1 - a) * (1 - b);
    },
    vividLight: function(a, b) {
        if (a <= 0.5) {
            var a2 = 2 * a;
            return a2 <= 0 ? 0 : _dBlendClamp(1 - (1 - b) / a2);
        }
        var a2m = 2 * a - 1;
        return a2m >= 1 ? 1 : _dBlendClamp(b / (1 - a2m));
    },
    linearLight: function(a, b) {
        return _dBlendClamp(b + 2 * a - 1);
    },
    pinLight: function(a, b) {
        return a <= 0.5 ? Math.min(b, 2 * a) : Math.max(b, 2 * a - 1);
    },
    hardMix: function(a, b) {
        return (a + b >= 1) ? 1 : 0;
    },

    // --- Comparação ---
    difference: function(a, b) { return Math.abs(a - b); },
    exclusion:  function(a, b) { return a + b - 2 * a * b; },
    subtract:   function(a, b) { return _dBlendClamp(b - a); },
    divide:     function(a, b) {
        if (a <= 0) return 1;
        return _dBlendClamp(b / a);
    }
};

// ------------------------------------------------------------
//  Função principal: dBlendPixel
// ------------------------------------------------------------

/**
 * Aplica blend mode pixel a pixel (motor puro, sem estado global).
 *
 * @param {string}   mode   Modo de mesclagem (ex: 'multiply', 'overlay')
 * @param {number[]} base   [r, g, b, a] — camada inferior; r/g/b 0–255, a 0–1
 * @param {number[]} blend  [r, g, b, a] — camada superior; r/g/b 0–255, a 0–1
 * @returns {number[]} [r, g, b, a] resultado mesclado
 */
function dBlendPixel(mode, base, blend) {
    var ab = base[3];   // alpha do backdrop  (0–1)
    var as = blend[3];  // alpha da fonte/top (0–1)

    // Fast-paths para transparência total
    if (as === 0) return [base[0],  base[1],  base[2],  ab];
    if (ab === 0) return [blend[0], blend[1], blend[2], as];

    // Normaliza RGB → 0–1 para os cálculos
    var cb = [base[0]  / 255, base[1]  / 255, base[2]  / 255];
    var cs = [blend[0] / 255, blend[1] / 255, blend[2] / 255];

    var br; // resultado do blend em 0–1

    if (mode === 'darkerColor') {
        var lumB1 = 0.299 * base[0]  + 0.587 * base[1]  + 0.114 * base[2];
        var lumS1 = 0.299 * blend[0] + 0.587 * blend[1] + 0.114 * blend[2];
        br = lumS1 < lumB1 ? [cs[0], cs[1], cs[2]] : [cb[0], cb[1], cb[2]];

    } else if (mode === 'lighterColor') {
        var lumB2 = 0.299 * base[0]  + 0.587 * base[1]  + 0.114 * base[2];
        var lumS2 = 0.299 * blend[0] + 0.587 * blend[1] + 0.114 * blend[2];
        br = lumS2 > lumB2 ? [cs[0], cs[1], cs[2]] : [cb[0], cb[1], cb[2]];

    } else if (mode === 'hue') {
        // SetLum(SetSat(Cs, Sat(Cb)), Lum(Cb))
        var satCb = Math.max(cb[0], cb[1], cb[2]) - Math.min(cb[0], cb[1], cb[2]);
        br = _dSetLum(_dSetSat(cs, satCb), _dLum(cb));

    } else if (mode === 'saturation') {
        // SetLum(SetSat(Cb, Sat(Cs)), Lum(Cb))
        var satCs = Math.max(cs[0], cs[1], cs[2]) - Math.min(cs[0], cs[1], cs[2]);
        br = _dSetLum(_dSetSat(cb, satCs), _dLum(cb));

    } else if (mode === 'color') {
        // SetLum(Cs, Lum(Cb))
        br = _dSetLum(cs, _dLum(cb));

    } else if (mode === 'luminosity') {
        // SetLum(Cb, Lum(Cs))
        br = _dSetLum(cb, _dLum(cs));

    } else {
        // Modos por canal
        var fn = _dBlendFormulas[mode] || _dBlendFormulas.normal;
        br = [fn(cs[0], cb[0]), fn(cs[1], cb[1]), fn(cs[2], cb[2])];
    }

    // Spec Adobe/W3C: contribuição da fonte = (1−ab)·Cs + ab·B(Cb,Cs).
    // Sem o termo (1−ab)·Cs, backdrop semi-transparente saía escuro/errado
    // vs Photoshop e vs mix-blend-mode nativo. Com ab=1 é no-op.
    br = [cs[0] + ab * (br[0] - cs[0]), cs[1] + ab * (br[1] - cs[1]), cs[2] + ab * (br[2] - cs[2])];

    // Porter-Duff source-over
    var ao = as + ab * (1 - as);
    if (ao === 0) return [0, 0, 0, 0];

    var inv = 1 / ao;
    var fac = ab * (1 - as);
    return [
        Math.round(Math.min(255, Math.max(0, (as * br[0] + fac * cb[0]) * inv * 255))),
        Math.round(Math.min(255, Math.max(0, (as * br[1] + fac * cb[1]) * inv * 255))),
        Math.round(Math.min(255, Math.max(0, (as * br[2] + fac * cb[2]) * inv * 255))),
        ao
    ];
}

// ------------------------------------------------------------
//  API pública: lista e label de modos
// ------------------------------------------------------------

/**
 * Retorna a lista ordenada de modos disponíveis para UI.
 * @returns {{id: string, label: string}[]}
 */
function dBlendModeList() {
    return _DBLEND_ORDER.map(function(id) {
        return { id: id, label: _DBLEND_LABELS[id] || id };
    });
}

/**
 * Retorna o label PT-BR de um modo.
 * @param {string} id
 * @returns {string}
 */
function dBlendModeLabel(id) {
    return _DBLEND_LABELS[id] || id;
}

// ------------------------------------------------------------
//  Canvas 2D composite mapper (fallback para modos sem suporte)
// ------------------------------------------------------------

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
 * Retorna o equivalente `globalCompositeOperation` do Canvas 2D.
 * Retorna null se não há equivalente nativo (usar dBlendImageData).
 * @param {string} mode
 * @returns {string|null}
 */
function dBlendToComposite(mode) {
    return _dBlendCompositeMap[mode] || null;
}

// ------------------------------------------------------------
//  dBlendImageData – fallback software sobre ImageData inteiro
// ------------------------------------------------------------

/**
 * Aplica blend mode a uma ImageData inteira (fallback pixel-a-pixel).
 * Modifica botData in-place e também o retorna.
 * @param {string}    mode
 * @param {ImageData} topData  Camada superior
 * @param {ImageData} botData  Camada inferior (modificada in-place)
 * @returns {ImageData}
 */
function dBlendImageData(mode, topData, botData) {
    var tD = topData.data;
    var bD = botData.data;
    var len = tD.length; // 4 bytes por pixel (RGBA)

    var fn = _dBlendFormulas[mode];
    var isPerPixel = (mode === 'darkerColor' || mode === 'lighterColor');
    var isHsl = (mode === 'hue' || mode === 'saturation' || mode === 'color' || mode === 'luminosity');

    for (var i = 0; i < len; i += 4) {
        var aT = tD[i + 3] / 255;
        var aB = bD[i + 3] / 255;

        if (aT === 0) continue;
        // Backdrop 100% transparente: resultado = pixel da camada (como no Photoshop).
        // Sem este fast-path, o RGB indefinido do fundo (0,0,0) entrava na fórmula e
        // multiply/darken pintavam franjas pretas sobre áreas transparentes.
        if (aB === 0) { bD[i]=tD[i]; bD[i+1]=tD[i+1]; bD[i+2]=tD[i+2]; bD[i+3]=tD[i+3]; continue; }

        var rR, gR, bR;

        if (isPerPixel) {
            var lumT = 0.299 * tD[i] + 0.587 * tD[i + 1] + 0.114 * tD[i + 2];
            var lumB = 0.299 * bD[i] + 0.587 * bD[i + 1] + 0.114 * bD[i + 2];
            if (mode === 'darkerColor') {
                if (lumT < lumB) { rR = tD[i]; gR = tD[i + 1]; bR = tD[i + 2]; }
                else             { rR = bD[i]; gR = bD[i + 1]; bR = bD[i + 2]; }
            } else {
                if (lumT > lumB) { rR = tD[i]; gR = tD[i + 1]; bR = tD[i + 2]; }
                else             { rR = bD[i]; gR = bD[i + 1]; bR = bD[i + 2]; }
            }
        } else if (isHsl) {
            var csH = [tD[i] / 255, tD[i + 1] / 255, tD[i + 2] / 255];
            var cbH = [bD[i] / 255, bD[i + 1] / 255, bD[i + 2] / 255];
            var hslRes;
            if (mode === 'hue') {
                var satCbH = Math.max(cbH[0], cbH[1], cbH[2]) - Math.min(cbH[0], cbH[1], cbH[2]);
                hslRes = _dSetLum(_dSetSat(csH, satCbH), _dLum(cbH));
            } else if (mode === 'saturation') {
                var satCsH = Math.max(csH[0], csH[1], csH[2]) - Math.min(csH[0], csH[1], csH[2]);
                hslRes = _dSetLum(_dSetSat(cbH, satCsH), _dLum(cbH));
            } else if (mode === 'color') {
                hslRes = _dSetLum(csH, _dLum(cbH));
            } else {
                hslRes = _dSetLum(cbH, _dLum(csH));
            }
            rR = hslRes[0] * 255; gR = hslRes[1] * 255; bR = hslRes[2] * 255;
        } else {
            var useFn = fn || _dBlendFormulas.normal;
            var tRn = tD[i] / 255, tGn = tD[i + 1] / 255, tBn = tD[i + 2] / 255;
            var bRn = bD[i] / 255, bGn = bD[i + 1] / 255, bBn = bD[i + 2] / 255;
            rR = useFn(tRn, bRn) * 255;
            gR = useFn(tGn, bGn) * 255;
            bR = useFn(tBn, bBn) * 255;
        }

        // Termo (1−aB)·Cs da spec (ver dBlendPixel) — no-op com backdrop opaco
        rR = tD[i]     + aB * (rR - tD[i]);
        gR = tD[i + 1] + aB * (gR - tD[i + 1]);
        bR = tD[i + 2] + aB * (bR - tD[i + 2]);

        // Porter-Duff source-over
        var aOut = aT + aB * (1 - aT);
        if (aOut === 0) {
            bD[i] = 0; bD[i + 1] = 0; bD[i + 2] = 0; bD[i + 3] = 0;
            continue;
        }

        var invAout = 1 / aOut;
        var facB = aB * (1 - aT);
        bD[i]     = Math.round(Math.min(255, Math.max(0, (aT * rR + facB * bD[i])     * invAout)));
        bD[i + 1] = Math.round(Math.min(255, Math.max(0, (aT * gR + facB * bD[i + 1]) * invAout)));
        bD[i + 2] = Math.round(Math.min(255, Math.max(0, (aT * bR + facB * bD[i + 2]) * invAout)));
        bD[i + 3] = Math.round(aOut * 255);
    }

    return botData;
}

// ------------------------------------------------------------
//  Auto-teste — dBlendSelfTest()
//  Executa 5 asserts com valores conhecidos do Photoshop.
//  Retorna {pass, fail}. Não lança exceção.
// ------------------------------------------------------------

function dBlendSelfTest() {
    var pass = 0;
    var fail = 0;

    function assert(label, cond) {
        if (cond) {
            pass++;
        } else {
            fail++;
            if (typeof console !== 'undefined') {
                console.warn('[dBlendSelfTest] FAIL: ' + label);
            }
        }
    }

    // Tolerância ±1 para arredondamento inteiro
    function near(a, b) { return Math.abs(a - b) <= 1; }

    // 1. multiply(0.5, 0.5) = 0.25  →  r,g,b ≈ 64
    //    base=blend=[128,128,128,1]; alpha=1 → sem compositing, resultado = fórmula pura
    var r1 = dBlendPixel('multiply', [128, 128, 128, 1], [128, 128, 128, 1]);
    assert('multiply 0.5×0.5 ≈ 0.25 (≈64)', near(r1[0], 64) && near(r1[1], 64) && near(r1[2], 64));

    // 2. screen(0.5, 0.5) = 1-(0.5×0.5) = 0.75  →  r,g,b ≈ 191
    var r2 = dBlendPixel('screen', [128, 128, 128, 1], [128, 128, 128, 1]);
    assert('screen 0.5 sobre 0.5 ≈ 0.75 (≈191)', near(r2[0], 191) && near(r2[1], 191) && near(r2[2], 191));

    // 3. normal retorna a camada superior (blend)
    var r3 = dBlendPixel('normal', [100, 150, 200, 1], [50, 100, 150, 1]);
    assert('normal retorna blend', r3[0] === 50 && r3[1] === 100 && r3[2] === 150);

    // 4. difference de cores iguais = preto
    var r4 = dBlendPixel('difference', [100, 150, 200, 1], [100, 150, 200, 1]);
    assert('difference de iguais = preto', r4[0] === 0 && r4[1] === 0 && r4[2] === 0);

    // 5. overlay: base escuro (Cb<0.5) → 2×Cs×Cb
    //    base=[50,50,50,1] Cb≈0.196  blend=[200,200,200,1] Cs≈0.784
    //    2 × 0.784 × 0.196 × 255 ≈ 78
    var r5 = dBlendPixel('overlay', [50, 50, 50, 1], [200, 200, 200, 1]);
    assert('overlay base-escuro×blend-claro ≈ 78', near(r5[0], 78) && near(r5[1], 78) && near(r5[2], 78));

    return { pass: pass, fail: fail };
}
