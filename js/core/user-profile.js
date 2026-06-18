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

  // Carregar dados adicionais ou preencher defaults
  const phone = localStorage.getItem('__luma_user_phone_' + email) || '(55) 99123-4567';
  const theme = document.body.classList.contains('theme-light') || document.body.classList.contains('p-light-theme') ? 'light' : 'dark';

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
  if (sidebarRole) sidebarRole.textContent = role.toUpperCase();

  // Resetar abas
  gProfileSwitchTab('dados');

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
    btn.classList.toggle('active', btn.id === `prof-nav-${tabName}`);
  });

  // Ajustar panes de conteúdo
  document.querySelectorAll('.prof-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `prof-pane-${tabName}`);
  });

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
      el.innerHTML = `<img src="${savedPhoto}" alt="${displayName}">`;
      el.style.background = 'transparent';
    } else {
      // Iniciais do usuário
      const names = displayName.trim().split(/\s+/);
      const initials = names.length > 1 
        ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
        : names[0].substring(0, 2).toUpperCase();
      el.innerHTML = initials;
      
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
    if (typeof gToast === 'function') {
      gToast('⚠️ A foto deve ser menor do que 1MB.');
    } else {
      alert('A foto deve ser menor do que 1MB.');
    }
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
function gProfileSaveData(event) {
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
  // Para a aba Designer e Franqueado (que compartilham a classe body.theme-light):
  document.body.classList.toggle('theme-light', theme === 'light');
  if (typeof dTheme !== 'undefined') dTheme = theme;
  fSyncThemeIcon(theme);

  // Sincronizar ícones do Designer se existirem
  const designDarkIcon = document.getElementById('theme-icon-dark');
  const designLightIcon = document.getElementById('theme-icon-light');
  if (designDarkIcon) designDarkIcon.style.display = theme === 'dark' ? '' : 'none';
  if (designLightIcon) designLightIcon.style.display = theme === 'light' ? '' : 'none';

  // Para a aba Dados:
  const v = document.getElementById('view-dados');
  if (v) {
    v.classList.toggle('p-light', theme === 'light');
    document.body.classList.toggle('p-light-theme', theme === 'light');
    if (typeof pSyncThemeBtn === 'function') pSyncThemeBtn();
  }
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

// Simula alteração de senha
function gProfileChangePassword(event) {
  if (event) event.preventDefault();

  const currentPass = document.getElementById('prof-input-password-current').value;
  const newPass = document.getElementById('prof-input-password-new').value;
  const confirmPass = document.getElementById('prof-input-password-confirm').value;

  if (newPass.length < 8) {
    if (typeof gToast === 'function') gToast('⚠️ A nova senha deve ter no mínimo 8 caracteres.');
    return;
  }

  if (newPass !== confirmPass) {
    if (typeof gToast === 'function') gToast('⚠️ As senhas não coincidem.');
    return;
  }

  const btn = document.getElementById('prof-btn-save-password');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="prof-spinner"></span> Atualizando...`;

  setTimeout(() => {
    // Resetar campos
    document.getElementById('prof-form-seguranca').reset();
    gProfileCheckPasswordStrength('');

    // Restaurar botão
    btn.disabled = false;
    btn.innerHTML = originalHTML;

    if (typeof gToast === 'function') gToast('🔐 Senha redefinida com sucesso!');
    gCloseUserProfileModal();
  }, 700);
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
    if (role === 'admin') {
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

