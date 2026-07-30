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
const G_CLI_VERSION = '1.0';   // aparece no título da caixa de boas-vindas
let _gCliMontado = false;
let _gCliAberto = false;
let _gCliHist = [];        // histórico de comandos (setas ↑/↓), só da sessão
let _gCliHistIdx = -1;
let _gCliBusy = false;

/* ══ BANNER ══
   Caixa desenhada com box-drawing, no estilo dos CLIs de terminal: moldura com título,
   mascote na coluna da esquerda e dicas na direita. Tudo é TEXTO monoespaçado — a
   moldura é o próprio caractere, não borda de CSS, senão perde a cara de terminal.

   O robô do Luma bate embaixadinha: só a BOLA e o PÉ mudam entre os quadros, então em
   vez de 9 quadros literais existe uma base + a trajetória da bola. Menos arte pra
   manter e a curva fica editável num lugar só. */
const G_CLI_ROBO_W = 13;
const G_CLI_ROBO_BASE = [
  '             ',
  '  ╭───────╮  ',
  '  │ ◠   ◠ │  ',
  '  │   ◡   │  ',
  '  ╰──┬─┬──╯  ',
  '   ╭─┴─┴─╮   ',
  '   │ LUMA│   ',
  '   ╰┬───┬╯   ',
  '    ╵   ╵    '
];
// Ciclo da bola [linha, coluna]: sobe pela direita, cai no pé, é devolvida pra cima.
const G_CLI_BOLA = [[0,10],[1,11],[2,12],[4,12],[6,11],[7,10],[8,9],[6,10],[4,11],[2,11]];
const G_CLI_PE_CHUTE = '    ╵  ╱     '.slice(0, G_CLI_ROBO_W);

function _gCliRoboFrame(i){
  const rows = G_CLI_ROBO_BASE.slice();
  const p = G_CLI_BOLA[i % G_CLI_BOLA.length];
  const r = p[0], c = p[1];
  // O pé PRIMEIRO: ele troca a linha 8 inteira e, se viesse depois, apagaria a bola
  // justamente no quadro do contato (a bola sumia de vista no meio da embaixadinha).
  if (r >= 7) rows[8] = G_CLI_PE_CHUTE;   // contato: o pé direito levanta pra devolver
  rows[r] = rows[r].substring(0, c) + '●' + rows[r].substring(c + 1);
  return rows;
}

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
2. Se um comando daqui ajuda a investigar ou resolver, coloque em "comando" (só o comando, sem explicação). Se nenhum serve, "comando" vazio.
3. No máximo 6 linhas. Sem emoji.
4. Se a pergunta for sobre algo que você não sabe do Luma, diga isso em vez de chutar.

Responda APENAS JSON: {"resposta":"...","comando":""}`;

  const txt = await gAskAI('cli', prompt, { json: true });
  const p = txt && (typeof gAiParseJson === 'function' ? gAiParseJson(txt) : null);
  if (!p || !p.resposta) return '<span class="cli-err">a IA não respondeu agora.</span>';
  let out = gEsc(String(p.resposta).trim());
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
      ${['ajuda', 'diag', 'sync status', 'pastas ls', 'cache ls'].map(c => `<button type="button" class="cli-chip" onclick="_gCliChip('${c}')">${c}</button>`).join('')}
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

function _gCliPrint(html, cls) {
  const body = _gCliBody(); if (!body) return;
  const l = document.createElement('div');
  l.className = 'cli-line' + (cls ? ' ' + cls : '');
  l.innerHTML = html;
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
let _gCliRoboI = 0;

function _gCliInfoLinhas(IW) {
  const u = (typeof gCurrentUser === 'function') ? gCurrentUser() : null;
  const nome = (u && u.displayName ? String(u.displayName) : '').trim().split(/[\s@]/)[0] || 'você';
  const role = (typeof gCurrentRole === 'function') ? (gCurrentRole() || '?') : '?';
  const backend = (typeof gHasBackend === 'function' && gHasBackend()) ? 'Supabase' : 'local';
  const ia = (typeof gAiReady === 'function' && gAiReady()) ? ((typeof gAiModel === 'function') ? gAiModel() : 'on') : 'off';
  // Coluna estreita (celular) recebe texto CURTO, não texto cortado: fatiar a frase no
  // meio da palavra ("radiografia do catálo") lê como bug, não como layout.
  const curto = IW < 40;
  return [
    { t: '' },
    { t: 'Console do time  ·  v' + G_CLI_VERSION, cls: 'cli-b-tit' },
    { t: '' },
    { t: 'Boa, ' + nome + '!', cls: 'cli-b-oi' },
    { t: role + ' · backend ' + backend, cls: 'cli-b-meta' },
    { t: 'ia ' + ia, cls: 'cli-b-meta' },
    { t: 'Comece por', cls: 'cli-b-meta' },
    { t: curto ? 'diag     estado do catálogo' : 'diag     radiografia do catálogo e do sync', cmd: 'diag' },
    { t: curto ? 'ajuda    todos os comandos' : 'ajuda    a lista inteira de comandos', cmd: 'ajuda' }
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
  const info = _gCliInfoLinhas(IW);
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
    return '<span class="cli-fr">│</span>' + `<span class="cli-robo">${r}</span>`
      + '<span class="cli-fr"> │ </span>' + corpo + '<span class="cli-fr">│</span>';
  });
  return topo + '\n' + linhas.join('\n') + '\n' + base;
}

function _gCliBanner() {
  const box = _gCliPrint(_gCliCaixaHTML(0), 'cli-banner');
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
  }, 130);
}
function _gCliRoboStop() {
  if (_gCliRoboTimer) { clearInterval(_gCliRoboTimer); _gCliRoboTimer = null; }
}

/* ══ SPINNER DE LINHA ══
   O "sinalzinho rodando" enquanto o comando (ou a IA) trabalha: gira no lugar, conta o
   tempo depois de 1s e é REMOVIDO quando a resposta chega — a linha do spinner não fica
   como histórico falso. Caracteres de quadrante existem em qualquer fonte mono (o braille
   dos CLIs de terminal viraria caixinha em parte dos sistemas). */
const G_CLI_SPIN = ['▖', '▘', '▝', '▗'];
function _gCliSpinStart(rotulo) {
  const el = _gCliPrint(`<span class="cli-sp">${G_CLI_SPIN[0]}</span> <span class="cli-dim">${gEsc(rotulo)}</span>`, 'cli-out');
  if (!el) return null;
  const t0 = Date.now();
  let i = 0;
  const timer = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    el.innerHTML = `<span class="cli-sp">${G_CLI_SPIN[++i % G_CLI_SPIN.length]}</span> `
      + `<span class="cli-dim">${gEsc(rotulo)}${s >= 1 ? ' (' + s + 's)' : ''}</span>`;
  }, 120);
  return { el, timer };
}
function _gCliSpinStop(h) {
  if (!h) return;
  clearInterval(h.timer);
  if (h.el && h.el.parentNode) h.el.remove();
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
  // Rótulo honesto: comando "roda", IA "pensa". Nada de barra de progresso falsa —
  // não há como saber a fração de nada disso.
  const linha_spin = _gCliSpinStart(cmd ? 'rodando ' + nome + '…' : 'pensando…');
  try {
    const out = await exec();
    _gCliSpinStop(linha_spin);
    if (out) _gCliPrint(out, 'cli-out');
  } catch (e) {
    _gCliSpinStop(linha_spin);
    _gCliPrint(`<span class="cli-err">estourou: ${gEsc(String(e && e.message || e))}</span>`, 'cli-out');
  } finally {
    _gCliSpinStop(linha_spin);
    _gCliBusy = false;
    if (spin) spin.classList.remove('on');
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
