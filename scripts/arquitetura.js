#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════════════════
   TESTE DE ARQUITETURA — as leis do Luma deixam de ser prosa e viram portão de CI
   ------------------------------------------------------------------------------------------
   O `luma-brain/03_ENGINEERING.md` lista três leis e doze anti-padrões. Até aqui eles viviam
   só em texto: quem lia, seguia; quem não lia, não. Um arquivo novo com `import`, uma segunda
   função com o mesmo nome global, um `alert()` de depuração esquecido — nada disso é pego por
   teste funcional, porque o programa continua rodando. É pego por uma regra sobre o CÓDIGO.

   É o que ferramentas como ArchUnit fazem no mundo Java. Aqui não dá para usar ArchUnit (é
   biblioteca Java) nem qualquer equivalente de npm: a 1ª lei é zero dependência, sem build.
   Então este arquivo é o motor — Node puro, texto e regex, no mesmo espírito do
   `run-browser-tests.js`, que fala DevTools Protocol na unha em vez de trazer Playwright.

   DOIS TIPOS DE REGRA, e a diferença importa:

   · PORTÃO      — hoje o código está 100% limpo, então qualquer violação REPROVA. É uma linha
                   que ninguém pode cruzar.
   · CATRACA     — hoje já existe dívida (centenas de casos). Reprovar tudo pararia o trabalho
                   de todo mundo por uma faxina que ninguém pediu. Então o script guarda o
                   NÚMERO em `arquitetura-baseline.json`: subir reprova, descer atualiza a
                   linha sozinho. A dívida só pode encolher. É catraca, não muro.

   ⛔ A catraca tem heurística, e ela é assumida. "localStorage dentro de try" é decidido por
   janela de linhas, não por parser — um punhado de casos entra errado nos dois sentidos. Para
   o propósito (o número não pode subir) isso é suficiente, porque o erro é ESTÁVEL: a mesma
   heurística mede antes e depois. Trocar por um parser de verdade traria dependência, que é
   justamente o que a 1ª lei proíbe.

   Uso:
     node scripts/arquitetura.js            # roda tudo; sai 1 se reprovar
     node scripts/arquitetura.js --lista    # mostra CADA violação, com arquivo:linha
     node scripts/arquitetura.js --aceitar  # regrava a linha de base (use com intenção)
   ══════════════════════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const BASELINE = path.join(__dirname, 'arquitetura-baseline.json');
const LISTAR = process.argv.includes('--lista');
const ACEITAR = process.argv.includes('--aceitar');

/* ── Leitura do projeto (uma vez só; as regras compartilham) ──────────────────────────── */
function listarJs(dir, saida = []) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) listarJs(p, saida);
    else if (nome.endsWith('.js')) saida.push(path.relative(RAIZ, p).replace(/\\/g, '/'));
  }
  return saida;
}

const arquivos = listarJs(path.join(RAIZ, 'js')).sort();
const fonte = new Map(arquivos.map(f => [f, fs.readFileSync(path.join(RAIZ, f), 'utf8')]));
const indexHtml = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

/* Comentário e string não são código. Esta base comenta MUITO — e comenta explicando o que
   NÃO fazer ("antes isto era um prompt()", "⛔ não use confirm aqui"), que é justamente o
   texto que uma regra ingênua acusa. Um `startsWith('//')` não resolve: comentário de bloco
   tem linhas do meio que não começam com nada.
   Apaga o MIOLO de comentários e de literais, preservando o número de linhas e o comprimento
   — assim `arquivo:linha` continua clicável e a regex segue vendo o código de verdade.
   ⚠ Varredura de um passe, não parser: regex em literal ainda confunde. É o bastante aqui. */
function despir(src) {
  let out = '', modo = 'codigo', aspas = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i], d = src[i] + src[i + 1];
    if (modo === 'codigo') {
      if (d === '/*') { modo = 'bloco'; out += '  '; i++; continue; }
      if (d === '//') { const fim = src.indexOf('\n', i); const n = (fim < 0 ? src.length : fim) - i; out += ' '.repeat(n); i += n - 1; continue; }
      if (c === '"' || c === "'" || c === '`') { modo = 'texto'; aspas = c; out += c; continue; }
      out += c; continue;
    }
    if (modo === 'bloco') { if (d === '*/') { modo = 'codigo'; out += '  '; i++; } else out += (c === '\n' ? '\n' : ' '); continue; }
    // texto: preserva as aspas e o tamanho, esconde o conteúdo
    if (c === '\\') { out += '  '; i++; continue; }
    if (c === aspas) { modo = 'codigo'; out += c; continue; }
    out += (c === '\n' ? '\n' : ' ');
  }
  return out;
}
// `linhas` é o código DESPIDO (o que as regras leem); `cru` é o original (o que elas mostram).
const linhas = new Map([...fonte].map(([f, s]) => [f, despir(s).split('\n')]));
const cru = new Map([...fonte].map(([f, s]) => [f, s.split('\n')]));

// Varre linha a linha aplicando um teste; devolve as violações com endereço clicável.
function varrer(teste, filtro) {
  const out = [];
  for (const f of arquivos) {
    if (filtro && !filtro(f)) continue;
    const ls = linhas.get(f);
    for (let i = 0; i < ls.length; i++) {
      const achado = teste(ls[i], i, ls, f);
      if (achado) out.push({ arquivo: f, linha: i + 1,
        texto: (typeof achado === 'string' ? achado : (cru.get(f)[i] || '').trim()).slice(0, 96) });
    }
  }
  return out;
}
// Sobrou só para as regras que leem a linha CRUA (a da cor, que precisa ver o hex).
const ehComentario = (l) => /^\s*(\/\/|\/?\*)/.test(l);

/* ── As regras ────────────────────────────────────────────────────────────────────────── */
const REGRAS = [

  /* ══ PORTÃO ══ o código está limpo hoje; cruzar a linha reprova ══════════════════════ */

  { id: 'sem-modulos', tipo: 'portao',
    titulo: 'Sem ES Modules, npm ou bundler',
    porque: '1ª lei. O `<script>` no index É a arquitetura: um `import` faz o arquivo virar '
          + 'módulo, adiar a execução e sumir com as funções globais que o resto do projeto chama.',
    rodar: () => varrer(l => !ehComentario(l) && /^\s*(import\s|export\s|export\{)/.test(l) ? l.trim() : null) },

  { id: 'sem-require', tipo: 'portao',
    titulo: 'Sem `require()` no código do navegador',
    porque: 'Não existe bundler para resolver isso; em tempo de execução é ReferenceError. '
          + '(`scripts/` é Node e fica de fora — lá `require` é o certo.)',
    rodar: () => varrer(l => !ehComentario(l) && /\brequire\s*\(/.test(l) ? l.trim() : null) },

  { id: 'sem-dialogo-nativo', tipo: 'portao',
    titulo: 'Feedback pelos motores da casa, não por diálogo do navegador',
    porque: '`alert`/`confirm`/`prompt` travam a aba, não têm a marca e não são traduzíveis. '
          + 'A casa tem `gToast`, `gConfirm` e `gPrompt` — e eles existem por este motivo.',
    rodar: () => varrer(l => !ehComentario(l) && /(^|[^.\w$])(alert|confirm|prompt)\s*\(/.test(l)
                              && !/\b(gConfirm|gPrompt|gToast|window\.confirm\s*=)/.test(l) ? l.trim() : null) },

  { id: 'funcao-global-unica', tipo: 'portao',
    titulo: 'Cada função global é declarada uma única vez',
    porque: 'Com `<script>` global, duas `function` com o mesmo nome NÃO dão erro: a última '
          + 'vence e a primeira some. O programa continua rodando e a feature morre em '
          + 'silêncio. Foi assim que `dABToolAttach` passou meses funcionando por sorte de '
          + 'ordem, com um stub vazio declarado 600 linhas acima da implementação real.',
    rodar: () => {
      const onde = new Map();
      for (const f of arquivos) {
        linhas.get(f).forEach((l, i) => {
          const m = l.match(/^function\s+([A-Za-z_$][\w$]*)/);
          if (m) (onde.get(m[1]) || onde.set(m[1], []).get(m[1])).push({ arquivo: f, linha: i + 1 });
        });
      }
      const out = [];
      for (const [nome, locais] of onde) {
        if (locais.length < 2) continue;
        out.push({ arquivo: locais[0].arquivo, linha: locais[0].linha,
          texto: nome + ' declarada ' + locais.length + '× → ' + locais.map(l => l.arquivo + ':' + l.linha).join(', ') });
      }
      return out;
    } },

  { id: 'script-do-index-existe', tipo: 'portao',
    titulo: 'Todo `<script>` do index existe no disco',
    porque: 'Um caminho errado no index é 404 silencioso: o navegador segue em frente e a '
          + 'feature inteira some sem nenhum erro que alguém vá ler.',
    rodar: () => {
      const out = [];
      const re = /<script[^>]+src="((?:js|assets)\/[^"?]+)/g;
      let m;
      while ((m = re.exec(indexHtml))) {
        if (!fs.existsSync(path.join(RAIZ, m[1]))) {
          out.push({ arquivo: 'index.html', linha: indexHtml.slice(0, m.index).split('\n').length, texto: m[1] + ' não existe' });
        }
      }
      return out;
    } },

  { id: 'versao-de-deploy-unica', tipo: 'portao',
    titulo: 'Um número de deploy só, em todos os assets',
    porque: '`03_ENGINEERING` §6.1. Dois números no mesmo index significam que metade dos '
          + 'arquivos vem do cache e a outra metade não — o pior estado possível, porque a '
          + 'versão nova roda contra o CSS velho.',
    rodar: () => {
      // Só `js/`, `css/` e `assets/vendor/`: o favicon é versionado à parte de propósito —
      // o navegador o guarda com cache muito mais agressivo e re-baixá-lo a cada deploy é
      // desperdício sem ganho.
      const vs = [...new Set((indexHtml.match(/(?:js|css|assets\/vendor)\/[^"']*\?v=(\d+)/g) || [])
        .map(s => s.slice(s.indexOf('?v=') + 3)))];
      if (vs.length <= 1) return [];
      return [{ arquivo: 'index.html', linha: 1, texto: 'números de deploy convivendo: ' + vs.join(', ') }];
    } },

  /* ══ CATRACA ══ já existe dívida; o número não pode SUBIR ════════════════════════════ */

  { id: 'arquivo-js-orfao', tipo: 'catraca',
    titulo: 'Arquivo em `js/` que ninguém carrega',
    porque: 'Código que não entra no index e não é carregado sob demanda não roda para '
          + 'ninguém — mas continua sendo lido, mantido e citado na documentação como se '
          + 'existisse. É o caso do `pwa-install.js`: 129 linhas de JS e 129 de CSS, '
          + 'documentadas no MAPA e no LUMA.md, desligadas por inteiro.',
    rodar: () => arquivos
      .filter(f => !indexHtml.includes('src="' + f))
      // Carregamento sob demanda conta como carregado: alguém constrói a URL do arquivo.
      .filter(f => {
        const base = path.basename(f);
        for (const [outro, s] of fonte) if (outro !== f && s.includes(base)) return false;
        return true;
      })
      .map(f => ({ arquivo: f, linha: 1, texto: 'não está no index e ninguém o carrega' })) },

  { id: 'localstorage-sem-guarda', tipo: 'catraca',
    titulo: '`localStorage` dentro de try/catch',
    porque: 'Em aba anônima, com cota cheia ou com cookies bloqueados, `localStorage` LANÇA. '
          + 'Sem guarda, a exceção sobe e mata o resto da função — normalmente um boot.',
    // Heurística assumida: procura `try` nas 14 linhas acima e `catch` nas 14 abaixo. Erra
    // nos dois sentidos em casos raros, mas erra IGUAL antes e depois, que é o que a catraca
    // precisa. Um parser de verdade traria dependência — a 1ª lei não permite.
    rodar: () => varrer((l, i, ls) => {
      if (ehComentario(l) || !/\blocalStorage\s*\./.test(l)) return null;
      const acima = ls.slice(Math.max(0, i - 14), i).join('\n');
      const abaixo = ls.slice(i + 1, i + 15).join('\n');
      return (/\btry\s*\{/.test(acima) && /\bcatch\s*\(/.test(abaixo)) ? null : l.trim();
    }) },

  { id: 'cor-fora-do-token', tipo: 'catraca',
    titulo: 'Cor em hex solto no JS',
    porque: '`04_DESIGN_SYSTEM`: cor vem de token (`css/00-tokens.css`). Hex no JS não troca '
          + 'com o tema, não acompanha a marca e não aparece quando alguém procura a cor.',
    // Fallback documentado de token é legítimo e fica de fora: `var(--x,#hex)`, `_dPsdToken(...)`
    // e SVG embutido (onde a cor é dado do desenho, não decisão de tema).
    rodar: () => varrer((l, i, ls, f) => {
      const bruta = cru.get(f)[i] || '';   // o hex mora DENTRO de string, que `despir` esconde
      if (ehComentario(bruta) || !/#[0-9a-fA-F]{6}\b/.test(bruta)) return null;
      if (/var\(--|Token\(|%23|<svg|data:image\/svg/.test(bruta)) return null;
      return bruta.trim();
    }) },

  { id: 'prefixo-sagrado', tipo: 'catraca',
    titulo: 'Prefixo do subdomínio no nome da função',
    porque: '`f*` franqueado, `d*` Estúdio, `g*` compartilhado, `ac*` academia, `tut*` '
          + 'tutorial. Com 2.200 funções globais num escopo só, o prefixo é o que diz de onde '
          + 'a função vem e o que ela pode tocar — e é por isso que nenhuma delas se renomeia.',
    rodar: () => {
      const dono = [
        [/^js\/franqueado\//, /^_?f/, 'f*'],
        [/^js\/designer\//, /^_?d/, 'd*'],
        [/^js\/academia\//, /^_?ac/, 'ac*'],
        [/^js\/tutorial\//, /^_?tut/, 'tut*'],
        [/^js\/(core|00-config|01-state|main)/, /^_?g/, 'g*'],
      ];
      return varrer((l, i, ls, f) => {
        const m = l.match(/^function\s+([A-Za-z_$][\w$]*)/);
        if (!m) return null;
        const regra = dono.find(([pasta]) => pasta.test(f));
        if (!regra || regra[1].test(m[1])) return null;
        return m[1] + ' em ' + f + ' deveria começar com ' + regra[2];
      });
    } },
];

/* ── Execução ─────────────────────────────────────────────────────────────────────────── */
let baseline = {};
try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) { /* primeira vez */ }

const novaBaseline = {};
let reprovou = 0, apertou = 0;

console.log('Arquitetura do Luma — ' + arquivos.length + ' arquivos JS, '
  + [...fonte.values()].reduce((n, s) => n + s.split('\n').length, 0).toLocaleString('pt-BR') + ' linhas\n');

for (const regra of REGRAS) {
  const achados = regra.rodar();
  const n = achados.length;

  if (regra.tipo === 'portao') {
    if (n === 0) { console.log('✓ ' + regra.titulo); continue; }
    reprovou += n;
    console.log('✕ ' + regra.titulo + ' — ' + n + (n === 1 ? ' violação' : ' violações'));
    console.log('    ' + regra.porque.replace(/\s+/g, ' '));
    achados.slice(0, LISTAR ? 999 : 8).forEach(a => console.log('    · ' + a.arquivo + ':' + a.linha + '  ' + a.texto));
    if (!LISTAR && n > 8) console.log('    … mais ' + (n - 8) + ' (rode com --lista)');
    continue;
  }

  // Catraca: comparar com a linha de base.
  const antes = baseline[regra.id];
  novaBaseline[regra.id] = n;
  if (antes == null) {
    console.log('• ' + regra.titulo + ' — ' + n + ' (linha de base registrada agora)');
  } else if (n > antes) {
    reprovou += (n - antes);
    console.log('✕ ' + regra.titulo + ' — subiu de ' + antes + ' para ' + n);
    console.log('    ' + regra.porque.replace(/\s+/g, ' '));
    achados.slice(0, LISTAR ? 999 : 8).forEach(a => console.log('    · ' + a.arquivo + ':' + a.linha + '  ' + a.texto));
    if (!LISTAR && n > 8) console.log('    … ' + n + ' no total (rode com --lista)');
  } else if (n < antes) {
    apertou += (antes - n);
    console.log('✓ ' + regra.titulo + ' — desceu de ' + antes + ' para ' + n + ' (catraca apertada)');
  } else {
    console.log('· ' + regra.titulo + ' — ' + n + ' (estável)');
    if (LISTAR) achados.forEach(a => console.log('    · ' + a.arquivo + ':' + a.linha + '  ' + a.texto));
  }
}

// A catraca só gira para um lado sozinha: quando a dívida DESCE, a linha nova fica gravada e
// ninguém pode devolvê-la. Quando sobe, o arquivo não é tocado — o conserto é no código.
const deveGravar = ACEITAR || (!reprovou && (apertou || Object.keys(baseline).length !== REGRAS.filter(r => r.tipo === 'catraca').length));
if (deveGravar) {
  const juntas = Object.assign({}, baseline, novaBaseline);
  fs.writeFileSync(BASELINE, JSON.stringify(juntas, null, 2) + '\n');
  if (apertou) console.log('\nlinha de base atualizada: ' + apertou + ' violação(ões) a menos — não dá para voltar atrás.');
  else if (ACEITAR) console.log('\nlinha de base regravada por --aceitar.');
}

console.log('\n' + (reprovou
  ? 'REPROVOU — ' + reprovou + ' violação(ões) de arquitetura'
  : 'OK — a arquitetura está de pé'));
process.exit(reprovou ? 1 : 0);
