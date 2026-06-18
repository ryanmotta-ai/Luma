/**
 * js/core/auth.js
 * 
 * AUTH CLIENT-SIDE — gate de experiência, não segurança. Qualquer DevTools burla isso.
 * A função gForgotPassword e gResetPassword têm assinatura definitiva para plugar no
 * backend Supabase (P5.1) sem reescrita. Veja comentários FUTURO: em cada função.
 */

const AUTH_USERS = [
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

let gAuthState = { user: null, sessionToken: null };

try {
  const cached = sessionStorage.getItem('__luma_session');
  if (cached) gAuthState = JSON.parse(cached);
} catch (e) {}

async function gHashPassword(plain) {
  const msgUint8 = new TextEncoder().encode(plain);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function gLogin(email, password) {
  if (!email || !password) return { ok: false, error: 'E-mail e senha são obrigatórios.' };
  
  const user = AUTH_USERS.find(u => u.email === email.trim().toLowerCase());
  if (!user) return { ok: false, error: 'E-mail incorreto ou não cadastrado.' };
  
  const hash = await gHashPassword(password);
  if (hash !== user.hash) return { ok: false, error: 'Senha incorreta.' };
  
  gAuthState = {
    user: { email: user.email, role: user.role, displayName: user.displayName },
    sessionToken: 'tk_' + Date.now()
  };
  sessionStorage.setItem('__luma_session', JSON.stringify(gAuthState));
  
  return { ok: true };
}

function gLogout() {
  gAuthState = { user: null, sessionToken: null };
  sessionStorage.removeItem('__luma_session');
  location.reload();
}

function gCurrentUser() { return gAuthState.user; }
function gCurrentRole() { return gAuthState.user ? gAuthState.user.role : null; }
function gIsAdmin() { return gCurrentRole() === 'admin'; }

async function gForgotPassword(email) {
  if (!email) return { ok: false, error: 'Digite seu e-mail.' };
  const user = AUTH_USERS.find(u => u.email === email.trim().toLowerCase());
  if (!user) return { ok: false, error: 'E-mail não cadastrado.' };
  
  // FUTURO: await supabase.auth.resetPasswordForEmail(email)
  const token = crypto.randomUUID ? crypto.randomUUID() : 'simulated-uuid-token';
  const expires = Date.now() + 15 * 60 * 1000; 
  localStorage.setItem('__luma_reset_token', JSON.stringify({ email: user.email, token, expires }));
  
  console.log(`[AUTH] Email de recuperação seria enviado para <${user.email}>`);
  return { ok: true };
}

async function gResetPassword(token, newPassword) {
  // FUTURO: await supabase.auth.updateUser({ password: newPassword })
  try {
    const data = JSON.parse(localStorage.getItem('__luma_reset_token'));
    if (!data || data.token !== token) return { ok: false, error: 'Token inválido.' };
    if (Date.now() > data.expires) return { ok: false, error: 'Token expirado.' };
    
    const user = AUTH_USERS.find(u => u.email === data.email);
    if (user) user.hash = await gHashPassword(newPassword);
    
    localStorage.removeItem('__luma_reset_token');
    return { ok: true };
  } catch(e) {
    return { ok: false, error: 'Falha ao processar o token.' };
  }
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
  
  // Fake delay to show spinner/loading realistically
  await new Promise(r => setTimeout(r, 600));

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
  
  await new Promise(r => setTimeout(r, 600));
  
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
