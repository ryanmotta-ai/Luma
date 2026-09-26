/* ══════════════════════════════════════════════════════════════
   SUPORTE AO VIVO — franqueado ↔ equipe DM (gSup*), 23/09/2026
   Dados, Realtime e presença. QUEM DESENHA é o widget de ajuda
   (js/widgets/help-widget.js): ele lê G_SUP e se inscreve em gSupOnChange.
   ⛔ A fronteira é a RLS de luma.suporte_mensagens (migration 20260923188000). Daqui nada
   decide quem lê o quê — da_equipe, autor e a conversa do franqueado são carimbados pelo
   gatilho do banco, não por este arquivo.
   A conversa É o franqueado (franqueado_id). "Aguardando" = a última mensagem veio dele.
   ⚠ Limite da v1: "ao vivo" só com o Luma aberto dos dois lados. Quem fechou o app vê a
   resposta pelo contador quando volta — não há e-mail nem push (precisaria de servidor).

   ATENDIMENTO (26/09/2026, migration 20260926120000): em cima da conversa, um estado
   (novo → em_atendimento ⇄ aguardando_usuario → resolvido), um RESPONSÁVEL e o histórico de
   quem assumiu/repassou/resolveu. Quem muda isso é o banco (gatilho + RPCs suporte_*); daqui
   só se lê e se pede. A trava "dois atendentes na mesma conversa" também é do banco: com
   responsável definido, a resposta de outra pessoa é recusada (SUPORTE_OUTRO_RESPONSAVEL).
   Sem a migration no ar, G_SUP.atendimento fica false e tudo volta a ser a v1 — nada quebra.
══════════════════════════════════════════════════════════════ */

const G_SUP = {
  ligado: false,     // canais do Realtime inscritos nesta sessão
  souEquipe: false,  // equipe_dm/gestao: vê a caixa de entrada, não uma conversa própria
  conversaDe: null,  // franqueado_id da conversa aberta (para o franqueado: ele mesmo)
  msgs: [],          // mensagens da conversa aberta, da mais antiga para a mais nova
  carregando: false,
  caixa: [],         // equipe: uma linha por conversa (view luma.suporte_caixa)
  naoLidas: 0,       // franqueado: respostas da equipe que ele ainda não viu
  online: [],        // primeiros nomes da equipe DISPONÍVEL (aba visível e não "ausente")
  equipe: [],        // presença completa: {id, nome, foto, cargo, status: disponivel|ausente}
  time: {},          // id → {nome, cargo, foto}: o cartão de cada pessoa da equipe (RPC suporte_equipe)
  meuStatus: 'disponivel', // equipe: a escolha da pessoa, lembrada neste navegador
  atendimento: null, // true = migration de atendimento no ar; false = v1; null = ainda não sabe
  conversa: null,    // atendimento da conversa aberta: {status, responsavel_id, ...}
  eventos: [],       // histórico da conversa aberta, do mais antigo para o mais novo
  vendo: false,      // o widget está com a conversa aberta NA TELA (é o que marca como lida)
  _ouvintes: [], _canalMsgs: null, _canalPresenca: null, _canalConv: null, _urls: {}, _caixaTimer: null,
  _acaoMinha: null   // {id, ate}: o que EU acabei de mudar não vira aviso "passaram para você"
};

function _gSupSb(){ return (typeof gSupabase === 'function') ? gSupabase() : null; }
function _gSupEu(){ return (typeof gCurrentUser === 'function') ? gCurrentUser() : null; }
function _gSupTab(){ const sb = _gSupSb(); return sb ? sb.schema('luma').from('suporte_mensagens') : null; }

// Backend no ar, sessão aberta e a chave do Controle do produto ligada.
function gSupDisponivel(){
  if (!_gSupSb() || !_gSupEu()) return false;
  if (typeof gFeatureCan === 'function' && !gFeatureCan('global.help.suporte', 'access')) return false;
  return true;
}

function gSupOnChange(fn){ if (typeof fn === 'function') G_SUP._ouvintes.push(fn); }
function _gSupAvisar(){
  _gSupPintarContador();
  G_SUP._ouvintes.forEach(function (fn) { try { fn(); } catch (e) { console.warn('[suporte]', e); } });
}

// Equipe: esta conversa pede a MINHA ação? Na fila (sem dono) ou comigo esperando resposta.
// Linha sem status (migration de atendimento fora do ar) = regra da v1: a última veio do franqueado.
function gSupPedeAcao(c){
  if (!c) return false;
  if (c.status == null) return !c.ultima_da_equipe;
  const eu = _gSupEu();
  return c.status === 'novo' || (c.status === 'em_atendimento' && !!eu && c.responsavel_id === eu.id);
}
// Franqueado: respostas não vistas. Equipe: conversas que pedem a minha ação.
function gSupAguardando(){ return G_SUP.caixa.filter(gSupPedeAcao).length; }
function gSupContador(){ return G_SUP.souEquipe ? gSupAguardando() : G_SUP.naoLidas; }

/* O contador mora no BODY (classe + variável CSS), não num nó: o botão Ajuda da home do
   franqueado é re-renderizado pelo catálogo a toda hora e perderia qualquer badge pendurado
   nele. O CSS (help-widget.css, "Suporte ao vivo") pinta o ::after de quem precisar. */
function _gSupPintarContador(){
  const n = gSupDisponivel() ? gSupContador() : 0;
  const b = document.body;
  if (!b) return;
  b.classList.toggle('sup-tem-contador', n > 0);
  b.style.setProperty('--sup-contador', n > 0 ? '"' + (n > 9 ? '9+' : n) + '"' : '""');
  const btn = document.getElementById('topbar-suporte');
  if (btn) {
    btn.hidden = !(G_SUP.souEquipe && gSupDisponivel());
    btn.setAttribute('aria-label', n > 0 ? 'Conversas do suporte, ' + n + ' aguardando' : 'Conversas do suporte');
  }
}

/* ── Contexto: onde o franqueado estava ao escrever ── */
const _G_SUP_MODOS = { franqueado: 'Franqueado', designer: 'Estúdio', academia: 'Implementação', calendario: 'Calendário', video: 'Vídeo' };
function gSupContexto(origem){
  const c = {};
  try {
    const cl = document.body.classList;
    c.modo = Object.keys(_G_SUP_MODOS).find(function (m) { return cl.contains('mode-' + m); }) || '';
    if (c.modo === 'franqueado' && typeof fState !== 'undefined' && fState) {
      if (fState.camp && fState.camp.name) c.campanha = String(fState.camp.name).slice(0, 120);
      if (fState.material && fState.material.name) c.material = String(fState.material.name).slice(0, 120);
      if (fState.camp && fState.fmt && fState.fmt.name) c.formato = String(fState.fmt.name).slice(0, 60);
    }
    c.tela = window.innerWidth < 768 ? 'celular' : 'computador';
    if (origem) c.origem = String(origem).slice(0, 30);
  } catch (e) {}
  return c;
}
// Texto único do contexto — o mesmo na bolha e na caixa de entrada.
function gSupContextoTexto(c){
  if (!c || typeof c !== 'object') return '';
  const partes = [c.campanha, c.material, c.formato].filter(Boolean);
  const onde = partes.length ? partes.join(' › ') : (_G_SUP_MODOS[c.modo] || '');
  return [onde, c.tela === 'celular' ? 'no celular' : ''].filter(Boolean).join(' · ');
}

/* ── Início, reconexão e desligamento ── */
function gSupIniciar(){
  const sb = _gSupSb(), eu = _gSupEu();
  if (G_SUP.ligado || !sb || !eu || !gSupDisponivel()) { _gSupPintarContador(); return; }
  G_SUP.ligado = true;
  G_SUP.souEquipe = (typeof gIsAdmin === 'function') && gIsAdmin();
  G_SUP.meuStatus = _gSupStatusSalvo();
  _gSupCarregarTime();

  // Atendimento (dono/estado) num canal À PARTE: sem a migration no ar a tabela não está na
  // publicação, e a recusa desse canal não pode derrubar o das mensagens.
  G_SUP._canalConv = sb.channel('luma-suporte-conv')
    .on('postgres_changes', { event: '*', schema: 'luma', table: 'suporte_conversas' }, function (p) { _gSupConversaMudou(p.new); })
    .subscribe();

  // Mensagens: a RLS de SELECT decide o que chega — o franqueado só recebe a própria conversa.
  G_SUP._canalMsgs = sb.channel('luma-suporte-msgs')
    .on('postgres_changes', { event: 'INSERT', schema: 'luma', table: 'suporte_mensagens' }, function (p) { _gSupChegou(p.new); })
    .on('postgres_changes', { event: 'UPDATE', schema: 'luma', table: 'suporte_mensagens' }, function (p) { _gSupMudou(p.new); })
    // SUBSCRIBED também dispara ao RECONECTAR: busca de novo o que pode ter passado no vão.
    .subscribe(function (status) { if (status === 'SUBSCRIBED') _gSupRecarregar(); });

  // Presença: canal PRIVADO — a policy de realtime.messages só deixa a equipe anunciar.
  try { if (sb.realtime && typeof sb.realtime.setAuth === 'function') sb.realtime.setAuth(); } catch (e) {}
  G_SUP._canalPresenca = sb.channel('luma:suporte', { config: { private: true } })
    .on('presence', { event: 'sync' }, _gSupPresencaSync)
    .subscribe(function (status) { if (status === 'SUBSCRIBED') _gSupAnunciar(); });
  document.addEventListener('visibilitychange', _gSupVisibilidade);
}

function _gSupDesligar(){
  const sb = _gSupSb();
  try { if (sb && G_SUP._canalMsgs) sb.removeChannel(G_SUP._canalMsgs); } catch (e) {}
  try { if (sb && G_SUP._canalPresenca) sb.removeChannel(G_SUP._canalPresenca); } catch (e) {}
  try { if (sb && G_SUP._canalConv) sb.removeChannel(G_SUP._canalConv); } catch (e) {}
  document.removeEventListener('visibilitychange', _gSupVisibilidade);
  G_SUP.ligado = false; G_SUP._canalMsgs = G_SUP._canalPresenca = G_SUP._canalConv = null;
  G_SUP.online = []; G_SUP.equipe = [];
  _gSupAvisar();
}

// A gestão pode virar a chave com o app aberto: liga/desliga sem recarregar.
window.addEventListener('luma:feature-flags-changed', function () {
  if (!_gSupEu()) return;
  if (gSupDisponivel()) gSupIniciar(); else if (G_SUP.ligado) _gSupDesligar();
});

async function _gSupRecarregar(){
  if (G_SUP.conversaDe) await Promise.all([_gSupCarregarMsgs(), _gSupCarregarAtendimento()]);
  if (G_SUP.souEquipe) await gSupCarregarCaixa();
  else await _gSupContarNaoLidas();
  _gSupAvisar();
}

async function _gSupContarNaoLidas(){
  const t = _gSupTab(), eu = _gSupEu();
  if (!t || !eu) return;
  try {
    const { count, error } = await t.select('id', { count: 'exact', head: true })
      .eq('franqueado_id', eu.id).eq('da_equipe', true).is('lida_em', null);
    if (!error) G_SUP.naoLidas = count || 0;
  } catch (e) {}
}

async function gSupCarregarCaixa(){
  const sb = _gSupSb();
  if (!sb || !G_SUP.souEquipe) return;
  try {
    const { data, error } = await sb.schema('luma').from('suporte_caixa')
      .select('*').order('ultima_em', { ascending: false }).limit(200);
    if (!error && Array.isArray(data)) {
      G_SUP.caixa = data;
      // A view só traz `status` com a migration de atendimento no ar.
      if (data.length) G_SUP.atendimento = ('status' in data[0]);
    }
  } catch (e) {}
  _gSupAvisar();
}
// Várias mensagens em rajada viram UMA consulta da caixa.
function _gSupCaixaDepois(){
  clearTimeout(G_SUP._caixaTimer);
  G_SUP._caixaTimer = setTimeout(gSupCarregarCaixa, 400);
}

/* ── Presença ── */
// A foto só vale se for do Storage do projeto — a mesma regra do CHECK de profiles.avatar_url.
// A presença é escrita pelo navegador de quem anuncia; sem isto, viraria link externo na tela da rede.
const _G_SUP_FOTO_OK = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/luma-user-uploads\//;
function _gSupFoto(u){ return (typeof u === 'string' && u.length <= 500 && _G_SUP_FOTO_OK.test(u)) ? u : ''; }

function _gSupPresencaSync(){
  const canal = G_SUP._canalPresenca;
  if (!canal) return;
  const st = canal.presenceState() || {};
  const equipe = [];
  Object.keys(st).forEach(function (k) {
    (st[k] || []).forEach(function (m) {
      if (!m || !m.nome) return;
      const nome = String(m.nome).slice(0, 40);
      const id = m.id ? String(m.id) : 'nome:' + nome;   // aba antiga (antes de 26/09) só mandava o nome
      const status = m.status === 'ausente' ? 'ausente' : 'disponivel';
      const ja = equipe.find(function (p) { return p.id === id; });
      // A mesma pessoa em duas abas: basta uma disponível para ela estar disponível.
      if (ja) { if (status === 'disponivel') ja.status = 'disponivel'; return; }
      equipe.push({ id: id, nome: nome, foto: _gSupFoto(m.foto), cargo: String(m.cargo || '').slice(0, 60), status: status });
    });
  });
  G_SUP.equipe = equipe;
  G_SUP.online = equipe.filter(function (p) { return p.status === 'disponivel'; }).map(function (p) { return p.nome; })
    .filter(function (n, i, a) { return a.indexOf(n) === i; });
  _gSupAvisar();
}
// Equipe "online" = Luma aberto numa aba VISÍVEL. Aba escondida sai da lista. O status
// (disponível/ausente) vai junto: ausente continua na presença para os colegas, mas o
// franqueado não o conta como online (G_SUP.online).
function _gSupAnunciar(){
  const canal = G_SUP._canalPresenca, eu = _gSupEu();
  if (!canal || !eu || !G_SUP.souEquipe) return;
  try {
    if (document.visibilityState === 'visible') {
      canal.track({
        id: eu.id,
        nome: String(eu.displayName || '').trim().split(/\s+/)[0] || 'Equipe',
        foto: _gSupFoto(typeof gUserFoto === 'function' ? gUserFoto(eu) : ''),
        cargo: String(eu.departamento || '').trim().slice(0, 60) || 'Equipe DM',
        status: G_SUP.meuStatus
      });
    } else canal.untrack();
  } catch (e) {}
}

/* ── Quem atende: status escolhido e o cartão (foto, nome, cargo) ── */
function _gSupStatusSalvo(){
  try { return localStorage.getItem('luma_sup_status') === 'ausente' ? 'ausente' : 'disponivel'; } catch (e) { return 'disponivel'; }
}
// Disponível / Ausente. Ausente continua logado e recebendo a caixa, mas sai do "online agora"
// do franqueado — e com isso do desvio direto da pergunta para a equipe.
function gSupSetStatus(s){
  G_SUP.meuStatus = s === 'ausente' ? 'ausente' : 'disponivel';
  try { localStorage.setItem('luma_sup_status', G_SUP.meuStatus); } catch (e) {}
  _gSupAnunciar();
  _gSupAvisar();
}

async function _gSupCarregarTime(){
  const sb = _gSupSb();
  if (!sb) return;
  try {
    const { data, error } = await sb.schema('luma').rpc('suporte_equipe');
    if (error || !Array.isArray(data)) return;
    const t = {};
    data.forEach(function (p) { if (p && p.id) t[p.id] = { nome: p.nome || '', cargo: p.cargo || 'Equipe DM', foto: _gSupFoto(p.avatar_url) }; });
    G_SUP.time = t;
    _gSupAvisar();
  } catch (e) {}
}

// O cartão de uma pessoa da equipe: quem é (suporte_equipe) + onde está agora (presença).
// status: disponivel | ausente | offline. null = não sei quem é.
function gSupPessoa(id){
  if (!id) return null;
  const t = G_SUP.time[id];
  const p = G_SUP.equipe.find(function (m) { return m.id === id; });
  const nome = (t && t.nome) || (p && p.nome) || '';
  if (!nome) return null;
  return {
    id: id, nome: nome, primeiro: nome.split(/\s+/)[0],
    cargo: (t && t.cargo) || (p && p.cargo) || 'Equipe DM',
    foto: (t && t.foto) || (p && p.foto) || '',
    status: p ? p.status : 'offline'
  };
}
// Quem da equipe está disponível agora, com cartão — para o franqueado ver com quem vai falar.
function gSupOnlinePessoas(){
  return G_SUP.equipe.filter(function (p) { return p.status === 'disponivel'; }).map(function (p) {
    return (p.id.indexOf('nome:') === 0 ? null : gSupPessoa(p.id)) || { id: p.id, nome: p.nome, primeiro: p.nome, cargo: p.cargo || 'Equipe DM', foto: p.foto, status: p.status };
  });
}
function _gSupVisibilidade(){
  _gSupAnunciar();
  if (document.visibilityState === 'visible' && G_SUP.vendo) _gSupMarcarLidas();
}

/* ── A conversa aberta ── */
async function gSupAbrirConversa(franqueadoId){
  const eu = _gSupEu();
  if (!eu) return;
  G_SUP.conversaDe = G_SUP.souEquipe ? franqueadoId : eu.id;
  if (!G_SUP.conversaDe) return;
  G_SUP.msgs = []; G_SUP.conversa = null; G_SUP.eventos = [];
  G_SUP.carregando = true; _gSupAvisar();
  await Promise.all([_gSupCarregarMsgs(), _gSupCarregarAtendimento()]);
  G_SUP.carregando = false;
  if (G_SUP.vendo) _gSupMarcarLidas();
  _gSupAvisar();
}
function gSupFecharConversa(){
  G_SUP.conversaDe = null; G_SUP.msgs = []; G_SUP.conversa = null; G_SUP.eventos = []; G_SUP.vendo = false;
  _gSupAvisar();
}

// Tabela/função que não existe = a migration de atendimento não está no ar (não é falha de rede).
function _gSupSemAtendimento(err){
  return !!err && (err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST202' || err.code === '42883');
}
async function _gSupCarregarAtendimento(){
  const sb = _gSupSb(), de = G_SUP.conversaDe;
  if (!sb || !de || G_SUP.atendimento === false) return;
  try {
    const r = await Promise.all([
      sb.schema('luma').from('suporte_conversas').select('*').eq('franqueado_id', de).maybeSingle(),
      sb.schema('luma').from('suporte_eventos').select('*').eq('franqueado_id', de).order('created_at', { ascending: false }).limit(100)
    ]);
    if (r[0].error) { if (_gSupSemAtendimento(r[0].error)) G_SUP.atendimento = false; return; }
    G_SUP.atendimento = true;
    if (G_SUP.conversaDe !== de) return;
    G_SUP.conversa = r[0].data || null;
    if (!r[1].error && Array.isArray(r[1].data)) G_SUP.eventos = r[1].data.reverse();
  } catch (e) {}
}

// Realtime do atendimento: alguém assumiu, repassou ou resolveu — ou uma mensagem mudou o estado.
function _gSupConversaMudou(c){
  if (!c || !c.franqueado_id) return;
  G_SUP.atendimento = true;
  if (c.franqueado_id === G_SUP.conversaDe) {
    G_SUP.conversa = c;
    _gSupCarregarAtendimento().then(_gSupAvisar);   // o histórico ganhou uma linha
  }
  if (G_SUP.souEquipe) {
    const eu = _gSupEu(), linha = G_SUP.caixa.find(function (x) { return x.franqueado_id === c.franqueado_id; });
    const minha = G_SUP._acaoMinha && G_SUP._acaoMinha.id === c.franqueado_id && G_SUP._acaoMinha.ate > Date.now();
    if (eu && linha && c.responsavel_id === eu.id && linha.responsavel_id !== eu.id && !minha) {
      _gSupToast('Uma conversa do suporte foi passada para você.', c.franqueado_id);
    }
    if (linha) { linha.status = c.status; linha.responsavel_id = c.responsavel_id; }
    _gSupCaixaDepois();
  }
  _gSupAvisar();
}
function _gSupMarcaAcao(id){ G_SUP._acaoMinha = { id: id, ate: Date.now() + 8000 }; }

/* ── Assumir / repassar / resolver (só equipe). O banco decide e grava o histórico; daqui só
   se pede e se traduz a resposta. Devolve {ok, erro}. ── */
async function _gSupAcao(rpc, args){
  const sb = _gSupSb(), de = G_SUP.conversaDe;
  if (!sb || !de || !G_SUP.souEquipe) return { ok: false, erro: 'O suporte não está disponível agora. Recarregue a página.' };
  _gSupMarcaAcao(de);
  let r;
  try { r = await sb.schema('luma').rpc(rpc, Object.assign({ p_franqueado: de }, args || {})); }
  catch (e) { r = { error: e }; }
  await _gSupCarregarAtendimento();
  _gSupCaixaDepois();
  _gSupAvisar();
  if (r.error) return { ok: false, erro: 'Não consegui salvar. Confira sua internet e tente de novo.' };
  const d = r.data || {};
  if (d.ok === false) {
    if (d.erro === 'outro_responsavel') return { ok: false, erro: (d.responsavel_nome || 'Outra pessoa da equipe') + ' está atendendo esta conversa.' };
    if (d.erro === 'destino_invalido') return { ok: false, erro: 'Essa pessoa não pode receber conversas agora.' };
    return { ok: false, erro: 'Esta conversa não está mais disponível.' };
  }
  return { ok: true };
}
// forcar = tirar de quem está atendendo (fica no histórico como "assumiu de <fulano>").
function gSupAssumir(forcar){ return _gSupAcao('suporte_assumir', { p_forcar: !!forcar }); }
function gSupRepassar(paraId){ return _gSupAcao('suporte_repassar', { p_para: paraId }); }
function gSupResolver(){ return _gSupAcao('suporte_resolver'); }

async function _gSupCarregarMsgs(){
  const t = _gSupTab(), de = G_SUP.conversaDe;
  if (!t || !de) return;
  try {
    const { data, error } = await t.select('*').eq('franqueado_id', de).order('created_at', { ascending: false }).limit(200);
    if (!error && Array.isArray(data) && G_SUP.conversaDe === de) {
      // O que chegou ou foi enviado ENQUANTO a busca estava no ar não pode sumir da tela —
      // é o caso da pergunta desviada da IA, enviada junto com a abertura da conversa.
      const novos = data.reverse();
      G_SUP.msgs.forEach(function (m) { if (!novos.some(function (x) { return x.id === m.id; })) novos.push(m); });
      G_SUP.msgs = novos;
    }
  } catch (e) {}
}

// O widget avisa quando a conversa está (ou deixou de estar) na tela.
function gSupVendo(sim){
  const antes = G_SUP.vendo;
  G_SUP.vendo = !!sim;
  if (G_SUP.vendo && !antes) _gSupMarcarLidas();
}

// "Visto": marca como lida a mensagem do OUTRO lado — só se a pessoa está mesmo olhando.
function _gSupMarcarLidas(){
  const t = _gSupTab(), de = G_SUP.conversaDe;
  if (!t || !de || document.visibilityState !== 'visible') return;
  const doOutroLado = function (m) { return !m.lida_em && (G_SUP.souEquipe ? !m.da_equipe : m.da_equipe); };
  if (!G_SUP.msgs.some(doOutroLado) && (G_SUP.souEquipe || !G_SUP.naoLidas)) return;
  const agora = new Date().toISOString();
  G_SUP.msgs.forEach(function (m) { if (doOutroLado(m)) m.lida_em = agora; });
  if (G_SUP.souEquipe) G_SUP.caixa.forEach(function (c) { if (c.franqueado_id === de) c.nao_lidas = 0; });
  else G_SUP.naoLidas = 0;
  _gSupAvisar();
  t.update({ lida_em: agora }).eq('franqueado_id', de).eq('da_equipe', !G_SUP.souEquipe).is('lida_em', null)
    .then(function () {}, function () {});
}

function _gSupJuntar(m){
  if (!m || m.franqueado_id !== G_SUP.conversaDe) return false;
  if (G_SUP.msgs.some(function (x) { return x.id === m.id; })) return false;
  G_SUP.msgs.push(m);
  return true;
}

function _gSupChegou(m){
  if (!m) return;
  const minha = _gSupEu() && m.autor_id === _gSupEu().id;
  _gSupJuntar(m);
  if (G_SUP.vendo && m.franqueado_id === G_SUP.conversaDe) _gSupMarcarLidas();
  if (G_SUP.souEquipe) {
    _gSupCaixaDepois();
    if (!m.da_equipe && !(G_SUP.vendo && m.franqueado_id === G_SUP.conversaDe)) {
      _gSupToast('Nova mensagem no suporte.', m.franqueado_id);
    }
  } else if (m.da_equipe && !minha && !(G_SUP.vendo && document.visibilityState === 'visible')) {
    G_SUP.naoLidas++;
    _gSupToast((m.autor_nome ? m.autor_nome + ', da equipe DM, respondeu' : 'A equipe DM respondeu') + '.', null);
  }
  _gSupAvisar();
}
function _gSupMudou(m){
  if (!m) return;
  G_SUP.msgs.forEach(function (x) { if (x.id === m.id) x.lida_em = m.lida_em; });
  _gSupAvisar();
}
function _gSupToast(msg, franqueadoId){
  if (typeof gToast !== 'function') return;
  gToast(msg, null, null, { acao: { rotulo: 'Ver', onClick: function () {
    if (typeof window.lumaWidgetAbrirSuporte === 'function') window.lumaWidgetAbrirSuporte(null, franqueadoId);
  } } });
}

/* ── Enviar ── */
// dataUrl opcional (print). Devolve {ok, erro} — o widget mostra o erro, este arquivo não pinta nada.
async function gSupEnviar(texto, dataUrl, origem){
  const t = _gSupTab(), sb = _gSupSb(), de = G_SUP.conversaDe;
  texto = String(texto || '').trim().slice(0, 4000);
  if (!t || !de) return { ok: false, erro: 'O suporte não está disponível agora. Recarregue a página.' };
  if (!texto && !dataUrl) return { ok: false, erro: '' };
  let anexo = null;
  if (dataUrl) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[blob.type];
      if (!ext) return { ok: false, erro: 'No suporte, o anexo precisa ser uma imagem (PNG, JPG ou WEBP).' };
      if (blob.size > 5 * 1024 * 1024) return { ok: false, erro: 'Imagem muito grande — envie um print de até 5 MB.' };
      // A pasta é a CONVERSA (o franqueado): é o que a policy do bucket confere.
      const path = de + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await sb.storage.from('luma-suporte').upload(path, blob, { contentType: blob.type });
      if (error) return { ok: false, erro: 'Não consegui enviar a imagem. Tente de novo.' };
      anexo = path;
    } catch (e) { return { ok: false, erro: 'Não consegui ler a imagem. Tente outro arquivo.' }; }
  }
  const row = { franqueado_id: de, texto: texto, anexo_path: anexo, contexto: G_SUP.souEquipe ? null : gSupContexto(origem) };
  if (G_SUP.souEquipe) _gSupMarcaAcao(de);
  try {
    const { data, error } = await t.insert(row).select().single();
    if (error) {
      // A trava do banco: outra pessoa é a responsável (pode ter assumido segundos antes).
      if (/SUPORTE_OUTRO_RESPONSAVEL/.test(error.message || '')) {
        await _gSupCarregarAtendimento();
        _gSupAvisar();
        const p = gSupPessoa(G_SUP.conversa && G_SUP.conversa.responsavel_id);
        return { ok: false, erro: (p ? p.primeiro : 'Outra pessoa da equipe') + ' assumiu esta conversa. Para responder, assuma o atendimento.' };
      }
      return { ok: false, erro: 'Não consegui enviar. Confira sua internet e tente de novo.' };
    }
    _gSupJuntar(data);
    if (G_SUP.souEquipe) _gSupCaixaDepois();
    _gSupAvisar();
    // A mensagem mudou o estado (a vez passou, ou a resposta assumiu o atendimento). O Realtime
    // também avisa; esta leitura cobre o caso de o canal do atendimento estar reconectando.
    _gSupCarregarAtendimento().then(_gSupAvisar);
    return { ok: true };
  } catch (e) { return { ok: false, erro: 'Não consegui enviar. Confira sua internet e tente de novo.' }; }
}

// Print anexado: bucket privado → URL assinada, guardada por 50 min (a assinatura vale 60).
function gSupAnexoUrl(path){
  const sb = _gSupSb(), c = G_SUP._urls[path];
  if (!sb || !path) return '';
  if (c && c.ate > Date.now()) return c.url;
  if (!c || !c.pedindo) {
    G_SUP._urls[path] = { url: c ? c.url : '', ate: 0, pedindo: true };
    sb.storage.from('luma-suporte').createSignedUrl(path, 3600).then(function (r) {
      const url = r && r.data && r.data.signedUrl;
      G_SUP._urls[path] = { url: url || '', ate: url ? Date.now() + 50 * 60000 : Date.now() + 60000, pedindo: false };
      if (url) _gSupAvisar();
    }, function () { G_SUP._urls[path] = { url: '', ate: Date.now() + 60000, pedindo: false }; });
  }
  return c ? c.url : '';
}
