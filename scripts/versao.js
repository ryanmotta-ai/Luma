// scripts/versao.js — máquina do tempo do Luma: abre uma versão antiga no navegador.
//
//   node scripts/versao.js                    lista as versões (commits que mexeram em tela)
//   node scripts/versao.js 2026-07-18         abre a versão daquele dia
//   node scripts/versao.js 24fdf80            abre aquele commit
//   node scripts/versao.js 24fdf80 --porta 8100    (pra comparar duas em abas lado a lado)
//   node scripts/versao.js --limpar           apaga as cópias que ficaram no disco
//
// POR QUE ISSO FUNCIONA: o Luma é HTML+CSS+JS servido direto, sem build. Então qualquer
// commit do passado roda hoje como rodava — basta servir a pasta daquele commit. É por
// isso que "ver a tela de duas semanas atrás" aqui é um `git worktree` e um servidor, e
// não um deploy antigo que ninguém guardou.
//
// ⛔ A CÓPIA NUNCA FALA COM O SUPABASE DE PRODUÇÃO. O script zera as credenciais dentro
// do worktree e injeta uma sessão de demonstração. Sem isso, abrir uma versão antiga
// enquanto você está logado deixaria um front VELHO escrevendo no banco de HOJE — schema
// mudou desde então, e o estrago seria silencioso. Por isso também não há login: você vê
// as telas com os dados de exemplo do próprio commit, offline.
//
// O worktree é descartável e vive fora do repositório (em /tmp). A sua árvore de trabalho
// não é tocada em momento nenhum.

const { execFileSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
const CACHE = path.join(os.tmpdir(), 'luma-versoes');
const MARCA = '<!-- luma:versao -->';   // idempotência: worktree já preparado não é remexido

const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();

// ── lista ────────────────────────────────────────────────────────────────────
// Só commits que mexeram em TELA (html/css/js). Um commit de doc não muda nada pra
// quem quer comparar o visual, e enfileirar os 80 só esconde os que importam.
function listar() {
  const linhas = git('log', '--date=short', '--format=%ad\t%h\t%s', '--', 'index.html', 'css', 'js')
    .split('\n').filter(Boolean);
  console.log(`\n  ${linhas.length} versões com mudança de tela\n`);
  let diaAnterior = '';
  for (const l of linhas) {
    const [data, sha, ...resto] = l.split('\t');
    const assunto = resto.join('\t');
    console.log(`  ${data === diaAnterior ? '          ' : data}  ${sha}  ${assunto.slice(0, 78)}`);
    diaAnterior = data;
  }
  console.log(`\n  abrir:  node scripts/versao.js <hash>   ou   node scripts/versao.js <data>\n`);
}

// ── resolve o que o usuário digitou ──────────────────────────────────────────
function resolver(ref) {
  // Data: pega o ÚLTIMO commit até o fim daquele dia — "como estava no dia 18" é o que
  // se quer dizer, não "o commit que por acaso tem essa data".
  if (/^\d{4}-\d{2}-\d{2}$/.test(ref)) {
    const sha = git('rev-list', '-1', `--before=${ref} 23:59:59`, 'HEAD');
    if (!sha) throw new Error(`nenhum commit até ${ref} — o histórico começa em ${git('log', '--reverse', '--date=short', '--format=%ad').split('\n')[0]}`);
    return sha;
  }
  try { return git('rev-parse', '--verify', `${ref}^{commit}`); }
  catch (e) { throw new Error(`"${ref}" não é commit nem data (use AAAA-MM-DD)`); }
}

// ── prepara a cópia ──────────────────────────────────────────────────────────
function preparar(sha) {
  const dir = path.join(CACHE, sha.slice(0, 12));
  const indexPath = path.join(dir, 'index.html');
  if (fs.existsSync(indexPath) && fs.readFileSync(indexPath, 'utf8').includes(MARCA)) return dir;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(CACHE, { recursive: true });
    git('worktree', 'add', '--detach', '--force', dir, sha);
  }

  // 1) Corta o backend. Sem isto a cópia velha enxerga a sua sessão e pode ESCREVER.
  const cfg = path.join(dir, 'js', 'core', 'supabase-config.js');
  if (fs.existsSync(cfg)) {
    fs.writeFileSync(cfg, `// zerado por scripts/versao.js — esta cópia não fala com o Supabase\nwindow.LUMA_SUPABASE = { url: '', anonKey: '' };\n`);
  }

  // 2) Entra sem login. O boot mostra a tela de login quando não há sessão (main.js);
  //    aqui a gente espera ela aparecer e assume o lugar dela com um usuário de mentira.
  //    `gAuthState` é `let` de script clássico, então a atribuição alcança o binding real
  //    — conferido: a forma é a mesma no commit mais antigo do histórico.
  // Só data e hash na etiqueta: com o assunto do commit junto ela passava de 700px e
  // tapava um card inteiro. O assunto já sai no terminal, que é onde se lê texto.
  const info = git('log', '-1', '--date=short', '--format=%ad · %h', sha).replace(/'/g, '');
  const injecao = `${MARCA}
<style>
  #luma-versao-tag{position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:5px 10px;
    border-radius:999px;background:#111;color:#fff;font:600 10.5px/1.3 ui-monospace,Menlo,monospace;
    letter-spacing:.02em;box-shadow:0 6px 18px rgba(0,0,0,.3);pointer-events:none;opacity:.75}
</style>
<div id="luma-versao-tag">${info}</div>
<script>
/* injetado por scripts/versao.js — não faz parte do Luma */
(function(){
  var t0 = Date.now();
  var t = setInterval(function(){
    if (Date.now() - t0 > 20000) { clearInterval(t); return; }
    var login = document.getElementById('g-login-screen');
    if (typeof gOnLoginSuccess !== 'function' || !login) return;
    if (getComputedStyle(login).display === 'none') return;   // ainda decidindo o boot
    clearInterval(t);
    try {
      gAuthState = { user: { id:'demo', email:'demo@deliverymuch.com.br', role:'gestao',
                             nome:'Demo', displayName:'Demo', ativo:true } };
      gOnLoginSuccess();
    } catch(e) { console.warn('[versao] modo demo falhou:', e); }
  }, 120);
})();
</script>
`;
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html.includes('</body>') ? html.replace(/<\/body>/i, injecao + '</body>') : html + injecao;
  fs.writeFileSync(indexPath, html);
  return dir;
}

// ── servidor estático ────────────────────────────────────────────────────────
const TIPOS = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif',
  '.webp':'image/webp', '.webm':'video/webm', '.mp4':'video/mp4', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf' };

function servir(dir, porta, info) {
  http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    let alvo = path.join(dir, rel === '/' ? 'index.html' : rel);
    // Trava de diretório: nada fora da cópia sai por aqui, nem com ../ na URL.
    if (!alvo.startsWith(dir)) { res.writeHead(403).end('nope'); return; }
    if (fs.existsSync(alvo) && fs.statSync(alvo).isDirectory()) alvo = path.join(alvo, 'index.html');
    fs.readFile(alvo, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }).end('não existe nesta versão: ' + rel); return; }
      const tipo = TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream';
      // charset explícito só no que é texto — sem ele o acento do HTML antigo sai quebrado
      const ehTexto = tipo.startsWith('text') || tipo === 'image/svg+xml' || tipo === 'application/json';
      res.writeHead(200, { 'Content-Type': tipo + (ehTexto ? '; charset=utf-8' : ''), 'Cache-Control':'no-store' });
      res.end(buf);
    });
  }).listen(porta, () => {
    console.log(`\n  ${info}`);
    console.log(`  http://localhost:${porta}\n`);
    console.log(`  offline · sem login · não fala com o Supabase`);
    console.log(`  Ctrl+C encerra (a cópia fica em cache; --limpar apaga)\n`);
  });
}

function limpar() {
  if (!fs.existsSync(CACHE)) { console.log('\n  nada em cache\n'); return; }
  for (const d of fs.readdirSync(CACHE)) {
    try { git('worktree', 'remove', '--force', path.join(CACHE, d)); } catch (e) {}
  }
  fs.rmSync(CACHE, { recursive: true, force: true });
  git('worktree', 'prune');
  console.log('\n  cache limpo\n');
}

// ── entrada ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
try {
  if (args.includes('--limpar')) { limpar(); }
  else if (!args.length || args[0].startsWith('--')) { listar(); }
  else {
    const p = args.indexOf('--porta');
    const porta = p >= 0 ? Number(args[p + 1]) : 8099;
    const sha = resolver(args[0]);
    const dir = preparar(sha);
    servir(dir, porta, git('log', '-1', '--date=short', '--format=%ad · %h · %s', sha));
  }
} catch (e) {
  console.error('\n  ' + e.message + '\n');
  process.exit(1);
}
