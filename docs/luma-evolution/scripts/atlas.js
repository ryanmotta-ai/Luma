// docs/luma-evolution/scripts/atlas.js — onde cada funcionalidade está HOJE.
//
//   node docs/luma-evolution/scripts/atlas.js
//
// Sobe a versão atual e, pra cada funcionalidade, procura o elemento na página e mede a
// caixa dele em PORCENTAGEM da viewport. A apresentação desenha o destaque por cima da
// captura usando essas porcentagens — então o contorno cai no lugar certo mesmo quando a
// imagem é redimensionada no slide.
//
// Funcionalidade que não for encontrada NÃO entra no atlas. É melhor um atlas menor e
// correto do que uma seta apontando pro vazio.

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const versao = require('../../../scripts/versao.js');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE = path.resolve(__dirname, '..');
const DEST = path.join(BASE, 'screenshots', 'feature-atlas');
const VW = [1440, 1000];

// Mesmo motivo do capturar.js: um quadro que trava não pode prender o pipeline. Estourou
// o teto, o quadro entra no resultado como não medido e o laço segue.
const TETO_QUADRO_MS = 120000;
const comTeto = (pr, ms, rot) => Promise.race([
  pr, new Promise((_, rej) => setTimeout(() => rej(new Error(`teto de ${ms / 1000}s em ${rot}`)), ms))
]);
const seg = t0 => ((Date.now() - t0) / 1000).toFixed(0) + 's';

const TIPOS = { '.html':'text/html;charset=utf-8', '.css':'text/css;charset=utf-8', '.js':'text/javascript;charset=utf-8',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.webm':'video/webm', '.ico':'image/x-icon', '.woff2':'font/woff2' };

// Cada QUADRO é uma tela do produto + as funcionalidades que se localizam nela.
// `sel` é o seletor do elemento a destacar; `caminho` é como o usuário chega lá.
const QUADROS = [
  {
    id: 'vitrine', tela: 'Vitrine do franqueado', preparar: null,
    feats: [
      { nome: 'Campanha em destaque', sel: '.fh-hero', area: 'Franqueado', perfil: 'Todos',
        caminho: 'Entrar → primeira coisa na tela',
        oQueFaz: 'Puxa pra frente a campanha recomendada da semana, com formatos e prazo.',
        beneficio: 'O franqueado não precisa escolher entre 17 campanhas pra começar.', estado: 'Implementado' },
      { nome: 'Busca de campanha', sel: '.fh-search-row, #fh-search', area: 'Franqueado', perfil: 'Todos',
        caminho: 'Vitrine → campo de busca',
        oQueFaz: 'Filtra o catálogo por tema ou ocasião.',
        beneficio: 'Encurta o caminho quando já se sabe o que quer.', estado: 'Implementado' },
      { nome: 'Minhas artes', sel: '[onclick*="fHomeOpenHist"], .fh-hd-btn', area: 'Franqueado', perfil: 'Todos',
        caminho: 'Vitrine → cabeçalho → Minhas artes',
        oQueFaz: 'Abre o histórico e permite retomar uma arte pela metade.',
        beneficio: 'Trabalho começado não se perde entre sessões.', estado: 'Implementado' },
      { nome: 'Alternador Franqueado / Designer', sel: '#global-topbar [onclick*="setMode"]', area: 'Núcleo', perfil: 'equipe_dm+',
        caminho: 'Topbar → Designer',
        oQueFaz: 'Troca entre a área de uso e o Estúdio de criação.',
        beneficio: 'Um app só atende os dois papéis, sem login separado.', estado: 'Implementado' }
    ]
  },
  {
    id: 'campanha', tela: 'Campanha aberta',
    preparar: async p => { await p.evaluate(() => { const c = document.querySelector('.camp-card[role="button"]'); if (c) c.click(); }); await p.waitForTimeout(4000); return true; },
    feats: [
      { nome: 'Materiais da campanha', sel: '.f-mat-card', area: 'Franqueado', perfil: 'Todos',
        caminho: 'Vitrine → campanha',
        oQueFaz: 'Lista cada material disponível com o formato e a validade.',
        beneficio: 'Mostra o que existe antes de pedir qualquer coisa.', estado: 'Implementado' },
      { nome: 'Prévia ao vivo', sel: '#f-live-preview, .f-live, [class*="live-preview"]', area: 'Franqueado', perfil: 'Todos',
        caminho: 'Campanha → coluna da direita',
        oQueFaz: 'Mostra a arte se montando enquanto as respostas entram.',
        beneficio: 'Erro é visto na hora, não depois do download.', estado: 'Implementado' },
      { nome: 'Rail de campanhas', sel: '#fran-left, .fran-left', area: 'Franqueado', perfil: 'Todos',
        caminho: 'Sempre visível à esquerda dentro da campanha',
        oQueFaz: 'Mantém o catálogo ao alcance sem sair do que está fazendo.',
        beneficio: 'Trocar de campanha não custa uma volta ao início.', estado: 'Implementado' }
    ]
  },
  {
    id: 'estudio', tela: 'Estúdio do designer',
    preparar: async p => { await p.evaluate(() => { if (typeof setMode === 'function') setMode('designer'); }); await p.waitForTimeout(5000); return true; },
    feats: [
      { nome: 'Biblioteca de templates', sel: '#d-studio-home, .dc-tmpl', area: 'Designer', perfil: 'equipe_dm+',
        caminho: 'Topbar → Designer',
        oQueFaz: 'Reúne os templates da equipe, por pasta e por campanha.',
        beneficio: 'O designer retoma o trabalho sem procurar arquivo.', estado: 'Implementado' },
      { nome: 'Gaveta de recursos', sel: '#d-resources-drawer', area: 'Designer', perfil: 'equipe_dm+',
        caminho: 'Estúdio → painel lateral direito',
        oQueFaz: 'Guarda imagens e elementos reaproveitáveis entre artes.',
        beneficio: 'Menos upload repetido, mais consistência de marca.', estado: 'Implementado' }
    ]
  },
  {
    id: 'cli', tela: 'Luma CLI',
    preparar: async p => { await p.evaluate(() => { if (typeof gCliOpen === 'function') gCliOpen(); }); await p.waitForTimeout(2500); return true; },
    feats: [
      { nome: 'Console do time', sel: '#luma-cli', area: 'Interno', perfil: 'equipe_dm+',
        caminho: 'Ctrl+` no desktop · painel de perfil no celular',
        oQueFaz: 'Diagnóstico de sync, catálogo, cache e banco em comandos nomeados.',
        beneficio: 'O que era snippet colado no DevTools virou comando repetível.', estado: 'Implementado' },
      { nome: 'Conversa com a IA no terminal', sel: '.cli-inputrow', area: 'Interno', perfil: 'equipe_dm+',
        caminho: 'CLI → qualquer frase que não seja comando',
        oQueFaz: 'Responde perguntas com o contexto real da sessão e sugere o comando.',
        beneficio: 'Investigar deixa de exigir decorar comando.', estado: 'Implementado' }
    ]
  }
];

function servidor(dir, porta) {
  return new Promise(r => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const alvo = path.join(dir, rel === '/' ? 'index.html' : rel);
      if (!alvo.startsWith(dir)) { res.writeHead(403).end(); return; }
      fs.readFile(alvo, (e, b) => {
        if (e) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream' });
        res.end(b);
      });
    });
    s.listen(porta, () => r(s));
  });
}

const ENTRAR = `(function(){var t0=Date.now();var t=setInterval(function(){
  if(Date.now()-t0>18000){clearInterval(t);return;}
  var l=document.getElementById('g-login-screen');
  if(typeof gOnLoginSuccess!=='function'||!l)return;
  if(getComputedStyle(l).display==='none')return;
  clearInterval(t);
  try{gAuthState={user:{id:'demo',email:'demo@deliverymuch.com.br',role:'gestao',nome:'Demo',displayName:'Demo',ativo:true}};gOnLoginSuccess();}catch(e){}
},120);})();`;

(async () => {
  const dir = versao.preparar(versao.resolver('HEAD'));
  const srv = await servidor(dir, 8420);
  const nav = await chromium.launch();
  fs.mkdirSync(DEST, { recursive: true });
  const saida = [];
  for (const q of QUADROS) {
    const t0 = Date.now();
    const p = await nav.newPage({ viewport: { width: VW[0], height: VW[1] }, deviceScaleFactor: 2 });
    await p.addInitScript(ENTRAR);
    const arq = `atlas_${q.id}_1440x1000.png`;
    const achados = [];
    try {
      await comTeto((async () => {
        await p.goto('http://127.0.0.1:8420/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await p.waitForTimeout(9500);
        if (q.preparar) await q.preparar(p);
        await p.screenshot({ path: path.join(DEST, arq) });
        for (const f of q.feats) {
          const cx = await p.evaluate(sel => {
            const e = document.querySelector(sel);
            if (!e) return null;
            const r = e.getBoundingClientRect();
            if (r.width < 20 || r.height < 16) return null;
            // Elemento FORA da viewport não aparece na captura: destacá-lo desenharia um
            // contorno fora da página apontando pro nada. A gaveta de recursos fechada
            // (translate pra esquerda) era exatamente esse caso.
            if (r.x < -2 || r.y < -2 || r.right > innerWidth + 2 || r.bottom > innerHeight + 2) return null;
            return { x: r.x / innerWidth * 100, y: r.y / innerHeight * 100,
                     w: r.width / innerWidth * 100, h: r.height / innerHeight * 100 };
          }, f.sel);
          if (cx) achados.push({ ...f, caixa: cx });
          console.log(`   ${cx ? '✓' : '·'} ${q.id} · ${f.nome}`);
        }
      })(), TETO_QUADRO_MS, q.id);
    } catch (e) {
      console.log(`   ⏱ ${q.id} interrompido: ${e.message}`);
    }
    console.log(`   → ${q.id}: ${achados.length}/${q.feats.length} localizadas [${seg(t0)}]`);
    if (achados.length) saida.push({ quadro: q.id, tela: q.tela, imagem: '../screenshots/feature-atlas/' + arq, feats: achados });
    await p.close().catch(() => {});
  }
  await nav.close(); srv.close();
  fs.writeFileSync(path.join(BASE, 'commit-map', 'atlas.json'), JSON.stringify(saida, null, 2));
  console.log(`\natlas: ${saida.reduce((n, q) => n + q.feats.length, 0)} funcionalidades localizadas em ${saida.length} telas\n`);
})();
