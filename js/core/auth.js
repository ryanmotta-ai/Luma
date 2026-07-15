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

// Carrega a sessão atual do Supabase + o profile (role) do banco. Idempotente.
async function gLoadProfile() {
  const sb = _gSb();
  if (!sb) { gAuthState = { user: null }; return null; }
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { gAuthState = { user: null }; return null; }
    const { data: prof } = await sb
      .from('profiles')
      .select('role, nome, departamento')
      .eq('id', user.id)
      .maybeSingle();
    gAuthState = { user: {
      id: user.id,
      email: user.email,
      role: (prof && prof.role) || 'franqueado',
      displayName: (prof && prof.nome) || (user.email || '').split('@')[0],
      departamento: (prof && prof.departamento) || null,
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
  const { error } = await sb.auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password
  });
  if (error) {
    const msg = /invalid login|invalid_credentials/i.test(error.message || '')
      ? 'E-mail ou senha incorretos.'
      : (error.message || 'Falha no login.');
    return { ok: false, error: msg };
  }
  await gLoadProfile();
  return { ok: true };
}

async function gLogout() {
  const sb = _gSb();
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
  const { error } = await sb.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), { redirectTo });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Roda sobre a sessão de recovery materializada pelo supabase-js ao abrir o link do e-mail.
async function gResetPassword(newPassword) {
  const sb = _gSb();
  if (!sb) return { ok: false, error: 'Backend indisponível.' };
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
      departamento:p.departamento||null, ativo:p.ativo!==false, isBase:true }));
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
// Criar usuário pelo app exige Edge Function (service_role) — Fase 2. Por ora, orienta o painel.
function gAddManagedUser(){
  return {ok:false, error:'Para criar usuário: painel do Supabase → Authentication → Users → Add user (marque Auto Confirm). A criação pelo app vem na próxima fase.'};
}
// "Remover" na Fase 1 = desativar (exclusão definitiva de auth.users precisa de Edge Function).
async function gRemoveManagedUser(idOrEmail){
  return gSetUserAtivo(idOrEmail, false);
}

// UI HANDLERS DO MODAL (Atrelados ao index.html)
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
  if(res.ok) {
    if(typeof gOnLoginSuccess === 'function') gOnLoginSuccess();
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
    succEl.textContent = 'Link enviado! Verifique seu e-mail.';
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

function gTogglePass() {
  const inp = document.getElementById('gl-pass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
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
      roleEl.style.color = '#fff';
    } else if (role === 'equipe_dm') {
      roleEl.style.background = 'var(--dm-yellow)';
      roleEl.style.color = 'var(--dm-red)';
    } else {
      roleEl.style.background = 'rgba(255,255,255,0.2)';
      roleEl.style.color = 'var(--white)';
    }
  }

  if (avEl) {
    const savedPhoto = localStorage.getItem('__luma_user_photo_' + email);
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
      avEl.style.background = 'var(--white)';
      avEl.style.color = 'var(--dm-orange-d)';
    }
  }

  if (typeof fSyncThemeIcon === 'function') {
    fSyncThemeIcon(document.body.classList.contains('theme-light') ? 'light' : 'dark');
  }
}
