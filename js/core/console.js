/**
 * js/core/console.js — LUMA CLI
 *
 * Console de comandos do Luma, só pra quem é da casa (equipe_dm/gestao).
 * Abre com Ctrl+` e fecha com Esc.
 *
 * POR QUE EXISTE: o diagnóstico de sync era feito colando snippet no DevTools —
 * conhecimento que vivia em log de conversa (ver o incidente de 07/2026 no
 * docs/LUMA-BACKEND-CHANGELOG.md: "30 pastas no banco e 0 templates"). Aqui esses
 * snippets viram comando nomeado: documentado, repetível e igual toda vez.
 *
 * ⛔ NÃO é fronteira de segurança. O gate por role é de UX; quem governa é a RLS.
 * Todo comando roda com a sessão do próprio usuário — o console não dá poder que o
 * DevTools já não desse. Se algum comando só é seguro "porque só dev vê", ele está
 * errado e não entra aqui.
 *
 * Depende de: core/toast.js (gToast/gConfirm), core/auth.js (gIsAdmin/gCurrentRole),
 * core/supabase.js (gHasBackend/gPendingDeletes), core/ai.js (gAskAI) — todos opcionais:
 * comando que não encontra sua dependência diz isso em vez de estourar.
 */

const G_CLI_ATALHO = 'Ctrl+`';
const G_CLI_VERSION = '1.1';   // aparece no título da caixa de boas-vindas
let _gCliMontado = false;
let _gCliAberto = false;
let _gCliHist = [];        // histórico de comandos (setas ↑/↓), só da sessão
let _gCliHistIdx = -1;
let _gCliBusy = false;

/* ══ MASCOTE — o robô do Luma batendo embaixadinha ══
   Tudo aqui é TEXTO monoespaçado: a moldura, o robô, a bola e a sombra. A moldura é o
   próprio caractere (não borda de CSS), senão perde a cara de terminal.

   A arte é UMA base de 13 linhas × 22 colunas; cada quadro sai de mutações dela
   (olhos, boca, antena, LEDs, braços, pernas, bola, sombra, contador). Assim há uma
   arte pra manter em vez de 26 quadros literais, e ajustar o robô é mexer numa linha.

   GEOMETRIA: o robô é centrado na coluna 10 e a trajetória da bola é declarada só pela
   METADE ESQUERDA — o meio-ciclo seguinte é o espelho (col → 20-col). É isso que faz o
   pé ALTERNAR sozinho: sai embaixadinha de verdade, não um quique repetido. */
const G_CLI_ROBO_W = 22;
const G_CLI_ROBO_CX = 10;      // coluna do centro do robô = eixo do espelho
const G_CLI_ROBO_BASE = [
  '                      ', // 0  espaço aéreo (ápice da bola)
  '          ◦           ', // 1  bulbo da antena (pulsa)
  '          │           ', // 2  haste
  '      ╭───┴───╮       ', // 3  topo da cabeça
  '      │ ◉ · ◉ │       ', // 4  olhos (piscam)
  '      │ ╰───╯ │       ', // 5  boca (abre no toque)
  '      ╰──┬─┬──╯       ', // 6  pescoço
  '     ╔═══╧═╧═══╗      ', // 7  ombros
  '     ║ L U M A ║      ', // 8  peito
  '  ▪──╢▪▫▪▫▪▫▪▫▪╟──▪   ', // 9  braços + painel de LEDs
  '     ╚═══╤═╤═══╝      ', // 10 quadril
  '        ─╯ ╰─         ', // 11 pés (o que chuta vira ╱ ou ╲)
  '    ▁▁▁▁▁▁▁▁▁▁▁▁▁     '  // 12 chão — recebe a sombra e o contador
];
// Meio-ciclo da bola [linha, coluna]: sai do pé esquerdo, sobe pela esquerda, passa por
// cima da cabeça e desce pela direita até a altura do pé direito. Índice 0 é o TOQUE.
// As linhas 1 e 9 ficam de fora de propósito: são as do bulbo e a dos braços.
const G_CLI_BOLA = [[11,8],[10,7],[8,6],[6,5],[4,4],[2,5],[0,7],[0,13],[2,15],[4,16],[6,15],[8,14],[10,13]];
// Braços por altura da bola: 0 abertos, 1 estendidos (ela está no alto), 2 recolhidos
// (chute). Larguras fixas — 5 à esquerda (col 0-4) e 6 à direita (col 16-21).
const G_CLI_BRACO_E = ['  ▪──', ' ▪───', '   ▪─'];
const G_CLI_BRACO_D = ['──▪   ', '───▪  ', '─▪    '];

// Onde a bola está no quadro f. Meio-ciclo par usa a curva declarada; ímpar usa o
// espelho — é o que troca o pé de apoio.
function _gCliBolaPos(f) {
  const n = G_CLI_BOLA.length;
  const p = G_CLI_BOLA[f % n];
  const espelho = Math.floor(f / n) % 2 === 1;
  return [p[0], espelho ? (2 * G_CLI_ROBO_CX - p[1]) : p[1]];
}

// Monta o quadro como grade de células [caractere, classe]. A classe é o que permite
// pintar cada peça de uma cor (corpo, rosto, LED, bola, chão) sem quebrar a moldura:
// a largura continua sendo 1 caractere por coluna, o span só colore.
function _gCliRoboFrame(f) {
  const W = G_CLI_ROBO_W;
  const g = G_CLI_ROBO_BASE.map(linha => {
    const s = linha.padEnd(W);
    const cs = [];
    for (let i = 0; i < W; i++) cs.push([s.charAt(i), 'cli-r-body']);
    return cs;
  });
  const set = (r, c, ch, cls) => { if (g[r] && g[r][c]) g[r][c] = [ch, cls || 'cli-r-body']; };
  const cor = (r, c, cls) => { if (g[r] && g[r][c]) g[r][c][1] = cls; };
  const vazio = (r, c) => !!(g[r] && g[r][c] && g[r][c][0] === ' ');

  const pos = _gCliBolaPos(f), br = pos[0], bc = pos[1];
  const toque = br === 11;

  // Rosto: os olhos SEGUEM a bola (◐ à esquerda, ◑ à direita, ◉ arregalado quando ela
  // está por cima), pisca uma vez a cada ciclo e a boca abre no toque ("hup!").
  const pisca = (f % (G_CLI_BOLA.length * 2)) === 25;
  const olho = pisca ? '─' : (br <= 2 ? '◉' : (bc < G_CLI_ROBO_CX ? '◐' : '◑'));
  set(4, 8, olho, 'cli-r-face');
  set(4, 12, olho, 'cli-r-face');
  for (let c = 8; c <= 12; c++) cor(5, c, 'cli-r-face');
  if (toque) set(5, 10, '○', 'cli-r-face');

  // Antena: • e não ●, senão vira uma segunda bola parada em cima da cabeça.
  set(1, 10, (Math.floor(f / 4) % 2) ? '•' : '◦', 'cli-r-led');
  for (let c = 7; c <= 13; c++) cor(8, c, 'cli-r-tag');           // o L U M A do peito

  // Painel de LEDs correndo. /3 porque a 12 quadros/s o alternado puro vira estrobo.
  const fase = Math.floor(f / 3);
  for (let c = 6; c <= 14; c++) set(9, c, ((c + fase) % 2) ? '▫' : '▪', 'cli-r-led');

  const braco = (br <= 2) ? 1 : (br >= 10 ? 2 : 0);
  for (let c = 0; c < 5; c++) set(9, c, G_CLI_BRACO_E[braco].charAt(c));
  for (let c = 0; c < 6; c++) set(9, 16 + c, G_CLI_BRACO_D[braco].charAt(c));

  // Bola baixa = perna correspondente subindo. Regra pela POSIÇÃO da bola (não por
  // índice do quadro) porque assim o espelho já dá o pé certo, sem contabilidade extra.
  if (br >= 10) {
    if (bc < G_CLI_ROBO_CX) { set(11, 8, '╱'); set(11, 9, '╱'); }
    else { set(11, 11, '╲'); set(11, 12, '╲'); }
  }

  for (let c = 4; c <= 16; c++) cor(12, c, 'cli-r-ground');
  set(12, bc, br >= 10 ? '▄' : (br >= 6 ? '▃' : (br >= 2 ? '▂' : '▁')), 'cli-r-ground');

  // Contador de embaixadinhas: um toque por meio-ciclo, então sai da conta do quadro —
  // nenhum estado extra pra sincronizar. Teto em 999 pra não estourar as 4 colunas.
  const n = Math.min(999, 1 + Math.floor(f / G_CLI_BOLA.length));
  const marcador = ('×' + n).padStart(4);
  for (let c = 0; c < 4; c++) set(12, 18 + c, marcador.charAt(c), 'cli-r-count');

  // Rastro só no ar aberto (linha ≤ 6, acima dos ombros) e só onde havia espaço. Abaixo
  // disso a bola passa NA FRENTE do tronco: o ponto cairia dentro do peito e leria como
  // sujeira na arte, não como rastro.
  if (f > 0) {
    const a = _gCliBolaPos(f - 1);
    if (a[0] <= 6 && vazio(a[0], a[1])) set(a[0], a[1], '·', 'cli-r-trail');
  }
  set(br, bc, '●', 'cli-r-ball');   // a bola por último: ela passa NA FRENTE do robô
  return g;
}

// Células → HTML, agrupando vizinhas de mesma classe (uma linha vira ~6 spans, não 22).
function _gCliRoboLinhaHTML(cells) {
  let out = '', buf = '', cls = cells.length ? cells[0][1] : '';
  cells.forEach(cel => {
    if (cel[1] !== cls) { out += `<span class="${cls}">${gEsc(buf)}</span>`; buf = ''; cls = cel[1]; }
    buf += cel[0];
  });
  return out + `<span class="${cls}">${gEsc(buf)}</span>`;
}

/* ══ MODELOS DE IA OFERECIDOS ══
   Só APELIDOS `-latest`: o Google aponta o apelido pro modelo atual, então aposentar uma
   versão não quebra o Luma de novo (foi o que matou o 'gemini-1.5-flash' — ver
   js/00-config.js). A lista é atalho, não trava: o comando aceita qualquer nome válido. */
const G_CLI_MODELOS = [
  { id: 'gemini-flash-latest',      desc: 'padrão — rápido e barato' },
  { id: 'gemini-flash-lite-latest', desc: 'o mais rápido; respostas mais curtas' },
  { id: 'gemini-pro-latest',        desc: 'o mais capaz; mais lento e mais caro' }
];

/* ══ REGISTRO DE COMANDOS ══
   run() devolve string (ou Promise<string>) já em HTML seguro — todo dado de fora
   passa por gEsc. Comando novo entra aqui e ganha ajuda/autocomplete de graça. */
const G_CLI_CMDS = {
  ajuda: {
    uso: 'ajuda',
    desc: 'Lista os comandos',
    run: () => {
      const linhas = Object.keys(G_CLI_CMDS).map(k => {
        const c = G_CLI_CMDS[k];
        return `  <b>${gEsc(c.uso)}</b>${' '.repeat(Math.max(1, 22 - c.uso.length))}<span class="cli-dim">${gEsc(c.desc)}</span>`;
      }).join('\n');
      return `COMANDOS\n${linhas}\n\n<span class="cli-dim">Qualquer outra frase vira pergunta pra IA. Ex.: "por que o franqueado não vê o material novo?"</span>`;
    }
  },

  diag: {
    uso: 'diag',
    desc: 'Radiografia da sessão: sync, cache, banco e IA',
    run: async () => {
      const L = [];
      const dot = (est) => `<span class="cli-dot ${est}"></span>`;
      // 1. quem é
      const u = (typeof gCurrentUser === 'function') ? gCurrentUser() : null;
      const role = (typeof gCurrentRole === 'function') ? gCurrentRole() : '?';
      L.push(`${dot(u ? 'ok' : 'err')} sessão      ${u ? gEsc(u.email || '?') + ' · ' + gEsc(role || '?') : 'sem sessão'}`);
      // 2. backend
      const temBackend = (typeof gHasBackend === 'function') && gHasBackend();
      L.push(`${dot(temBackend ? 'ok' : 'warn')} backend     ${temBackend ? 'Supabase ligado' : 'modo local (localStorage)'}`);
      // 3. IA
      const iaOk = (typeof gAiReady === 'function') && gAiReady();
      const modelo = (typeof gAiModel === 'function') ? gAiModel() : '?';
      L.push(`${dot(iaOk ? 'ok' : 'warn')} ia          ${iaOk ? gEsc(modelo) : 'sem caminho (nem function, nem chave)'}`);
      // 4. catálogo local
      const pastas = (typeof dFolders !== 'undefined' && dFolders) ? dFolders : [];
      let tmpls = 0, pend = 0, semRemote = 0, lazy = 0, capaLocal = 0, semCapa = 0;
      pastas.forEach(f => {
        (f.templates || []).forEach(t => { tmpls++; if (t._syncPending) pend++; if (t._needsLayersFetch) lazy++; });
        if (!f.remoteId) semRemote++;
        const cv = String(f.cover || '');
        if (cv.startsWith('data:') || cv.indexOf('idb://') === 0 || cv === '__local__') capaLocal++;
        else if (!cv) semCapa++;
      });
      L.push(`${dot(pastas.length ? 'ok' : 'warn')} local       ${pastas.length} pasta(s) · ${tmpls} material(is)${lazy ? ' · ' + lazy + ' sem layers baixados' : ''}`);
      L.push(`${dot(pend ? 'warn' : 'ok')} pendências  ${pend} material(is) não sincronizado(s)${semRemote ? ' · ' + semRemote + ' pasta(s) só local' : ''}`);
      // 5. deleções que falharam
      const del = (typeof gPendingDeletes === 'function') ? gPendingDeletes() : [];
      L.push(`${dot(del.length ? 'warn' : 'ok')} deleções    ${del.length} na fila de retry`);
      // 6. capas — a pergunta "por que a capa nova não pega?" morre aqui.
      // Capa em data:/idb:// é capa que NÃO subiu pro Storage: o push omite o cover_url e o
      // pull seguinte devolve vazio. Junto com o teste do bucket abaixo, dá a causa.
      L.push(`${dot(capaLocal ? 'err' : 'ok')} capas       ${capaLocal} pasta(s) com capa só local (não subiu) · ${semCapa} sem capa`);
      let bytes = 0, chaves = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; // UTF-16
          chaves++;
        }
      } catch (e) {}
      const mb = (bytes / 1048576);
      L.push(`${dot(mb > 4 ? 'err' : (mb > 3 ? 'warn' : 'ok'))} storage     ${mb.toFixed(2)} MB em ${chaves} chave(s) <span class="cli-dim">(teto ~5 MB)</span>`);
      // 7. o banco — a linha que explicou o incidente de 07/2026
      if (temBackend && u) {
        const sb = (typeof gSupabase === 'function') ? gSupabase() : window.sb;
        try {
          const [p, t] = await Promise.all([
            sb.schema('luma').from('pastas').select('id', { count: 'exact', head: true }),
            sb.schema('luma').from('templates').select('id', { count: 'exact', head: true })
          ]);
          const np = p.error ? null : (p.count || 0);
          const nt = t.error ? null : (t.count || 0);
          const ruim = (np === null || nt === null) || (np > 0 && nt === 0);
          L.push(`${dot(ruim ? 'err' : 'ok')} banco       ${np === null ? 'pastas: ERRO ' + gEsc(p.error.message || '') : np + ' pasta(s)'} · ${nt === null ? 'templates: ERRO ' + gEsc(t.error.message || '') : nt + ' material(is)'}`);
          if (np > 0 && nt === 0) L.push(`  <span class="cli-err">↑ pastas no banco e ZERO materiais é a assinatura do sync quebrado (migration não aplicada).</span>`);
        } catch (e) {
          L.push(`${dot('err')} banco       falhou ao consultar: ${gEsc(String(e && e.message || e))}`);
        }
        // Bucket da capa: se ele não responde, capa nova NUNCA pega (o push omite o
        // cover_url e o pull devolve vazio). É o teste que nomeia essa causa.
        try {
          const { error: eB } = await sb.storage.from('luma-covers').list('', { limit: 1 });
          L.push(`${dot(eB ? 'err' : 'ok')} bucket capa ${eB ? 'luma-covers NÃO responde: ' + gEsc(eB.message || '') : 'luma-covers ok'}`);
          if (eB) L.push(`  <span class="cli-err">↑ sem este bucket a capa fica só no aparelho: o upload falha e o banco segue sem capa.</span>`);
        } catch (e) {
          L.push(`${dot('err')} bucket capa falhou ao testar: ${gEsc(String(e && e.message || e))}`);
        }
      } else {
        L.push(`${dot('warn')} banco       não consultado (sem backend ou sem sessão)`);
      }
      return L.join('\n');
    }
  },

  sync: {
    uso: 'sync status|push|pull',
    desc: 'Estado do sync, ou força subir/baixar o catálogo',
    run: async (args) => {
      const acao = (args[0] || 'status').toLowerCase();
      const pastas = (typeof dFolders !== 'undefined' && dFolders) ? dFolders : [];
      const contaPend = () => {
        let n = 0; pastas.forEach(f => (f.templates || []).forEach(t => { if (t._syncPending) n++; }));
        return n;
      };
      if (acao === 'status') {
        const del = (typeof gPendingDeletes === 'function') ? gPendingDeletes() : [];
        const lista = del.slice(0, 8).map(d => `  ${gEsc(d.table)} · ${gEsc(String(d.val).slice(0, 8))}…`).join('\n');
        return `pendentes: ${contaPend()} material(is)\ndeleções na fila: ${del.length}${lista ? '\n' + lista : ''}`;
      }
      if (acao === 'push') {
        if (typeof _dPushFoldersNow !== 'function') return '<span class="cli-err">push indisponível (entre no Estúdio primeiro).</span>';
        const antes = contaPend();
        await _dPushFoldersNow();
        const depois = contaPend();
        if (typeof gSyncBadgeUpdate === 'function') try { gSyncBadgeUpdate(); } catch (e) {}
        return `push concluído · pendentes ${antes} → ${depois}${depois ? '\n<span class="cli-warn">Sobrou pendência: veja o console do navegador pelo motivo (upsert/RLS/rede).</span>' : ''}`;
      }
      if (acao === 'pull') {
        if (typeof dSyncFoldersFromBackend !== 'function') return '<span class="cli-err">pull indisponível neste contexto.</span>';
        const antes = { p: pastas.length, t: pastas.reduce((n, f) => n + (f.templates || []).length, 0) };
        await dSyncFoldersFromBackend();
        const agora = (typeof dFolders !== 'undefined' && dFolders) ? dFolders : [];
        const depois = { p: agora.length, t: agora.reduce((n, f) => n + (f.templates || []).length, 0) };
        return `pull concluído · pastas ${antes.p} → ${depois.p} · materiais ${antes.t} → ${depois.t}`;
      }
      return `<span class="cli-err">uso: sync status|push|pull</span>`;
    }
  },

  pastas: {
    uso: 'pastas [ls|<id>]',
    desc: 'Lista as pastas locais ou detalha uma',
    run: (args) => {
      const pastas = (typeof dFolders !== 'undefined' && dFolders) ? dFolders : [];
      if (!pastas.length) return 'nenhuma pasta carregada (dFolders vazio).';
      const alvo = args[0] && args[0].toLowerCase() !== 'ls' ? args[0] : null;
      if (!alvo) {
        const linhas = pastas.map(f => {
          const t = (f.templates || []).length;
          const pub = (f.templates || []).filter(x => x.publishMeta && x.publishMeta.publicado).length;
          const flags = [f.remoteId ? '' : 'só-local', f.arquivada ? 'arquivada' : '', f.cover ? '' : 'sem capa'].filter(Boolean).join(' ');
          return `  ${gEsc(String(f.id).slice(0, 14).padEnd(14))} ${gEsc((f.name || '?').slice(0, 26).padEnd(26))} ${String(t).padStart(2)} mat · ${pub} no ar ${flags ? '<span class="cli-warn">' + gEsc(flags) + '</span>' : ''}`;
        }).join('\n');
        return `${pastas.length} pasta(s)\n${linhas}`;
      }
      const f = pastas.find(x => String(x.id) === alvo || String(x.remoteId) === alvo || (x.name || '').toLowerCase().includes(alvo.toLowerCase()));
      if (!f) return `<span class="cli-err">pasta "${gEsc(alvo)}" não encontrada.</span>`;
      const mats = (f.templates || []).map(t => {
        const st = (t.publishMeta && t.publishMeta.publicado) ? 'publicado' : 'rascunho';
        const fl = [t._syncPending ? 'pendente' : '', t._needsLayersFetch ? 'sem layers' : ''].filter(Boolean).join(' ');
        return `  · ${gEsc((t.name || '?').slice(0, 30).padEnd(30))} ${gEsc(t.fmt || '?')} · ${st} ${fl ? '<span class="cli-warn">' + gEsc(fl) + '</span>' : ''}`;
      }).join('\n');
      return [
        `nome      ${gEsc(f.name || '?')}`,
        `id        ${gEsc(String(f.id))}`,
        `remoteId  ${f.remoteId ? gEsc(String(f.remoteId)) : '<span class="cli-warn">nenhum (nunca subiu)</span>'}`,
        `campId    ${f.campId ? gEsc(String(f.campId)) : '—'}`,
        `capa      ${f.cover ? gEsc(String(f.cover).slice(0, 60)) : '<span class="cli-warn">sem capa</span>'}`,
        `materiais ${(f.templates || []).length}`,
        mats
      ].filter(Boolean).join('\n');
    }
  },

  cache: {
    uso: 'cache [ls|clear <chave>]',
    desc: 'Inspeciona ou limpa o localStorage do Luma',
    run: async (args) => {
      const acao = (args[0] || 'ls').toLowerCase();
      if (acao === 'ls') {
        const itens = [];
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            itens.push({ k, kb: ((k.length + (localStorage.getItem(k) || '').length) * 2 / 1024) });
          }
        } catch (e) { return '<span class="cli-err">localStorage indisponível.</span>'; }
        itens.sort((a, b) => b.kb - a.kb);
        const linhas = itens.map(i => `  ${gEsc(i.k.slice(0, 38).padEnd(38))} ${i.kb.toFixed(1).padStart(8)} KB`).join('\n');
        const total = itens.reduce((n, i) => n + i.kb, 0);
        return `${itens.length} chave(s) · ${(total / 1024).toFixed(2)} MB\n${linhas}`;
      }
      if (acao === 'clear') {
        const chave = args[1];
        if (!chave) return '<span class="cli-err">uso: cache clear &lt;chave&gt; — o nome exato (veja em <b>cache ls</b>).</span>';
        if (localStorage.getItem(chave) === null) return `<span class="cli-err">chave "${gEsc(chave)}" não existe.</span>`;
        // Apagar cache é irreversível e pode custar trabalho não sincronizado. Confirma sempre.
        const ok = (typeof gConfirm === 'function')
          ? await gConfirm(`Apagar "${chave}" do armazenamento local?\n\nSe houver trabalho ainda não sincronizado nessa chave, ele se perde.`, { title: 'Limpar cache', okLabel: 'Apagar', danger: true })
          : false;
        if (!ok) return 'cancelado.';
        try { localStorage.removeItem(chave); } catch (e) { return '<span class="cli-err">falhou ao apagar.</span>'; }
        return `"${gEsc(chave)}" apagada. <span class="cli-warn">Recarregue a página pra ver o efeito.</span>`;
      }
      return '<span class="cli-err">uso: cache ls|clear &lt;chave&gt;</span>';
    }
  },

  ia: {
    uso: 'ia <pergunta>',
    desc: 'Pergunta em português (também é o padrão de qualquer frase)',
    run: (args) => _gCliAsk(args.join(' '))
  },

  modelo: {
    uso: 'modelo [nome]',
    desc: 'Mostra ou troca o modelo de IA usado pelo Luma',
    run: (args) => {
      const atual = (typeof gAiModel === 'function') ? gAiModel() : '?';
      const nome = (args[0] || '').trim();
      if (!nome) {
        const lista = G_CLI_MODELOS.map(m => {
          const marca = m.id === atual ? '<span class="cli-b-cmd">▸</span>' : ' ';
          return `  ${marca} <b>${gEsc(m.id)}</b>${' '.repeat(Math.max(1, 26 - m.id.length))}<span class="cli-dim">${gEsc(m.desc)}</span>`;
        }).join('\n');
        return `modelo atual: <b>${gEsc(atual)}</b>\n\n${lista}\n\n`
          + `<span class="cli-dim">trocar: <b>modelo &lt;nome&gt;</b> · voltar ao padrão: <b>modelo padrao</b>\n`
          + `Vale pra TODO recurso de IA do Luma (legenda, cardápio, ajuda), só neste aparelho.</span>`;
      }
      if (nome === 'padrao' || nome === 'padrão') {
        try { localStorage.removeItem('luma_gemini_model'); } catch (e) {}
        _gCliInfoCache = null;
        return `de volta ao padrão: <b>${gEsc((typeof gAiModel === 'function') ? gAiModel() : '?')}</b>`;
      }
      // Mesma regra do proxy (supabase/functions/ai): nome fora disso a function recusa,
      // então recusar aqui evita descobrir o erro só na próxima pergunta.
      if (!/^[a-z0-9.\-]{3,60}$/i.test(nome)) {
        return '<span class="cli-err">nome inválido — só letras, números, ponto e hífen (3 a 60).</span>';
      }
      try { localStorage.setItem('luma_gemini_model', nome); }
      catch (e) { return '<span class="cli-err">não deu pra salvar a escolha (localStorage bloqueado).</span>'; }
      window.LUMA_GEMINI_MODEL = nome;   // vale já nesta sessão, sem recarregar
      _gCliInfoCache = null;             // a caixa mostra o modelo — força redesenhar
      const conhecido = G_CLI_MODELOS.some(m => m.id === nome);
      return `modelo agora é <b>${gEsc(nome)}</b>.`
        + (conhecido ? '' : `\n<span class="cli-warn">Fora da lista — se o Google não conhecer esse nome, TODA a IA do Luma passa a falhar neste aparelho. Desfaz com: <b>modelo padrao</b></span>`);
    }
  },

  limpar: { uso: 'limpar', desc: 'Limpa a tela', run: () => { _gCliBody().innerHTML = ''; return ''; } },
  sair: { uso: 'sair', desc: 'Fecha o console', run: () => { gCliClose(); return ''; } }
};

/* ══ IA DENTRO DO TERMINAL ══
   Recebe o contexto real da sessão (o mesmo que o diag mede) + a lista de comandos.
   Pode SUGERIR um comando, e a sugestão só pré-preenche o campo — nunca executa
   sozinha. Regra da casa: nada destrutivo sem alguém apertando Enter. */
async function _gCliAsk(pergunta) {
  pergunta = (pergunta || '').trim();
  if (!pergunta) return '<span class="cli-err">pergunte algo. Ex.: ia por que o catálogo está vazio?</span>';
  if (typeof gAskAI !== 'function' || !gAiReady()) return '<span class="cli-err">IA indisponível (sem function publicada e sem chave).</span>';

  const pastas = (typeof dFolders !== 'undefined' && dFolders) ? dFolders : [];
  let tmpls = 0, pend = 0;
  pastas.forEach(f => (f.templates || []).forEach(t => { tmpls++; if (t._syncPending) pend++; }));
  _gCliSpinPasso(`contexto lido · ${pastas.length} pasta(s) · ${tmpls} material(is) · ${pend} pendente(s)`);
  const ctx = [
    `role: ${(typeof gCurrentRole === 'function' ? gCurrentRole() : '?')}`,
    `backend: ${(typeof gHasBackend === 'function' && gHasBackend()) ? 'ligado' : 'modo local'}`,
    `pastas locais: ${pastas.length}`,
    `materiais locais: ${tmpls}`,
    `materiais pendentes de sync: ${pend}`,
    `deleções na fila: ${(typeof gPendingDeletes === 'function' ? gPendingDeletes().length : 0)}`,
    `tela: ${document.body.classList.contains('mode-designer') ? 'Estúdio' : 'Franqueado'}`
  ].join('\n');
  const cmds = Object.keys(G_CLI_CMDS).map(k => `${G_CLI_CMDS[k].uso} — ${G_CLI_CMDS[k].desc}`).join('\n');

  const prompt = `Você é o console do Luma, a ferramenta interna de criação de artes da Delivery Much. Fala com quem MANTÉM o Luma (designer da DM, gestão, dev) — não com o franqueado. Tom: direto, técnico, sem enrolação, português do Brasil.

O QUE O LUMA É: front vanilla JS (sem build, sem framework) + Supabase. O designer cria templates no Estúdio; o franqueado preenche campos e baixa a arte. Catálogo vive em luma.pastas/luma.templates, com cache no localStorage (chaves yngs_*). RLS é a única fronteira de segurança. Sync é offline-first: push com debounce, pull no boot; material que falhou em subir fica com _syncPending.

CONTEXTO REAL DESTA SESSÃO:
${ctx}

COMANDOS DISPONÍVEIS NESTE CONSOLE:
${cmds}

PERGUNTA: "${pergunta}"

REGRAS:
1. Responda com base no contexto acima. Não invente número que não está nele.
2. Em "passos", de 2 a 4 itens CURTOS (até 8 palavras cada) dizendo o que você checou no contexto e o que concluiu — o caminho até a resposta, não a resposta repetida.
3. Se um comando daqui ajuda a investigar ou resolver, coloque em "comando" (só o comando, sem explicação). Se nenhum serve, "comando" vazio.
4. No máximo 6 linhas na resposta. Sem emoji.
5. Se a pergunta for sobre algo que você não sabe do Luma, diga isso em vez de chutar.

Responda APENAS JSON: {"passos":["...","..."],"resposta":"...","comando":""}`;

  const modelo = (typeof gAiModel === 'function') ? gAiModel() : '?';
  _gCliSpinPasso(`perguntando pro ${modelo}`);
  const txt = await gAskAI('cli', prompt, { json: true });
  _gCliSpinPasso(txt ? 'resposta recebida · lendo o JSON' : 'o modelo não respondeu');
  const p = txt && (typeof gAiParseJson === 'function' ? gAiParseJson(txt) : null);
  if (!p || !p.resposta) return '<span class="cli-err">a IA não respondeu agora.</span>';

  // O raciocínio é o que o MODELO diz ter feito pra chegar lá — vem no mesmo JSON, não é
  // roteiro nosso. Fica esmaecido acima da resposta: quem só quer o resultado ignora.
  let out = '';
  const passos = Array.isArray(p.passos) ? p.passos.slice(0, 4) : [];
  if (passos.length) {
    out += `<span class="cli-think-tit">raciocínio</span>\n`
      + passos.map(x => `<span class="cli-dim">  · ${gEsc(String(x).trim())}</span>`).join('\n')
      + '\n\n';
  }
  out += gEsc(String(p.resposta).trim());
  const cmd = String(p.comando || '').trim();
  if (cmd && G_CLI_CMDS[cmd.split(/\s+/)[0]]) {
    out += `\n\n<span class="cli-dim">sugestão:</span> <button type="button" class="cli-sug" onclick="_gCliSugerir('${gEsc(cmd).replace(/'/g, '&#39;')}')">${gEsc(cmd)}</button> <span class="cli-dim">(clique pra preencher)</span>`;
  }
  return out;
}
function _gCliSugerir(cmd) {
  const inp = document.getElementById('cli-input');
  if (!inp) return;
  inp.value = cmd;
  inp.focus();
}

/* ══ SHELL ══ */
function _gCliBody() { return document.getElementById('cli-body'); }

function _gCliMontar() {
  if (_gCliMontado) return;
  _gCliMontado = true;
  const el = document.createElement('div');
  el.id = 'luma-cli';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Luma CLI');
  el.innerHTML = `
    <div class="cli-head">
      <span class="cli-logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg></span>
      <span class="cli-title">Luma CLI</span>
      <span class="cli-badge" id="cli-role"></span>
      <span class="cli-head-sp"></span>
      <span class="cli-hint">${G_CLI_ATALHO} abre · Esc fecha</span>
      <button type="button" class="cli-x" onclick="gCliClose()" aria-label="Fechar console">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
    <div class="cli-body" id="cli-body" tabindex="0"></div>
    <div class="cli-chips" aria-label="Comandos rápidos">
      ${['ajuda', 'diag', 'modelo', 'sync status', 'pastas ls', 'cache ls'].map(c => `<button type="button" class="cli-chip" onclick="_gCliChip('${c}')">${c}</button>`).join('')}
    </div>
    <div class="cli-inputrow">
      <span class="cli-prompt" aria-hidden="true">luma ›</span>
      <input id="cli-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off"
             spellcheck="false" enterkeyhint="send" aria-label="Comando"
             placeholder="digite um comando ou uma pergunta">
      <span class="cli-spin" id="cli-spin" aria-hidden="true"></span>
    </div>`;
  document.body.appendChild(el);

  const inp = el.querySelector('#cli-input');
  inp.addEventListener('keydown', _gCliTeclas);
  // Clicar no corpo devolve o foco pro campo (comportamento de terminal)
  _gCliBody().addEventListener('click', (ev) => { if (!ev.target.closest('button')) inp.focus(); });

  // CELULAR: o teclado virtual não empurra `position:fixed` — o campo ficaria EMBAIXO
  // dele (você digita sem ver). O visualViewport diz quanto o teclado comeu; o console
  // sobe essa altura. No desktop o gap é 0 e nada acontece.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _gCliAjustaViewport);
    window.visualViewport.addEventListener('scroll', _gCliAjustaViewport);
    inp.addEventListener('focus', () => setTimeout(_gCliAjustaViewport, 120));
  }
}

function _gCliAjustaViewport() {
  const el = document.getElementById('luma-cli');
  if (!el || !_gCliAberto) return;
  const vv = window.visualViewport;
  if (!vv) return;
  const gap = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  el.style.bottom = gap ? gap + 'px' : '';
}

// Chip de comando rápido: no celular não existe Tab nem histórico com setas, então os
// comandos de leitura ficam a um toque. Só comando que NÃO muda nada entra na lista.
function _gCliChip(cmd) {
  const inp = document.getElementById('cli-input');
  if (inp) inp.value = '';
  _gCliExec(cmd);
}

// escalona=true faz cada LINHA da saída entrar com um atraso próprio — é o que dá o
// ritmo de terminal escrevendo em vez de o bloco aparecer seco. O atraso vive no CSS
// (uma animação por linha); com setTimeout, um diag de 30 linhas viraria 30 timers.
function _gCliEscalona(html) {
  return String(html).split('\n').map((ln, i) =>
    // o teto de 420ms é o que impede a saída longa de virar espera; ' ' segura a altura
    // da linha vazia (span em bloco sem conteúdo colapsa mesmo com pre-wrap)
    `<span class="cli-ln" style="animation-delay:${Math.min(i * 28, 420)}ms">${ln || ' '}</span>`
  ).join('');
}

function _gCliPrint(html, cls, escalona) {
  const body = _gCliBody(); if (!body) return;
  const l = document.createElement('div');
  l.className = 'cli-line' + (cls ? ' ' + cls : '');
  l.innerHTML = escalona ? _gCliEscalona(html) : html;
  body.appendChild(l);
  body.scrollTop = body.scrollHeight;
  return l;
}

/* ══ CAIXA DE BOAS-VINDAS ══
   Duas colunas dentro de uma moldura de texto: mascote à esquerda, contexto e dicas à
   direita. A largura é fixa em caracteres (padEnd) porque é isso que mantém a moldura
   fechada em fonte monoespaçada — medir em pixel aqui não fecha nunca. */
// Largura da coluna de texto. No celular a caixa inteira (13 do robô + 3 + info) tem que
// caber na tela sem quebrar a moldura, então a coluna encurta — a caixa é remontada a cada
// quadro, logo ela se adapta sozinha ao girar o aparelho.
function _gCliInfoW(){
  return (window.matchMedia && window.matchMedia('(max-width:640px)').matches) ? 30 : 48;
}
let _gCliRoboTimer = null;
let _gCliRoboI = 6;        // começa no ápice: é o quadro mais bonito parado (reduced-motion)
let _gCliInfoCache = null; // {iw, linhas}

// A caixa é redesenhada ~12×/s pela embaixadinha; ler sessão, backend e localStorage em
// cada quadro seria desperdício. O conteúdo só muda ao abrir o console ou ao trocar o
// modelo — os dois pontos invalidam este cache.
function _gCliInfo(IW) {
  if (!_gCliInfoCache || _gCliInfoCache.iw !== IW) _gCliInfoCache = { iw: IW, linhas: _gCliInfoLinhas(IW) };
  return _gCliInfoCache.linhas;
}

function _gCliInfoLinhas(IW) {
  const u = (typeof gCurrentUser === 'function') ? gCurrentUser() : null;
  const nome = (u && u.displayName ? String(u.displayName) : '').trim().split(/[\s@]/)[0] || 'você';
  const role = (typeof gCurrentRole === 'function') ? (gCurrentRole() || '?') : '?';
  const backend = (typeof gHasBackend === 'function' && gHasBackend()) ? 'Supabase' : 'local';
  const ia = (typeof gAiReady === 'function' && gAiReady()) ? ((typeof gAiModel === 'function') ? gAiModel() : 'on') : 'desligada';
  // Coluna estreita (celular) recebe texto CURTO, não texto cortado: fatiar a frase no
  // meio da palavra ("radiografia do catálo") lê como bug, não como layout.
  const curto = IW < 40;
  // 13 linhas — uma por linha do mascote. Sobrar/faltar aqui não quebra a moldura
  // (o padEnd fecha), mas desalinha a leitura das duas colunas.
  return [
    { t: '' },
    { t: 'Console do time  ·  v' + G_CLI_VERSION, cls: 'cli-b-tit' },
    { t: '' },
    { t: 'Boa, ' + nome + '!', cls: 'cli-b-oi' },
    { t: role + ' · backend ' + backend, cls: 'cli-b-meta' },
    { t: 'ia ' + ia, cls: 'cli-b-meta' },
    { t: '' },
    { t: 'Comece por', cls: 'cli-b-meta' },
    { t: curto ? 'diag     estado do catálogo' : 'diag     radiografia do catálogo e do sync', cmd: 'diag' },
    { t: curto ? 'modelo   troca o modelo da IA' : 'modelo   mostra e troca o modelo da IA', cmd: 'modelo' },
    { t: curto ? 'ajuda    todos os comandos' : 'ajuda    a lista inteira de comandos', cmd: 'ajuda' },
    { t: '' },
    { t: curto ? 'Tab · ↑ · Esc' : 'Tab completa · ↑ repete · Esc fecha', cls: 'cli-b-meta' }
  ];
}

// Monta a caixa inteira em HTML. Colunas coloridas por span; o padding é feito no TEXTO
// antes de virar HTML, senão a moldura desalinha.
function _gCliCaixaHTML(frame) {
  const robo = _gCliRoboFrame(frame);
  const tit = ' Luma CLI ';
  // MIOLO = tudo entre as duas bordas verticais. A linha de conteúdo é
  // │ + robô(13) + ' │ '(3) + info(IW) + │ — os três (topo, conteúdo, base) fecham na
  // mesma largura. Errar essa conta por 2 já deixou a moldura aberta do lado direito.
  const IW = _gCliInfoW();
  const info = _gCliInfo(IW);
  const miolo = G_CLI_ROBO_W + 3 + IW;
  // Título destacado como nas referências: os traços ficam esmaecidos, o nome não.
  const topo = `<span class="cli-fr">╭─</span><span class="cli-b-tit">${gEsc(tit)}</span>`
    + `<span class="cli-fr">${'─'.repeat(Math.max(0, miolo - 1 - tit.length))}╮</span>`;
  const base = `<span class="cli-fr">╰${'─'.repeat(miolo)}╯</span>`;
  const linhas = robo.map((r, i) => {
    const it = info[i] || { t: '' };
    const txt = String(it.t).padEnd(IW).slice(0, IW);
    // Linha de comando: o nome sai em laranja e a descrição esmaecida. O corte é feito
    // no texto JÁ preenchido, então o padding (e a moldura) não se mexe.
    const corpo = it.cmd
      ? `<span class="cli-b-cmd">${gEsc(txt.slice(0, it.cmd.length))}</span><span class="cli-b-dica">${gEsc(txt.slice(it.cmd.length))}</span>`
      : `<span class="${it.cls || 'cli-dim'}">${gEsc(txt)}</span>`;
    return '<span class="cli-fr">│</span>' + _gCliRoboLinhaHTML(r)
      + '<span class="cli-fr"> │ </span>' + corpo + '<span class="cli-fr">│</span>';
  });
  return topo + '\n' + linhas.join('\n') + '\n' + base;
}

function _gCliBanner() {
  const box = _gCliPrint(_gCliCaixaHTML(_gCliRoboI), 'cli-banner');
  if (box) box.id = 'cli-banner-box';
  _gCliPrint(`<span class="cli-dim">digite um comando, ou pergunte em português — <b>Tab</b> completa, <b>↑</b> repete.</span>\n`);
  _gCliRoboStart();
}

// A embaixadinha roda enquanto o console está aberto. Um timer só, parado no fechar.
// prefers-reduced-motion: fica no quadro parado (a caixa não perde nada).
function _gCliRoboStart() {
  _gCliRoboStop();
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  _gCliRoboTimer = setInterval(() => {
    const box = document.getElementById('cli-banner-box');
    if (!box || !_gCliAberto) { _gCliRoboStop(); return; }
    box.innerHTML = _gCliCaixaHTML(++_gCliRoboI);
  }, 85);   // 13 quadros por meio-ciclo ≈ 1,1s por embaixadinha — o ritmo de uma de verdade
}
function _gCliRoboStop() {
  if (_gCliRoboTimer) { clearInterval(_gCliRoboTimer); _gCliRoboTimer = null; }
}

/* ══ PENSAMENTO AO VIVO ══
   O bloco que mostra o trabalho SENDO FEITO enquanto o comando (ou a IA) roda: gira no
   lugar, conta o tempo e vai listando os passos conforme eles ACONTECEM de verdade —
   quem chama anuncia cada etapa com _gCliSpinPasso. Nada de roteiro fixo nem de barra de
   progresso: não há como saber a fração de uma chamada de rede, e passo inventado é
   mentira bonita. O bloco é REMOVIDO quando a resposta chega, pra não virar histórico.

   Caracteres de quadrante existem em qualquer fonte mono (o braille dos CLIs de terminal
   viraria caixinha em parte dos sistemas). */
const G_CLI_SPIN = ['▖', '▘', '▝', '▗'];
let _gCliSpinAtual = null;   // handle do bloco em curso — é por onde _gCliAsk anuncia passos

function _gCliSpinStart(rotulo) {
  const el = _gCliPrint('', 'cli-out cli-think');
  if (!el) return null;
  const h = { el, rotulo, t0: Date.now(), passos: [], i: 0, timer: null };
  _gCliSpinAtual = h;
  _gCliSpinPinta();
  h.timer = setInterval(() => { h.i++; _gCliSpinPinta(); }, 110);
  return h;
}

// Um passo REAL que acabou de acontecer. Entra no bloco na hora, com o ├/└ redesenhado.
function _gCliSpinPasso(txt) {
  const h = _gCliSpinAtual;
  if (!h) return;
  h.passos.push(String(txt));
  _gCliSpinPinta();
  const body = _gCliBody(); if (body) body.scrollTop = body.scrollHeight;
}

function _gCliSpinPinta() {
  const h = _gCliSpinAtual;
  if (!h || !h.el) return;
  const s = (Date.now() - h.t0) / 1000;
  const linhas = [
    `<span class="cli-sp">${G_CLI_SPIN[h.i % G_CLI_SPIN.length]}</span> `
    + `<span class="cli-think-tit">${gEsc(h.rotulo)}</span> <span class="cli-dim">${s.toFixed(1)}s</span>`
  ];
  h.passos.forEach((p, k) => {
    const ult = k === h.passos.length - 1;
    linhas.push(`<span class="cli-dim${ult ? ' cli-think-ult' : ''}">  ${ult ? '└' : '├'} ${gEsc(p)}</span>`);
  });
  h.el.innerHTML = linhas.join('\n');
}

function _gCliSpinStop(h) {
  h = h || _gCliSpinAtual;
  if (!h) return;
  clearInterval(h.timer);
  if (h.el && h.el.parentNode) h.el.remove();
  if (_gCliSpinAtual === h) _gCliSpinAtual = null;
}

async function _gCliExec(linha) {
  linha = (linha || '').trim();
  if (!linha) return;
  _gCliHist.push(linha); _gCliHistIdx = _gCliHist.length;
  _gCliPrint(`<span class="cli-echo-prompt">luma ›</span> ${gEsc(linha)}`, 'cli-echo');

  const partes = linha.split(/\s+/);
  const nome = partes[0].toLowerCase();
  const cmd = G_CLI_CMDS[nome];
  // Frase que não é comando conhecido vai pra IA — é o "modo conversa" do terminal.
  const exec = cmd ? () => cmd.run(partes.slice(1)) : () => _gCliAsk(linha);
  if (!cmd) _gCliPrint('<span class="cli-dim">(não é comando — perguntando pra IA)</span>');

  _gCliBusy = true;
  const spin = document.getElementById('cli-spin'); if (spin) spin.classList.add('on');
  const cx = document.getElementById('luma-cli'); if (cx) cx.classList.add('busy');
  // Rótulo honesto: comando "roda", IA "pensa". Nada de barra de progresso falsa —
  // não há como saber a fração de nada disso.
  const linha_spin = _gCliSpinStart(cmd ? 'rodando ' + nome : 'pensando');
  try {
    const out = await exec();
    _gCliSpinStop(linha_spin);
    if (out) _gCliPrint(out, 'cli-out', true);
  } catch (e) {
    _gCliSpinStop(linha_spin);
    _gCliPrint(`<span class="cli-err">estourou: ${gEsc(String(e && e.message || e))}</span>`, 'cli-out');
  } finally {
    _gCliSpinStop(linha_spin);
    _gCliBusy = false;
    if (spin) spin.classList.remove('on');
    if (cx) cx.classList.remove('busy');
    const body = _gCliBody(); if (body) body.scrollTop = body.scrollHeight;
  }
}

function _gCliTeclas(e) {
  const inp = e.currentTarget;
  // O console é modal pro teclado: não deixa atalho do Estúdio disparar por baixo.
  e.stopPropagation();
  if (e.key === 'Enter') {
    if (_gCliBusy) return;
    const v = inp.value; inp.value = '';
    _gCliExec(v);
    return;
  }
  if (e.key === 'Escape') { e.preventDefault(); gCliClose(); return; }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!_gCliHist.length) return;
    _gCliHistIdx = Math.max(0, _gCliHistIdx - 1);
    inp.value = _gCliHist[_gCliHistIdx] || '';
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!_gCliHist.length) return;
    _gCliHistIdx = Math.min(_gCliHist.length, _gCliHistIdx + 1);
    inp.value = _gCliHist[_gCliHistIdx] || '';
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const v = inp.value.trim().toLowerCase();
    if (!v || v.includes(' ')) return;
    const m = Object.keys(G_CLI_CMDS).filter(k => k.indexOf(v) === 0);
    if (m.length === 1) inp.value = m[0] + ' ';
    else if (m.length > 1) _gCliPrint(`<span class="cli-dim">${m.join('  ')}</span>`);
  }
}

function gCliOpen() {
  // Gate de UX por role (a RLS é quem protege de verdade — ver cabeçalho).
  if (typeof gIsAdmin !== 'function' || !gIsAdmin()) return;
  _gCliMontar();
  const el = document.getElementById('luma-cli');
  if (!el) return;
  _gCliAberto = true;
  el.classList.add('open');
  // Flutuantes do franqueado moram no MESMO rodapé e com z-index maior (aviso de PWA
  // 13000, FAB do widget de ajuda 9999): no celular eles cobrem o campo de comando e
  // roubam o toque. Saem de cena enquanto o console está aberto — ver console.css.
  document.body.classList.add('cli-on');
  const rl = document.getElementById('cli-role');
  if (rl) rl.textContent = (typeof gCurrentRole === 'function') ? (gCurrentRole() || '') : '';
  _gCliInfoCache = null;   // sessão/backend/modelo podem ter mudado desde a última abertura
  // 1ª abertura desenha a caixa; reabrir só religa a embaixadinha (o histórico fica).
  if (!_gCliBody().childElementCount) _gCliBanner(); else _gCliRoboStart();
  // No celular o foco imediato abre o teclado e cobre o banner: quem quiser digitar
  // toca no campo (ou num chip). No desktop o foco entra na hora, como todo terminal.
  const ehToque = window.matchMedia && window.matchMedia('(max-width:640px)').matches;
  if (!ehToque) setTimeout(() => { const i = document.getElementById('cli-input'); if (i) i.focus(); }, 40);
  _gCliAjustaViewport();
}
function gCliClose() {
  const el = document.getElementById('luma-cli');
  if (el) { el.classList.remove('open'); el.style.bottom = ''; }
  document.body.classList.remove('cli-on');
  _gCliAberto = false;
  _gCliRoboStop();   // console fechado não fica com timer girando atrás
}
function gCliToggle() { _gCliAberto ? gCliClose() : gCliOpen(); }

// Ctrl+` (nenhum atalho da base usa a crase — conferido antes de escolher).
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.code === 'Backquote')) {
    e.preventDefault();
    gCliToggle();
  }
});
