#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════════════════
   PASTA IMPLEMENTAÇÃO — as artes de lançamento de cidade (pedido do Ryan, 15/10/2026), refeitas
   do zero com os assets oficiais da Delivery Much, como TEMPLATES no contrato do importador de SVG
   do Estúdio (svg[data-luma], data-campo, g#foto_produto, g#logo_loja — js/designer/templates.js).
   ------------------------------------------------------------------------------------------
   Gera assets/templates/implementacao/*.svg (fontes, logos e celular embutidos: o arquivo abre
   igual em qualquer lugar). Tudo em vetor, menos o que é foto/logo oficial: o ticket do cupom sai
   do contorno oficial (CR_TICKET_D, js/creative/creative.js), os arcos são Béziers (o Luma não tem
   arco 1:1 — Bézier entra como vetor editável), o selo "BORA PEDIR" é desenhado aqui.
   Campos (o franqueado preenche): cidade, nomeLoja (os mesmos do CAMPS_IMPLEMENTACAO), cupom,
   desconto, regras + as molduras foto_produto e logo_loja. Paleta só da marca (CR_C).

   Uso:  node scripts/build-implementacao.js
   Depois: Estúdio → Nova campanha "Implementação" → Importar SVG (um por arte) → publicar.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const SAIDA = path.join(RAIZ, 'assets', 'templates', 'implementacao');
const uri = (arq, mime) => 'data:' + mime + ';base64,' + fs.readFileSync(path.join(RAIZ, arq)).toString('base64');

// Paleta fechada da marca (CR_C) — nada fora dela
const C = { laranja: '#F85400', solar: '#FF9000', amarelo: '#FFB900', branco: '#FFFFFF', grafite: '#434343', cinza: '#D9D9D9', vermelho: '#F62900' };

// Fontes embutidas: só as que cada arte usa
const FONTES = {
  realce: ["'Realce'", 900, 'normal', 'assets/creative/fontes/realce-black.woff2', 'font/woff2'],
  r400: ["'Roboto'", 400, 'normal', 'assets/creative/fontes/Roboto-Regular.woff2', 'font/woff2'],
  r500: ["'Roboto'", 500, 'normal', 'assets/creative/fontes/Roboto-Medium.woff2', 'font/woff2'],
  r700: ["'Roboto'", 700, 'normal', 'assets/fonts/Roboto-Bold.ttf', 'font/ttf'],
  r900: ["'Roboto'", 900, 'normal', 'assets/creative/fontes/Roboto-Black.woff2', 'font/woff2'],
  r400i: ["'Roboto'", 400, 'italic', 'assets/fonts/Roboto-Italic.ttf', 'font/ttf'],
  r500i: ["'Roboto'", 500, 'italic', 'assets/fonts/Roboto-MediumItalic.ttf', 'font/ttf'],
  r900i: ["'Roboto'", 900, 'italic', 'assets/fonts/Roboto-BlackItalic.ttf', 'font/ttf']
};
const fontes = lista => '<style>' + lista.map(k => { const [fam, peso, est, arq, mime] = FONTES[k];
  return "@font-face{font-family:" + fam + ";font-weight:" + peso + ";font-style:" + est + ";src:url('" + uri(arq, mime) + "')}"; }).join('')
  + '.hero{font-family:\'Realce\',sans-serif;font-weight:900}.rb{font-family:\'Roboto\',sans-serif}</style>';

// ── Peças em vetor ────────────────────────────────────────────────────────────────────────
const n = v => Math.round(v * 100) / 100;
// Anel (coroa circular) de a0 a a1 graus, em Béziers cúbicas (≤ 90° por trecho)
function anel(cx, cy, r1, r2, a0, a1, cor, extra){
  const seg = (r, a, b) => {
    const k = 4 / 3 * Math.tan((b - a) * Math.PI / 720), ra = a * Math.PI / 180, rb = b * Math.PI / 180;
    const p0 = [cx + r * Math.cos(ra), cy + r * Math.sin(ra)], p3 = [cx + r * Math.cos(rb), cy + r * Math.sin(rb)];
    const c1 = [p0[0] - k * r * Math.sin(ra), p0[1] + k * r * Math.cos(ra)], c2 = [p3[0] + k * r * Math.sin(rb), p3[1] - k * r * Math.cos(rb)];
    return 'C ' + [c1, c2, p3].map(p => n(p[0]) + ' ' + n(p[1])).join(' ');
  };
  const passos = Math.ceil(Math.abs(a1 - a0) / 90), d = (a1 - a0) / passos;
  let s = 'M ' + n(cx + r2 * Math.cos(a0 * Math.PI / 180)) + ' ' + n(cy + r2 * Math.sin(a0 * Math.PI / 180));
  for(let i = 0; i < passos; i++) s += ' ' + seg(r2, a0 + i * d, a0 + (i + 1) * d);
  s += ' L ' + n(cx + r1 * Math.cos(a1 * Math.PI / 180)) + ' ' + n(cy + r1 * Math.sin(a1 * Math.PI / 180));
  for(let i = passos; i > 0; i--) s += ' ' + seg(r1, a0 + i * d, a0 + (i - 1) * d);
  return '<path d="' + s + ' Z" fill="' + cor + '"' + (extra || '') + '/>';
}
// O ticket oficial (680×250) e o canhoto dele, escalados para w×h em (x,y)
const TICKET = 'M 30 0 L 650 0 C 665 0 680 15 680 30 C 655 55 655 85 680 110 C 655 135 655 165 680 190 C 655 215 655 240 680 250 L 30 250 C 15 250 0 235 0 220 C 25 195 25 165 0 140 C 25 115 25 85 0 60 C 25 35 25 15 0 0 Z';
const CANHOTO = s => 'M 30 0 L ' + s + ' 0 L ' + s + ' 250 L 30 250 C 15 250 0 235 0 220 C 25 195 25 165 0 140 C 25 115 25 85 0 60 C 25 35 25 15 0 0 Z';
const escala = (d, x, y, w, h) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (m, a, b) => n(x + (+a) * w / 680) + ' ' + n(y + (+b) * h / 250));
// Ticket com borda (border), corpo branco e canhoto colorido com a palavra do canhoto em pé
function ticket(x, y, w, h, o){
  const b = o.borda, cs = o.canhoto || 110;
  return '<g id="' + (o.id || 'ticket') + '">'
    + '<path d="' + escala(TICKET, x - b, y - b, w + 2 * b, h + 2 * b) + '" fill="' + o.corBorda + '"/>'
    + '<path d="' + escala(TICKET, x, y, w, h) + '" fill="' + C.branco + '"/>'
    + '<path d="' + escala(CANHOTO(cs * 680 / w), x, y, w, h) + '" fill="' + o.corCanhoto + '"/>'
    + '<text class="' + (o.classeCanhoto || 'hero') + '" transform="translate(' + n(x + cs / 2 + o.tamCanhoto * 0.36) + ' ' + n(y + h / 2) + ') rotate(-90)" text-anchor="middle" font-size="' + o.tamCanhoto + '"'
    + (o.estiloCanhoto || '') + ' fill="' + C.branco + '">' + o.palavra + '</text>'
    + '</g>';
}
// Chapéu do símbolo da marca, em vetor (caixa 100×100)
const CHAPEU = 'M 22 60 C 6 58 0 44 7 33 C 13 24 24 22 31 26 C 33 13 44 6 56 8 C 66 10 73 17 75 25 C 84 20 96 24 99 35 C 101 47 93 57 82 59 L 79 86 C 66 91 36 91 23 87 Z';
const chapeu = (x, y, s, cor) => '<path d="' + CHAPEU.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (m, a, b) => n(x + a * s / 100) + ' ' + n(y + b * s / 100)) + '" fill="' + cor + '"/>';
// Selo "BORA PEDIR" + delivery much: o celular com o chapéu, a tarja amarela e o logo
function boraPedir(x, y, k, fundo, logo){
  const pw = 128 * k, ph = 214 * k, r = 26 * k;
  return '<g id="bora-pedir">'
    + '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(pw) + '" height="' + n(ph) + '" rx="' + n(r) + '" fill="' + C.branco + '"/>'
    + '<rect x="' + n(x + 10 * k) + '" y="' + n(y + 10 * k) + '" width="' + n(pw - 20 * k) + '" height="' + n(ph - 20 * k) + '" rx="' + n(r - 8 * k) + '" fill="' + fundo + '"/>'
    + chapeu(x + 24 * k, y + 52 * k, 80 * k, C.branco)
    + '<rect x="' + n(x + 46 * k) + '" y="' + n(y + 22 * k) + '" width="' + n(36 * k) + '" height="' + n(7 * k) + '" rx="' + n(3.5 * k) + '" fill="' + C.branco + '"/>'
    + '<rect x="' + n(x + 100 * k) + '" y="' + n(y + 40 * k) + '" width="' + n(296 * k) + '" height="' + n(70 * k) + '" fill="' + C.amarelo + '"/>'
    + '<text class="hero" x="' + n(x + 248 * k) + '" y="' + n(y + 95 * k) + '" text-anchor="middle" font-size="' + n(58 * k) + '" fill="' + C.laranja + '">BORA PEDIR</text>'
    + '<image href="' + logo + '" x="' + n(x + 138 * k) + '" y="' + n(y + 126 * k) + '" width="' + n(330 * k) + '" height="' + n(97 * k) + '"/>'
    + '</g>';
}
const svg = (w, h, corpo, lista) => '<svg xmlns="http://www.w3.org/2000/svg" data-luma="implementacao" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">'
  + '<defs>' + fontes(lista) + '</defs>' + corpo + '</svg>\n';

const LOGO_H = uri('assets/logos/dm-h-branca.png', 'image/png');
const LOGO_V = uri('assets/logos/dm-v-branca.png', 'image/png');
const CELULAR = uri('assets/creative/inv/celular-app.png', 'image/png');
const EXPLOSAO = uri('assets/creative/inv/explosao.png', 'image/png');
const FOTO = uri('assets/demo/hamburguer.jpg', 'image/jpeg');
const LOGO_LOJA = uri('assets/demo/logo-loja.png', 'image/png');

const ARTES = [];

/* 1 · "bora pedir no app de [cidade]" — feed, cupom de primeiro pedido e foto */
ARTES.push(['01-bora-pedir-no-app-feed.svg', svg(1080, 1350,
  '<rect width="1080" height="1350" fill="' + C.solar + '"/>'
  + anel(1250, 1450, 640, 840, 180, 270, C.laranja)
  + '<image href="' + CELULAR + '" x="760" y="-70" width="390" height="700" transform="rotate(14 955 280)"/>'
  + '<text class="rb" x="420" y="262" text-anchor="middle" font-size="86" font-weight="700" fill="' + C.branco + '"><tspan x="420" y="262">bora pedir</tspan><tspan x="420" y="356">no app de</tspan></text>'
  + '<g id="tarja-cidade"><path d="M 150 418 L 890 398 L 872 540 L 168 556 L 200 486 Z" fill="' + C.amarelo + '"/></g>'
  + '<text class="rb" data-campo="cidade" x="532" y="502" text-anchor="middle" font-size="68" font-weight="700" fill="' + C.branco + '" transform="rotate(-1.4 532 480)">Nome da Cidade</text>'
  + '<text class="rb" x="540" y="660" text-anchor="middle" font-size="44" font-weight="500" font-style="italic" fill="' + C.branco + '">use o cupom:</text>'
  + ticket(170, 700, 740, 230, { borda: 14, corBorda: C.vermelho, corCanhoto: C.vermelho, palavra: 'cupom', tamCanhoto: 34, classeCanhoto: 'rb', estiloCanhoto: ' font-weight="700" font-style="italic"', canhoto: 104 })
  + '<text class="rb" data-campo="cupom" x="592" y="818" text-anchor="middle" font-size="76" font-weight="900" font-style="italic" fill="' + C.laranja + '">CUPOMAQUI</text>'
  + '<rect x="392" y="842" width="400" height="5" rx="2.5" fill="' + C.amarelo + '"/>'
  + '<text class="rb" data-campo="regras" x="592" y="892" text-anchor="middle" font-size="30" font-style="italic" fill="' + C.grafite + '">válido no seu primeiro pedido!</text>'
  + '<g id="foto_produto"><circle cx="170" cy="1250" r="330" fill="' + C.cinza + '"/><image href="' + FOTO + '" x="-160" y="920" width="660" height="660" clip-path="url(#recorte-foto)"/></g>'
  + '<clipPath id="recorte-foto"><circle cx="170" cy="1250" r="330"/></clipPath>'
  + boraPedir(560, 1040, 1, C.solar, LOGO_H),
  ['realce', 'r500i', 'r700', 'r900i', 'r400i'])]);

/* 2 · cupom de boas-vindas — story amarelo, XX% OFF e o app */
ARTES.push(['02-cupom-boas-vindas-story.svg', svg(1080, 1920,
  '<rect width="1080" height="1920" fill="' + C.amarelo + '"/>'
  + anel(1200, 640, 420, 640, 180, 270, C.solar)
  + anel(-80, 1900, 330, 540, 270, 360, C.solar)
  + '<g id="selo-bora-pedir">'
  + '<rect x="560" y="370" width="260" height="380" rx="42" fill="' + C.branco + '"/><rect x="572" y="382" width="236" height="356" rx="32" fill="' + C.vermelho + '"/>'
  + '<image href="' + LOGO_V + '" x="590" y="460" width="200" height="200"/>'
  + '<g transform="rotate(-8 430 560)"><rect x="296" y="472" width="250" height="96" fill="' + C.vermelho + '"/><text class="hero" x="421" y="550" text-anchor="middle" font-size="80" fill="' + C.branco + '">BORA</text>'
  + '<rect x="318" y="570" width="262" height="96" fill="' + C.branco + '"/><text class="hero" x="449" y="648" text-anchor="middle" font-size="80" fill="' + C.vermelho + '">PEDIR</text></g>'
  + '</g>'
  + '<g transform="rotate(-3 540 1100)">'
  + ticket(110, 960, 900, 330, { id: 'ticket-tras', borda: 16, corBorda: C.solar, corCanhoto: C.solar, palavra: '', tamCanhoto: 10, canhoto: 130 }).replace('<g id="ticket-tras">', '<g id="ticket-tras" transform="translate(28 46)">')
  + ticket(80, 920, 900, 330, { borda: 16, corBorda: C.laranja, corCanhoto: C.vermelho, palavra: 'CUPOM', tamCanhoto: 74, canhoto: 130 })
  + '<text class="hero" data-campo="desconto" x="595" y="1018" text-anchor="middle" font-size="76" fill="' + C.solar + '">XX% OFF</text>'
  + '<rect x="290" y="1040" width="610" height="5" rx="2.5" fill="' + C.amarelo + '"/>'
  + '<text class="rb" data-campo="cupom" x="595" y="1140" text-anchor="middle" font-size="86" font-weight="900" fill="' + C.vermelho + '">NOMEDOCUPOM</text>'
  + '<rect x="290" y="1166" width="610" height="5" rx="2.5" fill="' + C.amarelo + '"/>'
  + '<text class="rb" data-campo="regras" x="300" y="1214" font-size="30" font-style="italic" fill="' + C.grafite + '">*Regras do cupom</text>'
  + '</g>'
  + '<image href="' + CELULAR + '" x="290" y="1380" width="500" height="898"/>',
  ['realce', 'r900', 'r400i'])]);

/* 3 · "[estabelecimento] também é parceiro" — story com o logo da loja e a foto */
ARTES.push(['03-tambem-e-parceiro-story.svg', svg(1080, 1920,
  '<rect width="1080" height="1920" fill="' + C.laranja + '"/>'
  + anel(1150, -40, 560, 780, 90, 180, C.solar)
  + '<image href="' + EXPLOSAO + '" x="800" y="860" width="340" height="340"/>'
  + '<circle cx="540" cy="2480" r="1360" fill="' + C.branco + '"/>'
  + '<g id="logo_loja"><circle cx="540" cy="400" r="180" fill="' + C.branco + '"/><image href="' + LOGO_LOJA + '" x="400" y="260" width="280" height="280" clip-path="url(#recorte-logo)"/></g>'
  + '<clipPath id="recorte-logo"><circle cx="540" cy="400" r="150"/></clipPath>'
  + '<text class="rb" data-campo="nomeLoja" x="540" y="700" text-anchor="middle" font-size="84" font-weight="700" fill="' + C.branco + '"><tspan x="540" y="700">Nome do</tspan><tspan x="540" y="796">Estabelecimento</tspan></text>'
  + '<text class="rb" x="540" y="878" text-anchor="middle" font-size="56" fill="' + C.branco + '">também é parceiro</text>'
  + '<image href="' + LOGO_H + '" x="350" y="920" width="380" height="112"/>'
  + '<g id="foto_produto"><rect x="140" y="1300" width="800" height="560" rx="56" fill="' + C.cinza + '"/><image href="' + FOTO + '" x="140" y="1180" width="800" height="800" clip-path="url(#recorte-foto)"/></g>'
  + '<clipPath id="recorte-foto"><rect x="140" y="1300" width="800" height="560" rx="56"/></clipPath>',
  ['r400', 'r700'])]);

/* 4 · "bora comemorar com rango & descontão" — feed, cupom em destaque */
const borrados = [[-150, 110, 420, 155, -18], [820, 50, 380, 140, 22], [900, 760, 360, 130, -12], [-170, 900, 400, 150, 14], [760, 1200, 420, 155, -20]]
  .map(([x, y, w, h, g]) => '<g transform="rotate(' + g + ' ' + (x + w / 2) + ' ' + (y + h / 2) + ')">' + '<path d="' + escala(TICKET, x - 10, y - 10, w + 20, h + 20) + '" fill="' + C.solar + '"/>'
    + '<path d="' + escala(TICKET, x, y, w, h) + '" fill="' + C.branco + '"/><path d="' + escala(CANHOTO(70 * 680 / w), x, y, w, h) + '" fill="' + C.solar + '"/></g>').join('');
ARTES.push(['04-bora-comemorar-feed.svg', svg(1080, 1350,
  '<linearGradient id="fundo-comemorar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + C.laranja + '"/><stop offset="1" stop-color="' + C.solar + '"/></linearGradient>'
  + '<filter id="desfoque" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>'
  + '<clipPath id="tela"><rect width="1080" height="1350"/></clipPath>'
  + '<rect width="1080" height="1350" fill="url(#fundo-comemorar)"/>'
  + '<g id="cupons-ao-fundo" clip-path="url(#tela)"><g filter="url(#desfoque)" opacity="0.6">'
  + '<path d="M 300 1350 L 640 260 L 980 1350 Z" fill="' + C.solar + '" opacity="0.35"/><path d="M -80 900 L 260 0 L 520 900 Z" fill="' + C.laranja + '" opacity="0.4"/>'
  + borrados + '</g></g>'
  + '<text class="hero" x="540" y="330" text-anchor="middle" font-size="128" fill="' + C.amarelo + '" stroke="' + C.branco + '" stroke-width="20" stroke-linejoin="round" paint-order="stroke">BORA COMEMORAR</text>'
  + '<text class="rb" x="540" y="418" text-anchor="middle" font-size="58" fill="' + C.branco + '">com <tspan font-weight="700">rango</tspan> &amp; <tspan font-weight="700">descontão</tspan></text>'
  + ticket(110, 510, 860, 330, { borda: 18, corBorda: C.amarelo, corCanhoto: C.solar, palavra: 'CUPOM', tamCanhoto: 74, canhoto: 130 })
  + '<text class="hero" data-campo="desconto" x="610" y="608" text-anchor="middle" font-size="76" fill="' + C.solar + '">XX% OFF</text>'
  + '<rect x="300" y="630" width="620" height="5" rx="2.5" fill="' + C.amarelo + '"/>'
  + '<text class="rb" data-campo="cupom" x="610" y="732" text-anchor="middle" font-size="90" font-weight="900" fill="' + C.vermelho + '">NOMEDOCUPOM</text>'
  + '<rect x="300" y="758" width="620" height="5" rx="2.5" fill="' + C.amarelo + '"/>'
  + '<text class="rb" data-campo="regras" x="610" y="808" text-anchor="middle" font-size="28" font-style="italic" fill="' + C.grafite + '">*Regras do cupom aqui.</text>'
  + boraPedir(330, 990, 1, C.laranja, LOGO_H),
  ['realce', 'r400', 'r700', 'r900', 'r400i'])]);

fs.mkdirSync(SAIDA, { recursive: true });
ARTES.forEach(([nome, conteudo]) => { fs.writeFileSync(path.join(SAIDA, nome), conteudo); console.log(nome.padEnd(36) + (conteudo.length / 1024).toFixed(0) + ' KB'); });
