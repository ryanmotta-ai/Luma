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
  if (sidebarRole) {
    if(role==='gestao'||role==='superadmin'){sidebarRole.style.background='#7c3aed';sidebarRole.style.color='#fff';sidebarRole.textContent= role==='gestao'?'GESTÃO':'SUPER ADMIN';}
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
  } else if (tabName === 'equipe') {
    if (title) title.textContent = 'Gerenciar Equipe';
    if (subtitle) subtitle.textContent = 'Adicione membros e gerencie as permissões de acesso.';
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

const _EQUIPE_ROLE_CFG={
  gestao:    {label:'Gestão',     emoji:'👑',bg:'rgba(124,58,237,.1)',color:'#7c3aed',desc:'Gestão completa da plataforma'},
  equipe_dm: {label:'Equipe DM',  emoji:'⚙️',bg:'rgba(255,185,0,.14)',color:'#C81818',desc:'Acesso ao estúdio de design'},
  franqueado:{label:'Franqueado', emoji:'🏪',bg:'rgba(255,144,0,.1)', color:'#F85400',desc:'Acesso ao chat e geração de artes'},
};

const _ICO_TRASH=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const _ICO_CHEVRON=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const _ICO_CHECK=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function _profAvBg(name){
  const colors=['#e11d48','#2563eb','#16a34a','#d97706','#7c3aed','#db2777','#0284c7'];
  const h=Array.from(name).reduce((a,c)=>a+c.charCodeAt(0),0);
  return colors[h%colors.length];
}
function _profInitials(name){
  const p=name.trim().split(/\s+/);
  return p.length>1?(p[0][0]+p[p.length-1][0]).toUpperCase():name.substring(0,2).toUpperCase();
}

async function gProfileRenderEquipe(){
  // limpa pickers que foram movidos para o body via portal
  document.querySelectorAll('body>.prof-role-picker').forEach(p=>p.remove());
  const pane=document.getElementById('prof-pane-equipe'); if(!pane)return;
  const users=await gGetAllUsers();
  const me=gCurrentUser();

  const rows=users.map((u,idx)=>{
    const isMe=u.email===me.email;
    const photo=localStorage.getItem('__luma_user_photo_'+u.email);
    const avBg=photo?'transparent':_profAvBg(u.displayName);
    const avContent=photo
      ?`<img src="${photo}" alt="${u.displayName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      :_profInitials(u.displayName);
    const canEdit=!isMe&&gRoleLevel(me.role)>gRoleLevel(u.role);
    const rcfg=_EQUIPE_ROLE_CFG[u.role]||_EQUIPE_ROLE_CFG.franqueado;
    const pid='prof-rp-'+idx;

    const pill=`<button class="prof-role-pill" data-role="${u.role}" ${canEdit?`onclick="gProfileToggleRolePicker('${u.email}','${pid}',this,event)"`:'disabled'} title="${rcfg.desc}">
      <span class="prof-role-dot"></span>${rcfg.label}${canEdit?_ICO_CHEVRON:''}
    </button>`;

    const pickerOpts=['franqueado','equipe_dm','gestao']
      .filter(r=>gRoleLevel(r)<gRoleLevel(me.role))
      .map(r=>{
        const rc=_EQUIPE_ROLE_CFG[r];
        const cur=r===u.role;
        return `<button class="prof-role-picker-opt${cur?' is-current':''}" onclick="gProfilePickRole('${u.email}','${r}','${pid}',event)">
          <span class="prof-role-picker-opt-ico" style="background:${rc.bg};color:${rc.color}">${rc.emoji}</span>
          <span class="prof-role-picker-opt-text">
            <span class="prof-role-picker-opt-label">${rc.label}</span>
            <span class="prof-role-picker-opt-desc">${rc.desc}</span>
          </span>
          ${cur?`<span class="prof-role-picker-check">${_ICO_CHECK}</span>`:''}
        </button>`;
      }).join('');
    const picker=canEdit?`<div class="prof-role-picker" id="${pid}">${pickerOpts}</div>`:'';

    const invitedTag=!u.isBase?`<span class="prof-user-tag invited">convidado</span>`:'';
    const youTag=isMe?`<span class="prof-user-you">(você)</span>`:'';
    const removeBtn=!u.isBase&&!isMe&&canEdit
      ?`<button class="prof-user-remove" onclick="gProfileRemoveUser('${u.email}')" title="Remover acesso">${_ICO_TRASH}</button>`:'';

    return `<div class="prof-user-row${isMe?' is-me':''}">
      <div class="prof-user-av" style="background:${avBg}">${avContent}</div>
      <div class="prof-user-info">
        <div class="prof-user-name">${u.displayName}${youTag}${invitedTag}</div>
        <div class="prof-user-email">${u.email}</div>
      </div>
      ${pill}${picker}
      ${removeBtn}
    </div>`;
  }).join('');

  pane.innerHTML=`
    <div class="prof-equipe-toolbar">
      <div class="prof-equipe-search-wrap">
        <span class="prof-equipe-search-ico"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <input class="prof-equipe-search" placeholder="Buscar membro…" oninput="gProfileFilterEquipe(this.value)">
      </div>
      <button class="prof-invite-btn" onclick="gProfileShowInviteForm()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Convidar
      </button>
    </div>
    <div id="prof-invite-form" style="display:none"></div>
    <div class="prof-equipe-count">${users.length} membro${users.length!==1?'s':''}</div>
    <div class="prof-user-list" id="prof-user-list">${rows}</div>`;
}

function gProfileShowInviteForm(){
  const form=document.getElementById('prof-invite-form'); if(!form)return;
  if(form.style.display!=='none'){form.style.display='none';return;}
  const meRole=gCurrentUser().role;
  const roleOpts=['franqueado','equipe_dm']
    .filter(r=>gRoleLevel(r)<gRoleLevel(meRole))
    .map(r=>{const rc=_EQUIPE_ROLE_CFG[r];return `<option value="${r}"${r==='equipe_dm'?' selected':''}>${rc.emoji} ${rc.label}</option>`;}).join('');
  form.innerHTML=`<div class="prof-invite-box">
    <div class="prof-invite-title">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
      Novo membro
    </div>
    <div class="prof-grid prof-grid-2" style="gap:10px">
      <div class="prof-field"><label class="prof-label">Nome completo</label><input class="prof-input" id="prof-inv-name" placeholder="Ex: João Silva"></div>
      <div class="prof-field"><label class="prof-label">E-mail</label><input class="prof-input" id="prof-inv-email" type="email" placeholder="joao@deliverymuch.com.br"></div>
      <div class="prof-field"><label class="prof-label">Permissão</label><select class="prof-input" id="prof-inv-role">${roleOpts}</select></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="prof-btn prof-btn-primary" style="font-size:12px;padding:8px 16px" onclick="gProfileInviteUser()">Adicionar membro</button>
      <button class="prof-btn prof-btn-secondary" style="font-size:12px;padding:8px 16px" onclick="document.getElementById('prof-invite-form').style.display='none'">Cancelar</button>
    </div>
  </div>`;
  form.style.display='block';
  document.getElementById('prof-inv-name')?.focus();
}

function gProfileInviteUser(){
  const name=document.getElementById('prof-inv-name')?.value.trim();
  const email=document.getElementById('prof-inv-email')?.value.trim();
  const role=document.getElementById('prof-inv-role')?.value;
  const res=gAddManagedUser(email,name,role);
  if(!res.ok){gToast('⚠️ '+res.error);return;}
  gToast('✅ Membro adicionado!');
  gProfileRenderEquipe();
}

function gProfileToggleRolePicker(email,pid,btn,ev){
  if(ev) ev.stopPropagation();
  // fecha outros pickers abertos
  document.querySelectorAll('.prof-role-picker.open').forEach(p=>{if(p.id!==pid)p.classList.remove('open');});
  const picker=document.getElementById(pid); if(!picker)return;
  if(picker.classList.contains('open')){picker.classList.remove('open');return;}
  // portal: move para body para escapar do overflow:hidden + transform do modal
  if(picker.parentElement!==document.body) document.body.appendChild(picker);
  const rect=btn.getBoundingClientRect();
  picker.style.top=(rect.bottom+4)+'px';
  picker.style.right=(window.innerWidth-rect.right)+'px';
  picker.style.left='auto';
  picker.classList.add('open');
}

async function gProfilePickRole(email,newRole,pid,ev){
  if(ev) ev.stopPropagation();
  document.getElementById(pid)?.classList.remove('open');
  const res=await gSetUserRole(email,newRole);
  if(!res.ok){gToast('⚠️ '+res.error);return;}
  gToast('✅ Permissão atualizada!');
  gProfileRenderEquipe();
}

function gProfileFilterEquipe(query){
  const q=query.toLowerCase();
  document.querySelectorAll('#prof-user-list .prof-user-row').forEach(row=>{
    const name=row.querySelector('.prof-user-name')?.textContent.toLowerCase()||'';
    const email=row.querySelector('.prof-user-email')?.textContent.toLowerCase()||'';
    row.style.display=(!q||name.includes(q)||email.includes(q))?'':'none';
  });
}

async function gProfileSetUserRole(email,newRole){
  const res=await gSetUserRole(email,newRole);
  if(!res.ok){gToast('⚠️ '+res.error);gProfileRenderEquipe();return;}
  gToast('✅ Permissão atualizada!');
}

async function gProfileRemoveUser(email){
  if(!confirm('Desativar o acesso de '+email+'? Ele não conseguirá mais usar o app. (A exclusão definitiva é feita no painel do Supabase.)')) return;
  const res=await gRemoveManagedUser(email);
  if(!res.ok){gToast('⚠️ '+res.error);return;}
  gToast('✅ Usuário desativado.');
  gProfileRenderEquipe();
}

// Fecha role picker ao clicar fora do painel
document.addEventListener('click',function(e){
  if(!e.target.closest('.prof-role-pill')&&!e.target.closest('.prof-role-picker')){
    document.querySelectorAll('.prof-role-picker.open').forEach(p=>p.classList.remove('open'));
  }
});

