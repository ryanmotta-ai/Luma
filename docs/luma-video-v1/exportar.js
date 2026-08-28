#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════════════
   EXPORTA O DECK — apresentacao.html → PDF (1920×1080) + um PNG por slide.
   --------------------------------------------------------------------------------------
   Uso:  node docs/luma-video-v1/exportar.js
         CHROMIUM_PATH=/caminho/chrome node docs/luma-video-v1/exportar.js

   ⛔ ZERO DEPENDÊNCIA, como manda a 1ª lei. O script equivalente do deck anterior
   (docs/luma-evolution/scripts/publicar.js) usa Playwright, que não está instalado e
   traria um node_modules inteiro para imprimir 25 páginas. Aqui é CDP no osso, com o
   WebSocket nativo do Node — mesmo padrão de scripts/run-browser-tests.js.

   POR QUE O PDF SAI CERTO: o @media print do deck tira o quadro de escala da frente e
   devolve o slide ao tamanho real, com page-break-after. printToPDF já renderiza em
   mídia `print`, então uma página = um slide, sem ajuste manual.
   ══════════════════════════════════════════════════════════════════════════════════════ */

const { spawn, execSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');

const RAIZ = path.resolve(__dirname, '..', '..');
const FONTE = path.join(__dirname, 'apresentacao.html');
const PDF = path.join(__dirname, 'apresentacao.pdf');
const PNGS = path.join(__dirname, 'png');

function acharChromium() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  const raizPw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const cands = [];
  try {
    for (const d of fs.readdirSync(raizPw)) {
      if (!/^chromium/.test(d)) continue;
      cands.push(path.join(raizPw, d, 'chrome-linux', 'chrome'), path.join(raizPw, d));
    }
  } catch (e) { /* sem Playwright na máquina: segue para o PATH */ }
  for (const n of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'])
    { try { cands.push(execSync('command -v ' + n, { encoding: 'utf8' }).trim()); } catch (e) {} }
  for (const c of cands) { try { if (c && fs.existsSync(c) && fs.statSync(c).isFile()) return c; } catch (e) {} }
  return null;
}

const esperar = ms => new Promise(r => setTimeout(r, ms));
const getJson = (porta, rota) => new Promise((ok, erro) => {
  const q = http.get({ host: '127.0.0.1', port: porta, path: rota }, r => {
    let b = ''; r.on('data', d => b += d); r.on('end', () => { try { ok(JSON.parse(b)); } catch (e) { erro(e); } });
  }); q.on('error', erro);
});

(async () => {
  const bin = acharChromium();
  if (!bin) { console.error('Nenhum Chromium encontrado. Passe CHROMIUM_PATH=/caminho/chrome'); process.exit(1); }
  console.log('Chromium: ' + bin);

  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'luma-deck-'));
  const proc = spawn(bin, ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--hide-scrollbars', '--force-device-scale-factor=1', '--remote-allow-origins=*',
    '--remote-debugging-port=0', '--user-data-dir=' + perfil, 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore'] });

  const arq = path.join(perfil, 'DevToolsActivePort');
  let porta = 0;
  for (let i = 0; i < 150 && !porta; i++) {
    if (fs.existsSync(arq)) { const p = Number(String(fs.readFileSync(arq, 'utf8')).split('\n')[0]); if (p > 0) porta = p; }
    if (!porta) await esperar(100);
  }
  if (!porta) { console.error('o Chromium não subiu'); process.exit(1); }

  let alvo;
  for (let i = 0; i < 60 && !alvo; i++) {
    try { alvo = (await getJson(porta, '/json/list')).find(t => t.type === 'page' && t.webSocketDebuggerUrl); } catch (e) {}
    if (!alvo) await esperar(100);
  }
  const ws = new WebSocket(String(alvo.webSocketDebuggerUrl).replace('://localhost:', '://127.0.0.1:'));
  const pend = new Map(); let id = 0;
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data); const p = pend.get(m.id);
    if (p) { pend.delete(m.id); p(m.result || m.error); }
  });
  const cdp = (met, par) => new Promise(ok => { const meu = ++id; pend.set(meu, ok); ws.send(JSON.stringify({ id: meu, method: met, params: par || {} })); });
  const js = async e => { const r = await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r && r.result ? r.result.value : null; };

  await cdp('Runtime.enable'); await cdp('Page.enable');
  // 2010px: o quadro fica em escala ~1, então o PNG sai na resolução do palco.
  await cdp('Emulation.setDeviceMetricsOverride', { width: 2010, height: 1200, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: 'file://' + FONTE });
  for (let i = 0; i < 100; i++) { await esperar(200); if (await js('document.readyState') === 'complete') break; }
  await js('document.fonts.ready');           // sem isto o PNG sai com fonte de sistema
  await esperar(700);

  const n = await js('document.querySelectorAll(".quadro").length');
  console.log('slides: ' + n);

  /* ── PNG por slide ── */
  fs.mkdirSync(PNGS, { recursive: true });
  for (const f of fs.readdirSync(PNGS)) if (/^slide-\d+\.png$/.test(f)) fs.unlinkSync(path.join(PNGS, f));
  for (let k = 0; k < n; k++) {
    const cx = await js(`(()=>{const r=document.querySelectorAll('.quadro')[${k}].getBoundingClientRect();
      return JSON.stringify({x:Math.round(r.left+scrollX),y:Math.round(r.top+scrollY),width:Math.round(r.width),height:Math.round(r.height)})})()`);
    const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: Object.assign({ scale: 1 }, JSON.parse(cx)) });
    if (shot && shot.data) fs.writeFileSync(path.join(PNGS, `slide-${String(k + 1).padStart(2, '0')}.png`), Buffer.from(shot.data, 'base64'));
  }
  console.log('PNG: ' + path.relative(RAIZ, PNGS) + '/slide-01..' + String(n).padStart(2, '0') + '.png');

  /* ── PDF ──
     preferCSSPageSize honra o @page size:1920px 1080px do deck; printBackground é
     obrigatório (sem ele os slides escuros saem brancos). */
  const pdf = await cdp('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    paperWidth: 1920 / 96, paperHeight: 1080 / 96
  });
  if (pdf && pdf.data) {
    fs.writeFileSync(PDF, Buffer.from(pdf.data, 'base64'));
    console.log('PDF: ' + path.relative(RAIZ, PDF) + ' · ' + Math.round(fs.statSync(PDF).size / 1024) + 'KB');
  } else {
    console.error('printToPDF não devolveu dados: ' + JSON.stringify(pdf).slice(0, 200));
  }

  try { proc.kill('SIGKILL'); } catch (e) {}
  process.exit(0);
})();
