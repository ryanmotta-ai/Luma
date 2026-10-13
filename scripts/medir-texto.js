#!/usr/bin/env node
/**
 * scripts/medir-texto.js
 *
 * Mede o texto do hero na fonte Realce Black de verdade (navegador headless) e devolve o MAIOR font-size
 * que cabe na largura útil, para 1, 2 e 3 linhas. Substitui a estimativa "0,46 × tamanho" da skill luma-creative.
 * Zero dependências.
 *
 * Uso:  node scripts/medir-texto.js "PIZZA CALABRESA TRADICIONAL" [--largura 880] [--min 80] [--max 170] [--entrelinha 0.94]
 *   --largura     largura útil em px (padrão 880 = 1080 − 2×100)
 *   --min / --max piso e teto do font-size (padrão 80 / 170)
 *   --entrelinha  multiplicador da entrelinha (padrão 0.94)
 * Saída: tabela por nº de linhas (quebra em palavras, balanceada), com a altura do bloco e a recomendação.
 */
const fs = require('fs');
const path = require('path');
const { avaliarNaPagina } = require('./capture-art.js');

const WOFF2 = path.join(__dirname, '..', '.agents', 'skills', 'luma-creative', 'assets', 'fontes', 'realce-black.woff2');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const texto = process.argv[2];
if (!texto || texto.startsWith('--')) { console.log('Uso: node scripts/medir-texto.js "TEXTO DO HERO" [--largura 880] [--min 80] [--max 170] [--entrelinha 0.94]'); process.exit(1); }

const largura = Number(arg('largura', 880)), min = Number(arg('min', 80)), max = Number(arg('max', 170)), ent = Number(arg('entrelinha', 0.94));

// todas as quebras em k linhas (preservando a ordem das palavras)
function quebras(palavras, k) {
  if (k === 1) return [[palavras.join(' ')]];
  const out = [];
  (function rec(i, restante, acc) {
    if (restante === 1) { out.push([...acc, palavras.slice(i).join(' ')]); return; }
    for (let j = i + 1; j <= palavras.length - (restante - 1); j++) rec(j, restante - 1, [...acc, palavras.slice(i, j).join(' ')]);
  })(0, k, []);
  return out;
}

(async () => {
  const palavras = texto.toUpperCase().split(/\s+/).filter(Boolean);
  const candidatos = [];
  for (let k = 1; k <= Math.min(3, palavras.length); k++) candidatos.push(...quebras(palavras, k));
  const linhasUnicas = [...new Set(candidatos.flat())];

  const b64 = fs.readFileSync(WOFF2).toString('base64');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@font-face{font-family:'Realce';src:url(data:font/woff2;base64,${b64}) format('woff2');font-weight:900}</style></head><body><span style="font-family:Realce;font-weight:900">x</span></body></html>`;
  const expr = `(async()=>{await document.fonts.load("900 100px Realce");await document.fonts.ready;const c=document.createElement('canvas').getContext('2d');c.font="900 100px Realce";c.letterSpacing="0.5px";const o={};for(const l of ${JSON.stringify(linhasUnicas)}){o[l]=c.measureText(l).width}return JSON.stringify(o)})()`;
  const larg100 = JSON.parse(await avaliarNaPagina(html, 1200, 400, expr));

  // melhor quebra por nº de linhas: minimiza a linha mais larga
  const porK = {};
  candidatos.forEach(linhas => {
    const k = linhas.length;
    const w100 = Math.max(...linhas.map(l => larg100[l]));
    if (!porK[k] || w100 < porK[k].w100) porK[k] = { linhas, w100 };
  });

  console.log(`Hero: "${texto.toUpperCase()}"  | largura útil ${largura}px | piso ${min} | teto ${max}\n`);
  const linhasInfo = Object.keys(porK).map(Number).sort().map(k => {
    const { linhas, w100 } = porK[k];
    const bruto = Math.floor(largura / w100 * 100);
    const tam = Math.min(bruto, max);
    return { k, linhas, tam, cabe: bruto >= min };
  });
  linhasInfo.forEach(({ k, linhas, tam, cabe }) => {
    const altura = Math.round(tam * ent * (k - 1) + tam * 0.72);
    console.log(`${k} linha${k > 1 ? 's' : ' '}: ${String(tam).padStart(3)}px  ${cabe ? '' : '(ABAIXO DO PISO) '}altura ~${altura}px  →  ${linhas.map(l => `"${l}"`).join(' / ')}`);
  });
  // recomendação: o menor nº de linhas cujo tamanho fica a ≤ 20% do maior possível (e acima do piso)
  const maiorTam = Math.max(...linhasInfo.filter(l => l.cabe).map(l => l.tam), 0);
  const melhor = linhasInfo.find(l => l.cabe && l.tam >= maiorTam * 0.8) || null;
  if (!melhor) console.log(`\n⚠ Nenhuma quebra chega a ${min}px. Encurte a copy do hero (≤ 4 palavras) — não baixe o piso.`);
  else console.log(`\nRecomendado: ${melhor.k} linha${melhor.k > 1 ? 's' : ''} em ${melhor.tam}px, entrelinha ${Math.round(melhor.tam * ent)}px (baseline a baseline).`);
})().catch(e => { console.error('Erro:', e.message); process.exit(1); });
