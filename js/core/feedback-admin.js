/**
 * js/core/feedback-admin.js
 * Consulta da equipe no painel da conta, carregada sob demanda.
 * A RLS e a RPC autorizam os dados; gIsAdmin é apenas o gate da interface.
 * Depende de: core/auth.js, core/supabase.js, core/toast.js.
 */
(function () {
  const pageSize = 20;
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
    pane.innerHTML = '<div class="g-feedback-admin">' +
      '<section class="g-feedback-section" aria-labelledby="g-feedback-list-title">' +
      '<h3 id="g-feedback-list-title">Respostas da rede</h3>' +
      '<div class="g-feedback-toolbar"><label for="g-feedback-filter">Tipo de resposta</label>' +
      '<select class="g-feedback-filter" id="g-feedback-filter" onchange="gFeedbackAdminFilter(this.value)">' +
      '<option value="">Todas</option><option value="campaign_feedback">Avaliações</option>' +
      '<option value="content_request">Pedidos de conteúdo</option></select>' +
      '<button type="button" class="g-feedback-button" onclick="gFeedbackAdminOpen()">Atualizar</button></div>' +
      '<div id="g-feedback-results" aria-live="polite"></div></section>' +
      '<section class="g-feedback-section" aria-labelledby="g-feedback-requests-title">' +
      '<h3 id="g-feedback-requests-title">Conteúdos mais pedidos</h3>' +
      '<p>Pedidos com o mesmo texto são agrupados. A quantidade considera todos os pedidos recebidos para cada conteúdo.</p>' +
      '<div id="g-feedback-requests" aria-live="polite"></div></section></div>';
    await Promise.allSettled([gFeedbackAdminLoad('feedback'), gFeedbackAdminLoad('requests')]);
  }

  function gFeedbackAdminDate(value) {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  }

  function gFeedbackAdminRows(rows) {
    const reasons = typeof F_FEEDBACK_REASONS==='object'?F_FEEDBACK_REASONS:{};
    return '<div class="g-feedback-table-wrap" tabindex="0" role="region" aria-label="Respostas da rede">' +
      '<table class="g-feedback-table"><thead><tr><th scope="col">Campanha e material</th>' +
      '<th scope="col">Avaliação</th><th scope="col">Motivo</th><th scope="col">Comentário ou pedido</th>' +
      '<th scope="col">Recebido em</th></tr></thead><tbody>' + rows.map(function (row) {
        const request = row.type === 'content_request';
        const rating = row.rating === 'positive' ? 'Ajudou' : row.rating === 'negative' ? 'Não ajudou' : '—';
        return '<tr><td>' + gEsc(row.camp_name || '—') +
          '<small class="g-feedback-cell-detail">' + gEsc(row.template_name || (request ? 'Pedido de conteúdo' : 'Material não informado')) + '</small></td>' +
          '<td>' + gEsc(request ? 'Pedido de conteúdo' : rating) + '</td>' +
          '<td>' + gEsc(reasons[row.reason] || row.reason || '—') + '</td>' +
          '<td>' + (row.query ? '<strong>' + gEsc(row.query) + '</strong>' : '') +
          (row.comment ? '<span class="g-feedback-cell-detail">' + gEsc(row.comment) + '</span>' : row.query ? '' : '—') + '</td>' +
          '<td>' + gEsc(gFeedbackAdminDate(row.created_at)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function gFeedbackAdminRequestRows(rows) {
    return '<div class="g-feedback-table-wrap" tabindex="0" role="region" aria-label="Conteúdos mais pedidos">' +
      '<table class="g-feedback-table"><thead><tr><th scope="col">Conteúdo pedido</th>' +
      '<th scope="col">Pedidos recebidos</th><th scope="col">Último pedido</th></tr></thead><tbody>' + rows.map(function (row) {
        return '<tr><td>' + gEsc(row.query || row.query_normalized) + '</td>' +
          '<td>' + gEsc(row.request_count) + '</td><td>' + gEsc(gFeedbackAdminDate(row.last_requested_at)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function gFeedbackAdminPagination(kind, state) {
    // O total de linhas desta página não é uma métrica da rede.
    return '<nav class="g-feedback-pagination" aria-label="Páginas de ' + (kind === 'feedback' ? 'respostas' : 'conteúdos pedidos') + '">' +
      '<button type="button" class="g-feedback-button" onclick="gFeedbackAdminPage(\'' + kind + '\',-1)"' + (state.offset === 0 ? ' disabled' : '') + '>Anterior</button>' +
      '<span>Página ' + (Math.floor(state.offset / pageSize) + 1) + '</span>' +
      '<button type="button" class="g-feedback-button" onclick="gFeedbackAdminPage(\'' + kind + '\',1)"' + (!state.more ? ' disabled' : '') + '>Próxima</button></nav>';
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
    target.innerHTML = '<p class="g-feedback-state" role="status">Carregando…</p>';
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
      target.innerHTML = (rows.length ? (kind === 'feedback' ? gFeedbackAdminRows(rows) : gFeedbackAdminRequestRows(rows)) :
        '<p class="g-feedback-state">' + (state.offset ? 'Não há mais registros nesta página.' : kind === 'feedback' ? 'Nenhuma resposta recebida para este filtro.' : 'Ainda não há pedidos de conteúdo.') + '</p>') +
        gFeedbackAdminPagination(kind, state);
    } catch (error) {
      if (!gFeedbackAdminCurrent(ticket, userId) || sections[kind] !== state || state.request !== requestId) return;
      state.busy = false;
      target.innerHTML = '<div class="g-feedback-state"><p>Não foi possível carregar. Verifique sua conexão e tente novamente.</p>' +
        '<button type="button" class="g-feedback-button" onclick="gFeedbackAdminRetry(\'' + kind + '\')">Tentar novamente</button></div>';
    } finally {
      if (gFeedbackAdminCurrent(ticket, userId) && sections[kind] === state && state.request === requestId) target.setAttribute('aria-busy', 'false');
    }
  }

  function gFeedbackAdminFilter(value) {
    if (!['', 'campaign_feedback', 'content_request'].includes(value) || !sections.feedback) return;
    filter = value;
    sections.feedback.offset = 0;
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
