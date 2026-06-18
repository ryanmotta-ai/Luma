/**
 * js/core/help-chat.js
 *
 * Componente do Widget de Ajuda e Suporte com Chatbot Integrado.
 * Implementa fluxos dinâmicos para franqueados, designers e suporte humano.
 */

(function () {
  let isOpen = false;
  let supportMode = false;

  const G_CHAT_FLOW = {
    start: {
      text: "Olá! Sou o assistente virtual do Luma. Estou aqui para ajudar você a criar suas artes de forma simples e rápida ou a configurar seus templates no Estúdio.<br><br>Qual é o seu perfil hoje?",
      options: [
        { id: "fran", text: "👤 Sou Franqueado (Quero gerar artes)" },
        { id: "design", text: "🎨 Sou Designer (Quero criar templates)" },
        { id: "info", text: "ℹ️ Outras Dúvidas / Sobre o Luma" },
        { id: "support", text: "💬 Falar com o Suporte Humano" }
      ]
    },
    // Fluxo Franqueado
    fran: {
      text: "Entendido! Como franqueado, você tem acesso às campanhas e materiais liberados para criar e baixar suas artes. Qual é a sua dúvida?",
      options: [
        { id: "fran_pdf", text: "📄 Como baixar minhas artes em PDF?" },
        { id: "fran_csv", text: "📊 Como gerar artes em lote (CSV)?" },
        { id: "fran_cors", text: "📷 Minhas fotos não carregam no upload" },
        { id: "fran_hist", text: "🕒 Onde vejo minhas artes anteriores?" },
        { id: "start", text: "← Voltar ao menu principal" }
      ]
    },
    fran_pdf: {
      text: "Para baixar suas artes em PDF, finalize o preenchimento do material no chat guiado. Na tela final (de confirmação de download), clique no botão vermelho **'Baixar PDF'** ao lado do botão de PNG. O PDF será gerado instantaneamente no seu navegador contendo a arte renderizada em tamanho real.",
      options: [
        { id: "fran", text: "← Voltar para dúvidas de Franqueado" },
        { id: "start", text: "← Voltar ao menu principal" }
      ]
    },
    fran_csv: {
      text: "No card de confirmação final do chat, clique em **'Criar em Lote (CSV)'** para abrir o modal. Lá, clique em **'Baixar Modelo CSV'** para obter uma planilha pré-configurada com as colunas corretas. Preencha os dados no Excel/Google Sheets, salve em formato CSV (UTF-8), faça o upload no modal e clique em **'Baixar todos'** para baixar todas as artes em lote de uma vez.",
      options: [
        { id: "fran", text: "← Voltar para dúvidas de Franqueado" },
        { id: "start", text: "← Voltar ao menu principal" }
      ]
    },
    fran_cors: {
      text: "Se suas fotos não carregam ao informar URLs no CSV, certifique-se de que a imagem está em um servidor público e com CORS habilitado (acesso aberto para outros sites). Caso faça upload manual no chat, o tamanho máximo é de **4MB** e são aceitos formatos PNG, JPG e WebP. Se a foto for muito grande, o Luma aplicará uma redução de alta nitidez automática para você.",
      options: [
        { id: "fran", text: "← Voltar para dúvidas de Franqueado" },
        { id: "start", text: "← Voltar ao menu principal" }
      ]
    },
    fran_hist: {
      text: "No painel lateral esquerdo (abaixo do catálogo de campanhas), selecione a aba **'Minhas Artes'**. Ali você verá o histórico das últimas 50 artes criadas (tanto rascunhos quanto concluídas). Você pode rebaixá-las, reabrir para edição ou duplicá-las em outro formato de forma instantânea.",
      options: [
        { id: "fran", text: "← Voltar para dúvidas de Franqueado" },
        { id: "start", text: "← Voltar ao menu principal" }
      ]
    },
    // Fluxo Designer
    design: {
      text: "Olá, Designer! No Estúdio Luma, você pode criar pranchetas, pintar no canvas, definir variáveis e regras antes de publicar. Qual é o seu foco de ajuda?",
      options: [
        { id: "design_vars", text: "🏷️ O que são Variáveis e como usá-las?" },
        { id: "design_rules", text: "⛓️ Como funcionam as Regras e Vínculos?" },
        { id: "design_imports", text: "📥 Como importar arquivos PSD ou SVG?" },
        { id: "design_pub", text: "🚀 Como publicar meu template para os franqueados?" },
        { id: "start", text: "← Voltar ao menu principal" }
      ]
    },
    design_vars: {
      text: "Variáveis permitem que os franqueados personalizem textos e imagens. Crie variáveis envolvendo palavras com duas chaves, ex: `{{produto}}` ou `{{precoPor}}`. O Luma identificará esses tokens automaticamente e gerará as perguntas no chatbot do franqueado. Você também pode definir tipos ricos como Cores, Datas e Selects no painel lateral.",
      options: [
        { id: "design", text: "← Voltar para dúvidas de Designer" },
        { id: "start", text: "← Voltar ao menu principal" }
      ]
    },
    design_rules: {
      text: "Regras condicionais alteram propriedades de camadas com base em variáveis. Por exemplo, você pode ocultar um preço original se ele estiver vazio (`when: 'empty', then: 'hide'`) ou encolher o tamanho da fonte (`shrinkFont`) caso o texto do produto seja muito grande. Os vínculos aplicam essas mudanças dinamicamente no motor do canvas.",
      options: [
        { id: "design", text: "← Voltar para dúvidas de Designer" },
        { id: "start", text: "← Voltar ao menu principal" }
      ]
    },
    design_imports: {
      text: "Você pode importar layouts prontos do Photoshop (.psd) ou Illustrator (.svg) expandindo a aba da sua campanha no painel lateral direito e clicando em **'Importar PSD'** ou **'Importar SVG'**. O sistema converterá as camadas de texto, formas e imagens em layers do Luma, sugerindo variáveis a partir dos nomes das camadas.",
      options: [
        { id: "design", text: "← Voltar para dúvidas de Designer" },
        { id: "start", text: "← Voltar ao menu principal" }
      ]
    },
    design_pub: {
      text: "Quando terminar sua arte, clique no botão **'Publicar'** no topo direito. O modal exibirá abas para selecionar as pranchetas do template, escolher a pasta de destino (campanha), definir o prazo de expiração (validade) e configurar limites de caracteres/permissões de edição para cada variável antes de liberar para a rede.",
      options: [
        { id: "design", text: "← Voltar para dúvidas de Designer" },
        { id: "start", text: "← Voltar ao menu principal" }
      ]
    },
    // Outras Dúvidas
    info: {
      text: "O Luma é uma plataforma de Creative Automation desenvolvida para a Delivery Much, centralizando o design institucional (Estúdio) e dando autonomia para os franqueados gerarem suas próprias artes.<br><br>Para ver demonstrações interativas passo a passo, acesse a **Central de Ajuda** clicando no botão de interrogação `?` no cabeçalho global.",
      options: [
        { id: "start", text: "← Voltar ao menu principal" }
      ]
    },
    // Suporte Humano
    support: {
      text: "Sem problemas! Estou conectando você com a equipe de suporte humano da Delivery Much.<br><br>Por favor, **digite sua mensagem na caixa de texto abaixo** e envie para darmos início ao atendimento:",
      options: []
    }
  };

  function gInitHelpChat() {
    // Evita inicialização dupla
    if (document.getElementById('g-chat-btn')) return;

    // Injeta botão flutuante
    const btn = document.createElement('button');
    btn.id = 'g-chat-btn';
    btn.className = 'g-chat-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Abrir chat de ajuda');
    btn.innerHTML = `<svg class="g-chat-btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#ffffff"/><path d="M9 10c1 1.5 3 1.5 4 0" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;
    btn.onclick = gToggleHelpChat;
    document.body.appendChild(btn);

    // Injeta janela de chat
    const win = document.createElement('div');
    win.id = 'g-chat-window';
    win.className = 'g-chat-window';
    win.innerHTML = `
      <div class="g-chat-header">
        <div class="g-chat-header-info">
          <div class="g-chat-avatar">LM</div>
          <div class="g-chat-header-text">
            <span class="g-chat-title">Suporte Luma</span>
            <span class="g-chat-status">Online agora</span>
          </div>
        </div>
        <button class="g-chat-close" onclick="gToggleHelpChat()" aria-label="Fechar chat">&times;</button>
      </div>
      <div class="g-chat-body" id="g-chat-body"></div>
      <div class="g-chat-footer">
        <input type="text" id="g-chat-input" class="g-chat-input-box" placeholder="Escolha uma opção..." disabled aria-label="Mensagem para o suporte">
        <button id="g-chat-send" class="g-chat-send-btn" disabled aria-label="Enviar mensagem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    `;
    document.body.appendChild(win);

    // Eventos do footer
    const input = win.querySelector('#g-chat-input');
    const sendBtn = win.querySelector('#g-chat-send');
    
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') gChatSendMessage();
    });
    sendBtn.onclick = gChatSendMessage;

    // Reseta/inicializa o fluxo
    gChatReset();

    // Oculta inicialmente e calcula visibilidade com base no login/splash
    btn.style.display = 'none';
    gCheckHelpChatVisibility();

    // Observa mudanças de estado do splash screen e tela de login para atualizar visibilidade
    const sp = document.getElementById('sp-overlay');
    const login = document.getElementById('g-login-screen');
    const observer = new MutationObserver(() => {
      gCheckHelpChatVisibility();
    });
    if (sp) observer.observe(sp, { attributes: true, attributeFilter: ['style', 'class'] });
    if (login) observer.observe(login, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  function gToggleHelpChat() {
    isOpen = !isOpen;
    const win = document.getElementById('g-chat-window');
    const btn = document.getElementById('g-chat-btn');
    if (!win || !btn) return;

    if (isOpen) {
      win.classList.add('open');
      btn.classList.add('active');
      btn.innerHTML = `<svg class="g-chat-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      
      // Foca no input se estiver em modo suporte
      if (supportMode) {
        const input = document.getElementById('g-chat-input');
        if (input) setTimeout(() => input.focus(), 300);
      }
    } else {
      win.classList.remove('open');
      btn.classList.remove('active');
      btn.innerHTML = `<svg class="g-chat-btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#ffffff"/><path d="M9 10c1 1.5 3 1.5 4 0" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;
    }
  }

  function gChatReset() {
    const body = document.getElementById('g-chat-body');
    if (!body) return;
    body.innerHTML = '';
    supportMode = false;
    
    const input = document.getElementById('g-chat-input');
    const sendBtn = document.getElementById('g-chat-send');
    if (input && sendBtn) {
      input.disabled = true;
      input.placeholder = "Escolha uma opção...";
      input.value = '';
      sendBtn.disabled = true;
    }

    gAddChatBubbleBot(G_CHAT_FLOW.start.text, G_CHAT_FLOW.start.options);
  }

  function gAddChatBubbleBot(htmlText, options) {
    const body = document.getElementById('g-chat-body');
    if (!body) return;

    // Bolha do bot
    const msg = document.createElement('div');
    msg.className = 'g-chat-msg bot';
    msg.innerHTML = htmlText;
    body.appendChild(msg);

    // Opções
    if (options && options.length) {
      const optWrap = document.createElement('div');
      optWrap.className = 'g-chat-options';
      options.forEach(opt => {
        const chip = document.createElement('button');
        chip.className = 'g-chat-chip';
        chip.type = 'button';
        chip.innerHTML = opt.text;
        chip.onclick = function () {
          gChatSelectOption(opt.id, opt.text);
        };
        optWrap.appendChild(chip);
      });
      body.appendChild(optWrap);
    }

    body.scrollTop = body.scrollHeight;
  }

  function gAddChatBubbleUser(text) {
    const body = document.getElementById('g-chat-body');
    if (!body) return;

    const msg = document.createElement('div');
    msg.className = 'g-chat-msg user';
    msg.textContent = text;
    body.appendChild(msg);

    body.scrollTop = body.scrollHeight;
  }

  function gChatSelectOption(id, label) {
    // 1. Remove os chips de opções anteriores
    const body = document.getElementById('g-chat-body');
    if (body) {
      const options = body.querySelectorAll('.g-chat-options');
      options.forEach(el => el.remove());
    }

    // 2. Renderiza escolha do usuário
    gAddChatBubbleUser(label.replace(/^[^\s]+\s+/, '')); // Remove emojis do chip para a bolha do usuário

    // 3. Efeito digitando do Bot
    const typing = document.createElement('div');
    typing.className = 'g-chat-msg bot';
    typing.innerHTML = '<div class="g-chat-typing"><div class="g-chat-typing-dot"></div><div class="g-chat-typing-dot"></div><div class="g-chat-typing-dot"></div></div>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    setTimeout(() => {
      typing.remove();
      
      if (id === 'start') {
        gChatReset();
        return;
      }

      const node = G_CHAT_FLOW[id];
      if (!node) return;

      if (id === 'support') {
        supportMode = true;
        const input = document.getElementById('g-chat-input');
        const sendBtn = document.getElementById('g-chat-send');
        if (input && sendBtn) {
          input.disabled = false;
          input.placeholder = "Escreva sua dúvida aqui...";
          sendBtn.disabled = false;
          setTimeout(() => input.focus(), 100);
        }
      }

      gAddChatBubbleBot(node.text, node.options);
    }, 600);
  }

  function gChatSendMessage() {
    const input = document.getElementById('g-chat-input');
    const footer = document.querySelector('.g-chat-footer');
    if (!input || !input.value.trim() || !supportMode) {
      if (footer) {
        footer.classList.remove('g-shake');
        void footer.offsetWidth; // Trigger reflow
        footer.classList.add('g-shake');
        setTimeout(() => footer.classList.remove('g-shake'), 400);
      }
      return;
    }

    const text = input.value.trim();
    input.value = '';

    // 1. Remove qualquer menu órfão
    const body = document.getElementById('g-chat-body');
    if (body) {
      const options = body.querySelectorAll('.g-chat-options');
      options.forEach(el => el.remove());
    }

    // 2. Envia mensagem do usuário
    gAddChatBubbleUser(text);

    // 3. Resposta simulada do suporte comercial
    const typing = document.createElement('div');
    typing.className = 'g-chat-msg bot';
    typing.innerHTML = '<div class="g-chat-typing"><div class="g-chat-typing-dot"></div><div class="g-chat-typing-dot"></div><div class="g-chat-typing-dot"></div></div>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    setTimeout(() => {
      typing.remove();
      gAddChatBubbleBot(
        "Mensagem recebida com sucesso! Um integrante da equipe de **Suporte Delivery Much** entrará em contato em instantes neste mesmo chat. Obrigado pelo contato!",
        [{ id: "start", text: "← Voltar ao menu principal" }]
      );
      
      // Desabilita input após envio
      input.disabled = true;
      input.placeholder = "Aguardando suporte...";
      const sendBtn = document.getElementById('g-chat-send');
      if (sendBtn) sendBtn.disabled = true;
    }, 1200);
  }

  function gCheckHelpChatVisibility() {
    const btn = document.getElementById('g-chat-btn');
    const win = document.getElementById('g-chat-window');
    if (!btn) return;

    const loggedIn = typeof gCurrentUser === 'function' && gCurrentUser();
    const sp = document.getElementById('sp-overlay');
    const login = document.getElementById('g-login-screen');

    // Splash está visível se existe e não tem a classe 'sp-done'
    const splashVisible = sp && !sp.classList.contains('sp-done') && sp.style.display !== 'none';
    
    // Login está visível se existe e seu display não é 'none'
    const loginVisible = login && login.style.display !== 'none' && login.style.display !== '';

    if (loggedIn && !splashVisible && !loginVisible) {
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
      if (win && win.classList.contains('open')) {
        isOpen = false;
        win.classList.remove('open');
        btn.classList.remove('active');
        btn.innerHTML = `<svg class="g-chat-btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#ffffff"/><path d="M9 10c1 1.5 3 1.5 4 0" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;
      }
    }
  }

  // Exportações globais
  window.gInitHelpChat = gInitHelpChat;
  window.gToggleHelpChat = gToggleHelpChat;
  window.gCheckHelpChatVisibility = gCheckHelpChatVisibility;
})();
