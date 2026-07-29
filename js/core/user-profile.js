/**
 * js/core/user-profile.js
 *
 * Controladores do Modal e Configurações de Perfil do Usuário.
 * Suporta edição de perfil, troca de avatar via Base64 persistente,
 * validação de senha e monitoramento de tempo de sessão.
 */

// Tempo de início da sessão para as estatísticas
const gSessionStartTime = Date.now();

// Abre o Modal do Perfil de Usuário e inicializa os campos
function gOpenUserProfileModal() {
  const modal = document.getElementById('g-profile-modal');
  if (!modal) return;

  const user = gCurrentUser();
  const displayName = user ? user.displayName : 'Ryan';
  const email = user ? user.email : 'ryan@deliverymuch.com.br';
  const role = user ? user.role : 'admin';

  // Telefone: banco (profiles.telefone, via gLoadProfile) > cache local antigo > vazio.
  // (O default fake '(55) 99123-4567' era resto de mock — sumiu.)
  const phone = (user && user.telefone) || localStorage.getItem('__luma_user_phone_' + email) || '';
  const theme = document.body.classList.contains('theme-light') ? 'light' : 'dark';

  // Preencher formulário de dados pessoais
  const inputName = document.getElementById('prof-input-name');
  const inputEmail = document.getElementById('prof-input-email');
  const inputPhone = document.getElementById('prof-input-phone');
  const inputTheme = document.getElementById('prof-input-theme');

  if (inputName) inputName.value = displayName;
  if (inputEmail) inputEmail.value = email;
  if (inputPhone) inputPhone.value = phone;
  if (inputTheme) inputTheme.value = theme;

  // Sidebar do Modal
  const sidebarName = document.getElementById('prof-sidebar-name');
  const sidebarRole = document.getElementById('prof-sidebar-role');
  if (sidebarName) sidebarName.textContent = displayName;
  if (sidebarRole) {
    if(role==='gestao'||role==='superadmin'){sidebarRole.style.background='var(--dm-red)';sidebarRole.style.color='#fff';sidebarRole.textContent= role==='gestao'?'GESTÃO':'SUPER ADMIN';}
    else if(role==='equipe_dm'||role==='admin'){sidebarRole.style.background='var(--dm-yellow)';sidebarRole.style.color='var(--dm-red)';sidebarRole.textContent= role==='equipe_dm'?'EQUIPE DM':'ADMIN';}
    else{sidebarRole.style.background='rgba(255,144,0,.15)';sidebarRole.style.color='var(--dm-orange-d)';sidebarRole.textContent='FRANQUEADO';}
  }

  // Resetar abas
  gProfileSwitchTab('dados');

  // Mostrar aba Equipe apenas para superadmin
  const equipeBtn = document.getElementById('prof-nav-equipe');
  if(equipeBtn) equipeBtn.style.display = gIsSuperAdmin() ? '' : 'none';

  // Atualizar avatares do modal
  gProfileUpdateModalAvatars(displayName, email);

  // Inicializar estatísticas reais
  gProfileRenderStats(role);

  // Abrir modal
  modal.classList.add('open');
}

// Fecha o Modal
function gCloseUserProfileModal() {
  const modal = document.getElementById('g-profile-modal');
  if (modal) {
    modal.classList.remove('open');
  }
}

// Alterna entre as abas do painel
function gProfileSwitchTab(tabName) {
  // Ajustar botões da navegação lateral
  document.querySelectorAll('.prof-nav-btn').forEach(btn => {
    const isActive = btn.id === `prof-nav-${tabName}`;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  // Ajustar panes de conteúdo
  document.querySelectorAll('.prof-pane').forEach(pane => {
    const isActive = pane.id === `prof-pane-${tabName}`;
    pane.classList.toggle('active', isActive);
    pane.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });

  // Reforça a mudança de contexto sem atrasar a navegação.
  const content = document.querySelector('#g-profile-modal .prof-content');
  if (content && document.getElementById('g-profile-modal')?.classList.contains('open')) {
    content.classList.remove('prof-tab-changing');
    void content.offsetWidth;
    content.classList.add('prof-tab-changing');
    clearTimeout(gProfileSwitchTab._motionTimer);
    gProfileSwitchTab._motionTimer = setTimeout(() => content.classList.remove('prof-tab-changing'), 320);
  }

  // Atualizar título e subtítulo do header do modal
  const title = document.getElementById('prof-modal-title');
  const subtitle = document.getElementById('prof-modal-subtitle');

  if (tabName === 'dados') {
    if (title) title.textContent = 'Dados Pessoais';
    if (subtitle) subtitle.textContent = 'Gerencie suas informações básicas de exibição.';
  } else if (tabName === 'seguranca') {
    if (title) title.textContent = 'Segurança da Conta';
    if (subtitle) subtitle.textContent = 'Altere sua senha de acesso e monitore a segurança.';
  } else if (tabName === 'estatisticas') {
    if (title) title.textContent = 'Minhas Estatísticas';
    if (subtitle) subtitle.textContent = 'Resumo da sua atividade nesta sessão e portfólio no Luma.';

    // Atualizar tempo de sessão dinamicamente ao abrir a aba
    const elapsedMinutes = Math.floor((Date.now() - gSessionStartTime) / 60000);
    const sessionEl = document.getElementById('prof-stat-session-time');
    if (sessionEl) sessionEl.textContent = `${elapsedMinutes} min`;
  } else if (tabName === 'equipe') {
    if (title) title.textContent = 'Gestão de equipe';
    if (subtitle) subtitle.textContent = 'Convide pessoas e mantenha cada acesso no nível certo.';
    gProfileRenderEquipe();
  }
}

// Atualiza os avatares contidos dentro do modal (sidebar e editor)
function gProfileUpdateModalAvatars(displayName, email) {
  const sidebarAv = document.getElementById('prof-sidebar-avatar');
  const editorAv = document.getElementById('prof-avatar-editor-img');
  const savedPhoto = localStorage.getItem('__luma_user_photo_' + email);

  [sidebarAv, editorAv].forEach(el => {
    if (!el) return;

    if (savedPhoto) {
      el.innerHTML = `<img src="${gEsc(savedPhoto)}" alt="${gEsc(displayName)}">`;
      el.style.background = 'transparent';
    } else {
      // Iniciais do usuário
      const names = displayName.trim().split(/\s+/);
      const initials = names.length > 1 
        ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
        : names[0].substring(0, 2).toUpperCase();
      el.textContent = initials;
      
      // Cor baseada no hash do nome
      const hash = Array.from(displayName).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const colors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0284c7'];
      el.style.background = colors[hash % colors.length];
      el.style.color = '#fff';
    }
  });
}

// Dispara o input de upload de arquivo oculto
function gProfileTriggerUpload() {
  const fileInput = document.getElementById('prof-avatar-input');
  if (fileInput) fileInput.click();
}

// Lida com o upload e conversão da imagem para Base64
function gProfileHandleUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  // Validação simples de tamanho (máximo 1MB para localStorage)
  if (file.size > 1024 * 1024) {
    // Feedback é SEMPRE gToast (regra da casa). O alert() daqui era fallback morto —
    // toast.js carrega antes deste arquivo, então gToast nunca falta. Erro diz o que fazer.
    gToast('⚠ Foto acima de 1MB — escolha uma imagem menor.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Image = e.target.result;
    const user = gCurrentUser();
    const email = user ? user.email : 'ryan@deliverymuch.com.br';

    // Salvar no localStorage
    localStorage.setItem('__luma_user_photo_' + email, base64Image);

    // Atualizar visual da Topbar e do Modal instantaneamente
    if (typeof gUpdateUserTopbar === 'function') gUpdateUserTopbar();
    gProfileUpdateModalAvatars(user ? user.displayName : 'Ryan', email);
    
    if (typeof gToast === 'function') gToast('📸 Foto de perfil atualizada!');
  };
  reader.readAsDataURL(file);
}

// Salva as alterações de dados pessoais
async function gProfileSaveData(event) {
  if (event) event.preventDefault();

  const nameVal = document.getElementById('prof-input-name').value.trim();
  const emailVal = document.getElementById('prof-input-email').value.trim();
  const phoneVal = document.getElementById('prof-input-phone').value.trim();
  const themeVal = document.getElementById('prof-input-theme').value;

  if (!nameVal || !emailVal) return;

  const btn = document.getElementById('prof-btn-save-dados');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="prof-spinner"></span> Salvando...`;

  // Persiste nome/telefone no BANCO (profiles) — RLS "usuario atualiza próprio perfil".
  // Antes só ia pra localStorage: telefone/nome novos sumiam em outro device.
  // (E-mail fica fora: trocar e-mail é fluxo de auth com confirmação, não um UPDATE.)
  try {
    const me = gCurrentUser();
    const sb = (typeof gSupabase==='function') ? gSupabase() : window.sb;
    if (me && me.id && sb) {
      const { error } = await sb.from('profiles')
        .update({ nome: nameVal, telefone: phoneVal || null })
        .eq('id', me.id);
      if (error) {
        btn.disabled = false; btn.innerHTML = originalHTML;
        gToast('⚠️ Não salvou no servidor: ' + error.message, 'error');
        return;
      }
      if (typeof gAuthState !== 'undefined' && gAuthState.user) gAuthState.user.telefone = phoneVal;
    }
  } catch(e) {
    btn.disabled = false; btn.innerHTML = originalHTML;
    gToast('⚠️ Não salvou no servidor. Verifique a conexão.', 'error');
    return;
  }

  setTimeout(() => {
    // Atualizar no sessionStorage o estado de autenticação ativo do Luma
    try {
      const cached = sessionStorage.getItem('__luma_session');
      if (cached) {
        const sessionData = JSON.parse(cached);
        if (sessionData.user) {
          sessionData.user.displayName = nameVal;
          sessionData.user.email = emailVal;
          sessionStorage.setItem('__luma_session', JSON.stringify(sessionData));
          
          // Re-sincronizar dados globais se definidos
          if (typeof gAuthState !== 'undefined') {
            gAuthState.user.displayName = nameVal;
            gAuthState.user.email = emailVal;
          }
        }
      }
    } catch(e) {
      console.error('Falha ao atualizar sessão no sessionStorage', e);
    }

    // Persistir telefone e preferências adicionais
    localStorage.setItem('__luma_user_phone_' + emailVal, phoneVal);

    // Aplicar e salvar tema
    gProfileApplyTheme(themeVal);

    // Atualizar Topbar e Modal com novas informações
    if (typeof gUpdateUserTopbar === 'function') gUpdateUserTopbar();
    
    // Sincronizar nome no cabeçalho do modal e avatares
    const sidebarName = document.getElementById('prof-sidebar-name');
    if (sidebarName) sidebarName.textContent = nameVal;
    gProfileUpdateModalAvatars(nameVal, emailVal);

    // Restaurar botão
    btn.disabled = false;
    btn.innerHTML = originalHTML;

    if (typeof gToast === 'function') gToast('✅ Perfil salvo com sucesso!');
    gCloseUserProfileModal();
  }, 600);
}

// Aplica o tema selecionado
function gProfileApplyTheme(theme) {
  // Persiste: o seletor de tema do perfil dizia "salvo" e não gravava em lugar NENHUM —
  // o tema voltava ao padrão em todo F5. (localStorage = padrão da casa p/ preferência local.)
  try { localStorage.setItem('__luma_theme', theme); } catch(e) {}
  // Transição suave da troca (motion.md §3): liga .theme-anim só durante a troca manual e
  // remove após --dur-base, pra não deixar a transição global grudada no resto da sessão.
  const b = document.body;
  b.classList.add('theme-anim');
  clearTimeout(gProfileApplyTheme._t);
  gProfileApplyTheme._t = setTimeout(() => b.classList.remove('theme-anim'), 280);
  // Para a aba Designer e Franqueado (que compartilham a classe body.theme-light):
  b.classList.toggle('theme-light', theme === 'light');
  if (typeof dTheme !== 'undefined') dTheme = theme;
  fSyncThemeIcon(theme);

  // Sincronizar ícones do Designer se existirem
  const designDarkIcon = document.getElementById('theme-icon-dark');
  const designLightIcon = document.getElementById('theme-icon-light');
  if (designDarkIcon) designDarkIcon.style.display = theme === 'dark' ? '' : 'none';
  if (designLightIcon) designLightIcon.style.display = theme === 'light' ? '' : 'none';
}

// Verifica a força da senha digitada
function gProfileCheckPasswordStrength(password) {
  const seg1 = document.getElementById('pass-seg-1');
  const seg2 = document.getElementById('pass-seg-2');
  const seg3 = document.getElementById('pass-seg-3');
  const label = document.getElementById('pass-strength-text');

  // Reset
  [seg1, seg2, seg3].forEach(el => {
    if (el) el.style.background = '';
  });

  if (!password) {
    if (label) label.textContent = 'Digite uma senha';
    return;
  }

  if (password.length < 8) {
    if (seg1) seg1.style.background = '#ef4444'; // Vermelho
    if (label) label.textContent = 'Senha muito curta (mín. 8 caracteres)';
    return;
  }

  // Verificações
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (hasUpperCase && hasNumber) {
    if (seg1) seg1.style.background = '#22c55e'; // Verde
    if (seg2) seg2.style.background = '#22c55e';
    if (seg3) seg3.style.background = '#22c55e';
    if (label) label.textContent = 'Senha Forte';
  } else if (hasUpperCase || hasNumber) {
    if (seg1) seg1.style.background = '#eab308'; // Amarelo
    if (seg2) seg2.style.background = '#eab308';
    if (label) label.textContent = 'Senha Média (adicione letras maiúsculas e números)';
  } else {
    if (seg1) seg1.style.background = '#f97316'; // Laranja
    if (label) label.textContent = 'Senha Fraca (adicione letras maiúsculas ou números)';
  }
}

// Altera a senha DE VERDADE (Supabase updateUser sobre a sessão ativa) via gResetPassword.
// Nota: o Supabase troca a senha pela sessão logada e não valida a "senha atual" — o campo
// existe por convenção de UX, mas não é verificado aqui (re-autenticar exigiria outro fluxo).
async function gProfileChangePassword(event) {
  if (event) event.preventDefault();

  const newPass = document.getElementById('prof-input-password-new').value;
  const confirmPass = document.getElementById('prof-input-password-confirm').value;

  if (newPass.length < 8) {
    if (typeof gToast === 'function') gToast('⚠ A nova senha deve ter no mínimo 8 caracteres', 'error');
    return;
  }

  if (newPass !== confirmPass) {
    if (typeof gToast === 'function') gToast('⚠ As senhas não coincidem', 'error');
    return;
  }

  if (typeof gResetPassword !== 'function') {
    if (typeof gToast === 'function') gToast('⚠ Não foi possível alterar a senha agora', 'error');
    return;
  }

  const btn = document.getElementById('prof-btn-save-password');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="prof-spinner"></span> Atualizando...`;

  const res = await gResetPassword(newPass);

  btn.disabled = false;
  btn.innerHTML = originalHTML;

  if (res && res.ok) {
    document.getElementById('prof-form-seguranca').reset();
    gProfileCheckPasswordStrength('');
    if (typeof gToast === 'function') gToast('Senha alterada');
    gCloseUserProfileModal();
  } else {
    if (typeof gToast === 'function') gToast('⚠ ' + ((res && res.error) || 'Não foi possível alterar a senha'), 'error');
  }
}

// Renderiza as estatísticas reais na tela
function gProfileRenderStats(role) {
  const templatesVal = document.getElementById('prof-stat-templates');
  const campaignsVal = document.getElementById('prof-stat-campaigns');
  const levelVal = document.getElementById('prof-stat-level');

  // 1. Contagem real de templates criados
  let templateCount = 0;
  let campaignCount = 0;

  if (typeof dFolders !== 'undefined' && dFolders) {
    campaignCount = dFolders.length;
    dFolders.forEach(folder => {
      if (folder.templates) {
        templateCount += folder.templates.length;
      }
    });
  }

  if (templatesVal) templatesVal.textContent = templateCount;
  if (campaignsVal) campaignsVal.textContent = campaignCount;

  // 2. Nível baseado no papel e na quantidade de templates
  if (levelVal) {
    if (role === 'gestao' || role === 'superadmin') {
      levelVal.textContent = 'Dono da Plataforma 👑';
    } else if (role === 'equipe_dm' || role === 'admin') {
      levelVal.textContent = templateCount > 15 ? 'Diretor de Design 👑' : 'Administrador Luma ⚙️';
    } else {
      levelVal.textContent = templateCount > 5 ? 'Designer Avançado ⚡' : 'Franqueado Ativo 🚀';
    }
  }
}

// Alterna o tema a partir da aba do Franqueado
function fToggleTheme() {
  const isLight = document.body.classList.contains('theme-light');
  const targetTheme = isLight ? 'dark' : 'light';
  gProfileApplyTheme(targetTheme);
  
  if (typeof gToast === 'function') {
    gToast(targetTheme === 'light' ? '☀ Tema claro' : '🌙 Tema escuro');
  }
}

// Sincroniza a exibição dos ícones de tema no cabeçalho do Franqueado
function fSyncThemeIcon(theme) {
  const iconDark = document.getElementById('f-theme-icon-dark');
  const iconLight = document.getElementById('f-theme-icon-light');
  if (iconDark) iconDark.style.display = theme === 'dark' ? 'inline-block' : 'none';
  if (iconLight) iconLight.style.display = theme === 'light' ? 'inline-block' : 'none';
}

/* ══ GESTÃO DE EQUIPE ══ */

const _ICO_TRASH=`<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
// Mesmo glifo de "restaurar/refazer" usado no franqueado (chat.js fRefazer) — reaproveita a
// linguagem visual já existente em vez de inventar um ícone novo para o mesmo conceito.
const _ICO_RESTORE=`<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
const _ICO_CHEVRON=`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const _ICO_CHECK=`<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const _ICO_USERS=`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>`;
const _ICO_SHIELD=`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>`;
const _ICO_STORE=`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18"/><path d="M5 10v10h14V10"/><path d="m4 4-1 6a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2l-1-6H4Z"/></svg>`;
const _ICO_SEARCH=`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`;
const _ICO_EMPTY=`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M8.5 11h5"/></svg>`;
const _ICO_CLOSE=`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>`;
const _ICO_ROLE_GESTAO=`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6l-7-3Z"/><path d="M9 12h6M12 9v6"/></svg>`;
const _ICO_ROLE_EQUIPE=`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 7h5M18.5 4.5v5"/></svg>`;
const _ICO_ROLE_FRANQUEADO=`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18"/><path d="M5 10v10h14V10"/><path d="m4 4-1 6a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2l-1-6H4Z"/></svg>`;

const _EQUIPE_ROLE_CFG={
  gestao:    {label:'Gestão',     icon:_ICO_ROLE_GESTAO,     desc:'Acesso total e gestão de usuários'},
  equipe_dm: {label:'Equipe DM',  icon:_ICO_ROLE_EQUIPE,     desc:'Cria e publica materiais no Estúdio'},
  franqueado:{label:'Franqueado', icon:_ICO_ROLE_FRANQUEADO, desc:'Gera artes a partir do catálogo'},
};

function _profAvatarTone(name){
  const h=Array.from(name).reduce((a,c)=>a+c.charCodeAt(0),0);
  return 'prof-user-av-tone-'+(h%3);
}
function _profInitials(name){
  const p=name.trim().split(/\s+/);
  if(!name.trim()) return 'LM';
  return p.length>1?(p[0][0]+p[p.length-1][0]).toUpperCase():name.substring(0,2).toUpperCase();
}

async function gProfileRenderEquipe(){
  // limpa pickers que foram movidos para o body via portal
  document.querySelectorAll('body>.prof-role-picker').forEach(p=>p.remove());
  const pane=document.getElementById('prof-pane-equipe'); if(!pane)return;
  pane.setAttribute('aria-busy','true');
  pane.innerHTML=`<div class="prof-team-loading" role="status" aria-live="polite">
    <span class="prof-team-loading-line prof-team-loading-title"></span>
    <span class="prof-team-loading-line"></span>
    <span class="prof-team-loading-line"></span>
    <span class="prof-team-loading-copy">Carregando equipe…</span>
  </div>`;

  const users=await gGetAllUsers();
  const me=gCurrentUser();
  const orderedUsers=users.slice().sort((a,b)=>{
    const aMe=a.email===me.email, bMe=b.email===me.email;
    if(aMe!==bMe) return aMe?-1:1;
    const aActive=a.ativo!==false, bActive=b.ativo!==false;
    if(aActive!==bActive) return aActive?-1:1;
    const roleDiff=gRoleLevel(b.role)-gRoleLevel(a.role);
    if(roleDiff) return roleDiff;
    return String(a.displayName||a.email).localeCompare(String(b.displayName||b.email),'pt-BR');
  });

  const rows=orderedUsers.map((u,idx)=>{
    const isMe=u.email===me.email;
    const displayName=String(u.displayName||u.email||'Membro');
    let photo='';
    try{photo=localStorage.getItem('__luma_user_photo_'+u.email)||'';}catch(e){}
    const avatarClass=photo?' has-photo':' '+_profAvatarTone(displayName);
    const avContent=photo
      ?`<img src="${gEsc(photo)}" alt="">`
      :gEsc(_profInitials(displayName));
    const canEdit=!isMe&&gRoleLevel(me.role)>gRoleLevel(u.role);
    const rcfg=_EQUIPE_ROLE_CFG[u.role]||_EQUIPE_ROLE_CFG.franqueado;
    const pid='prof-rp-'+idx;
    const triggerId='prof-rb-'+idx;

    // data-email + this.dataset: gEsc dentro de onclick não protege o contexto de string JS
    // (&#39; volta a ser aspa antes do JS rodar) — atributo data é o único caminho seguro.
    const pill=`<button type="button" class="prof-role-pill" id="${triggerId}" data-role="${gEsc(u.role)}" data-email="${gEsc(u.email)}"
      aria-label="Permissão: ${gEsc(rcfg.label)}${canEdit?'. Clique para alterar':''}"
      ${canEdit?`aria-haspopup="menu" aria-expanded="false" aria-controls="${pid}" onclick="gProfileToggleRolePicker(this.dataset.email,'${pid}',this,event)"`:'disabled'}
      title="${gEsc(rcfg.desc)}">
      <span class="prof-role-dot"></span>${rcfg.label}${canEdit?_ICO_CHEVRON:''}
    </button>`;

    const pickerOpts=['franqueado','equipe_dm','gestao']
      .filter(r=>gRoleLevel(r)<gRoleLevel(me.role))
      .map(r=>{
        const rc=_EQUIPE_ROLE_CFG[r];
        const cur=r===u.role;
        const icoHtml=rc.icon?`<span class="prof-role-picker-opt-ico">${rc.icon}</span>`:`<span class="prof-role-picker-opt-ico" style="background:${rc.bg};color:${rc.color}">${rc.emoji}</span>`;
        return `<button type="button" role="menuitemradio" aria-checked="${cur?'true':'false'}"
          class="prof-role-picker-opt prof-role-picker-opt-${r}${cur?' is-current':''}" data-email="${gEsc(u.email)}"
          ${cur?'disabled aria-disabled="true"':`onclick="gProfilePickRole(this.dataset.email,'${r}','${pid}',event)"`}>
          ${icoHtml}
          <span class="prof-role-picker-opt-text">
            <span class="prof-role-picker-opt-label">${rc.label}</span>
            <span class="prof-role-picker-opt-desc">${rc.desc}</span>
          </span>
          ${cur?`<span class="prof-role-picker-check">${_ICO_CHECK}</span>`:''}
        </button>`;
      }).join('');
    const picker=canEdit?`<div class="prof-role-picker" id="${pid}" role="menu" aria-label="Alterar permissão de ${gEsc(displayName)}" data-trigger-id="${triggerId}" onkeydown="gProfileRolePickerKeydown(event,'${pid}')">${pickerOpts}</div>`:'';

    // BUG corrigido: isBase vinha sempre true de gGetAllUsers (só há usuários reais hoje,
    // não existe mais o mock local que a flag distinguia) — então "!u.isBase" nunca era
    // verdadeiro e o botão de ação nunca aparecia para ninguém. Removido o campo morto;
    // o que importa de verdade é ativo/inativo (§2: gestão administra usuários).
    const isInactive = u.ativo === false;
    const status=`<span class="prof-user-status ${isInactive?'is-inactive':'is-active'}"><i></i>${isInactive?'Inativo':'Ativo'}</span>`;
    const youTag=isMe?`<span class="prof-user-you">Você</span>`:'';
    // Reativar (ativo:false→true) completa o ciclo: antes, desativar era beco sem volta
    // pela UI (só existia gSetUserAtivo(id,true) no backend, sem caminho na tela).
    const actionBtn = (!isMe && canEdit)
      ? (isInactive
          ? `<button type="button" class="prof-user-action prof-user-restore" data-email="${gEsc(u.email)}" onclick="gProfileReactivateUser(this.dataset.email||'${gEsc(u.email)}')" aria-label="Reativar acesso de ${gEsc(displayName)}" title="Reativar acesso">${_ICO_RESTORE}</button>`
          : `<button type="button" class="prof-user-action" data-email="${gEsc(u.email)}" onclick="gProfileRemoveUser(this.dataset.email||'${gEsc(u.email)}')" aria-label="Desativar acesso de ${gEsc(displayName)}" title="Desativar acesso">${_ICO_TRASH}</button>`)
      : '<span class="prof-user-action-placeholder" aria-hidden="true"></span>';

    return `<li class="prof-user-row${isMe?' is-me':''}${isInactive?' is-inactive':''}" data-status="${isInactive?'inactive':'active'}">
      <div class="prof-user-identity">
        <div class="prof-user-av${avatarClass}" aria-hidden="true">${avContent}</div>
        <div class="prof-user-info">
          <div class="prof-user-name">${gEsc(displayName)}${youTag}</div>
          <div class="prof-user-email">${gEsc(u.email)}</div>
        </div>
      </div>
      <div class="prof-user-access">${pill}${picker}</div>
      <div class="prof-user-status-cell">${status}</div>
      <div class="prof-user-actions">${actionBtn}</div>
    </li>`;
  }).join('');

  const activeCount=users.filter(u=>u.ativo!==false).length;
  const inactiveCount=users.length-activeCount;
  const internalCount=users.filter(u=>u.role==='equipe_dm'||u.role==='gestao').length;
  const franchiseCount=users.filter(u=>u.role==='franqueado').length;

  pane.innerHTML=`
    <section class="prof-team-overview" aria-labelledby="prof-team-overview-title">
      <div class="prof-team-overview-copy">
        <span class="prof-team-overview-icon">${_ICO_USERS}</span>
        <div>
          <span class="prof-team-kicker">Acessos da plataforma</span>
          <h4 id="prof-team-overview-title">Sua equipe em um só lugar</h4>
          <p>Convide pessoas, revise permissões e mantenha os acessos organizados.</p>
        </div>
      </div>
      <button type="button" class="prof-invite-btn" onclick="gProfileShowInviteForm()" aria-controls="prof-invite-form" aria-expanded="false">
        ${_ICO_USERS}<span>Convidar membro</span>
      </button>
    </section>

    <div class="prof-team-metrics" aria-label="Resumo da equipe">
      <div class="prof-team-metric">
        <span class="prof-team-metric-icon prof-team-metric-icon-active">${_ICO_USERS}</span>
        <span><strong>${activeCount}</strong><small>Acessos ativos</small></span>
      </div>
      <div class="prof-team-metric">
        <span class="prof-team-metric-icon">${_ICO_SHIELD}</span>
        <span><strong>${internalCount}</strong><small>Equipe interna</small></span>
      </div>
      <div class="prof-team-metric">
        <span class="prof-team-metric-icon">${_ICO_STORE}</span>
        <span><strong>${franchiseCount}</strong><small>Franqueados</small></span>
      </div>
    </div>

    <div id="prof-invite-form" hidden></div>

    <div class="prof-equipe-tools">
      <div class="prof-equipe-search-wrap">
        <span class="prof-equipe-search-ico">${_ICO_SEARCH}</span>
        <input type="search" class="prof-equipe-search" id="prof-equipe-search" placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar membros por nome ou e-mail" aria-describedby="prof-equipe-result-count"
          autocomplete="off" oninput="gProfileFilterEquipe(this.value)">
      </div>
      <div class="prof-equipe-filters" role="group" aria-label="Filtrar membros por status">
        <button type="button" class="prof-equipe-filter is-active" data-filter="all" aria-pressed="true" onclick="gProfileSetEquipeFilter('all',this)">Todos <span>${users.length}</span></button>
        <button type="button" class="prof-equipe-filter" data-filter="active" aria-pressed="false" onclick="gProfileSetEquipeFilter('active',this)">Ativos <span>${activeCount}</span></button>
        <button type="button" class="prof-equipe-filter" data-filter="inactive" aria-pressed="false" onclick="gProfileSetEquipeFilter('inactive',this)">Inativos <span>${inactiveCount}</span></button>
      </div>
    </div>

    <section class="prof-members-surface" aria-labelledby="prof-members-title">
      <div class="prof-members-titlebar">
        <div>
          <h4 id="prof-members-title">Membros</h4>
          <p id="prof-equipe-result-count" role="status" aria-live="polite">${users.length} membro${users.length!==1?'s':''}</p>
        </div>
        <span class="prof-members-safe">${_ICO_SHIELD} Permissões protegidas pelo servidor</span>
      </div>
      <div class="prof-user-list-head" aria-hidden="true">
        <span>Membro</span><span>Acesso</span><span>Status</span><span>Ações</span>
      </div>
      <ul class="prof-user-list" id="prof-user-list">${rows}</ul>
      <div class="prof-team-empty" id="prof-team-empty" hidden>
        <span>${_ICO_EMPTY}</span>
        <strong>Nenhum membro encontrado</strong>
        <p>Ajuste a busca ou limpe os filtros para ver a equipe.</p>
        <button type="button" class="prof-btn prof-btn-secondary" onclick="gProfileClearEquipeFilters()">Limpar filtros</button>
      </div>
    </section>`;
  pane.dataset.filter='all';
  pane.dataset.query='';
  pane.setAttribute('aria-busy','false');
}

function gProfileShowInviteForm(){
  const form=document.getElementById('prof-invite-form'); if(!form)return;
  if(!form.hidden){gProfileHideInviteForm();return;}
  const meRole=gCurrentUser().role;
  const roleOpts=['franqueado','equipe_dm']
    .filter(r=>gRoleLevel(r)<gRoleLevel(meRole))
    .map(r=>{const rc=_EQUIPE_ROLE_CFG[r];return `<option value="${r}"${r==='equipe_dm'?' selected':''}>${rc.label}</option>`;}).join('');
  form.innerHTML=`<form class="prof-invite-box" onsubmit="gProfileInviteUser(event)" aria-labelledby="prof-invite-title">
    <div class="prof-invite-head">
      <span class="prof-invite-head-icon">${_ICO_USERS}</span>
      <div>
        <span class="prof-team-kicker">Novo acesso</span>
        <h4 id="prof-invite-title">Convidar membro</h4>
        <p>O convite chega por e-mail e o acesso já nasce com a permissão escolhida.</p>
      </div>
      <button type="button" class="prof-invite-close" onclick="gProfileHideInviteForm()" aria-label="Fechar formulário de convite">${_ICO_CLOSE}</button>
    </div>
    <div class="prof-invite-grid">
      <div class="prof-field"><label class="prof-label" for="prof-inv-name">Nome completo</label><input class="prof-input" id="prof-inv-name" name="name" autocomplete="name" placeholder="Ex.: João Silva" required></div>
      <div class="prof-field"><label class="prof-label" for="prof-inv-email">E-mail</label><input class="prof-input" id="prof-inv-email" name="email" type="email" autocomplete="email" placeholder="joao@deliverymuch.com.br" required></div>
      <div class="prof-field"><label class="prof-label" for="prof-inv-tel">Telefone <span class="prof-field-optional">Opcional</span></label><input class="prof-input" id="prof-inv-tel" name="tel" type="tel" autocomplete="tel" placeholder="(48) 99999-9999"></div>
      <div class="prof-field"><label class="prof-label" for="prof-inv-role">Permissão inicial</label><select class="prof-input" id="prof-inv-role" name="role">${roleOpts}</select></div>
    </div>
    <div class="prof-invite-actions">
      <button type="button" class="prof-btn prof-btn-secondary" onclick="gProfileHideInviteForm()">Cancelar</button>
      <button type="submit" class="prof-btn prof-btn-primary" id="prof-inv-btn">${_ICO_USERS}<span>Enviar convite</span></button>
    </div>
  </form>`;
  form.hidden=false;
  document.querySelector('.prof-invite-btn')?.setAttribute('aria-expanded','true');
  document.getElementById('prof-inv-name')?.focus();
}

function gProfileHideInviteForm(){
  const form=document.getElementById('prof-invite-form');
  if(form){form.hidden=true;form.innerHTML='';}
  const trigger=document.querySelector('.prof-invite-btn');
  if(trigger){trigger.setAttribute('aria-expanded','false');trigger.focus();}
}

async function gProfileInviteUser(event){
  if(event)event.preventDefault();
  const name=document.getElementById('prof-inv-name')?.value.trim();
  const email=document.getElementById('prof-inv-email')?.value.trim();
  const tel=document.getElementById('prof-inv-tel')?.value.trim();
  const role=document.getElementById('prof-inv-role')?.value;
  const btn=document.getElementById('prof-inv-btn');
  const originalHTML=btn?btn.innerHTML:'';
  if(btn){btn.disabled=true;btn.innerHTML='<span class="prof-spinner" aria-hidden="true"></span><span>Enviando convite…</span>';}
  const res=await gInviteUser(email,name,role,tel);
  if(btn){btn.disabled=false;btn.innerHTML=originalHTML;}
  if(!res.ok){gToast('Não foi possível enviar o convite: '+res.error,'error');return;}
  gToast('Convite enviado para '+email);
  const form=document.getElementById('prof-invite-form'); if(form){form.hidden=true;form.innerHTML='';}
  gProfileRenderEquipe(); // o profile já existe (trigger) — aparece na lista na hora
}

function gProfileCloseRolePickers(exceptId){
  document.querySelectorAll('.prof-role-picker.open').forEach(picker=>{
    if(exceptId&&picker.id===exceptId)return;
    picker.classList.remove('open');
    picker.style.visibility='';
    const trigger=document.getElementById(picker.dataset.triggerId||'');
    if(trigger)trigger.setAttribute('aria-expanded','false');
  });
}

function gProfileToggleRolePicker(email,pid,btn,ev){
  if(ev) ev.stopPropagation();
  const picker=document.getElementById(pid); if(!picker)return;
  if(picker.classList.contains('open')){
    gProfileCloseRolePickers();
    btn.focus();
    return;
  }
  gProfileCloseRolePickers(pid);
  // portal: move para body para escapar do overflow:hidden + transform do modal
  if(picker.parentElement!==document.body) document.body.appendChild(picker);
  const rect=btn.getBoundingClientRect();
  picker.style.visibility='hidden';
  picker.classList.add('open');
  const pickerRect=picker.getBoundingClientRect();
  const below=rect.bottom+6;
  const top=below+pickerRect.height<=window.innerHeight-12
    ?below
    :Math.max(12,rect.top-pickerRect.height-6);
  picker.style.top=top+'px';
  picker.style.right=Math.max(12,window.innerWidth-rect.right)+'px';
  picker.style.left='auto';
  picker.style.visibility='';
  btn.setAttribute('aria-expanded','true');
  const firstOption=picker.querySelector('.prof-role-picker-opt:not([disabled])');
  if(firstOption)firstOption.focus();
}

function gProfileRolePickerKeydown(event,pid){
  const picker=document.getElementById(pid); if(!picker)return;
  const options=Array.from(picker.querySelectorAll('.prof-role-picker-opt:not([disabled])'));
  const trigger=document.getElementById(picker.dataset.triggerId||'');
  if(event.key==='Escape'){
    event.preventDefault();
    gProfileCloseRolePickers();
    if(trigger)trigger.focus();
    return;
  }
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)||!options.length)return;
  event.preventDefault();
  const current=options.indexOf(document.activeElement);
  let next=0;
  if(event.key==='End')next=options.length-1;
  else if(event.key==='ArrowUp')next=current<=0?options.length-1:current-1;
  else if(event.key==='ArrowDown')next=current<0||current===options.length-1?0:current+1;
  options[next].focus();
}

async function gProfilePickRole(email,newRole,pid,ev){
  if(ev) ev.stopPropagation();
  gProfileCloseRolePickers();
  // Mudar o papel de alguém não tinha NENHUMA confirmação — um clique já promovia/
  // rebaixava na hora. §2/§3: papel é a hierarquia de permissão de sistema, não é
  // detalhe trivial. gConfirm (não confirm() nativo) é o canal já usado na casa.
  const rc=_EQUIPE_ROLE_CFG[newRole];
  const rotulo=rc?rc.label:newRole;
  const msg = newRole==='gestao'
    ? `Dar acesso total de Gestão para ${email}? Isso inclui administrar todos os usuários.`
    : `Mudar a permissão de ${email} para "${rotulo}"?`;
  const ok = await gConfirm(msg, {okLabel:'Confirmar', danger:newRole==='gestao'});
  if(!ok) return;
  const res=await gSetUserRole(email,newRole);
  if(!res.ok){gToast('Não foi possível atualizar a permissão: '+res.error,'error');return;}
  gToast('Permissão atualizada');
  gProfileRenderEquipe();
}

function gProfileFilterEquipe(query){
  const pane=document.getElementById('prof-pane-equipe'); if(!pane)return;
  const q=String(query||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const filter=pane.dataset.filter||'all';
  pane.dataset.query=q;
  let visible=0;
  const rows=document.querySelectorAll('#prof-user-list .prof-user-row');
  rows.forEach(row=>{
    const text=(row.textContent||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const matchesQuery=!q||text.includes(q);
    const matchesStatus=filter==='all'||row.dataset.status===filter;
    row.hidden=!(matchesQuery&&matchesStatus);
    if(!row.hidden)visible++;
  });
  const count=document.getElementById('prof-equipe-result-count');
  if(count)count.textContent=(q||filter!=='all')
    ?`${visible} de ${rows.length} membros`
    :`${rows.length} membro${rows.length!==1?'s':''}`;
  const empty=document.getElementById('prof-team-empty');
  if(empty)empty.hidden=visible!==0;
}

// (gProfileSetUserRole removida na auditoria 16/07: duplicata sem chamador de
//  gProfilePickRole — e trocava role SEM confirmação. O fluxo real é o picker.)
function gProfileSetEquipeFilter(filter,button){
  const pane=document.getElementById('prof-pane-equipe'); if(!pane)return;
  if(!['all','active','inactive'].includes(filter))filter='all';
  pane.dataset.filter=filter;
  document.querySelectorAll('.prof-equipe-filter').forEach(btn=>{
    const active=btn===button||btn.dataset.filter===filter;
    btn.classList.toggle('is-active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
  });
  gProfileFilterEquipe(document.getElementById('prof-equipe-search')?.value||'');
}

function gProfileClearEquipeFilters(){
  const input=document.getElementById('prof-equipe-search');
  if(input)input.value='';
  const allBtn=document.querySelector('.prof-equipe-filter[data-filter="all"]');
  gProfileSetEquipeFilter('all',allBtn);
  if(input)input.focus();
}

async function gProfileRemoveUser(email){
  // confirm() nativo → gConfirm (01_BUSINESS §10 / 03_ENGINEERING: gToast/gConfirm são os
  // únicos canais de feedback e confirmação; confirm() nativo espalhado é proibido).
  const ok = await gConfirm('Desativar o acesso de '+email+'? Ele não conseguirá mais usar o app. (A exclusão definitiva é feita no painel do Supabase.)', {okLabel:'Desativar', danger:true});
  if(!ok) return;
  const res=await gRemoveManagedUser(email);
  if(!res.ok){gToast('Não foi possível desativar o usuário: '+res.error,'error');return;}
  gToast('Usuário desativado');
  gProfileRenderEquipe();
}

// Fecha o ciclo desativar↔reativar: gSetUserAtivo(id,true) já existia no backend, mas
// não havia caminho na UI para acioná-lo — desativar era, na prática, definitivo.
async function gProfileReactivateUser(email){
  const ok = await gConfirm('Reativar o acesso de '+email+'? Ele volta a conseguir usar o app.', {okLabel:'Reativar'});
  if(!ok) return;
  const res=await gSetUserAtivo(email, true);
  if(!res.ok){gToast('Não foi possível reativar o usuário: '+res.error,'error');return;}
  gToast('Usuário reativado');
  gProfileRenderEquipe();
}

// Fecha role picker ao clicar fora do painel
document.addEventListener('click',function(e){
  if(!e.target.closest('.prof-role-pill')&&!e.target.closest('.prof-role-picker')){
    gProfileCloseRolePickers();
  }
});

