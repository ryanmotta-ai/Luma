// docs/luma-evolution/scripts/slides-v2.js — a narrativa da V2.
//
// Curadoria em vez de auditoria: 5 marcos, 6 áreas, ~23 slides. Reaproveita as capturas
// que já estão em disco — nenhuma versão histórica é reexecutada aqui.
//
// Quatro padrões de slide, repetidos de ponta a ponta: comparação (antes → hoje), três
// momentos (origem → expansão → atual), atlas (captura com contornos medidos) e editorial
// (título + lista ou números). Layout novo por slide é o que faz uma apresentação parecer
// remendo; aqui a repetição é proposital.
//
// Os números do produto são CONTADOS no repositório a cada montagem, nunca digitados.

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE = path.resolve(__dirname, '..');
const RAIZ = path.resolve(BASE, '..', '..');
const SHOTS = path.join(BASE, 'screenshots', 'original');
const TODOS = JSON.parse(fs.readFileSync(path.join(BASE, 'commit-map', 'milestones.json'), 'utf8'));

// ── curadoria: 5 marcos dos 9 capturados ─────────────────────────────────────
// Escolhidos por diferença visual clara. M2/M4/M5/M6 saem porque a tela que eles mudam já
// está representada por um vizinho — dois commits quase idênticos não contam história.
// M4 (véspera da 1.0) entra porque é a coluna do meio de todas as comparações do bloco
// detalhado. Sem ele aqui, aquele commit aparecia do nada no meio da apresentação e o
// argumento "as duas semanas antes da 1.0 foram de robustez" ficava sem referência.
const ESCOLHIDOS = ['M0', 'M1', 'M3', 'M4', 'M7', 'M8'];
const MARCOS = ESCOLHIDOS.map(id => TODOS.find(m => m.id === id)).filter(Boolean);

const commitsPath = path.join(BASE, 'commit-map', 'todos-os-commits.json');
const COMMITS = fs.existsSync(commitsPath) ? JSON.parse(fs.readFileSync(commitsPath, 'utf8')) : [];

const atlasPath = path.join(BASE, 'commit-map', 'atlas.json');
const ATLAS = fs.existsSync(atlasPath) ? JSON.parse(fs.readFileSync(atlasPath, 'utf8')) : [];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sh = c => { try { return execSync(c, { cwd: RAIZ, encoding: 'utf8' }).trim(); } catch (e) { return ''; } };
const n = c => Number(sh(c) || 0);

// ── o que existe em disco ────────────────────────────────────────────────────
const IMG = {};
for (const m of TODOS) {
  const dir = path.join(SHOTS, m.id);
  if (!fs.existsSync(dir)) continue;
  IMG[m.id] = {};
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.png'))) {
    IMG[m.id][f.replace(/^\d+_/, '').replace(/_\d{4}-\d{2}-\d{2}_.*$/, '')] = '../screenshots/original/' + m.id + '/' + f;
  }
}
const tem = (mid, c) => !!(IMG[mid] && IMG[mid][c]);
const img = (mid, c) => IMG[mid] && IMG[mid][c];
const marco = id => TODOS.find(m => m.id === id);
const selo = m => m.tipo === 'arquivo' ? 'arquivo original' : (m.hashCurto === 'atual' ? 'branch atual' : m.hashCurto);
const quando = m => m.dataRotulo || m.data;
const ar = src => { const m = /_(\d+)x(\d+)\.png$/.exec(src || ''); return m ? `${m[1]}/${m[2]}` : '1440/1000'; };

// ── métricas contadas agora ──────────────────────────────────────────────────
const M = {
  commits:    n('git log --all --oneline | wc -l'),
  autores:    n('git log --all --format=%an | sort -u | wc -l'),
  comTela:    n('git log --all --oneline -- index.html css js | wc -l'),
  primeiro:   sh('git log --all --date=short --format=%ad | sort | head -1'),
  ultimo:     sh('git log --all --date=short --format=%ad | sort | tail -1'),
  arqJs:      n('ls js/*.js js/*/*.js 2>/dev/null | wc -l'),
  linhasJs:   n('cat js/*.js js/*/*.js 2>/dev/null | wc -l'),
  linhasCss:  n('cat css/*.css css/*/*.css 2>/dev/null | wc -l'),
  fnD:        n('grep -rhoE "^function d[A-Z][A-Za-z0-9_]*" js/ | sort -u | wc -l'),
  fnF:        n('grep -rhoE "^function f[A-Z][A-Za-z0-9_]*" js/ | sort -u | wc -l'),
  fnG:        n('grep -rhoE "^function g[A-Z][A-Za-z0-9_]*" js/ | sort -u | wc -l'),
  migrations: n('ls supabase/migrations/*.sql 2>/dev/null | wc -l'),
  edge:       n('ls -d supabase/functions/*/ 2>/dev/null | wc -l'),
};
M.fnTotal = M.fnD + M.fnF + M.fnG;
// O total de commits vem do MESMO JSON que desenha a mega linha do tempo. Contar de novo
// com `git log | wc -l` já fez a apresentação dizer 240 num slide e 239 no seguinte.
if (COMMITS.length) M.commits = COMMITS.length;
M.dias = Math.round((Date.parse(M.ultimo) - Date.parse(M.primeiro)) / 864e5) + 1;
const br = x => x.toLocaleString('pt-BR');

const totalShots = fs.existsSync(SHOTS) ? fs.readdirSync(SHOTS).reduce((a, d) => {
  const p = path.join(SHOTS, d);
  return a + (fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter(f => f.endsWith('.png')).length : 0);
}, 0) : 0;
const totalFeats = ATLAS.reduce((a, q) => a + q.feats.length, 0);

// ── acumuladores ─────────────────────────────────────────────────────────────
const slides = [], notas = [], indice = [];
const add = (html, nota, ev) => { slides.push(html); notas.push(nota.trim()); indice.push(ev); };

const topo = (k, q) => `<div class="fio"></div><div class="topo"><span class="kicker">${esc(k)}</span>${q ? `<span class="quando">${esc(q)}</span>` : ''}</div>`;
const rodape = s => `<div class="num"></div>` + (s ? `<div class="selo"><span class="pt"></span>${esc(s)}</div>` : '');

const painel = (mid, cena, rotulo, eti, nota) => `<div class="tela">
  <div class="moldura" style="--ar:${ar(img(mid, cena))}"><img src="${img(mid, cena)}" alt="${esc(rotulo)}"></div>
  <div class="legenda">${eti ? `<span class="eti ${eti.cls}">${esc(eti.txt)}</span>` : ''}
    <span class="rot">${esc(rotulo)}</span>
    <span class="meta">${esc(quando(marco(mid)))} · ${esc(selo(marco(mid)))}</span></div>
  ${nota ? `<div class="nota">${nota}</div>` : ''}
</div>`;

// PADRÃO 1 — comparação antes → hoje
function comparar({ cena, kicker, titulo, antes, depois, rotA, rotB, notaA, notaB, conclusao, nota }) {
  if (!tem(antes, cena) || !tem(depois, cena)) {
    console.error(`  (slide "${titulo}" pulado — falta captura de ${cena})`);
    return false;
  }
  add(`<section class="slide">${topo(kicker, `${quando(marco(antes))} → ${quando(marco(depois))}`)}
    <div class="corpo" style="bottom:196px">
      <h2 class="titulo" style="font-size:48px;margin-bottom:22px">${esc(titulo)}</h2>
      <div class="telas" style="height:calc(100% - 78px)">
        ${painel(antes, cena, rotA, { cls: 'eti-antes', txt: 'antes' }, notaA)}
        ${painel(depois, cena, rotB, { cls: 'eti-hoje', txt: 'hoje' }, notaB)}
      </div>
    </div>
    <div class="conclusao">${conclusao}</div>
    ${rodape('duas execuções reais')}
  </section>`, nota,
  { tipo: 'Captura real', imagens: [img(antes, cena), img(depois, cena)],
    quando: `${quando(marco(antes))} (${selo(marco(antes))}) → ${quando(marco(depois))} (${selo(marco(depois))})`,
    obs: `Cena "${cena}", mesmo enquadramento nas duas.` });
  return true;
}

// PADRÃO 2 — três momentos
function trio({ kicker, titulo, momentos, conclusao, nota }) {
  const ok = momentos.filter(x => tem(x.marco, x.cena));
  if (ok.length < 3) return false;
  add(`<section class="slide">${topo(kicker, 'origem → expansão → hoje')}
    <div class="corpo" style="bottom:196px">
      <h2 class="titulo" style="font-size:48px;margin-bottom:22px">${esc(titulo)}</h2>
      <div class="trio" style="height:calc(100% - 78px)">
        ${ok.map((x, i) => (i ? '<div class="seta">→</div>' : '') + painel(x.marco, x.cena, x.rotulo, null, x.nota)).join('')}
      </div>
    </div>
    <div class="conclusao">${conclusao}</div>
    ${rodape('três execuções reais')}
  </section>`, nota,
  { tipo: 'Captura real', imagens: ok.map(x => img(x.marco, x.cena)),
    quando: ok.map(x => `${quando(marco(x.marco))} (${selo(marco(x.marco))})`).join(' → '),
    obs: `Mesma cena em três momentos.` });
  return true;
}

// PADRÃO 3 — atlas
function atlasSlide(q, i, total) {
  const fs4 = q.feats.slice(0, 4);
  if (!fs4.length) return false;
  add(`<section class="slide">${topo('Onde as coisas estão', `atlas ${i}/${total} · estado atual`)}
    <div class="corpo">
      <div style="display:flex;align-items:baseline;gap:18px;margin-bottom:20px">
        <span class="fluxo-tag">${esc(q.fluxo)}</span>
        <h2 class="titulo" style="font-size:40px">${esc(q.tela)}</h2>
      </div>
      <div class="atlas" style="height:calc(100% - 76px)">
        <div class="atlas-fig"><img src="${q.imagem}" alt="${esc(q.tela)}">
          ${fs4.map((f, k) => `<div class="contorno" style="left:${f.caixa.x.toFixed(2)}%;top:${f.caixa.y.toFixed(2)}%;width:${f.caixa.w.toFixed(2)}%;height:${f.caixa.h.toFixed(2)}%"></div>
          <div class="contorno-n" style="left:max(6px, calc(${f.caixa.x.toFixed(2)}% - 17px));top:max(6px, calc(${f.caixa.y.toFixed(2)}% - 17px))">${k + 1}</div>`).join('')}
        </div>
        <div class="atlas-lista">
          ${fs4.map((f, k) => `<div class="atlas-item"><div class="atlas-bola">${k + 1}</div>
            <div><h4>${esc(f.nome)}</h4><p>${esc(f.oQueFaz)}</p>
              <div class="onde">${esc(f.onde)} · ${esc(f.perfil)}</div></div></div>`).join('')}
        </div>
      </div>
    </div>
    ${rodape('contornos medidos no DOM')}
  </section>`,
  `${q.fluxo} — ${q.tela}.
${fs4.map((f, k) => `${k + 1}. ${f.nome} — ${f.onde}`).join('\n')}
Os contornos não foram desenhados no olho: cada caixa foi medida com getBoundingClientRect na versão atual.
~50s.`,
  { tipo: 'Estado atual', imagens: [q.imagem], quando: '30/07/2026 (branch atual)',
    obs: 'Caixas medidas no DOM, viewport 1440×1000.' });
  return true;
}

// PADRÃO 8 — três versões com as diferenças apontadas.
// Os três pontos do git que contam a história: o primeiro commit, o estado imediatamente
// anterior à 1.0 e o commit atual. Três prints por slide é o teto — acima disso o quadro
// fica pequeno demais para sustentar o que a legenda afirma.
//
// Cada coluna traz a própria lista de diferenças. Item marcado `nao: true` é ausência:
// mostrar o que aquela versão ainda NÃO tinha é tão informativo quanto o que ela tinha.
function tres({ cena, kicker, titulo, versoes, conclusao, nota }) {
  const ok = versoes.filter(v => tem(v.marco, cena));
  if (ok.length < 2) { console.error(`  (slide "${titulo}" pulado — falta captura de ${cena})`); return false; }
  add(`<section class="slide">${topo(kicker, ok.map(v => quando(marco(v.marco))).join(' → '))}
    <div class="corpo" style="bottom:262px">
      <h2 class="titulo" style="font-size:42px;margin-bottom:16px">${esc(titulo)}</h2>
      <div class="t3" style="height:calc(100% - 66px)">
        ${ok.map(v => `<div class="t3-col${v.marco === 'M8' ? ' atual' : ''}">
          <div class="t3-img" style="--ar:${ar(img(v.marco, cena))}"><img src="${img(v.marco, cena)}" alt="${esc(v.rotulo)}"></div>
          <div class="t3-cab"><span class="r">${esc(v.rotulo)}</span>
            <span class="d">${esc(quando(marco(v.marco)))} · ${esc(selo(marco(v.marco)))}</span></div>
          <ul class="difs">${(v.difs || []).map((d, i) => {
            const txt = typeof d === 'string' ? d : d.t;
            const ausente = typeof d === 'object' && d.nao;
            return `<li class="${ausente ? 'nao' : ''}"><span class="n">${ausente ? '–' : i + 1}</span><span>${txt}</span></li>`;
          }).join('')}</ul>
        </div>`).join('')}
      </div>
    </div>
    <div class="conclusao">${conclusao}</div>
    ${rodape(`${ok.length} execuções reais`)}
  </section>`, nota,
  { tipo: 'Captura real', imagens: ok.map(v => img(v.marco, cena)),
    quando: ok.map(v => `${quando(marco(v.marco))} (${selo(marco(v.marco))})`).join(' → '),
    obs: `Cena "${cena}": primeiro commit → antes da 1.0 → atual.` });
  return true;
}

// PADRÃO 5 — tira: TODAS as versões capturadas de uma tela, em ordem cronológica.
// É o padrão que mais mostra evolução por slide: oito ou nove execuções reais lado a lado,
// cada uma com a data e uma linha do que mudou naquele passo.
function tira({ cena, kicker, titulo, chave, mudancas, conclusao, nota }) {
  const versoes = TODOS.filter(m => tem(m.id, cena));
  if (versoes.length < 4) return false;
  add(`<section class="slide">${topo(kicker, `${versoes.length} versões · ${quando(versoes[0])} → ${quando(versoes[versoes.length - 1])}`)}
    <div class="corpo" style="bottom:196px">
      <h2 class="titulo" style="font-size:46px;margin-bottom:20px">${esc(titulo)}</h2>
      <div class="tira" style="height:calc(100% - 74px);grid-template-columns:repeat(${Math.ceil(versoes.length / 2)},1fr)">
        ${versoes.map(m => `<div class="tira-item${(chave || []).includes(m.id) ? ' chave' : ''}">
          <div class="tira-img"><img src="${img(m.id, cena)}" alt="${esc(m.rotulo)}"></div>
          <div class="tira-cap"><b>${esc(m.dataExata ? m.data.slice(5).replace('-', '/') : 'antes')}</b>${esc(selo(m))}</div>
          ${mudancas && mudancas[m.id] ? `<div class="tira-mud">${esc(mudancas[m.id])}</div>` : ''}
        </div>`).join('')}
      </div>
    </div>
    <div class="conclusao">${conclusao}</div>
    ${rodape(`${versoes.length} execuções reais`)}
  </section>`, nota,
  { tipo: 'Captura real', imagens: versoes.map(m => img(m.id, cena)),
    quando: `${quando(versoes[0])} → ${quando(versoes[versoes.length - 1])}`,
    obs: `Cena "${cena}" em ${versoes.length} versões, mesma viewport.` });
  return true;
}

// PADRÃO 6 — detalhe: a MESMA faixa da tela, ampliada, em várias versões.
// O recorte sai de background-position/size sobre a captura inteira: nenhuma imagem é
// cortada em disco, e mudar a região é mudar dois números. `y` e `h` são porcentagens da
// altura da captura; a largura é sempre a faixa inteira.
function detalhe({ kicker, titulo, cena, regiao, versoes, conclusao, nota }) {
  const { y, h } = regiao;
  const disponiveis = versoes.filter(v => tem(v.marco, cena));
  if (disponiveis.length < 2) return false;
  // 1440 de largura por (1000 × h%) de altura — a proporção real da faixa recortada.
  const prop = (1440 / (10 * h)).toFixed(3);
  const posY = (y / (100 - h) * 100).toFixed(2);
  add(`<section class="slide">${topo(kicker, 'mesma faixa da tela, ampliada')}
    <div class="corpo" style="bottom:224px">
      <h2 class="titulo" style="font-size:46px;margin-bottom:18px">${esc(titulo)}</h2>
      <div class="det" style="height:calc(100% - 72px)">
        ${disponiveis.map(v => `<div class="det-linha">
          <div class="det-quadro">
            <div class="det-crop" style="aspect-ratio:${prop};background-image:url('${img(v.marco, cena)}');background-size:100% auto;background-position:0 ${posY}%"></div>
            <div class="det-cap"><span class="q">${esc(v.rotulo)}</span>
              <span class="d">${esc(quando(marco(v.marco)))} · ${esc(selo(marco(v.marco)))}</span></div>
            ${v.obs ? `<div class="det-obs">${v.obs}</div>` : ''}
          </div>
        </div>`).join('')}
      </div>
    </div>
    <div class="conclusao">${conclusao}</div>
    ${rodape('recorte da captura, sem edição')}
  </section>`, nota,
  { tipo: 'Captura real', imagens: disponiveis.map(v => img(v.marco, cena)),
    quando: disponiveis.map(v => quando(marco(v.marco))).join(' → '),
    obs: `Faixa y ${y}%–${y + h}% da cena "${cena}", ampliada por CSS. As capturas em disco são as inteiras.` });
  return true;
}

// PADRÃO 7 — ganhos: o que foi aprimorado, em grade de duas colunas.
function ganhos({ kicker, titulo, itens, nota, evid }) {
  add(`<section class="slide">${topo(kicker)}
    <div class="corpo">
      <h2 class="titulo" style="font-size:50px">${esc(titulo)}</h2>
      <div class="ganhos" style="height:calc(100% - 90px);margin-top:12px">
        ${itens.map((g, i) => `<div class="ganho"><div class="ic">${i + 1}</div>
          <div><h4>${esc(g.t)}</h4><p>${g.d}</p>${g.q ? `<div class="qd">${esc(g.q)}</div>` : ''}</div></div>`).join('')}
      </div>
    </div>
    ${rodape('')}
  </section>`, nota,
  { tipo: 'Captura real', imagens: [], quando: evid || `${M.primeiro} → ${M.ultimo}`,
    obs: 'Cada item tem lastro em commit do histórico.' });
  return true;
}

// PADRÃO 9 — mega linha do tempo: todos os commits do repositório num quadro só.
// Uma coluna por DIA, todas da mesma largura; o volume do dia é a ALTURA da barra e a
// distribuição por área é a intensidade da célula. A versão anterior dava largura
// proporcional ao volume — com 57 commits num dia e 1 em outro, metade das colunas
// virava um risco sem rótulo legível.
function megaLinha() {
  if (!COMMITS.length) return false;
  const HASH_MARCO = new Set(MARCOS.map(m => m.hashCurto));
  const dias = [...new Set(COMMITS.map(c => c.dia))].sort();
  const porDia = d => COMMITS.filter(c => c.dia === d);
  // As quatro áreas de bastidor somam 25 commits em 26 dias: quatro faixas quase vazias
  // comiam altura sem dizer nada. Viram uma só, e as cinco que carregam a história
  // ganham o espaço.
  const FAIXAS = [
    { r: 'Franqueado', a: ['Franqueado'] },
    { r: 'Designer', a: ['Designer'] },
    { r: 'Núcleo', a: ['Núcleo'] },
    { r: 'Design', a: ['Design'] },
    { r: 'Bastidores', a: ['Backend', 'IA', 'CLI', 'Pacote'] },
    { r: 'Documentação', a: ['Docs'] },
  ];
  const MES = { '06': 'jun', '07': 'jul' };
  const pico = Math.max(...dias.map(d => porDia(d).length));
  const rotDia = d => d.slice(5).replace('-', '/');
  // Escala de intensidade em degraus absolutos, não relativos ao máximo: "4–7 commits"
  // quer dizer a mesma coisa em toda a grade, e a legenda vira uma régua de verdade.
  const DEG = [[15, 5], [8, 4], [4, 3], [2, 2], [1, 1]];
  const grau = n => (DEG.find(([lim]) => n >= lim) || [0, 0])[1];

  // Colunas: os dias mais os VÃOS. Dias sem commit simplesmente não existiam na grade,
  // e a pausa de uma semana entre 29/06 e 07/07 sumia — silêncio de calendário é
  // informação. Vão de 1 dia é ruído; só entra a partir de 2.
  const cols = [];
  dias.forEach((d, i) => {
    if (i) {
      const vao = Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(dias[i - 1] + 'T00:00:00Z')) / 864e5) - 1;
      if (vao >= 2) cols.push({ vao });
    }
    cols.push({ d, n: porDia(d).length });
  });
  const gt = `172px ${cols.map(c => c.vao ? '.62fr' : '1fr').join(' ')}`;

  let mesAtual = '';
  const barras = cols.map(c => {
    if (c.vao) return '<div class="mg-vao"></div>';
    const tela = porDia(c.d).filter(x => x.tela).length;
    const alt = Math.max(3, Math.round(c.n / pico * 100));
    return `<div class="mg-bar${c.n >= 25 ? ' alto' : ''}">
      <span class="n">${c.n}</span>
      <span class="col" style="height:${alt}%">
        <span class="cd" style="flex:${c.n - tela}"></span><span class="ct" style="flex:${tela}"></span>
      </span></div>`;
  }).join('');

  const datas = cols.map(c => {
    if (c.vao) return `<div class="mg-vao-r"><span class="v">${c.vao}d</span></div>`;
    const m = c.d.slice(5, 7), novo = m !== mesAtual;
    if (novo) mesAtual = m;
    const temMarco = porDia(c.d).some(x => HASH_MARCO.has(x.h));
    return `<div class="mg-dia${c.n >= 25 ? ' alto' : ''}">
      <span class="d">${c.d.slice(8)}</span>
      ${novo ? `<span class="m">${MES[m] || m}</span>` : ''}
      ${temMarco ? '<span class="mk"></span>' : ''}</div>`;
  }).join('');

  const faixas = FAIXAS.map(f => {
    const tot = COMMITS.filter(c => c.areas.some(a => f.a.includes(a))).length;
    return `<div class="mg-rot">${esc(f.r)}<span class="qt">${tot}</span></div>` + cols.map(c => {
      if (c.vao) return '<div class="mg-vao"></div>';
      const n = porDia(c.d).filter(x => x.areas.some(a => f.a.includes(a))).length;
      return `<div class="mg-cel v${grau(n)}">${n || ''}</div>`;
    }).join('');
  }).join('');

  add(`<section class="slide">${topo('Todo o histórico',
      `${COMMITS.length} commits · ${dias.length} dias com atividade em ${rotDia(dias[0])} → ${rotDia(dias[dias.length - 1])}`)}
    <div class="corpo">
      <h2 class="titulo" style="font-size:44px;margin-bottom:16px">Onde o trabalho aconteceu, commit a commit</h2>
      <div class="mega" style="height:calc(100% - 122px);grid-template-columns:${gt};
           grid-template-rows:minmax(0,1fr) auto repeat(6, 77px)">
        <div class="mg-rot mg-rot-b">commits<br>no dia</div>${barras}
        <div></div>${datas}
        ${faixas}
      </div>
      <div class="mg-leg">
        <span><i style="background:var(--laranja)"></i> mexe em tela</span>
        <span><i class="cd" style="background:repeating-linear-gradient(-45deg,#DEDBD6 0 3px,#F2F0EC 3px 6px)"></i> sem mudança visual</span>
        <span><span class="mk" style="width:9px;height:9px;border-radius:50%;background:var(--tinta);box-shadow:0 0 0 2.5px var(--laranja)"></span> dia de um marco</span>
        <span><i style="background:repeating-linear-gradient(180deg,var(--linha) 0 5px,transparent 5px 11px) center/2px 100% repeat-y"></i> dias sem commit nenhum</span>
        <span class="esc">commits na área:
          <i class="mg-cel v1" style="border:1px solid var(--linha)"></i>1
          <i class="mg-cel v2"></i>2–3 <i class="mg-cel v3"></i>4–7
          <i class="mg-cel v4"></i>8–14 <i class="mg-cel v5"></i>15+</span>
      </div>
    </div>
    ${rodape('')}
  </section>`,
  `A forma do trabalho num quadro só. Dois dias — 15 e 16 de julho — são 108 dos ${COMMITS.length} commits: é a semana em que o produto virou o que é hoje.
As colunas tracejadas são calendário vazio, não desistência: a maior é a pausa de sete dias entre 29/06 e 07/07.
Deixe a plateia varrer as faixas na horizontal — dá pra ver o foco mudar de área ao longo do tempo.
~1min.`,
  { tipo: 'Captura real', imagens: [], quando: `${dias[0]} → ${dias[dias.length - 1]}`,
    obs: `git log --all, ${COMMITS.length} commits classificados por arquivo tocado. A soma das células de uma faixa é o total ao lado do rótulo.` });
  return true;
}

// PADRÃO 10 — a lista completa, em páginas de duas colunas.
function listaCommits() {
  if (!COMMITS.length) return false;
  const HASH_MARCO = new Set(MARCOS.map(m => m.hashCurto));
  const dias = [...new Set(COMMITS.map(c => c.dia))].sort();
  // Paginação por ALTURA medida, não por um contador de itens. O contador antigo parava
  // a página do dia 16/07 em ~72% da altura e deixava o resto branco — lê como slide
  // inacabado. Os três números abaixo são o que o Chromium realmente gasta.
  const ALT = 836;      // corpo útil: 1080 − topo 140 − rodapé 104
  const H_DIA = 54;     // cabeçalho do dia + respiro do bloco
  const H_PAR = 24;     // um PAR de commits (a lista corre em duas colunas)
  const MIN_BLOCO = H_DIA + 4 * H_PAR;   // abaixo disso, começar um bloco não compensa
  // Um dia grande PODE ser partido entre páginas — 15/07 sozinho tem 57 commits e não
  // cabe em página nenhuma. A continuação vem rotulada, e a faixa de commits some da
  // dúvida: ninguém lê estas páginas em voz alta, elas existem pra conferência.
  const paginas = [];
  let atual = [], resta = ALT;
  for (const d of dias) {
    const todos = COMMITS.filter(c => c.dia === d);
    let cs = todos, de = 0;
    while (cs.length) {
      if (resta < MIN_BLOCO && atual.length) { paginas.push(atual); atual = []; resta = ALT; }
      const cabem = Math.max(2, Math.floor((resta - H_DIA) / H_PAR) * 2);
      const bloco = cs.slice(0, cabem);
      atual.push({ d, bloco, todos, de, parte: de > 0 });
      resta -= H_DIA + Math.ceil(bloco.length / 2) * H_PAR;
      de += bloco.length;
      cs = cs.slice(cabem);
    }
  }
  if (atual.length) paginas.push(atual);

  paginas.forEach((pag, i) => {
    const corpo = pag.map(({ d, bloco, todos, de, parte }) => `<div class="cm-grupo">
      <div class="cm-dia"><b>${d.slice(8)}/${d.slice(5,7)}</b>
        <span>${parte ? `continuação · commits ${de + 1} a ${de + bloco.length} de ${todos.length}`
          : `${todos.length} commits · ${todos.filter(c => c.tela).length} mexem em tela`}</span></div>
      <div class="cm-lista">${bloco.map(c => `<div class="cm${HASH_MARCO.has(c.h) ? ' marco' : ''}">
        <span class="hs">${esc(c.h)}</span><span class="hr">${esc(c.hora)}</span>
        <span class="tx">${esc(c.s.length > 74 ? c.s.slice(0, 73) + '…' : c.s)}</span></div>`).join('')}</div>
    </div>`).join('');
    add(`<section class="slide" data-indice>${topo(`Todo o histórico · ${i + 1} de ${paginas.length}`,
        [...new Set(pag.map(x => x.d))].map(d => d.slice(5).replace('-', '/')).join(' · '))}
      <div class="corpo">
        <div class="commits">${corpo}</div>
      </div>
      ${rodape('')}
    </section>`,
    `Página ${i + 1} de ${paginas.length} do histórico completo. Não leia em voz alta — está aqui para quem quiser conferir depois.
Se alguém perguntar por um commit específico, é nestes slides que ele está.
~15s.`,
    { tipo: 'Captura real', imagens: [], quando: [...new Set(pag.map(x => x.d))].join(', '),
      obs: 'git log --all, assunto e hora de cada commit.' });
  });
  return true;
}

// ══ 1 · CAPA ════════════════════════════════════════════════════════════════
add(`<section class="slide escuro">
  <div class="marca">Delivery Much · uso interno</div>
  <h1>Luma<br><em>de uma necessidade<br>a um produto</em></h1>
  <div class="csub">Uma visão visual da transformação da plataforma — reconstruída executando o código de cada época.</div>
  <div class="meta">
    <div><b>Período</b>anterior a 16/06/2026 → 30/07/2026</div>
    <div><b>Evidência</b>${totalShots} capturas reais, ${M.commits} commits</div>
    <div><b>Método</b>cada versão foi executada, não descrita</div>
  </div>
</section>`,
`Abertura. Diga a tese: não é changelog, é a passagem de uma necessidade interna para um produto.
E diga de saída que nada aqui é mockup — toda imagem é uma execução real de uma versão que voltou a rodar.
~40s.`,
{ tipo: 'Capa', imagens: [], quando: '—', obs: '—' });

// ══ 2 · O QUE VEREMOS ═══════════════════════════════════════════════════════
add(`<section class="slide">${topo('O que veremos')}
  <div class="corpo">
    <h2 class="titulo" style="font-size:56px">Cinco perguntas</h2>
    <div class="lista" style="margin-top:44px">
      <div class="li"><div class="n">01</div><div><h4>Como o Luma começou</h4>
        <p>A primeira versão conhecida e preservada, executada — outro nome, outra cor, sem tela de entrada.</p></div></div>
      <div class="li"><div class="n">02</div><div><h4>Como as telas principais evoluíram</h4>
        <p>Seis áreas comparadas lado a lado, mesma tela em versões diferentes.</p></div></div>
      <div class="li"><div class="n">03</div><div><h4>Que funcionalidades entraram</h4>
        <p>E em que momento cada uma passou a existir.</p></div></div>
      <div class="li"><div class="n">04</div><div><h4>Onde tudo está hoje</h4>
        <p>Um atlas com o caminho exato até cada recurso, marcado sobre a tela real.</p></div></div>
      <div class="li"><div class="n">05</div><div><h4>Que maturidade o produto ganhou</h4>
        <p>Além da aparência: dado com dono, rede que falha sem perder, IA como camada.</p></div></div>
    </div>
  </div>
  ${rodape('')}
</section>`,
`Contrato com a plateia. Os itens 4 e 5 são os que interessam a quem vai usar o Luma amanhã.
~35s.`,
{ tipo: 'Capa', imagens: [], quando: '—', obs: '—' });

// ══ 3 · O PONTO DE PARTIDA ══════════════════════════════════════════════════
if (tem('M0', 'home')) {
  add(`<section class="slide">${topo('O ponto de partida', 'anterior a 16/06/2026')}
    <div class="corpo" style="display:flex;gap:44px">
      <div style="flex:1.3;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <div class="moldura" style="--ar:${ar(img('M0','home'))}"><img src="${img('M0','home')}" alt="Piloto Yungas"></div>
        <div class="legenda"><span class="eti eti-antes">primeira versão conhecida</span>
          <span class="rot">Yungas · Módulo de Artes</span><span class="meta">arquivo preservado</span></div>
      </div>
      <div style="flex:.85;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <h2 class="titulo" style="font-size:50px">Nem se<br>chamava Luma</h2>
        <div class="sub" style="font-size:21px">Um arquivo HTML só, identidade vermelha, e nenhuma tela de entrada. Em <b>16/06</b> o repositório já nasce com o nome Luma e 85 arquivos — este monolito é o que veio antes disso.</div>
        <div class="numeros" style="grid-template-columns:1fr 1fr;margin-top:28px">
          <div class="card"><div class="v">1</div><div class="r">arquivo,<br>565 KB</div></div>
          <div class="card"><div class="v">9.316</div><div class="r">linhas, tudo<br>no mesmo lugar</div></div>
          <div class="card"><div class="v">266</div><div class="r">funções — já com os<br>prefixos d*, f* e g*</div></div>
          <div class="card"><div class="v">85</div><div class="r">arquivos no Luma<br>dois meses depois</div></div>
        </div>
      </div>
    </div>
    ${rodape('execução real do arquivo preservado')}
  </section>`,
  `O arquivo **roda** — é o HTML original executado agora, não um print de arquivo morto.
Seja honesto na origem: o git guarda o começo do Luma, mas não guarda este arquivo. Ele é anterior a 16/06, quando o repositório já nasce com o nome Luma e 85 módulos.
A convenção de prefixos do código de hoje nasceu aqui.
~50s.`,
  { tipo: 'Arquivo histórico fornecido', imagens: [img('M0','home')], quando: 'anterior a 16/06/2026',
    obs: 'HTML original servido offline, sem alteração de código. Contagens medidas no próprio arquivo.' });
}

// O elo entre o piloto e o git: mesma tela, dois nomes.
if (tem('M0', 'home') && tem('M1', 'home')) {
  add(`<section class="slide">${topo('De Yungas a Luma', 'anterior a 16/06 → 16/06/2026')}
    <div class="corpo" style="bottom:214px">
      <h2 class="titulo" style="font-size:46px;margin-bottom:20px">A mesma tela, dois nomes</h2>
      <div class="telas" style="height:calc(100% - 74px)">
        ${painel('M0', 'home', 'Yungas · Módulo de Artes', { cls: 'eti-antes', txt: 'antes do git' },
          'Vermelho, arquivo único de 565 KB. Catálogo à esquerda, assistente no centro, prévia à direita.')}
        ${painel('M1', 'home', 'Luma · Creative Automation', { cls: 'eti-hoje', txt: 'primeiro commit' },
          'Laranja, 85 arquivos separados. <b>A mesma estrutura, as mesmas campanhas</b> — trocaram o nome e a cor.')}
      </div>
    </div>
    <div class="conclusao">O piloto não foi jogado fora: ele <b>virou</b> o Luma. O monolito de 565 KB foi partido em 85 arquivos, a marca mudou de Yungas para Luma, e a tela seguiu igual — até as campanhas de exemplo são as mesmas.</div>
    ${rodape('duas execuções reais')}
  </section>`,
  `O elo perdido da apresentação. Estas duas telas estão a poucos dias uma da outra e mostram a mesma coisa com outra identidade.
Repare nas campanhas: Combo Smash, Hamburguer Fest, Frete Grátis — idênticas nas duas.
O que mudou entre uma e outra não foi a interface: foi a arquitetura, de um arquivo para oitenta e cinco.
~50s.`,
  { tipo: 'Captura real', imagens: [img('M0','home'), img('M1','home')],
    quando: 'anterior a 16/06 → 2026-06-16 (936c6d3)',
    obs: 'Duas execuções reais: o arquivo do piloto e o segundo commit do repositório.' });
}

// ══ 4 · LINHA DO TEMPO ══════════════════════════════════════════════════════
// Cada marco carrega quantos commits separam ele do anterior. Sem isso a régua era
// enganosa: seis pontos igualmente espaçados sugerem seis saltos do mesmo tamanho, e o
// salto 16/07 → 20/07 vale quase o dobro de todo o mês de junho.
const ORD = {};
COMMITS.forEach((c, i) => { ORD[c.h] = i; });
const posMarco = m => m.hashCurto === 'atual' ? COMMITS.length - 1
  : (m.hashCurto in ORD ? ORD[m.hashCurto] : null);
const ddmm = d => `${d.slice(8)}/${d.slice(5, 7)}`;
// A escala da barra de peso: o maior salto vira 100%, os outros ficam em proporção. Sem
// isso os seis pontos igualmente espaçados dizem que os intervalos são iguais — e o de
// 16/06 → 16/07 vale onze vezes o de 20/07 → 30/07.
const MAIOR_SALTO = Math.max(1, ...MARCOS.map((m, i) => {
  const p = posMarco(m), a = i ? posMarco(MARCOS[i - 1]) : null;
  return p == null ? 0 : (a == null ? (i ? p : 0) : p - a);
}));

add(`<section class="slide">${topo('Linha do tempo',
    `${MARCOS.length} marcos · ${M.commits} commits em ${M.dias} dias`)}
  <div class="corpo" style="display:flex;flex-direction:column">
    <h2 class="titulo" style="font-size:46px">Seis paradas em ${M.dias} dias de histórico</h2>
    <p class="sub" style="font-size:21px;margin-top:11px;max-width:1660px">Escolhidos por diferença visual clara, não por serem recentes. O número em laranja é quantos commits separam cada marco do anterior — os intervalos não têm o mesmo peso. A barra abaixo do número mostra o mesmo peso em escala.</p>
    <div class="tl" style="margin-top:38px;flex:1;min-height:0"><div class="tl-eixo"></div><div class="tl-itens">
      ${MARCOS.map((m, i) => {
        const p = posMarco(m), a = i ? posMarco(MARCOS[i - 1]) : null;
        // Do primeiro marco versionado, o salto é a distância até a raiz do repositório;
        // o M0 é anterior ao git e legitimamente não tem de onde contar.
        const salto = p == null ? null : (a == null ? (i ? p : null) : p - a);
        return `<div class="tl-item ${m.id === 'M0' || m.id === 'M8' ? 'forte' : ''}">
        <div class="tl-data">${esc(m.dataExata === false || m.tipo === 'arquivo' ? quando(m) : ddmm(m.data))}</div>
        <div class="tl-era">${esc(m.era)}</div>
        <div class="tl-salto">${salto != null ? `+${salto} commit${salto === 1 ? '' : 's'}` : '&nbsp;'}</div>
        <div class="tl-peso"><span style="width:${salto ? Math.max(2, Math.round(salto / MAIOR_SALTO * 100)) : 0}%"></span></div>
        <div class="tl-ponto"></div>
        <div class="tl-rot">${esc(m.rotulo)}</div>
        <div class="tl-desc">${esc(m.fatos[0])}</div>
        <div class="tl-hash">${esc(selo(m))}</div>
      </div>`; }).join('')}
    </div></div>
  </div>
  ${rodape('')}
</section>`,
`${MARCOS.length} marcos escolhidos por diferença visual clara — não por serem recentes.
O histórico cobre ${M.dias} dias e ${M.commits} commits. Chame atenção para os saltos: junho inteiro cabe entre os dois primeiros pontos, e 15 e 16/07 sozinhos concentram 45% de tudo.
~50s.`,
{ tipo: 'Captura real', imagens: [], quando: `${M.primeiro} → ${M.ultimo}`,
  obs: 'Datas e hashes conferidos com git log; o salto é a distância em commits no histórico linear.' });

// ══ 5–7 · TRÊS GRANDES MOMENTOS ═════════════════════════════════════════════

megaLinha();
listaCommits();

// ══ EVOLUÇÃO EM DETALHE — todas as versões de cada tela ═════════════════════
add(`<section class="slide escuro">
  <div class="sn">EVOLUÇÃO EM DETALHE</div><h2>Tela a tela,<br>versão por versão</h2>
  <p class="psec">Cada slide compara a mesma tela em <b>três pontos do git</b>: o primeiro commit, a véspera da 1.0 e hoje. As diferenças vêm numeradas em cada coluna.</p>
</section>`,
`Divisor do bloco principal. Diga a regra de leitura uma vez: esquerda é o primeiro commit, meio é a véspera da 1.0, direita é hoje.
A coluna do meio é a que mais informa — repare quantas vezes ela é igual à primeira.
~15s.`,
{ tipo: 'Capa', imagens: [], quando: '—', obs: '—' });

tres({
  cena: 'login', kicker: 'Comparação · Tela de entrada',
  titulo: 'O login, nos três pontos',
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', difs: [
      'Cartão branco no centro de um fundo <b>laranja chapado</b>.',
      'Logo, dois campos, um botão. <b>Nada além do formulário</b>.',
      { t: 'Não diz o que é o Luma nem para quem.', nao: true }
    ]},
    { marco: 'M4', rotulo: 'Véspera da 1.0', difs: [
      '<b>Idêntica</b> à do primeiro commit.',
      'O produto chegou à 1.0 com a porta ainda anônima.'
    ]},
    { marco: 'M8', rotulo: 'Hoje', difs: [
      'Vira <b>duas colunas</b>: proposta à esquerda, formulário à direita.',
      'Promete em uma frase: <b>"Arte de agência, pronta em um minuto."</b>',
      'Mostra <b>artes reais</b> — Much+, Combos, Desconto em Dobro.',
      'Declara o público: <b>acesso restrito a franqueados e equipe</b>.'
    ]}
  ],
  conclusao: 'A porta do produto <b>mudou de papel</b>: era só uma catraca e virou a primeira peça de comunicação — quem chega entende o que o Luma faz antes de digitar a senha.',
  nota: `Comece por aqui se tiver pouco tempo: é a comparação mais imediata da apresentação.
Repare que as artes na coluna esquerda são materiais reais do catálogo, não ilustração.
~50s.`
});

tres({
  cena: 'home', kicker: 'Comparação · Vitrine',
  titulo: 'A vitrine, nos três pontos',
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', difs: [
      'Não existe vitrine: o app <b>abre no assistente</b>, com o catálogo numa coluna estreita.',
      'É o layout do piloto Yungas — <b>trocando o vermelho pelo laranja</b>.',
      'A topbar tem uma aba a mais, <b>Dados</b>, que desapareceria depois.',
      { t: 'Sem tela de entrada, sem destaque, sem filtro.', nao: true }
    ]},
    { marco: 'M4', rotulo: 'Véspera da 1.0', difs: [
      'A vitrine <b>já nasceu</b>: saudação, busca e grade de campanhas.',
      'O assistente saiu do centro e virou uma etapa depois da escolha.',
      { t: 'Ainda sem filtro nem campanha em destaque.', nao: true }
    ]},
    { marco: 'M8', rotulo: 'Hoje', difs: [
      'Chamada vira <b>pergunta</b>: "Qual arte vamos criar hoje?".',
      'Busca com <b>exemplo dentro do campo</b> (ex: Sushi, Almoço).',
      'Entra o botão <b>Filtrar</b> ao lado da busca.',
      'Campanha da semana em <b>destaque</b>, com formatos e prazo.'
    ]}
  ],
  conclusao: 'A vitrine <b>não existia no primeiro commit</b>. O Luma nasceu com a mesma tela do piloto — o assistente no centro — e só ganhou uma porta de entrada um mês depois.',
  nota: `A comparação mais reveladora do bloco. O quadro da esquerda é 16/06: o Luma no dia em que entrou no git, com o layout herdado do piloto e só a cor trocada.
A vitrine aparece em julho — foi ela que deu onde morar ao destaque, à busca e ao histórico.
~50s.`
});

tres({
  cena: 'catalogo', kicker: 'Comparação · Campanha aberta',
  titulo: 'A campanha aberta, nos três pontos',
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', difs: [
      'A campanha abre num <b>estado vazio</b>: "Nosso time está trabalhando!".',
      'Havia catálogo, mas <b>nenhum material</b> para escolher dentro dele.',
      'Cards são blocos de cor com texto, sem capa real.'
    ]},
    { marco: 'M4', rotulo: 'Véspera da 1.0', difs: [
      'A campanha ganhou <b>materiais de verdade</b> e a pergunta "Por onde você quer começar?".',
      'Prévia à direita com barra de prova (Postado, Limpo, Guias).'
    ]},
    { marco: 'M8', rotulo: 'Hoje', difs: [
      'Cards passam a exibir a <b>capa real</b> da campanha, vinda do banco.',
      'Rail ganha <b>"Início · Visão geral"</b> e a campanha do momento em destaque.',
      'A prévia perde a barra de prova e vira <b>"Prévia ao vivo"</b>, mais limpa.',
      'Entra o <b>atalho de ajuda</b> flutuante.'
    ]},
  ],
  conclusao: 'Em junho a campanha era uma <b>promessa vazia</b> — "nosso time está trabalhando". Hoje chega com capa real, formatos e prazo, publicada pelo próprio time sem tocar em código.',
  nota: `O quadro da esquerda é honesto sobre o estágio de junho: a estrutura existia, o conteúdo não.
Cada capa que aparece à direita foi publicada sem passar pela engenharia — é o efeito de 247bcd4.
~50s.`
});

tres({
  cena: 'chat', kicker: 'Comparação · O chat que monta a arte',
  titulo: 'O preenchimento, nos três pontos',
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', difs: [
      'Cabeçalho carrega <b>"Assistente criativo"</b> e "Material em edição".',
      'Dois botões competem no topo: <b>Gerar em lote</b> e Reconectar.',
      'Rodapé lista <b>o que falta preencher</b>, campo a campo.',
      'Zoom fixo em <b>20%</b>.'
    ]},
    { marco: 'M4', rotulo: 'Véspera da 1.0', difs: [
      'Layout do chat <b>inalterado</b>.',
      'O trabalho do período foi em <b>não mentir</b>: fim dos avisos de sucesso sem gravação.'
    ]},
    { marco: 'M8', rotulo: 'Hoje', difs: [
      'Cabeçalho enxuto: só <b>campanha e material</b>.',
      'O campo em edição vira <b>chip</b> ao lado da pergunta.',
      'Zoom passa a ter <b>Ajustar</b> e <b>Auto-zoom</b>.',
      'A prévia declara o estado: <b>"aguardando respostas"</b>.'
    ]},
  ],
  conclusao: 'A mecânica de perguntar em passos é <b>a mesma dos três</b>. O que saiu foi ruído no topo e no rodapé; o que entrou foi estado visível e controle de zoom.',
  nota: `Slide para mostrar contenção: a tela mais importante do produto ficou com MENOS elementos, não mais.
~50s.`
});

tres({
  cena: 'designer', kicker: 'Comparação · Estúdio',
  titulo: 'O Estúdio, nos três pontos',
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', difs: [
      'Abre <b>direto no canvas escuro</b>, sem tela intermediária.',
      'Campanhas num painel colorido à direita, com Nova pasta e Importar PSD.',
      'Simular, Preview e <b>Publicar</b> já estão no topo.',
      { t: 'Sem home, sem biblioteca, sem busca.', nao: true }
    ]},
    { marco: 'M4', rotulo: 'Véspera da 1.0', difs: [
      'Nasce a <b>home do Estúdio</b>: "Dê forma à próxima campanha".',
      'Três portas de entrada e um menu de campanha de destino.',
      { t: '"Abertos recentemente" ainda vazio.', nao: true }
    ]},
    { marco: 'M8', rotulo: 'Hoje', difs: [
      'Título vira <b>"Crie seu próximo material"</b> — a ação, não a metáfora.',
      'Três portas de entrada <b>alinhadas</b>: tela limpa, PSD e SVG.',
      'Nasce <b>"Todos os materiais"</b>: grade com miniatura real e selo de publicado.',
      'Entram <b>busca</b> e dois filtros — por campanha e por status.'
    ]},
  ],
  conclusao: 'Três estágios visíveis: <b>canvas puro</b> em junho, <b>uma porta de entrada</b> em julho, <b>um acervo</b> hoje. A diferença entre o primeiro e o último é a diferença entre uma ferramenta e uma biblioteca.',
  nota: `O slide mais forte do bloco, e agora com o estágio que faltava: em junho o Estúdio era só o canvas — abria com a prancheta preta e as ferramentas em volta.
A home aparece em julho; a biblioteca com busca e status, só no fim.
~1min.`
});

tres({
  cena: 'exportar', kicker: 'Comparação · Exportação',
  titulo: 'A saída do arquivo, nos três pontos',
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', difs: [
      'Três formatos: <b>PNG, JPG e SVG</b>.',
      'Escala já oferece <b>2× (alta resolução)</b>.',
      'Seleção de pranchetas com contagem.'
    ]},
    { marco: 'M4', rotulo: 'Véspera da 1.0', difs: [
      'Mesmos três formatos na tela.',
      'Por baixo, 17/07 trouxe <b>z-order confiável</b> e raster adaptativo à prancheta.'
    ]},
    { marco: 'M8', rotulo: 'Hoje', difs: [
      'Entra o quarto formato: <b>PSD (Photoshop)</b>, em linha própria.',
      'O designer leva a arte para fora <b>com as camadas</b>, não achatada.'
    ]},
  ],
  conclusao: 'Uma linha nova no modal que muda o lugar do Luma no fluxo: a arte deixa de ser <b>ponto final</b> e passa a poder continuar no Photoshop.',
  nota: `Diferença pequena na tela, grande no processo. Antes, sair do Luma era achatar a arte.
Complementa o import de PSD que já existia: agora o caminho é de ida e volta.
~40s.`
});

tres({
  cena: 'minhas-artes', kicker: 'Comparação · Minhas artes',
  titulo: 'O histórico: a tela que já nasceu pronta',
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', difs: [
      'É uma <b>aba na coluna estreita</b>, não uma tela: divide espaço com o assistente.',
      'Filtros já existem — Todas, Rascunhos, Baixadas — todos zerados.',
      'O vazio diz "Ainda não <b>tens</b> artes geradas": português de Portugal.'
    ]},
    { marco: 'M4', rotulo: 'Véspera da 1.0', difs: [
      'Vira <b>tela inteira</b>: "Sua biblioteca criativa".',
      'O vazio passa a ensinar o caminho, com "Explorar campanhas".'
    ]},
    { marco: 'M8', rotulo: 'Hoje', difs: [
      'Ainda <b>praticamente igual</b> — mudou o atalho de ajuda, que virou flutuante.',
      'O que evoluiu foi <b>invisível</b>: o histórico saiu do navegador e foi para o banco.'
    ]},
  ],
  conclusao: 'Saiu de uma aba espremida para uma tela própria — e aí <b>parou</b>. O contraexemplo útil da apresentação: entre julho e hoje ela ganhou trava de escrita e aviso de conflito sem mudar um pixel.',
  nota: `Slide honesto e importante. Se todas as telas mudassem muito, a apresentação estaria contando a história errada.
Esta chegou certa no primeiro dia. O trabalho foi fazer o dado sobreviver por trás dela.
~45s.`
});

tres({
  cena: 'perfil', kicker: 'Comparação · Conta e permissões',
  titulo: 'O painel de conta, nos três pontos',
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', difs: [
      'Modal pequeno com <b>Dados, Segurança, Estatísticas e Equipe</b>.',
      'E-mail é <b>campo editável comum</b>.',
      'Tema fica junto dos dados pessoais, sem explicação.'
    ]},
    { marco: 'M4', rotulo: 'Véspera da 1.0', difs: [
      'Mesma estrutura.',
      'O período endureceu o que está <b>atrás</b> desta tela: gate de conta desativada e convite real por Edge Function.'
    ]},
    { marco: 'M8', rotulo: 'Hoje', difs: [
      'Vira painel largo, <b>"Conta e gestão"</b>, com conteúdo em cards.',
      'O rail mostra o <b>nível de acesso</b>: Equipe marcada ADMIN, Console marcado DEV.',
      'E-mail fica <b>travado</b>, com o motivo escrito ao lado.',
      '"Atividade" entra no lugar de "Estatísticas".'
    ]}
  ],
  conclusao: 'A conta deixou de ser um formulário e virou o lugar onde <b>a permissão fica visível</b>. O e-mail travado com explicação é a diferença entre um campo que falha e um campo que ensina.',
  nota: `Slide bom para quem cuida de acesso. O selo DEV ao lado de Console é a entrada do Luma CLI aparecendo na interface — antes era só atalho de teclado.
~50s.`
});

tres({
  cena: 'chat-mobile', kicker: 'Comparação · O chat no celular',
  titulo: 'O preenchimento no telefone, nos três pontos',
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', difs: [
      'Cabeçalho repete <b>"Material em edição"</b>; duas frases antes de perguntar.',
      'Bloco <b>"Criar várias de uma vez"</b> disputa espaço com o passo 1.',
      'A prévia é um <b>botão de olho</b>: para ver a arte, é preciso abrir.'
    ]},
    { marco: 'M4', rotulo: 'Véspera da 1.0', difs: [
      'Mesmo texto e mesmo cabeçalho.',
      'O botão de olho vira <b>miniatura da arte</b>, sempre visível no canto.'
    ]},
    { marco: 'M8', rotulo: 'Hoje', difs: [
      'Cabeçalho traz <b>campanha e formato</b>, só o necessário.',
      'Uma frase antes de perguntar, no lugar de duas.',
      'O campo em edição vira <b>chip</b> dentro da pergunta.'
    ]}
  ],
  conclusao: 'No telefone cada linha custa caro. A miniatura chegou <b>antes da 1.0</b>; o que veio depois foi o corte de texto — o cabeçalho e a introdução encolheram para sobrar tela.',
  nota: `A miniatura flutuante é a "prévia viva" de 16/07 chegando ao chat: no celular, ver a arte enquanto responde é a diferença entre confiar e conferir depois.
Repare que aqui a coluna do meio JÁ difere da primeira — é a exceção no bloco.
~45s.`
});

comparar({
  cena: 'home-mobile', kicker: 'Área · Celular',
  titulo: 'De adaptado a pensado para a tela pequena',
  antes: 'M0', depois: 'M8', rotA: 'Piloto no celular', rotB: 'Hoje no celular',
  notaA: 'Layout de desktop espremido na largura do telefone.',
  notaB: 'Vitrine própria de celular, com alvos de toque e navegação por gesto.',
  conclusao: 'Em 16/07 o telefone ganha tratamento próprio: prévia com a arte dentro do aparelho e PWA instalável. <b>Deixou de ser um desktop menor.</b>',
  nota: `Se houver franqueado na sala, este slide fala com ele: o uso real acontece no celular.
~35s.`
});

// CLI — nasceu no fim, não tem "antes"
if (tem('M8', 'cli')) {
  add(`<section class="slide">${topo('Área · Ferramenta interna', '30/07/2026')}
    <div class="corpo" style="display:flex;gap:44px">
      <div style="flex:1.35;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <div class="moldura" style="--ar:${ar(img('M8','cli'))}"><img src="${img('M8','cli')}" alt="Luma CLI"></div>
        <div class="legenda"><span class="eti eti-novo">não existia antes</span><span class="rot">Luma CLI</span>
          <span class="meta">30/07/2026 · branch atual</span></div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <h2 class="titulo" style="font-size:44px">Uma superfície para quem <em style="font-style:normal;color:var(--laranja-d)">mantém</em> o Luma</h2>
        <div class="sub" style="font-size:20px">Nasceu de um incidente real de sync em que o diagnóstico era colar snippet no DevTools.</div>
        <ul class="fatos" style="margin-top:22px">
          <li><span><b>diag</b> — radiografia de sessão, sync, cache, banco e IA</span></li>
          <li><span><b>sync push/pull</b> — força a sincronização e mostra antes → depois</span></li>
          <li><span>Qualquer frase vira pergunta para a IA, com o contexto real da sessão</span></li>
        </ul>
        <div class="conclusao" style="position:static;margin-top:20px;font-size:19px">O gate por perfil é de UX. Quem protege o dado continua sendo a <b>RLS no banco</b> — o console não dá poder que o DevTools já não desse.</div>
      </div>
    </div>
    ${rodape('execução real do commit')}
  </section>`,
  `Slide sem "antes", e é esse o ponto: o produto passou a ter ferramenta interna própria.
O conhecimento que morava na cabeça de quem debugava virou comando nomeado.
Ressalte a última linha se houver alguém de segurança na sala.
~50s.`,
  { tipo: 'Captura real', imagens: [img('M8','cli')], quando: '30/07/2026 (branch atual)',
    obs: 'Sem versão anterior: a tela nasceu em 30/07 (c9790e8 e e48b7ff).' });
}

// ── recortes ampliados ──
detalhe({
  kicker: 'Detalhe · Identidade', titulo: 'A barra superior, ampliada',
  cena: 'home', regiao: { y: 0, h: 5.5 },
  versoes: [
    { marco: 'M0', rotulo: 'Piloto Yungas', obs: 'Vermelho saturado, logo da Delivery Much, alternador com cantos vivos e um botão de ajuda solto ao lado.' },
    { marco: 'M3', rotulo: 'Catálogo vivo', obs: 'Já é Luma: laranja da marca, logo próprio, alternador em pílula com ícone e o avatar mostrando nome e função.' },
    { marco: 'M8', rotulo: 'Hoje', obs: 'Praticamente inalterada desde 16/07 — as duas faixas são quase indistinguíveis.' }
  ],
  conclusao: 'A identidade virou de uma vez, no dia 16, e <b>parou de mudar</b>. Numa base que cresceu vinte vezes desde então, a faixa que aparece em toda tela ficou igual — é o sinal de um design system que pegou.',
  nota: `Slide de design system, e o achado aqui é o contrário do esperado: as duas últimas faixas são quase idênticas.
Isso é a mensagem. A identidade se resolveu cedo e não precisou de retoque, enquanto o resto do produto quadruplicou de tamanho.
Se alguém perguntar por que não mostrar mais versões: porque não há diferença para mostrar.
~45s.`
});

detalhe({
  kicker: 'Detalhe · Chamada da vitrine', titulo: 'O topo da vitrine, ampliado',
  cena: 'home', regiao: { y: 6, h: 29 },
  versoes: [
    { marco: 'M1', rotulo: 'Primeira vitrine no git', obs: 'A vitrine existe, mas a chamada ainda divide espaço com a estrutura de navegação.' },
    { marco: 'M8', rotulo: 'Hoje', obs: 'Saudação com o nome, uma pergunta que orienta a próxima ação, busca com exemplo dentro do campo e o atalho para o histórico à direita.' }
  ],
  conclusao: 'O mesmo espaço passou a responder três perguntas de uma vez: <b>quem sou eu aqui, o que faço agora e onde está o que já comecei</b>.',
  nota: `Este é o recorte que melhor mostra intenção de produto: o texto "Qual arte vamos criar hoje?" não é enfeite, é o que transforma uma tela de lista numa tela de decisão.
O placeholder da busca traz exemplo real (Sushi, Almoço) em vez de "digite aqui".
~45s.`
});

detalhe({
  kicker: 'Recorte · Cabeçalho do chat', titulo: 'O topo do chat, ampliado',
  cena: 'chat', regiao: { y: 4, h: 9 },
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', obs: 'Três informações competindo: o nome do assistente, o material em edição e dois botões de ação.' },
    { marco: 'M4', rotulo: 'Véspera da 1.0', obs: 'Sem mudança — o cabeçalho atravessou as duas semanas igual.' },
    { marco: 'M8', rotulo: 'Hoje', obs: 'Sobra o que orienta: campanha, material e formato. As ações saíram para onde são usadas.' }
  ],
  conclusao: 'O topo do chat perdeu <b>um botão e um rótulo</b> e ganhou clareza. Menos elementos disputando a mesma faixa é o que faz a pergunta do assistente virar o assunto da tela.',
  nota: `Recorte que mostra edição, não adição. "Assistente criativo" era o nome interno da feature aparecendo na cara do usuário.
~40s.`
});

detalhe({
  kicker: 'Recorte · Rodapé do chat', titulo: 'A barra de resposta, ampliada',
  cena: 'chat', regiao: { y: 90, h: 10 },
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', obs: 'Campo de resposta e, ao lado, o zoom travado num valor fixo com os controles de prova.' },
    { marco: 'M4', rotulo: 'Véspera da 1.0', obs: 'Mesma barra.' },
    { marco: 'M8', rotulo: 'Hoje', obs: 'Ganha Ajustar e Auto-zoom: a prévia passa a se encaixar sozinha no espaço disponível.' }
  ],
  conclusao: 'A faixa onde o franqueado <b>de fato digita</b>. O zoom deixou de ser um número para configurar e virou um comportamento que a tela resolve.',
  nota: `Detalhe pequeno com efeito grande em telas menores: com zoom fixo, a prévia ficava cortada em notebook de 13 polegadas.
~35s.`
});

detalhe({
  kicker: 'Recorte · Cabeçalho do Estúdio', titulo: 'A chamada do Estúdio, ampliada',
  cena: 'designer', regiao: { y: 5, h: 13 },
  versoes: [
    { marco: 'M1', rotulo: 'Primeiro commit', obs: '"Dê forma à próxima campanha" — metáfora, com a campanha de destino escondida num menu suspenso à direita.' },
    { marco: 'M4', rotulo: 'Véspera da 1.0', obs: 'Idêntica.' },
    { marco: 'M8', rotulo: 'Hoje', obs: '"Crie seu próximo material" — a ação literal, com a pasta de destino visível como botão nomeado.' }
  ],
  conclusao: 'A troca de <b>metáfora por ação</b>. O designer que abre o Estúdio quer criar um material, não dar forma a uma campanha — e a pasta de destino saiu de um menu para a superfície.',
  nota: `Slide de copy, e o ponto é que copy é interface. "Dê forma à próxima campanha" soa bem e não diz o que fazer.
~40s.`
});

ganhos({
  kicker: 'O que foi aprimorado',
  titulo: 'Oito melhorias que a linha do tempo mostra',
  itens: [
    { t: 'Uma porta de entrada', d: 'A tela inicial deixou de ser o meio do trabalho e passou a orientar a escolha.', q: 'vitrine · 16/07' },
    { t: 'Campanha sem deploy', d: 'Publicar uma campanha virou criar uma pasta — sem passar pela engenharia.', q: '247bcd4 · 16/07' },
    { t: 'Trabalho que não se perde', d: 'Histórico no banco, com trava de escrita e aviso de conflito entre aparelhos.', q: 'sync · 16/07' },
    { t: 'Celular com linguagem própria', d: 'Prévia com a arte dentro do aparelho, alvos de toque e PWA instalável.', q: '57cbe74 · 16/07' },
    { t: 'PSD que chega inteiro', d: 'Z-order confiável e raster adaptativo à prancheta: o export 2× deixou de borrar.', q: 'ed254c4 · 17/07' },
    { t: 'Feedback que não mente', d: 'Fim dos sucessos falsos: o que não subiu ao banco parou de exibir confirmação verde.', q: '882cda0 · 20/07' },
    { t: 'IA como camada', d: 'Um motor único para legenda, encaixe de texto, ajuda aterrada e leitura de cardápio.', q: 'fc36ae4 · 30/07' },
    { t: 'Ferramenta de quem mantém', d: 'Console com diagnóstico nomeado — o que era snippet no DevTools virou comando.', q: 'c9790e8 · 30/07' }
  ],
  nota: `O slide-resumo do bloco. Cada item tem commit e data, então nenhum é impressão.
Se precisar cortar tempo, este slide substitui os sete de tira — mas perde a evidência visual.
~1min10.`
});

// ══ 14–18 · ATLAS ═══════════════════════════════════════════════════════════
add(`<section class="slide escuro">
  <div class="sn">ATLAS</div><h2>Onde tudo<br>está hoje</h2>
  <p class="psec">Cada recurso marcado sobre a tela real, com o caminho exato até ele. As posições foram medidas no DOM da versão atual — nenhum contorno foi desenhado no olho.</p>
</section>`,
`Divisor do bloco mais útil para quem vai usar o Luma amanhã: é literalmente um mapa.
~10s.`,
{ tipo: 'Capa', imagens: [], quando: '—', obs: '—' });

const comFeats = ATLAS.filter(q => q.feats.length);
comFeats.forEach((q, i) => atlasSlide(q, i + 1, comFeats.length));

// ══ 19 · MUCH+ ══════════════════════════════════════════════════════════════
if (tem('M8', 'muchplus') && tem('M8', 'catalogo')) {
  add(`<section class="slide">${topo('Recursos especiais · Much+', '30/07/2026')}
    <div class="corpo" style="bottom:196px">
      <h2 class="titulo" style="font-size:48px;margin-bottom:22px">A campanha que troca a cara do app</h2>
      <div class="telas" style="height:calc(100% - 78px)">
        ${painel('M8', 'catalogo', 'Campanha comum', { cls: 'eti-antes', txt: 'padrão' }, 'Identidade Luma: laranja da marca, acentos laranja, FAB de ajuda laranja.')}
        ${painel('M8', 'muchplus', 'Campanha Much+', { cls: 'eti-hoje', txt: 'tema' }, 'Dentro da Much+, o app inteiro se re-tokeniza: topbar, acentos e FAB viram magenta.')}
      </div>
    </div>
    <div class="conclusao">Não é uma tela nova — é o <b>mesmo app com outros tokens</b>. O tema vive na campanha, então uma marca parceira entra sem fork e sem tela dedicada. Na vitrine ele é contido; dentro da campanha, assume.</div>
    ${rodape('duas execuções reais, mesma versão')}
  </section>`,
  `Slide de design system. As duas imagens são do MESMO commit, no mesmo dia — a diferença é só a campanha aberta.
Isso prova que a troca de tema é por token, não por código duplicado. É o que permite receber uma marca parceira sem fork.
O tema foi concebido no luma-brain em 22/07, antes de existir em código.
~50s.`,
  { tipo: 'Captura real', imagens: [img('M8','catalogo'), img('M8','muchplus')], quando: '30/07/2026 (branch atual)',
    obs: 'Mesma versão, duas campanhas — a diferença visual é o tema por token.' });
}

// ══ 20 · ALÉM DA APARÊNCIA ══════════════════════════════════════════════════
add(`<section class="slide">${topo('Evolução além da aparência')}
  <div class="corpo">
    <h2 class="titulo" style="font-size:52px">O que amadureceu por baixo</h2>
    <div class="lista" style="margin-top:30px">
      <div class="li"><div class="n">01</div><div><h4>Dado com dono</h4>
        <p>O piloto guardava tudo no navegador. Hoje há Postgres com ${M.migrations} migrations e RLS: a permissão do franqueado é regra de banco, não decisão da interface.</p></div></div>
      <div class="li"><div class="n">02</div><div><h4>Rede que falha sem perder trabalho</h4>
        <p>Sync offline-first: push com debounce, fila de deleções, template aberto que sobrevive ao pull do boot e aviso de conflito entre aparelhos.</p></div></div>
      <div class="li"><div class="n">03</div><div><h4>IA como camada, não como truque</h4>
        <p>Um motor único atende legenda, encaixe de texto, ajuda aterrada e leitura de cardápio. A chave vive no servidor, em Edge Function.</p></div></div>
      <div class="li"><div class="n">04</div><div><h4>Feedback que não mente</h4>
        <p>Fim dos "sucessos falsos": o que não subiu para o banco deixou de exibir confirmação verde.</p></div></div>
      <div class="li"><div class="n">05</div><div><h4>Um produto que se cuida</h4>
        <p>Console interno com diagnóstico nomeado, linter de template e a máquina do tempo que reabre qualquer versão antiga — a mesma que produziu estes slides.</p></div></div>
    </div>
  </div>
  ${rodape('')}
</section>`,
`O slide que responde "amadureceu em quê, exatamente".
O item 4 é o mais subestimado: um aviso de sucesso que mente custa mais caro que um erro visível.
O item 5 é meta — a ferramenta que reabre versões antigas é a que gerou esta apresentação.
~1min10.`,
{ tipo: 'Captura real', imagens: [], quando: `${M.primeiro} → ${M.ultimo}`,
  obs: 'Síntese de commit-map/luma-timeline.md e docs/LUMA-BACKEND-CHANGELOG.md.' });

// ══ 21 · O LUMA ATUAL ═══════════════════════════════════════════════════════
// Ordem deliberada: primeiro as telas que ainda NÃO tiveram slide próprio, depois as
// principais como fecho. Quinze telas em cinco slides cansava — vitrine, chat e Estúdio
// já haviam aparecido três vezes cada (comparação, atlas e galeria).
const galeria = ['novo-material', 'psd', 'atalhos', 'catalogo-mobile', 'home-mobile', 'muchplus',
                 'home', 'designer', 'cli'].filter(c => tem('M8', c));
const ROT = { home:'Vitrine', catalogo:'Campanha aberta', chat:'Chat que monta a arte', 'minhas-artes':'Minhas artes',
              designer:'Estúdio', exportar:'Exportar', cli:'Console do time', muchplus:'Tema Much+',
              login:'Entrada', perfil:'Conta e gestão', 'novo-material':'Criar material',
              psd:'Importar PSD', atalhos:'Atalhos do Estúdio',
              'catalogo-mobile':'Campanha no celular', 'chat-mobile':'Chat no celular' };
const DESC = {
  home: 'Saudação, busca com exemplo, campanha da semana em destaque e a grade de prontas para usar.',
  catalogo: 'Materiais da campanha com capa real, formato e validade — e a prévia esperando à direita.',
  chat: 'Cinco passos, sugestões clicáveis e a arte se montando ao lado enquanto as respostas entram.',
  'minhas-artes': 'Rascunho retomável, ligado ao template que deu origem à arte.',
  designer: 'Três portas de entrada e a biblioteca do time, com busca e filtro por campanha e status.',
  exportar: 'PNG, JPG, SVG e PSD, com escala 2× e seleção de pranchetas em lote.',
  cli: 'Diagnóstico de sync, catálogo, cache e banco em comandos nomeados — e IA no mesmo campo.',
  muchplus: 'A campanha que re-tokeniza o app inteiro: mesma estrutura, outra marca.',
  login: 'Proposta de valor à esquerda, formulário à direita, acesso declarado no rodapé.',
  perfil: 'Dados, segurança, atividade, equipe e console — com o nível de acesso à vista.',
  'novo-material': 'Presets por canal, medida livre, campanha de destino e pré-visualização.',
  psd: 'Camadas do Photoshop chegam editáveis, com z-order confiável.',
  atalhos: 'A folha de atalhos do Estúdio, para quem trabalha sem tirar a mão do teclado.',
  'catalogo-mobile': 'A campanha no telefone, com os materiais em coluna única.',
  'chat-mobile': 'Cinco passos no celular, com a arte em miniatura flutuante.'
};
// Três por slide: acima disso o quadro encolhe e a legenda deixa de ser verificável.
for (let i = 0; i < galeria.length; i += 3) {
  const grupo = galeria.slice(i, i + 3);
  const parte = Math.floor(i / 3) + 1, partes = Math.ceil(galeria.length / 3);
  add(`<section class="slide">${topo(`O Luma atual · ${parte} de ${partes}`, '30/07/2026 · branch atual')}
    <div class="corpo">
      <h2 class="titulo" style="font-size:46px;margin-bottom:20px">${esc(grupo.map(c => ROT[c] || c).join(' · '))}</h2>
      <div class="t3" style="height:calc(100% - 74px)">
        ${grupo.map(c => `<div class="t3-col atual">
          <div class="t3-img" style="--ar:${ar(img('M8', c))}"><img src="${img('M8', c)}" alt="${esc(ROT[c] || c)}"></div>
          <div class="t3-cab"><span class="r">${esc(ROT[c] || c)}</span></div>
          <div class="nota" style="margin-top:9px">${esc(DESC[c] || '')}</div>
        </div>`).join('')}
      </div>
    </div>
    ${rodape('execuções reais da branch atual')}
  </section>`,
  `Panorama ${parte} de ${partes}: ${grupo.map(c => ROT[c]).join(', ')}.
Não descreva tela por tela — deixe a imagem falar e diga que tudo saiu da mesma versão, no mesmo dia.
~30s.`,
  { tipo: 'Estado atual', imagens: grupo.map(c => img('M8', c)), quando: '30/07/2026 (branch atual)',
    obs: 'Todas do mesmo commit.' });
}

// ══ 22 · A DIMENSÃO DA EVOLUÇÃO ═════════════════════════════════════════════
add(`<section class="slide">${topo('A dimensão da evolução', 'só números reais')}
  <div class="corpo">
    <h2 class="titulo" style="font-size:52px">O tamanho do salto</h2>
    <div class="numeros" style="grid-template-columns:repeat(4,1fr);margin-top:40px">
      <div class="card"><div class="v">1 <small>→</small> ${M.arqJs}</div><div class="r">arquivos de JavaScript.<br>A origem era um arquivo só.</div></div>
      <div class="card"><div class="v">${br(M.linhasJs)}</div><div class="r">linhas de JS hoje,<br>mais ${br(M.linhasCss)} de CSS</div></div>
      <div class="card"><div class="v">${br(M.fnTotal)}</div><div class="r">funções globais nomeadas<br>(${M.fnD} no Estúdio, ${M.fnF} no franqueado)</div></div>
      <div class="card destaque"><div class="v">${M.migrations}</div><div class="r">migrations de banco —<br>a origem não tinha backend</div></div>
      <div class="card"><div class="v">${MARCOS.length}</div><div class="r">marcos selecionados,<br>de ${M.commits} commits analisados</div></div>
      <div class="card"><div class="v">${totalShots}</div><div class="r">capturas reais produzidas,<br>nenhuma reconstruída</div></div>
      <div class="card"><div class="v">${totalFeats}</div><div class="r">funcionalidades mapeadas<br>no atlas, medidas no DOM</div></div>
      <div class="card"><div class="v">0</div><div class="r">dependências de runtime<br>no front — segue vanilla</div></div>
    </div>
  </div>
  ${rodape('')}
</section>`,
`Todos contados no repositório na hora em que a apresentação foi gerada — nenhum é estimativa.
O último card costuma surpreender engenheiro: cresceu tudo isso **sem** adotar framework nem build.
Se perguntarem sobre adoção ou uso: esses números não existem aqui. O repositório mede código, não usuários.
~1min.`,
{ tipo: 'Captura real', imagens: [], quando: 'apurado na montagem',
  obs: 'wc -l em js/ e css/; grep "^function <prefixo>"; ls supabase/migrations; contagem de PNGs em disco.' });

// ══ 23 · FECHAMENTO ═════════════════════════════════════════════════════════
add(`<section class="slide escuro">
  <div class="marca">Para fechar</div>
  <h1>De ferramenta<br><em>a produto.</em></h1>
  <div class="csub">O Luma não evoluiu apenas em quantidade de telas. Ele consolidou uma experiência, uma linguagem visual própria e uma forma de resolver necessidades reais da operação — sem nunca deixar de ser aberto num arquivo HTML.</div>
  <div class="meta">
    <div><b>Ainda em construção</b>o roadmap da v1 segue aberto em luma-brain/07</div>
    <div><b>Reproduzível</b>node docs/luma-evolution/scripts/tudo.js --v2</div>
  </div>
</section>`,
`Fechamento. A última oração da frase tem lastro: o produto cresceu vinte vezes e continua sem build, sem framework e sem dependência de runtime.
Termine convidando: a apresentação se regenera com um comando, então acompanha o produto em vez de envelhecer.
~40s.`,
{ tipo: 'Capa', imagens: [], quando: '—', obs: '—' });

module.exports = { slides, notas, indice, M, totalShots, totalFeats, MARCOS,
                   titulo: 'Luma — de uma necessidade a um produto' };
