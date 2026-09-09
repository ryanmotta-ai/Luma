/**
 * js/core/feedback-admin.js
 * Consulta da equipe no painel da conta, carregada sob demanda.
 * A RLS e a RPC autorizam os dados; gIsAdmin é apenas o gate da interface.
 * Depende de: core/auth.js, core/supabase.js, core/toast.js.
 */
(function () {
  const pageSize = 20;

  /* ══ DADOS DE EXEMPLO ══════════════════════════════════════════════════════════════════
     A tela nasceu antes do volume: com a rede ainda calada (ou a consulta fora do ar) ela
     mostrava três frases de estado vazio e nada mais — impossível avaliar o desenho ou
     apresentar a feature. Então existe um preenchimento de demonstração.
     ⛔ Ele NUNCA se passa por dado real: entra só quando a consulta falha ou volta vazia, e
     sempre com o selo "dados de exemplo" no topo. Nada daqui é salvo nem enviado. */
  const DEMO_FEEDBACK = [
    {type:'campaign_feedback',rating:'negative',reason:'missing_format',camp_name:'Combo Família',template_name:'Combo 3 itens · Story',comment:'Precisava do mesmo combo em formato quadrado para o feed. Só tinha Story.',created_at:'2026-09-08T14:32:00Z'},
    {type:'campaign_feedback',rating:'positive',reason:null,camp_name:'Semana do Frango',template_name:'Oferta dupla · Feed',comment:'Ficou muito melhor que o material que eu fazia na mão.',created_at:'2026-09-08T11:05:00Z'},
    {type:'content_request',rating:null,reason:null,camp_name:null,template_name:null,query:'combo de hambúrguer para Story',comment:null,created_at:'2026-09-07T19:48:00Z'},
    {type:'campaign_feedback',rating:'negative',reason:'editing_difficulty',camp_name:'Dia dos Pais',template_name:'Vitrine de brinde · Feed',comment:'O nome do produto não caiu inteiro no campo e eu não sabia o que cortar.',created_at:'2026-09-07T16:20:00Z'},
    {type:'campaign_feedback',rating:'positive',reason:null,camp_name:'Frete Grátis',template_name:'Aviso simples · Story',comment:null,created_at:'2026-09-06T09:12:00Z'},
    {type:'campaign_feedback',rating:'negative',reason:'no_suitable_art',camp_name:'Segunda em Dobro',template_name:'Promo dupla · Feed',comment:'Nenhuma arte falava de bebida, e a minha promoção é de refrigerante.',created_at:'2026-09-05T20:41:00Z'},
    {type:'content_request',rating:null,reason:null,camp_name:null,template_name:null,query:'arte de açaí no pote',comment:null,created_at:'2026-09-05T13:02:00Z'},
    {type:'campaign_feedback',rating:'positive',reason:null,camp_name:'Combo Família',template_name:'Combo 3 itens · Feed',comment:'Baixei e postei em dois minutos.',created_at:'2026-09-04T18:27:00Z'}
  ];
  const DEMO_REQUESTS = [
    {query:'combo de hambúrguer para Story',request_count:18,last_requested_at:'2026-09-08T19:48:00Z'},
    {query:'arte de açaí no pote',request_count:12,last_requested_at:'2026-09-07T13:02:00Z'},
    {query:'promoção de bebida / refrigerante',request_count:9,last_requested_at:'2026-09-06T21:15:00Z'},
    {query:'cardápio completo em PDF',request_count:7,last_requested_at:'2026-09-05T10:30:00Z'},
    {query:'aviso de horário de feriado',request_count:5,last_requested_at:'2026-09-03T08:44:00Z'},
    {query:'arte para contratação de entregador',request_count:3,last_requested_at:'2026-09-01T17:09:00Z'}
  ];

  const ICO = {
    up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    down:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>',
    ask:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 10h8M8 14h5"/></svg>',
    spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>',
    quote:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 6h4.2v6.2H8.4c0 2.1.8 3.2 2.3 3.6V18c-2.9-.5-4.2-2.6-4.2-6.2V6Zm8.3 0H19v6.2h-2.3c0 2.1.8 3.2 2.3 3.6V18c-2.9-.5-4.2-2.6-4.2-6.2V6Z"/></svg>'
  };

  function gFeedbackAdminReasonLabel(key) {
    const reasons = typeof F_FEEDBACK_REASONS === 'object' ? F_FEEDBACK_REASONS : {};
    return reasons[key] || key || '—';
  }
  // Um só componente de ranking serve aos dois blocos (motivos e conteúdos pedidos):
  // criar o segundo desenho de barra é criar a segunda verdade sobre "o que lidera".
  function gFeedbackAdminRank(items, total, unit) {
    const top = Math.max.apply(null, items.map(function (i) { return i.count; }).concat([1]));
    return '<ol class="g-fb-rank">' + items.map(function (item, index) {
      const share = total ? Math.round(item.count / total * 100) : 0;
      /* A barra mede a FATIA DO TOTAL, não a fatia do líder. Medindo pelo líder, três motivos
         empatados em 1 viravam três barras 100% cheias — parecia barra de progresso quebrada. */
      const pct = total ? share : Math.round(item.count / top * 100);
      return '<li class="g-fb-rank-row" style="--fi:' + index + ';--pct:' + pct + '%">' +
        '<span class="g-fb-rank-n">' + (index + 1) + '</span>' +
        '<span class="g-fb-rank-body"><strong>' + gEsc(item.label) + '</strong>' +
        '<span class="g-fb-bar" aria-hidden="true"><i></i></span>' +
        (item.meta ? '<small>' + gEsc(item.meta) + '</small>' : '') + '</span>' +
        '<span class="g-fb-rank-count"><strong>' + item.count + '</strong><small>' +
        (unit || (item.count === 1 ? 'resposta' : 'respostas')) + (total ? ' · ' + share + '%' : '') + '</small></span></li>';
    }).join('') + '</ol>';
  }
  // O pulso: os números vêm SEMPRE das linhas que estão na tela — daí o rótulo dizer
  // "nesta página". Prometer "últimos 30 dias" com 20 linhas paginadas seria mentira.
  function gFeedbackAdminPulse(rows, demo) {
    const feedback = rows.filter(function (r) { return r.type !== 'content_request'; });
    const positive = feedback.filter(function (r) { return r.rating === 'positive'; }).length;
    const negative = feedback.filter(function (r) { return r.rating === 'negative'; }).length;
    const requests = rows.length - feedback.length;
    const rated = positive + negative;
    const share = rated ? Math.round(positive / rated * 100) : 0;
    const reasons = {};
    feedback.forEach(function (r) { if (r.reason) reasons[r.reason] = (reasons[r.reason] || 0) + 1; });
    const ranked = Object.keys(reasons).map(function (key) {
      return { label: gFeedbackAdminReasonLabel(key), count: reasons[key] };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 5);

    const card = function (icon, value, label, tone) {
      return '<div class="prof-stat-card g-fb-stat"><span class="prof-stat-icon' + (tone ? ' ' + tone : '') + '">' + icon + '</span>' +
        '<span class="prof-stat-info"><strong class="prof-stat-value">' + value + '</strong>' +
        '<small class="prof-stat-label">' + label + '</small></span></div>';
    };
    return (demo ? '<p class="g-fb-demo" role="status"><span class="g-fb-demo-tag">Dados de exemplo</span>' +
        'A rede ainda não respondeu (ou a consulta não voltou). A tela mostra este preenchimento para demonstração — nada aqui foi enviado por um franqueado.</p>' : '') +
      '<div class="prof-stats-grid g-fb-stats">' +
        card(ICO.up, rated ? share + '%' : '—', 'Disseram que ajudou', 'g-fb-icon-pos') +
        card(ICO.down, negative, negative === 1 ? 'Relato de dificuldade' : 'Relatos de dificuldade', 'g-fb-icon-neg') +
        card(ICO.ask, requests, requests === 1 ? 'Pedido de conteúdo' : 'Pedidos de conteúdo', 'prof-stat-icon-accent') +
      '</div>' +
      '<div class="g-fb-split">' +
        '<section class="prof-surface g-fb-panel" aria-label="Equilíbrio das avaliações">' +
          '<h5 class="g-fb-panel-title">Como a rede avaliou</h5>' +
          (rated ? '<div class="g-fb-mood" style="--pos:' + share + '%">' +
            '<div class="g-fb-mood-bar" role="img" aria-label="' + positive + ' de ' + rated + ' avaliações dizem que a arte ajudou"><i class="is-pos"></i><i class="is-neg"></i></div>' +
            '<ul class="g-fb-mood-legend">' +
            '<li class="is-pos"><i></i><span>Ajudou</span><strong>' + positive + '</strong><small>' + share + '%</small></li>' +
            '<li class="is-neg"><i></i><span>Não ajudou</span><strong>' + negative + '</strong><small>' + (100 - share) + '%</small></li>' +
            '</ul>' +
            '<p class="g-fb-mood-note">' + rated + (rated === 1 ? ' avaliação nesta página' : ' avaliações nesta página') +
            (requests ? ' · ' + requests + (requests === 1 ? ' pedido de conteúdo' : ' pedidos de conteúdo') : '') + '</p></div>'
            : '<p class="g-feedback-state">Nenhuma avaliação nesta página.</p>') +
        '</section>' +
        '<section class="prof-surface g-fb-panel" aria-label="Motivos mais citados">' +
          '<h5 class="g-fb-panel-title">Onde a rede trava</h5>' +
          (ranked.length ? gFeedbackAdminRank(ranked, negative, null)
            : '<p class="g-feedback-state">Ninguém apontou motivo nesta página.</p>') +
        '</section>' +
      '</div>';
  }
  let owner = '';
  let generation = 0;
  let authClient = null;
  let authSubscription = null;
  let filter = '';
  let sections = {};

  function gFeedbackAdminIdentity() {
    const user = typeof gCurrentUser === 'function' && gCurrentUser();
    return user && user.id && typeof gIsAdmin === 'function' && gIsAdmin() ? String(user.id) : '';
  }

  function gFeedbackAdminReset() {
    generation++;
    owner = '';
    filter = '';
    sections = {};
    const pane = document.getElementById('prof-pane-feedback');
    if (pane) pane.replaceChildren();
  }

  function gFeedbackAdminCurrent(ticket, userId) {
    if (!owner || owner !== gFeedbackAdminIdentity()) {
      gFeedbackAdminReset();
      return false;
    }
    return ticket === generation && owner === userId;
  }

  function gFeedbackAdminWatchAuth(client) {
    if (!client || client === authClient || !client.auth || !client.auth.onAuthStateChange) return;
    if (authSubscription) authSubscription.unsubscribe();
    authClient = client;
    const subscription = client.auth.onAuthStateChange(function (event, session) {
      // Descartar também o DOM: esconder a aba deixaria comentários da sessão anterior.
      if (event === 'SIGNED_OUT' || (owner && (!session || String(session.user.id) !== owner))) {
        gFeedbackAdminReset();
      }
    });
    authSubscription = subscription && subscription.data && subscription.data.subscription;
  }

  async function gFeedbackAdminOpen() {
    gFeedbackAdminReset();
    const pane = document.getElementById('prof-pane-feedback');
    if (!pane) return;
    owner = gFeedbackAdminIdentity();
    if (!owner) {
      pane.innerHTML = '<p class="g-feedback-state">Área exclusiva da equipe DM e da gestão.</p>';
      return;
    }
    const client = typeof gSupabase === 'function' && gSupabase();
    gFeedbackAdminWatchAuth(client);
    sections = {
      feedback: { offset: 0, request: 0, busy: false, more: false },
      requests: { offset: 0, request: 0, busy: false, more: false }
    };
    const chip = function (value, label) {
      return '<button type="button" class="g-fb-chip' + (filter === value ? ' is-on' : '') + '" data-fb-chip="' + value + '"' +
        ' aria-pressed="' + (filter === value ? 'true' : 'false') + '" onclick="gFeedbackAdminFilter(\'' + value + '\')">' + label + '</button>';
    };
    pane.innerHTML = '<div class="g-feedback-admin g-fb">' +
      '<div class="prof-section-head"><div><h4>O que a rede está dizendo</h4>' +
      '<p>Avaliações das artes e pedidos de conteúdo, do mais recente para o mais antigo.</p></div>' +
      '<button type="button" class="g-feedback-button g-fb-refresh" onclick="gFeedbackAdminOpen()">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>Atualizar</button></div>' +
      '<div id="g-fb-pulse" class="g-fb-pulse"></div>' +
      '<section class="g-feedback-section" aria-labelledby="g-feedback-list-title">' +
      '<div class="g-fb-sec-head"><h3 id="g-feedback-list-title">Respostas da rede</h3>' +
      '<div class="g-fb-chips" role="group" aria-label="Tipo de resposta">' +
      chip('', 'Todas') + chip('campaign_feedback', 'Avaliações') + chip('content_request', 'Pedidos de conteúdo') +
      '</div></div>' +
      '<div id="g-feedback-results" aria-live="polite"></div></section>' +
      '<section class="g-feedback-section" aria-labelledby="g-feedback-requests-title">' +
      '<div class="g-fb-sec-head"><h3 id="g-feedback-requests-title">Conteúdos mais pedidos</h3></div>' +
      '<p class="g-fb-sec-help">Pedidos com o mesmo texto são agrupados. A quantidade considera todos os pedidos recebidos para cada conteúdo.</p>' +
      '<div id="g-feedback-requests" aria-live="polite"></div></section></div>';
    await Promise.allSettled([gFeedbackAdminLoad('feedback'), gFeedbackAdminLoad('requests')]);
  }

  function gFeedbackAdminDate(value) {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  }

  /* Cartão, não linha de tabela. A resposta útil é uma FRASE do franqueado — numa célula de
     tabela ela chega truncada e sem hierarquia, competindo com data e id de material. Aqui a
     citação é o herói, a avaliação é um selo à esquerda e o resto é meta. */
  function gFeedbackAdminRows(rows) {
    return '<div class="g-fb-cards">' + rows.map(function (row, index) {
      const request = row.type === 'content_request';
      const tone = request ? 'is-ask' : row.rating === 'positive' ? 'is-pos' : 'is-neg';
      const selo = request ? { ico: ICO.ask, txt: 'Pedido' } :
        row.rating === 'positive' ? { ico: ICO.up, txt: 'Ajudou' } : { ico: ICO.down, txt: 'Não ajudou' };
      const titulo = request ? (row.query || '—') : (row.camp_name || 'Campanha não informada');
      const sub = request ? 'Pedido de conteúdo pela busca' : (row.template_name || 'Material não informado');
      const fala = row.comment || (request ? '' : '');
      return '<article class="g-fb-card ' + tone + '" style="--fi:' + index + '">' +
        '<span class="g-fb-seal" title="' + selo.txt + '">' + selo.ico + '<em>' + selo.txt + '</em></span>' +
        '<div class="g-fb-card-body"><strong class="g-fb-card-title">' + gEsc(titulo) + '</strong>' +
        '<span class="g-fb-card-sub">' + gEsc(sub) + '</span>' +
        (fala ? '<blockquote class="g-fb-quote">' + ICO.quote + '<span>' + gEsc(fala) + '</span></blockquote>' : '') +
        (row.reason ? '<span class="g-fb-tag">' + gEsc(gFeedbackAdminReasonLabel(row.reason)) + '</span>' : '') +
        '</div><time class="g-fb-card-when">' + gEsc(gFeedbackAdminDate(row.created_at)) + '</time></article>';
    }).join('') + '</div>';
  }

  function gFeedbackAdminRequestRows(rows) {
    const total = rows.reduce(function (sum, row) { return sum + (Number(row.request_count) || 0); }, 0);
    return gFeedbackAdminRank(rows.map(function (row) {
      return {
        label: row.query || row.query_normalized || '—',
        count: Number(row.request_count) || 0,
        meta: 'último em ' + gFeedbackAdminDate(row.last_requested_at)
      };
    }), total, 'pedidos');
  }

  function gFeedbackAdminPagination(kind, state) {
    // O total de linhas desta página não é uma métrica da rede.
    return '<nav class="g-feedback-pagination" aria-label="Páginas de ' + (kind === 'feedback' ? 'respostas' : 'conteúdos pedidos') + '">' +
      '<button type="button" class="g-feedback-button" onclick="gFeedbackAdminPage(\'' + kind + '\',-1)"' + (state.offset === 0 ? ' disabled' : '') + '>Anterior</button>' +
      '<span>Página ' + (Math.floor(state.offset / pageSize) + 1) + '</span>' +
      '<button type="button" class="g-feedback-button" onclick="gFeedbackAdminPage(\'' + kind + '\',1)"' + (!state.more ? ' disabled' : '') + '>Próxima</button></nav>';
  }

  /* Uma única saída para as duas fontes (banco e exemplo). O pulso só é reescrito pelo bloco
     de respostas: ele mede as avaliações, não os conteúdos pedidos. */
  function gFeedbackAdminPaint(kind, state, demo, rows) {
    const target = document.getElementById(kind === 'feedback' ? 'g-feedback-results' : 'g-feedback-requests');
    if (!target) return;
    let lista = rows;
    if (demo) {
      lista = kind === 'feedback'
        ? DEMO_FEEDBACK.filter(function (r) { return !filter || r.type === filter; })
        : DEMO_REQUESTS;
      state.more = false;
    }
    target.innerHTML = (lista.length ? (kind === 'feedback' ? gFeedbackAdminRows(lista) : gFeedbackAdminRequestRows(lista))
      : '<p class="g-feedback-state">' + (kind === 'feedback' ? 'Nenhuma resposta recebida para este filtro.' : 'Ainda não há pedidos de conteúdo.') + '</p>') +
      (demo ? '' : gFeedbackAdminPagination(kind, state));
    if (kind !== 'feedback') return;
    const pulse = document.getElementById('g-fb-pulse');
    if (pulse) pulse.innerHTML = gFeedbackAdminPulse(lista, demo);
  }

  async function gFeedbackAdminLoad(kind) {
    const ticket = generation;
    const userId = owner;
    if (!gFeedbackAdminCurrent(ticket, userId)) return;
    const state = sections[kind];
    const targetId = kind === 'feedback' ? 'g-feedback-results' : 'g-feedback-requests';
    const target = document.getElementById(targetId);
    if (!state || !target) return;
    const requestId = ++state.request;
    state.busy = true;
    target.setAttribute('aria-busy', 'true');
    target.innerHTML = '<div class="g-fb-skel" role="status" aria-label="Carregando respostas">' +
      '<span class="prof-team-loading-line"></span><span class="prof-team-loading-line"></span>' +
      '<span class="prof-team-loading-line"></span></div>';
    try {
      const client = typeof gSupabase === 'function' && gSupabase();
      if (!client) throw new Error('offline');
      let query;
      if (kind === 'feedback') {
        query = client.schema('luma').from('campaign_feedback')
          .select('id,camp_name,template_name,type,rating,reason,comment,query,created_at')
          .order('created_at', { ascending: false }).order('id', { ascending: false })
          .range(state.offset, state.offset + pageSize);
        if (filter) query = query.eq('type', filter);
      } else {
        query = client.schema('luma').rpc('content_requests', { p_limit: pageSize + 1, p_offset: state.offset });
      }
      const result = await query;
      if (!gFeedbackAdminCurrent(ticket, userId) || sections[kind] !== state || state.request !== requestId) return;
      if (result.error || !Array.isArray(result.data)) throw new Error('query');
      const rows = result.data.slice(0, pageSize);
      state.more = result.data.length > pageSize;
      state.busy = false;
      // Página seguinte vazia é fim de lista, não motivo para exemplo: quem paginou já viu dado real.
      if (!rows.length && !state.offset) gFeedbackAdminPaint(kind, state, true);
      else if (!rows.length) target.innerHTML = '<p class="g-feedback-state">Não há mais registros nesta página.</p>' + gFeedbackAdminPagination(kind, state);
      else gFeedbackAdminPaint(kind, state, false, rows);
    } catch (error) {
      if (!gFeedbackAdminCurrent(ticket, userId) || sections[kind] !== state || state.request !== requestId) return;
      state.busy = false;
      gFeedbackAdminPaint(kind, state, true);
    } finally {
      if (gFeedbackAdminCurrent(ticket, userId) && sections[kind] === state && state.request === requestId) target.setAttribute('aria-busy', 'false');
    }
  }

  function gFeedbackAdminFilter(value) {
    if (!['', 'campaign_feedback', 'content_request'].includes(value) || !sections.feedback) return;
    filter = value;
    sections.feedback.offset = 0;
    document.querySelectorAll('[data-fb-chip]').forEach(function (chip) {
      const on = chip.dataset.fbChip === value;
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    return gFeedbackAdminLoad('feedback');
  }

  function gFeedbackAdminPage(kind, direction) {
    const state = sections[kind];
    if (!state || state.busy || ![-1, 1].includes(direction) || (direction > 0 && !state.more)) return;
    state.offset = Math.max(0, state.offset + direction * pageSize);
    return gFeedbackAdminLoad(kind);
  }

  window.gFeedbackAdminOpen = gFeedbackAdminOpen;
  window.gFeedbackAdminReset = gFeedbackAdminReset;
  window.gFeedbackAdminFilter = gFeedbackAdminFilter;
  window.gFeedbackAdminPage = gFeedbackAdminPage;
  window.gFeedbackAdminRetry = gFeedbackAdminLoad;
})();
