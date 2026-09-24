/**
 * js/core/dados.js
 *
 * Área "Dados" do painel da conta — o que a rede faz no Luma (product intelligence).
 * Só lê: as três RPCs do schema luma (dados_painel, dados_pessoa, dados_eventos) na
 * migration 20260923140000_luma_dados_painel.sql. Quem autoriza é a RLS + a checagem da
 * própria RPC; gIsAdmin() aqui é só o gate da interface (gestão e equipe DM).
 * Carrega SOB DEMANDA: nada é buscado até a aba abrir (gDadosAbrir, chamado por
 * gProfileSwitchTab('painel') em user-profile.js).
 * Gráficos em SVG/CSS puro — sem biblioteca (1ª lei).
 * Depende de: core/toast.js (gEsc, gToast), core/auth.js (gIsAdmin), core/supabase.js (gSupabase).
 */

// Estado único da área. Mutação direta + re-render manual (03_ENGINEERING §3).
let _gDados = {
  periodo: 30, cidade: '', aba: 'visao',
  data: null, erro: null, carregando: false, req: 0, intervalo: null,
  sort: { col: 'ultimo_acesso', dir: -1 }, busca: '', papel: '',
  pessoa: null, pessoaData: null, pessoaErro: null,
  ev: { evento: '', user: '', offset: 0, limit: 50, data: null, erro: null, carregando: false, req: 0 },
  ia: { data: null, erro: null, carregando: false, req: 0, modelos: null, calcModelo: '', calcN: null },
  lf: { data: null, erro: null, carregando: false, req: 0 }
};

const G_DADOS_ABAS = [
  ['visao', 'Visão geral'], ['pessoas', 'Pessoas'], ['funil', 'Funil'], ['conteudo', 'Conteúdo'],
  ['buscas', 'Buscas'], ['qualidade', 'Qualidade'], ['localfit', 'Local Fit'], ['ia', 'IA'], ['eventos', 'Eventos']
];
const G_DADOS_PERIODOS = [[1, 'Hoje'], [7, '7 dias'], [30, '30 dias'], [90, '90 dias']];
const G_DADOS_PAPEL = { gestao: 'Gestão', superadmin: 'Gestão', equipe_dm: 'Equipe DM', admin: 'Equipe DM', franqueado: 'Franqueado' };
const G_DADOS_DISP = { mobile: 'Celular', celular: 'Celular', tablet: 'Tablet', desktop: 'Computador' };
const G_DADOS_VAZIO = 'Ainda sem dados neste período — o rastreamento completo começou em 23/09/2026.';
const _G_DADOS_ICO = {
  csv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>'
};

/* ── formatação ─────────────────────────────────────────────────────────────────────── */
function _gDadosN(v) { return Number(v || 0).toLocaleString('pt-BR'); }
function _gDadosPct(v) { return v == null || isNaN(v) ? '—' : Math.round(v * 100) + '%'; }
function _gDadosDur(s) {
  if (s == null || isNaN(s)) return '—';
  s = Math.round(Number(s));
  if (s < 60) return s + ' s';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return h + ' h' + (r ? ' ' + r + ' min' : '');
}
function _gDadosDiasDesde(ts) {
  if (!ts) return Infinity;
  const t = new Date(ts).getTime();
  return isNaN(t) ? Infinity : (Date.now() - t) / 86400000;
}
function _gDadosRel(ts) {
  const d = _gDadosDiasDesde(ts);
  if (d === Infinity) return 'Nunca';
  const min = d * 1440;
  if (min < 60) return 'Agora há pouco';
  if (d < 1) return 'Há ' + Math.floor(min / 60) + ' h';
  if (d < 2) return 'Ontem';
  if (d < 30) return 'Há ' + Math.floor(d) + ' dias';
  if (d < 365) return 'Há ' + Math.floor(d / 30) + (Math.floor(d / 30) > 1 ? ' meses' : ' mês');
  return 'Há mais de um ano';
}
function _gDadosDataHora(ts, soHora) {
  if (!ts) return '—';
  const o = soHora ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
  try { return new Date(ts).toLocaleString('pt-BR', Object.assign({ timeZone: 'America/Sao_Paulo' }, o)); } catch (e) { return String(ts); }
}
function _gDadosDiaChave(ts) {
  try { return new Date(ts).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long' }); } catch (e) { return ''; }
}
function _gDadosDiaCurto(iso) { const p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : String(iso || ''); }
function _gDadosFmt(id) {
  const f = (typeof FMTS !== 'undefined' && Array.isArray(FMTS)) ? FMTS.find(x => x.id === id) : null;
  return f ? f.name : (id || '—');
}
function _gDadosPapel(r) { return G_DADOS_PAPEL[r] || r || '—'; }
function _gDadosStatus(ts) {
  const d = _gDadosDiasDesde(ts);
  return d <= 7 ? ['ok', 'Ativa na última semana'] : d <= 30 ? ['morno', 'Sem acesso há mais de 7 dias'] : ['frio', d === Infinity ? 'Nunca acessou' : 'Sem acesso há mais de 30 dias'];
}

/* Rótulo humano de cada evento. O nome cru só aparece quando o evento é desconhecido —
   é melhor o analista ver "xyz_novo" do que o evento sumir da linha do tempo. Devolve
   TEXTO: quem desenha escapa (gEsc) na hora de montar o HTML. */
function _gDadosRotulo(ev, p) {
  p = p || {};
  const aspas = v => v ? '“' + v + '”' : '';
  switch (ev) {
    case 'sessao_iniciada': return 'Entrou no Luma';
    case 'sessao_encerrada': return 'Saiu do Luma' + (p.dur_s ? ' após ' + _gDadosDur(p.dur_s) : '');
    case 'login_ok': return 'Fez login';
    case 'logout': return 'Saiu da conta';
    case 'pagina_aberta': return 'Abriu ' + (p.rota ? 'a página ' + aspas(p.rota) : 'uma página');
    case 'campanha_aberta': return 'Abriu a campanha ' + (aspas(p.camp_name) || '');
    case 'material_aberto': return 'Abriu o material ' + (aspas(p.template_name) || '') + (p.fmt_id ? ' (' + _gDadosFmt(p.fmt_id) + ')' : '');
    case 'pergunta_respondida': return (p.pulou ? 'Pulou o campo ' : 'Respondeu o campo ') + (aspas(p.campo) || '');
    case 'foto_enviada': return 'Enviou uma foto';
    case 'enquadramento_ajustado': return p.acao === 'cancelar' ? 'Cancelou o enquadramento da foto' : 'Ajustou o enquadramento da foto';
    case 'texto_nao_cabe': return 'Texto não coube em ' + (aspas(p.campo) || 'um campo') + (p.falta_n ? ' (' + p.falta_n + ' caracteres a mais)' : '');
    case 'copyfit_balao_exibido': return 'Viu a sugestão para o texto caber';
    case 'copyfit_aplicado': return 'Aplicou a sugestão para o texto caber' + (p.origem ? ' (' + p.origem + ')' : '');
    case 'copyfit_desfeito': return 'Desfez o ajuste do texto';
    case 'copyfit_ia': return 'Pediu à IA um texto que caiba';
    case 'arte_gerada': return 'Gerou arte de ' + (aspas(p.camp_name || p.template_name) || 'um material') + (p.fmt_id ? ' (' + _gDadosFmt(p.fmt_id) + ')' : '');
    case 'arte_baixada': return 'Baixou ' + String(p.tipo || 'png').toUpperCase();
    case 'arte_compartilhada': return 'Compartilhou a arte' + (p.canal ? ' no ' + p.canal : '');
    case 'lote_baixado': return 'Baixou um lote' + (p.n ? ' de ' + p.n + ' artes' : '');
    case 'kit_baixado': return 'Baixou o kit' + (p.n ? ' (' + p.n + ' artes)' : '');
    case 'erro_app': return 'Erro no app' + (p.msg ? ': ' + p.msg : '');
    case 'search_performed': return 'Buscou ' + (aspas(p.query) || 'no catálogo') + (p.result_count === 0 || p.result_count === '0' ? ' — sem resultado' : (p.result_count != null ? ' — ' + p.result_count + ' resultados' : ''));
    case 'search_no_results': return 'Busca sem resultado' + (p.query ? ': ' + aspas(p.query) : '');
    case 'search_result_opened': return 'Abriu um resultado da busca';
    case 'template_criado': return 'Criou um template';
    case 'template_salvo': return 'Salvou um template';
    case 'template_publicado': return 'Publicou um template';
    case 'template_despublicado': return 'Despublicou um template';
    case 'campaign_feedback_submitted': return 'Deu feedback sobre uma campanha';
    case 'content_requested': return 'Pediu um conteúdo' + (p.query ? ': ' + aspas(p.query) : '');
    case 'layout_resolvido': return 'O layout se ajustou sozinho';
    case 'jornada_aberta': return 'Abriu a jornada da Academia';
    case 'aula_aberta': return 'Abriu uma aula';
    case 'aula_concluida': return 'Concluiu uma aula';
    case 'ia_chamada': return (p.ok === false ? 'IA falhou em ' : 'Usou a IA: ') + _gDadosIaTask(p.task) + (p.ms ? ' (' + _gDadosMs(p.ms) + ')' : '');
    case 'legenda_gerada': return 'Recebeu sugestão de legenda' + (p.fonte === 'ia' ? ' da IA' : '');
    case 'legenda_copiada': return 'Copiou a legenda' + (p.origem && G_DADOS_IA_ORIGEM[p.origem] ? ' (' + G_DADOS_IA_ORIGEM[p.origem].toLowerCase() + ')' : '');
  }
  if (/^calendario_/.test(ev || '')) return 'Usou o calendário (' + String(ev).slice(11).replace(/_/g, ' ') + ')';
  return String(ev || '—');
}

/* ── dados ──────────────────────────────────────────────────────────────────────────── */
function _gDadosIntervalo() {
  const ate = new Date();
  let de;
  if (_gDados.periodo === 1) { de = new Date(); de.setHours(0, 0, 0, 0); }
  else de = new Date(ate.getTime() - _gDados.periodo * 86400000);
  return { de: de.toISOString(), ate: ate.toISOString() };
}
function _gDadosRpc(nome, args) {
  const sb = typeof gSupabase === 'function' ? gSupabase() : null;
  if (!sb) return Promise.resolve({ data: null, error: { message: 'Sem conexão com o servidor.' } });
  return sb.schema('luma').rpc(nome, args);
}
function _gDadosMsgErro(err) {
  const m = String((err && err.message) || err || '');
  if (/fetch|network|Failed/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return m || 'Erro desconhecido.';
}

// Entrada pública: gProfileSwitchTab('painel') chama. Só busca na primeira abertura.
function gDadosAbrir() {
  if (typeof gIsAdmin === 'function' && !gIsAdmin()) return;
  if (_gDados.data && !_gDados.erro) { _gDadosRender(); return; }
  gDadosCarregar();
}

async function gDadosCarregar() {
  const req = ++_gDados.req;
  _gDados.carregando = true; _gDados.erro = null;
  _gDados.intervalo = _gDadosIntervalo();
  _gDados.ev.data = null; _gDados.ev.offset = 0;
  _gDados.ia.data = null; _gDados.lf.data = null;
  _gDados.pessoaData = null;
  _gDadosRender();
  let res;
  try { res = await _gDadosRpc('dados_painel', { p_de: _gDados.intervalo.de, p_ate: _gDados.intervalo.ate }); }
  catch (e) { res = { error: e }; }
  if (req !== _gDados.req) return;           // o período mudou no meio: resposta velha
  _gDados.carregando = false;
  if (res.error || !res.data) { _gDados.erro = _gDadosMsgErro(res.error || 'A consulta voltou vazia.'); _gDados.data = null; }
  else _gDados.data = res.data;
  if (_gDados.pessoa) gDadosAbrirPessoa(_gDados.pessoa);
  // Via SetAba: re-renderiza E recarrega a aba sob demanda aberta (IA, Eventos, Local Fit),
  // cujo dado foi zerado acima — senão ela ficaria no esqueleto depois de trocar o período.
  if (_gDados.data && !_gDados.pessoa) gDadosSetAba(_gDados.aba); else _gDadosRender();
}

function gDadosSetPeriodo(n) {
  n = Number(n);
  if (_gDados.periodo === n && _gDados.data) return;
  _gDados.periodo = n;
  gDadosCarregar();
}
function gDadosSetCidade(v) { _gDados.cidade = String(v || ''); _gDadosRender(); }
function gDadosSetAba(aba, foco) {
  if (!G_DADOS_ABAS.some(a => a[0] === aba)) return;
  _gDados.aba = aba;
  if (aba !== 'pessoas') _gDados.pessoa = null;
  _gDadosRender();
  if (foco) document.getElementById('gd-tab-' + aba)?.focus();
  if (aba === 'eventos' && !_gDados.ev.data && !_gDados.ev.carregando && _gDados.data) gDadosEventosCarregar();
  if (aba === 'ia' && !_gDados.ia.data && !_gDados.ia.carregando && _gDados.data) gDadosIaCarregar();
  if (aba === 'localfit' && !_gDados.lf.data && !_gDados.lf.carregando && _gDados.data) gDadosLfCarregar();
}
// Setas/Home/End no tablist (padrão WAI-ARIA de abas, ativação automática).
function gDadosTabsKeydown(e) {
  const i = G_DADOS_ABAS.findIndex(a => a[0] === _gDados.aba);
  let n = -1;
  if (e.key === 'ArrowRight') n = (i + 1) % G_DADOS_ABAS.length;
  else if (e.key === 'ArrowLeft') n = (i - 1 + G_DADOS_ABAS.length) % G_DADOS_ABAS.length;
  else if (e.key === 'Home') n = 0;
  else if (e.key === 'End') n = G_DADOS_ABAS.length - 1;
  if (n < 0) return;
  e.preventDefault();
  gDadosSetAba(G_DADOS_ABAS[n][0], true);
}

// Pessoas filtradas pela cidade do topo. O filtro vale para o que é POR PESSOA; os
// agregados da rede (funil, conteúdo, buscas) não sabem de cidade e seguem inteiros.
function _gDadosPessoas() {
  const all = (_gDados.data && Array.isArray(_gDados.data.pessoas)) ? _gDados.data.pessoas : [];
  return _gDados.cidade ? all.filter(p => (p.cidade || '') === _gDados.cidade) : all;
}
function _gDadosVazio(d) {
  const k = (d && d.kpis) || {};
  return !k.sessoes && !k.artes_geradas && !k.downloads && !k.pessoas_ativas;
}

/* ── render: casca ──────────────────────────────────────────────────────────────────── */
function _gDadosRender() {
  const pane = document.getElementById('prof-pane-painel');
  if (!pane) return;
  const d = _gDados.data;
  const cidades = d && Array.isArray(d.pessoas)
    ? Array.from(new Set(d.pessoas.map(p => p.cidade).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    : [];
  if (_gDados.cidade && cidades.indexOf(_gDados.cidade) < 0) _gDados.cidade = '';
  const chips = G_DADOS_PERIODOS.map(([n, rot]) =>
    `<button type="button" class="gd-chip${_gDados.periodo === n ? ' is-on' : ''}" aria-pressed="${_gDados.periodo === n}" onclick="gDadosSetPeriodo(${n})">${rot}</button>`).join('');
  const tabs = G_DADOS_ABAS.map(([id, rot]) => {
    const on = _gDados.aba === id;
    return `<button type="button" role="tab" class="gd-tab${on ? ' is-on' : ''}" id="gd-tab-${id}" aria-selected="${on}" aria-controls="gd-panel" tabindex="${on ? 0 : -1}" onclick="gDadosSetAba('${id}')">${rot}</button>`;
  }).join('');
  const busy = _gDados.carregando;
  pane.setAttribute('aria-busy', busy ? 'true' : 'false');
  pane.innerHTML = `<div class="gd">
    <div class="gd-top">
      <div class="gd-chips" role="group" aria-label="Período">${chips}</div>
      <label class="gd-cidade"><span class="gd-sr">Cidade</span>
        <select class="gd-select" onchange="gDadosSetCidade(this.value)" ${cidades.length ? '' : 'disabled'} aria-label="Filtrar por cidade">
          <option value="">Todas as cidades</option>${cidades.map(c => `<option value="${gEsc(c)}"${c === _gDados.cidade ? ' selected' : ''}>${gEsc(c)}</option>`).join('')}
        </select></label>
      <button type="button" class="gd-btn" onclick="gDadosExportarCsv()" ${d ? '' : 'disabled'}>${_G_DADOS_ICO.csv}<span>Exportar CSV</span></button>
    </div>
    ${_gDados.cidade ? `<p class="gd-nota">Mostrando pessoas de <strong>${gEsc(_gDados.cidade)}</strong>. Funil, conteúdo e buscas seguem com a rede inteira.</p>` : ''}
    <div class="gd-tabs" role="tablist" aria-label="Seções dos dados" onkeydown="gDadosTabsKeydown(event)">${tabs}</div>
    <div class="gd-panel" id="gd-panel" role="tabpanel" aria-labelledby="gd-tab-${_gDados.aba}" tabindex="0">${_gDadosPainelHtml()}</div>
  </div>`;
}

function _gDadosSkeleton() {
  return `<div class="gd-skel" role="status" aria-live="polite"><div class="gd-kpis">${'<span class="gd-skel-box"></span>'.repeat(6)}</div>
    <span class="gd-skel-box gd-skel-chart"></span><span class="gd-sr">Carregando dados…</span></div>`;
}
function _gDadosErroHtml(msg, acao) {
  return `<div class="gd-estado gd-estado-erro" role="alert">${_G_DADOS_ICO.alerta}<strong>Não foi possível carregar os dados</strong>
    <p>${gEsc(msg)}</p><button type="button" class="gd-btn" onclick="${acao}">Tentar de novo</button></div>`;
}
function _gDadosVazioHtml(txt) { return `<div class="gd-estado"><p>${gEsc(txt || G_DADOS_VAZIO)}</p></div>`; }

function _gDadosPainelHtml() {
  if (_gDados.carregando) return _gDadosSkeleton();
  if (_gDados.erro) return _gDadosErroHtml(_gDados.erro, 'gDadosCarregar()');
  const d = _gDados.data;
  if (!d) return _gDadosSkeleton();
  switch (_gDados.aba) {
    case 'pessoas': return _gDados.pessoa ? _gDadosPessoaHtml() : _gDadosPessoasHtml();
    case 'funil': return _gDadosFunilHtml(d);
    case 'conteudo': return _gDadosConteudoHtml(d);
    case 'buscas': return _gDadosBuscasHtml(d);
    case 'qualidade': return _gDadosQualidadeHtml(d);
    case 'localfit': return _gDadosLfHtml();
    case 'ia': return _gDadosIaHtml();
    case 'eventos': return _gDadosEventosHtml();
    default: return _gDadosVisaoHtml(d);
  }
}

/* ── peças reutilizadas ─────────────────────────────────────────────────────────────── */
function _gDadosSecao(titulo, sub, corpo, extra) {
  return `<section class="gd-card${extra ? ' ' + extra : ''}"><header class="gd-card-head"><h4>${gEsc(titulo)}</h4>${sub ? `<p>${gEsc(sub)}</p>` : ''}</header>${corpo}</section>`;
}
// Tabela simples: cols = [{t:'Título', k:fn(row)->html já escapado, num:true}]
function _gDadosTabela(cols, rows, vazio) {
  if (!rows || !rows.length) return `<p class="gd-vazio">${gEsc(vazio || 'Nada neste período.')}</p>`;
  return `<div class="gd-scroll"><table class="gd-table"><thead><tr>${cols.map(c => `<th scope="col"${c.num ? ' class="is-num"' : ''}>${gEsc(c.t)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(c => `<td data-l="${gEsc(c.t)}"${c.num ? ' class="is-num"' : ''}>${c.k(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function _gDadosBarra(frac) {
  const p = Math.max(0, Math.min(100, Math.round((frac || 0) * 100)));
  return `<span class="gd-bar-h" aria-hidden="true"><i style="width:${p}%"></i></span>`;
}
function _gDadosVar(atual, ant) {
  if (ant == null) return '';
  atual = Number(atual || 0); ant = Number(ant || 0);
  if (!ant && !atual) return '<span class="gd-var">sem movimento antes</span>';
  if (!ant) return '<span class="gd-var is-up">novo no período</span>';
  const v = Math.round((atual - ant) / ant * 100);
  const cls = v > 0 ? 'is-up' : v < 0 ? 'is-down' : '';
  return `<span class="gd-var ${cls}">${v > 0 ? '+' : ''}${v}% vs. período anterior</span>`;
}
function _gDadosKpi(rot, valor, sub, variacao) {
  return `<div class="gd-kpi"><small>${gEsc(rot)}</small><strong>${valor}</strong>${sub ? `<span class="gd-kpi-sub">${sub}</span>` : ''}${variacao || ''}</div>`;
}

/* ── Visão geral ────────────────────────────────────────────────────────────────────── */
function _gDadosVisaoHtml(d) {
  if (_gDadosVazio(d)) return _gDadosVazioHtml();
  const k = d.kpis || {}, a = k.anterior || {}, t = k.downloads_tipo || {};
  let ativas = k.pessoas_ativas, total = k.pessoas_total, sessoes = k.sessoes, artes = k.artes_geradas, dls = k.downloads, semVar = false;
  if (_gDados.cidade) {   // recalcula o que é somável por pessoa; variação não existe por cidade
    const ps = _gDadosPessoas(); semVar = true;
    ativas = ps.filter(p => p.sessoes > 0).length; total = ps.filter(p => p.ativo).length;
    sessoes = ps.reduce((s, p) => s + (p.sessoes || 0), 0); artes = ps.reduce((s, p) => s + (p.artes || 0), 0);
    dls = ps.reduce((s, p) => s + (p.downloads || 0), 0);
  }
  const tipos = [['PNG', t.png], ['PDF', t.pdf], ['Lote', t.lote], ['Kit', t.kit], ['Compart.', t.compartilhada]]
    .filter(x => x[1]).map(x => x[0] + ' ' + _gDadosN(x[1])).join(' · ');
  const kpis = [
    _gDadosKpi('Pessoas ativas', `${_gDadosN(ativas)} <em>/ ${_gDadosN(total)}</em>`, '', semVar ? '' : _gDadosVar(ativas, a.pessoas_ativas)),
    _gDadosKpi('Sessões', _gDadosN(sessoes), _gDadosCidadeSub(semVar, 'Mediana de ' + _gDadosDur(k.dur_mediana_s) + ' por sessão'), semVar ? '' : _gDadosVar(sessoes, a.sessoes)),
    _gDadosKpi('Artes geradas', _gDadosN(artes), '', semVar ? '' : _gDadosVar(artes, a.artes_geradas)),
    _gDadosKpi('Downloads', _gDadosN(dls), _gDadosCidadeSub(semVar, tipos || 'Nenhum download'), semVar ? '' : _gDadosVar(dls, a.downloads)),
    _gDadosKpi('Gerou → baixou', _gDadosPct(k.taxa_download), _gDadosCidadeSub(semVar, 'Das artes geradas, quantas saíram do Luma')),
    _gDadosKpi('Até a 1ª arte', _gDadosDur(k.primeira_arte_mediana_s), _gDadosCidadeSub(semVar, 'Mediana do início da sessão à primeira arte'))
  ].join('');
  return `<div class="gd-kpis">${kpis}</div>
    ${_gDadosSecao('Pessoas ativas por dia', 'Passe o mouse ou o foco numa barra para ver o dia.', _gDadosGrafico(d.por_dia || []))}
    <div class="gd-duas">
      ${_gDadosSecao('Funil geral', 'Sessões que chegaram a cada etapa.', _gDadosFunilGeral((d.funil || {}).geral || []))}
      ${_gDadosSecao('Precisa de atenção', 'Tirado dos dados deste período.', _gDadosAtencao(d))}
    </div>`;
}
function _gDadosCidadeSub(semVar, txt) { return gEsc(semVar ? 'Rede inteira: ' + txt : txt); }

function _gDadosGrafico(dias) {
  if (!dias.length) return '<p class="gd-vazio">Sem dias no período.</p>';
  const max = Math.max(1, ...dias.map(x => x.pessoas || 0));
  const n = dias.length;
  const bars = dias.map((x, i) => {
    const h = Math.round((x.pessoas || 0) / max * 100);
    const lado = i < n * 0.2 ? ' is-esq' : i > n * 0.8 ? ' is-dir' : '';
    const txt = `${_gDadosDiaCurto(x.dia)}: ${x.pessoas || 0} pessoas, ${x.sessoes || 0} sessões, ${x.artes || 0} artes, ${x.downloads || 0} downloads`;
    return `<div class="gd-col${lado}" tabindex="0" aria-label="${gEsc(txt)}"><i style="height:${Math.max(h, x.pessoas ? 3 : 0)}%"></i>
      <span class="gd-tip" aria-hidden="true"><b>${gEsc(_gDadosDiaCurto(x.dia))}</b>${_gDadosN(x.pessoas)} pessoas<br>${_gDadosN(x.sessoes)} sessões · ${_gDadosN(x.artes)} artes<br>${_gDadosN(x.downloads)} downloads</span></div>`;
  }).join('');
  const meio = dias[Math.floor((n - 1) / 2)];
  return `<div class="gd-chart"><div class="gd-chart-y" aria-hidden="true"><span>${max}</span><span>0</span></div><div class="gd-chart-bars">${bars}</div></div>
    <div class="gd-chart-x" aria-hidden="true"><span>${gEsc(_gDadosDiaCurto(dias[0].dia))}</span>${n > 2 ? `<span>${gEsc(_gDadosDiaCurto(meio.dia))}</span>` : ''}${n > 1 ? `<span>${gEsc(_gDadosDiaCurto(dias[n - 1].dia))}</span>` : ''}</div>`;
}

function _gDadosFunilGeral(et) {
  if (!et.length || !et[0].n) return '<p class="gd-vazio">Ninguém abriu campanha no período.</p>';
  const topo = et[0].n || 1;
  let pior = null;
  for (let i = 1; i < et.length; i++) {
    const a = et[i - 1].n || 0, b = et[i].n || 0;
    if (!a) continue;
    const queda = (a - b) / a;
    if (!pior || queda > pior.q) pior = { q: queda, de: et[i - 1].rotulo, para: et[i].rotulo };
  }
  const linhas = et.map(e => `<li><span class="gd-funil-rot">${gEsc(e.rotulo || e.etapa)}</span>${_gDadosBarra((e.n || 0) / topo)}
    <span class="gd-funil-n">${_gDadosN(e.n)} <small>${Math.round((e.n || 0) / topo * 100)}%</small></span></li>`).join('');
  return `<ol class="gd-funil">${linhas}</ol>${pior && pior.q > 0 ? `<p class="gd-destaque">Maior queda: de <strong>${gEsc(pior.de)}</strong> para <strong>${gEsc(pior.para)}</strong> — ${Math.round(pior.q * 100)}% das sessões param aí.</p>` : ''}`;
}

// "Precisa de atenção" é DERIVADO aqui no front, dos mesmos dados que o painel já trouxe.
function _gDadosAtencao(d) {
  const itens = [];
  const sumidos = _gDadosPessoas().filter(p => p.ativo && _gDadosDiasDesde(p.ultimo_acesso) > 30);
  if (sumidos.length) {
    const nomes = sumidos.slice(0, 3).map(p => p.nome).join(', ') + (sumidos.length > 3 ? ' e mais ' + (sumidos.length - 3) : '');
    itens.push(['pessoas', `${sumidos.length} ${sumidos.length > 1 ? 'pessoas ativas estão' : 'pessoa ativa está'} sem acesso há mais de 30 dias`, nomes]);
  }
  const semRes = ((d.buscas || {}).sem_resultado || []);
  if (semRes.length) itens.push(['buscas', `${semRes.length} ${semRes.length > 1 ? 'buscas voltaram' : 'busca voltou'} sem resultado`, semRes.slice(0, 3).map(b => '“' + b.q + '”').join(', ')]);
  const nunca = ((d.conteudo || {}).nunca_usados || []);
  if (nunca.length) itens.push(['conteudo', `${nunca.length} ${nunca.length > 1 ? 'templates publicados nunca foram usados' : 'template publicado nunca foi usado'}`, '']);
  const porTpl = {};
  ((d.qualidade || {}).nao_cabe || []).forEach(q => { const k = q.template_name || q.template_id || 'Sem nome'; porTpl[k] = (porTpl[k] || 0) + (q.n || 0); });
  const piorTpl = Object.keys(porTpl).sort((a, b) => porTpl[b] - porTpl[a])[0];
  if (piorTpl) itens.push(['qualidade', `“${piorTpl}” é o template com mais texto que não cabe`, porTpl[piorTpl] + ' vezes no período']);
  const erros = ((d.qualidade || {}).erros || []).reduce((s, e) => s + (e.n || 0), 0);
  if (erros) itens.push(['qualidade', `${_gDadosN(erros)} ${erros > 1 ? 'erros' : 'erro'} do app no período`, '']);
  if (!itens.length) return '<p class="gd-vazio">Nada pedindo atenção agora.</p>';
  return `<ul class="gd-atencao">${itens.map(([aba, t, s]) => `<li><button type="button" onclick="gDadosSetAba('${aba}')"><span><strong>${gEsc(t)}</strong>${s ? `<small>${gEsc(s)}</small>` : ''}</span>${_G_DADOS_ICO.seta}</button></li>`).join('')}</ul>`;
}

/* ── Pessoas ────────────────────────────────────────────────────────────────────────── */
const G_DADOS_COLS_PESSOAS = [
  ['nome', 'Pessoa'], ['role', 'Papel'], ['cidade', 'Cidade / Franquia'], ['ultimo_acesso', 'Último acesso'],
  ['sessoes', 'Sessões', 1], ['tempo_s', 'Tempo', 1], ['artes', 'Artes', 1], ['downloads', 'Downloads', 1], ['disp', 'Aparelho']
];
function _gDadosPessoasHtml() {
  const papeis = Array.from(new Set(_gDadosPessoas().map(p => _gDadosPapel(p.role))));
  return `<div class="gd-filtros">
      <input type="search" class="gd-input" placeholder="Buscar por nome" aria-label="Buscar pessoa por nome" value="${gEsc(_gDados.busca)}" oninput="gDadosPessoasBusca(this.value)">
      <select class="gd-select" aria-label="Filtrar por papel" onchange="gDadosPessoasPapel(this.value)">
        <option value="">Todos os papéis</option>${papeis.map(p => `<option${p === _gDados.papel ? ' selected' : ''}>${gEsc(p)}</option>`).join('')}
      </select>
    </div><div id="gd-pessoas-tabela">${_gDadosPessoasTabela()}</div>`;
}
function _gDadosPessoasFiltradas() {
  const q = _gDadosNorm(_gDados.busca);
  const { col, dir } = _gDados.sort;
  return _gDadosPessoas()
    .filter(p => (!q || _gDadosNorm(p.nome + ' ' + (p.email || '')).includes(q)) && (!_gDados.papel || _gDadosPapel(p.role) === _gDados.papel))
    .slice().sort((a, b) => {
      let x = a[col], y = b[col];
      if (col === 'ultimo_acesso') { x = x ? new Date(x).getTime() : 0; y = y ? new Date(y).getTime() : 0; }
      if (typeof x === 'number' || typeof y === 'number') return ((x || 0) - (y || 0)) * dir;
      return String(x || '').localeCompare(String(y || ''), 'pt-BR') * dir;
    });
}
// gNormBusca vive em toast.js; a guarda evita quebrar se a ordem de carga mudar.
function _gDadosNorm(s) {
  return typeof gNormBusca === 'function' ? gNormBusca(s) : String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function _gDadosPessoasTabela() {
  const rows = _gDadosPessoasFiltradas();
  if (!rows.length) return `<p class="gd-vazio">${_gDadosPessoas().length ? 'Ninguém com esse filtro.' : 'Nenhuma pessoa cadastrada.'}</p>`;
  const { col, dir } = _gDados.sort;
  const th = G_DADOS_COLS_PESSOAS.map(([k, t, num]) => {
    const on = col === k;
    return `<th scope="col"${num ? ' class="is-num"' : ''} aria-sort="${on ? (dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="gd-sort${on ? ' is-on' : ''}" onclick="gDadosPessoasOrdenar('${k}')">${gEsc(t)}<span aria-hidden="true">${on ? (dir > 0 ? '↑' : '↓') : ''}</span></button></th>`;
  }).join('');
  const L = G_DADOS_COLS_PESSOAS.map(c => gEsc(c[1]));
  const tr = rows.map(p => {
    const [st, stTxt] = _gDadosStatus(p.ultimo_acesso);
    const local = [p.cidade, p.franquia].filter(Boolean).join(' · ') || '—';
    return `<tr${p.ativo === false ? ' class="is-inativo"' : ''}>
      <td><button type="button" class="gd-pessoa" data-id="${gEsc(p.user_id)}" onclick="gDadosAbrirPessoa(this.dataset.id)"><span class="gd-dot is-${st}" title="${gEsc(stTxt)}"></span><span><strong>${gEsc(p.nome || p.email || '—')}</strong>${p.ativo === false ? '<small>Inativa</small>' : ''}</span></button></td>
      <td data-l="${L[1]}">${gEsc(_gDadosPapel(p.role))}</td><td data-l="${L[2]}">${gEsc(local)}</td>
      <td data-l="${L[3]}" title="${gEsc(_gDadosDataHora(p.ultimo_acesso))}"><span class="gd-sr">${gEsc(stTxt)}. </span>${gEsc(_gDadosRel(p.ultimo_acesso))}</td>
      <td data-l="${L[4]}" class="is-num">${_gDadosN(p.sessoes)}</td><td data-l="${L[5]}" class="is-num">${gEsc(p.tempo_s ? _gDadosDur(p.tempo_s) : '—')}</td>
      <td data-l="${L[6]}" class="is-num">${_gDadosN(p.artes)}</td><td data-l="${L[7]}" class="is-num">${_gDadosN(p.downloads)}</td>
      <td data-l="${L[8]}">${gEsc(G_DADOS_DISP[p.disp] || p.disp || '—')}</td></tr>`;
  }).join('');
  return `<p class="gd-contagem" role="status">${rows.length} ${rows.length > 1 ? 'pessoas' : 'pessoa'}</p>
    <div class="gd-scroll"><table class="gd-table gd-table-pessoas"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}
function _gDadosPessoasRefresh() { const el = document.getElementById('gd-pessoas-tabela'); if (el) el.innerHTML = _gDadosPessoasTabela(); }
function gDadosPessoasBusca(v) { _gDados.busca = String(v || ''); _gDadosPessoasRefresh(); }
function gDadosPessoasPapel(v) { _gDados.papel = String(v || ''); _gDadosPessoasRefresh(); }
function gDadosPessoasOrdenar(col) {
  const s = _gDados.sort;
  if (s.col === col) s.dir = -s.dir;
  else { s.col = col; s.dir = ['nome', 'role', 'cidade', 'disp'].indexOf(col) >= 0 ? 1 : -1; }
  _gDadosPessoasRefresh();
  document.querySelector(`#gd-pessoas-tabela th[aria-sort]:not([aria-sort="none"]) .gd-sort`)?.focus();
}

async function gDadosAbrirPessoa(id) {
  if (!id) return;
  _gDados.pessoa = id; _gDados.pessoaData = null; _gDados.pessoaErro = null;
  _gDadosRender();
  const iv = _gDados.intervalo || _gDadosIntervalo();
  let res;
  try { res = await _gDadosRpc('dados_pessoa', { p_user: id, p_de: iv.de, p_ate: iv.ate }); } catch (e) { res = { error: e }; }
  if (_gDados.pessoa !== id) return;
  if (res.error || !res.data) _gDados.pessoaErro = _gDadosMsgErro(res.error || 'A consulta voltou vazia.');
  else _gDados.pessoaData = res.data;
  _gDadosRender();
  document.querySelector('.gd-voltar')?.focus();
}
function gDadosFecharPessoa() { _gDados.pessoa = null; _gDadosRender(); }

function _gDadosPessoaHtml() {
  const voltar = `<button type="button" class="gd-btn gd-voltar" onclick="gDadosFecharPessoa()">${_G_DADOS_ICO.voltar}<span>Todas as pessoas</span></button>`;
  if (_gDados.pessoaErro) return voltar + _gDadosErroHtml(_gDados.pessoaErro, `gDadosAbrirPessoa('${gEscJs(_gDados.pessoa)}')`);
  const r = _gDados.pessoaData;
  if (!r) return voltar + _gDadosSkeleton();
  const p = r.pessoa || {};
  const base = (_gDados.data && (_gDados.data.pessoas || []).find(x => x.user_id === _gDados.pessoa)) || {};
  const [st, stTxt] = _gDadosStatus(p.ultimo_acesso);
  const evs = Array.isArray(r.eventos) ? r.eventos : [];
  const grupos = [];
  evs.forEach(e => {
    const k = _gDadosDiaChave(e.ocorreu_em);
    if (!grupos.length || grupos[grupos.length - 1].k !== k) grupos.push({ k, itens: [] });
    grupos[grupos.length - 1].itens.push(e);
  });
  const linha = grupos.map(g => `<li class="gd-dia"><h5>${gEsc(g.k)}</h5><ol>${g.itens.map(e =>
    `<li class="gd-ev gd-ev-${gEsc(String(e.evento || '').split('_')[0])}"><time>${gEsc(_gDadosDataHora(e.ocorreu_em, true))}</time><span>${gEsc(_gDadosRotulo(e.evento, e.payload))}</span></li>`).join('')}</ol></li>`).join('');
  return `${voltar}
    <div class="gd-perfil">
      <span class="gd-dot is-${st}" title="${gEsc(stTxt)}"></span>
      <div><h4>${gEsc(p.nome || p.email || 'Pessoa')}</h4>
        <p>${gEsc([_gDadosPapel(p.role), p.cidade, p.franquia, p.email].filter(Boolean).join(' · '))}</p>
        <p>Último acesso: ${gEsc(_gDadosRel(p.ultimo_acesso))}${p.criado_em ? ' · Conta criada em ' + gEsc(new Date(p.criado_em).toLocaleDateString('pt-BR')) : ''}${p.ativo === false ? ' · <strong>Acesso desativado</strong>' : ''}</p></div>
    </div>
    <div class="gd-kpis gd-kpis-4">
      ${_gDadosKpi('Sessões', _gDadosN(base.sessoes))}${_gDadosKpi('Tempo ativo', gEsc(_gDadosDur(base.tempo_s)))}
      ${_gDadosKpi('Artes geradas', _gDadosN(base.artes))}${_gDadosKpi('Downloads', _gDadosN(base.downloads))}
    </div>
    ${_gDadosSecao('Linha do tempo', evs.length >= 500 ? 'Mostrando os 500 eventos mais recentes do período.' : evs.length + ' eventos no período.',
      evs.length ? `<ol class="gd-timeline">${linha}</ol>` : '<p class="gd-vazio">Nenhum evento desta pessoa no período.</p>')}`;
}

/* ── Funil ──────────────────────────────────────────────────────────────────────────── */
function _gDadosFunilHtml(d) {
  const f = d.funil || {};
  const pm = f.por_material || [];
  const pc = (n, base) => base ? `${_gDadosN(n)} <small>${Math.round(n / base * 100)}%</small>` : _gDadosN(n);
  const tab = _gDadosTabela([
    { t: 'Material', k: r => `<strong>${gEsc(r.template_name || 'Sem nome')}</strong>${r.camp_name ? `<small class="gd-sub">${gEsc(r.camp_name)}</small>` : ''}` },
    { t: 'Abriu', num: 1, k: r => _gDadosN(r.abriu) },
    { t: 'Respondeu', num: 1, k: r => pc(r.respondeu, r.abriu) },
    { t: 'Gerou', num: 1, k: r => pc(r.gerou, r.abriu) },
    { t: 'Baixou', num: 1, k: r => pc(r.baixou, r.abriu) },
    { t: 'Conversão', k: r => _gDadosBarra(r.abriu ? r.baixou / r.abriu : 0) }
  ], pm, 'Nenhum material aberto no período.');
  return _gDadosSecao('Funil geral', 'Sessões que chegaram a cada etapa.', _gDadosFunilGeral(f.geral || [])) +
    _gDadosSecao('Por material', 'Os 30 mais abertos. % sobre quem abriu.', tab);
}

/* ── Conteúdo ───────────────────────────────────────────────────────────────────────── */
function _gDadosConteudoHtml(d) {
  const c = d.conteudo || {};
  const tpl = _gDadosTabela([
    { t: 'Template', k: r => `<strong>${gEsc(r.nome || 'Sem nome')}</strong>${r.pasta ? `<small class="gd-sub">${gEsc(r.pasta)}</small>` : ''}${r.publicado ? '' : '<small class="gd-tag">Não publicado</small>'}` },
    { t: 'Abertos', num: 1, k: r => _gDadosN(r.abertos) }, { t: 'Gerados', num: 1, k: r => _gDadosN(r.gerados) }, { t: 'Baixados', num: 1, k: r => _gDadosN(r.baixados) }
  ], c.templates, 'Nenhum template publicado.');
  const nunca = (c.nunca_usados || []).length
    ? `<ul class="gd-lista">${c.nunca_usados.map(t => `<li><strong>${gEsc(t.nome || 'Sem nome')}</strong><small>${gEsc([t.pasta, t.publicado_em ? 'publicado em ' + new Date(t.publicado_em).toLocaleDateString('pt-BR') : ''].filter(Boolean).join(' · '))}</small></li>`).join('')}</ul>`
    : '<p class="gd-vazio">Todo template publicado já foi usado ao menos uma vez.</p>';
  const camp = _gDadosTabela([
    { t: 'Campanha', k: r => `<strong>${gEsc(r.camp_name || r.camp_id || '—')}</strong>` },
    { t: 'Aberturas', num: 1, k: r => _gDadosN(r.abertas) }, { t: 'Artes', num: 1, k: r => _gDadosN(r.geradas) },
    { t: 'Downloads', num: 1, k: r => _gDadosN(r.baixadas) }, { t: 'Pessoas', num: 1, k: r => _gDadosN(r.pessoas) }
  ], c.campanhas, 'Nenhuma campanha aberta no período.');
  const fmt = _gDadosTabela([
    { t: 'Formato', k: r => gEsc(_gDadosFmt(r.fmt_id)) }, { t: 'Artes', num: 1, k: r => _gDadosN(r.geradas) }, { t: 'Downloads', num: 1, k: r => _gDadosN(r.baixadas) }
  ], c.formatos, 'Nenhuma arte gerada no período.');
  return _gDadosSecao('Templates', 'Publicados ou usados no período.', tpl) +
    `<div class="gd-duas">${_gDadosSecao('Publicados e nunca usados', 'Desde sempre, não só neste período.', nunca)}${_gDadosSecao('Formatos', '', fmt)}</div>` +
    _gDadosSecao('Campanhas', '', camp);
}

/* ── Buscas ─────────────────────────────────────────────────────────────────────────── */
function _gDadosBuscasHtml(d) {
  const b = d.buscas || {};
  const top = _gDadosTabela([
    { t: 'Termo', k: r => `${gEsc(r.q || '—')}${r.sem_resultado ? ' <small class="gd-tag is-alerta">Sem resultado</small>' : ''}` },
    { t: 'Buscas', num: 1, k: r => _gDadosN(r.n) }
  ], b.top, 'Nenhuma busca no período.');
  const semRes = _gDadosTabela([
    { t: 'Termo', k: r => gEsc(r.q || '—') }, { t: 'Vezes', num: 1, k: r => _gDadosN(r.n) }, { t: 'Última', k: r => gEsc(_gDadosRel(r.ultima)) }
  ], b.sem_resultado, 'Toda busca achou alguma coisa.');
  const ped = _gDadosTabela([
    { t: 'Pedido', k: r => gEsc(r.q || '—') }, { t: 'Vezes', num: 1, k: r => _gDadosN(r.n) }, { t: 'Último', k: r => gEsc(_gDadosRel(r.ultima)) }
  ], b.pedidos, 'Ninguém pediu conteúdo no período.');
  return `<div class="gd-duas">${_gDadosSecao('Mais buscadas', '', top)}${_gDadosSecao('Sem resultado', 'Demanda que o catálogo ainda não atende.', semRes)}</div>` +
    _gDadosSecao('Pedidos de conteúdo', 'O que a rede pediu pelo botão de pedir conteúdo.', ped);
}

/* ── Qualidade ──────────────────────────────────────────────────────────────────────── */
/* ── Local Fit (aba própria) ────────────────────────────────────────────────────────── */
/* RPC luma.dados_localfit (migration 20260924100000), lendo `layout_resolvido` + a recuperação
   (texto_nao_cabe, copyfit_*, arte_baixada na mesma sessão). Carrega à parte e só quando a aba
   abre, como IA e Eventos. `export` = arte que saiu (a taxa que importa); `preview` conta cada
   estado novo da prévia — por isso as duas vêm separadas. É a bancada de melhoria do motor. */
const G_DADOS_LF_ST = { original: 'Coube como desenhado', wrapped: 'Quebrou linha', shrunk: 'Diminuiu a fonte', overflow: 'Não coube (bloqueou)', adapted: 'Ajustado (motor antigo)', unsafe: 'Não coube (motor antigo)' };
const G_DADOS_LF_FONTE = { ok: 'Fontes carregadas', parcial: 'Parte substituída', substituida: 'Fonte substituída', desconhecida: 'Sem medida' };
const G_DADOS_LF_ORIGEM = { export: 'Arte que saiu', preview: 'Prévia' };
function _gDadosLfChave(tipo, v) {
  if (v === 'sem contexto') return 'Sem contexto (antes de 23/09)';
  if (tipo === 'disp') return G_DADOS_DISP[v] || v;
  if (tipo === 'fonte') return G_DADOS_LF_FONTE[v] || v;
  if (tipo === 'formato') return _gDadosFmt(v);
  if (tipo === 'nav') return v ? v.charAt(0).toUpperCase() + v.slice(1) : '—';
  return v || '—';
}
function _gDadosLfTpl(x) {
  const id = x.material || '';
  const nome = x.nome || x.template || (/^demo-|^m-/.test(id) ? 'Demonstração (' + id + ')' : id ? 'Template ' + id.slice(0, 8) : '—');
  return `<strong>${gEsc(nome)}</strong>${x.pasta ? `<small class="gd-sub">${gEsc(x.pasta)}</small>` : ''}`;
}
function _gDadosLfCampo(c) {
  if (!c) return '<span class="gd-sub">Não informado</span>';
  const rot = typeof gFieldLabel === 'function' ? gFieldLabel(c) : c;
  return gEsc(rot) + (rot !== c ? `<small class="gd-sub"><code>${gEsc(c)}</code></small>` : '');
}
// Barra empilhada coube / ajustou / bloqueou (as três somam 100%).
function _gDadosLfPilha(o, a, b) {
  const t = (o || 0) + (a || 0) + (b || 0);
  if (!t) return '<span class="gd-sub">—</span>';
  const w = v => Math.round((v || 0) / t * 1000) / 10;
  return `<span class="gd-pilha" role="img" aria-label="${gEsc('Coube ' + _gDadosPct(o / t) + ', ajustou ' + _gDadosPct(a / t) + ', bloqueou ' + _gDadosPct(b / t))}">`
    + `<i class="is-ok" style="width:${w(o)}%"></i><i class="is-ajuste" style="width:${w(a)}%"></i><i class="is-bloqueio" style="width:${w(b)}%"></i></span>`;
}
const _G_DADOS_LF_LEGENDA = '<p class="gd-legenda" aria-hidden="true"><span><i class="is-ok"></i>Coube como desenhado</span><span><i class="is-ajuste"></i>Ajustou (quebrou linha ou diminuiu)</span><span><i class="is-bloqueio"></i>Não coube (bloqueou)</span></p>';
function _gDadosLfTaxa(num, den) { return den ? num / den : null; }
// Variação de TAXA em pontos percentuais (a _gDadosVar compara contagens).
function _gDadosLfVarPp(atual, ant, menorMelhor) {
  if (atual == null || ant == null) return '';
  const pp = Math.round((atual - ant) * 100);
  const bom = menorMelhor ? pp < 0 : pp > 0;
  return `<span class="gd-var ${pp === 0 ? '' : bom ? 'is-up' : 'is-down'}">${pp > 0 ? '+' : ''}${pp} p.p. vs. período anterior</span>`;
}
async function gDadosLfCarregar() {
  const s = _gDados.lf, req = ++s.req;
  s.carregando = true; s.erro = null;
  if (_gDados.aba === 'localfit') _gDadosRender();
  const iv = _gDados.intervalo || _gDadosIntervalo();
  let res;
  try { res = await _gDadosRpc('dados_localfit', { p_de: iv.de, p_ate: iv.ate }); } catch (err) { res = { error: err }; }
  if (req !== s.req) return;
  s.carregando = false;
  if (res.error || !res.data) s.erro = _gDadosMsgErro(res.error || 'A consulta voltou vazia.');
  else s.data = res.data;
  if (_gDados.aba === 'localfit') _gDadosRender();
}
// "O que olhar primeiro": achados calculados do próprio dado, do mais grave ao menos.
function _gDadosLfAchados(x) {
  const r = x.resumo || {}, it = [];
  if (r.export_bloqueou) it.push(`${_gDadosN(r.export_bloqueou)} ${r.export_bloqueou > 1 ? 'artes exportadas saíram' : 'arte exportada saiu'} com texto que não coube — o bloqueio deveria impedir isso.`);
  const pm = (x.por_material || []).filter(m => m.bloqueou)[0];
  if (pm) it.push(`“${pm.nome || pm.material}”${pm.pasta ? ' (' + pm.pasta + ')' : ''} é o template que mais bloqueia: ${_gDadosN(pm.bloqueou)} de ${_gDadosN(pm.n)} resoluções.`);
  const nc = (x.nao_coube || [])[0];
  if (nc && nc.campo) it.push(`O campo “${typeof gFieldLabel === 'function' ? gFieldLabel(nc.campo) : nc.campo}” é o que mais estoura${nc.limite_p50 != null ? ' (limite seguro mediano: ' + nc.limite_p50 + ' caracteres)' : ''}.`);
  const fm = (x.por_formato || []).filter(f => f.n >= 5).sort((a, b) => b.bloqueou / b.n - a.bloqueou / a.n)[0];
  if (fm && fm.bloqueou) it.push(`O formato ${_gDadosFmt(fm.chave)} bloqueia em ${_gDadosPct(fm.bloqueou / fm.n)} das resoluções.`);
  const vs = (x.por_versao || []).filter(v => v.ordem != null && v.n >= 5);
  if (vs.length > 1 && vs[0].bloqueou / vs[0].n > vs[1].bloqueou / vs[1].n + 0.05) it.push(`A versão ${vs[0].chave} bloqueia mais que a ${vs[1].chave} (${_gDadosPct(vs[0].bloqueou / vs[0].n)} contra ${_gDadosPct(vs[1].bloqueou / vs[1].n)}) — possível regressão.`);
  if (r.ms_p95 != null && r.ms_p95 > 50) it.push(`O p95 do tempo está em ${_gDadosMs(r.ms_p95)} — acima de 50 ms a digitação na prévia começa a pesar em celular fraco.`);
  const fn = _gDadosLfTaxa(r.fonte_nao_ok, r.fonte_conhecida);
  if (fn != null && fn > 0.1) it.push(`${_gDadosPct(fn)} das resoluções rodaram com fonte substituída — a medida pode divergir entre aparelhos.`);
  const rc = x.recuperacao || {};
  if (rc.sessoes_bloqueadas >= 5 && rc.sessoes_baixaram / rc.sessoes_bloqueadas < 0.5) it.push(`Só ${_gDadosPct(rc.sessoes_baixaram / rc.sessoes_bloqueadas)} das visitas que bateram em bloqueio terminaram em download.`);
  if (!it.length) return '<p class="gd-vazio">Nada fora do normal neste período.</p>';
  return `<ul class="gd-lista gd-achados">${it.slice(0, 6).map(t => `<li><span>${gEsc(t)}</span></li>`).join('')}</ul>`;
}
function _gDadosLfDias(dias) {
  if (!dias.length) return '<p class="gd-vazio">Sem dias no período.</p>';
  const max = Math.max(1, ...dias.map(x => x.n || 0)), n = dias.length;
  const bars = dias.map((x, i) => {
    const h = v => (v || 0) / max * 100;
    const lado = i < n * 0.2 ? ' is-esq' : i > n * 0.8 ? ' is-dir' : '';
    const txt = `${_gDadosDiaCurto(x.dia)}: ${x.n} resoluções, ${x.original} couberam, ${x.ajustou} ajustaram, ${x.bloqueou} bloquearam; ${x.export_n} exportadas`;
    return `<div class="gd-col gd-col-pilha${lado}" tabindex="0" aria-label="${gEsc(txt)}">`
      + `<i class="is-ok" style="height:${h(x.original)}%"></i><i class="is-ajuste" style="height:${h(x.ajustou)}%"></i><i class="is-bloqueio" style="height:${h(x.bloqueou)}%"></i>`
      + `<span class="gd-tip" aria-hidden="true"><b>${gEsc(_gDadosDiaCurto(x.dia))}</b>${_gDadosN(x.n)} resoluções<br>${_gDadosN(x.original)} couberam · ${_gDadosN(x.ajustou)} ajustaram<br>${_gDadosN(x.bloqueou)} bloquearam · ${_gDadosN(x.export_n)} exportadas</span></div>`;
  }).join('');
  const meio = dias[Math.floor((n - 1) / 2)];
  return `<div class="gd-chart"><div class="gd-chart-y" aria-hidden="true"><span>${max}</span><span>0</span></div><div class="gd-chart-bars">${bars}</div></div>
    <div class="gd-chart-x" aria-hidden="true"><span>${gEsc(_gDadosDiaCurto(dias[0].dia))}</span>${n > 2 ? `<span>${gEsc(_gDadosDiaCurto(meio.dia))}</span>` : ''}${n > 1 ? `<span>${gEsc(_gDadosDiaCurto(dias[n - 1].dia))}</span>` : ''}</div>${_G_DADOS_LF_LEGENDA}`;
}
// Tabela de recorte (formato, aparelho, navegador, fonte): mesmas colunas para comparar.
function _gDadosLfRecorte(tipo, rows) {
  return _gDadosTabela([
    { t: 'Recorte', k: y => gEsc(_gDadosLfChave(tipo, y.chave)) },
    { t: 'Resoluções', num: 1, k: y => _gDadosN(y.n) },
    { t: 'Resultado', k: y => _gDadosLfPilha(y.original, y.ajustou, y.bloqueou) },
    { t: 'Bloqueou', num: 1, k: y => _gDadosPct(_gDadosLfTaxa(y.bloqueou, y.n)) },
    { t: 'Mediana', num: 1, k: y => gEsc(_gDadosMs(y.ms_p50)) },
    { t: 'p95', num: 1, k: y => gEsc(_gDadosMs(y.ms_p95)) }
  ], rows, 'Nada no período.');
}
function _gDadosLfFaixas(rows) {
  const tot = (rows || []).reduce((a, y) => a + (y.n || 0), 0);
  if (!tot) return '<p class="gd-vazio">Nada no período.</p>';
  return `<ul class="gd-lista">${rows.map(y => `<li><strong>${gEsc(y.faixa)}</strong><span class="gd-faixa">${_gDadosBarra(y.n / tot)}<small>${_gDadosN(y.n)} · ${_gDadosPct(y.n / tot)}</small></span></li>`).join('')}</ul>`;
}
function _gDadosLfRecuperacao(rc) {
  const passos = [
    ['Aviso de texto que não cabe', rc.nao_cabe, ''],
    ['… com versão curta pronta', rc.nao_cabe_com_versao, 'Sugestão de copy disponível na hora'],
    ['Balão de sugestão exibido', rc.balao_exibido, ''],
    ['Sugestão aplicada', rc.aplicado, `Balão ${_gDadosN(rc.aplicado_balao)} · chat ${_gDadosN(rc.aplicado_chat)} · IA ${_gDadosN(rc.aplicado_ia)}`],
    ['Ajuste desfeito', rc.desfeito, 'Aplicou e voltou atrás'],
    ['Pediu à IA um texto que caiba', rc.ia_pedidos, _gDadosN(rc.ia_com_opcao) + ' com opção aprovada']
  ];
  const lista = `<ul class="gd-lista">${passos.map(([t, n, sub]) => `<li><span><strong>${gEsc(t)}</strong>${sub ? `<small class="gd-sub">${gEsc(sub)}</small>` : ''}</span><small>${_gDadosN(n)}</small></li>`).join('')}</ul>`;
  const taxa = _gDadosLfTaxa(rc.sessoes_baixaram, rc.sessoes_bloqueadas);
  return `<div class="gd-kpis gd-kpis-2">${_gDadosKpi('Visitas que bateram em bloqueio', _gDadosN(rc.sessoes_bloqueadas), 'Com contexto de sessão (desde 23/09)')}`
    + `${_gDadosKpi('… e ainda baixaram a arte', _gDadosPct(taxa), gEsc(_gDadosN(rc.sessoes_baixaram) + ' visitas'))}</div>${lista}`;
}
function _gDadosLfHtml() {
  const s = _gDados.lf, x = s.data;
  if (s.erro) return _gDadosErroHtml(s.erro, 'gDadosLfCarregar()');
  if (s.carregando || !x) return _gDadosSkeleton();
  const r = x.resumo || {}, an = x.anterior || {}, st = x.por_status || [];
  if (!r.total) return _gDadosVazioHtml('Nenhuma arte montada neste período — o Local Fit registra cada resolução desde 15/08/2026.');
  const linhas = o => {
    const l = st.filter(y => y.origem === o), tot = l.reduce((a, y) => a + (y.n || 0), 0);
    return _gDadosTabela([
      { t: 'Resultado', k: y => gEsc(G_DADOS_LF_ST[y.status] || y.status) },
      { t: 'Vezes', num: 1, k: y => _gDadosN(y.n) },
      { t: 'Parcela', k: y => _gDadosBarra(tot ? y.n / tot : 0) + ' ' + _gDadosPct(tot ? y.n / tot : null) }
    ], l, 'Nada no período.');
  };
  const okExp = _gDadosLfTaxa(r.export_total - r.export_bloqueou, r.export_total), okAnt = _gDadosLfTaxa(an.export_total - an.export_bloqueou, an.export_total);
  const origExp = _gDadosLfTaxa(r.export_original, r.export_total), origAnt = _gDadosLfTaxa(an.export_original, an.export_total);
  const bloq = (r.export_bloqueou || 0) + (r.preview_bloqueou || 0);
  const mats = _gDadosTabela([
    { t: 'Template', k: _gDadosLfTpl },
    { t: 'Resoluções', num: 1, k: y => _gDadosN(y.n) + `<small class="gd-sub">${_gDadosN(y.export_n)} exportadas</small>` },
    { t: 'Resultado', k: y => _gDadosLfPilha(y.original, y.ajustou, y.bloqueou) },
    { t: 'Bloqueou', num: 1, k: y => _gDadosN(y.bloqueou) + `<small class="gd-sub">${_gDadosPct(_gDadosLfTaxa(y.bloqueou, y.n))}</small>` },
    { t: 'Quebrou / diminuiu', num: 1, k: y => _gDadosN(y.wrapped) + ' / ' + _gDadosN(y.shrunk) },
    { t: 'Camadas mexidas', num: 1, k: y => y.alt_media == null ? '—' : gEsc(String(y.alt_media).replace('.', ',')) },
    { t: 'Mediana', num: 1, k: y => gEsc(_gDadosMs(y.ms_p50)) },
    { t: 'Pessoas', num: 1, k: y => _gDadosN(y.pessoas) },
    { t: 'Último', k: y => gEsc(_gDadosRel(y.ultimo)) }
  ], x.por_material, 'Nenhum template no período.');
  const nc = _gDadosTabela([
    { t: 'Template', k: _gDadosLfTpl },
    { t: 'Campo', k: y => _gDadosLfCampo(y.campo) },
    { t: 'Vezes', num: 1, k: y => _gDadosN(y.n) + (y.export_n ? `<small class="gd-sub">${_gDadosN(y.export_n)} no export</small>` : '') },
    { t: 'Limite seguro', num: 1, k: y => y.limite_p50 == null ? '—' : gEsc(y.limite_p50 + ' caract.') },
    { t: 'Formatos', k: y => gEsc(String(y.formatos || '—').split(', ').map(_gDadosFmt).join(', ')) },
    { t: 'Pessoas', num: 1, k: y => _gDadosN(y.pessoas) },
    { t: 'Último', k: y => gEsc(_gDadosRel(y.ultimo)) }
  ], x.nao_coube, 'Nenhum texto deixou de caber no período.');
  const versoes = _gDadosTabela([
    { t: 'Versão', k: y => y.ordem != null ? `<strong>v${gEsc(y.chave)}</strong>` : gEsc(_gDadosLfChave('', y.chave)) },
    { t: 'No ar', k: y => gEsc(_gDadosDataHora(y.primeiro)) + `<small class="gd-sub">até ${gEsc(_gDadosDataHora(y.ultimo))}</small>` },
    { t: 'Resoluções', num: 1, k: y => _gDadosN(y.n) },
    { t: 'Resultado', k: y => _gDadosLfPilha(y.original, y.ajustou, y.bloqueou) },
    { t: 'Bloqueou', num: 1, k: y => _gDadosPct(_gDadosLfTaxa(y.bloqueou, y.n)) },
    { t: 'Mediana', num: 1, k: y => gEsc(_gDadosMs(y.ms_p50)) },
    { t: 'p95', num: 1, k: y => gEsc(_gDadosMs(y.ms_p95)) }
  ], x.por_versao, 'Sem versão registrada no período.');
  const pessoas = _gDadosTabela([
    { t: 'Pessoa', k: y => `<strong>${gEsc(y.nome || '—')}</strong>${y.cidade ? `<small class="gd-sub">${gEsc(y.cidade)}</small>` : ''}` },
    { t: 'Resoluções', num: 1, k: y => _gDadosN(y.n) },
    { t: 'Ajustou', num: 1, k: y => _gDadosN(y.ajustou) },
    { t: 'Bloqueou', num: 1, k: y => _gDadosN(y.bloqueou) },
    { t: 'Último', k: y => gEsc(_gDadosRel(y.ultimo)) }
  ], x.por_pessoa, 'Ninguém no período.');
  const recentes = _gDadosTabela([
    { t: 'Quando', k: y => gEsc(_gDadosDataHora(y.ocorreu_em)) },
    { t: 'Pessoa', k: y => gEsc(y.nome || '—') + (y.cidade ? `<small class="gd-sub">${gEsc(y.cidade)}</small>` : '') },
    { t: 'Template', k: _gDadosLfTpl },
    { t: 'Campo', k: y => _gDadosLfCampo(y.campo) },
    { t: 'Formato', k: y => gEsc(_gDadosFmt(y.formato)) + `<small class="gd-sub">${gEsc(G_DADOS_LF_ORIGEM[y.origem] || y.origem)}</small>` },
    { t: 'Aparelho', k: y => gEsc(_gDadosLfChave('disp', y.disp)) + (y.nav !== 'sem contexto' ? `<small class="gd-sub">${gEsc(_gDadosLfChave('nav', y.nav))}</small>` : '') },
    { t: 'Fonte', k: y => gEsc(_gDadosLfChave('fonte', y.fonte)) },
    { t: 'Limite', num: 1, k: y => y.limite == null ? '—' : gEsc(String(y.limite)) },
    { t: 'Versão', k: y => y.versao ? 'v' + gEsc(y.versao) : '—' }
  ], x.recentes, 'Nenhum bloqueio no período.');
  return `<div class="gd-kpis">
      ${_gDadosKpi('Artes que saíram e couberam', _gDadosPct(okExp), gEsc(_gDadosN(r.export_total - r.export_bloqueou) + ' de ' + _gDadosN(r.export_total) + ' exportadas'), _gDadosLfVarPp(okExp, okAnt))}
      ${_gDadosKpi('Couberam sem o motor mexer', _gDadosPct(origExp), gEsc(_gDadosN(r.export_original) + ' como desenhado · ' + _gDadosN(r.export_ajustou) + ' ajustadas'), _gDadosLfVarPp(origExp, origAnt))}
      ${_gDadosKpi('Bloqueios', _gDadosN(bloq), gEsc(_gDadosN(r.preview_bloqueou) + ' na prévia · ' + _gDadosN(r.export_bloqueou) + ' no export · ' + _gDadosN(r.caixas_estouradas) + ' caixas estouraram'))}
      ${_gDadosKpi('Tempo do Local Fit', gEsc(_gDadosMs(r.ms_p50)), gEsc('Mediana · p95 ' + _gDadosMs(r.ms_p95) + ' · pior ' + _gDadosMs(r.ms_max)))}
      ${_gDadosKpi('Templates com bloqueio', _gDadosN(r.materiais_bloqueados), gEsc('de ' + _gDadosN(r.materiais) + ' usados · ' + _gDadosN(r.pessoas_bloqueadas) + ' de ' + _gDadosN(r.pessoas) + ' pessoas afetadas'))}
      ${_gDadosKpi('Fonte substituída', _gDadosPct(_gDadosLfTaxa(r.fonte_nao_ok, r.fonte_conhecida)), gEsc(_gDadosN(r.fonte_nao_ok) + ' de ' + _gDadosN(r.fonte_conhecida) + ' resoluções medidas'))}
    </div>
    ${_gDadosSecao('O que olhar primeiro', 'Achados calculados a partir dos números abaixo.', _gDadosLfAchados(x))}
    ${_gDadosSecao('Resultado por dia', 'Toda resolução (prévia e export). A altura é o volume do dia.', _gDadosLfDias(x.por_dia || []))}
    <div class="gd-duas">
      ${_gDadosSecao('Na arte que saiu', 'Export: o que o franqueado baixou.', linhas('export'))}
      ${_gDadosSecao('Na prévia', 'Cada estado novo da prévia conta uma vez.', linhas('preview'))}
    </div>
    ${_gDadosSecao('Por template', 'Ordenado por quem mais bloqueia, depois por quem mais precisa de ajuste. É a fila de templates para revisar no Estúdio.', mats)}
    ${_gDadosSecao('Onde o texto não coube', 'Template e campo do diagnóstico do bloqueio. O limite seguro é quantos caracteres cabem na caixa.', nc)}
    <div class="gd-duas">
      ${_gDadosSecao('Por formato', '', _gDadosLfRecorte('formato', x.por_formato))}
      ${_gDadosSecao('Por fonte', 'Fonte substituída muda a medida do texto.', _gDadosLfRecorte('fonte', x.por_fonte))}
      ${_gDadosSecao('Por aparelho', '', _gDadosLfRecorte('disp', x.por_dispositivo))}
      ${_gDadosSecao('Por navegador', '', _gDadosLfRecorte('nav', x.por_navegador))}
    </div>
    ${_gDadosSecao('Por versão do app', 'Compare versões seguidas para achar regressão depois de um deploy.', versoes)}
    <div class="gd-duas">
      ${_gDadosSecao('Tempo por resolução', 'Quanto o motor leva para decidir a arte.', _gDadosLfFaixas(x.tempo_faixas))}
      ${_gDadosSecao('Camadas mexidas por resolução', 'Quantas caixas de texto o motor precisou tocar.', _gDadosLfFaixas(x.camadas_faixas))}
    </div>
    <div class="gd-duas">
      ${_gDadosSecao('Depois do bloqueio', 'O franqueado conseguiu sair do bloqueio?', _gDadosLfRecuperacao(x.recuperacao || {}))}
      ${_gDadosSecao('Quem mais esbarra no bloqueio', '', pessoas)}
    </div>
    ${_gDadosSecao('Bloqueios recentes', 'Os 25 últimos, com o necessário para reproduzir o caso.', recentes)}`;
}
function _gDadosQualidadeHtml(d) {
  const q = d.qualidade || {}, cf = q.copyfit || {}, en = q.enquadramento || {}, fb = d.feedback || {};
  const naoCabe = _gDadosTabela([
    { t: 'Template', k: r => `<strong>${gEsc(r.template_name || r.template_id || 'Sem nome')}</strong>` },
    { t: 'Campo', k: r => gEsc(r.campo || '—') }, { t: 'Vezes', num: 1, k: r => _gDadosN(r.n) },
    { t: 'Com versão curta', num: 1, k: r => _gDadosN(r.com_versao) }
  ], q.nao_cabe, 'Nenhum texto ficou grande demais no período.');
  const erros = _gDadosTabela([
    { t: 'Mensagem', k: r => `<code>${gEsc(r.msg || '—')}</code>` }, { t: 'Vezes', num: 1, k: r => _gDadosN(r.n) },
    { t: 'Pessoas', num: 1, k: r => _gDadosN(r.pessoas) }, { t: 'Último', k: r => gEsc(_gDadosDataHora(r.ultimo)) }
  ], q.erros, 'Nenhum erro registrado no período.');
  const motivos = (fb.motivos || []).length
    ? `<ul class="gd-lista">${fb.motivos.map(m => `<li><strong>${gEsc((typeof F_FEEDBACK_REASONS === 'object' && F_FEEDBACK_REASONS[m.reason]) || m.reason || 'Sem motivo')}</strong><small>${_gDadosN(m.n)}</small></li>`).join('')}</ul>` : '';
  const recentes = (fb.recentes || []).filter(r => r.comment);
  const coment = recentes.length
    ? `<ul class="gd-comentarios">${recentes.map(r => `<li><p>${gEsc(r.comment)}</p><small>${gEsc([r.nome, r.camp_name, r.rating === 'positive' ? 'Gostou' : r.rating === 'negative' ? 'Não gostou' : '', _gDadosRel(r.created_at)].filter(Boolean).join(' · '))}</small></li>`).join('')}</ul>`
    : '<p class="gd-vazio">Nenhum comentário escrito no período.</p>';
  return `<div class="gd-kpis gd-kpis-4">
      ${_gDadosKpi('Sugestão de texto exibida', _gDadosN(cf.exibido), gEsc('Aplicada ' + _gDadosN(cf.aplicado) + ' · desfeita ' + _gDadosN(cf.desfeito)))}
      ${_gDadosKpi('Texto pela IA', _gDadosN(cf.ia), 'Pedidos de versão que caiba')}
      ${_gDadosKpi('Enquadramento', _gDadosN(en.aplicar), gEsc('Aplicou · cancelou ' + _gDadosN(en.cancelar)))}
      ${_gDadosKpi('Fotos enviadas', _gDadosN(q.fotos))}
    </div>
    ${_gDadosSecao('Textos que não cabem', 'Por template e campo.', naoCabe)}
    ${_gDadosSecao('Erros do app', '', erros)}
    <div class="gd-duas">
      ${_gDadosSecao('Feedback das campanhas', '', `<div class="gd-kpis gd-kpis-2">${_gDadosKpi('Positivo', _gDadosN(fb.positivo))}${_gDadosKpi('Negativo', _gDadosN(fb.negativo))}</div>${motivos}`)}
      ${_gDadosSecao('Comentários recentes', '', coment)}
    </div>`;
}

/* ── IA (uso, erro, latência, legendas) ─────────────────────────────────────────────── */
// Carrega à parte (RPC luma.dados_ia) e só quando a aba abre: é a mesma regra do explorador.
const G_DADOS_IA_TASK = {
  'legenda': 'Legenda', 'caption.generate': 'Legenda (gateway)', 'girias': 'Gírias da cidade',
  'encurtar': 'Encurtar texto', 'copy.fit': 'Encurtar texto (gateway)', 'transcrever-audio': 'Ditado por voz',
  'mapear-psd': 'Mapear PSD', 'psd.map': 'Mapear PSD (gateway)', 'aula': 'Tutor da Academia',
  'ajuda': 'Ajuda', 'cardapio': 'Leitura de cardápio', 'casar-fotos': 'Casar fotos', 'cli': 'Console da equipe',
  'content.review': 'Revisão da peça', 'image.validate': 'Validação de imagem', 'metadata.suggest': 'Sugestão de metadados',
  'stress.generate': 'Casos de estresse', 'search.expand': 'Busca semântica'
};
const G_DADOS_IA_ERRO = { timeout: 'Demorou demais (timeout)', rede: 'Sem conexão', http_502: 'O Gemini falhou', http_429: 'Limite de chamadas por minuto', http_401: 'Sessão expirada', http_400: 'Pedido recusado pela function', http_503: 'IA sem chave no servidor' };
const G_DADOS_IA_ORIGEM = { botao: 'Botão Copiar', download: 'Junto do download', instagram: 'Postar no Instagram', whatsapp: 'Enviar no WhatsApp' };
function _gDadosIaTask(t) { return G_DADOS_IA_TASK[t] || t || '—'; }
function _gDadosMs(ms) { return ms == null ? '—' : ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' s'; }
async function gDadosIaCarregar() {
  const s = _gDados.ia, req = ++s.req;
  s.carregando = true; s.erro = null;
  if (_gDados.aba === 'ia') _gDadosRender();
  const iv = _gDados.intervalo || _gDadosIntervalo();
  let res;
  let mod = null;
  try {
    // O consumo por modelo é uma RPC à parte: se ela falhar, o resto da aba continua.
    [res, mod] = await Promise.all([
      _gDadosRpc('dados_ia', { p_de: iv.de, p_ate: iv.ate }),
      _gDadosRpc('dados_ia_modelos', { p_de: iv.de, p_ate: iv.ate }).catch(() => null)
    ]);
  } catch (err) { res = { error: err }; }
  if (req !== s.req) return;
  s.modelos = (mod && !mod.error && mod.data) || null;
  s.carregando = false;
  if (res.error || !res.data) s.erro = _gDadosMsgErro(res.error || 'A consulta voltou vazia.');
  else s.data = res.data;
  if (_gDados.aba === 'ia') _gDadosRender();
}
function _gDadosIaHtml() {
  const s = _gDados.ia, d = s.data;
  if (s.erro) return _gDadosErroHtml(s.erro, 'gDadosIaCarregar()');
  if (s.carregando || !d) return _gDadosSkeleton();
  const r = d.resumo || {}, lg = d.legendas || {}, cf = d.copyfit_ia || {};
  if (!r.chamadas && !lg.geradas_local && !lg.geradas_ia) return _gDadosVazioHtml('Nenhuma chamada de IA neste período — o rastreamento da IA começou em 23/09/2026.');
  const total = r.chamadas || 0;
  const geradas = (lg.geradas_local || 0) + (lg.geradas_ia || 0), copiadas = (lg.copiadas_local || 0) + (lg.copiadas_ia || 0);
  const porTask = _gDadosTabela([
    { t: 'Tarefa', k: x => `<strong>${gEsc(_gDadosIaTask(x.task))}</strong><small class="gd-sub"><code>${gEsc(x.task)}</code></small>` },
    { t: 'Chamadas', num: 1, k: x => _gDadosN(x.n) },
    { t: 'Parcela', k: x => _gDadosBarra(total ? x.n / total : 0) + ' ' + _gDadosPct(total ? x.n / total : null) },
    { t: 'Erros', num: 1, k: x => _gDadosN(x.erros) + (x.n ? ` <small class="gd-sub">${_gDadosPct(x.erros / x.n)}</small>` : '') },
    { t: 'Pessoas', num: 1, k: x => _gDadosN(x.pessoas) },
    { t: 'Mediana', num: 1, k: x => gEsc(_gDadosMs(x.p50_ms)) },
    { t: 'p95', num: 1, k: x => gEsc(_gDadosMs(x.p95_ms)) }
  ], d.por_task, 'Nenhuma chamada no período.');
  const erros = _gDadosTabela([
    { t: 'Tarefa', k: x => gEsc(_gDadosIaTask(x.task)) },
    { t: 'Erro', k: x => gEsc(G_DADOS_IA_ERRO[x.erro] || x.erro || '—') + (G_DADOS_IA_ERRO[x.erro] ? `<small class="gd-sub"><code>${gEsc(x.erro)}</code></small>` : '') },
    { t: 'Vezes', num: 1, k: x => _gDadosN(x.n) }, { t: 'Pessoas', num: 1, k: x => _gDadosN(x.pessoas) },
    { t: 'Último', k: x => gEsc(_gDadosDataHora(x.ultimo)) }
  ], d.erros, 'Nenhuma falha de IA no período.');
  const origens = (lg.por_origem || []).length
    ? `<ul class="gd-lista">${lg.por_origem.map(o => `<li><strong>${gEsc(G_DADOS_IA_ORIGEM[o.origem] || o.origem)}</strong><small>${_gDadosN(o.n)}</small></li>`).join('')}</ul>`
    : '<p class="gd-vazio">Nenhuma legenda copiada no período.</p>';
  return `<div class="gd-kpis">
      ${_gDadosKpi('Chamadas de IA', _gDadosN(total), gEsc(_gDadosN(r.pessoas) + ' pessoas'))}
      ${_gDadosKpi('Taxa de erro', _gDadosPct(r.taxa_erro), gEsc(_gDadosN(r.erros) + ' falhas'))}
      ${_gDadosKpi('Tempo de resposta', gEsc(_gDadosMs(r.p50_ms)), gEsc('Mediana · p95 ' + _gDadosMs(r.p95_ms)))}
      ${_gDadosKpi('Legendas usadas', _gDadosPct(geradas ? copiadas / geradas : null), gEsc(_gDadosN(copiadas) + ' de ' + _gDadosN(geradas) + ' geradas'))}
      ${_gDadosKpi('Legendas da IA', _gDadosN(lg.geradas_ia), gEsc('Usadas ' + _gDadosN(lg.copiadas_ia) + ' · do motor local ' + _gDadosN(lg.copiadas_local)))}
      ${_gDadosKpi('Encurtar com IA', _gDadosN(cf.pedidos), gEsc(_gDadosN(cf.opcoes_ok) + ' opções aprovadas · ' + _gDadosN(cf.reprovadas) + ' reprovadas'))}
    </div>
    ${_gDadosIaCustoHtml()}
    ${_gDadosSecao('Consumo por tarefa', 'Cada ida à Edge Function de IA. O tempo conta só as que deram certo.', porTask)}
    <div class="gd-duas">
      ${_gDadosSecao('Falhas', 'O que deu errado, por tarefa.', erros)}
      ${_gDadosSecao('Por onde a legenda saiu', 'Cópias da legenda, pelo caminho usado.', origens)}
    </div>`;
}

/* ── Custo por modelo + calculadora ──────────────────────────────────────────────────
   US$ por 1 MILHÃO de tokens (entrada, saída), da tabela da própria function `ai` (09/2026).
   As reservas (NVIDIA, Ollama, Cloudflare, OpenRouter) estão no plano gratuito: custo 0.
   ⚠ Preço muda: atualizar AQUI e no comentário da escada em supabase/functions/ai/index.ts. */
const G_DADOS_IA_PRECO = {
  'gemini-3.1-flash-lite': [0.25, 1.50], 'gemini-3.5-flash-lite': [0.30, 2.50],
  'gemini-3.6-flash': [0.75, 3.75], 'gemini-3.7-flash': [0.75, 3.75], 'gemini-3.8-flash': [0.75, 3.75],
  'gemini-2.5-flash': [0.30, 2.50], 'gemini-2.5-flash-lite': [0.10, 0.40]
};
function _gDadosIaPreco(m) {
  if (G_DADOS_IA_PRECO[m]) return G_DADOS_IA_PRECO[m];
  if (/^(nvidia2?|ollama|cloudflare|openrouter):/.test(m || '')) return [0, 0];
  return null;
}
function _gDadosUsd(v) { return v == null ? '—' : 'US$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: v < 1 ? 4 : 2, maximumFractionDigits: v < 1 ? 4 : 2 }); }
function _gDadosTok(v) { return v >= 1e6 ? (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi' : v >= 1e3 ? (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : _gDadosN(v); }
/* Por modelo: tokens MEDIDOS (a function conta desde a v18) + estimativa das chamadas antigas pela
   média de tokens por chamada do próprio modelo (ou da média geral, se ele nunca foi medido). */
function _gDadosIaModelos() {
  const lista = (_gDados.ia.modelos && _gDados.ia.modelos.por_modelo) || [];
  let ci = 0, co = 0, cn = 0;
  lista.forEach(x => { ci += +x.tokens_in || 0; co += +x.tokens_out || 0; cn += +x.com_tokens || 0; });
  const geral = cn ? [ci / cn, co / cn] : null;
  return lista.map(x => {
    const med = x.com_tokens ? [x.tokens_in / x.com_tokens, x.tokens_out / x.com_tokens] : geral;
    const est = med ? [med[0] * (x.sem_tokens || 0), med[1] * (x.sem_tokens || 0)] : [0, 0];
    const tin = (+x.tokens_in || 0) + est[0], tout = (+x.tokens_out || 0) + est[1];
    const pr = _gDadosIaPreco(x.modelo);
    return Object.assign({}, x, { media: med, tin, tout, estimado: !!(x.sem_tokens && med),
      custo: pr ? (tin * pr[0] + tout * pr[1]) / 1e6 : null });
  });
}
function _gDadosIaCustoHtml() {
  const s = _gDados.ia;
  if (!s.modelos) return _gDadosSecao('Custo por modelo', '', '<p class="gd-vazio">O consumo por modelo não carregou.</p>');
  const ms = _gDadosIaModelos();
  if (!ms.length) return _gDadosSecao('Custo por modelo', '', '<p class="gd-vazio">Nenhuma chamada bem-sucedida no período.</p>');
  const total = ms.reduce((a, x) => a + (x.custo || 0), 0);
  const tokTot = ms.reduce((a, x) => a + x.tin + x.tout, 0);
  const p = s.modelos.periodo || {}, dias = Math.max(1, (new Date(p.ate) - new Date(p.de)) / 864e5);
  const tabela = _gDadosTabela([
    { t: 'Modelo', k: x => `<strong>${gEsc(x.modelo)}</strong>${_gDadosIaPreco(x.modelo) ? '' : '<small class="gd-sub">sem preço cadastrado</small>'}` },
    { t: 'Chamadas', num: 1, k: x => _gDadosN(x.n) },
    { t: 'Entrada', num: 1, k: x => gEsc(_gDadosTok(Math.round(x.tin))) },
    { t: 'Saída', num: 1, k: x => gEsc(_gDadosTok(Math.round(x.tout))) },
    { t: 'Por chamada', num: 1, k: x => x.media ? gEsc(_gDadosTok(Math.round(x.media[0] + x.media[1]))) : '—' },
    { t: 'Gasto', num: 1, k: x => gEsc(_gDadosUsd(x.custo)) + (x.estimado ? `<small class="gd-sub">${_gDadosN(x.sem_tokens)} estimadas</small>` : '') }
  ], ms, '');
  // Calculadora: modelo + chamadas/mês → custo. Começa no ritmo atual (período → 30 dias).
  const ritmo = Math.round(ms.reduce((a, x) => a + x.n, 0) / dias * 30);
  const sel = s.calcModelo && G_DADOS_IA_PRECO[s.calcModelo] ? s.calcModelo : (ms.find(x => G_DADOS_IA_PRECO[x.modelo]) || {}).modelo || 'gemini-3.1-flash-lite';
  const n = s.calcN != null ? s.calcN : ritmo;
  const base = ms.find(x => x.modelo === sel && x.media) || ms.find(x => x.media);
  const med = base ? base.media : null, pr = G_DADOS_IA_PRECO[sel];
  const proj = (med && pr) ? n * (med[0] * pr[0] + med[1] * pr[1]) / 1e6 : null;
  const opts = Object.keys(G_DADOS_IA_PRECO).map(m => `<option value="${gEsc(m)}"${m === sel ? ' selected' : ''}>${gEsc(m)}</option>`).join('');
  const calc = `<div class="gd-calc">
      <label>Modelo <select class="gd-select" onchange="gDadosIaCalc('modelo', this.value)">${opts}</select></label>
      <label>Chamadas por mês <input class="gd-input" type="number" min="0" step="100" value="${n}" oninput="gDadosIaCalc('n', this.value)"></label>
      <p class="gd-calc-res"><strong>${gEsc(_gDadosUsd(proj))}</strong> por mês
        <small class="gd-sub">${med ? gEsc(_gDadosTok(Math.round(med[0])) + ' de entrada + ' + _gDadosTok(Math.round(med[1])) + ' de saída por chamada (média medida)') : 'Sem tokens medidos ainda — a contagem começou em 24/09/2026.'}</small></p>
    </div>`;
  return `<div class="gd-kpis gd-kpis-2">
      ${_gDadosKpi('Gasto com IA', gEsc(_gDadosUsd(total)), gEsc('No período · ' + _gDadosTok(Math.round(tokTot)) + ' tokens'))}
      ${_gDadosKpi('Ritmo atual', gEsc(_gDadosUsd(total / dias * 30)), gEsc('Por mês · ' + _gDadosN(ritmo) + ' chamadas'))}
    </div>
    ${_gDadosSecao('Custo por modelo', 'Quem respondeu de fato (inclui as reservas grátis). Tokens contados pelo provedor; chamadas anteriores à contagem são estimadas pela média do modelo.', tabela)}
    ${_gDadosSecao('Calculadora de custo', 'Quanto custaria um volume de chamadas no modelo escolhido, pela média de tokens medida no Luma.', calc)}`;
}
function gDadosIaCalc(campo, v) {
  const s = _gDados.ia;
  if (campo === 'modelo') s.calcModelo = String(v || '');
  else s.calcN = Math.max(0, Math.round(+v || 0));
  const res = document.querySelector('.gd-calc-res');
  // Digitando o número: repinta só o resultado, sem perder o foco do campo.
  if (campo === 'n' && res) { const tmp = document.createElement('div'); tmp.innerHTML = _gDadosIaCustoHtml(); const novo = tmp.querySelector('.gd-calc-res'); if (novo) res.replaceWith(novo); return; }
  _gDadosRender();
}

/* ── Eventos (explorador) ───────────────────────────────────────────────────────────── */
async function gDadosEventosCarregar() {
  const e = _gDados.ev, req = ++e.req;
  e.carregando = true; e.erro = null;
  if (_gDados.aba === 'eventos') _gDadosRender();
  const iv = _gDados.intervalo || _gDadosIntervalo();
  let res;
  try {
    res = await _gDadosRpc('dados_eventos', { p_de: iv.de, p_ate: iv.ate, p_evento: e.evento || null, p_user: e.user || null, p_limit: e.limit, p_offset: e.offset });
  } catch (err) { res = { error: err }; }
  if (req !== e.req) return;
  e.carregando = false;
  if (res.error || !res.data) e.erro = _gDadosMsgErro(res.error || 'A consulta voltou vazia.');
  else e.data = res.data;
  if (_gDados.aba === 'eventos') _gDadosRender();
}
function gDadosEventosFiltro(campo, v) {
  if (campo !== 'evento' && campo !== 'user') return;
  _gDados.ev[campo] = String(v || ''); _gDados.ev.offset = 0;
  gDadosEventosCarregar();
}
function gDadosEventosPagina(delta) {
  const e = _gDados.ev, total = (e.data && e.data.total) || 0;
  const novo = Math.max(0, e.offset + delta * e.limit);
  if (novo >= total && delta > 0) return;
  e.offset = novo;
  gDadosEventosCarregar();
}
function _gDadosEventosHtml() {
  const e = _gDados.ev, r = e.data;
  const disp = (r && r.eventos_disponiveis) || [];
  const evOpts = disp.map(x => `<option value="${gEsc(x.evento)}"${x.evento === e.evento ? ' selected' : ''}>${gEsc(_gDadosRotuloCurto(x.evento))} (${_gDadosN(x.n)})</option>`).join('');
  const pOpts = _gDadosPessoas().slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
    .map(p => `<option value="${gEsc(p.user_id)}"${p.user_id === e.user ? ' selected' : ''}>${gEsc(p.nome || p.email)}</option>`).join('');
  const filtros = `<div class="gd-filtros">
      <select class="gd-select" aria-label="Filtrar por evento" onchange="gDadosEventosFiltro('evento',this.value)"><option value="">Todos os eventos</option>${evOpts}</select>
      <select class="gd-select" aria-label="Filtrar por pessoa" onchange="gDadosEventosFiltro('user',this.value)"><option value="">Todas as pessoas</option>${pOpts}</select>
    </div>`;
  if (e.erro) return filtros + _gDadosErroHtml(e.erro, 'gDadosEventosCarregar()');
  if (e.carregando || !r) return filtros + _gDadosSkeleton();
  const linhas = r.linhas || [];
  if (!linhas.length) return filtros + _gDadosVazioHtml(e.evento || e.user ? 'Nenhum evento com esse filtro no período.' : G_DADOS_VAZIO);
  const total = r.total || 0, ini = e.offset + 1, fim = Math.min(e.offset + linhas.length, total);
  const tr = linhas.map(l => `<tr>
      <td data-l="Quando" class="gd-nowrap">${gEsc(_gDadosDataHora(l.ocorreu_em))}</td>
      <td data-l="Pessoa">${gEsc(l.nome || '—')}<small class="gd-sub">${gEsc(_gDadosPapel(l.role))}</small></td>
      <td data-l="Evento">${gEsc(_gDadosRotulo(l.evento, l.payload))}<small class="gd-sub"><code>${gEsc(l.evento)}</code></small></td>
      <td data-l="Dados">${l.payload && Object.keys(l.payload).length ? `<details class="gd-payload"><summary>Ver dados</summary><pre>${gEsc(JSON.stringify(l.payload, null, 2))}</pre></details>` : '—'}</td></tr>`).join('');
  return filtros + `<p class="gd-contagem" role="status">${_gDadosN(ini)}–${_gDadosN(fim)} de ${_gDadosN(total)} eventos</p>
    <div class="gd-scroll"><table class="gd-table"><thead><tr><th scope="col">Quando</th><th scope="col">Pessoa</th><th scope="col">Evento</th><th scope="col">Dados</th></tr></thead><tbody>${tr}</tbody></table></div>
    <div class="gd-pag"><button type="button" class="gd-btn" onclick="gDadosEventosPagina(-1)" ${e.offset ? '' : 'disabled'}>Anteriores</button>
      <button type="button" class="gd-btn" onclick="gDadosEventosPagina(1)" ${fim < total ? '' : 'disabled'}>Próximos</button></div>`;
}
// Rótulo para a lista de filtro: sem payload real, "…" ocupa o lugar do nome.
function _gDadosRotuloCurto(ev) { return _gDadosRotulo(ev, { camp_name: '…', template_name: '…', campo: '…', query: '…', rota: '…' }); }

/* ── CSV ────────────────────────────────────────────────────────────────────────────── */
// ';' + BOM: é o que o Excel em PT-BR abre em colunas. Célula que começa com = + - @ ganha
// apóstrofo — senão um termo de busca como "=HYPERLINK(...)" vira fórmula na planilha.
function _gDadosCsvCel(v) {
  let s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function _gDadosCsvBaixar(nome, cab, linhas) {
  const txt = '﻿' + [cab].concat(linhas).map(l => l.map(_gDadosCsvCel).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'luma-dados-' + nome + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function gDadosExportarCsv() {
  const d = _gDados.data;
  if (!d) return;
  const aba = _gDados.aba;
  if (aba === 'visao') return _gDadosCsvBaixar('por-dia', ['dia', 'pessoas', 'sessoes', 'artes', 'downloads'], (d.por_dia || []).map(x => [x.dia, x.pessoas, x.sessoes, x.artes, x.downloads]));
  if (aba === 'pessoas') {
    if (_gDados.pessoa && _gDados.pessoaData) return _gDadosCsvBaixar('pessoa', ['ocorreu_em', 'evento', 'descricao', 'payload'], (_gDados.pessoaData.eventos || []).map(e => [e.ocorreu_em, e.evento, _gDadosRotulo(e.evento, e.payload), e.payload]));
    return _gDadosCsvBaixar('pessoas', ['nome', 'email', 'papel', 'cidade', 'franquia', 'ativo', 'ultimo_acesso', 'sessoes', 'tempo_s', 'artes', 'downloads', 'aparelho'],
      _gDadosPessoasFiltradas().map(p => [p.nome, p.email, _gDadosPapel(p.role), p.cidade, p.franquia, p.ativo ? 'sim' : 'não', p.ultimo_acesso, p.sessoes, p.tempo_s, p.artes, p.downloads, p.disp]));
  }
  if (aba === 'funil') return _gDadosCsvBaixar('funil', ['template_id', 'material', 'campanha', 'abriu', 'respondeu', 'gerou', 'baixou'], ((d.funil || {}).por_material || []).map(r => [r.template_id, r.template_name, r.camp_name, r.abriu, r.respondeu, r.gerou, r.baixou]));
  if (aba === 'conteudo') return _gDadosCsvBaixar('conteudo', ['template_id', 'template', 'pasta', 'publicado', 'abertos', 'gerados', 'baixados'], ((d.conteudo || {}).templates || []).map(t => [t.template_id, t.nome, t.pasta, t.publicado ? 'sim' : 'não', t.abertos, t.gerados, t.baixados]));
  if (aba === 'buscas') {
    const b = d.buscas || {};
    return _gDadosCsvBaixar('buscas', ['tipo', 'termo', 'vezes', 'sem_resultado', 'ultima'], []
      .concat((b.top || []).map(r => ['mais buscada', r.q, r.n, r.sem_resultado ? 'sim' : 'não', '']))
      .concat((b.sem_resultado || []).map(r => ['sem resultado', r.q, r.n, 'sim', r.ultima]))
      .concat((b.pedidos || []).map(r => ['pedido de conteúdo', r.q, r.n, '', r.ultima])));
  }
  if (aba === 'qualidade') {
    const q = d.qualidade || {};
    return _gDadosCsvBaixar('qualidade', ['tipo', 'item', 'detalhe', 'vezes', 'pessoas', 'ultimo'], []
      .concat((q.nao_cabe || []).map(r => ['texto não cabe', r.template_name || r.template_id, r.campo, r.n, '', '']))
      .concat((q.erros || []).map(r => ['erro do app', r.msg, '', r.n, r.pessoas, r.ultimo])));
  }
  if (aba === 'localfit') {
    const x = _gDados.lf.data;
    if (!x) return;
    return _gDadosCsvBaixar('local-fit', ['tipo', 'template_id', 'template', 'pasta', 'recorte', 'resolucoes', 'coube', 'ajustou', 'bloqueou', 'mediana_ms', 'p95_ms', 'pessoas', 'ultimo'], []
      .concat((x.por_material || []).map(m => ['template', m.material, m.nome, m.pasta, '', m.n, m.original, m.ajustou, m.bloqueou, m.ms_p50, '', m.pessoas, m.ultimo]))
      .concat((x.nao_coube || []).map(y => ['nao coube', y.material, y.nome, y.pasta, 'campo ' + (y.campo || '—') + ' · limite ' + (y.limite_p50 == null ? '—' : y.limite_p50), y.n, '', '', y.n, '', '', y.pessoas, y.ultimo]))
      .concat([['formato', x.por_formato], ['aparelho', x.por_dispositivo], ['navegador', x.por_navegador], ['fonte', x.por_fonte], ['versao', x.por_versao]]
        .flatMap(([t, rows]) => (rows || []).map(y => [t, '', '', '', y.chave, y.n, y.original, y.ajustou, y.bloqueou, y.ms_p50, y.ms_p95, '', y.ultimo || ''])))
      .concat((x.recentes || []).map(y => ['bloqueio recente', y.material, y.template, y.pasta, [y.campo, y.formato, y.origem, y.disp, y.nav, y.fonte, 'v' + (y.versao || '?')].join(' · '), 1, '', '', 1, y.ms, '', y.nome, y.ocorreu_em])));
  }
  if (aba === 'ia') {
    const x = _gDados.ia.data;
    if (!x) return;
    return _gDadosCsvBaixar('ia', ['tarefa', 'chamadas', 'ok', 'erros', 'pessoas', 'mediana_ms', 'p95_ms'], (x.por_task || []).map(r => [r.task, r.n, r.ok, r.erros, r.pessoas, r.p50_ms, r.p95_ms]));
  }
  if (aba === 'eventos') {
    // Exporta o filtro inteiro (até 500), não só a página visível.
    const e = _gDados.ev, iv = _gDados.intervalo || _gDadosIntervalo();
    let res;
    try { res = await _gDadosRpc('dados_eventos', { p_de: iv.de, p_ate: iv.ate, p_evento: e.evento || null, p_user: e.user || null, p_limit: 500, p_offset: 0 }); } catch (err) { res = { error: err }; }
    if (res.error || !res.data) { gToast('Não foi possível exportar: ' + _gDadosMsgErro(res.error), 'error'); return; }
    const ls = res.data.linhas || [];
    if ((res.data.total || 0) > ls.length) gToast('Exportados os ' + ls.length + ' eventos mais recentes de ' + res.data.total + '. Filtre para pegar o resto.');
    return _gDadosCsvBaixar('eventos', ['ocorreu_em', 'pessoa', 'papel', 'evento', 'descricao', 'payload'], ls.map(l => [l.ocorreu_em, l.nome, l.role, l.evento, _gDadosRotulo(l.evento, l.payload), l.payload]));
  }
}
