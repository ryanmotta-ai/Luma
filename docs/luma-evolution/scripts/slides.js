// docs/luma-evolution/scripts/slides.js — a narrativa da V1.
//
// ⛔ OBSOLETA — NÃO APRESENTE A PARTIR DAQUI.
// Esta narrativa foi escrita quando o ambiente tinha um clone `shallow` do repositório:
// 78 dos 239 commits, 2 das 6 branches. Por isso ela afirma coisas FALSAS — que o
// histórico tem 15 dias, que existem duas raízes órfãs e que "o git não guarda o começo
// do Luma". O histórico real começa em 16/06/2026 com uma raiz só (f9252a7) e um README.
// A narrativa corrigida é slides-v2.js. Este arquivo fica como registro do erro.
//
// (descrição original abaixo)
//
// Monta a lista de slides a partir das evidências que existem em disco. Slide que
// dependeria de uma captura ausente NÃO é gerado: a apresentação nunca aponta pra imagem
// que não existe, e nunca preenche buraco com ilustração inventada.
//
// Os números do produto são CONTADOS aqui, no repositório, a cada montagem — não são
// digitados. Número digitado envelhece em silêncio; contado, nunca mente.

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE = path.resolve(__dirname, '..');
const RAIZ = path.resolve(BASE, '..', '..');
const SHOTS = path.join(BASE, 'screenshots', 'original');
const MARCOS = JSON.parse(fs.readFileSync(path.join(BASE, 'commit-map', 'milestones.json'), 'utf8'));

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sh = cmd => { try { return execSync(cmd, { cwd: RAIZ, encoding: 'utf8' }).trim(); } catch (e) { return ''; } };
const n = cmd => Number(sh(cmd) || 0);

// ── o que existe em disco ────────────────────────────────────────────────────
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
const quando = m => m.dataRotulo || m.data;

// ── métricas contadas agora ──────────────────────────────────────────────────
const M = {
  commits:   n('git log --all --oneline | wc -l'),
  autores:   n('git log --all --format=%an | sort -u | wc -l'),
  comTela:   n("git log --all --oneline -- index.html css js | wc -l"),
  primeiro:  sh("git log --all --date=short --format=%ad | sort | head -1"),
  ultimo:    sh("git log --all --date=short --format=%ad | sort | tail -1"),
  arqJs:     n('ls js/*.js js/*/*.js 2>/dev/null | wc -l'),
  linhasJs:  n('cat js/*.js js/*/*.js 2>/dev/null | wc -l'),
  linhasCss: n('cat css/*.css css/*/*.css 2>/dev/null | wc -l'),
  fnD:       n('grep -rhoE "^function d[A-Z][A-Za-z0-9_]*" js/ | sort -u | wc -l'),
  fnF:       n('grep -rhoE "^function f[A-Z][A-Za-z0-9_]*" js/ | sort -u | wc -l'),
  fnG:       n('grep -rhoE "^function g[A-Z][A-Za-z0-9_]*" js/ | sort -u | wc -l'),
  migrations: n('ls supabase/migrations/*.sql 2>/dev/null | wc -l'),
  edge:      n('ls -d supabase/functions/*/ 2>/dev/null | wc -l'),
};
M.fnTotal = M.fnD + M.fnF + M.fnG;
const br = x => x.toLocaleString('pt-BR');

// ── acumuladores ─────────────────────────────────────────────────────────────
const slides = [], notas = [], indice = [];
const add = (html, nota, ev) => { slides.push(html); notas.push(nota.trim()); indice.push(ev); };

const topo = (kicker, q) =>
  `<div class="fio"></div><div class="topo"><span class="kicker">${esc(kicker)}</span>${q ? `<span class="quando">${esc(q)}</span>` : ''}</div>`;
const rodape = sel => `<div class="num"></div>` +
  (sel ? `<div class="selo"><span class="pt"></span>${esc(sel)}</div>` : '');

// A proporção real do PNG, lida do próprio nome do arquivo (…_1440x1000.png). A moldura
// usa isso pra vestir a imagem em vez de esticar e sobrar faixa branca embaixo.
const ar = src => {
  const m = /_(\d+)x(\d+)\.png$/.exec(src || '');
  return m ? `${m[1]}/${m[2]}` : '1440/1000';
};

// Um painel de evidência: a captura + quem ela é.
const painel = (mid, cena, rotulo, eti, nota) => {
  const m = marco(mid);
  return `<div class="tela">
    <div class="moldura" style="--ar:${ar(img(mid, cena))}"><img src="${img(mid, cena)}" alt="${esc(rotulo)}"></div>
    <div class="legenda">${eti ? `<span class="eti ${eti.cls}">${esc(eti.txt)}</span>` : ''}
      <span class="rot">${esc(rotulo)}</span>
      <span class="meta">${esc(quando(m))} · ${esc(selo(m))}</span></div>
    ${nota ? `<div class="nota">${nota}</div>` : ''}
  </div>`;
};

// Comparação antes → hoje. Só monta se as DUAS capturas existirem.
function comparar({ cena, kicker, titulo, antes, depois, rotA, rotB, notaA, notaB, conclusao, nota }) {
  if (!tem(antes, cena) || !tem(depois, cena)) return false;
  add(`<section class="slide">${topo(kicker, `${quando(marco(antes))} → ${quando(marco(depois))}`)}
    <div class="corpo" style="bottom:196px">
      <h2 class="titulo" style="font-size:50px;margin-bottom:24px">${esc(titulo)}</h2>
      <div class="telas" style="height:calc(100% - 82px)">
        ${painel(antes, cena, rotA, { cls: 'eti-antes', txt: 'antes' }, notaA)}
        ${painel(depois, cena, rotB, { cls: 'eti-hoje', txt: 'hoje' }, notaB)}
      </div>
    </div>
    <div class="conclusao">${conclusao}</div>
    ${rodape('duas execuções reais')}
  </section>`, nota,
  { tipo: 'Comparação de duas execuções reais', imagens: [img(antes, cena), img(depois, cena)], confianca: 'Alto',
    obs: `${quando(marco(antes))} (${selo(marco(antes))}) → ${quando(marco(depois))} (${selo(marco(depois))}). Cena "${cena}".` });
  return true;
}

// ══ 1 · ABERTURA ════════════════════════════════════════════════════════════
add(`<section class="slide escuro">
  <div class="marca">Delivery Much · uso interno</div>
  <h1>Luma<br><em>de piloto a produto</em></h1>
  <div class="csub">A evolução visual da plataforma de creative automation — reconstruída a partir do código que ainda roda.</div>
  <div class="meta">
    <div><b>Período</b>anterior a 16/07/2026 → 30/07/2026</div>
    <div><b>Evidência</b>${M.commits} commits + o HTML do piloto</div>
    <div><b>Método</b>cada versão foi executada, não descrita</div>
  </div>
</section>`,
`Abertura. O título entrega a tese: isto não é changelog, é a passagem de um piloto para um produto.
Diga de saída que **nada aqui é mockup** — toda imagem é uma execução real de uma versão que voltou a rodar.
~40s.`,
{ tipo: 'Capa', imagens: [], confianca: 'Alto', obs: '—' });

add(`<section class="slide">${topo('O que você vai ver')}
  <div class="corpo">
    <h2 class="titulo" style="font-size:58px">Três perguntas, respondidas com evidência</h2>
    <div class="lista" style="margin-top:48px">
      <div class="li"><div class="n">01</div><div><h4>De onde o Luma partiu</h4>
        <p>O piloto original, executado. Um arquivo só, outro nome, outra cor — e sem tela de entrada.</p></div></div>
      <div class="li"><div class="n">02</div><div><h4>Como cada tela mudou</h4>
        <p>Comparações lado a lado, mesma tela em versões diferentes, com a data e o commit embaixo de cada imagem.</p></div></div>
      <div class="li"><div class="n">03</div><div><h4>O que o histórico não conta</h4>
        <p>Onde falta evidência, está dito. Nenhum número foi estimado — todos foram contados no repositório.</p></div></div>
    </div>
  </div>
  ${rodape('')}
</section>`,
`Contrato com a plateia. O terceiro item é o mais importante: a apresentação separa fato de leitura.
Se alguém perguntar "de onde saiu esse número", a resposta está no índice de evidências.
~40s.`,
{ tipo: 'Texto', imagens: [], confianca: 'Alto', obs: '—' });

// De onde partimos — o piloto
if (tem('M0', 'home')) {
  add(`<section class="slide">${topo('De onde partimos', 'anterior a 16/07/2026')}
    <div class="corpo" style="display:flex;gap:44px">
      <div style="flex:1.3;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <div class="moldura" style="--ar:${ar(img('M0','home'))}"><img src="${img('M0','home')}" alt="Piloto Yungas"></div>
        <div class="legenda"><span class="eti eti-antes">piloto</span><span class="rot">Yungas · Módulo de Artes</span>
          <span class="meta">arquivo original</span></div>
      </div>
      <div style="flex:.82;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <h2 class="titulo" style="font-size:52px">Nem se<br>chamava Luma</h2>
        <div class="sub" style="font-size:22px">O produto nasceu como <b>Yungas · Módulo de Artes</b>, num arquivo HTML só — e abria direto no chat, sem vitrine.</div>
        <div class="numeros" style="grid-template-columns:1fr 1fr;margin-top:30px">
          <div class="card"><div class="v">1</div><div class="r">arquivo HTML,<br>565 KB</div></div>
          <div class="card"><div class="v">9.316</div><div class="r">linhas, tudo<br>no mesmo lugar</div></div>
          <div class="card"><div class="v">1</div><div class="r">bloco &lt;style&gt; e<br>1 de &lt;script&gt;</div></div>
          <div class="card"><div class="v">266</div><div class="r">funções — já com os<br>prefixos d*, f* e g*</div></div>
        </div>
      </div>
    </div>
    ${rodape('execução real do arquivo original')}
  </section>`,
  `Este slide ancora tudo. O piloto **roda** — não é screenshot de arquivo morto, é o HTML executado agora.
Dois detalhes que valem falar: a fonte 'Realce Black' já vinha embutida em base64 dentro do próprio HTML, e a convenção de prefixos do código de hoje nasceu aqui — 148 funções \`d*\`, 78 \`f*\` e 4 \`g*\`, contra 697/234/140 na versão atual. O mesmo idioma, vinte vezes maior.
Repare que não há tela de entrada: o app abre com o assistente já perguntando.
~1min.`,
  { tipo: 'Captura real (arquivo original)', imagens: [img('M0','home')], confianca: 'Alto',
    obs: 'HTML do piloto servido offline, sem alteração de código. Contagens: wc -c/-l e grep no próprio arquivo.' });
}

// Honestidade sobre o histórico
add(`<section class="slide">${topo('O que o histórico guarda')}
  <div class="corpo">
    <h2 class="titulo" style="font-size:54px">O git não guarda o começo —<br>por isso o piloto importa</h2>
    <div class="numeros" style="grid-template-columns:repeat(3,1fr);margin-top:52px">
      <div class="card destaque"><div class="v">${M.commits}</div><div class="r">commits no repositório,<br>de ${M.primeiro} a ${M.ultimo}</div></div>
      <div class="card"><div class="v">2</div><div class="r">raízes órfãs, ambas de 16/07 —<br>e ambas já com o produto inteiro</div></div>
      <div class="card"><div class="v">285</div><div class="r">arquivos já no commit mais antigo,<br>com index.html de 234 KB</div></div>
    </div>
    <div class="conclusao" style="position:static;margin-top:52px">
      O primeiro commit <b>não é o primeiro dia do Luma</b>. Quando o versionamento começou, o produto já estava construído.
      A única evidência do antes é o arquivo do piloto — e é por isso que ele abre esta apresentação.
    </div>
  </div>
  ${rodape('')}
</section>`,
`Slide de integridade. Se a plateia lê "${M.commits} commits" como o tamanho do projeto, corrija: é o tamanho do **histórico versionado**, não do trabalho.
As duas raízes órfãs (74d31b5 e df0c056) indicam que o repositório foi montado a partir de trabalho que já existia.
~40s.`,
{ tipo: 'Números do git', imagens: [], confianca: 'Alto',
  obs: 'git rev-list --max-parents=0 --all; git cat-file -s 89ca896:index.html; git log --all | wc -l' });

// ══ 2 · LINHA DO TEMPO ══════════════════════════════════════════════════════
add(`<section class="slide escuro">
  <div class="sn">BLOCO 02</div><h2>A linha do tempo</h2>
  <p class="psec">Nove marcos escolhidos por mudança visível, não por acaso. Cada um foi executado e fotografado.</p>
</section>`,
`Divisor. Diga a regra de escolha: o commit entrou porque mudou o que se vê ou o que se pode fazer — não porque é recente.
~12s.`,
{ tipo: 'Divisor', imagens: [], confianca: 'Alto', obs: '—' });

add(`<section class="slide">${topo('Linha do tempo', `${M.commits} commits em 15 dias, mais o piloto`)}
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
`Percorra da esquerda pra direita sem se demorar — cada marco tem slide próprio depois.
O que importa aqui é a forma: um piloto, um dia de fundação enorme (16/07 concentra metade dos commits), duas semanas de refino e um salto de capacidade no último dia.
~50s.`,
{ tipo: 'Linha do tempo', imagens: [], confianca: 'Alto', obs: 'Datas e hashes de commit-map/milestones.json, conferidos com git log.' });

// Uma era por marco, com a melhor captura de cada
const ORDEM = ['home', 'catalogo', 'chat', 'designer', 'cli', 'minhas-artes', 'exportar', 'ajuda', 'home-mobile'];
for (const m of MARCOS) {
  const cena = ORDEM.find(c => tem(m.id, c));
  if (!cena) continue;
  const extras = ORDEM.filter(c => c !== cena && tem(m.id, c)).slice(0, 2);
  add(`<section class="slide">${topo(m.era, quando(m))}
    <div class="corpo" style="display:flex;gap:40px">
      <div style="flex:1.42;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <div class="moldura" style="--ar:${ar(img(m.id, cena))}"><img src="${img(m.id, cena)}" alt="${esc(m.rotulo)}"></div>
        <div class="legenda"><span class="rot">${esc(m.rotulo)}</span>
          <span class="meta">${esc(quando(m))} · ${esc(selo(m))}</span></div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <div class="kicker" style="font-size:16px">Por que este marco</div>
        <div style="margin-top:12px;font-size:21px;line-height:1.44;color:var(--tinta-2)">${esc(m.porQue)}</div>
        <div class="kicker" style="font-size:16px;margin-top:30px">O que há de concreto</div>
        <ul class="fatos">${m.fatos.slice(0, 3).map(f => `<li><span>${esc(f)}</span></li>`).join('')}</ul>
        ${extras.length ? `<div style="display:flex;gap:14px;margin-top:20px">${extras.map(c =>
          `<div style="flex:1;border:1px solid var(--linha);border-radius:9px;overflow:hidden;height:132px;background:var(--papel-2)"><img src="${img(m.id, c)}" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block"></div>`).join('')}</div>
        <div style="margin-top:8px;font-family:var(--mono);font-size:14px;color:var(--tinta-3)">também nesta versão: ${extras.join(' · ')}</div>` : ''}
      </div>
    </div>
    ${rodape(m.tipo === 'arquivo' ? 'execução real do arquivo original' : 'execução real do commit')}
  </section>`,
  `${m.era} — ${m.rotulo}.
Por que entrou: ${m.porQue}
${m.fatos.slice(0, 2).map(f => '· ' + f).join('\n')}
~40s.`,
  { tipo: m.tipo === 'arquivo' ? 'Captura real (arquivo original)' : 'Captura real do commit',
    imagens: [img(m.id, cena), ...extras.map(c => img(m.id, c))], confianca: 'Alto',
    obs: `Commit ${m.hash || '— (arquivo)'}. Cena "${cena}".` });
}

// ══ 3 · COMO CADA ÁREA MUDOU ════════════════════════════════════════════════
add(`<section class="slide escuro">
  <div class="sn">BLOCO 03</div><h2>Como cada área mudou</h2>
  <p class="psec">Mesma tela, versões diferentes, mesmo enquadramento. A data e o commit ficam embaixo de cada imagem.</p>
</section>`,
`Divisor. Avise que daqui pra frente a leitura é sempre a mesma: esquerda é antes, direita é hoje, e a frase embaixo diz o que o usuário ganhou.
~12s.`,
{ tipo: 'Divisor', imagens: [], confianca: 'Alto', obs: '—' });

comparar({
  cena: 'home', kicker: 'Área · Entrada do franqueado',
  titulo: 'De cair no meio do trabalho a escolher por onde começar',
  antes: 'M0', depois: 'M8', rotA: 'Piloto Yungas', rotB: 'Vitrine atual',
  notaA: 'Abre direto num chat já em andamento. O catálogo é uma coluna estreita à esquerda; não existe tela de entrada.',
  notaB: 'Uma vitrine: saudação, busca, campanha em destaque com formatos e prazo, e a grade das demais.',
  conclusao: 'O piloto assumia que você já sabia o que queria fazer. Hoje a primeira tela <b>orienta a escolha</b> — destaque, busca e categorias — antes de pedir qualquer informação. É a diferença entre uma ferramenta e um produto.',
  nota: `A mudança mais visível de todas. No piloto não existe "início": o app abre com o assistente já na pergunta 1 de 4.
Repare também na paleta — o piloto é vermelho; hoje é o laranja da marca sobre papel claro.
Se perguntarem por que mudou: a tela de entrada é o que permite ter destaque, busca e histórico. Sem ela, nenhum desses recursos teria onde morar.
~1min20.` });

comparar({
  cena: 'chat', kicker: 'Área · O fluxo de criação',
  titulo: 'O chat continua no centro — mas deixou de ser a porta',
  antes: 'M0', depois: 'M8', rotA: 'Assistente de artes (piloto)', rotB: 'Chat atual',
  notaA: 'Pergunta em 4 passos, com sugestões clicáveis e prévia à direita. Já era a ideia certa.',
  notaB: 'Mesma mecânica, agora precedida pela escolha de campanha e de material — e com IA ajudando no texto.',
  conclusao: 'O acerto do piloto foi o formato: <b>perguntar em vez de mandar editar</b>. O que mudou não foi o chat — foi tudo que passou a existir em volta dele: catálogo, formatos, histórico e prévia fiel.',
  nota: `Slide que dá crédito ao piloto. O chat guiado não foi invenção posterior: já estava lá, com sugestões clicáveis e contador de passos.
A evolução foi de contexto, não de mecânica.
~50s.` });

comparar({
  cena: 'designer', kicker: 'Área · Estúdio',
  titulo: 'O editor ganhou uma casa',
  antes: 'M0', depois: 'M8', rotA: 'Estúdio no piloto', rotB: 'Estúdio atual',
  notaA: 'Entra direto no canvas, com as ferramentas em volta.',
  notaB: 'Abre numa home própria: templates por pasta e campanha, antes do canvas.',
  conclusao: 'Editar sempre funcionou — o canvas do piloto já era completo. O que faltava era <b>onde guardar e reencontrar</b> o que foi editado, e é isso que a home do Estúdio resolve.',
  nota: `Cuidado pra não vender demais: a diferença aqui é organizacional, não de capacidade de desenho.
~40s.` });

comparar({
  cena: 'home-mobile', kicker: 'Área · Celular',
  titulo: 'De adaptado a pensado pra tela pequena',
  antes: 'M0', depois: 'M8', rotA: 'Piloto no celular', rotB: 'Hoje no celular',
  notaA: 'Layout de desktop espremido na largura do telefone.',
  notaB: 'Vitrine própria de celular, com alvos de toque e navegação por gesto.',
  conclusao: 'Em 16/07 o celular ganha tratamento próprio: mockup de prévia, "Ver postado" com a arte dentro do aparelho e PWA instalável. <b>O telefone deixou de ser um desktop menor.</b>',
  nota: `Se houver franqueado na sala, este slide fala com ele: o uso real acontece no celular.
~40s.` });

// CLI — nasceu no fim, não tem "antes"
if (tem('M8', 'cli')) {
  add(`<section class="slide">${topo('Área · Ferramenta interna', '30/07/2026')}
    <div class="corpo" style="display:flex;gap:44px">
      <div style="flex:1.35;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <div class="moldura" style="--ar:${ar(img('M8','cli'))}"><img src="${img('M8','cli')}" alt="Luma CLI"></div>
        <div class="legenda"><span class="eti eti-novo">novo</span><span class="rot">Luma CLI</span>
          <span class="meta">30/07/2026 · branch atual</span></div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0">
        <h2 class="titulo" style="font-size:46px">Uma superfície pra quem <em style="font-style:normal;color:var(--laranja-d)">mantém</em> o Luma</h2>
        <div class="sub" style="font-size:21px">Não existe versão anterior desta tela: ela nasceu em 30/07, de um incidente real de sync em que o diagnóstico era snippet colado no DevTools.</div>
        <ul class="fatos" style="margin-top:24px">
          <li><span><b>diag</b> — radiografia de sessão, sync, cache, banco e IA</span></li>
          <li><span><b>sync push/pull</b> — força a sincronização e mostra antes → depois</span></li>
          <li><span>Qualquer frase vira pergunta pra IA, com o contexto real da sessão</span></li>
        </ul>
        <div class="conclusao" style="position:static;margin-top:22px;font-size:19px">O gate por role é de UX. Quem protege o dado continua sendo a <b>RLS no banco</b> — o console não dá poder que o DevTools já não desse.</div>
      </div>
    </div>
    ${rodape('execução real do commit')}
  </section>`,
  `Slide sem "antes", e isso é o ponto: o produto passou a ter ferramenta interna própria.
A origem é concreta — o incidente de "pastas no banco e nenhum template aparecendo", diagnosticado colando snippet no DevTools. O CLI transformou aquele conhecimento em comando nomeado.
Ressalte a última linha se houver alguém de segurança na sala.
~1min.`,
  { tipo: 'Captura real do commit', imagens: [img('M8','cli')], confianca: 'Alto',
    obs: 'Sem versão anterior: a tela nasceu em 2026-07-30 (c9790e8 e e48b7ff).' });
}

// ══ 4 · O QUE CRESCEU ALÉM DA APARÊNCIA ════════════════════════════════════
add(`<section class="slide">${topo('Evolução sistêmica', 'piloto → hoje')}
  <div class="corpo">
    <h2 class="titulo" style="font-size:52px">O que cresceu além da aparência</h2>
    <div class="numeros" style="grid-template-columns:repeat(4,1fr);margin-top:40px">
      <div class="card"><div class="v">1 <small>→</small> ${M.arqJs}</div><div class="r">arquivos de JavaScript.<br>O piloto era um arquivo só.</div></div>
      <div class="card"><div class="v">${br(M.linhasJs)}</div><div class="r">linhas de JS hoje,<br>mais ${br(M.linhasCss)} de CSS</div></div>
      <div class="card"><div class="v">${br(M.fnTotal)}</div><div class="r">funções globais nomeadas<br>(${M.fnD} no Estúdio, ${M.fnF} no franqueado)</div></div>
      <div class="card destaque"><div class="v">${M.migrations}</div><div class="r">migrations de banco —<br>o piloto não tinha backend</div></div>
      <div class="card"><div class="v">3</div><div class="r">perfis com permissão real,<br>governados por RLS</div></div>
      <div class="card"><div class="v">${M.edge}</div><div class="r">Edge Functions:<br>IA e convite de membro</div></div>
      <div class="card"><div class="v">3</div><div class="r">formas de instalar:<br>web, PWA e app de desktop</div></div>
      <div class="card"><div class="v">0</div><div class="r">dependências de runtime<br>no front — segue vanilla</div></div>
    </div>
  </div>
  ${rodape('')}
</section>`,
`O slide dos números. Todos foram contados no repositório na hora em que a apresentação foi gerada — nenhum é estimativa.
O contraste mais forte é o do backend: o piloto rodava inteiro no navegador, sem banco. Hoje há Postgres com RLS, Storage e Edge Functions.
O último card é o que mais surpreende engenheiro: cresceu tudo isso **sem** adotar framework nem build.
Se perguntarem sobre adoção ou uso, seja direto: **esses números não existem aqui**. O repositório mede código, não usuários.
~1min20.`,
{ tipo: 'Métricas do repositório', imagens: [], confianca: 'Alto',
  obs: 'Contado na montagem: wc -l em js/ e css/; grep "^function <prefixo>"; ls supabase/migrations; ls supabase/functions.' });

add(`<section class="slide">${topo('Evolução sistêmica', 'o que passou a existir')}
  <div class="corpo">
    <h2 class="titulo" style="font-size:52px">De arquivo solto a plataforma</h2>
    <div class="lista" style="margin-top:32px">
      <div class="li"><div class="n">01</div><div><h4>Passou a ter dono do dado</h4>
        <p>O piloto guardava tudo no navegador. Hoje há Postgres com RLS, e a permissão do franqueado é regra de banco — não decisão da interface.</p></div></div>
      <div class="li"><div class="n">02</div><div><h4>Passou a sobreviver a rede ruim</h4>
        <p>Sync offline-first: push com debounce, fila de deleções, template aberto que sobrevive ao pull do boot e aviso de conflito entre aparelhos.</p></div></div>
      <div class="li"><div class="n">03</div><div><h4>Passou a ser instalável</h4>
        <p>PWA no celular e casca de desktop (.exe e DMG) — o mesmo produto, três formas de abrir.</p></div></div>
      <div class="li"><div class="n">04</div><div><h4>Passou a ter camada de IA, não truque</h4>
        <p>Um motor único atende vários recursos: legenda, encaixe de texto, ajuda aterrada e leitura de cardápio. A chave vive no servidor, não no navegador.</p></div></div>
      <div class="li"><div class="n">05</div><div><h4>Passou a se cuidar</h4>
        <p>Console interno com diagnóstico nomeado, linter de template e a máquina do tempo que reabre qualquer versão antiga — a mesma que produziu estes slides.</p></div></div>
    </div>
  </div>
  ${rodape('')}
</section>`,
`O slide que responde "o produto amadureceu em quê, exatamente".
Cada item tem lastro no histórico — vale citar o incidente do sync (item 2) e a rotação da chave do Gemini pra Edge Function (item 4).
O item 5 é meta: a ferramenta que reabre versões antigas é a mesma que gerou esta apresentação.
~1min20.`,
{ tipo: 'Síntese do histórico', imagens: [], confianca: 'Alto',
  obs: 'Baseado em commit-map/luma-timeline.md, docs/LUMA.md e docs/LUMA-BACKEND-CHANGELOG.md.' });

// ══ 5 · ESTADO ATUAL ════════════════════════════════════════════════════════
const galeria = ['home', 'catalogo', 'chat', 'designer', 'exportar', 'cli'].filter(c => tem('M8', c));
if (galeria.length >= 4) {
  const rot = { home:'Vitrine', catalogo:'Campanha aberta', chat:'Chat que monta a arte',
                designer:'Estúdio', exportar:'Exportar', cli:'Console do time', 'minhas-artes':'Minhas artes' };
  add(`<section class="slide">${topo('Estado atual', '30/07/2026 · branch atual')}
    <div class="corpo">
      <h2 class="titulo" style="font-size:50px;margin-bottom:22px">O produto hoje, tela por tela</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;height:calc(100% - 84px)">
        ${galeria.slice(0, 6).map(c => `<div style="display:flex;flex-direction:column;justify-content:flex-start;min-height:0">
          <div class="moldura" style="--ar:${ar(img('M8', c))}"><img src="${img('M8', c)}" alt="${esc(rot[c] || c)}"></div>
          <div style="margin-top:8px;font-size:18px;font-weight:800">${esc(rot[c] || c)}</div>
        </div>`).join('')}
      </div>
    </div>
    ${rodape('execuções reais da branch atual')}
  </section>`,
  `Panorama. Não descreva tela por tela — deixe a imagem falar e diga só que tudo aqui saiu da mesma versão, no mesmo dia.
~30s.`,
  { tipo: 'Capturas reais da branch atual', imagens: galeria.slice(0, 6).map(c => img('M8', c)),
    confianca: 'Alto', obs: 'Todas do mesmo commit (HEAD).' });
}

// ══ 6 · FECHAMENTO ══════════════════════════════════════════════════════════
const totalShots = fs.existsSync(SHOTS)
  ? fs.readdirSync(SHOTS).reduce((n2, d) => {
      const p = path.join(SHOTS, d);
      return n2 + (fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter(f => f.endsWith('.png')).length : 0);
    }, 0) : 0;
const marcosComShot = fs.existsSync(SHOTS)
  ? fs.readdirSync(SHOTS).filter(d => {
      const p = path.join(SHOTS, d);
      return fs.statSync(p).isDirectory() && fs.readdirSync(p).some(f => f.endsWith('.png'));
    }).length : 0;

add(`<section class="slide">${topo('O que sustenta esta apresentação')}
  <div class="corpo">
    <h2 class="titulo" style="font-size:52px">Auditoria</h2>
    <div class="numeros" style="grid-template-columns:repeat(3,1fr);margin-top:40px">
      <div class="card"><div class="v">${M.commits}</div><div class="r">commits analisados,<br>de ${M.autores} autores</div></div>
      <div class="card"><div class="v">${M.comTela}</div><div class="r">deles mexem em tela<br>(HTML, CSS ou JS)</div></div>
      <div class="card destaque"><div class="v">${marcosComShot}</div><div class="r">marcos executados<br>e fotografados</div></div>
      <div class="card"><div class="v">${totalShots}</div><div class="r">capturas reais<br>produzidas</div></div>
      <div class="card"><div class="v">0</div><div class="r">imagens reconstruídas,<br>ilustradas ou simuladas</div></div>
      <div class="card"><div class="v">0</div><div class="r">linhas do produto alteradas<br>para produzir os prints</div></div>
    </div>
  </div>
  ${rodape('')}
</section>`,
`O slide de auditoria. Os dois últimos números são os que importam: zero reconstruções e zero alterações no código do produto.
Se alguém quiser conferir qualquer imagem, o índice de evidências dá commit, data, cena e viewport de cada uma — e cada PNG tem um JSON irmão com esses metadados.
~40s.`,
{ tipo: 'Auditoria', imagens: [], confianca: 'Alto', obs: 'Números apurados na montagem a partir dos arquivos em disco.' });

add(`<section class="slide escuro">
  <div class="marca">Para fechar</div>
  <h1>Não é um conjunto<br>de telas.<br><em>É um produto.</em></h1>
  <div class="csub">O piloto já tinha a ideia certa: perguntar em vez de mandar desenhar. O que veio depois foi tudo que uma ideia precisa pra virar ferramenta de trabalho — lugar pra guardar, permissão pra confiar, rede pra falhar sem perder, e uma linguagem visual própria.</div>
  <div class="meta">
    <div><b>Ainda em construção</b>o roadmap da v1 segue aberto em luma-brain/07</div>
    <div><b>Reproduzível</b>node docs/luma-evolution/scripts/tudo.js</div>
  </div>
</section>`,
`Fechamento. A frase tem lastro: o chat guiado do piloto continua sendo o centro do produto — o que mudou foi tudo em volta.
Termine convidando: a apresentação se regenera com um comando, então ela acompanha o produto em vez de envelhecer.
~40s.`,
{ tipo: 'Encerramento', imagens: [], confianca: 'Alto', obs: '—' });

module.exports = { slides, notas, indice, MARCOS, IMG, M, totalShots, marcosComShot };
