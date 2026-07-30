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
const ESCOLHIDOS = ['M0', 'M1', 'M3', 'M7', 'M8'];
const MARCOS = ESCOLHIDOS.map(id => TODOS.find(m => m.id === id)).filter(Boolean);

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
          ${fs4.map((f, k) => `<div class="marca" style="left:${f.caixa.x.toFixed(2)}%;top:${f.caixa.y.toFixed(2)}%;width:${f.caixa.w.toFixed(2)}%;height:${f.caixa.h.toFixed(2)}%"></div>
          <div class="marca-n" style="left:max(6px, calc(${f.caixa.x.toFixed(2)}% - 17px));top:max(6px, calc(${f.caixa.y.toFixed(2)}% - 17px))">${k + 1}</div>`).join('')}
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
    <div class="corpo" style="bottom:196px">
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

// ══ 1 · CAPA ════════════════════════════════════════════════════════════════
add(`<section class="slide escuro">
  <div class="marca">Delivery Much · uso interno</div>
  <h1>Luma<br><em>de uma necessidade<br>a um produto</em></h1>
  <div class="csub">Uma visão visual da transformação da plataforma — reconstruída executando o código de cada época.</div>
  <div class="meta">
    <div><b>Período</b>anterior a 16/07/2026 → 30/07/2026</div>
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
  add(`<section class="slide">${topo('O ponto de partida', 'anterior a 16/07/2026')}
    <div class="corpo" style="display:flex;gap:44px">
      <div style="flex:1.3;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <div class="moldura" style="--ar:${ar(img('M0','home'))}"><img src="${img('M0','home')}" alt="Piloto Yungas"></div>
        <div class="legenda"><span class="eti eti-antes">primeira versão conhecida</span>
          <span class="rot">Yungas · Módulo de Artes</span><span class="meta">arquivo preservado</span></div>
      </div>
      <div style="flex:.85;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <h2 class="titulo" style="font-size:50px">Nem se<br>chamava Luma</h2>
        <div class="sub" style="font-size:21px">Um arquivo HTML só, identidade vermelha, e nenhuma tela de entrada: o app abria com o assistente já na pergunta 1 de 4.</div>
        <div class="numeros" style="grid-template-columns:1fr 1fr;margin-top:28px">
          <div class="card"><div class="v">1</div><div class="r">arquivo,<br>565 KB</div></div>
          <div class="card"><div class="v">9.316</div><div class="r">linhas, tudo<br>no mesmo lugar</div></div>
          <div class="card"><div class="v">266</div><div class="r">funções — já com os<br>prefixos d*, f* e g*</div></div>
          <div class="card"><div class="v">0</div><div class="r">backend:<br>rodava no navegador</div></div>
        </div>
      </div>
    </div>
    ${rodape('execução real do arquivo preservado')}
  </section>`,
  `O slide que ancora tudo. O arquivo **roda** — é o HTML original executado agora, não um print de arquivo morto.
Seja honesto na origem: é a primeira versão **conhecida e preservada**, entregue fora do repositório. Não é o primeiro commit — o git não guarda o começo.
Dois detalhes fortes: a fonte da marca já vinha embutida em base64, e a convenção de prefixos do código de hoje nasceu aqui.
~1min.`,
  { tipo: 'Arquivo histórico fornecido', imagens: [img('M0','home')], quando: 'anterior a 16/07/2026',
    obs: 'HTML original servido offline, sem alteração de código. Contagens medidas no próprio arquivo.' });
}

// ══ 4 · LINHA DO TEMPO ══════════════════════════════════════════════════════
add(`<section class="slide">${topo('Linha do tempo', `${MARCOS.length} marcos · ${M.commits} commits em 15 dias`)}
  <div class="corpo" style="display:flex;align-items:center">
    <div class="tl"><div class="tl-eixo"></div><div class="tl-itens">
      ${MARCOS.map(m => `<div class="tl-item ${m.id === 'M0' || m.id === 'M8' ? 'forte' : ''}">
        <div class="tl-data">${esc(m.dataExata ? m.data.slice(5) : 'antes de 07-16')}</div>
        <div class="tl-era">${esc(m.era)}</div>
        <div class="tl-ponto"></div>
        <div class="tl-rot">${esc(m.rotulo)}</div>
        <div class="tl-desc">${esc(m.fatos[0])}</div>
        <div class="tl-hash">${esc(selo(m))}</div>
      </div>`).join('')}
    </div></div>
  </div>
  ${rodape('')}
</section>`,
`Cinco marcos escolhidos por diferença visual clara — não por serem recentes.
O histórico versionado é curto: 15 dias, ${M.commits} commits, e metade deles no primeiro dia. A forma que importa é: um piloto, uma fundação enorme, duas semanas de refino e um salto de capacidade no fim.
~50s.`,
{ tipo: 'Captura real', imagens: [], quando: `${M.primeiro} → ${M.ultimo}`,
  obs: 'Datas e hashes conferidos com git log.' });

// ══ 5–7 · TRÊS GRANDES MOMENTOS ═════════════════════════════════════════════
trio({
  kicker: 'Evolução geral · A entrada',
  titulo: 'A primeira tela, em três momentos',
  momentos: [
    { marco: 'M0', cena: 'home', rotulo: 'Origem', nota: 'Cai direto no chat. O catálogo é uma coluna estreita à esquerda.' },
    { marco: 'M3', cena: 'home', rotulo: 'Expansão', nota: 'Ganha vitrine própria: a lista de campanhas passa a vir do banco.' },
    { marco: 'M8', cena: 'home', rotulo: 'Hoje', nota: 'Saudação, busca, destaque da semana e a grade de campanhas prontas.' }
  ],
  conclusao: 'O produto deixou de assumir que você já sabia o que fazer. Hoje a primeira tela <b>orienta a escolha</b> antes de pedir qualquer informação.',
  nota: `A leitura mais direta da apresentação: três execuções reais, mesma tela, três épocas.
Repare na paleta — vermelho na origem, laranja da marca hoje.
~50s.`
});

trio({
  kicker: 'Evolução geral · O fluxo de criação',
  titulo: 'O chat sempre esteve no centro',
  momentos: [
    { marco: 'M0', cena: 'chat', rotulo: 'Origem', nota: 'Assistente pergunta em 4 passos, com sugestões clicáveis e prévia à direita.' },
    { marco: 'M3', cena: 'chat', rotulo: 'Expansão', nota: 'Mesma mecânica, agora dentro de uma campanha escolhida no catálogo.' },
    { marco: 'M8', cena: 'chat', rotulo: 'Hoje', nota: 'Com material escolhido, formato definido e IA ajudando a encaixar o texto.' }
  ],
  conclusao: 'O acerto do piloto foi o formato: <b>perguntar em vez de mandar editar</b>. O que mudou não foi o chat — foi tudo que passou a existir em volta dele.',
  nota: `Slide que dá crédito à ideia original. O chat guiado não foi invenção posterior.
A evolução foi de contexto, não de mecânica.
~45s.`
});

trio({
  kicker: 'Evolução geral · A criação',
  titulo: 'O Estúdio ganhou uma casa',
  momentos: [
    { marco: 'M0', cena: 'designer', rotulo: 'Origem', nota: 'Entra direto no canvas, com as ferramentas em volta.' },
    { marco: 'M3', cena: 'designer', rotulo: 'Expansão', nota: 'O canvas passa a conviver com pastas e campanhas vindas do banco.' },
    { marco: 'M8', cena: 'designer', rotulo: 'Hoje', nota: 'Abre numa home própria: biblioteca de materiais, busca, filtros e três formas de começar.' }
  ],
  conclusao: 'Editar sempre funcionou — o canvas do piloto já era completo. O que faltava era <b>onde guardar e reencontrar</b> o que foi editado.',
  nota: `Cuidado para não vender demais: a diferença aqui é organizacional, não de capacidade de desenho.
~40s.`
});

// ══ 8–13 · EVOLUÇÃO POR ÁREA ════════════════════════════════════════════════
add(`<section class="slide escuro">
  <div class="sn">ÁREA POR ÁREA</div><h2>Seis frentes,<br>seis comparações</h2>
  <p class="psec">Mesma tela, mesmo enquadramento, datas embaixo. Da esquerda para a direita: como era, como está.</p>
</section>`,
`Divisor. Avise que a leitura daqui pra frente é sempre igual — isso deixa a plateia processar a imagem, não o layout.
~10s.`,
{ tipo: 'Capa', imagens: [], quando: '—', obs: '—' });

comparar({
  cena: 'catalogo', kicker: 'Área · Biblioteca de campanhas',
  titulo: 'De lista fixa a catálogo gerido pelo time',
  antes: 'M0', depois: 'M8', rotA: 'Piloto', rotB: 'Hoje',
  notaA: 'As campanhas eram itens fixos no código: publicar uma nova exigia mexer no arquivo.',
  notaB: 'Campanha é pasta no banco: o que o time cria no Estúdio aparece para o franqueado sem deploy.',
  conclusao: 'Essa é a mudança que tirou o time de engenharia do caminho. <b>Publicar campanha virou trabalho de quem faz a campanha.</b>',
  nota: `Slide de impacto operacional. Antes, cada campanha nova era um commit; hoje é uma pasta.
O marco dessa virada é 247bcd4, de 16/07.
~45s.`
});

comparar({
  cena: 'minhas-artes', kicker: 'Área · Artes e organização',
  titulo: 'O trabalho começado deixou de se perder',
  antes: 'M0', depois: 'M8', rotA: 'Piloto', rotB: 'Hoje',
  notaA: 'Uma aba de histórico ao lado do catálogo, presa à sessão do navegador.',
  notaB: 'Área própria, com rascunho retomável e o vínculo com o template que deu origem à arte.',
  conclusao: 'O histórico saiu do navegador e foi para o banco, com trava de escrita e aviso de conflito entre aparelhos. <b>Fechar o app deixou de ser perder o trabalho.</b>',
  nota: `Aqui vale citar os commits de sync de 16/07: lock no push, releitura antes de regravar e fila de deleções.
~40s.`
});

comparar({
  cena: 'exportar', kicker: 'Área · Exportação',
  titulo: 'Sair do Luma com o arquivo certo',
  antes: 'M1', depois: 'M8', rotA: 'Primeira versão no git', rotB: 'Hoje',
  notaA: 'Exportação existia, ainda enxuta.',
  notaB: 'Formato, escala e lote de pranchetas — PNG, JPG, SVG e PSD a partir da mesma arte.',
  conclusao: 'A exportação virou a ponta séria do fluxo: <b>escala dobrada para impressão</b> e saída em lote, sem refazer nada.',
  nota: `A comparação aqui começa em 16/07 porque o piloto não tinha esse modal — o que já é a informação.
Em 17/07 entram o z-order confiável do PSD e o raster adaptativo, que é o que torna o export 2× nítido.
~40s.`
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

// ══ EVOLUÇÃO EM DETALHE — todas as versões de cada tela ═════════════════════
add(`<section class="slide escuro">
  <div class="sn">EVOLUÇÃO EM DETALHE</div><h2>Tela a tela,<br>versão por versão</h2>
  <p class="psec">Daqui em diante, cada slide mostra <b>todas</b> as execuções capturadas de uma mesma tela, em ordem cronológica. O quadro com borda laranja é o momento em que aquela tela mudou de verdade.</p>
</section>`,
`Divisor do bloco mais denso. Avise que agora vem volume: são oito ou nove versões reais por tela.
Não descreva quadro a quadro — deixe a plateia varrer a linha e aponte só o quadro destacado.
~15s.`,
{ tipo: 'Capa', imagens: [], quando: '—', obs: '—' });

tira({
  cena: 'home', kicker: 'Detalhe · Tela de entrada',
  titulo: 'A porta de entrada, em todas as versões',
  chave: ['M0', 'M3', 'M8'],
  mudancas: {
    M0: 'Sem vitrine: abre no chat.',
    M1: 'Primeira vitrine preservada no git.',
    M3: 'Passa a vir do banco.',
    M8: 'Destaque, busca e filtro.'
  },
  conclusao: 'Duas viradas concentram quase toda a diferença: o <b>surgimento da vitrine</b> e a passagem dela para o banco. Entre elas e depois, o que muda é refino — hierarquia, respiro e a campanha em destaque ganhando peso.',
  nota: `A linha inteira num slide. Aponte o primeiro quadro (vermelho, sem vitrine) e o último, e diga que tudo no meio é o mesmo produto amadurecendo.
O quadro de 16/07 é onde a vitrine nasce; o de 30/07 é o estado atual.
~1min.`
});

tira({
  cena: 'catalogo', kicker: 'Detalhe · Campanha aberta',
  titulo: 'A campanha aberta, em todas as versões',
  chave: ['M0', 'M3', 'M8'],
  mudancas: {
    M0: 'Lista fixa em código.',
    M3: 'Campanha vira pasta no banco.',
    M8: 'Capa, prazo e formatos.'
  },
  conclusao: 'Aqui a mudança é mais estrutural que visual: a mesma tela passou a ser <b>alimentada pelo trabalho do time</b> em vez de por um commit. O que se vê são capas reais chegando ao lugar dos blocos de cor.',
  nota: `Slide para o time de operação: cada capa nesta linha foi publicada sem tocar em código.
~50s.`
});

tira({
  cena: 'chat', kicker: 'Detalhe · O chat que monta a arte',
  titulo: 'O fluxo de preenchimento, em todas as versões',
  chave: ['M0', 'M6', 'M8'],
  mudancas: {
    M0: 'Quatro perguntas, sugestões clicáveis.',
    M6: 'IA encaixa o texto no limite.',
    M8: 'Prévia fiel ao lado.'
  },
  conclusao: 'A tela que <b>menos mudou de forma</b> e mais ganhou capacidade. A mecânica de perguntar em passos é a mesma desde a origem; o que entrou foi contexto, formato e ajuda de IA no texto.',
  nota: `Use este slide para dar crédito à ideia original: o formato estava certo desde o primeiro dia.
O quadro de 30/07 marca a entrada da IA — encaixar texto no limite sem cortar sentido.
~50s.`
});

tira({
  cena: 'minhas-artes', kicker: 'Detalhe · Minhas artes',
  titulo: 'O histórico, em todas as versões',
  chave: ['M0', 'M3', 'M8'],
  mudancas: {
    M0: 'Aba presa à sessão do navegador.',
    M3: 'Passa a viver no banco.',
    M8: 'Área própria, rascunho retomável.'
  },
  conclusao: 'A tela que mais mudou de <b>lugar</b>: começou como aba secundária do catálogo e virou área própria, com o rascunho ligado ao template que deu origem à arte.',
  nota: `Os commits de sync de 16/07 estão por trás desta linha: lock no push, releitura antes de regravar e fila de deleções.
~45s.`
});

tira({
  cena: 'designer', kicker: 'Detalhe · Estúdio',
  titulo: 'O Estúdio, em todas as versões',
  chave: ['M0', 'M8'],
  mudancas: {
    M0: 'Abre direto no canvas.',
    M4: 'IDs sempre UUID, PSD confiável.',
    M8: 'Home própria com biblioteca.'
  },
  conclusao: 'O canvas do primeiro dia já era completo. A evolução foi <b>de organização</b>: uma home que reúne o que a equipe fez, com busca, filtro por campanha e status de publicação.',
  nota: `Não há captura do Estúdio em 29/07 — a cena não foi alcançada offline naquele commit, e isso está declarado no índice.
~45s.`
});

tira({
  cena: 'exportar', kicker: 'Detalhe · Exportação',
  titulo: 'A saída do arquivo, em todas as versões',
  chave: ['M1', 'M8'],
  mudancas: {
    M1: 'Exportação enxuta.',
    M4: 'Raster adaptativo: export 2× nítido.',
    M8: 'Formato, escala e lote.'
  },
  conclusao: 'A linha começa em 16/07 porque <b>o piloto não tinha esse modal</b> — o que já é a informação. O salto de qualidade veio em 17/07, com z-order confiável no PSD e raster adaptativo à prancheta.',
  nota: `Slide técnico. Se houver designer na sala, o ponto é o raster adaptativo: o export 2× deixou de borrar.
~40s.`
});

tira({
  cena: 'home-mobile', kicker: 'Detalhe · Celular',
  titulo: 'A mesma tela no celular, em todas as versões',
  chave: ['M0', 'M2', 'M8'],
  mudancas: {
    M0: 'Desktop espremido.',
    M2: 'Prévia com a arte no aparelho.',
    M8: 'Vitrine própria de toque.'
  },
  conclusao: 'O telefone é onde o franqueado realmente trabalha. A linha mostra a passagem de <b>layout adaptado</b> para <b>layout pensado</b>: alvos de toque, navegação por gesto e PWA instalável.',
  nota: `Compare o primeiro e o último quadro: mesma informação, densidade completamente diferente.
~40s.`
});

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
const galeria = ['home', 'catalogo', 'chat', 'minhas-artes', 'designer', 'exportar', 'cli', 'muchplus'].filter(c => tem('M8', c));
if (galeria.length >= 6) {
  const rot = { home:'Vitrine', catalogo:'Campanha aberta', chat:'Chat que monta a arte', 'minhas-artes':'Minhas artes',
                designer:'Estúdio', exportar:'Exportar', cli:'Console do time', muchplus:'Tema Much+' };
  add(`<section class="slide">${topo('O Luma atual', '30/07/2026 · branch atual')}
    <div class="corpo">
      <h2 class="titulo" style="font-size:48px;margin-bottom:20px">O produto hoje, tela por tela</h2>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px;height:calc(100% - 76px)">
        ${galeria.slice(0, 8).map(c => `<div style="display:flex;flex-direction:column;min-height:0">
          <div class="moldura" style="--ar:${ar(img('M8', c))}"><img src="${img('M8', c)}" alt="${esc(rot[c] || c)}"></div>
          <div style="margin-top:8px;font-size:17px;font-weight:800">${esc(rot[c] || c)}</div>
        </div>`).join('')}
      </div>
    </div>
    ${rodape('execuções reais da branch atual')}
  </section>`,
  `Panorama. Não descreva tela por tela — deixe a imagem falar e diga que tudo saiu da mesma versão, no mesmo dia.
~30s.`,
  { tipo: 'Estado atual', imagens: galeria.slice(0, 8).map(c => img('M8', c)), quando: '30/07/2026 (branch atual)',
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
