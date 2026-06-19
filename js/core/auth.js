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
 * OBS: a gestão de usuários (gGetAllUsers/gSetUserRole/...) ainda é MOCK
 * (localStorage + AUTH_USERS). Migrar pra Supabase Admin (Edge Function) é trabalho futuro.
 */

const AUTH_USERS = [
  { email: 'ryan.motta@deliverymuch.com.br', hash: '847c6bd10efb303516b1248b6b1b9246b66fd9ad460731716d7e31855e8112cb', role: 'superadmin', displayName: 'Ryan Motta' },
  { email: 'pedro.moraes@deliverymuch.com.br', hash: '847c6bd10efb303516b1248b6b1b9246b66fd9ad460731716d7e31855e8112cb', role: 'admin', displayName: 'Pedro Moraes' },
  { email: 'laura.ferrari@deliverymuch.com.br', hash: '847c6bd10efb303516b1248b6b1b9246b66fd9ad460731716d7e31855e8112cb', role: 'admin', displayName: 'Laura Ferrari' },
  { email: 'ricardo.moreira@deliverymuch.com.br', hash: '847c6bd10efb303516b1248b6b1b9246b66fd9ad460731716d7e31855e8112cb', role: 'admin', displayName: 'Ricardo Moreira' },
  { email: 'vanessa.rosa@deliverymuch.com.br', hash: '847c6bd10efb303516b1248b6b1b9246b66fd9ad460731716d7e31855e8112cb', role: 'admin', displayName: 'Vanessa Rosa' },
  { email: 'ana.almeida@deliverymuch.com.br', hash: '847c6bd10efb303516b1248b6b1b9246b66fd9ad460731716d7e31855e8112cb', role: 'admin', displayName: 'Ana Almeida' },
  { email: 'joviane.santos@deliverymuch.com.br', hash: '847c6bd10efb303516b1248b6b1b9246b66fd9ad460731716d7e31855e8112cb', role: 'admin', displayName: 'Joviane Santos' },
  { email: 'marco.severo@deliverymuch.com.br', hash: '847c6bd10efb303516b1248b6b1b9246b66fd9ad460731716d7e31855e8112cb', role: 'admin', displayName: 'Marco Severo' },
  { email: 'brenda.santos@deliverymuch.com.br', hash: '847c6bd10efb303516b1248b6b1b9246b66fd9ad460731716d7e31855e8112cb', role: 'admin', displayName: 'Brenda Santos' },
  { email: 'pedro@deliverymuch.com.br', hash: '847c6bd10efb303516b1248b6b1b9246b66fd9ad460731716d7e31855e8112cb', role: 'admin', displayName: 'Pedro' },
  { email: 'guilherme@deliverymuch.com.br', hash: '847c6bd10efb303516b1248b6b1b9246b66fd9ad460731716d7e31855e8112cb', role: 'admin', displayName: 'Guilherme' }
];

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

function gLoadRoleOverrides(){ try{return JSON.parse(localStorage.getItem('luma_role_overrides')||'{}');}catch(e){return{};} }
function gSaveRoleOverrides(obj){ try{localStorage.setItem('luma_role_overrides',JSON.stringify(obj));}catch(e){} }
function gLoadManagedUsers(){ try{return JSON.parse(localStorage.getItem('luma_managed_users')||'[]');}catch(e){return[];} }
function gSaveManagedUsers(arr){ try{localStorage.setItem('luma_managed_users',JSON.stringify(arr));}catch(e){} }

function gGetAllUsers(){
  const overrides=gLoadRoleOverrides();
  const managed=gLoadManagedUsers();
  const base=AUTH_USERS.map(u=>({email:u.email,displayName:u.displayName,role:overrides[u.email]||u.role,isBase:true}));
  const extra=managed.filter(m=>!base.find(b=>b.email===m.email));
  return [...base,...extra.map(m=>({...m,isBase:false}))];
}

function gSetUserRole(email,newRole){
  if(!gCanManageUsers()) return {ok:false,error:'Sem permissão.'};
  const target=gGetAllUsers().find(u=>u.email===email);
  if(!target) return {ok:false,error:'Usuário não encontrado.'};
  if(target.role==='superadmin'&&gCurrentUser().email!==email) return {ok:false,error:'Não é possível alterar outro superadmin.'};
  const base=AUTH_USERS.find(u=>u.email===email);
  if(base){
    const ov=gLoadRoleOverrides();
    if(newRole===base.role) delete ov[email]; else ov[email]=newRole;
    gSaveRoleOverrides(ov);
  } else {
    const mg=gLoadManagedUsers(); const i=mg.findIndex(u=>u.email===email);
    if(i>=0){mg[i].role=newRole;gSaveManagedUsers(mg);}
  }
  return {ok:true};
}

function gAddManagedUser(email,displayName,role){
  if(!gCanManageUsers()) return {ok:false,error:'Sem permissão.'};
  if(!email||!displayName) return {ok:false,error:'E-mail e nome são obrigatórios.'};
  if(gGetAllUsers().find(u=>u.email===email.toLowerCase().trim())) return {ok:false,error:'Usuário já existe.'};
  const mg=gLoadManagedUsers();
  mg.push({email:email.toLowerCase().trim(),displayName:displayName.trim(),role:role||'admin',addedAt:Date.now(),isBase:false});
  gSaveManagedUsers(mg);
  return {ok:true};
}

function gRemoveManagedUser(email){
  if(!gCanManageUsers()) return {ok:false,error:'Sem permissão.'};
  if(AUTH_USERS.find(u=>u.email===email)) return {ok:false,error:'Usuários base não podem ser removidos.'};
  const mg=gLoadManagedUsers(); const i=mg.findIndex(u=>u.email===email);
  if(i<0) return {ok:false,error:'Usuário não encontrado.'};
  mg.splice(i,1); gSaveManagedUsers(mg);
  return {ok:true};
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
    if (role === 'gestao') {
      roleEl.style.background = '#7c3aed';
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
      avEl.innerHTML = `<img src="${savedPhoto}" alt="${displayName}">`;
      avEl.style.background = 'transparent';
    } else {
      const names = displayName.trim().split(/\s+/);
      const initials = names.length > 1
        ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
        : names[0].substring(0, 2).toUpperCase();
      avEl.innerHTML = initials;

      const hash = Array.from(displayName).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const colors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0284c7'];
      avEl.style.background = colors[hash % colors.length];
      avEl.style.color = '#fff';
    }
  }

  if (typeof fSyncThemeIcon === 'function') {
    fSyncThemeIcon(document.body.classList.contains('theme-light') ? 'light' : 'dark');
  }
}
