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
      text: "E aí! Tudo bem? Sou o assistente virtual do Luma. Estou por aqui para te dar aquela força na hora de criar suas artes ou na configuração dos seus templates no Estúdio.<br><br>Me conta, qual é o seu perfil hoje?",
      options: [
        { id: "fran", text: "Sou Franqueado (Quero gerar artes)", icon: "fran" },
        { id: "design", text: "Sou Designer (Quero criar templates)", icon: "design" },
        { id: "info", text: "Outras Dúvidas / Sobre o Luma", icon: "info" },
        { id: "support", text: "Falar com o Suporte Humano", icon: "support" }
      ]
    },
    // Fluxo Franqueado
    fran: {
      text: "Fechou! Como franqueado, você tem acesso a todas as campanhas e materiais liberados para criar e baixar suas artes de um jeito bem prático. Qual é a sua dúvida?",
      options: [
        { id: "fran_pdf", text: "Como baixar minhas artes em PDF?", icon: "pdf" },
        { id: "fran_csv", text: "Como gerar artes em lote (CSV)?", icon: "csv" },
        { id: "fran_cors", text: "Minhas fotos não carregam no upload", icon: "cors" },
        { id: "fran_hist", text: "Onde vejo minhas artes anteriores?", icon: "hist" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    fran_pdf: {
      text: "Pra gerar o PDF, é super simples:<br><br>1. Termine de preencher os dados no chat guiado;<br>2. Na tela final, clique no botão <strong>'Baixar PDF'</strong> (ao lado do de PNG).<br><br>O arquivo será gerado na hora com a arte em tamanho real!",
      options: [
        { id: "fran", text: "Voltar para dúvidas de Franqueado", icon: "back" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    fran_csv: {
      text: "Para criar várias artes de uma vez só por planilha:<br><br>1. Na confirmação do chat, clique em <strong>'Criar em Lote (CSV)'</strong>;<br>2. Baixe a planilha modelo pelo botão <strong>'Baixar Modelo CSV'</strong>;<br>3. Preencha os dados e salve em formato CSV (UTF-8);<br>4. Suba de volta no modal e clique em <strong>'Baixar todos'</strong>!",
      options: [
        { id: "fran", text: "Voltar para dúvidas de Franqueado", icon: "back" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    fran_cors: {
      text: "Se as fotos da planilha não estiverem carregando:<br><br>• Confirme se os links são públicos e possuem acesso aberto (CORS liberado).<br>• Para uploads diretos, o limite máximo é de <strong>20MB</strong> nos formatos PNG, JPG ou WebP.<br><br>O Luma ajusta o tamanho da foto automaticamente sem perder nitidez!",
      options: [
        { id: "fran", text: "Voltar para dúvidas de Franqueado", icon: "back" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    fran_hist: {
      text: "Para acessar suas artes anteriores:<br><br>1. Vá no menu lateral esquerdo e clique na aba <strong>'Minhas Artes'</strong>;<br>2. Ali guardamos os seus últimos 50 rascunhos e conclusões;<br>3. Você pode baixar de novo, editar ou duplicar em outro formato na hora!",
      options: [
        { id: "fran", text: "Voltar para dúvidas de Franqueado", icon: "back" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    // Fluxo Designer
    design: {
      text: "Opa, designer! No Estúdio Luma a gente tem autonomia total: dá pra criar pranchetas, organizar o canvas, criar as variáveis e regras antes de publicar as artes para a rede. O que você quer ver agora?",
      options: [
        { id: "design_vars", text: "Como funcionam as Variáveis?", icon: "vars" },
        { id: "design_rules", text: "Como funcionam as Regras e Vínculos?", icon: "rules" },
        { id: "design_canvas", text: "Como funcionam o Canvas Único e Smart Resize?", icon: "canvas" },
        { id: "design_paint", text: "Como pintar ou desenhar no canvas?", icon: "brush" },
        { id: "design_fields", text: "Como usar o novo Centro de Campos?", icon: "fields" },
        { id: "design_imports", text: "Como importar arquivos PSD ou SVG?", icon: "imports" },
        { id: "design_pub", text: "Como publicar meu template?", icon: "pub" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    design_vars: {
      text: "As variáveis dão autonomia pros franqueados preencherem dados:<br><br>• Escreva a palavra entre chaves duplas, ex: <code>{{produto}}</code> ou <code>{{preco}}</code>.<br>• O Luma lê esses tokens e cria as perguntas automaticamente.<br>• Defina tipos ricos (Cores, Datas, Selects) no painel lateral direito.",
      options: [
        { id: "design", text: "Voltar para dúvidas de Designer", icon: "back" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    design_rules: {
      text: "As regras alteram as camadas de acordo com o que for preenchido:<br><br>• <strong>Ocultar:</strong> sumir com preço antigo se estiver vazio (<code>when: 'empty', then: 'hide'</code>).<br>• <strong>Encolher:</strong> reduzir a fonte (<code>shrinkFont</code>) para textos compridos não estourarem.<br><br>Você pode testar essas lógicas ao lado no simulador interativo!",
      options: [
        { id: "design", text: "Voltar para dúvidas de Designer", icon: "back" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    design_canvas: {
      text: "Agora os templates usam <strong>Canvas Único</strong>!<br><br>• Mude o formato (Story, Feed, Wide) no topo do Estúdio.<br>• O motor de <strong>Smart Resize</strong> reposiciona as camadas sozinho.<br>• Ajustes manuais de uma camada ficam salvos especificamente para aquele formato.",
      options: [
        { id: "design", text: "Voltar para dúvidas de Designer", icon: "back" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    design_paint: {
      text: "Precisa fazer ilustrações ou retoques no canvas?<br><br>• <strong>Pincel (B):</strong> pintar traços livremente.<br>• <strong>Borracha (E):</strong> apagar trechos da pintura.<br>• <strong>Balde (G):</strong> preencher áreas fechadas.<br><br>A pintura é criada em uma camada transparente dedicada para não estragar suas fotos e textos!",
      options: [
        { id: "spotlight_paint", text: "Me mostre onde fica 🎯", icon: "vars" },
        { id: "design", text: "Voltar para dúvidas de Designer", icon: "back" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    design_fields: {
      text: "O novo <strong>Centro de Campos</strong> fica na aba <strong>Dados</strong> (painel direito):<br><br>• Veja quais variáveis estão livres ou vinculadas no template.<br>• Clique em um campo para que a camada correspondente pisque no canvas.<br>• Insira novos campos diretamente no elemento ativo do editor.",
      options: [
        { id: "spotlight_fields", text: "Me mostre onde fica 🎯", icon: "vars" },
        { id: "design", text: "Voltar para dúvidas de Designer", icon: "back" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    design_imports: {
      text: "Para trazer layouts prontos do Photoshop ou Illustrator:<br><br>1. Expanda a campanha no painel lateral direito;<br>2. Clique em <strong>'Importar PSD'</strong> ou <strong>'Importar SVG'</strong>;<br>3. O Luma converterá textos, vetores e imagens, criando variáveis automáticas.",
      options: [
        { id: "design", text: "Voltar para dúvidas de Designer", icon: "back" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    design_pub: {
      text: "Para publicar e liberar o seu template para a rede:<br><br>1. Clique em <strong>'Publicar'</strong> no topo direito;<br>2. Escolha as pranchetas e a pasta (campanha) de destino;<br>3. Defina a validade (prazo) e limite de caracteres de cada campo.",
      options: [
        { id: "spotlight_pub", text: "Me mostre onde fica 🎯", icon: "vars" },
        { id: "design", text: "Voltar para dúvidas de Designer", icon: "back" },
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    // Outras Dúvidas
    info: {
      text: "O Luma é a nossa ferramenta de automação para a Delivery Much! Ele junta o design institucional (no Estúdio) e a autonomia pros franqueados criarem artes na ponta.<br><br>Pra ver tutoriais interativos no estilo passo a passo, abre a nossa **Central de Ajuda** clicando no botão de interrogação `?` no topo da tela.",
      options: [
        { id: "start", text: "Voltar ao menu principal", icon: "back" }
      ]
    },
    // Suporte Humano
    support: {
      text: "Fechado! Já vou te conectar com a nossa equipe de suporte da Delivery Much.<br><br>Pode <strong>escrever sua mensagem na caixa de texto aqui embaixo</strong> e enviar pra gente começar a conversar:",
      options: []
    }
  };

  function gGetIconSvg(iconName) {
    const defaultStroke = 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    switch (iconName) {
      case 'fran':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
      case 'design':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
      case 'info':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
      case 'support':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
      case 'pdf':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
      case 'csv':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="12" y1="3" x2="12" y2="21"></line></svg>`;
      case 'cors':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`;
      case 'hist':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
      case 'vars':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`;
      case 'rules':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
      case 'imports':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7"></path></svg>`;
      case 'pub':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><path d="M22 2s-3 1-5 4L6 17c-2 2-3 5-3 5s3-1 5-3l11-11c3-2 4-5 4-5z"></path><path d="M19 5l-7 7M9 18l-3 3-1-1 3-3z"></path></svg>`;
      case 'canvas':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`;
      case 'brush':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><path d="M18 13.7a5.7 5.7 0 0 0 .7-2.9 5.8 5.8 0 0 0-9.3-4.5M9 7.7L5 11.7a4 4 0 0 0-1.3 2.8c0 2.2 1.8 4 4 4a4 4 0 0 0 2.8-1.3l4-4"></path><path d="M15.5 6.5L17.5 4.5"></path></svg>`;
      case 'fields':
        return `<svg class="g-chat-chip-icon" viewBox="0 0 24 24" fill="none" ${defaultStroke}><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
      case 'back':
        return `<svg class="g-chat-chip-icon g-chat-chip-back" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;
      default:
        return '';
    }
  }

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
          <div class="g-chat-avatar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          </div>
          <div class="g-chat-header-text">
            <span class="g-chat-title">Suporte Luma</span>
            <span class="g-chat-status">Online agora</span>
          </div>
        </div>
        <button class="g-chat-close" onclick="gToggleHelpChat()" aria-label="Fechar chat">&times;</button>
      </div>
      <div class="g-chat-body" id="g-chat-body"></div>
      <div class="g-chat-autocomplete" id="g-chat-autocomplete"></div>
      <div class="g-chat-footer" id="g-chat-footer">
        <input type="text" id="g-chat-input" class="g-chat-input-box" placeholder="Pesquisar ajuda ou /comando..." aria-label="Pesquisar no suporte">
        <div id="g-chat-voice-waves" class="g-chat-voice-waves-container">
          <span class="g-voice-wave-text">Gravando áudio...</span>
          <div class="g-voice-wave-bar bar-1"></div>
          <div class="g-voice-wave-bar bar-2"></div>
          <div class="g-voice-wave-bar bar-3"></div>
          <div class="g-voice-wave-bar bar-4"></div>
        </div>
        <button id="g-chat-mic" class="g-chat-mic-btn" aria-label="Digitar por voz" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
        </button>
        <button id="g-chat-send" class="g-chat-send-btn" aria-label="Enviar mensagem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    `;
    document.body.appendChild(win);

    // Eventos do footer e autocomplete
    const input = win.querySelector('#g-chat-input');
    const micBtn = win.querySelector('#g-chat-mic');
    const sendBtn = win.querySelector('#g-chat-send');
    
    input.addEventListener('input', gUpdateAutocomplete);
    input.addEventListener('focus', gUpdateAutocomplete);
    input.addEventListener('blur', () => {
      setTimeout(() => {
        const ac = document.getElementById('g-chat-autocomplete');
        if (ac) ac.classList.remove('active');
      }, 200);
    });
    
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        if (supportMode) {
          gChatSendMessage();
        } else {
          const ac = document.getElementById('g-chat-autocomplete');
          if (ac && ac.classList.contains('active')) {
            const firstBtn = ac.querySelector('.g-autocomplete-item');
            if (firstBtn) {
              firstBtn.click();
              e.preventDefault();
            }
          }
        }
      }
    });

    if (micBtn) {
      micBtn.onclick = function() {
        gToggleSpeechRecognition();
      };
    }

    sendBtn.onclick = function() {
      if (supportMode) {
        gChatSendMessage();
      } else {
        const ac = document.getElementById('g-chat-autocomplete');
        if (ac && ac.classList.contains('active')) {
          const firstBtn = ac.querySelector('.g-autocomplete-item');
          if (firstBtn) firstBtn.click();
        }
      }
    };

    // Reseta/inicializa o fluxo
    gChatReset();
    gUpdateOnboardingUI();

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
      input.disabled = false;
      input.placeholder = "Pesquisar ajuda ou /comando...";
      input.value = '';
      sendBtn.disabled = false;
    }

    const isDesigner = typeof gIsAdmin === 'function' && gIsAdmin();
    if (isDesigner) {
      gAddChatBubbleBot(G_CHAT_FLOW.design.text, G_CHAT_FLOW.design.options, 'design');
    } else {
      gAddChatBubbleBot(G_CHAT_FLOW.fran.text, G_CHAT_FLOW.fran.options, 'fran');
    }
  }

  function gAddChatBubbleBot(htmlText, options, nodeId) {
    const body = document.getElementById('g-chat-body');
    if (!body) return;

    // Bolha do bot
    const msg = document.createElement('div');
    msg.className = 'g-chat-msg bot';
    msg.innerHTML = htmlText;
    body.appendChild(msg);

    // Se for o nó de regras, injeta o playground/sandbox
    if (nodeId === 'design_rules' && typeof gBuildRulesSandbox === 'function') {
      msg.appendChild(gBuildRulesSandbox());
    }

    // Opções
    if (options && options.length) {
      const optWrap = document.createElement('div');
      optWrap.className = 'g-chat-options';
      options.forEach(opt => {
        const chip = document.createElement('button');
        chip.className = 'g-chat-chip';
        chip.type = 'button';
        
        const iconSvg = gGetIconSvg(opt.icon);
        const hasArrow = opt.icon !== 'back';
        const arrowSvg = hasArrow ? '<svg class="g-chat-chip-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' : '';

        chip.innerHTML = `
          <span class="g-chat-chip-content">
            ${iconSvg}
            <span class="g-chat-chip-text">${opt.text}</span>
          </span>
          ${arrowSvg}
        `;
        
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
    gAddChatBubbleUser(label);

    // Se for um trigger de spotlight
    if (id && id.startsWith('spotlight_')) {
      const toolKey = id.replace('spotlight_', '');
      setTimeout(() => {
        if (toolKey === 'fields') {
          gShowSpotlight('#rtab-dados', () => {
            if (typeof dActivatePanel === 'function') dActivatePanel('dados');
          });
        } else if (toolKey === 'paint') {
          gShowSpotlight('#dtool-brush-proxy');
        } else if (toolKey === 'pub') {
          gShowSpotlight('button.dt-btn-primary[onclick*="dPublishOpen"]');
        }
      }, 500);
      return;
    }

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
          input.placeholder = "Escreva sua mensagem para o suporte...";
          sendBtn.disabled = false;
          setTimeout(() => input.focus(), 100);
        }
      }

      gAddChatBubbleBot(node.text, node.options, id);
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
        "Mensagem recebida! Alguém da equipe de **Suporte da Delivery Much** já vai te chamar aqui mesmo no chat. Fica de olho!",
        [{ id: "start", text: "Voltar ao menu principal", icon: "back" }]
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
      gUpdateOnboardingUI();
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

  function gUpdateOnboardingUI() {
    const isFranqueado = typeof gIsAdmin === 'function' && !gIsAdmin();
    if (!isFranqueado) {
      const old = document.getElementById('g-chat-onboarding');
      if (old) old.remove();
      return;
    }

    let progress = { choseMaterial: false, downloadedPng: false, triedCsv: false };
    try {
      const data = localStorage.getItem('luma_onboarding_franqueado');
      if (data) progress = JSON.parse(data);
    } catch (e) {}

    const completedCount = [progress.choseMaterial, progress.downloadedPng, progress.triedCsv].filter(Boolean).length;
    if (completedCount === 3) {
      const old = document.getElementById('g-chat-onboarding');
      if (old) {
        old.style.opacity = '0';
        old.style.height = '0';
        old.style.padding = '0';
        setTimeout(() => old.remove(), 300);
      }
      return;
    }

    let container = document.getElementById('g-chat-onboarding');
    if (!container) {
      container = document.createElement('div');
      container.id = 'g-chat-onboarding';
      container.className = 'g-chat-onboarding';
      container.innerHTML = `
        <div class="g-chat-onboarding-header">
          <span class="g-chat-onboarding-title">Seu progresso no Luma</span>
          <span class="g-chat-onboarding-percent" id="g-chat-onboarding-percent">0%</span>
        </div>
        <div class="g-chat-onboarding-bar">
          <div class="g-chat-onboarding-fill" id="g-chat-onboarding-fill" style="width: 0%;"></div>
        </div>
        <div class="g-chat-onboarding-steps">
          <div class="g-chat-onboarding-step" id="g-step-choseMaterial">
            <svg class="g-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span class="g-chat-onboarding-step-text">Escolher material</span>
          </div>
          <div class="g-chat-onboarding-step" id="g-step-downloadedPng">
            <svg class="g-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span class="g-chat-onboarding-step-text">Baixar arte</span>
          </div>
          <div class="g-chat-onboarding-step" id="g-step-triedCsv">
            <svg class="g-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span class="g-chat-onboarding-step-text">Criar em lote (CSV)</span>
          </div>
        </div>
      `;
      const win = document.getElementById('g-chat-window');
      const body = document.getElementById('g-chat-body');
      if (win && body) {
        win.insertBefore(container, body);
      }
    }

    const pct = Math.round((completedCount / 3) * 100);
    const fill = document.getElementById('g-chat-onboarding-fill');
    const percentText = document.getElementById('g-chat-onboarding-percent');
    if (fill) fill.style.width = pct + '%';
    if (percentText) percentText.textContent = pct + '%';

    const stepChose = document.getElementById('g-step-choseMaterial');
    const stepDownload = document.getElementById('g-step-downloadedPng');
    const stepCsv = document.getElementById('g-step-triedCsv');

    if (stepChose) stepChose.classList.toggle('completed', !!progress.choseMaterial);
    if (stepDownload) stepDownload.classList.toggle('completed', !!progress.downloadedPng);
    if (stepCsv) stepCsv.classList.toggle('completed', !!progress.triedCsv);
  }

  function gTriggerOnboardingStep(stepName) {
    try {
      const isFranqueado = typeof gIsAdmin === 'function' && !gIsAdmin();
      if (!isFranqueado) return;

      const data = localStorage.getItem('luma_onboarding_franqueado');
      let progress = data ? JSON.parse(data) : { choseMaterial: false, downloadedPng: false, triedCsv: false };
      
      if (progress[stepName] === false) {
        progress[stepName] = true;
        localStorage.setItem('luma_onboarding_franqueado', JSON.stringify(progress));
        gUpdateOnboardingUI();
        
        if (stepName === 'choseMaterial') {
          gToast('✓ Conquista: Você escolheu seu primeiro material!');
        } else if (stepName === 'downloadedPng') {
          gToast('✓ Conquista: Você baixou sua primeira arte!');
        } else if (stepName === 'triedCsv') {
          gToast('✓ Conquista: Você testou a criação em lote (CSV)!');
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // BANCO DE DADOS PARA BUSCA PREDITIVA E AUTOCOMPLETE
  const G_AUTOCOMPLETE_DATABASE = [
    // Designers
    { cmd: "/variaveis", text: "🏷️ Variáveis (Como criar)", id: "design_vars", role: "designer", keywords: ["variavel", "token", "chave", "label", "estudio", "campo", "tipo"] },
    { cmd: "/regras", text: "🎛️ Regras e Vínculos (Lógica)", id: "design_rules", role: "designer", keywords: ["regra", "vinculo", "hide", "empty", "condicional", "shrink"] },
    { cmd: "/canvas", text: "⚙️ Canvas Único e Smart Resize", id: "design_canvas", role: "designer", keywords: ["canvas", "resize", "prancheta", "story", "feed", "wide", "post"] },
    { cmd: "/pintura", text: "🎨 Pintura e Desenhos (Pincel)", id: "design_paint", role: "designer", keywords: ["pincel", "borracha", "balde", "desenhar", "pintar", "tinta"] },
    { cmd: "/campos", text: "📊 Centro de Campos (Dados)", id: "design_fields", role: "designer", keywords: ["campo", "dados", "centro", "variavel", "aba"] },
    { cmd: "/importar", text: "📥 Importar PSD ou SVG", id: "design_imports", role: "designer", keywords: ["importar", "psd", "photoshop", "svg", "illustrator"] },
    { cmd: "/publicar", text: "🚀 Publicar Template", id: "design_pub", role: "designer", keywords: ["publicar", "liberar", "rede", "validade", "expira"] },

    // Franqueados
    { cmd: "/pdf", text: "📕 Baixar artes em PDF", id: "fran_pdf", role: "franqueado", keywords: ["pdf", "baixar", "download", "imprimir"] },
    { cmd: "/lote", text: "⚡ Criar artes em lote (CSV)", id: "fran_csv", role: "franqueado", keywords: ["lote", "csv", "planilha", "excel", "sheets", "bulk"] },
    { cmd: "/upload", text: "📷 Minhas fotos não carregam", id: "fran_cors", role: "franqueado", keywords: ["upload", "cors", "erro", "imagem", "servidor", "link"] },
    { cmd: "/historico", text: "🕒 Ver artes anteriores", id: "fran_hist", role: "franqueado", keywords: ["historico", "minhas artes", "rascunho", "recuperar", "anterior"] },

    // Geral
    { cmd: "/suporte", text: "💬 Falar com Suporte Humano", id: "support", role: "all", keywords: ["suporte", "ajuda", "humano", "atendimento", "falar", "chat"] },
    { cmd: "/inicio", text: "🏠 Voltar ao menu principal", id: "start", role: "all", keywords: ["inicio", "start", "menu", "principal", "voltar"] }
  ];

  function gUpdateAutocomplete() {
    const input = document.getElementById('g-chat-input');
    const ac = document.getElementById('g-chat-autocomplete');
    if (!input || !ac) return;

    if (supportMode) {
      ac.classList.remove('active');
      return;
    }

    const val = input.value.trim().toLowerCase();
    if (!val) {
      ac.classList.remove('active');
      return;
    }

    const isDesigner = typeof gIsAdmin === 'function' && gIsAdmin();
    const roleFilter = isDesigner ? ['designer', 'all'] : ['franqueado', 'all'];

    const matches = G_AUTOCOMPLETE_DATABASE.filter(item => {
      if (!roleFilter.includes(item.role)) return false;
      return (
        item.cmd.startsWith(val) ||
        item.text.toLowerCase().includes(val) ||
        item.keywords.some(kw => kw.includes(val))
      );
    }).slice(0, 5);

    if (matches.length === 0) {
      ac.classList.remove('active');
      return;
    }

    ac.innerHTML = matches.map(item => {
      return `<button class="g-autocomplete-item" type="button" onclick="gSelectCommand('${item.id}', '${item.text}')">${item.text}</button>`;
    }).join('');
    ac.classList.add('active');
  }

  function gSelectCommand(id, text) {
    const input = document.getElementById('g-chat-input');
    if (input) input.value = '';
    const ac = document.getElementById('g-chat-autocomplete');
    if (ac) ac.classList.remove('active');
    
    gChatSelectOption(id, text);
  }

  // PLAYGROUND / SIMULADOR DE REGRAS INTERATIVO (MINI SANDBOX)
  function gBuildRulesSandbox() {
    const div = document.createElement('div');
    div.className = 'g-chat-sandbox';
    div.innerHTML = `
      <div class="g-chat-sandbox-controls">
        <div class="g-chat-sandbox-label">
          <span>Preço original (apaga p/ testar \`hide\`):</span>
          <input type="text" id="g-sb-price-input" class="g-chat-sandbox-input" value="R$ 39,90">
        </div>
        <div class="g-chat-sandbox-label">
          <span>Título do Produto (escreva + de 12 letras p/ \`shrinkFont\`):</span>
          <input type="text" id="g-sb-title-input" class="g-chat-sandbox-input" value="Promoção">
        </div>
      </div>
      <div class="g-chat-sandbox-preview">
        <div class="g-chat-sandbox-card">
          <div class="g-chat-sandbox-badge">Preview da Arte</div>
          <div class="g-chat-sandbox-title" id="g-sb-card-title">Promoção</div>
          <div class="g-chat-sandbox-prices">
            <span class="g-chat-sandbox-old-price" id="g-sb-card-old">R$ 39,90</span>
            <span class="g-chat-sandbox-new-price">R$ 29,90</span>
          </div>
          <div class="g-chat-sandbox-tag" id="g-sb-card-rule-tag">Regras Inativas</div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const priceInput = div.querySelector('#g-sb-price-input');
      const titleInput = div.querySelector('#g-sb-title-input');
      const cardTitle = div.querySelector('#g-sb-card-title');
      const cardOld = div.querySelector('#g-sb-card-old');
      const ruleTag = div.querySelector('#g-sb-card-rule-tag');

      function updateSandbox() {
        const pVal = priceInput.value.trim();
        const tVal = titleInput.value.trim();

        // 1. Regra Hide/Show
        if (pVal === '') {
          cardOld.style.display = 'none';
          ruleTag.textContent = 'Regra: hide ⚡';
          ruleTag.className = 'g-chat-sandbox-tag active';
        } else {
          cardOld.style.display = 'inline';
          cardOld.textContent = pVal;
          ruleTag.textContent = 'Regras Inativas';
          ruleTag.className = 'g-chat-sandbox-tag';
        }

        // 2. Regra shrinkFont
        cardTitle.textContent = tVal || 'Produto';
        if (tVal.length > 12) {
          cardTitle.style.fontSize = '11px';
          ruleTag.textContent = pVal === '' ? 'Regras: hide + shrinkFont ⚡' : 'Regra: shrinkFont ⚡';
          ruleTag.className = 'g-chat-sandbox-tag active';
        } else {
          cardTitle.style.fontSize = '16px';
        }
      }

      priceInput.addEventListener('input', updateSandbox);
      titleInput.addEventListener('input', updateSandbox);
      updateSandbox();
    }, 50);

    return div;
  }

  // SPOTLIGHTS E GUIAS ASSISTIDOS (SHOW ME)
  function gShowSpotlight(selector, autoActionFn) {
    const win = document.getElementById('g-chat-window');
    if (win) {
      win.classList.remove('open');
      const btn = document.getElementById('g-chat-btn');
      if (btn) {
        btn.classList.remove('active');
        btn.innerHTML = `<svg class="g-chat-btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#ffffff"/><path d="M9 10c1 1.5 3 1.5 4 0" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;
      }
      isOpen = false;
    }

    if (typeof autoActionFn === 'function') {
      try { autoActionFn(); } catch(e){}
    }

    const target = document.querySelector(selector);
    if (!target) {
      gToast('Abra a tela do Estúdio Designer para ver esta ferramenta!', 'warning');
      return;
    }

    target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });

    let tooltipText = "A ferramenta está em destaque logo abaixo!";
    if (selector === '#rtab-dados') {
      tooltipText = "Aba Dados: Gerencie aqui as variáveis, campos e vínculos do seu template de forma centralizada!";
    } else if (selector === '#dtool-brush-proxy') {
      tooltipText = "Pintura e Bitmap: Pinte livremente (Pincel B), apague traços (Borracha E) ou preencha áreas (Balde G)!";
    } else if (selector.includes('dPublishOpen')) {
      tooltipText = "Publicar: Libere seu template para os franqueados, definindo pastas, validade e limites!";
    }

    let overlay = document.getElementById('g-spotlight-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'g-spotlight-overlay';
      overlay.className = 'g-spotlight-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="g-spotlight-tooltip" id="g-spotlight-tooltip">
        <span>${tooltipText}</span>
        <button class="g-spotlight-close-btn" onclick="gDismissSpotlight()">Entendi</button>
      </div>
    `;
    overlay.classList.add('active');

    target.classList.add('g-spotlight-target');

    setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const tooltip = document.getElementById('g-spotlight-tooltip');
      if (tooltip) {
        let top = rect.bottom + window.scrollY + 12;
        let left = rect.left + window.scrollX + rect.width / 2 - 120;

        if (left < 10) left = 10;
        if (left + 240 > window.innerWidth) left = window.innerWidth - 250;
        if (top + 80 > window.innerHeight + window.scrollY) {
          top = rect.top + window.scrollY - 90;
        }

        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        tooltip.classList.add('active');
      }
    }, 150);

    overlay.setAttribute('data-target-selector', selector);
  }

  function gDismissSpotlight() {
    const overlay = document.getElementById('g-spotlight-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      const selector = overlay.getAttribute('data-target-selector');
      if (selector) {
        const target = document.querySelector(selector);
        if (target) {
          target.classList.remove('g-spotlight-target');
        }
      }
    }
    gToggleHelpChat();
  }

  let recognition = null;
  let isListening = false;

  // MOTOR COMBINATÓRIO DE PALAVRAS RECONHECIDAS (FUZZY, FONÉTICA E LEVENSHTEIN)
  function gFindBestCombinatedMatch(spokenText, roleFilter) {
    const tokens = spokenText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;

    let bestMatch = null;
    let highestScore = 0;

    // Distância de Levenshtein para tolerar pequenas variações na transcrição
    function getLevenshteinDistance(a, b) {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const matrix = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // substituição
              matrix[i][j - 1] + 1,     // inserção
              matrix[i - 1][j] + 1      // remoção
            );
          }
        }
      }
      return matrix[b.length][a.length];
    }

    // Retorna a similaridade entre duas strings de 0 (nada) a 1 (idêntico)
    function getWordSimilarity(w1, w2) {
      if (w1 === w2) return 1.0;
      const dist = getLevenshteinDistance(w1, w2);
      const maxLen = Math.max(w1.length, w2.length);
      if (maxLen === 0) return 1.0;
      return 1.0 - dist / maxLen;
    }

    // Normalização fonética comum para português do Brasil em termos técnicos do Luma
    function normalizePhonetics(word) {
      return word
        .replace(/césvê|cesve|cévê|césv|cvs|sevese|planilha/g, "csv")
        .replace(/pêdêefe|pdeefe|pedefe/g, "pdf")
        .replace(/pésdê|pesde|ps/g, "psd")
        .replace(/cânvas|canva|kavas|kanvas/g, "canvas")
        .replace(/esg|esveg|sveg/g, "svg")
        .replace(/regrás|regra|regr/g, "regras")
        .replace(/pincél|pinc/g, "pincel")
        .replace(/suport|atendim|ajud/g, "suporte");
    }

    const normalizedTokens = tokens.map(normalizePhonetics);

    G_AUTOCOMPLETE_DATABASE.forEach(item => {
      if (!roleFilter.includes(item.role)) return;

      let score = 0;
      const cmdClean = item.cmd.replace('/', '').toLowerCase();

      normalizedTokens.forEach(token => {
        // 1. Similaridade com o comando
        const cmdSim = getWordSimilarity(token, cmdClean);
        if (cmdSim > 0.85) {
          score += 15; // Correspondência forte de comando
        } else if (cmdClean.includes(token) && token.length >= 3) {
          score += 5;
        }

        // 2. Similaridade com palavras-chave
        item.keywords.forEach(kw => {
          const kwSim = getWordSimilarity(token, kw.toLowerCase());
          if (kwSim > 0.85) {
            score += 10; // Palavra-chave muito próxima
          } else if (token.includes(kw) || kw.includes(token)) {
            if (token.length >= 3) score += 3;
          }
        });
      });

      // Bônus para presença de múltiplas palavras-chave no texto total
      let uniqueKeywordMatches = 0;
      item.keywords.forEach(kw => {
        if (spokenText.toLowerCase().includes(kw)) {
          uniqueKeywordMatches++;
        }
      });
      score += uniqueKeywordMatches * 4;

      if (score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }
    });

    // Score mínimo de relevância para acionar automaticamente
    return highestScore >= 8 ? bestMatch : null;
  }

  function gToggleSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      gToast('O reconhecimento de voz não é suportado neste navegador.', 'warning');
      return;
    }

    const micBtn = document.getElementById('g-chat-mic');
    const input = document.getElementById('g-chat-input');
    const footer = document.getElementById('g-chat-footer');
    if (!micBtn || !input) return;

    if (isListening) {
      if (recognition) recognition.stop();
      return;
    }

    // Feedback visual imediato ao clicar
    micBtn.classList.add('listening');
    if (footer) footer.classList.add('voice-mode');
    input.placeholder = "Iniciando gravador...";

    if (!recognition) {
      recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = function() {
        isListening = true;
        input.placeholder = "Ouvindo... fale agora!";
      };

      recognition.onerror = function(e) {
        console.error('[Speech Error]', e);
        gStopListening();
      };

      recognition.onend = function() {
        gStopListening();
      };

      recognition.onresult = function(event) {
        const text = event.results[0][0].transcript.toLowerCase().trim();
        input.value = text;
        gStopListening();
        
        const isDesigner = typeof gIsAdmin === 'function' && gIsAdmin();
        const roleFilter = isDesigner ? ['designer', 'all'] : ['franqueado', 'all'];

        const matchedItem = gFindBestCombinatedMatch(text, roleFilter);

        if (matchedItem) {
          gToast(`🎙️ Voz: Identificado "${matchedItem.text}"`);
          gSelectCommand(matchedItem.id, `Pesquisa por Voz: ${text}`);
        } else {
          input.focus();
          gUpdateAutocomplete();
        }
      };
    }

    try {
      recognition.start();
    } catch(e) {
      console.error(e);
      gStopListening();
    }
  }

  function gStopListening() {
    isListening = false;
    const micBtn = document.getElementById('g-chat-mic');
    const input = document.getElementById('g-chat-input');
    const footer = document.getElementById('g-chat-footer');
    if (micBtn) micBtn.classList.remove('listening');
    if (footer) footer.classList.remove('voice-mode');
    if (input) {
      input.placeholder = "Pesquisar ajuda ou /comando...";
    }
  }

  // Exportações globais
  window.gInitHelpChat = gInitHelpChat;
  window.gToggleHelpChat = gToggleHelpChat;
  window.gCheckHelpChatVisibility = gCheckHelpChatVisibility;
  window.gTriggerOnboardingStep = gTriggerOnboardingStep;
  window.gSelectCommand = gSelectCommand;
  window.gDismissSpotlight = gDismissSpotlight;
  window.gToggleSpeechRecognition = gToggleSpeechRecognition;
})();
