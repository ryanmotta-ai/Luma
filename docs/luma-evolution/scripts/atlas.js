// docs/luma-evolution/scripts/atlas.js — onde cada funcionalidade está HOJE.
//
//   node docs/luma-evolution/scripts/atlas.js
//
// Sobe a versão atual e, pra cada funcionalidade, procura o elemento na página e mede a
// caixa dele em PORCENTAGEM da viewport. A apresentação desenha o destaque por cima da
// captura usando essas porcentagens — o contorno cai no lugar certo mesmo quando a imagem
// é redimensionada no slide.
//
// Funcionalidade que não for encontrada NÃO entra no atlas. Melhor um atlas menor e
// correto do que um número apontando pro vazio.
//
// Mesmas regras do capturar.js: teto por quadro, duas tentativas por passo, e o pipeline
// segue depois de qualquer falha.

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const versao = require('../../../scripts/versao.js');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE = path.resolve(__dirname, '..');
const DEST = path.join(BASE, 'screenshots', 'feature-atlas');
const VW = [1440, 1000];
const TETO_QUADRO = 90000;
const TETO_BOOT = 12000;

const TIPOS = { '.html':'text/html;charset=utf-8', '.css':'text/css;charset=utf-8', '.js':'text/javascript;charset=utf-8',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.webm':'video/webm', '.ico':'image/x-icon', '.woff2':'font/woff2' };

// Um QUADRO é uma tela do produto + as funcionalidades que moram nela. `sel` aceita
// alternativas: o mesmo painel tem nomes diferentes conforme o estado.
const QUADROS = [
  {
    id: 'criar', tela: 'Vitrine — por onde se começa', fluxo: 'Criar', preparar: null,
    feats: [
      { nome: 'Campanha em destaque', sel: '.fh-hero',
        onde: 'Vitrine → primeiro bloco', perfil: 'Todos',
        oQueFaz: 'Puxa pra frente a campanha da semana, com formatos e prazo.' },
      { nome: 'Busca de campanha', sel: '.fh-search-row, #fh-search, [class*="fh-search"]',
        onde: 'Vitrine → campo de busca', perfil: 'Todos',
        oQueFaz: 'Filtra o catálogo por tema, prato ou ocasião.' },
      { nome: 'Minhas artes', sel: '[onclick*="fHomeOpenHist"], .fh-hd-btn',
        onde: 'Vitrine → cabeçalho', perfil: 'Todos',
        oQueFaz: 'Abre o histórico e retoma uma arte pela metade.' },
      { nome: 'Alternador Franqueado / Designer', sel: '#global-topbar [onclick*="setMode"], .gt-switch',
        onde: 'Topbar', perfil: 'equipe_dm+',
        oQueFaz: 'Troca entre a área de uso e o Estúdio de criação.' }
    ]
  },
  {
    id: 'editar', tela: 'Campanha aberta — o chat que monta a arte', fluxo: 'Editar',
    preparar: async p => {
      await p.evaluate(() => { const c = document.querySelector('.camp-card[role="button"], .camp-card[onclick]'); if (c) c.click(); });
      await p.waitForTimeout(3000);
      await p.evaluate(() => { const m = document.querySelector('.f-mat-card, .f-mat-action'); if (m) m.click(); });
      await p.waitForTimeout(3500);
      return true;
    },
    feats: [
      { nome: 'Chat de preenchimento', sel: '#f-messages',
        onde: 'Campanha → material → Personalizar', perfil: 'Todos',
        oQueFaz: 'Pergunta em passos curtos em vez de exigir que você edite a arte.' },
      { nome: 'Prévia ao vivo', sel: '#f-live-preview, .f-live, [class*="live-prev"], [class*="f-preview"]',
        onde: 'Coluna da direita', perfil: 'Todos',
        oQueFaz: 'Mostra a arte se montando enquanto as respostas entram.' },
      { nome: 'Campo de resposta', sel: '#f-msg-box, #f-snd, [class*="f-msgrow"], [class*="f-inputrow"]',
        onde: 'Rodapé do chat', perfil: 'Todos',
        oQueFaz: 'Aceita texto ou a sugestão clicada, com o limite de caracteres à vista.' },
      { nome: 'Contexto da campanha', sel: '#f-ctx-tag, [class*="f-ctx"]',
        onde: 'Topo do chat', perfil: 'Todos',
        oQueFaz: 'Mostra em qual campanha e formato a arte está sendo montada.' }
    ]
  },
  {
    id: 'organizar', tela: 'Estúdio — a casa do designer', fluxo: 'Organizar',
    preparar: async p => {
      await p.evaluate(() => { if (typeof setMode === 'function') setMode('designer'); });
      await p.waitForTimeout(4500);
      return true;
    },
    feats: [
      { nome: 'Começar do zero ou de um arquivo', sel: '.dsh-actions',
        onde: 'Estúdio → Criar material · Photoshop · Illustrator', perfil: 'equipe_dm+',
        oQueFaz: 'Arte em branco, PSD com camadas ou SVG vetorial — três portas de entrada.' },
      { nome: 'Biblioteca de materiais', sel: '#dsh-all-grid',
        onde: 'Estúdio → Todos os materiais', perfil: 'equipe_dm+',
        oQueFaz: 'Reúne o que a equipe já fez, com miniatura e status de publicação.' },
      { nome: 'Busca e filtros', sel: '.dsh-library-tools',
        onde: 'Estúdio → topo da biblioteca', perfil: 'equipe_dm+',
        oQueFaz: 'Acha o material por nome, por campanha ou por status.' },
      { nome: 'Pasta de destino', sel: '#dsh-save-folder-wrap',
        onde: 'Estúdio → cabeçalho', perfil: 'equipe_dm+',
        oQueFaz: 'Define em qual campanha a próxima arte vai nascer.' }
    ]
  },
  {
    id: 'publicar', tela: 'Exportar e publicar', fluxo: 'Publicar e exportar',
    preparar: async p => {
      await p.evaluate(() => { if (typeof setMode === 'function') setMode('designer'); });
      await p.waitForTimeout(4500);
      await p.evaluate(() => { if (typeof dOpenExportModal === 'function') dOpenExportModal(); });
      await p.waitForTimeout(2000);
      return true;
    },
    feats: [
      { nome: 'Formato de saída', sel: '#d-export-modal [class*="fmt"], #d-export-fmt, .d-exp-fmt',
        onde: 'Exportar → Formato', perfil: 'equipe_dm+',
        oQueFaz: 'PNG, JPG, SVG ou PSD a partir da mesma arte.' },
      { nome: 'Escala de exportação', sel: '#d-export-modal select, #d-export-scale',
        onde: 'Exportar → Escala', perfil: 'equipe_dm+',
        oQueFaz: 'Dobra a resolução para impressão sem refazer nada.' },
      { nome: 'Exportar em lote', sel: '#d-export-modal [class*="artboard"], #d-export-modal [class*="pranch"], #d-export-list',
        onde: 'Exportar → Pranchetas', perfil: 'equipe_dm+',
        oQueFaz: 'Sai com todas as pranchetas selecionadas de uma vez.' }
    ]
  },
  {
    id: 'interno', tela: 'Console do time', fluxo: 'Manter e diagnosticar',
    preparar: async p => {
      await p.evaluate(() => { if (typeof gCliOpen === 'function') gCliOpen(); });
      await p.waitForTimeout(2500);
      return true;
    },
    feats: [
      { nome: 'Luma CLI', sel: '#luma-cli',
        onde: 'Ctrl+` no desktop · painel de perfil no celular', perfil: 'equipe_dm+',
        oQueFaz: 'Diagnóstico de sync, catálogo, cache e banco em comandos nomeados.' },
      { nome: 'Conversa com a IA', sel: '.cli-inputrow, #luma-cli input',
        onde: 'CLI → qualquer frase que não seja comando', perfil: 'equipe_dm+',
        oQueFaz: 'Responde com o contexto real da sessão e sugere o comando certo.' }
    ]
  }
];

function servidor(dir, porta) {
  return new Promise((res, rej) => {
    const s = http.createServer((req, resp) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const alvo = path.join(dir, rel === '/' ? 'index.html' : rel);
      if (!alvo.startsWith(dir)) { resp.writeHead(403).end(); return; }
      fs.readFile(alvo, (e, b) => {
        if (e) { resp.writeHead(404).end(); return; }
        resp.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream' });
        resp.end(b);
      });
    });
    s.once('error', rej);
    s.listen(porta, () => res(s));
  });
}

const comTeto = (pr, ms, fb) => {
  let t;
  return Promise.race([
    Promise.resolve(pr).then(v => { clearTimeout(t); return v; }, () => { clearTimeout(t); return fb; }),
    new Promise(r => { t = setTimeout(() => r(fb), ms); })
  ]);
};

async function esperarBoot(p) {
  try {
    await p.waitForFunction(() => {
      const l = document.getElementById('g-login-screen');
      if (l && getComputedStyle(l).display !== 'none') return false;
      const a = document.querySelector('.fh-hero, #fh-body, .camp-grid, #f-home, #view-franqueado, #d-main');
      if (!a) return false;
      const r = a.getBoundingClientRect();
      if (r.height < 80) return false;
      // O splash de boot é um overlay laranja que continua por cima DEPOIS de a home
      // montar. Só checar "a home existe" fotografava o splash. elementFromPoint diz quem
      // está de fato na frente naquele ponto.
      const frente = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(40, r.height / 2));
      return !!(frente && (a.contains(frente) || frente.contains(a)));
    }, { timeout: TETO_BOOT, polling: 250 });
    await p.waitForTimeout(1200);
    return true;
  } catch (e) { return false; }
}

(async () => {
  const dir = versao.preparar(versao.resolver('HEAD'));
  const srv = await servidor(dir, 8420);
  const nav = await chromium.launch();
  fs.mkdirSync(DEST, { recursive: true });

  const saida = [];
  const total = QUADROS.length;
  for (const [i, q] of QUADROS.entries()) {
    const t0 = Date.now();
    const p = await nav.newPage({ viewport: { width: VW[0], height: VW[1] }, deviceScaleFactor: 2 });
    let achados = [];
    let arq = `atlas_${q.id}_1440x1000.png`;
    try {
      await comTeto(p.goto('http://127.0.0.1:8420/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 }), 22000, null);
      await esperarBoot(p);
      if (q.preparar) await comTeto(q.preparar(p), 30000, false);
      await comTeto(p.screenshot({ path: path.join(DEST, arq) }), 20000, null);

      for (const f of q.feats) {
        const cx = await comTeto(p.evaluate(sel => {
          const e = document.querySelector(sel);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          if (r.width < 20 || r.height < 14) return null;
          if (r.y > innerHeight || r.x > innerWidth) return null;   // fora da dobra fotografada
          return { x: r.x / innerWidth * 100, y: r.y / innerHeight * 100,
                   w: r.width / innerWidth * 100, h: Math.min(r.height, innerHeight - r.y) / innerHeight * 100 };
        }, f.sel), 8000, null);
        if (cx) achados.push({ ...f, caixa: cx });
        console.log(`   ${cx ? '✓' : '·'} ${q.id} · ${f.nome}${cx ? '' : ' — não localizada, fica de fora'}`);
      }
    } catch (e) {
      console.log(`   ✗ ${q.id}: ${e.message.slice(0, 80)}`);
    }
    saida.push({ quadro: q.id, tela: q.tela, fluxo: q.fluxo,
                 imagem: '../screenshots/feature-atlas/' + arq, feats: achados });
    console.log(`[${i + 1}/${total}] ${q.id} — ${achados.length} de ${q.feats.length} localizadas · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    await p.close().catch(() => {});
  }

  await nav.close().catch(() => {});
  srv.close();
  fs.writeFileSync(path.join(BASE, 'commit-map', 'atlas.json'), JSON.stringify(saida, null, 2));
  console.log(`\natlas: ${saida.reduce((n, q) => n + q.feats.length, 0)} funcionalidades em ${saida.length} telas\n`);
})();
