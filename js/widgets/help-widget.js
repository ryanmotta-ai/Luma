/* ── LUMA HELP WIDGET ──
 * Ajuda contextual, artigos e mensagens com a mesma linguagem visual do Luma.
 */

(function () {
  let lastHelpTrigger = null;
  let widgetState = {
    isOpen: false,
    activeTab: 'home', // 'home' | 'messages' | 'help' | 'article'
    hasActiveChat: false,
    messages: [],
    attachedFile: null,
    isListening: false,
    selectedArticleId: null,
    // try/catch obrigatório: isto roda no CORPO do objeto, na carga do script. Em modo privado
    // (ou com storage bloqueado por política) o getItem LANÇA e o arquivo inteiro morre — o
    // widget de ajuda simplesmente não existiria na sessão.
    selectedModel: (function(){ try{ return localStorage.getItem('luma_selected_ai_model'); }catch(e){ return null; } })() || 'gemini-1.5-flash',
    searchQuery: '',
    pillTimer: null,
    pillHideTimer: null,
    pillMessageIndex: -1
  };

  // Base de Conhecimento Completa do Luma (15 Artigos Estruturados)
  const LUMA_ARTICLES = [
    {
      id: 'campanha-personalizar',
      category: 'franqueado',
      categoryTitle: 'USUÁRIO FRANQUEADO',
      title: 'Como escolher e personalizar um material de campanha?',
      meta: '⏱️ 2 min de leitura • Franqueado',
      summary: 'Passo a passo para selecionar peças do catálogo e preencher seus dados de franquia com segurança.',
      steps: [
        { num: 'PASSO 1', title: 'Navegue pelo Catálogo de Campanhas', text: 'No menu lateral do Franqueado, selecione a campanha desejada (ex: Oferta em Dobro, Natal, Dia das Mães).' },
        { num: 'PASSO 2', title: 'Escolha o Formato da Arte', text: 'Selecione o formato ideal para seu canal de divulgação: Feed (1:1), Stories (9:16) ou Banner para Impressão.' },
        { num: 'PASSO 3', title: 'Preencha os Campos do Assistente', text: 'Informe seu cupom, validade ou oferta na barra lateral. O Luma ajustará o texto e o layout automaticamente.' }
      ],
      tip: 'Dica de Ouro: Você pode usar o botão de microfone no chat ou no assistente para ditar seus preços e cupons por voz!'
    },
    {
      id: 'campos-regras',
      category: 'franqueado',
      categoryTitle: 'USUÁRIO FRANQUEADO',
      title: 'Como preencher campos de texto, preços e cupons sem errar a marca?',
      meta: '⏱️ 3 min de leitura • Guia Prático',
      summary: 'Entenda como as regras de formatação automática garantem que suas artes fiquem sempre bonitas.',
      steps: [
        { num: 'REGRA 1', title: 'Máscara Automática de Moeda (R$)', text: 'Ao digitar valores no campo de preço, o Luma aplica a máscara R$ 00,00 automaticamente. Não precisa digitar o símbolo de moeda.' },
        { num: 'REGRA 2', title: 'Caixa Alta Obrigatória em Cupons', text: 'Campos de cupom de desconto forçam letras maiúsculas para evitar erros de resgate pelos clientes.' },
        { num: 'REGRA 3', title: 'Auto-Ajuste de Tamanho de Fonte', text: 'Se você digitar um texto mais longo, o motor do Luma reduz o tamanho da fonte proporcionalmente para não estouro de caixa.' }
      ],
      tip: 'Atenção: Respeite os limites recomendados de caracteres exibidos abaixo de cada caixa de texto.'
    },
    {
      id: 'fotos-crop',
      category: 'franqueado',
      categoryTitle: 'USUÁRIO FRANQUEADO',
      title: 'Como enviar fotos de produtos com o enquadramento correto?',
      meta: '⏱️ 2 min de leitura • Imagens',
      summary: 'Dicas para fazer upload de fotos da sua loja ou pratos mantendo a alta resolução.',
      steps: [
        { num: 'PASSO 1', title: 'Clique na área de foto do material', text: 'No assistente de edição, selecione a caixa de imagem do produto.' },
        { num: 'PASSO 2', title: 'Selecione uma imagem do seu dispositivo', text: 'Envie um arquivo PNG, JPG ou WEBP de boa iluminação.' },
        { num: 'PASSO 3', title: 'Ajuste o Crop e Enquadramento', text: 'Arraste e aplique o zoom para centralizar o produto dentro da máscara da marca.' }
      ],
      tip: 'Dica: Evite fotos com fundo muito poluído. Dê preferência a pratos bem iluminados.'
    },
    {
      id: 'download-alta-res',
      category: 'franqueado',
      categoryTitle: 'USUÁRIO FRANQUEADO',
      title: 'Como baixar a arte final em alta resolução (PNG 2× / PDF)?',
      meta: '⏱️ 1 min de leitura • Exportação',
      summary: 'Aprenda a baixar arquivos prontos para postar no Instagram ou enviar para a gráfica.',
      steps: [
        { num: 'PASSO 1', title: 'Finalize a edição dos campos', text: 'Verifique se todas as informações e preços estão corretos na prévia ao vivo.' },
        { num: 'PASSO 2', title: 'Clique no botão Baixar Arte', text: 'Selecione a opção PNG 2× (ideal para WhatsApp e Instagram) ou PDF Vetorial (para impressão em gráfica).' }
      ],
      tip: 'O download leva menos de 2 segundos e é processado diretamente no seu navegador.'
    },
    {
      id: 'falta-preencher-erro',
      category: 'franqueado',
      categoryTitle: 'USUÁRIO FRANQUEADO',
      title: 'O que fazer se a prévia acusar "Falta preencher" um campo?',
      meta: '⏱️ 2 min de leitura • Resolução de Problemas',
      summary: 'Como identificar e corrigir campos obrigatórios pendentes na sua arte.',
      steps: [
        { num: 'PASSO 1', title: 'Localize o destaque em vermelho', text: 'O assistente do Luma grifa em vermelho os campos que a sua franquia precisa preencher obrigatoriamente.' },
        { num: 'PASSO 2', title: 'Preencha ou desmarque a opção condicional', text: 'Se você não for colocar promoção, desmarque a caixa "Exibir Preço Promocional".' }
      ],
      tip: 'Assim que todos os campos obrigatórios forem preenchidos, o botão de download será liberado.'
    },

    // Designer & Admin Articles
    {
      id: 'estudio-criar-templates',
      category: 'designer',
      categoryTitle: 'ADMINISTRADOR E DESIGNER',
      title: 'Como criar novos templates do zero no Estúdio Luma?',
      meta: '⏱️ 4 min de leitura • Designer',
      summary: 'Guia completo para montar artes profissionais usando a prancheta do Estúdio.',
      steps: [
        { num: 'PASSO 1', title: 'Acesse a aba Estúdio', text: 'Alterne o modo para Estúdio no menu superior do Luma.' },
        { num: 'PASSO 2', title: 'Defina a Prancheta e Formato', text: 'Crie uma prancheta 1080x1080px (Feed) ou 1080x1920px (Stories).' },
        { num: 'PASSO 3', title: 'Adicione Camadas de Texto e Imagens', text: 'Monte seu layout usando ferramentas de vetor, imagens e caixas de texto.' }
      ],
      tip: 'Mantenha os elementos visuais organizados em camadas nomeadas para facilitar a manutenção.'
    },
    {
      id: 'variaveis-dinamicas-campos',
      category: 'designer',
      categoryTitle: 'ADMINISTRADOR E DESIGNER',
      title: 'Como transformar um texto ou imagem em campo editável?',
      meta: '⏱️ 3 min de leitura • Campos editáveis',
      summary: 'Defina o que o franqueado poderá trocar sem alterar o layout.',
      steps: [
        { num: 'PASSO 1', title: 'Selecione uma camada de texto', text: 'No painel do designer, escolha a camada que deve ser editável.' },
        { num: 'PASSO 2', title: 'Abra Campos', text: 'O Luma sugere o campo mais provável de acordo com o nome e o conteúdo da camada.' },
        { num: 'PASSO 3', title: 'Aceite a sugestão ou crie outro', text: 'Escolha o formato da informação e confira como o franqueado verá o preenchimento.' }
      ],
      tip: 'Use nomes claros para a equipe, como Desconto, Validade ou Foto do produto.'
    },
    {
      id: 'importar-psd-photoshop',
      category: 'designer',
      categoryTitle: 'ADMINISTRADOR E DESIGNER',
      title: 'Como importar arquivos PSD do Photoshop mantendo camadas editáveis?',
      meta: '⏱️ 3 min de leitura • Importador PSD',
      summary: 'Aprenda a converter artes do Photoshop diretamente em templates do Luma.',
      steps: [
        { num: 'PASSO 1', title: 'Prepare seu arquivo no Photoshop', text: 'Organize o PSD com camadas limpas e nomeadas em RGB.' },
        { num: 'PASSO 2', title: 'Arraste o .psd para o Luma', text: 'No Estúdio, clique em "Importar PSD" e selecione o arquivo.' },
        { num: 'PASSO 3', title: 'Vincule as Camadas aos Campos', text: 'O parser do Luma recria os textos, fontes e imagens em HTML5 Canvas nativo.' }
      ],
      tip: 'Certifique-se de que as fontes utilizadas no PSD estão instaladas na biblioteca do Luma.'
    },
    {
      id: 'travas-marca-restricoes',
      category: 'designer',
      categoryTitle: 'ADMINISTRADOR E DESIGNER',
      title: 'Como definir regras de visibilidade condicional e travas de marca?',
      meta: '⏱️ 4 min de leitura • Brand Guardian',
      summary: 'Garanta a integridade visual da marca definindo limites min/max de caracteres e paletas permitidas.',
      steps: [
        { num: 'PASSO 1', title: 'Abra as Propriedades do Campo', text: 'Na aba Campos do Estúdio, selecione o campo que deseja restringir.' },
        { num: 'PASSO 2', title: 'Defina o limite de caracteres', text: 'Informe a quantidade máxima de letras que o franqueado pode digitar.' },
        { num: 'PASSO 3', title: 'Adicione Visibilidade Condicional', text: 'Configure regras como: exibir o selo "OFERTA" somente se o preço promocional for informado.' }
      ],
      tip: 'Travas de marca bem configuradas reduzem em 90% pedidos de revisão do marketing.'
    },
    {
      id: 'publicar-template-catalogo',
      category: 'designer',
      categoryTitle: 'ADMINISTRADOR E DESIGNER',
      title: 'Como publicar um template e disponibilizá-lo para os franqueados no catálogo?',
      meta: '⏱️ 2 min de leitura • Publicação',
      summary: 'Transforme o rascunho do designer em uma arte pronta no catálogo da rede.',
      steps: [
        { num: 'PASSO 1', title: 'Clique no botão Publicar Material', text: 'No canto superior direito do Estúdio, abra o modal de publicação.' },
        { num: 'PASSO 2', title: 'Escolha a Campanha e a Pasta', text: 'Associe o material a uma campanha ativa (ex: Desconto em Dobro) e defina a ordem.' },
        { num: 'PASSO 3', title: 'Confirme e Notifique a Rede', text: 'Ao salvar, a arte fica imediatamente visível no painel do franqueado.' }
      ],
      tip: 'Você pode salvar como rascunho local antes de publicar para a rede toda.'
    }
  ];

  // SVGs nativos reutilizáveis (Zero emojis)
  const WIDGET_SVGS = {
    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    chevronRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    chatBubble: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    smileBubble: '<svg class="luma-help-smile" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4.5h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-5.4L7 19.5v-3a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z"/><circle cx="9.2" cy="9.2" r=".7" fill="currentColor" stroke="none"/><circle cx="14.8" cy="9.2" r=".7" fill="currentColor" stroke="none"/><path class="luma-help-smile-mouth" d="M8.8 11.4c.8 1 1.9 1.6 3.2 1.6s2.4-.6 3.2-1.6"/></svg>',
    home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    messagesNav: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    helpNav: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    send: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    paperclip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    mic: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    sparkle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/><path d="m5 12 .7 1.8 1.8.7-1.8.7L5 17l-.7-1.8-1.8-.7 1.8-.7L5 12Z"/></svg>'
  };

  const WIDGET_PILL_MESSAGES = [
    {
      title: 'Posso ajudar?',
      detail: 'Encontre uma resposta sem sair desta tela.'
    },
    {
      title: 'Ficou com alguma dúvida?',
      detail: 'Conte para a gente em qual etapa você está.'
    },
    {
      title: 'Quer uma mãozinha?',
      detail: 'Busque uma dúvida ou fale com a equipe.'
    }
  ];

  function wmEsc(value) {
    if (typeof gEsc === 'function') return gEsc(String(value == null ? '' : value));
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function wmText(value) {
    return wmEsc(value).replace(/\n/g, '<br>');
  }

  function wmNormalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function wmArticleCategory(article) {
    return article && article.category === 'designer' ? 'Equipe de design' : 'Franqueado';
  }

  function wmArticleMeta(article) {
    return String((article && article.meta) || '').replace(/^⏱️\s*/, '');
  }

  function wmRenderArticleCard(article) {
    return `
      <button type="button" class="luma-wm-article-card" onclick="lumaWidgetOpenArticle('${article.id}')">
        <span class="luma-wm-article-card-copy">
          <span class="luma-wm-eyebrow">${wmEsc(wmArticleCategory(article))}</span>
          <strong>${wmEsc(article.title)}</strong>
          <span class="luma-wm-article-summary">${wmEsc(article.summary)}</span>
          <small>${wmEsc(wmArticleMeta(article))}</small>
        </span>
        <span class="luma-wm-list-arrow" aria-hidden="true">${WIDGET_SVGS.chevronRight}</span>
      </button>
    `;
  }

  function wmHeaderCopy() {
    if (widgetState.activeTab === 'messages') {
      return { title: 'Mensagens', detail: 'Converse com a equipe de suporte do Luma.' };
    }
    if (widgetState.activeTab === 'help' || widgetState.activeTab === 'article') {
      return { title: 'Central de ajuda', detail: 'Encontre respostas rápidas sobre o seu fluxo.' };
    }
    return { title: 'Como podemos ajudar?', detail: 'Busque uma resposta ou fale com a equipe.' };
  }

  function connectLegacyDesignerHelp() {
    const legacyOpenHelp = window.gOpenHelp;
    const legacyOpenHelpTopic = window.gOpenHelpTopic;

    if (typeof legacyOpenHelp === 'function') {
      window.gOpenHelp = function (trigger) {
        if (document.body.classList.contains('mode-designer')) {
          window.lumaWidgetOpen();
          return;
        }
        return legacyOpenHelp(trigger);
      };
    }

    if (typeof legacyOpenHelpTopic === 'function') {
      window.gOpenHelpTopic = function (topicId, trigger) {
        if (document.body.classList.contains('mode-designer')) {
          window.lumaWidgetOpen();
          window.lumaWidgetSetTab('help');
          return;
        }
        return legacyOpenHelpTopic(topicId, trigger);
      };
    }
  }

  function initHelpWidget() {
    if (document.getElementById('luma-widget-modal')) return;

    // Modal Flutuante
    const modal = document.createElement('div');
    modal.id = 'luma-widget-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'luma-wm-title');
    modal.setAttribute('aria-hidden', 'true');
    document.body.appendChild(modal);

    // Input de arquivo escondido
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'luma-wm-file-input';
    fileInput.accept = 'image/*,.pdf,.psd';
    fileInput.style.display = 'none';
    fileInput.onchange = function () { lumaWidgetHandleFileAttach(this); };
    document.body.appendChild(fileInput);

    renderWidgetModalContent();
    connectLegacyDesignerHelp();
    document.addEventListener('keydown', function(event) {
      if (!widgetState.isOpen) return;
      if (event.key === 'Escape') {
        lumaWidgetClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(modal.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
        .filter(function(element) { return element.offsetParent !== null; });
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  // Monitora alterações de contexto (Splash Screen, Login, Modais)
  function setupVisibilityObserver() {
    const checkVisibility = () => {
      const wrap = document.getElementById('luma-widget-fab-wrap');
      if (!wrap) return;

      const spOverlay = document.getElementById('sp-overlay');
      const isSplashActive = spOverlay && !spOverlay.classList.contains('sp-done') && spOverlay.style.display !== 'none';
      const isLoginActive = document.body.classList.contains('mode-login') || document.body.classList.contains('login-active');
      // Luma CLI aberto (body.cli-on): o console ocupa o rodapé e este FAB fica EM CIMA do
      // campo de comando no celular (z-index 9999 vs 900), roubando o toque. Entra aqui
      // porque o display é escrito INLINE neste laço — regra de CSS não venceria.
      const isCliActive = document.body.classList.contains('cli-on');
      // Escolha de material dentro da pasta (body.f-material-browser): tela de decisão
      // curta — a pessoa só olha os cards e toca num. O FAB (e a pílula de convite que
      // vive dentro do mesmo wrap) ficava sobre a grade sem ter o que resolver ali.
      // Entra aqui pelo mesmo motivo do cli-on: o display é INLINE, CSS não venceria.
      const isMaterialPicker = document.body.classList.contains('f-material-browser');

      if (isSplashActive || isLoginActive || isCliActive || isMaterialPicker) {
        wrap.style.display = 'none';
      } else {
        wrap.style.display = 'flex';
      }
    };

    checkVisibility();

    // Re-verifica periodicamente durante a inicialização
    const interval = setInterval(checkVisibility, 500);
    setTimeout(() => clearInterval(interval), 10000);

    // Observa mutações na Splash Screen e no Body
    const spOverlay = document.getElementById('sp-overlay');
    if (spOverlay) {
      const observer = new MutationObserver(checkVisibility);
      observer.observe(spOverlay, { attributes: true, attributeFilter: ['class', 'style'] });
    }
    // O body NÃO era observado (só o comentário dizia que era): o laço de 500ms morre em
    // 10s, então classe de contexto trocada depois — como o cli-on do console — nunca era
    // reavaliada e o FAB ficava por cima. Mutação de classe no body é rara; custo zero.
    new MutationObserver(checkVisibility).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  // Mostra uma saudação cedo e depois reaparece em intervalos discretos.
  function scheduleRandomPillAnimation(initialDelay) {
    if (widgetState.pillTimer) clearTimeout(widgetState.pillTimer);
    const randomMs = typeof initialDelay === 'number'
      ? initialDelay
      : Math.floor(Math.random() * (24000 - 14000 + 1)) + 14000;
    widgetState.pillTimer = setTimeout(() => {
      if (!widgetState.isOpen) {
        showPillTemporarily();
      }
      scheduleRandomPillAnimation();
    }, randomMs);
  }

  function showPillTemporarily() {
    const pill = document.getElementById('luma-widget-fab-pill');
    const trigger = document.getElementById('luma-widget-fab-trigger');
    if (!pill || widgetState.isOpen) return;

    widgetState.pillMessageIndex = (widgetState.pillMessageIndex + 1) % WIDGET_PILL_MESSAGES.length;
    const message = WIDGET_PILL_MESSAGES[widgetState.pillMessageIndex];
    const title = pill.querySelector('.fab-pill-title');
    const detail = pill.querySelector('.fab-pill-sub');

    if (title) title.textContent = message.title;
    if (detail) detail.textContent = message.detail;
    pill.setAttribute('aria-label', `${message.title} ${message.detail}`);
    pill.classList.add('pill-visible');
    if (trigger) {
      trigger.classList.remove('has-greeting');
      void trigger.offsetWidth;
      trigger.classList.add('has-greeting');
    }

    if (widgetState.pillHideTimer) clearTimeout(widgetState.pillHideTimer);
    widgetState.pillHideTimer = setTimeout(() => {
      pill.classList.remove('pill-visible');
      if (trigger) trigger.classList.remove('has-greeting');
    }, 5200);
  }

  window.lumaWidgetToggle = function () {
    if (widgetState.isOpen) {
      lumaWidgetClose();
    } else {
      lumaWidgetOpen();
    }
  };

  window.lumaWidgetOpen = function (sourceTrigger) {
    lastHelpTrigger = sourceTrigger instanceof HTMLElement ? sourceTrigger : document.activeElement;
    widgetState.isOpen = true;
    const modal = document.getElementById('luma-widget-modal');
    const pill = document.getElementById('luma-widget-fab-pill');
    const trigger = document.getElementById('luma-widget-fab-trigger');

    if (pill) pill.classList.remove('pill-visible');
    if (modal) {
      modal.classList.add('widget-open');
      modal.setAttribute('aria-hidden', 'false');
    }
    if (trigger) {
      trigger.classList.remove('has-greeting');
      trigger.classList.add('active');
      trigger.innerHTML = WIDGET_SVGS.close;
      trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-label', 'Fechar central de ajuda');
    }
    document.querySelectorAll('[data-help-trigger][aria-controls="luma-widget-modal"]').forEach(function(button) {
      button.setAttribute('aria-expanded', 'true');
    });
    renderWidgetModalContent();
    window.setTimeout(function() {
      const closeButton = document.querySelector('#luma-widget-modal .luma-wm-close-btn');
      if (closeButton) closeButton.focus();
    }, 80);
  };

  window.lumaWidgetClose = function () {
    widgetState.isOpen = false;
    const modal = document.getElementById('luma-widget-modal');
    const trigger = document.getElementById('luma-widget-fab-trigger');

    if (modal) {
      modal.classList.remove('widget-open');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (trigger) {
      trigger.classList.remove('active', 'has-greeting');
      trigger.innerHTML = `<span class="fab-badge-dot" aria-hidden="true"></span><span id="luma-widget-fab-icon">${WIDGET_SVGS.smileBubble}</span>`;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', 'Abrir central de ajuda');
    }
    document.querySelectorAll('[data-help-trigger][aria-controls="luma-widget-modal"]').forEach(function(button) {
      button.setAttribute('aria-expanded', 'false');
    });
    if (lastHelpTrigger && typeof lastHelpTrigger.focus === 'function' && lastHelpTrigger.isConnected) lastHelpTrigger.focus();
  };

  window.lumaWidgetSetTab = function (tab) {
    widgetState.activeTab = tab;
    if (tab !== 'article') widgetState.selectedArticleId = null;
    renderWidgetModalContent();
  };

  window.lumaWidgetStartChat = function () {
    // Controle do produto: o chat de ajuda pode ser desligado sem derrubar os
    // artigos da Central — por isso a chave é filha de global.help, não a mesma.
    if (typeof gFeatureCan === 'function' && !gFeatureCan('global.help.chat', 'access')) {
      if (typeof gFeatureBlockedFeedback === 'function') gFeatureBlockedFeedback('global.help.chat');
      return;
    }
    widgetState.hasActiveChat = true;
    widgetState.activeTab = 'messages';
    renderWidgetModalContent();
  };

  window.lumaWidgetFocusHelp = function () {
    widgetState.activeTab = 'help';
    widgetState.selectedArticleId = null;
    renderWidgetModalContent();
    window.setTimeout(function() {
      const search = document.getElementById('luma-wm-help-search');
      if (search) search.focus();
    }, 0);
  };

  // Abrir Leitor Completo do Artigo
  window.lumaWidgetOpenArticle = function (id) {
    widgetState.selectedArticleId = id;
    widgetState.activeTab = 'article';
    renderWidgetModalContent();
  };

  // Filtro de Busca em Tempo Real
  window.lumaWidgetFilterHelp = function (query) {
    widgetState.searchQuery = String(query || '').trim();
    const container = document.getElementById('luma-wm-articles-list');
    if (!container) return;

    const normalizedQuery = wmNormalize(query);
    const filtered = LUMA_ARTICLES.filter(function (article) {
      const steps = (article.steps || []).map(function (step) {
        return (step.title || '') + ' ' + (step.text || '');
      }).join(' ');
      const searchable = [
        article.title,
        article.summary,
        article.categoryTitle,
        article.meta,
        steps
      ].join(' ');
      return wmNormalize(searchable).indexOf(normalizedQuery) !== -1;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="luma-wm-no-results" role="status">
          <span class="luma-wm-no-results-icon" aria-hidden="true">${WIDGET_SVGS.search}</span>
          <strong>Nenhuma resposta para “${wmEsc(query)}”</strong>
          <span>Tente outra palavra ou envie sua dúvida para a equipe.</span>
          <button type="button" class="luma-wm-btn-primary" onclick="lumaWidgetStartChat()">Enviar uma pergunta</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(wmRenderArticleCard).join('');
  };

  // Ditar por Voz (Web Speech API)
  window.lumaWidgetStartVoiceDictation = function () {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (typeof gToast === 'function') gToast('O ditado por voz não está disponível neste navegador');
      return;
    }

    const micBtn = document.getElementById('luma-wm-mic-btn');
    const input = document.getElementById('luma-wm-input-box');
    if (!micBtn || !input) return;

    if (widgetState.isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = function () {
      widgetState.isListening = true;
      micBtn.classList.add('listening');
      input.placeholder = 'Ouvindo… fale agora';
    };

    recognition.onresult = function (event) {
      const transcript = event.results[0][0].transcript;
      input.value = (input.value ? input.value + ' ' : '') + transcript;
      window.lumaWidgetInputCheck(input);
    };

    recognition.onerror = function (event) {
      console.warn('Erro no ditado de voz:', event.error);
    };

    recognition.onend = function () {
      widgetState.isListening = false;
      micBtn.classList.remove('listening');
      input.placeholder = 'Escreva sua mensagem';
    };

    recognition.start();
  };

  // Anexar Arquivo
  window.lumaWidgetTriggerFileSelect = function () {
    const fileInput = document.getElementById('luma-wm-file-input');
    if (fileInput) fileInput.click();
  };

  window.lumaWidgetHandleFileAttach = function (input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = function (e) {
      widgetState.attachedFile = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        dataUrl: e.target.result,
        isImage: file.type.startsWith('image/')
      };
      renderAttachmentPreview();
    };
    reader.readAsDataURL(file);
  };

  window.lumaWidgetRemoveAttachment = function () {
    widgetState.attachedFile = null;
    renderAttachmentPreview();
  };

  function renderAttachmentPreview() {
    const area = document.getElementById('luma-wm-attach-area');
    if (!area) return;

    if (!widgetState.attachedFile) {
      area.innerHTML = '';
      return;
    }

    const file = widgetState.attachedFile;
    area.innerHTML = `
      <div class="luma-wm-attach-preview">
        ${file.isImage ? `<img src="${file.dataUrl}" class="luma-wm-attach-thumb" alt="">` : `<span class="luma-wm-attach-file-icon" aria-hidden="true">${WIDGET_SVGS.paperclip}</span>`}
        <span class="luma-wm-attach-name">${wmEsc(file.name)}</span>
        <span class="luma-wm-attach-size">${wmEsc(file.size)}</span>
        <button type="button" class="luma-wm-attach-remove" onclick="lumaWidgetRemoveAttachment()" aria-label="Remover anexo">${WIDGET_SVGS.trash}</button>
      </div>
    `;
  }

  // Renderiza o Modal com base na aba ativa
  function renderWidgetModalContent() {
    const modal = document.getElementById('luma-widget-modal');
    if (!modal) return;

    let bodyHTML = '';

    if (widgetState.activeTab === 'home') {
      bodyHTML = renderHomeTab();
    } else if (widgetState.activeTab === 'messages') {
      bodyHTML = renderMessagesTab();
    } else if (widgetState.activeTab === 'help') {
      bodyHTML = renderHelpTab();
    } else if (widgetState.activeTab === 'article') {
      bodyHTML = renderArticleViewTab();
    }
    const headerCopy = wmHeaderCopy();

    modal.innerHTML = `
      <header class="luma-wm-header">
        <div class="luma-wm-header-top">
          <div class="luma-wm-brand">
            <img src="assets/logos/luma-h-cor.png" alt="Luma" class="luma-wm-brand-logo-img luma-wm-logo-light">
            <img src="assets/logos/luma-h-branca.png" alt="Luma" class="luma-wm-brand-logo-img luma-wm-logo-dark">
            <span class="luma-wm-brand-divider" aria-hidden="true"></span>
            <span class="luma-wm-brand-label">Ajuda</span>
          </div>
          <div class="luma-wm-header-actions">
            <span class="luma-wm-availability"><span aria-hidden="true"></span>Suporte Luma</span>
            <button type="button" class="luma-wm-close-btn" onclick="lumaWidgetClose()" aria-label="Fechar central de ajuda">${WIDGET_SVGS.close}</button>
          </div>
        </div>
        <div class="luma-wm-heading">
          <h2 class="luma-wm-greeting" id="luma-wm-title">${wmEsc(headerCopy.title)}</h2>
          <p>${wmEsc(headerCopy.detail)}</p>
        </div>
      </header>

      <main class="luma-wm-body luma-wm-body-${widgetState.activeTab}">
        ${bodyHTML}
      </main>

      <nav class="luma-wm-nav" aria-label="Navegação da ajuda">
        <button type="button" class="luma-wm-nav-btn ${widgetState.activeTab === 'home' ? 'active' : ''}" onclick="lumaWidgetSetTab('home')" ${widgetState.activeTab === 'home' ? 'aria-current="page"' : ''}>
          ${WIDGET_SVGS.home}
          <span>Início</span>
        </button>
        <button type="button" class="luma-wm-nav-btn ${widgetState.activeTab === 'messages' ? 'active' : ''}" onclick="lumaWidgetSetTab('messages')" ${widgetState.activeTab === 'messages' ? 'aria-current="page"' : ''}>
          ${WIDGET_SVGS.messagesNav}
          <span>Mensagens</span>
        </button>
        <button type="button" class="luma-wm-nav-btn ${widgetState.activeTab === 'help' || widgetState.activeTab === 'article' ? 'active' : ''}" onclick="lumaWidgetSetTab('help')" ${widgetState.activeTab === 'help' || widgetState.activeTab === 'article' ? 'aria-current="page"' : ''}>
          ${WIDGET_SVGS.helpNav}
          <span>Ajuda</span>
        </button>
      </nav>
    `;

    // Re-bind attachment area if in chat tab
    if (widgetState.activeTab === 'messages' && widgetState.hasActiveChat) {
      renderAttachmentPreview();
      const messages = modal.querySelector('.luma-wm-chat-messages');
      if (messages) messages.scrollTop = messages.scrollHeight;
    }
    if (widgetState.activeTab === 'help' && widgetState.searchQuery) {
      window.lumaWidgetFilterHelp(widgetState.searchQuery);
    }
  }

  function renderHomeTab() {
    return `
      <button type="button" class="luma-wm-search luma-wm-search-prompt" onclick="lumaWidgetFocusHelp()" aria-label="Buscar na central de ajuda">
        ${WIDGET_SVGS.search}
        <span>Busque uma resposta</span>
        <small>Ex.: baixar em PDF</small>
      </button>

      <div class="luma-wm-section-head">
        <span class="luma-wm-eyebrow">Mais acessados</span>
        <button type="button" onclick="lumaWidgetFocusHelp()">Ver todos</button>
      </div>
      <div class="luma-wm-topic-list">
        <button type="button" class="luma-wm-topic-item" onclick="lumaWidgetOpenArticle('campanha-personalizar')">
          <span>Escolher e personalizar um material</span>
          ${WIDGET_SVGS.chevronRight}
        </button>
        <button type="button" class="luma-wm-topic-item" onclick="lumaWidgetOpenArticle('campos-regras')">
          <span>Preencher textos, pre\u00e7os e cupons</span>
          ${WIDGET_SVGS.chevronRight}
        </button>
        <button type="button" class="luma-wm-topic-item" onclick="lumaWidgetOpenArticle('download-alta-res')">
          <span>Baixar em alta resolução (PNG / PDF)</span>
          ${WIDGET_SVGS.chevronRight}
        </button>
        <button type="button" class="luma-wm-topic-item" onclick="lumaWidgetOpenArticle('falta-preencher-erro')">
          <span>Resolver campos que faltam preencher</span>
          ${WIDGET_SVGS.chevronRight}
        </button>
      </div>

      <button type="button" class="luma-wm-ask-card" onclick="lumaWidgetStartChat()">
        <span class="luma-wm-ask-icon" aria-hidden="true">${WIDGET_SVGS.chatBubble}</span>
        <div class="luma-wm-ask-copy">
          <strong>Precisa falar com alguém?</strong>
          <span>Envie sua dúvida para a equipe do Luma.</span>
        </div>
        <span class="luma-wm-list-arrow" aria-hidden="true">${WIDGET_SVGS.chevronRight}</span>
      </button>
    `;
  }

  function renderMessagesTab() {
    if (!widgetState.hasActiveChat) {
      return `
        <div class="luma-wm-chat-empty">
          <div class="luma-wm-chat-empty-icon">${WIDGET_SVGS.chatBubble}</div>
          <span class="luma-wm-eyebrow">Suporte Luma</span>
          <strong>Nenhuma conversa ainda</strong>
          <span>Conte o que aconteceu e inclua uma imagem se ajudar.</span>
          <button type="button" class="luma-wm-btn-primary" onclick="lumaWidgetStartChat()">
            Iniciar conversa
          </button>
        </div>
      `;
    }

    window.lumaWidgetSetModel = function (modelId) {
      widgetState.selectedModel = modelId;
      try{ localStorage.setItem('luma_selected_ai_model', modelId); }catch(e){}
      if (typeof window.LUMA_GEMINI_MODEL !== 'undefined') {
        window.LUMA_GEMINI_MODEL = modelId;
      }
      renderWidgetModalContent();
    };

    const selModel = widgetState.selectedModel || 'gemini-flash-latest';

    return `
      <div class="luma-wm-chat-active">
        <div class="luma-wm-chat-messages">
          <div class="luma-wm-msg-info">
            ${WIDGET_SVGS.info}
            <div>Para aprovações e pedidos de criação, fale com o marketing da sua empresa. Para usar o Luma, conte com a gente.</div>
          </div>

          <div class="luma-wm-bubble bot">
            Olá! Descreva sua dúvida e, se puder, diga em qual tela ela aconteceu.
            <div class="luma-wm-ia-aviso">${WIDGET_SVGS.info}Você fala com um assistente automático — respostas geradas por IA podem conter erros. Confira antes de agir.</div>
            <div class="luma-wm-bubble-meta">Assistente Luma · agora</div>
          </div>

          ${widgetState.messages.map(m => `
            <div class="luma-wm-bubble ${m.sender === 'user' ? 'user' : 'bot'}">
              ${m.image ? `<img src="${m.image}" class="luma-wm-bubble-img" alt="Anexo">` : ''}
              ${wmText(m.text)}
              <div class="luma-wm-bubble-meta">${m.fonte === 'ia' ? '<span class="luma-wm-ia-tag">IA</span>' : ''}${wmEsc(m.author)} · ${wmEsc(m.time)}</div>
            </div>
          `).join('')}

          ${widgetState.pensando ? `<div class="luma-wm-bubble bot luma-wm-digitando" role="status" aria-label="Assistente digitando">
            <span></span><span></span><span></span>
          </div>` : ''}

          <div class="luma-wm-chat-status" role="status"><span aria-hidden="true"></span>Atendimento automático — não há fila de humano por aqui.</div>
        </div>

        <div id="luma-wm-attach-area"></div>

        <div class="luma-wm-chat-input-bar">
          <textarea id="luma-wm-input-box" placeholder="Escreva sua mensagem" aria-label="Mensagem para o suporte" oninput="lumaWidgetInputCheck(this)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();lumaWidgetSendMsg();}"></textarea>
          <div class="luma-wm-chat-input-tools">
            <div class="luma-wm-input-actions">
              <button type="button" class="luma-wm-tool-btn" onclick="lumaWidgetTriggerFileSelect()" aria-label="Anexar imagem ou arquivo" title="Anexar arquivo">${WIDGET_SVGS.paperclip}</button>
              <button type="button" class="luma-wm-tool-btn" id="luma-wm-mic-btn" onclick="lumaWidgetStartVoiceDictation()" aria-label="Ditar mensagem por voz" title="Ditar por voz">${WIDGET_SVGS.mic}</button>
              <select class="luma-wm-inline-model-select" onchange="lumaWidgetSetModel(this.value)" aria-label="Selecione o Modelo de IA" title="Modelo de IA">
                <option value="gemini-flash-latest" ${selModel === 'gemini-flash-latest' ? 'selected' : ''}>Gemini Flash</option>
                <option value="gemini-2.0-flash" ${selModel === 'gemini-2.0-flash' ? 'selected' : ''}>Gemini 2.0 Flash</option>
                <option value="gemini-1.5-pro" ${selModel === 'gemini-1.5-pro' ? 'selected' : ''}>Gemini 1.5 Pro</option>
                <option value="gemini-1.5-flash-8b" ${selModel === 'gemini-1.5-flash-8b' ? 'selected' : ''}>Gemini Flash 8B</option>
              </select>
            </div>
            <button type="button" class="luma-wm-send-btn" id="luma-wm-send-trigger" onclick="lumaWidgetSendMsg()" aria-label="Enviar mensagem">${WIDGET_SVGS.send}</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderHelpTab() {
    return `
      <div class="luma-wm-search">
        <input id="luma-wm-help-search" type="search" placeholder="Busque por uma dúvida" aria-label="Buscar artigos de ajuda" value="${wmEsc(widgetState.searchQuery)}" oninput="lumaWidgetFilterHelp(this.value)">
        ${WIDGET_SVGS.search}
      </div>

      <div class="luma-wm-section-head">
        <span class="luma-wm-eyebrow">Guias e respostas</span>
        <span>${LUMA_ARTICLES.length} artigos</span>
      </div>

      <div id="luma-wm-articles-list" class="luma-wm-articles-list">
        ${LUMA_ARTICLES.map(wmRenderArticleCard).join('')}
      </div>
    `;
  }

  function renderArticleViewTab() {
    const article = LUMA_ARTICLES.find(a => a.id === widgetState.selectedArticleId);
    if (!article) return renderHelpTab();

    return `
      <div class="luma-wm-article-view">
        <button type="button" class="luma-wm-article-back" onclick="lumaWidgetSetTab('help')">
          ${WIDGET_SVGS.back} Voltar aos artigos
        </button>

        <span class="luma-wm-eyebrow">${wmEsc(wmArticleCategory(article))}</span>
        <h3 class="luma-wm-article-title">${wmEsc(article.title)}</h3>
        
        <div class="luma-wm-article-meta">
          <span>${wmEsc(wmArticleMeta(article))}</span>
        </div>

        <div class="luma-wm-article-body">
          <p class="luma-wm-article-lead">${wmEsc(article.summary)}</p>

          ${article.steps.map(step => `
            <div class="luma-wm-article-step">
              <span class="luma-wm-article-step-marker" aria-hidden="true">${wmEsc(String(step.num).replace(/\D/g, '') || '•')}</span>
              <div>
                <div class="luma-wm-article-step-num">${wmEsc(step.num)}</div>
                <div class="luma-wm-article-step-title">${wmEsc(step.title)}</div>
                <p>${wmEsc(step.text)}</p>
              </div>
            </div>
          `).join('')}

          ${article.tip ? `
            <div class="luma-wm-article-box-tip">
              <span aria-hidden="true">${WIDGET_SVGS.sparkle}</span>
              <div><strong>Dica do Luma</strong><p>${wmEsc(article.tip)}</p></div>
            </div>
          ` : ''}

          <div class="luma-wm-article-feedback">
            <strong>Esta resposta resolveu sua dúvida?</strong>
            <div class="luma-wm-feedback-actions">
              <button type="button" class="luma-wm-btn-secondary" onclick="lumaWidgetArticleFeedback(true)">Sim, resolveu</button>
              <button type="button" class="luma-wm-btn-secondary" onclick="lumaWidgetArticleFeedback(false)">Ainda preciso de ajuda</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  window.lumaWidgetArticleFeedback = function (resolved) {
    if (resolved) {
      if (typeof gToast === 'function') gToast('Obrigado pelo feedback');
      return;
    }
    lumaWidgetStartChat();
  };

  window.lumaWidgetInputCheck = function (el) {
    const btn = document.getElementById('luma-wm-send-trigger');
    if (!btn) return;
    if (el.value.trim().length > 0 || widgetState.attachedFile) {
      btn.classList.add('ready');
    } else {
      btn.classList.remove('ready');
    }
  };

  // Material que ATERRA a resposta: os trechos da Central de Ajuda que casam com a
  // pergunta (gHelpKnowledge, em core/help.js) + o artigo do próprio widget que casar.
  // Antes ia a base INTEIRA do widget no prompt — caro, diluído, e sem a Central de
  // Ajuda real nem o FAQ do Sheets, então o modelo preenchia o vazio inventando.
  function lumaWidgetKnowledge(userMessage) {
    let ctx = '';
    try { if (typeof gHelpKnowledge === 'function') ctx = gHelpKnowledge(userMessage, 4) || ''; } catch (e) {}
    const lower = (userMessage || '').toLowerCase();
    const art = LUMA_ARTICLES.find(a => lower.includes(a.id) || a.title.toLowerCase().split(' ').some(w => w.length > 3 && lower.includes(w)));
    if (art) {
      ctx += (ctx ? '\n\n' : '') + '### ' + art.title + '\n' + art.summary + ' ' +
        art.steps.map(s => s.title + ': ' + s.text).join(' ');
    }
    return ctx;
  }

  async function lumaWidgetGenerateAIResponse(userMessage) {
    const temIA = typeof gAskAI === 'function' && typeof gAiReady === 'function' && gAiReady();

    // Devolve {text, fonte} — quem renderiza precisa saber a ORIGEM pra rotular a bolha.
    // Sem isso o usuário não distingue resposta de IA de busca na base, e o widget parecia
    // atendimento humano (era o rótulo "Suporte ao Vivo") quando nunca houve humano nenhum.
    const buscarNaBase = () => {
      const lower = (userMessage || '').toLowerCase();
      const matched = LUMA_ARTICLES.find(a => lower.includes(a.id) || a.title.toLowerCase().split(' ').some(w => w.length > 3 && lower.includes(w)));
      if (matched) {
        return { fonte: 'base',
          text: `Sobre "${matched.title}": ${matched.summary}\n\nPassos:\n` + matched.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`).join('\n') };
      }
      return null;
    };

    if (!temIA) {
      const daBase = buscarNaBase();
      if (daBase) return daBase;
      // Honestidade: NÃO existe notificação a humano nenhum aqui. O texto antigo prometia que
      // "Ryan e Pedro foram notificados no painel" — nada no código faz isso.
      return { fonte: 'indisponivel',
        text: 'Não encontrei isso na Central de Ajuda, e o assistente de IA está desligado no momento.\n\nTente descrever com outras palavras ou procure direto na aba "Explorar ajuda".' };
    }
    
    const material = lumaWidgetKnowledge(userMessage);
    // Sem material que case, NÃO chama a IA: ela responderia por conta própria sobre um
    // produto interno que não conhece. Melhor dizer que não está na Central.
    if (!material) {
      return { fonte: 'indisponivel',
        text: 'Não encontrei isso na Central de Ajuda.\n\nTente descrever com outras palavras, ou abra a aba "Explorar ajuda" pra ver os temas disponíveis.' };
    }

    const prompt = `Você é o assistente da Central de Ajuda do Luma, a ferramenta interna de criação de artes da Delivery Much. Quem pergunta é um franqueado (dono do app na cidade dele, não é designer) ou alguém do time de design.

RESPONDA APENAS COM BASE NO MATERIAL ABAIXO. Ele é a documentação real do produto.

MATERIAL DA CENTRAL DE AJUDA:
${material}

PERGUNTA: "${userMessage}"

REGRAS:
1. Se a resposta NÃO estiver no material, diga exatamente: "Isso não está na Central de Ajuda." e sugira procurar na aba "Explorar ajuda". Não invente tela, botão ou caminho.
2. Não prometa contato humano, ticket ou notificação — isso não existe aqui.
3. Sem emoji. Português do Brasil, direto e amigável, no máximo 5 linhas.
4. Quando o material tiver passos, responda em passos curtos.`;

    const txt = await gAskAI('ajuda', prompt, { json: false });
    if (txt && txt.trim()) return { fonte: 'ia', text: txt.trim() };

    // IA não respondeu → entrega o artigo cru, que é melhor que nada e não mente.
    console.warn('[Luma IA Suporte] sem resposta da IA, caindo na base');
    const daBase = buscarNaBase();
    if (daBase) return { fonte: 'base', text: daBase.text };
    return { fonte: 'erro',
      text: 'Não consegui falar com o assistente de IA agora.\n\nTente de novo em instantes ou procure na aba "Explorar ajuda".' };
  }

  window.lumaWidgetSendMsg = async function () {
    const input = document.getElementById('luma-wm-input-box');
    const msgText = input ? input.value.trim() : '';

    if (!msgText && !widgetState.attachedFile) return;

    const newMsg = {
      sender: 'user',
      author: 'Você',
      text: msgText,
      image: widgetState.attachedFile ? widgetState.attachedFile.dataUrl : null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Teto do historico. O array segurava a conversa INTEIRA da sessao, com cada print
    // anexado vivo como dataURL: uma sessao longa de suporte (algumas fotos de tela) somava
    // dezenas de MB presos na aba, e o render (map sobre messages) repintava tudo a cada
    // mensagem nova. Mantem as ultimas 40 falas; a imagem, so nas 4 ultimas -- e ela que pesa,
    // o texto e barato e preserva a leitura do historico.
    const _podarMensagens = () => {
      const M = widgetState.messages;
      if(M.length > 40) M.splice(0, M.length - 40);
      for(let i = 0; i < M.length - 4; i++) if(M[i] && M[i].image) M[i].image = null;
    };

    widgetState.messages.push(newMsg);
    _podarMensagens();
    widgetState.attachedFile = null;
    if (input) input.value = '';

    renderWidgetModalContent();

    // "Digitando" enquanto espera: a chamada de IA leva 1–3s e antes disso a tela ficava
    // parada, sem sinal de que algo estava acontecendo.
    widgetState.pensando = true;
    renderWidgetModalContent();

    const r = await lumaWidgetGenerateAIResponse(msgText);
    widgetState.pensando = false;

    // Rótulo pela ORIGEM — nunca "ao vivo": não há humano do outro lado.
    const AUTORES = {
      ia:           'Assistente de IA',
      base:         'Central de Ajuda',
      indisponivel: 'Central de Ajuda',
      erro:         'Central de Ajuda'
    };
    widgetState.messages.push({
      sender: 'bot',
      author: AUTORES[r.fonte] || 'Assistente Luma',
      fonte: r.fonte,
      text: r.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    _podarMensagens();
    renderWidgetModalContent();
  };

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHelpWidget);
  } else {
    initHelpWidget();
  }
})();
