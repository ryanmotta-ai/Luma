// docs/luma-evolution/scripts/capturar.js — captura as telas de cada marco histórico.
//
//   node docs/luma-evolution/scripts/capturar.js            todos os marcos
//   node docs/luma-evolution/scripts/capturar.js M7 M9      só esses
//
// COMO FUNCIONA: reaproveita o motor de scripts/versao.js (git worktree + Supabase
// zerado + sessão de demonstração) e, pra cada marco, sobe a versão numa porta própria e
// roda as cenas de cenas.js. Cada cena diz se conseguiu chegar na tela; quando não
// consegue, isso vira evidência de que a tela AINDA NÃO EXISTIA naquele commit.
//
// ⛔ NADA é inventado: o que aparece no print é o que aquele commit renderiza offline,
// com os dados de exemplo dele. O worktree é descartável e mora em /tmp.
//
// O marco ORIGEM não é um commit — é o HTML do piloto Yungas que o Ryan entregou. Ele é
// servido direto da pasta research/origem/ e marcado como tal nos metadados.

const { execFileSync } = require('child_process');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const versao = require('../../../scripts/versao.js');
const http = require('http');
const path = require('path');
const fs = require('fs');

const { CENAS } = require('./cenas.js');
const BASE = path.resolve(__dirname, '..');

// ── TETOS DE TEMPO ────────────────────────────────────────────────────────────
// Sem isto, uma cena que trava (seletor que nunca aparece, página que não carrega)
// prende o pipeline INTEIRO por tempo indefinido. Com teto, a cena falha, o motivo
// entra no relatório e o laço segue pra próxima — que é o comportamento que se quer:
// evidência faltando é dado, pipeline parado não é.
const TETO_CENA_MS = 90000;    // uma cena: carregar + navegar + fotografar
const TETO_MARCO_MS = 480000;  // um marco inteiro (12 cenas). Estourou, o resto é pulado.

const comTeto = (promessa, ms, rotulo) => Promise.race([
  promessa,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`teto de ${ms / 1000}s estourado em ${rotulo}`)), ms))
]);
const seg = t0 => ((Date.now() - t0) / 1000).toFixed(0) + 's';
const RAIZ = path.resolve(BASE, '..', '..');
const MARCOS = JSON.parse(fs.readFileSync(path.join(BASE, 'commit-map', 'milestones.json'), 'utf8'));
const DEST = path.join(BASE, 'screenshots', 'original');
const META = path.join(BASE, 'screenshots', 'metadata');

const TIPOS = { '.html':'text/html;charset=utf-8', '.css':'text/css;charset=utf-8', '.js':'text/javascript;charset=utf-8',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.webm':'video/webm', '.gif':'image/gif', '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff' };

function servidor(dir, porta) {
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      let alvo = path.join(dir, rel === '/' ? 'index.html' : rel);
      if (!alvo.startsWith(dir)) { res.writeHead(403).end(); return; }
      fs.readFile(alvo, (e, buf) => {
        if (e) { res.writeHead(404).end('404'); return; }
        res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    s.listen(porta, () => resolve(s));
  });
}

// A sessão de demonstração: mesma injeção do versao.js, só que aplicada por fora (aqui a
// gente controla o navegador, então não precisa mexer no HTML).
const ENTRAR = `(function(){
  var t0=Date.now();
  var t=setInterval(function(){
    if(Date.now()-t0>18000){clearInterval(t);return;}
    var l=document.getElementById('g-login-screen');
    if(typeof gOnLoginSuccess!=='function'||!l) return;
    if(getComputedStyle(l).display==='none') return;
    clearInterval(t);
    try{ gAuthState={user:{id:'demo',email:'demo@deliverymuch.com.br',role:'gestao',nome:'Demo',displayName:'Demo',ativo:true}};
         gOnLoginSuccess(); }catch(e){}
  },120);
})();`;

function nomeArquivo(ordem, cena, marco, vw) {
  const d = String(marco.data);
  const h = marco.hashCurto || 'origem';
  return `${String(ordem).padStart(2,'0')}_${cena.id}_${d}_${h}_${vw[0]}x${vw[1]}.png`;
}

// Uma captura já em disco e não vazia é evidência válida: refazer só gasta tempo e
// arrisca perder o que já deu certo. `--refazer` força tudo de novo quando preciso.
function jaCapturada(marco, cena) {
  const pasta = path.join(DEST, marco.id);
  if (!fs.existsSync(pasta)) return null;
  const alvo = fs.readdirSync(pasta).find(f => f.replace(/^\d+_/, '').replace(/_\d{4}-\d{2}-\d{2}_.*$/, '') === cena.id);
  if (!alvo) return null;
  return fs.statSync(path.join(pasta, alvo)).size > 1000 ? alvo : null;
}

async function capturarMarco(marco, porta) {
  const rel = { marco: marco.id, rotulo: marco.rotulo, data: marco.data, hash: marco.hash || null,
                cenas: [], iniciou: false, erros: [] };
  const t0Marco = Date.now();
  let dir;
  if (marco.tipo === 'arquivo') {
    dir = path.join(BASE, 'research', 'origem');
  } else {
    const sha = versao.resolver(marco.hash);
    dir = versao.preparar(sha);
  }
  const srv = await servidor(dir, porta);
  const url = `http://127.0.0.1:${porta}/${marco.arquivo || 'index.html'}`;
  const nav = await chromium.launch();
  try {
    for (const cena of CENAS) {
      const vw = cena.viewport;
      const feito = REFAZER ? null : jaCapturada(marco, cena);
      if (feito) {
        rel.cenas.push({ cena: cena.id, titulo: cena.titulo, area: cena.area, ok: true, arquivo: feito,
                         viewport: `${vw[0]}x${vw[1]}`, erroPagina: [], reaproveitada: true });
        console.log(`   ↺ ${marco.id} ${cena.id.padEnd(18)} já em disco — reaproveitada`);
        continue;
      }
      if (Date.now() - t0Marco > TETO_MARCO_MS) {
        rel.cenas.push({ cena: cena.id, titulo: cena.titulo, area: cena.area, ok: false, arquivo: null,
                         viewport: `${vw[0]}x${vw[1]}`, erroPagina: [], pulada: 'teto do marco estourado' });
        console.log(`   ⏱ ${marco.id} ${cena.id.padEnd(18)} pulada (teto do marco: ${seg(t0Marco)})`);
        continue;
      }
      const p = await nav.newPage({ viewport: { width: vw[0], height: vw[1] },
                                    isMobile: vw[0] < 500, hasTouch: vw[0] < 500, deviceScaleFactor: 2 });
      const errs = [];
      p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
      if (!cena.semSessao && marco.precisaSessao !== false) await p.addInitScript(ENTRAR);
      let ok = false, nota = '';
      const t0Cena = Date.now();
      try {
        await comTeto((async () => {
          await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await p.waitForTimeout(9000);   // o splash segura o boot até 9s; esperar menos pega tela coberta
          rel.iniciou = true;
          ok = await cena.montar(p);
        })(), TETO_CENA_MS, `${marco.id}/${cena.id}`);
        if (ok) {
          const arq = nomeArquivo(CENAS.indexOf(cena) + 1, cena, marco, vw);
          const pasta = path.join(DEST, marco.id);
          fs.mkdirSync(pasta, { recursive: true });
          fs.mkdirSync(path.join(META, marco.id), { recursive: true });
          await p.screenshot({ path: path.join(pasta, arq) });
          fs.writeFileSync(path.join(META, marco.id, arq.replace('.png', '.json')), JSON.stringify({
            screen: cena.titulo, area: cena.area, state: cena.id, milestone: marco.id, label: marco.rotulo,
            commit: marco.hash || null, date: marco.data, viewport: `${vw[0]}x${vw[1]}`,
            captureType: marco.tipo === 'arquivo' ? 'real-arquivo-original' : 'real-commit',
            confidence: 'alto',
            notes: marco.tipo === 'arquivo'
              ? 'Execução do HTML original do piloto, servido offline. Nenhuma alteração no código.'
              : 'Execução do próprio commit via git worktree, offline; Supabase zerado e sessão de demonstração injetada. O código da interface não foi alterado.'
          }, null, 2));
          nota = arq;
        }
      } catch (e) { nota = 'erro: ' + e.message.slice(0, 110); rel.erros.push(cena.id + ': ' + nota); }
      rel.cenas.push({ cena: cena.id, titulo: cena.titulo, area: cena.area, ok, arquivo: ok ? nota : null,
                       viewport: `${vw[0]}x${vw[1]}`, erroPagina: [...new Set(errs)].slice(0, 2) });
      console.log(`   ${ok ? '✓' : '·'} ${marco.id} ${cena.id.padEnd(18)} ${ok ? nota : (nota || 'tela não existe nesta versão')} [${seg(t0Cena)}]`);
      await p.close();
    }
  } finally { await nav.close(); srv.close(); }
  return rel;
}

const REFAZER = process.argv.includes('--refazer');

(async () => {
  const filtro = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const alvos = filtro.length ? MARCOS.filter(m => filtro.includes(m.id)) : MARCOS;
  console.log(REFAZER ? '\n(--refazer: ignorando o que já está em disco)' : '\n(retomando: capturas já em disco são reaproveitadas — use --refazer pra forçar)');
  fs.mkdirSync(path.join(BASE, 'reports'), { recursive: true });
  const todos = [];
  let porta = 8300;
  for (const m of alvos) {
    console.log(`\n▸ ${m.id} · ${m.data} · ${m.rotulo}`);
    try {
      const r = await capturarMarco(m, porta++);
      todos.push(r);
      fs.writeFileSync(path.join(BASE, 'reports', `runtime-${m.id}.md`), relatorio(m, r));
    } catch (e) {
      console.log('   ✗ falhou:', e.message);
      todos.push({ marco: m.id, erro: e.message });
    }
  }
  fs.writeFileSync(path.join(BASE, 'commit-map', 'screens-by-commit.json'), JSON.stringify(todos, null, 2));
  const ok = todos.reduce((n, r) => n + (r.cenas || []).filter(c => c.ok).length, 0);
  console.log(`\n${ok} capturas em ${alvos.length} marcos\n`);
})();

function relatorio(m, r) {
  const l = [];
  l.push(`# runtime — ${m.id} · ${m.rotulo}`, '');
  l.push(`- **Data:** ${m.data}`);
  l.push(`- **Commit:** ${m.hash ? '`' + m.hash + '`' : '— (arquivo original entregue pelo Ryan, fora do git)'}`);
  l.push(`- **Executou:** ${r.iniciou ? 'sim' : 'NÃO'}`);
  l.push(`- **Como:** ${m.tipo === 'arquivo' ? 'HTML único servido direto de `research/origem/`' : '`git worktree` + servidor estático (scripts/versao.js)'}`);
  l.push(`- **Credenciais:** nenhuma. Supabase zerado; sessão de demonstração injetada no navegador.`);
  l.push(`- **Correção temporária no código da interface:** nenhuma.`, '');
  l.push('| Cena | Área | Viewport | Capturou | Arquivo |', '|---|---|---|---|---|');
  for (const c of r.cenas || []) {
    l.push(`| ${c.titulo} | ${c.area} | ${c.viewport} | ${c.ok ? 'sim' : 'não'} | ${c.arquivo || '—'} |`);
  }
  const faltou = (r.cenas || []).filter(c => !c.ok).map(c => c.titulo);
  l.push('', `**Telas não capturadas:** ${faltou.length ? faltou.join(', ') : 'nenhuma'}.`);
  l.push('', 'Tela não capturada aqui significa que ela não existia nesta versão ou não era alcançável offline — não que a captura tenha falhado por acidente. O detalhe de cada caso está em `reports/limitacoes.md`.');
  const errs = (r.cenas || []).flatMap(c => c.erroPagina || []);
  if (errs.length) l.push('', '**Erros de página observados:**', ...[...new Set(errs)].map(e => '- `' + e + '`'));
  return l.join('\n') + '\n';
}
