#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════════════════
   RUNNER DE REGRESSÃO — as suítes de `tests/` num navegador de verdade, no terminal e no CI.
   ------------------------------------------------------------------------------------------
   Por que existe: as suítes do Luma são HTML que rodam no motor real (Canvas 2D, métricas de
   fonte, `document.fonts`) — é o único jeito honesto de testar um projeto sem build. Abrir sete
   abas na mão antes de cada commit não escala, e "abri e passou" não é auditável.

   ⛔ ZERO DEPENDÊNCIA NOVA, como manda a 1ª lei. O runner fala CDP (DevTools Protocol) direto,
   usando o WebSocket nativo do Node 22 e o Chromium que já existe na máquina/no runner. Nada de
   Playwright, Puppeteer ou Karma — eles trariam um `node_modules` inteiro para rodar 4 páginas.

   Uso:
     node scripts/run-browser-tests.js                # roda todas as suítes de tests/*.html
     node scripts/run-browser-tests.js auto-layout    # roda só as que casam com o filtro
     CHROMIUM_PATH=/caminho/chrome node scripts/run-browser-tests.js

   Saída: uma linha por suíte + o detalhe de cada caso que falhou. Código de saída 1 em qualquer
   falha — é o que o workflow do GitHub usa como portão.
   ══════════════════════════════════════════════════════════════════════════════════════════ */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const RAIZ = path.resolve(__dirname, '..');
const TIMEOUT_MS = Number(process.env.LUMA_TEST_TIMEOUT || 120000);

/* ── 1. Achar o Chromium ────────────────────────────────────────────────────────────────── */
function acharChromium() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  // O ambiente de sessão remota do Claude Code já traz o Chromium do Playwright pré-instalado.
  const raizPw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const candidatos = [];
  try {
    for (const dir of fs.readdirSync(raizPw)) {
      if (!/^chromium/.test(dir)) continue;
      candidatos.push(path.join(raizPw, dir, 'chrome-linux', 'chrome'));
      candidatos.push(path.join(raizPw, dir, 'chrome-linux', 'headless_shell'));
      candidatos.push(path.join(raizPw, dir));
    }
  } catch (e) { /* sem diretório do Playwright: segue para o PATH */ }
  for (const nome of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try { candidatos.push(execSync('command -v ' + nome, { encoding: 'utf8' }).trim()); } catch (e) { /* não instalado */ }
  }
  for (const c of candidatos) {
    try { if (c && fs.existsSync(c) && fs.statSync(c).isFile()) return c; } catch (e) { /* ignora */ }
  }
  return null;
}

/* ── 2. Subir o navegador e descobrir a porta do CDP ────────────────────────────────────── */
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

async function subirNavegador(bin) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'luma-cdp-'));
  const proc = spawn(bin, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--disable-extensions',
    '--force-device-scale-factor=1', '--window-size=1280,900',
    /* O WebSocket nativo do Node manda `Origin`, e o endpoint de depuração do Chrome recusa
       handshake com origem (proteção contra página web falar com o próprio DevTools). Sem esta
       flag a conexão morre em 403 — e a mensagem não diz o motivo. */
    '--remote-allow-origins=*',
    '--remote-debugging-port=0', '--user-data-dir=' + perfil, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let erro = '';
  proc.stderr.on('data', d => { erro += String(d); });

  const arquivoPorta = path.join(perfil, 'DevToolsActivePort');
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(arquivoPorta)) {
      const porta = Number(String(fs.readFileSync(arquivoPorta, 'utf8')).split('\n')[0]);
      if (porta > 0) return { proc, porta, perfil };
    }
    if (proc.exitCode != null) break;
    await esperar(100);
  }
  try { proc.kill('SIGKILL'); } catch (e) { /* já morreu */ }
  throw new Error('o Chromium não abriu a porta de depuração.\n' + erro.split('\n').slice(0, 6).join('\n'));
}

/* ── 3. Cliente CDP mínimo (WebSocket nativo do Node) ───────────────────────────────────── */
function conectar(url) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket !== 'function') { reject(new Error('Node sem WebSocket nativo — precisa de Node 22+')); return; }
    const ws = new WebSocket(url);
    const pendentes = new Map();
    let id = 0;
    ws.addEventListener('open', () => resolve({
      enviar(metodo, params) {
        return new Promise((ok, falhou) => {
          const meu = ++id;
          pendentes.set(meu, { ok, falhou });
          ws.send(JSON.stringify({ id: meu, method: metodo, params: params || {} }));
        });
      },
      fechar() { try { ws.close(); } catch (e) { /* já fechado */ } }
    }));
    ws.addEventListener('error', () => reject(new Error('falha ao conectar no CDP')));
    ws.addEventListener('message', ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      const p = msg.id != null && pendentes.get(msg.id);
      if (!p) return;
      pendentes.delete(msg.id);
      if (msg.error) p.falhou(new Error(msg.error.message || 'erro do CDP'));
      else p.ok(msg.result);
    });
  });
}

/* ── 4. Rodar uma suíte ─────────────────────────────────────────────────────────────────── */
async function rodarSuite(cdp, arquivo) {
  /* Modo gravação do corpus: `LUMA_RECORD=1 node scripts/run-browser-tests.js corpus` regrava
     `tests/corpus-golden.js` com a geometria e a assinatura visual DESTA máquina. Existe porque
     o golden é ancorado na pilha de fontes — ver o cabeçalho de `tests/corpus-cases.js`. */
  const url = 'file://' + arquivo + (process.env.LUMA_RECORD ? '?record=1' : '');
  await cdp.enviar('Page.navigate', { url });
  const inicio = Date.now();
  /* A suíte é assíncrona (mede fonte real, renderiza canvas). O contrato é `window.__lumaTest`,
     publicado pelo próprio caso quando termina — esperar `load` pegaria a página no meio. */
  while (Date.now() - inicio < TIMEOUT_MS) {
    await esperar(250);
    let r;
    try {
      r = await cdp.enviar('Runtime.evaluate', {
        expression: 'window.__lumaTest ? JSON.stringify(window.__lumaTest) : ""',
        returnByValue: true, awaitPromise: false
      });
    } catch (e) { continue; }                       // navegação em curso: tenta de novo
    const bruto = r && r.result && r.result.value;
    if (bruto) {
      let parsed; try { parsed = JSON.parse(bruto); } catch (e) { continue; }
      if (process.env.LUMA_RECORD) {
        const g = await cdp.enviar('Runtime.evaluate', {
          expression: 'window.__lumaGolden || ""', returnByValue: true });
        const texto = g && g.result && g.result.value;
        if (texto) {
          const destino = path.join(RAIZ, 'tests', 'corpus-golden.js');
          const cabecalho = fs.readFileSync(destino, 'utf8').split('window.LUMA_CORPUS_GOLDEN')[0];
          fs.writeFileSync(destino, cabecalho + texto + '\n');
          console.log('  golden regravado em tests/corpus-golden.js');
        }
      }
      return parsed;
    }
  }
  throw new Error('a suíte não publicou `window.__lumaTest` em ' + Math.round(TIMEOUT_MS / 1000) + 's');
}

/* ── 5. Principal ───────────────────────────────────────────────────────────────────────── */
(async function () {
  const filtro = process.argv[2] || '';
  const suites = fs.readdirSync(path.join(RAIZ, 'tests'))
    .filter(f => f.endsWith('.html'))
    /* Suíte com `_` no começo é INSTRUMENTO, não portão: mede o motor em massa e nunca reprova.
       Fica fora da rodada padrão (e do CI) e só roda quando alguém a chama pelo nome —
       `node scripts/run-browser-tests.js _bancada`. */
    .filter(f => filtro ? f.includes(filtro) : !f.startsWith('_'))
    .sort()
    .map(f => path.join(RAIZ, 'tests', f));

  if (!suites.length) { console.error('Nenhuma suíte em tests/' + (filtro ? ' com o filtro "' + filtro + '"' : '')); process.exit(1); }

  const bin = acharChromium();
  if (!bin) {
    console.error('Chromium não encontrado. Instale um (ou aponte CHROMIUM_PATH=/caminho/chrome).');
    process.exit(1);
  }

  const nav = await subirNavegador(bin);
  let alvo;
  for (let i = 0; i < 50 && !alvo; i++) {
    try {
      const lista = await getJson(nav.porta, '/json/list');
      alvo = (lista || []).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch (e) { /* ainda subindo */ }
    if (!alvo) await esperar(100);
  }
  if (!alvo) { try { nav.proc.kill('SIGKILL'); } catch (e) {} console.error('nenhuma aba disponível no CDP'); process.exit(1); }

  /* O Chrome ecoa no `webSocketDebuggerUrl` o mesmo host que recebeu. Se vier `localhost`, o
     Node resolve para ::1 — onde o navegador NÃO escuta — e a conexão morre num erro genérico
     de socket que parece falha de CDP. Fixar em 127.0.0.1 tira essa armadilha do caminho. */
  const wsUrl = String(alvo.webSocketDebuggerUrl).replace('://localhost:', '://127.0.0.1:');
  const cdp = await conectar(wsUrl);
  /* ORÇAMENTO DE DESEMPENHO EM CELULAR FRACO. `LUMA_CPU_THROTTLE=4` faz o navegador executar 4×
     mais devagar — é a régua honesta para o p95 do solver na mão de quem usa o Luma no 4G, e
     não na máquina de quem escreve o código. */
  const freio = Number(process.env.LUMA_CPU_THROTTLE || 0);
  if (freio > 1) {
    try { await cdp.enviar('Emulation.setCPUThrottlingRate', { rate: freio }); console.log('CPU freada em ' + freio + '×\n'); }
    catch (e) { console.log('(não consegui frear a CPU: ' + e.message + ')\n'); }
  }
  let falhasTotais = 0, casosTotais = 0;
  const perf = [];

  console.log('Chromium: ' + bin + '\n');
  for (const suite of suites) {
    const nome = path.basename(suite, '.html');
    let r;
    try { r = await rodarSuite(cdp, suite); }
    catch (e) { console.log('✕ ' + nome + ' — ' + e.message); falhasTotais++; continue; }
    casosTotais += r.total || 0;
    const falhas = (r.failures || []);
    falhasTotais += falhas.length;
    const marca = falhas.length ? '✕' : '✓';
    console.log(marca + ' ' + nome + ' — ' + (r.passed || 0) + '/' + (r.total || 0) + ' casos'
      + (r.perf ? ' · solver p50 ' + r.perf.p50 + 'ms / p95 ' + r.perf.p95 + 'ms' : ''));
    falhas.forEach(f => console.log('    · ' + f.name + ': ' + f.error));
    if (r.resumo) console.log('    vereditos: ' + JSON.stringify(r.resumo.contagem)
      + ' · pior solve ' + r.resumo.piorMs + 'ms'
      + (r.resumo.semDiagnostico ? ' · ' + r.resumo.semDiagnostico + ' bloqueios sem diagnóstico' : ''));
    // LUMA_VERBOSE=1 imprime todas as notas (o corpus emite uma por cenário; a bancada, dezenas).
    if (r.notas && r.notas.length) r.notas.slice(0, process.env.LUMA_VERBOSE ? 500 : 6)
      .forEach(n => console.log('    nota: ' + n));
    if (r.perf && r.perf.n) perf.push({ nome, ...r.perf });
  }

  if (perf.length) {
    console.log('\nOrçamento de desempenho (solver do Auto-layout):');
    perf.forEach(p => console.log('  ' + p.nome + ': n=' + p.n + ' p50=' + p.p50 + 'ms p95=' + p.p95 + 'ms max=' + p.max + 'ms'));
  }

  cdp.fechar();
  try { nav.proc.kill('SIGKILL'); } catch (e) { /* já morreu */ }
  try { fs.rmSync(nav.perfil, { recursive: true, force: true }); } catch (e) { /* tmp some sozinho */ }

  console.log('\n' + (falhasTotais ? 'FALHOU — ' + falhasTotais + ' problema(s)' : 'OK — ' + casosTotais + ' casos verdes'));
  process.exit(falhasTotais ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
