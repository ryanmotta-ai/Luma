#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════════════════
   CATÁLOGO DAS COMPOSIÇÕES do Luma Creative (frente 4) — gerado, nunca escrito à mão.
   ------------------------------------------------------------------------------------------
   Abre tests/_galeria-composicoes.html?catalogo=1 no Chromium (o mesmo CDP do runner de testes,
   zero dependência) e escreve:
     · docs/CATALOGO-COMPOSICOES.md — nome, uso, formato, objetivos, assets e miniatura de cada uma;
     · docs/catalogo/<id>.jpg       — a miniatura (o 1º pedido da composição, texto médio, DM);
     · tests/creative-golden.js     — as linhas de golden das composições NOVAS (as que já estão lá
                                      não mudam, a não ser com --golden=id1,id2: mudança consciente).
   E confere os clones: dentro do formato, duas composições com plantas quase iguais (crDistPlanta
   < 0,15) no mesmo pedido são a mesma peça — o script avisa e sai com código 1.

   Uso:  node scripts/catalogo-composicoes.js
         node scripts/catalogo-composicoes.js --golden=pratoDoDiaLado,faixaPreco
   ══════════════════════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { acharChromium, subirNavegador, conectar, getJson, esperar } = require('./run-browser-tests.js');

const RAIZ = path.resolve(__dirname, '..');
const LIMITE_CLONE = 0.15;
const GRUPOS = { A: 'Prato e oferta do dia', B: 'Horário e ocasião', C: 'Cupom e entrada', D: 'Parceiros',
  E: 'Datas e cidade', F: 'Operação e aviso', G: 'Prospecção e comunidade' };

async function lerCatalogo() {
  const bin = acharChromium();
  if (!bin) throw new Error('Chromium não encontrado (aponte CHROMIUM_PATH=/caminho/chrome).');
  const nav = await subirNavegador(bin);
  try {
    let alvo;
    for (let i = 0; i < 50 && !alvo; i++) {
      try { alvo = ((await getJson(nav.porta, '/json/list')) || []).find(t => t.type === 'page' && t.webSocketDebuggerUrl); } catch (e) { /* subindo */ }
      if (!alvo) await esperar(100);
    }
    if (!alvo) throw new Error('nenhuma aba disponível no CDP');
    const cdp = await conectar(String(alvo.webSocketDebuggerUrl).replace('://localhost:', '://127.0.0.1:'));
    await cdp.enviar('Runtime.enable');
    await cdp.enviar('Page.navigate', { url: 'file://' + path.join(RAIZ, 'tests', '_galeria-composicoes.html') + '?catalogo=1' });
    const inicio = Date.now();
    while (Date.now() - inicio < 15 * 60 * 1000) {
      await esperar(500);
      let r;
      try { r = await cdp.enviar('Runtime.evaluate', { expression: 'window.__catalogo ? JSON.stringify(window.__catalogo) : ""', returnByValue: true }); }
      catch (e) { continue; }
      const v = r && r.result && r.result.value;
      if (v) { cdp.fechar(); return JSON.parse(v); }
    }
    throw new Error('a galeria não publicou window.__catalogo em 15 min');
  } finally {
    try { nav.proc.kill('SIGKILL'); } catch (e) { /* já morreu */ }
    try { fs.rmSync(nav.perfil, { recursive: true, force: true }); } catch (e) { /* tmp */ }
  }
}

function escreveGolden(comps, regravar) {
  const arq = path.join(RAIZ, 'tests', 'creative-golden.js'), txt = fs.readFileSync(arq, 'utf8');
  const [antes, resto] = txt.split('// <golden>\n'), [miolo, depois] = resto.split('// </golden>');
  const linhas = miolo.split('\n').filter(l => l.trim().startsWith('{'));
  const tem = new Set(linhas.map(l => (/"receita":"([^"]+)"/.exec(l) || [])[1]));
  const fica = linhas.filter(l => regravar.indexOf((/"receita":"([^"]+)"/.exec(l) || [])[1]) < 0);
  let novas = 0;
  comps.forEach(c => {
    if (tem.has(c.id) && regravar.indexOf(c.id) < 0) return;
    c.golden.forEach(g => { fica.push('  ' + JSON.stringify(g) + ','); novas++; });
  });
  fs.writeFileSync(arq, antes + '// <golden>\n' + fica.join('\n') + (fica.length ? '\n' : '') + '// </golden>' + depois);
  return novas;
}

function escreveCatalogo(cat) {
  const dir = path.join(RAIZ, 'docs', 'catalogo');
  fs.mkdirSync(dir, { recursive: true });
  cat.comps.forEach(c => { if (c.jpeg) fs.writeFileSync(path.join(dir, c.id + '.jpg'), Buffer.from(c.jpeg.split(',')[1], 'base64')); });
  const porFormato = {};
  cat.comps.forEach(c => { porFormato[c.formato] = (porFormato[c.formato] || 0) + 1; });
  const minFormato = {};
  cat.clones.forEach(k => { if (!(k.formato in minFormato) || k.d < minFormato[k.formato].d) minFormato[k.formato] = k; });
  const cel = s => String(s).replace(/\|/g, '\\|');
  let md = '# Catálogo das composições do Luma Creative\n\n'
    + '> Gerado por `node scripts/catalogo-composicoes.js` a partir de `js/creative/composicoes.js` — **não edite à mão**.\n'
    + '> Miniatura: o 1º pedido do banco de cada composição (texto médio, Delivery Much), montado pela busca do próprio motor.\n'
    + '> Galeria completa (todas as variações do banco, com a nota): `tests/_galeria-composicoes.html`.\n\n'
    + '**' + cat.comps.length + ' composições** · ' + Object.entries(porFormato).map(([f, n]) => f + ' ' + n).join(' · ') + '\n\n'
    + 'Clones (menor distância de planta entre duas composições do mesmo formato, no mesmo pedido; limite ' + String(LIMITE_CLONE).replace('.', ',') + '): '
    + (Object.values(minFormato).map(k => k.formato + ' ' + String(k.d).replace('.', ',') + ' (' + k.a + ' × ' + k.b + ')').join(' · ') || '—') + '\n';
  Object.keys(GRUPOS).forEach(g => {
    const cs = cat.comps.filter(c => c.grupo === g);
    if (!cs.length) return;
    md += '\n## ' + g + ' · ' + GRUPOS[g] + '\n\n| Miniatura | Composição | Uso | Formato | Objetivos | Assets |\n|---|---|---|---|---|---|\n';
    cs.forEach(c => {
      const assets = (c.foto === true ? ['foto do franqueado'] : c.foto === null ? ['foto (opcional)'] : []).concat(c.assets);
      md += '| <img src="catalogo/' + c.id + '.jpg" width="110" alt=""> | **' + cel(c.nome) + '**<br>`' + c.id + '` | ' + cel(c.uso) + ' | ' + c.formato
        + ' | ' + c.objetivos.join(', ') + ' | ' + (assets.map(a => '`' + cel(a) + '`').join(' ') || '—') + ' |\n';
    });
  });
  fs.writeFileSync(path.join(RAIZ, 'docs', 'CATALOGO-COMPOSICOES.md'), md);
}

(async function () {
  const arg = process.argv.find(a => a.startsWith('--golden='));
  const regravar = arg ? arg.slice(9).split(',').filter(Boolean) : [];
  const cat = await lerCatalogo();
  escreveCatalogo(cat);
  const novas = escreveGolden(cat.comps, regravar);
  console.log(cat.comps.length + ' composições no catálogo · ' + novas + ' linha(s) de golden escritas');
  const clones = cat.clones.filter(k => k.d < LIMITE_CLONE);
  cat.clones.slice(0, 5).forEach(k => console.log('  planta ' + k.d.toFixed(2) + '  ' + k.a + ' × ' + k.b + ' (' + k.formato + ', ' + k.caso + ')'));
  if (clones.length) {
    console.log('\nCLONES (planta < ' + LIMITE_CLONE + '):');
    clones.forEach(k => console.log('  ' + k.a + ' × ' + k.b + ' — ' + k.d + ' em ' + k.caso));
    process.exit(1);
  }
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
