#!/usr/bin/env node
/**
 * scripts/mapa.js
 *
 * Gera o corpo de `luma-brain/MAPA.md` — o mapa do código do Luma.
 *
 * Existe por um motivo só: mapa escrito à mão envelhece e passa a mentir. O §4 do
 * `docs/LUMA.md` ("estrutura real de arquivos, verificada em 2026-07-09") listava 44
 * arquivos JS quando o código já tinha 67 — 23 arquivos invisíveis para quem lê o doc.
 * Aqui o propósito de cada arquivo sai do PRÓPRIO cabeçalho do arquivo, então o mapa
 * só pode estar errado se o cabeçalho estiver errado.
 *
 * Não é build: nada disso roda no navegador, nada entra no `index.html`. É ferramenta
 * de repositório, como `scripts/versao.js` — zero dependência, Node puro.
 *
 * Uso:
 *   node scripts/mapa.js              # regenera sempre
 *   node scripts/mapa.js --se-mudou   # só regenera se js/ css/ index.html mudaram depois do mapa
 *
 * O script reescreve APENAS o trecho entre as marcas AUTO-INICIO/AUTO-FIM do MAPA.md.
 * O cabeçalho semântico (a tabela "quero mexer em X → vai no arquivo Y") é escrito à
 * mão e sobrevive intacto a toda regeneração.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const MAPA = path.join(RAIZ, 'luma-brain', 'MAPA.md');
const INICIO = '<!-- AUTO-INICIO: gerado por scripts/mapa.js — nao edite a mao -->';
const FIM = '<!-- AUTO-FIM -->';

// ── coleta ───────────────────────────────────────────────────────────────────
function listar(dir, ext) {
  const saida = [];
  (function anda(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.endsWith(ext)) saida.push(path.relative(RAIZ, p).split(path.sep).join('/'));
    }
  })(path.join(RAIZ, dir));
  return saida.sort();
}

/** Propósito e dependências, tirados do comentário de cabeçalho do arquivo. */
function cabecalho(txt, rel) {
  const m = txt.match(/^\s*\/\*[\s\S]*?\*\//);
  if (!m) return { proposito: '', depende: '' };
  const linhas = m[0]
    .replace(/^\s*\/\*+/, '').replace(/\*+\/\s*$/, '')
    .split('\n')
    .map(l => l.replace(/^\s*\*+ ?/, '').trim())
    .filter(Boolean)
    // Linha de separador decorativa (═══, ---, ***) nao e prosa.
    .filter(l => l !== rel && !/^[─═\-=*·_~]{4,}$/.test(l));

  let depende = '';
  const prosa = [];
  for (const l of linhas) {
    const d = l.match(/^(?:Depende de|Dependências?|Requer)\s*:\s*(.+)$/i);
    if (d) { if (!depende) depende = d[1].trim(); continue; }
    if (/^(Uso|Ver também|Nota)\s*:/i.test(l)) continue;
    prosa.push(l);
  }

  // Primeira frase da prosa: é a linha que o autor escreveu para dizer o que o arquivo é.
  let p = prosa.join(' ').replace(/\s+/g, ' ').trim();
  // Varios cabecalhos abrem com "js/x/y.js — Titulo": o caminho ja e o titulo do bloco.
  p = p.replace(new RegExp('^' + rel.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\s*[—\\-–:]\\s*'), '');
  const ponto = p.search(/[.:] /);
  if (ponto > 60) p = p.slice(0, ponto + 1);
  if (p.length > 230) p = p.slice(0, 227).replace(/[\s,;]+\S*$/, '') + '…';
  return { proposito: p, depende };
}

/** Funções globais e estado compartilhado: só o que é declarado na coluna 0. */
function api(txt) {
  const fns = [];
  const estado = [];
  for (const l of txt.split('\n')) {
    let m = l.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
    if (m) { fns.push(m[1]); continue; }
    m = l.match(/^let\s+(.+)$/);
    if (m) {
      // Separa `let a=1, b=2` em dois nomes SEM cair dentro de `let fState={a:1,b:2}`:
      // virgula só conta na profundidade zero.
      let prof = 0, atual = '';
      const partes = [];
      for (const ch of m[1]) {
        if ('{[('.includes(ch)) prof++;
        else if ('}])'.includes(ch)) prof--;
        if (ch === ',' && prof === 0) { partes.push(atual); atual = ''; continue; }
        atual += ch;
      }
      partes.push(atual);
      for (const parte of partes) {
        const n = parte.trim().match(/^([A-Za-z_$][\w$]{1,})/); // nome de 1 letra é ruído
        if (n) estado.push(n[1]);
      }
    }
  }
  return { fns, estado };
}

/** A ordem dos <script> no index.html É a arquitetura (1ª lei: sem build, sem ESM). */
function ordemDeCarga() {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  return [...html.matchAll(/<script\s+src="([^"?]+)/g)].map(m => m[1]);
}

// ── render ───────────────────────────────────────────────────────────────────
function blocoJs(rel) {
  const txt = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const n = txt.split('\n').length;
  const { proposito, depende } = cabecalho(txt, rel);
  const { fns, estado } = api(txt);

  const out = [`**\`${rel}\`** · ${n} linhas`];
  if (proposito) out.push(proposito);
  const publicas = fns.filter(f => !f.startsWith('_'));
  if (publicas.length) {
    const mostra = publicas.slice(0, 14).join(', ');
    const resto = publicas.length - 14;
    out.push(`· API: ${mostra}${resto > 0 ? ` … (+${resto}; ${fns.length} funções no total)` : ''}`);
  }
  if (estado.length) out.push(`· Estado global: ${estado.slice(0, 10).join(', ')}${estado.length > 10 ? ` (+${estado.length - 10})` : ''}`);
  if (depende) out.push(`· Depende de: ${depende}`);
  return out.join('\n');
}

function gerar() {
  const js = listar('js', '.js');
  const css = listar('css', '.css');
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const ordem = ordemDeCarga();
  const totalJs = js.reduce((a, f) => a + fs.readFileSync(path.join(RAIZ, f), 'utf8').split('\n').length, 0);
  const totalCss = css.reduce((a, f) => a + fs.readFileSync(path.join(RAIZ, f), 'utf8').split('\n').length, 0);
  const totalFns = js.reduce((a, f) => a + api(fs.readFileSync(path.join(RAIZ, f), 'utf8')).fns.length, 0);

  const L = [];
  L.push(INICIO);
  L.push('');
  L.push(`> Gerado por \`node scripts/mapa.js\` a partir dos cabeçalhos dos próprios arquivos.`);
  L.push(`> **Não edite este trecho à mão** — a próxima regeneração sobrescreve.`);
  L.push('');
  L.push(`**Tamanho real de hoje:** ${js.length} arquivos JS (${totalJs.toLocaleString('pt-BR')} linhas, ${totalFns.toLocaleString('pt-BR')} funções) · ${css.length} arquivos CSS (${totalCss.toLocaleString('pt-BR')} linhas) · \`index.html\` com ${html.split('\n').length.toLocaleString('pt-BR')} linhas e ${ordem.length} \`<script>\`.`);
  L.push('');

  // JS por pasta
  const pastas = new Map();
  for (const f of js) {
    const p = f.split('/').length > 2 ? f.split('/').slice(0, 2).join('/') : 'js (raiz)';
    if (!pastas.has(p)) pastas.set(p, []);
    pastas.get(p).push(f);
  }
  const ordemPastas = ['js (raiz)', 'js/core', 'js/franqueado', 'js/designer', 'js/academia', 'js/tutorial', 'js/widgets'];
  const chaves = [...pastas.keys()].sort((a, b) => {
    const ia = ordemPastas.indexOf(a), ib = ordemPastas.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  L.push('## JS — o que cada arquivo é');
  for (const p of chaves) {
    L.push('');
    L.push(`### ${p}`);
    for (const f of pastas.get(p)) { L.push(''); L.push(blocoJs(f)); }
  }

  // CSS
  L.push('');
  L.push('## CSS — onde mora cada folha');
  L.push('');
  L.push('| Arquivo | Linhas |');
  L.push('|---|---|');
  for (const f of css) {
    const n = fs.readFileSync(path.join(RAIZ, f), 'utf8').split('\n').length;
    L.push(`| \`${f}\` | ${n} |`);
  }

  // ordem de carga
  L.push('');
  L.push('## Ordem de carga do `index.html`');
  L.push('');
  L.push('A ordem **é** a arquitetura: sem ESM, um arquivo depende de o anterior já ter definido suas globais. Script novo entra na posição certa desta lista.');
  L.push('');
  L.push('```');
  ordem.forEach((s, i) => L.push(`${String(i + 1).padStart(2, ' ')}. ${s}`));
  L.push('```');
  L.push('');
  L.push(FIM);
  return L.join('\n');
}

// ── escrita ──────────────────────────────────────────────────────────────────
function maisRecente() {
  let t = 0;
  for (const alvo of ['js', 'css']) {
    (function anda(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) anda(p);
        else t = Math.max(t, fs.statSync(p).mtimeMs);
      }
    })(path.join(RAIZ, alvo));
  }
  t = Math.max(t, fs.statSync(path.join(RAIZ, 'index.html')).mtimeMs);
  return t;
}

const soSeMudou = process.argv.includes('--se-mudou');

function atualizar() {
  if (soSeMudou && fs.existsSync(MAPA) && fs.statSync(MAPA).mtimeMs >= maisRecente()) return null;
  const corpo = gerar();
  let doc = fs.existsSync(MAPA) ? fs.readFileSync(MAPA, 'utf8') : '';
  const i = doc.indexOf(INICIO);
  const j = doc.indexOf(FIM);
  if (i >= 0 && j > i) doc = doc.slice(0, i) + corpo + doc.slice(j + FIM.length);
  else doc = (doc ? doc.trimEnd() + '\n\n' : '') + corpo + '\n';
  fs.writeFileSync(MAPA, doc);
  return corpo.split('\n').length;
}

// Em `--se-mudou` este script roda dentro do hook de cada prompt. Ele NUNCA pode
// derrubar o prompt: qualquer falha aqui (arquivo sumiu, disco cheio) sai calada e
// o mapa fica um pouco velho — o que é infinitamente melhor que travar a sessão.
if (soSeMudou) {
  try { atualizar(); } catch (e) { /* silêncio de propósito */ }
  process.exit(0);
}
const n = atualizar();
console.log(n === null ? 'MAPA.md já estava em dia.' : `MAPA.md atualizado (${n} linhas geradas).`);
