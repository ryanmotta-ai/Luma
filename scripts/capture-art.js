#!/usr/bin/env node
/**
 * scripts/capture-art.js
 * 
 * Rasterizador de SVGs da skill luma-creative para PNG via Chrome DevTools Protocol (CDP).
 * Zero dependências externas (usa WebSocket nativo do Node 22 e Chromium/Edge local).
 * 
 * Uso:
 *   node scripts/capture-art.js <caminho-svg> [caminho-png-saida]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn, execSync } = require('child_process');

function acharChromium() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  const candidatos = [];
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const winCands = [
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(localAppData, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe')
    ];
    for (const p of winCands) {
      if (p && fs.existsSync(p)) candidatos.push(p);
    }
  } else {
    for (const nome of ['chromium', 'chromium-browser', 'google-chrome']) {
      try { candidatos.push(execSync('command -v ' + nome, { encoding: 'utf8' }).trim()); } catch (e) {}
    }
  }
  for (const c of candidatos) {
    try { if (c && fs.existsSync(c) && fs.statSync(c).isFile()) return c; } catch (e) {}
  }
  return null;
}

function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

function getJson(porta, rota) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: porta, path: rota }, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(4000, () => req.destroy(new Error('timeout')));
  });
}

async function subirNavegador(bin, w = 1080, h = 1350) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'luma-capture-'));
  const proc = spawn(bin, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--disable-extensions',
    '--force-device-scale-factor=1', `--window-size=${w + 50},${h + 100}`,
    '--remote-allow-origins=*', '--remote-debugging-port=0',
    '--user-data-dir=' + perfil, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let erro = '';
  proc.stderr.on('data', d => { erro += String(d); });

  const arquivoPorta = path.join(perfil, 'DevToolsActivePort');
  for (let i = 0; i < 60; i++) {
    const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(erro);
    if (m) return { proc, porta: Number(m[1]), perfil };
    if (fs.existsSync(arquivoPorta)) {
      try {
        const porta = Number(String(fs.readFileSync(arquivoPorta, 'utf8')).split('\n')[0]);
        if (porta > 0) return { proc, porta, perfil };
      } catch (e) {}
    }
    await esperar(100);
  }
  try { proc.kill('SIGKILL'); } catch (e) {}
  throw new Error('Chromium não abriu porta de depuração.');
}

function conectar(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pendentes = new Map();
    let id = 0;
    ws.addEventListener('open', () => resolve({
      enviar(metodo, params) {
        return new Promise((ok, falhou) => {
          const meu = ++id;
          const timer = setTimeout(() => {
            pendentes.delete(meu);
            falhou(new Error('CDP sem resposta: ' + metodo));
          }, 30000);
          pendentes.set(meu, { ok, falhou, timer });
          ws.send(JSON.stringify({ id: meu, method: metodo, params: params || {} }));
        });
      },
      fechar() { try { ws.close(); } catch (e) {} }
    }));
    ws.addEventListener('error', () => reject(new Error('falha na conexão')));
    ws.addEventListener('message', ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      const p = msg.id != null && pendentes.get(msg.id);
      if (!p) return;
      pendentes.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.falhou(new Error(msg.error.message || 'erro do CDP'));
      else p.ok(msg.result);
    });
  });
}

async function capturarArte(svgPath, outPngPath) {
  const bin = acharChromium();
  if (!bin) throw new Error('Navegador não encontrado.');

  const svgAbs = path.resolve(svgPath);
  if (!fs.existsSync(svgAbs)) throw new Error('SVG não encontrado: ' + svgAbs);

  const svgRaw = fs.readFileSync(svgAbs, 'utf8');
  let w = 1080, h = 1350;
  const vbMatch = /viewBox=["']\s*0\s+0\s+(\d+)\s+(\d+)\s*["']/.exec(svgRaw);
  if (vbMatch) {
    w = parseInt(vbMatch[1], 10);
    h = parseInt(vbMatch[2], 10);
  }

  const outPath = outPngPath ? path.resolve(outPngPath) : svgAbs.replace(/\.svg$/i, '.png');
  const nav = await subirNavegador(bin, w, h);

  try {
    let alvo;
    for (let i = 0; i < 50 && !alvo; i++) {
      try {
        const lista = await getJson(nav.porta, '/json/list');
        alvo = (lista || []).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      } catch (e) {}
      if (!alvo) await esperar(100);
    }
    if (!alvo) throw new Error('Nenhuma aba disponível no CDP.');

    const wsUrl = String(alvo.webSocketDebuggerUrl).replace('://localhost:', '://127.0.0.1:');
    const cdp = await conectar(wsUrl);

    // Configurar viewport exato do dispositivo
    await cdp.enviar('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 1,
      mobile: false
    });

    const tempHtml = path.join(nav.perfil, 'render.html');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>* { margin: 0; padding: 0; } html, body { width: ${w}px; height: ${h}px; overflow: hidden; background: #000; } img { width: ${w}px; height: ${h}px; display: block; }</style></head><body><img src="file:///${svgAbs.replace(/\\/g, '/')}" /></body></html>`;
    fs.writeFileSync(tempHtml, html);

    await cdp.enviar('Page.enable');
    await cdp.enviar('Page.navigate', { url: 'file:///' + tempHtml.replace(/\\/g, '/') });

    // Esperar fontes e renderização (600ms)
    await esperar(600);

    const ss = await cdp.enviar('Page.captureScreenshot', { 
      format: 'png',
      clip: { x: 0, y: 0, width: w, height: h, scale: 1 }
    });
    fs.writeFileSync(outPath, Buffer.from(ss.data, 'base64'));

    cdp.fechar();
    console.log(`Print capturado com sucesso: ${outPath} (${fs.statSync(outPath).size} bytes)`);
    return outPath;
  } finally {
    try { nav.proc.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(nav.perfil, { recursive: true, force: true }); } catch (e) {}
  }
}

/**
 * Abre um HTML no navegador headless e devolve o resultado (JSON) de uma expressão JS avaliada na página.
 * Usado por lint-art.js e medir-texto.js. `expr` pode usar await (ex.: document.fonts.ready).
 */
async function avaliarNaPagina(html, w, h, expr) {
  const bin = acharChromium();
  if (!bin) throw new Error('Navegador não encontrado.');
  const nav = await subirNavegador(bin, w, h);
  try {
    let alvo;
    for (let i = 0; i < 50 && !alvo; i++) {
      try {
        const lista = await getJson(nav.porta, '/json/list');
        alvo = (lista || []).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      } catch (e) {}
      if (!alvo) await esperar(100);
    }
    if (!alvo) throw new Error('Nenhuma aba disponível no CDP.');
    const cdp = await conectar(String(alvo.webSocketDebuggerUrl).replace('://localhost:', '://127.0.0.1:'));
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    const tmp = path.join(nav.perfil, 'avaliar.html');
    fs.writeFileSync(tmp, html);
    await cdp.enviar('Page.enable');
    await cdp.enviar('Page.navigate', { url: 'file:///' + tmp.replace(/\\/g, '/') });
    await esperar(500);
    const r = await cdp.enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    cdp.fechar();
    if (r.exceptionDetails) throw new Error('Erro na página: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  } finally {
    try { nav.proc.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(nav.perfil, { recursive: true, force: true }); } catch (e) {}
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.log('Uso: node scripts/capture-art.js <caminho-svg> [caminho-png-saida]');
    process.exit(1);
  }
  capturarArte(args[0], args[1]).catch(err => {
    console.error('Erro na captura:', err.message);
    process.exit(1);
  });
}

module.exports = { capturarArte, avaliarNaPagina };
