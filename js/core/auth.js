/**
 * js/core/auth.js
 *
 * AUTH via Supabase (Fase 5.1). Login/logout/recuperação usam supabase.auth
 * (window.sb, criado em js/core/supabase.js). gLoadProfile() carrega a sessão +
 * o role do profile e popula gAuthState, pra que gCurrentUser/gCurrentRole sigam
 * SÍNCRONOS no resto do app.
 *
 * Roles (espelham o DM CRM): franqueado | equipe_dm | gestao.
 *   Persona Franqueado = franqueado · Persona Designer = equipe_dm/gestao (gIsAdmin)
 *   gestao = topo (gerencia usuários).
 *
 * OBS: a gestão de usuários (gGetAllUsers/gSetUserRole/gSetUserAtivo) já usa o
 * Supabase via RLS (só gestão escreve; guard no banco bloqueia auto-promoção).
 * Falta só CRIAR usuário pelo app (Edge Function com service_role) — hoje é no
 * Dashboard do Supabase (gAddManagedUser orienta isso).
 */

// Roles do banco (espelham o DM CRM). gIsAdmin = persona Designer (equipe_dm+gestao).
const ROLE_HIERARCHY = { franqueado:1, equipe_dm:2, gestao:3 };
function gRoleLevel(role){ return ROLE_HIERARCHY[role]||0; }

// Cache em memória do usuário logado. A SESSÃO em si é gerenciada pelo supabase-js
// (persiste em localStorage e renova o token sozinho) — isto é só um espelho do profile.
let gAuthState = { user: null };

function _gSb(){ return (typeof gSupabase === 'function') ? gSupabase() : window.sb; }

/* Erro do Supabase Auth em PT-BR, dizendo O QUE FAZER (23/09/2026). O cru ("Email rate limit
   exceeded", "Email not confirmed") chegava em inglês na tela do franqueado. Nos logs de 18/09,
   21 tentativas seguidas de "senha incorreta" em 25 min, de duas pessoas: quem nunca entrou não
   sabia que a conta nasce com a senha inicial passada pela gestão. */
function _gAuthErroPt(error, contexto) {
  const m = String((error && (error.message || error.code)) || '');
  if (/invalid login|invalid_credentials/i.test(m))
    return 'E-mail ou senha incorretos. No primeiro acesso, use a senha inicial que a gestão te passou — ou toque em "Esqueci minha senha".';
  if (/not confirmed/i.test(m)) return 'Seu e-mail ainda não foi confirmado. Fale com a gestão para liberar o acesso.';
  if (/rate limit|too many|over_email_send_rate/i.test(m))
    return 'Muitos pedidos em pouco tempo. Espere alguns minutos e tente de novo.';
  const seg = m.match(/after (\d+) seconds?/i);
  if (seg) return 'Aguarde ' + seg[1] + ' segundos para pedir outro link.';
  if (/not authorized|not allowed/i.test(m))
    return contexto === 'recuperar'
      ? 'Não consegui enviar o e-mail para esse endereço. Fale com a gestão para redefinir sua senha.'
      : 'Acesso não autorizado. Fale com a gestão.';
  if (/banned/i.test(m)) return 'Seu acesso está bloqueado. Fale com a gestão.';
  if (/timeout|unexpected_failure|500/i.test(m)) return 'O servidor demorou para responder. Tente de novo em instantes.';
  if (/weak|should be at least|password.*characters/i.test(m)) return 'Senha fraca: use no mínimo 8 caracteres, misturando letras e números.';
  if (/same.*password|different from the old/i.test(m)) return 'A nova senha precisa ser diferente da atual.';
  return m || 'Não deu certo. Tente de novo.';
}

// Carrega a sessão atual do Supabase + o profile (role) do banco. Idempotente.
async function gLoadProfile() {
  const sb = _gSb();
  if (!sb) { gAuthState = { user: null }; return null; }
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { gAuthState = { user: null }; return null; }
    const { data: prof, error: profErr } = await sb
      .from('profiles')
      .select('role, nome, departamento, telefone, ativo')
      .eq('id', user.id)
      .maybeSingle();
    // Falha ao carregar o profile (rede/RLS) rebaixava gestão→franqueado EM SILÊNCIO:
    // a pessoa via o app "sem as abas" e achava que perdeu o acesso. O default franqueado
    // continua (fail-closed, correto) — mas agora com aviso do que aconteceu.
    if (profErr) {
      console.warn('[auth] profile não carregou — usando role mínima temporária:', profErr.message||profErr);
      try { if (typeof gToast === 'function') gToast('Não consegui carregar seu perfil completo. Recarregue a página.', 'error'); } catch(e) {}
    }
    // Gate de conta desativada: sem isto, "Desativar acesso" na Equipe era cosmético —
    // o usuário com ativo=false seguia logando e usando tudo. (RLS ainda é a fronteira
    // dos DADOS; isto encerra a SESSÃO. Endurecer também nas policies fica no backlog.)
    if (prof && prof.ativo === false) {
      try { await sb.auth.signOut(); } catch(e) {}
      try { if (typeof gToast === 'function') gToast('Sua conta foi desativada. Fale com a gestão.', 'error'); } catch(e) {}
      gAuthState = { user: null };
      return null;
    }
    /* Ainda na senha inicial compartilhada? Quem responde é o banco (`luma.usa_senha_inicial`)
       — a senha vive só lá, nunca neste código público. Se a pergunta falhar (rede), a pessoa
       entra: travar o login por causa disso seria pior que adiar a troca para o próximo acesso. */
    let senhaInicial = false;
    try {
      const { data: si } = await sb.schema('luma').rpc('usa_senha_inicial');
      senhaInicial = si === true;
    } catch (e) {}
    gAuthState = { user: {
      id: user.id,
      email: user.email,
      role: (prof && prof.role) || 'franqueado',
      displayName: (prof && prof.nome) || (user.email || '').split('@')[0],
      departamento: (prof && prof.departamento) || null,
      telefone: (prof && prof.telefone) || '',
      senhaInicial,
    } };
    return gAuthState.user;
  } catch (e) {
    gAuthState = { user: null };
    return null;
  }
}

async function gLogin(email, password) {
  if (!email || !password) return { ok: false, error: 'E-mail e senha são obrigatórios.' };
  const sb = _gSb();
  if (!sb) return { ok: false, error: 'Backend indisponível. Recarregue a página.' };
  // try/catch: uma rejeição (falha de rede no fetch) NÃO pode escapar — quem chama
  // (gDoLogin) espera sempre um objeto de resultado, senão o botão trava em "Autenticando…".
  try {
    const { error } = await sb.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(),
      password
    });
    if (error) return { ok: false, error: _gAuthErroPt(error, 'login') };
    await gLoadProfile();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Não foi possível conectar. Verifique sua internet e tente de novo.' };
  }
}

async function gLogout() {
  const sb = _gSb();
  /* `logout` ANTES do signOut: depois dele a RPC não tem mais sessão para assinar. Espera no
     máximo 1,2s — sair não trava por telemetria; o que não subir fica na fila deste usuário. */
  try { if (typeof gTrackEvent === 'function') await Promise.race([gTrackEvent('logout', {}), new Promise(r => setTimeout(r, 1200))]); } catch (e) {}
  try { if (sb) await sb.auth.signOut(); } catch (e) {}
  gAuthState = { user: null };
  location.reload();
}

function gCurrentUser() { return gAuthState.user; }
function gCurrentRole() { return gAuthState.user ? gAuthState.user.role : null; }
function gIsAdmin(){ return gRoleLevel(gCurrentRole()) >= ROLE_HIERARCHY.equipe_dm; } // equipe_dm + gestao = Designer
function gIsSuperAdmin(){ return gCurrentRole()==='gestao'; }
function gCanManageUsers(){ return gIsSuperAdmin(); }

async function gForgotPassword(email) {
  if (!email) return { ok: false, error: 'Digite seu e-mail.' };
  const sb = _gSb();
  if (!sb) return { ok: false, error: 'Backend indisponível.' };
  const redirectTo = location.origin + location.pathname;
  // Mesma razão do gLogin: uma rejeição (rede caiu) NÃO pode escapar — quem chama espera
  // sempre um objeto, senão o botão fica preso em "Enviando…" e a tela não diz nada.
  try {
    const { error } = await sb.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), { redirectTo });
    if (error) return { ok: false, error: _gAuthErroPt(error, 'recuperar') };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Não foi possível conectar. Verifique sua internet e tente de novo.' };
  }
}

// Roda sobre a sessão de recovery materializada pelo supabase-js ao abrir o link do e-mail.
async function gResetPassword(newPassword) {
  const sb = _gSb();
  if (!sb) return { ok: false, error: 'Backend indisponível.' };
  try {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    // A mensagem crua segue junto: o passo "nova senha" detecta sessão vencida por ela.
    if (error) return { ok: false, error: /session|jwt|expired|token/i.test(error.message || '') ? error.message : _gAuthErroPt(error, 'senha') };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Não foi possível conectar. Verifique sua internet e tente de novo.' };
  }
}

/* ══ LINK DE E-MAIL (recuperação/convite) — o passo que faltava ═══════════════════════
   O link do e-mail traz a sessão no hash e o supabase-js a materializa sozinho. Até aqui
   o Luma abria a home direto: a pessoa entrava UMA vez e continuava SEM SENHA — no
   aparelho seguinte, "E-mail ou senha incorretos" de novo. Era o beco de quem foi
   convidado antes de 08/09/2026, quando o `invite-user` usava `inviteUserByEmail` e a
   conta nascia sem senha nenhuma. Agora o link desemboca no passo "defina sua senha".

   O hash vem de `G_AUTH_LINK_HASH` (supabase.js) porque o SDK o apaga antes deste
   arquivo rodar. O flag em sessionStorage segura o passo através de um F5: sem ele,
   recarregar a página pulava a definição da senha e devolvia a pessoa ao mesmo beco.

   Devolve `null` (boot normal), `{tipo}` (pedir a senha) ou `{erro}` (link vencido). */
const G_NOVA_SENHA_FLAG = '__luma_nova_senha';
function gAuthLinkPendente() {
  let pendente = false;
  try { pendente = sessionStorage.getItem(G_NOVA_SENHA_FLAG) === '1'; } catch (e) {}
  const retomada = pendente ? { tipo: 'recovery', erro: null } : null;
  const hash = (typeof G_AUTH_LINK_HASH === 'string') ? G_AUTH_LINK_HASH.replace(/^#\/?/, '') : '';
  if (!hash || hash.indexOf('=') < 0) return retomada;

  let p;
  try { p = new URLSearchParams(hash); } catch (e) { return retomada; }

  // Link vencido ou já usado: o Supabase devolve o motivo no próprio hash, sem sessão
  // nenhuma. Sem este ramo, clicar num link velho não fazia NADA visível na tela.
  const erro = p.get('error_description') || p.get('error');
  if (erro) {
    return { tipo: null, erro: /expired|otp_expired/i.test(erro)
      ? 'Esse link expirou. Peça um novo em "Esqueci minha senha".'
      : 'Não consegui validar esse link. Peça um novo em "Esqueci minha senha".' };
  }

  const tipo = p.get('type');
  if (tipo !== 'recovery' && tipo !== 'invite') return retomada;
  try { sessionStorage.setItem(G_NOVA_SENHA_FLAG, '1'); } catch (e) {}
  return { tipo: tipo, erro: null };
}

// A senha existe: some com o passo. Chamado só depois do updateUser dar ok.
function gNovaSenhaResolvida() {
  try { sessionStorage.removeItem(G_NOVA_SENHA_FLAG); } catch (e) {}
}

/* ── GESTÃO DE USUÁRIOS — Supabase (Fase 1: listar + role + ativo via RLS) ──
   Listar/mudar-role/ativar rodam via supabase-js + RLS (só gestão escreve role).
   Criar/excluir usuário em auth.users precisa de Edge Function (service_role) — Fase 2. */
async function gGetAllUsers(){
  const sb=_gSb();
  if(!sb) return [];
  try{
    const { data, error }=await sb.from('profiles')
      .select('id,nome,email,role,departamento,ativo')
      .order('role',{ascending:false}).order('nome',{ascending:true});
    if(error || !Array.isArray(data)) return [];
    return data.map(p=>({ id:p.id, email:p.email, displayName:p.nome||p.email, role:p.role,
      departamento:p.departamento||null, ativo:p.ativo!==false }));
  }catch(e){ return []; }
}
async function gSetUserRole(idOrEmail, newRole){
  if(!gCanManageUsers()) return {ok:false,error:'Sem permissão (só gestão muda permissões).'};
  if(['franqueado','equipe_dm','gestao'].indexOf(newRole)<0) return {ok:false,error:'Permissão inválida.'};
  const sb=_gSb(); if(!sb) return {ok:false,error:'Backend indisponível.'};
  try{
    const col=/@/.test(String(idOrEmail))?'email':'id';
    const { error }=await sb.from('profiles').update({role:newRole}).eq(col, idOrEmail);
    if(error) return {ok:false,error:error.message};
    return {ok:true};
  }catch(e){ return {ok:false,error:String((e&&e.message)||e)}; }
}
async function gSetUserAtivo(idOrEmail, ativo){
  if(!gCanManageUsers()) return {ok:false,error:'Sem permissão (só gestão).'};
  const sb=_gSb(); if(!sb) return {ok:false,error:'Backend indisponível.'};
  try{
    const col=/@/.test(String(idOrEmail))?'email':'id';
    const { error }=await sb.from('profiles').update({ativo:!!ativo}).eq(col, idOrEmail);
    if(error) return {ok:false,error:error.message};
    return {ok:true};
  }catch(e){ return {ok:false,error:String((e&&e.message)||e)}; }
}
// Fase 2: convite real via Edge Function invite-user (service_role vive LÁ, nunca aqui).
// A função valida caller gestão, envia o e-mail de convite e grava role/telefone no profile.
async function gInviteUser(email, nome, role, telefone){
  if(!gCanManageUsers()) return {ok:false,error:'Sem permissão (só gestão convida).'};
  const sb=_gSb(); if(!sb) return {ok:false,error:'Backend indisponível.'};
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {ok:false,error:'Digite um e-mail válido.'};
  if(!nome) return {ok:false,error:'Digite o nome do membro.'};
  try{
    const { data, error }=await sb.functions.invoke('invite-user', { body:{ email, nome, role, telefone:telefone||null } });
    if(error){
      // FunctionsHttpError: o corpo tem a mensagem real da função (403/400/500)
      let msg=error.message||'Falha ao convidar.';
      try{ const ctx=await error.context?.json?.(); if(ctx&&ctx.error) msg=ctx.error; }catch(e){}
      return {ok:false,error:msg};
    }
    if(data && data.error) return {ok:false,error:data.error};
    return {ok:true};
  }catch(e){ return {ok:false,error:String((e&&e.message)||e)}; }
}
// Compat: chamadas antigas ao stub continuam respondendo com orientação.
function gAddManagedUser(){
  return {ok:false, error:'Use o convite por e-mail (botão Convidar) — cria a conta e envia o link de acesso.'};
}
// "Remover" na Fase 1 = desativar (exclusão definitiva de auth.users precisa de Edge Function).
async function gRemoveManagedUser(idOrEmail){
  return gSetUserAtivo(idOrEmail, false);
}

// UI HANDLERS DO MODAL (Atrelados ao index.html)

/* A senha já foi aceita: um erro daqui pra frente é de MONTAGEM do app, não de login.
   Sem a guarda, qualquer exceção na abertura da tela deixava o botão desabilitado com
   "Autenticando…" para sempre — a pessoa autenticada presa na porta.
   UMA porta só: o login e a definição de senha entram no app pelo mesmo caminho. */
async function _gEntrarNoApp() {
  try { if(typeof gOnLoginSuccess === 'function') await gOnLoginSuccess(); }
  catch(e){
    console.warn('[Luma] falha ao montar o app depois do login:', e);
    const _l = document.getElementById('g-login-screen');
    if(_l) _l.style.display = 'none';
    if(typeof gToast === 'function') gToast('Entrei, mas parte da tela não carregou. Recarregue a página.', 'error');
  }
}

async function gDoLogin(e) {
  if(e) e.preventDefault();
  const btn = document.getElementById('gl-btn-login');
  const email = document.getElementById('gl-email').value;
  const pass = document.getElementById('gl-pass').value;
  const errEl = document.getElementById('gl-error');

  btn.disabled = true;
  if (btn.querySelector('.gl-btn-text')) {
    btn.querySelector('.gl-btn-text').style.display = 'none';
    btn.querySelector('.gl-spinner').style.display = 'block';
  } else {
    btn.textContent = 'Autenticando...';
  }
  errEl.style.display = 'none';

  const res = await gLogin(email, pass);
  if(res.ok) { try { if(typeof gTrackEvent === 'function') gTrackEvent('login_ok', {metodo:'senha'}); } catch(_) {} }
  if(res.ok && gCurrentUser() && gCurrentUser().senhaInicial) {
    // Entrou com a senha inicial compartilhada: primeiro cria a própria, depois entra.
    gShowNovaSenhaView('inicial');
  } else if(res.ok) {
    await _gEntrarNoApp();
  } else {
    errEl.textContent = res.error;
    errEl.style.display = 'block';
    btn.disabled = false;
    if (btn.querySelector('.gl-btn-text')) {
      btn.querySelector('.gl-btn-text').style.display = 'block';
      btn.querySelector('.gl-spinner').style.display = 'none';
    } else {
      btn.textContent = 'Entrar';
    }
  }
}

function gShowForgotView() {
  document.getElementById('gl-step-login').style.display = 'none';
  document.getElementById('gl-step-forgot').style.display = 'flex';
  document.getElementById('gl-error').style.display = 'none';
}

function gShowLoginView() {
  document.getElementById('gl-step-forgot').style.display = 'none';
  document.getElementById('gl-step-login').style.display = 'flex';
  gResetPassToggle();   // voltar da recuperação não pode devolver a senha à mostra
  document.getElementById('gf-error').style.display = 'none';
  document.getElementById('gf-success').style.display = 'none';

  const btn = document.getElementById('gf-btn');
  btn.style.display = 'flex';
  btn.disabled = false;
  if (btn.querySelector('.gl-btn-text')) {
    btn.querySelector('.gl-btn-text').style.display = 'block';
    btn.querySelector('.gl-spinner').style.display = 'none';
  } else {
    btn.textContent = 'Enviar link de recuperação';
  }
}

async function gDoForgot(e) {
  if(e) e.preventDefault();
  const btn = document.getElementById('gf-btn');
  const email = document.getElementById('gf-email').value;
  const errEl = document.getElementById('gf-error');
  const succEl = document.getElementById('gf-success');

  btn.disabled = true;
  if (btn.querySelector('.gl-btn-text')) {
    btn.querySelector('.gl-btn-text').style.display = 'none';
    btn.querySelector('.gl-spinner').style.display = 'block';
  } else {
    btn.textContent = 'Enviando...';
  }

  errEl.style.display = 'none';
  succEl.style.display = 'none';

  const res = await gForgotPassword(email);
  if (res.ok) {
    // O Supabase responde "ok" até para e-mail sem conta (não revela quem existe): a frase
    // não promete entrega, e o spam é onde o e-mail automático costuma cair.
    succEl.textContent = 'Pronto! Se esse e-mail tiver acesso ao Luma, o link chega em alguns minutos. Olhe também a caixa de spam.';
    succEl.style.display = 'block';
    btn.style.display = 'none';
  } else {
    errEl.textContent = res.error;
    errEl.style.display = 'block';
    btn.disabled = false;
    if (btn.querySelector('.gl-btn-text')) {
      btn.querySelector('.gl-btn-text').style.display = 'block';
      btn.querySelector('.gl-spinner').style.display = 'none';
    } else {
      btn.textContent = 'Enviar link de recuperação';
    }
  }
}

/* ══ PASSO 3 — DEFINIR A SENHA (chegada do link de e-mail) ════════════════════════════
   Mão única de propósito: quem chega aqui está autenticado por um link e NÃO tem senha
   utilizável. Oferecer "voltar ao login" seria devolver a pessoa à porta que não abre. */
function gShowNovaSenhaView(tipo) {
  document.getElementById('gl-step-login').style.display = 'none';
  document.getElementById('gl-step-forgot').style.display = 'none';
  document.getElementById('gl-step-senha').style.display = 'flex';
  const sub = document.getElementById('gs-sub');
  if (sub) sub.textContent = (tipo === 'invite')
    ? 'Seu acesso está criado. Defina a senha que você vai usar daqui pra frente.'
    : (tipo === 'inicial')
      ? 'Você entrou com a senha inicial, que é igual para todos. Crie a sua para continuar — ela passa a valer em qualquer aparelho.'
      : 'Escolha uma nova senha. Ela passa a valer em qualquer aparelho.';
  const inp = document.getElementById('gs-pass');
  if (inp) { try { inp.focus(); } catch(e){} }
}

// Recado na tela de login (link vencido, sessão que não materializou).
function gLoginAviso(msg) {
  const errEl = document.getElementById('gl-error');
  if (!errEl) return;
  errEl.textContent = msg;
  errEl.style.display = 'block';
}

async function gDoNovaSenha(e) {
  if(e) e.preventDefault();
  const nova = document.getElementById('gs-pass').value;
  const conf = document.getElementById('gs-pass2').value;
  const errEl = document.getElementById('gs-error');
  const btn = document.getElementById('gs-btn');
  const falha = (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; };
  errEl.style.display = 'none';

  // Mesmo piso do Perfil › Segurança (user-profile.js): uma régua só para a senha.
  if (nova.length < 8) return falha('A senha deve ter no mínimo 8 caracteres.');
  if (nova !== conf) return falha('As senhas não coincidem.');

  btn.disabled = true;
  btn.querySelector('.gl-btn-text').style.display = 'none';
  btn.querySelector('.gl-spinner').style.display = 'block';

  // gResetPassword é o motor único de troca de senha (o mesmo do Perfil › Segurança).
  const res = await gResetPassword(nova);

  if (res && res.ok) {
    gNovaSenhaResolvida();
    if (gAuthState.user) gAuthState.user.senhaInicial = false;
    if (typeof gToast === 'function') gToast('Senha definida. Agora ela vale em qualquer aparelho.');
    await _gEntrarNoApp();
    return;
  }

  btn.disabled = false;
  btn.querySelector('.gl-btn-text').style.display = 'block';
  btn.querySelector('.gl-spinner').style.display = 'none';
  // Sessão de recuperação vencida enquanto a pessoa digitava: o erro do Supabase é cru
  // e em inglês. Diz o que fazer, em vez de mostrar "Auth session missing!".
  const msg = String((res && res.error) || '');
  falha(/session|jwt|expired|token/i.test(msg)
    ? 'A sessão do link expirou. Peça um novo em "Esqueci minha senha".'
    : (msg || 'Não consegui salvar a senha. Tente de novo.'));
}

/* ══ O OLHO DA SENHA — um estado só, derivado do input ═════════════════════════════════════
   Reproduzido: o defeito não era o toggle "às vezes falhar", era o ÍCONE NUNCA MUDAR. O SVG
   do `index.html` é um olho aberto, fixo; metade do tempo ele contradizia o campo. Somado a
   isso, o estado morava em DOIS lugares — esta função virava o `type`, e um `onclick` inline
   de 4 comandos calculava por conta própria o `aria-pressed` e o `aria-label` a partir do
   valor lido ANTES da troca. Dois donos do mesmo estado é onde a dessincronização mora.

   Terceiro caminho, o mais chato de achar: o login e o "esqueci minha senha" são a MESMA
   árvore, só escondida com `display`. Revelar a senha, ir para a recuperação e voltar
   devolvia o campo em `text` — senha à mostra, com o olho dizendo o que sempre disse.

   Agora há UMA função que muda o `type` e UMA que PINTA a partir do `type` real. O ícone, o
   `aria-pressed` e o `aria-label` são sempre derivados — nunca calculados em paralelo. */
const _G_OLHO_ABERTO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const _G_OLHO_CORTADO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

// PINTA a partir da verdade (input.type). Idempotente: chamar duas vezes não muda nada.
function gSyncPassToggle() {
  const inp = document.getElementById('gl-pass');
  const btn = document.querySelector('.gl-eye');
  if (!inp || !btn) return;
  const visivel = inp.type === 'text';
  btn.innerHTML = visivel ? _G_OLHO_CORTADO : _G_OLHO_ABERTO;
  btn.setAttribute('aria-pressed', visivel ? 'true' : 'false');
  btn.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
  btn.setAttribute('title', visivel ? 'Ocultar senha' : 'Mostrar senha');
}

function gTogglePass() {
  const inp = document.getElementById('gl-pass');
  if (!inp) return;
  const foco = document.activeElement === inp;
  const pos = foco ? inp.selectionStart : null;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  // Trocar o `type` no Chrome/Safari joga o cursor para o fim e às vezes tira o foco: quem
  // estava no meio da senha perdia o lugar. Devolve os dois quando o campo estava em foco.
  if (foco) { try { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); } catch(e){} }
  gSyncPassToggle();
}

/* A senha volta a ficar escondida sempre que a tela de login (re)aparece — inclusive na volta
   da recuperação. Esconder é o estado seguro por padrão; deixar revelada é decisão de quem
   está na frente do computador, e ela não sobrevive a uma troca de tela. */
function gResetPassToggle() {
  const inp = document.getElementById('gl-pass');
  if (inp) inp.type = 'password';
  gSyncPassToggle();
}

function gUpdateUserTopbar() {
  const user = gCurrentUser();
  const roleEl = document.getElementById('topbar-user-role');
  const avEl = document.getElementById('topbar-user-av');
  const nameEl = document.getElementById('topbar-user-name');

  const displayName = user ? user.displayName : 'Usuário';
  const role = user ? user.role : 'franqueado';
  const email = user ? user.email : '';

  if (nameEl) nameEl.textContent = displayName;

  if (roleEl) {
    const labels = { gestao:'GESTÃO', equipe_dm:'EQUIPE DM', franqueado:'FRANQUEADO' };
    roleEl.textContent = labels[role] || String(role||'').toUpperCase();
    // Cores sempre do brandbook (tokens de 00-tokens.css) — nada de hex solto.
    if (role === 'gestao') {
      roleEl.style.background = 'var(--dm-red)';
      roleEl.style.color = 'var(--white)';
    } else if (role === 'equipe_dm') {
      roleEl.style.background = 'var(--dm-yellow)';
      roleEl.style.color = 'var(--dm-red)';
    } else {
      roleEl.style.background = 'rgba(255,255,255,0.2)';
      roleEl.style.color = 'var(--white)';
    }
  }

  if (avEl) {
    // Safari/Firefox com storage bloqueado LANÇAM aqui (não devolvem null) — sem o try
    // o avatar derrubava o resto do cabeçalho (nome, role) junto.
    let savedPhoto = null;
    try{ savedPhoto = localStorage.getItem('__luma_user_photo_' + email); }catch(e){}
    if (savedPhoto) {
      avEl.innerHTML = `<img src="${gEsc(savedPhoto)}" alt="${gEsc(displayName)}">`;
      avEl.style.background = 'transparent';
    } else {
      const names = displayName.trim().split(/\s+/);
      const initials = names.length > 1
        ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
        : names[0].substring(0, 2).toUpperCase();
      avEl.textContent = initials;

      // Sem foto → avatar branco com iniciais em laranja escuro (identidade da
      // marca sobre a barra laranja; cores de fora da paleta destoavam).
      // ⚠ A COR SAIU DAQUI (revisão mobile 2026-09-06). `--dm-orange-d` puro sobre o disco
      // branco dá 3,35:1 — medido — e isto é texto de 10px, onde a régua é 4,5:1. O tom
      // corrigido vive em `.top-av` (`css/components/topbar.css`), onde cor é decidida nesta
      // casa. Enquanto estava aqui como `style=` inline, ele VENCIA a folha e qualquer ajuste
      // no CSS era inerte — foi assim que o defeito sobreviveu.
      // O `background` fica: ele desfaz o `transparent` do ramo com foto, não é escolha de cor.
      avEl.style.background = 'var(--white)';
    }
  }

  if (typeof fSyncThemeIcon === 'function') {
    fSyncThemeIcon(document.body.classList.contains('theme-light') ? 'light' : 'dark');
  }
}
