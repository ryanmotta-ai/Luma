// docs/luma-evolution/scripts/montar.js — monta a apresentação a partir das evidências.
//
//   node docs/luma-evolution/scripts/montar.js
//
// Lê milestones.json, o que a captura produziu (screens-by-commit.json) e as imagens que
// EXISTEM em screenshots/original. Slide que dependeria de uma captura ausente não é
// gerado — a apresentação nunca aponta pra imagem que não existe, e nunca preenche buraco
// com ilustração inventada.
//
// Saída: presentation/luma-evolution.html (1920×1080 por slide), o índice de evidências e
// as notas do apresentador. O PDF e o PPTX saem daqui, em publicar.js e montar-pptx.py.

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const SHOTS = path.join(BASE, 'screenshots', 'original');
const MARCOS = JSON.parse(fs.readFileSync(path.join(BASE, 'commit-map', 'milestones.json'), 'utf8'));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── índice das capturas: marco → cena → caminho relativo ao HTML ─────────────
const IMG = {};
for (const m of MARCOS) {
  const dir = path.join(SHOTS, m.id);
  if (!fs.existsSync(dir)) continue;
  IMG[m.id] = {};
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.png'))) {
    const cena = f.replace(/^\d+_/, '').replace(/_\d{4}-\d{2}-\d{2}_.*$/, '');
    IMG[m.id][cena] = '../screenshots/original/' + m.id + '/' + f;
  }
}
const tem = (mid, cena) => !!(IMG[mid] && IMG[mid][cena]);
const img = (mid, cena) => IMG[mid] && IMG[mid][cena];
const marco = id => MARCOS.find(m => m.id === id);
const selo = m => m.tipo === 'arquivo' ? 'arquivo original' : (m.hashCurto === 'atual' ? 'branch atual' : m.hashCurto);

const slides = [];
const notas = [];
const indice = [];
const S = (html, nota, ev) => { slides.push(html); notas.push(nota); indice.push(ev); };

// ── peças reutilizáveis ──────────────────────────────────────────────────────
function topo(kicker, tempo) {
  return `<div class="s-fio"></div><div class="s-top"><span class="s-kicker">${esc(kicker)}</span>${tempo ? `<span class="s-tempo">${esc(tempo)}</span>` : ''}</div>`;
}
function rodape(txt, evid) {
  return `<div class="s-rodape">${txt ? `<span>${txt}</span>` : ''}<span class="s-num"></span></div>`
    + (evid ? `<div class="evid ${evid.nivel === 'medio' ? 'medio' : ''}"><span class="pt"></span>${esc(evid.txt)}</div>` : '');
}
function painel(mid, cena, rotulo, etiqueta, nota, inteira) {
  const src = img(mid, cena), m = marco(mid);
  return `<div class="tela">
    <div class="tela-img${inteira ? ' inteira' : ''}"><img src="${src}" alt="${esc(rotulo)}"></div>
    <div class="tela-cap">${etiqueta ? `<span class="eti ${etiqueta.cls}">${esc(etiqueta.txt)}</span>` : ''}
      <span class="t-rot">${esc(rotulo)}</span>
      <span class="t-meta">${esc(m.data)} · ${esc(selo(m))}</span></div>
    ${nota ? `<div class="tela-nota">${nota}</div>` : ''}
  </div>`;
}

// ══ BLOCO 1 — ABERTURA ══════════════════════════════════════════════════════
S(`<section class="slide capa">
  <div class="c-marca">Delivery Much · uso interno</div>
  <h1>Luma<br><em>de piloto a produto</em></h1>
  <div class="c-sub">A evolução visual da plataforma de creative automation — reconstruída a partir do código que ainda roda.</div>
  <div class="c-meta">
    <div><b>Período coberto</b>anterior a 16/07/2026 → 30/07/2026</div>
    <div><b>Evidência</b>81 commits + o HTML do piloto</div>
    <div><b>Método</b>cada versão foi executada, não descrita</div>
  </div>
</section>`,
`Abertura. O título já entrega a tese: isto não é changelog, é a passagem de um piloto para um produto.
Diga de saída que **nada aqui é mockup** — toda imagem é uma execução real, capturada de uma versão que voltou a rodar.
Duração: 40s.`,
{ tipo: 'Capa', imagens: [], confianca: 'Alto', obs: 'Sem captura.' });

S(`<section class="slide">${topo('O que você vai ver')}
  <div class="s-corpo"><h2 class="s-titulo" style="font-size:62px">Quatro perguntas, respondidas com evidência</h2>
  <div class="lista" style="margin-top:52px">
    <div class="lista-item"><div class="lista-n">01</div><div class="lista-txt"><h4>De onde o Luma partiu</h4>
      <p>O piloto original, executado. Um arquivo só, outro nome, outra cor.</p></div></div>
    <div class="lista-item"><div class="lista-n">02</div><div class="lista-txt"><h4>Como cada tela mudou</h4>
      <p>Comparações lado a lado, mesma tela em versões diferentes, com data e commit embaixo.</p></div></div>
    <div class="lista-item"><div class="lista-n">03</div><div class="lista-txt"><h4>Onde cada funcionalidade está hoje</h4>
      <p>Atlas visual: a captura da tela com o caminho exato até o recurso.</p></div></div>
    <div class="lista-item"><div class="lista-n">04</div><div class="lista-txt"><h4>O que o histórico não conta</h4>
      <p>Onde falta evidência, está dito. Nenhum número foi estimado.</p></div></div>
  </div></div>
  ${rodape('')}
</section>`,
`Contrato com a plateia. O quarto item é o mais importante: a apresentação distingue o que é fato do que é inferência.
Se alguém perguntar "de onde saiu esse número", a resposta está no índice de evidências.
Duração: 50s.`,
{ tipo: 'Texto', imagens: [], confianca: 'Alto', obs: 'Sem captura.' });

// De onde partimos — o piloto
if (tem('M0', 'home')) {
  const m0 = marco('M0');
  S(`<section class="slide">${topo('De onde partimos', 'anterior a 16/07/2026')}
    <div class="s-corpo" style="display:flex;gap:44px">
      <div style="flex:1.25;display:flex;flex-direction:column">
        <div class="tela-img" style="flex:1"><img src="${img('M0','home')}" alt="Piloto Yungas"></div>
        <div class="tela-cap"><span class="eti eti-antes">Piloto</span><span class="t-rot">Yungas · Módulo de Artes</span>
          <span class="t-meta">arquivo original</span></div>
      </div>
      <div style="flex:.85;display:flex;flex-direction:column;justify-content:center">
        <h2 class="s-titulo" style="font-size:54px">Nem se chamava<br>Luma</h2>
        <div class="s-sub" style="font-size:23px;margin-top:24px">O produto nasceu como <b>Yungas · Módulo de Artes</b>, num arquivo HTML só.</div>
        <div class="numeros" style="grid-template-columns:1fr 1fr;margin-top:34px;height:auto">
          <div class="num-card"><div class="num-v">1</div><div class="num-r">arquivo HTML,<br>565 KB</div></div>
          <div class="num-card"><div class="num-v">9.316</div><div class="num-r">linhas, tudo<br>no mesmo lugar</div></div>
          <div class="num-card"><div class="num-v">1</div><div class="num-r">bloco &lt;style&gt; e<br>1 bloco &lt;script&gt;</div></div>
          <div class="num-card"><div class="num-v">266</div><div class="num-r">funções<br>declaradas</div></div>
        </div>
      </div>
    </div>
    ${rodape('', { txt: 'execução real do arquivo original', nivel: 'alto' })}
  </section>`,
  `Este é o slide que ancora tudo. O piloto **roda** — não é screenshot de arquivo morto, é o HTML executado.
Dois detalhes que valem falar: a fonte da marca estava embutida em base64 dentro do próprio HTML, e os prefixos \`d-*\` do Estúdio já existiam ali. A convenção de nomes do código de hoje nasceu neste arquivo.
Duração: 1min.`,
  { tipo: 'Captura real (arquivo original)', imagens: [img('M0','home')], confianca: 'Alto', obs: 'HTML do piloto servido offline, sem alteração de código.' });
}

// O aviso de honestidade sobre o histórico
S(`<section class="slide">${topo('O que o histórico guarda')}
  <div class="s-corpo">
    <h2 class="s-titulo" style="font-size:58px">O git não guarda o começo — <br>por isso o piloto importa</h2>
    <div class="numeros" style="grid-template-columns:repeat(3,1fr);margin-top:56px;height:auto">
      <div class="num-card destaque"><div class="num-v">81</div><div class="num-r">commits no repositório,<br>de 16 a 30 de julho de 2026</div></div>
      <div class="num-card"><div class="num-v">2</div><div class="num-r">raízes órfãs, ambas do dia 16 —<br>e ambas já com o produto inteiro</div></div>
      <div class="num-card"><div class="num-v">284</div><div class="num-r">arquivos já no commit mais antigo,<br>com index.html de 234 KB</div></div>
    </div>
    <div class="conclusao" style="position:static;margin-top:52px">
      O primeiro commit do repositório <b>não é o primeiro dia do Luma</b>. Quando o versionamento começou, o produto já estava construído.
      A única evidência do antes é o arquivo do piloto — e é por isso que ele abre esta apresentação.
    </div>
  </div>
  ${rodape('')}
</section>`,
`Slide de integridade. Se a plateia acha que "81 commits" é o tamanho do projeto, corrija: 81 commits é o tamanho do **histórico versionado**, não do trabalho.
As duas raízes órfãs indicam que o repositório foi montado a partir de trabalho que já existia.
Duração: 45s.`,
{ tipo: 'Números do git', imagens: [], confianca: 'Alto', obs: 'git rev-list --max-parents=0 --all; git cat-file -s <sha>:index.html' });

// ══ BLOCO 2 — LINHA DO TEMPO ════════════════════════════════════════════════
S(`<section class="slide secao">
  <div class="se-n">BLOCO 02</div><h2>A linha do tempo</h2>
  <p>Oito marcos escolhidos por mudança visível, não por acaso. Cada um foi executado e capturado.</p>
</section>`,
`Divisor. Diga a regra de escolha: commit entrou porque mudou o que se vê ou o que se pode fazer — não porque é recente.
Duração: 15s.`, { tipo: 'Divisor', imagens: [], confianca: 'Alto', obs: '' });

S(`<section class="slide">${topo('Linha do tempo', '15 dias de histórico + o piloto')}
  <div class="s-corpo"><div class="tl"><div class="tl-eixo"></div><div class="tl-itens">
  ${MARCOS.map((m, i) => `<div class="tl-item ${m.id === 'M0' || m.id === 'M8' ? 'marco' : ''}">
      <div class="tl-data">${esc(m.dataExata ? m.data : 'antes de 16/07')}</div>
      <div class="tl-era">${esc(m.era.replace(/^Era \d+ · /, ''))}</div>
      <div class="tl-ponto"></div>
      <div class="tl-rot">${esc(m.rotulo)}</div>
      <div class="tl-hash">${esc(selo(m))}</div>
    </div>`).join('')}
  </div></div></div>
  ${rodape('')}
</section>`,
`Percorra da esquerda pra direita sem se demorar — cada marco tem slide próprio depois.
O que importa aqui é a forma: um piloto, um dia de fundação enorme, duas semanas de refino e um salto de capacidade no último dia.
Duração: 1min.`,
{ tipo: 'Linha do tempo', imagens: [], confianca: 'Alto', obs: 'Datas e hashes de commit-map/milestones.json.' });

// ── uma era por vez, com a melhor captura de cada marco ──
const ORDEM_CENA = ['home', 'catalogo', 'chat', 'designer', 'cli', 'minhas-artes', 'exportar', 'home-mobile'];
for (const m of MARCOS) {
  const cena = ORDEM_CENA.find(c => tem(m.id, c));
  if (!cena) continue;
  const outras = ORDEM_CENA.filter(c => c !== cena && tem(m.id, c)).slice(0, 2);
  S(`<section class="slide">${topo(m.era, m.dataExata ? m.data : 'anterior a 16/07/2026')}
    <div class="s-corpo" style="display:flex;gap:40px">
      <div style="flex:1.5;display:flex;flex-direction:column">
        <div class="tela-img" style="flex:1"><img src="${img(m.id, cena)}" alt="${esc(m.rotulo)}"></div>
        <div class="tela-cap"><span class="t-rot">${esc(m.rotulo)}</span><span class="t-meta">${esc(m.data)} · ${esc(selo(m))}</span></div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <div class="s-kicker" style="font-size:16px">Por que este commit</div>
        <div style="margin-top:14px;font-size:23px;line-height:1.42;color:var(--tinta-2)">${esc(m.porQueFoiEscolhido)}</div>
        <div class="s-kicker" style="font-size:16px;margin-top:34px">O que há de concreto</div>
        <ul style="margin-top:14px;list-style:none">
          ${m.fatos.slice(0, 4).map(f => `<li style="display:flex;gap:12px;margin-bottom:13px;font-size:19px;line-height:1.36;color:var(--tinta-2)">
            <span style="color:var(--laranja);font-weight:900">—</span><span>${esc(f)}</span></li>`).join('')}
        </ul>
        ${outras.length ? `<div style="display:flex;gap:14px;margin-top:26px">${outras.map(c => `<div style="flex:1;border:1px solid var(--linha);border-radius:9px;overflow:hidden;height:150px"><img src="${img(m.id, c)}" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block"></div>`).join('')}</div>
        <div style="margin-top:9px;font-family:var(--mono);font-size:14px;color:var(--tinta-3)">outras telas desta versão: ${outras.join(' · ')}</div>` : ''}
      </div>
    </div>
    ${rodape('', { txt: m.tipo === 'arquivo' ? 'execução real do arquivo original' : 'execução real do commit', nivel: 'alto' })}
  </section>`,
  `${m.era} — ${m.rotulo}.\nPor que entrou: ${m.porQueFoiEscolhido}\n${m.fatos.slice(0,2).map(f => '· ' + f).join('\n')}\nDuração: 45s.`,
  { tipo: m.tipo === 'arquivo' ? 'Captura real (arquivo original)' : 'Captura real do commit',
    imagens: [img(m.id, cena), ...outras.map(c => img(m.id, c))],
    confianca: 'Alto', obs: `Commit ${m.hash || '—'}. Cena "${cena}".` });
}

module.exports = { slides, notas, indice, IMG, MARCOS, tem, img, marco, selo, esc, topo, rodape, painel, S };
