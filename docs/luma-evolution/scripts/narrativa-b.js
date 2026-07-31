// docs/luma-evolution/scripts/narrativa-b.js — segunda metade da apresentação.
// Continua a partir dos slides montados em montar.js (mesmos arrays, mesmos ajudantes).
// Comparações por área, atlas de funcionalidades, evolução sistêmica e fechamento.

const fs = require('fs');
const path = require('path');
const M = require('./montar.js');
const { esc, topo, rodape, painel, tem, img, marco, selo, S, MARCOS } = M;

const BASE = path.resolve(__dirname, '..');
const atlasPath = path.join(BASE, 'commit-map', 'atlas.json');
const ATLAS = fs.existsSync(atlasPath) ? JSON.parse(fs.readFileSync(atlasPath, 'utf8')) : [];

// Antigo → atual, com a conclusão embaixo. Só monta se as DUAS capturas existirem.
function comparar({ cena, titulo, kicker, antes, depois, rotAntes, rotDepois, notaA, notaB, conclusao, nota, evid }) {
  if (!tem(antes, cena) || !tem(depois, cena)) return false;
  S(`<section class="slide">${topo(kicker, `${marco(antes).data} → ${marco(depois).data}`)}
    <div class="s-corpo" style="bottom:200px"><h2 class="s-titulo" style="font-size:52px;margin-bottom:26px">${esc(titulo)}</h2>
      <div class="telas" style="height:calc(100% - 88px)">
        ${painel(antes, cena, rotAntes, { cls: 'eti-antes', txt: 'antes' }, notaA)}
        ${painel(depois, cena, rotDepois, { cls: 'eti-depois', txt: 'hoje' }, notaB)}
      </div></div>
    <div class="conclusao">${conclusao}</div>
    ${rodape('', evid || { txt: 'duas execuções reais', nivel: 'alto' })}
  </section>`, nota,
  { tipo: 'Comparação de duas execuções reais', imagens: [img(antes, cena), img(depois, cena)],
    confianca: 'Alto', obs: `${marco(antes).data} (${selo(marco(antes))}) → ${marco(depois).data} (${selo(marco(depois))}). Cena "${cena}".` });
  return true;
}

// ══ BLOCO 3 — EVOLUÇÃO POR ÁREA ═════════════════════════════════════════════
S(`<section class="slide secao"><div class="se-n">BLOCO 03</div><h2>Como cada área mudou</h2>
  <p>Mesma tela, versões diferentes, mesmo enquadramento. A data e o commit ficam embaixo de cada imagem.</p>
</section>`,
`Divisor. Avise que daqui pra frente é sempre a mesma leitura: esquerda é antes, direita é hoje, e a frase embaixo diz o que o usuário ganhou.
Duração: 15s.`, { tipo: 'Divisor', imagens: [], confianca: 'Alto', obs: '' });

comparar({
  cena: 'home', kicker: 'Área · Entrada do franqueado',
  titulo: 'De cair no meio do trabalho a escolher por onde começar',
  antes: 'M0', depois: 'M8',
  rotAntes: 'Piloto Yungas', rotDepois: 'Vitrine atual',
  notaA: 'Abre direto num chat já em andamento. O catálogo é uma coluna estreita à esquerda; não há tela de entrada.',
  notaB: 'Uma vitrine: saudação, busca, campanha em destaque com formatos e prazo, e a grade das demais.',
  conclusao: 'O piloto assumia que você já sabia o que queria fazer. Hoje a primeira tela <b>orienta a escolha</b> — destaque, busca e categorias — antes de pedir qualquer informação. É a diferença entre uma ferramenta e um produto.',
  nota: `A mudança mais visível de todas. No piloto não existe "início": o app abre com o assistente já perguntando.
Repare também na paleta — o piloto é vermelho/laranja escuro; hoje é o laranja da marca sobre papel claro.
Se perguntarem por que mudou: uma tela de entrada é o que permite ter destaque, busca e histórico. Sem ela, cada um desses recursos não teria onde morar.
Duração: 1min20.` });

comparar({
  cena: 'chat', kicker: 'Área · O fluxo de criação',
  titulo: 'O chat continua no centro — mas deixou de ser a porta',
  antes: 'M0', depois: 'M8',
  rotAntes: 'Assistente de artes (piloto)', rotDepois: 'Chat atual',
  notaA: 'Assistente pergunta em 4 passos, com sugestões clicáveis e prévia à direita. Já era a ideia certa.',
  notaB: 'Mesma mecânica, agora precedida por escolha de campanha e de material — e com IA ajudando no texto.',
  conclusao: 'O acerto do piloto foi o formato: <b>perguntar em vez de editar</b>. O que mudou não foi o chat, foi tudo que passou a existir em volta dele — catálogo, formatos, histórico e prévia fiel.',
  nota: `Slide importante pra dar crédito ao piloto. O chat guiado não foi invenção posterior: já estava lá, com sugestões clicáveis e contador de passos.
A evolução foi de contexto, não de mecânica.
Duração: 1min.` });

comparar({
  cena: 'designer', kicker: 'Área · Estúdio',
  titulo: 'O editor ganhou uma casa',
  antes: 'M0', depois: 'M8',
  rotAntes: 'Estúdio no piloto', rotDepois: 'Estúdio atual',
  notaA: 'Entra direto no canvas, com as ferramentas em volta.',
  notaB: 'Abre numa home própria: templates por pasta e campanha, antes do canvas.',
  conclusao: 'Editar sempre funcionou. O que faltava era <b>onde guardar e reencontrar</b> o que foi editado — e é isso que a home do Estúdio resolve.',
  nota: `Cuidado pra não vender demais: o canvas do piloto já era completo. A diferença é organizacional, não de capacidade de desenho.
Duração: 50s.` });

comparar({
  cena: 'home-mobile', kicker: 'Área · Celular',
  titulo: 'De adaptado a pensado pra tela pequena',
  antes: 'M0', depois: 'M8',
  rotAntes: 'Piloto no celular', rotDepois: 'Hoje no celular',
  notaA: 'Layout de desktop espremido na largura do telefone.',
  notaB: 'Vitrine própria de celular, com alvos de toque e navegação por gesto.',
  conclusao: 'Em 16/07 entram três commits seguidos só de celular — refinos, varredura de telas e a prévia viva com miniatura, pinça e swipe. <b>O telefone deixou de ser um desktop menor.</b>',
  nota: `Se houver franqueado na sala, este é o slide que fala com ele: o uso real acontece no celular.
Os três commits: 'Mobile (franqueado): refinos de UI/UX', 'varredura completa de telas — rodada 2' e 'prévia viva — miniatura PiP, pinça pra zoom e swipe pra fechar'.
Duração: 50s.` });

// CLI — não tem "antes": nasceu no fim
if (tem('M8', 'cli')) {
  S(`<section class="slide">${topo('Área · Ferramenta interna', '30/07/2026')}
    <div class="s-corpo" style="display:flex;gap:44px">
      <div style="flex:1.45;display:flex;flex-direction:column">
        <div class="tela-img" style="flex:1"><img src="${img('M8','cli')}" alt="Luma CLI"></div>
        <div class="tela-cap"><span class="eti eti-novo">novo</span><span class="t-rot">Luma CLI</span>
          <span class="t-meta">30/07/2026 · branch atual</span></div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
        <h2 class="s-titulo" style="font-size:50px">Uma superfície pra quem <b style="color:var(--laranja)">mantém</b> o Luma</h2>
        <div class="s-sub" style="font-size:22px;margin-top:22px">Não existe versão anterior desta tela: ela nasceu em 30/07, do incidente real de sync em que o diagnóstico era snippet colado no DevTools.</div>
        <ul style="margin-top:30px;list-style:none">
          ${['<b>diag</b> — radiografia de sessão, sync, cache, banco e IA',
             '<b>sync push/pull</b> — força a sincronização e mostra antes → depois',
             '<b>modelo</b> — troca o modelo de IA do aparelho',
             'Qualquer frase vira pergunta pra IA, com o contexto real da sessão'].map(t =>
            `<li style="display:flex;gap:12px;margin-bottom:14px;font-size:20px;line-height:1.36;color:var(--tinta-2)"><span style="color:var(--laranja);font-weight:900">—</span><span>${t}</span></li>`).join('')}
        </ul>
        <div class="conclusao" style="position:static;margin-top:26px;font-size:20px">O gate por role é de UX. Quem protege o dado continua sendo a <b>RLS no banco</b> — o console não dá poder que o DevTools já não desse.</div>
      </div>
    </div>
    ${rodape('', { txt: 'execução real do commit', nivel: 'alto' })}
  </section>`,
  `Slide sem "antes", e isso é o ponto: o produto passou a ter ferramenta interna própria.
A origem é concreta — o incidente de "30 pastas no banco e 0 templates", diagnosticado colando snippet no DevTools. O CLI transformou aquele conhecimento em comando nomeado.
Ressalte a última linha se houver alguém de segurança na sala.
Duração: 1min.`,
  { tipo: 'Captura real do commit', imagens: [img('M8','cli')], confianca: 'Alto', obs: 'Sem versão anterior: a tela nasceu em 2026-07-30.' });
}

// ══ BLOCO 4 — ATLAS ═════════════════════════════════════════════════════════
if (ATLAS.length) {
  S(`<section class="slide secao"><div class="se-n">BLOCO 04</div><h2>Onde as coisas estão</h2>
    <p>Atlas visual: a captura da tela de hoje com o contorno na funcionalidade e o caminho até ela.</p>
  </section>`,
  `Divisor. Este bloco é o mais útil pra quem vai usar o Luma amanhã: é literalmente um mapa.
Duração: 12s.`, { tipo: 'Divisor', imagens: [], confianca: 'Alto', obs: '' });

  for (const q of ATLAS) {
    if (!q.feats.length) continue;
    const fs4 = q.feats.slice(0, 4);
    S(`<section class="slide">${topo('Atlas · ' + q.tela, 'estado atual')}
      <div class="s-corpo"><div class="atlas">
        <div class="atlas-fig"><img src="${q.imagem}" alt="${esc(q.tela)}">
          ${fs4.map((f, i) => {
          // A figura tem 820px de altura no slide (.s-corpo). Alvo mais baixo que o
          // marcador (42px com a borda) não o comporta encostado no topo: ele vazava pra
          // fora da figura, que tem overflow:hidden. Nesse caso o marcador centraliza na
          // vertical — cabe sempre, e continua colado no alvo.
          const alturaPx = f.caixa.h * 8.2;
          const topo = alturaPx < 54
            ? `calc(${f.caixa.y.toFixed(2)}% + ${(f.caixa.h * 8.2 / 2 - 19).toFixed(1)}px)`
            : `calc(${f.caixa.y.toFixed(2)}% + 8px)`;
          return `<div class="marca-alvo" style="left:${f.caixa.x.toFixed(2)}%;top:${f.caixa.y.toFixed(2)}%;width:${f.caixa.w.toFixed(2)}%;height:${f.caixa.h.toFixed(2)}%"></div>
            <div class="marca-n" style="left:calc(${f.caixa.x.toFixed(2)}% + 8px);top:${topo}">${i + 1}</div>`;
        }).join('')}
        </div>
        <div class="atlas-lista">
          ${fs4.map((f, i) => `<div class="atlas-item"><div class="atlas-bola">${i + 1}</div>
            <div class="atlas-txt"><h4>${esc(f.nome)}</h4><p>${esc(f.oQueFaz)}</p>
              <div class="cam">${esc(f.caminho)} · ${esc(f.perfil)} · ${esc(f.estado)}</div></div></div>`).join('')}
        </div>
      </div></div>
      ${rodape('', { txt: 'contornos medidos no DOM', nivel: 'alto' })}
    </section>`,
    `Atlas de ${q.tela}.\n${fs4.map((f, i) => `${i + 1}. ${f.nome} — ${f.caminho}. ${f.beneficio}`).join('\n')}\nOs contornos não foram desenhados no olho: a posição de cada caixa foi medida no DOM da versão atual.\nDuração: 1min.`,
    { tipo: 'Captura real + contorno medido', imagens: [q.imagem], confianca: 'Alto',
      obs: `Caixas medidas com getBoundingClientRect na versão HEAD, viewport 1440×1000.` });
  }
}

// ══ BLOCO 5 — EVOLUÇÃO SISTÊMICA ════════════════════════════════════════════
S(`<section class="slide">${topo('Evolução sistêmica', 'piloto → hoje')}
  <div class="s-corpo"><h2 class="s-titulo" style="font-size:56px">O que cresceu além da aparência</h2>
  <div class="numeros" style="grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr;margin-top:44px;height:calc(100% - 120px)">
    <div class="num-card"><div class="num-v">1 <small>→</small> 53</div><div class="num-r">arquivos de JavaScript.<br>O piloto era um arquivo só.</div></div>
    <div class="num-card"><div class="num-v">41.416</div><div class="num-r">linhas de JS hoje,<br>mais 20.766 de CSS</div></div>
    <div class="num-card"><div class="num-v">1.071</div><div class="num-r">funções globais nomeadas<br>(697 no Estúdio, 234 no franqueado)</div></div>
    <div class="num-card destaque"><div class="num-v">18</div><div class="num-r">migrations de banco —<br>o piloto não tinha backend</div></div>
    <div class="num-card"><div class="num-v">3</div><div class="num-r">perfis com permissão real,<br>governados por RLS</div></div>
    <div class="num-card"><div class="num-v">6</div><div class="num-r">recursos de IA sobre<br>um motor único</div></div>
    <div class="num-card"><div class="num-v">2</div><div class="num-r">Edge Functions:<br>IA e convite de membro</div></div>
    <div class="num-card"><div class="num-v">3</div><div class="num-r">formas de instalar:<br>web, PWA e app de desktop</div></div>
  </div></div>
  ${rodape('')}
</section>`,
`Este é o slide dos números. Todos foram contados no repositório — nenhum é estimativa.
O contraste mais forte é o do backend: o piloto rodava inteiro no navegador, sem banco. Hoje há Postgres com RLS, Storage e Edge Functions.
Se perguntarem sobre adoção ou uso, seja direto: **esses números não existem aqui**. O repositório mede código, não usuários.
Duração: 1min20.`,
{ tipo: 'Métricas do repositório', imagens: [], confianca: 'Alto',
  obs: 'Contagens: wc -l em js/ e css/; grep de "function <prefixo>"; ls supabase/migrations; ls supabase/functions.' });

S(`<section class="slide">${topo('Evolução sistêmica', 'o que passou a existir')}
  <div class="s-corpo"><h2 class="s-titulo" style="font-size:56px">De arquivo solto a plataforma</h2>
  <div class="lista" style="margin-top:34px">
    <div class="lista-item"><div class="lista-n">01</div><div class="lista-txt"><h4>Passou a ter dono do dado</h4>
      <p>O piloto guardava tudo no navegador. Hoje há Postgres com RLS, e a permissão do franqueado é regra de banco — não decisão da interface.</p></div></div>
    <div class="lista-item"><div class="lista-n">02</div><div class="lista-txt"><h4>Passou a sobreviver a rede ruim</h4>
      <p>Sync offline-first: push com debounce, fila de deleções, template aberto que sobrevive ao pull do boot e aviso de conflito entre aparelhos.</p></div></div>
    <div class="lista-item"><div class="lista-n">03</div><div class="lista-txt"><h4>Passou a ser instalável</h4>
      <p>PWA no celular e casca de desktop (.exe e DMG) — o mesmo produto, três formas de abrir.</p></div></div>
    <div class="lista-item"><div class="lista-n">04</div><div class="lista-txt"><h4>Passou a ter camada de IA, não truque</h4>
      <p>Um motor único atende seis recursos. Trocar de modelo é um comando; a chave vive no servidor, não no navegador.</p></div></div>
    <div class="lista-item"><div class="lista-n">05</div><div class="lista-txt"><h4>Passou a se cuidar</h4>
      <p>Console interno com diagnóstico nomeado, linter de template e a máquina do tempo que reabre qualquer versão antiga.</p></div></div>
  </div></div>
  ${rodape('')}
</section>`,
`O slide que responde "o produto amadureceu em quê, exatamente".
Cada item tem lastro no histórico — vale citar o incidente do sync (item 2) e a rotação da chave do Gemini pra Edge Function (item 4).
Duração: 1min30.`,
{ tipo: 'Síntese do histórico', imagens: [], confianca: 'Alto', obs: 'Baseado em commit-map/luma-timeline.md e docs/LUMA.md.' });

// ══ BLOCO 6 — ESTADO ATUAL ══════════════════════════════════════════════════
const galeria = ['home', 'catalogo', 'chat', 'designer', 'exportar', 'cli'].filter(c => tem('M8', c));
if (galeria.length >= 4) {
  S(`<section class="slide">${topo('Estado atual', '30/07/2026 · branch atual')}
    <div class="s-corpo"><h2 class="s-titulo" style="font-size:54px;margin-bottom:24px">O produto hoje, tela por tela</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:22px;height:calc(100% - 92px)">
      ${galeria.slice(0, 6).map(c => `<div style="display:flex;flex-direction:column;min-height:0">
        <div class="tela-img" style="flex:1"><img src="${img('M8', c)}" alt="${esc(c)}"></div>
        <div style="margin-top:9px;font-size:19px;font-weight:800">${esc({ home:'Vitrine', catalogo:'Campanha aberta', chat:'Chat que monta a arte', designer:'Estúdio', exportar:'Exportar', cli:'Console do time', 'minhas-artes':'Minhas artes' }[c] || c)}</div>
      </div>`).join('')}
    </div></div>
    ${rodape('', { txt: 'execuções reais da branch atual', nivel: 'alto' })}
  </section>`,
  `Panorama. Não descreva tela por tela — deixe a imagem falar e diga só que tudo aqui foi capturado da mesma versão, no mesmo dia.
Duração: 40s.`,
  { tipo: 'Capturas reais da branch atual', imagens: galeria.slice(0, 6).map(c => img('M8', c)), confianca: 'Alto', obs: 'Todas do mesmo commit.' });
}

// ══ BLOCO 7 — FECHAMENTO ════════════════════════════════════════════════════
S(`<section class="slide">${topo('O tamanho da evolução')}
  <div class="s-corpo"><h2 class="s-titulo" style="font-size:56px">O que sustenta esta apresentação</h2>
  <div class="numeros" style="grid-template-columns:repeat(3,1fr);grid-template-rows:1fr 1fr;margin-top:44px;height:calc(100% - 120px)">
    <div class="num-card"><div class="num-v">81</div><div class="num-r">commits analisados,<br>de 3 autores</div></div>
    <div class="num-card"><div class="num-v">54</div><div class="num-r">deles mexem em tela<br>(HTML, CSS ou JS)</div></div>
    <div class="num-card destaque"><div class="num-v" id="n-marcos">9</div><div class="num-r">marcos executados<br>e capturados</div></div>
    <div class="num-card"><div class="num-v" id="n-shots">—</div><div class="num-r">capturas reais<br>produzidas</div></div>
    <div class="num-card"><div class="num-v" id="n-feats">—</div><div class="num-r">funcionalidades<br>localizadas no atlas</div></div>
    <div class="num-card"><div class="num-v">0</div><div class="num-r">imagens reconstruídas<br>ou ilustradas</div></div>
  </div></div>
  ${rodape('')}
</section>`,
`O slide de auditoria. O número que mais importa é o último: zero reconstruções. Tudo que está na apresentação é execução real.
Se alguém quiser conferir qualquer imagem, o índice de evidências dá commit, data, cena e viewport de cada uma.
Duração: 50s.`,
{ tipo: 'Auditoria', imagens: [], confianca: 'Alto', obs: 'Números preenchidos na montagem a partir dos arquivos gerados.' });

S(`<section class="slide capa">
  <div class="c-marca">Para fechar</div>
  <h1>Não é um conjunto<br>de telas.<br><em>É um produto.</em></h1>
  <div class="c-sub">O piloto já tinha a ideia certa: perguntar em vez de mandar desenhar. O que veio depois foi tudo que uma ideia precisa pra virar ferramenta de trabalho — lugar pra guardar, permissão pra confiar, rede pra falhar sem perder, e uma linguagem visual própria.</div>
  <div class="c-meta">
    <div><b>Ainda em construção</b>o roadmap da v1 segue aberto em luma-brain/07</div>
    <div><b>Reproduzível</b>node docs/luma-evolution/scripts/tudo.js</div>
  </div>
</section>`,
`Fechamento. A frase de efeito tem lastro: o chat guiado do piloto continua sendo o centro do produto — o que mudou foi tudo em volta.
Termine convidando: a apresentação se regenera com um comando, então ela acompanha o produto em vez de envelhecer.
Duração: 45s.`,
{ tipo: 'Encerramento', imagens: [], confianca: 'Alto', obs: '' });

module.exports = M;
