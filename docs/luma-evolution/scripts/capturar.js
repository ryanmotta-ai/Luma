// docs/luma-evolution/scripts/capturar.js — fotografa as telas de cada marco histórico.
//
//   node docs/luma-evolution/scripts/capturar.js            todos os marcos
//   node docs/luma-evolution/scripts/capturar.js M7 M8      só esses
//   node docs/luma-evolution/scripts/capturar.js --faltando  só o que ainda não tem PNG
//
// COMO FUNCIONA: reaproveita o motor de scripts/versao.js (git worktree + Supabase zerado
// + sessão de demonstração injetada no HTML da cópia) e, pra cada marco, sobe a versão
// numa porta própria e roda as cenas de cenas.js. Cena que não consegue chegar na tela
// vira evidência de que a tela AINDA NÃO EXISTIA naquele commit.
//
// ⛔ NADA é inventado: o print é o que aquele commit renderiza offline, com os dados de
// exemplo dele. O worktree é descartável e mora em /tmp.
//
// O marco ORIGEM não é um commit — é o HTML do piloto Yungas, servido direto de
// research/origem/ e marcado como tal nos metadados.
//
// TIMEOUTS: cada cena tem teto próprio e cada marco também. Cena que estoura é registrada
// como falha e o pipeline segue pra próxima — uma tela emperrada nunca trava a captura
// inteira. Não há espera sem teto em lugar nenhum deste arquivo.

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const versao = require('../../../scripts/versao.js');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { CENAS } = require('./cenas.js');

const BASE = path.resolve(__dirname, '..');
const MARCOS = JSON.parse(fs.readFileSync(path.join(BASE, 'commit-map', 'milestones.json'), 'utf8'));
const DEST = path.join(BASE, 'screenshots', 'original');
const META = path.join(BASE, 'screenshots', 'metadata');

// Argumentos, lidos no escopo do módulo porque capturarMarco() também consulta soCenas.
// Dentro do IIFE eles ficavam invisíveis pra ela e o filtro descartava todas as cenas.
const ARGS = process.argv.slice(2);
const I_CENA = ARGS.indexOf('--cena');
// --cena home,home-mobile → refaz só essas cenas. Corrige uma captura ruim sem pagar os
// três minutos de reexecutar o marco inteiro.
const soCenas = I_CENA >= 0 ? (ARGS[I_CENA + 1] || '').split(',').filter(Boolean) : null;
const soFaltando = ARGS.includes('--faltando');
const filtro = ARGS.filter((a, i) => !a.startsWith('--') && i !== I_CENA + 1);

const TETO_CENA = 45000;    // uma cena que passa disso está emperrada, não lenta
const TETO_MARCO = 420000;  // 7 min: teto do marco inteiro, some das cenas + folga
const TETO_BOOT = 12000;    // o splash segura até ~9s; passou disso, o app não subiu

const TIPOS = { '.html':'text/html;charset=utf-8', '.css':'text/css;charset=utf-8', '.js':'text/javascript;charset=utf-8',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.webm':'video/webm', '.gif':'image/gif', '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff' };

// Corrida com teto: devolve `fallback` se a promessa não resolver a tempo. É o que garante
// que nenhuma etapa fica pendurada — toda espera deste arquivo passa por aqui.
function comTeto(promessa, ms, fallback) {
  let t;
  return Promise.race([
    Promise.resolve(promessa).then(v => { clearTimeout(t); return v; }, () => { clearTimeout(t); return fallback; }),
    new Promise(r => { t = setTimeout(() => r(fallback), ms); })
  ]);
}

function servidor(dir, porta) {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const alvo = path.join(dir, rel === '/' ? 'index.html' : rel);
      if (!alvo.startsWith(dir)) { res.writeHead(403).end(); return; }
      fs.readFile(alvo, (e, buf) => {
        if (e) { res.writeHead(404).end('404'); return; }
        res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream',
                             'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    s.once('error', reject);
    s.listen(porta, () => resolve(s));
  });
}

// Espera o app MONTAR, não um número fixo de segundos. Antes isto era um sleep de 9s por
// cena — 80% dele era desperdício, porque o boot costuma terminar em ~3s.
async function esperarBoot(p) {
  try {
    await p.waitForFunction(() => {
      const login = document.getElementById('g-login-screen');
      if (login && getComputedStyle(login).display !== 'none') return false;   // ainda na porta
      const app = document.querySelector('.fh-hero, #fh-body, .camp-grid, #f-home, #view-franqueado, #d-main, #camp-main');
      if (!app) return false;
      const r = app.getBoundingClientRect();
      if (r.height < 80) return false;
      // O splash de boot é um overlay laranja que segue por cima DEPOIS de a home montar.
      // Checar só "a home existe" fotografava o splash — 7 capturas saíram assim antes
      // desta guarda. elementFromPoint diz quem está de fato na frente naquele ponto.
      const frente = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(40, r.height / 2));
      return !!(frente && (app.contains(frente) || frente.contains(app)));
    }, { timeout: TETO_BOOT, polling: 250 });
    await p.waitForTimeout(700);   // respiro pras animações de entrada assentarem
    return true;
  } catch (e) { return false; }
}

const nomeArquivo = (ordem, cena, marco, vw) =>
  `${String(ordem).padStart(2, '0')}_${cena.id}_${marco.data}_${marco.hashCurto}_${vw[0]}x${vw[1]}.png`;

async function capturarMarco(marco, porta) {
  const rel = { marco: marco.id, rotulo: marco.rotulo, data: marco.data, hash: marco.hash || null, cenas: [] };
  const t0 = Date.now();

  const dir = marco.tipo === 'arquivo'
    ? path.join(BASE, 'research', 'origem')
    : versao.preparar(versao.resolver(marco.hash));

  const srv = await servidor(dir, porta);
  const url = `http://127.0.0.1:${porta}/${marco.arquivo || 'index.html'}`;
  const nav = await chromium.launch();

  try {
    for (const cena of CENAS) {
      if (soCenas && !soCenas.includes(cena.id)) continue;
      // Teto do marco: se estourou, o resto das cenas é registrado sem tentar.
      if (Date.now() - t0 > TETO_MARCO) {
        rel.cenas.push({ cena: cena.id, titulo: cena.titulo, area: cena.area, ok: false,
                         arquivo: null, viewport: cena.viewport.join('x'), motivo: 'teto do marco estourado' });
        console.log(`   ⏱ ${marco.id} ${cena.id.padEnd(14)} pulada — teto do marco (${TETO_MARCO / 1000}s)`);
        continue;
      }

      const vw = cena.viewport;
      const p = await nav.newPage({ viewport: { width: vw[0], height: vw[1] },
                                    isMobile: vw[0] < 500, hasTouch: vw[0] < 500, deviceScaleFactor: 2 });
      const errs = [];
      p.on('pageerror', e => errs.push(e.message.slice(0, 120)));

      let ok = false, motivo = '', arq = null;
      const tc = Date.now();
      try {
        await comTeto(p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }), 22000, null);
        const subiu = await esperarBoot(p);
        if (!subiu) motivo = 'o app não montou a tempo';

        // A cena inteira corre sob teto: nenhuma navegação interna pendura o pipeline.
        ok = await comTeto(cena.montar(p), TETO_CENA, false);

        if (ok) {
          arq = nomeArquivo(CENAS.indexOf(cena) + 1, cena, marco, vw);
          const pasta = path.join(DEST, marco.id);
          fs.mkdirSync(pasta, { recursive: true });
          fs.mkdirSync(path.join(META, marco.id), { recursive: true });
          await comTeto(p.screenshot({ path: path.join(pasta, arq) }), 20000, null);
          fs.writeFileSync(path.join(META, marco.id, arq.replace('.png', '.json')), JSON.stringify({
            tela: cena.titulo, area: cena.area, estado: cena.id, marco: marco.id, rotulo: marco.rotulo,
            commit: marco.hash || null, data: marco.data, viewport: `${vw[0]}x${vw[1]}`,
            tipoCaptura: marco.tipo === 'arquivo' ? 'real-arquivo-original' : 'real-commit',
            confianca: 'alto',
            nota: marco.tipo === 'arquivo'
              ? 'Execução do HTML original do piloto, servido offline. Nenhuma alteração no código.'
              : 'Execução do próprio commit via git worktree, offline; Supabase zerado e sessão de demonstração injetada. O código da interface não foi alterado.'
          }, null, 2));
        } else if (!motivo) {
          motivo = 'tela não existe nesta versão';
        }
      } catch (e) {
        motivo = 'erro: ' + e.message.slice(0, 90);
      }

      const seg = ((Date.now() - tc) / 1000).toFixed(1);
      rel.cenas.push({ cena: cena.id, titulo: cena.titulo, area: cena.area, ok, arquivo: arq,
                       viewport: `${vw[0]}x${vw[1]}`, motivo: ok ? null : motivo,
                       erroPagina: [...new Set(errs)].slice(0, 2) });
      console.log(`   ${ok ? '✓' : '·'} ${marco.id} ${cena.id.padEnd(14)} ${seg}s  ${ok ? arq : motivo}`);
      await p.close().catch(() => {});
    }
  } finally {
    await nav.close().catch(() => {});
    srv.close();
  }
  rel.duracao = ((Date.now() - t0) / 1000).toFixed(0) + 's';
  return rel;
}

function relatorio(m, r) {
  const l = [`# runtime — ${m.id} · ${m.rotulo}`, '',
    `- **Data:** ${m.data}`,
    `- **Commit:** ${m.hash ? '`' + m.hash + '`' : '— (arquivo do piloto, entregue fora do git)'}`,
    `- **Como:** ${m.tipo === 'arquivo' ? 'HTML único servido direto de `research/origem/`' : '`git worktree` + servidor estático (scripts/versao.js)'}`,
    `- **Credenciais:** nenhuma. Supabase zerado; sessão de demonstração injetada no navegador.`,
    `- **Alteração no código da interface:** nenhuma.`,
    `- **Duração:** ${r.duracao}`, '',
    '| Cena | Área | Viewport | Capturou | Arquivo / motivo |', '|---|---|---|---|---|'];
  for (const c of r.cenas) {
    l.push(`| ${c.titulo} | ${c.area} | ${c.viewport} | ${c.ok ? 'sim' : 'não'} | ${c.arquivo || c.motivo || '—'} |`);
  }
  const errs = r.cenas.flatMap(c => c.erroPagina || []);
  if (errs.length) l.push('', '**Erros de página observados:**', ...[...new Set(errs)].map(e => '- `' + e + '`'));
  l.push('', 'Cena não capturada aqui significa, na maioria dos casos, que a tela não existia nesta versão ou não era alcançável offline — não que a captura tenha falhado por acidente. Ver `reports/limitacoes.md`.');
  return l.join('\n') + '\n';
}

const temPng = id => {
  const d = path.join(DEST, id);
  return fs.existsSync(d) && fs.readdirSync(d).some(f => f.endsWith('.png'));
};

(async () => {

  let alvos = filtro.length ? MARCOS.filter(m => filtro.includes(m.id)) : MARCOS;
  if (soFaltando) alvos = alvos.filter(m => !temPng(m.id));

  if (!alvos.length) { console.log('\nnada a capturar (use --faltando sem filtro, ou passe os ids)\n'); return; }

  fs.mkdirSync(path.join(BASE, 'reports'), { recursive: true });
  const inicio = Date.now();
  const todos = [];
  let porta = 8300;

  for (const [i, m] of alvos.entries()) {
    const decorrido = ((Date.now() - inicio) / 60000).toFixed(1);
    console.log(`\n▸ ${m.id} · ${m.data} · ${m.rotulo}   [${i + 1}/${alvos.length} · ${decorrido} min decorridos]`);
    try {
      const r = await capturarMarco(m, porta++);
      todos.push(r);
      fs.writeFileSync(path.join(BASE, 'reports', `runtime-${m.id}.md`), relatorio(m, r));
    } catch (e) {
      console.log(`   ✗ ${m.id} falhou por inteiro: ${e.message.slice(0, 110)}`);
      todos.push({ marco: m.id, erro: e.message, cenas: [] });
    }
  }

  // Preserva o que já havia de outros marcos: rodar `capturar.js M7` não pode apagar o
  // mapa dos oito restantes.
  const mapa = path.join(BASE, 'commit-map', 'screens-by-commit.json');
  const antes = fs.existsSync(mapa) ? JSON.parse(fs.readFileSync(mapa, 'utf8')) : [];
  const mesclado = [...antes.filter(a => !todos.some(t => t.marco === a.marco)), ...todos]
    .sort((a, b) => a.marco.localeCompare(b.marco));
  fs.writeFileSync(mapa, JSON.stringify(mesclado, null, 2));

  if (soCenas) console.log(`\n(rodado só para as cenas: ${soCenas.join(', ')})`);
  const ok = todos.reduce((n, r) => n + (r.cenas || []).filter(c => c.ok).length, 0);
  console.log(`\n${ok} capturas em ${alvos.length} marcos · ${((Date.now() - inicio) / 60000).toFixed(1)} min\n`);
})();
