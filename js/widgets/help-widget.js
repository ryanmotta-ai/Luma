/* ── LUMA HELP WIDGET ──
 * Ajuda contextual, artigos e mensagens com a mesma linguagem visual do Luma.
 */

(function () {
  let lastHelpTrigger = null;
  let widgetState = {
    isOpen: false,
    // 'home' | 'news' | 'novidade' | 'messages' | 'assistente' | 'help' | 'collection' | 'article'
    activeTab: 'home',
    hasActiveChat: false,
    messages: [],
    attachedFile: null,
    isListening: false,
    selectedArticleId: null,
    selectedColId: null,
    selectedNewsId: null,
    articleBack: 'help',    // de onde o artigo foi aberto: é para lá que o "voltar" leva
    newsBack: 'home',
    // try/catch obrigatório: isto roda no CORPO do objeto, na carga do script. Em modo privado
    // (ou com storage bloqueado por política) o getItem LANÇA e o arquivo inteiro morre — o
    // widget de ajuda simplesmente não existiria na sessão.
    searchQuery: '',
    pillTimer: null,
    pillHideTimer: null,
    pillMessageIndex: -1,
    // Suporte ao vivo (js/core/suporte.js). O rascunho mora no estado porque CADA mensagem nova
    // re-renderiza o painel — sem isto, o que a pessoa digitava sumia quando a resposta chegava.
    supRascunho: '',
    supOrigem: null,        // 'assistente' quando a conversa veio do "Não resolveu?" da IA
    supFiltro: 'aguardando',
    supErro: '',
    supEnviando: false
  };

  /* ── A BASE DA AJUDA (redesenho de 26/09/2026, referência: Deskfy) ────────────────────────
     Organizada pelo que a pessoa QUER FAZER (coleção), não por quem ela é: a lista antiga era
     uma fila de 10 artigos, metade do Estúdio aparecendo para o franqueado.
     ⛔ Cada frase aqui foi conferida no código na data acima — rótulo de botão, limite, formato.
     A base antiga prometia coisas que não existem ("Exibir Preço Promocional", "PDF Vetorial",
     "reduz 90% dos pedidos") e a IA repetia, porque ela se aterra nestes textos
     (lumaWidgetKnowledge). Botão mudou de nome? O artigo muda junto.
     ⛔ Não existe "Baixar PDF" na tela (fBaixarPDF não tem chamador) nem "publicar no Instagram"
     (saiu de propósito em 11/09, ver chat.js). Não escreva artigo sobre nenhum dos dois.
     `aud:'equipe'` = só equipe_dm/gestao vê (gIsAdmin). Copy estática nossa, mas passa por
     wmEsc mesmo assim: custa nada e não depende de ninguém lembrar. */
  const WM_COLECOES = [
    { id: 'comece',    icon: 'play',     title: 'Comece por aqui',         desc: 'Sua primeira arte em um minuto' },
    { id: 'preencher', icon: 'text',     title: 'Preencher a arte',        desc: 'Textos, preços e o que fazer quando não cabe' },
    { id: 'fotos',     icon: 'image',    title: 'Fotos e logo',            desc: 'Enviar, colar, trocar e enquadrar' },
    { id: 'entregar',  icon: 'download', title: 'Baixar e postar',         desc: 'O arquivo e a legenda do post' },
    { id: 'lote',      icon: 'layers',   title: 'Várias artes de uma vez', desc: 'A planilha que gera dezenas de artes' },
    { id: 'minhas',    icon: 'history',  title: 'Minhas artes',            desc: 'Continuar, baixar de novo e duplicar' },
    { id: 'estudio',   icon: 'compass',  title: 'Estúdio',                 desc: 'Criar, preparar e publicar templates', aud: 'equipe' }
  ];

  const LUMA_ARTICLES = [
    { id: 'primeira-arte', col: 'comece', min: 1, kw: 'começar gerar criar campanha material',
      title: 'Criar sua primeira arte',
      summary: 'Você escolhe o material, responde algumas perguntas e baixa. Leva cerca de um minuto.',
      steps: ['Escolha uma campanha no catálogo.', 'Toque no material que quer usar.', 'Responda as perguntas do chat: produto, preço, foto, o que aquele material pedir.', 'Confira a prévia e toque em Baixar PNG.'],
      tip: 'Não precisa acertar de primeira: dá para voltar uma pergunta, editar qualquer campo e gerar de novo quantas vezes quiser.' },
    { id: 'qual-formato', col: 'comece', min: 1, kw: 'formato story feed post wide tamanho medida',
      title: 'Qual formato escolher',
      summary: 'Escolha pelo lugar onde a arte vai aparecer.',
      steps: ['Story (1080×1920): Stories do Instagram e status do WhatsApp.', 'Feed (1080×1350): publicação no feed do Instagram.', 'Post wide (1200×628): banners e formatos mais largos.'],
      tip: 'Muitos materiais já vêm num formato só, pensado para aquela peça.' },
    { id: 'marca', col: 'comece', min: 1, kw: 'marca cor fonte logo travado fixo bloqueado não muda',
      title: 'Por que alguns itens da arte não mudam',
      summary: 'Cores, fontes e o logo da Delivery Much vêm travados no material.',
      steps: ['A equipe DM monta cada material e escolhe o que você pode trocar.', 'Você preenche o conteúdo: produto, preço, foto, validade.', 'O resto fica fixo para a peça sair sempre dentro da marca. Na prévia, tocar num item travado mostra "Fixo da marca".'],
      tip: 'Precisa de uma arte que não está no catálogo? O pedido é com o marketing da sua empresa.' },

    { id: 'campos', col: 'preencher', min: 2, kw: 'preço valor cupom código desconto validade data de por máscara',
      title: 'Preencher textos, preços e cupons',
      summary: 'O Luma formata cada tipo de campo para você. Digite do jeito mais simples.',
      steps: ['Preço: digite só o número, como 9,90. O Luma coloca o R$ e os centavos.', 'Desconto: digite 20 e ele vira "20% off".', 'Cupom: sai em letras maiúsculas, sem espaço, com pelo menos 3 caracteres.', 'Preço "de/por": o "por" precisa ser menor que o "de", senão a oferta não existe.'],
      tip: 'Se algo não estiver no formato certo, o Luma diz o que corrigir quando você tenta avançar.' },
    { id: 'texto-nao-cabe', col: 'preencher', min: 1, kw: 'não cabe grande longo encurtar limite caracteres cortado estourado',
      title: 'O texto não cabe na arte',
      summary: 'Cada texto tem um espaço reservado na arte. Se o que você digitou for maior que ele, o Luma avisa antes de gerar.',
      steps: ['Olhe o contador embaixo do campo: ele mostra quanto cabe naquele espaço.', 'Perto do limite, aparece o botão Encurtar. Toque para ver versões mais curtas do mesmo texto.', 'Escolha uma, ou edite do seu jeito, e siga para a próxima pergunta.'],
      tip: 'Abreviações de cardápio ajudam muito: "c/" no lugar de "com". O Luma nunca gera a arte com o texto cortado.' },
    { id: 'corrigir', col: 'preencher', min: 1, kw: 'voltar corrigir errei mudar resposta editar refazer apagar',
      title: 'Corrigir uma resposta',
      summary: 'Nada do que você respondeu se perde. Escolha o caminho mais curto.',
      steps: ['No chat, toque em Voltar uma pergunta para refazer a anterior.', 'Na prévia, toque num texto ou na foto para editar direto nela.', 'Com a arte pronta, toque em Editar arte para rever os campos sem perder nada.', 'Quer começar do zero? Toque em Refazer. O Luma confirma antes de apagar as respostas.'] },

    { id: 'enviar-foto', col: 'fotos', min: 1, kw: 'foto imagem enviar upload png jpg webp 20mb colar arrastar recente',
      title: 'Enviar a foto do produto',
      summary: 'PNG, JPG ou WebP, até 20 MB.',
      steps: ['Na pergunta da foto, toque em Escolher imagem.', 'Ou cole uma imagem copiada (Ctrl+V) ou arraste o arquivo para dentro do chat.', 'As fotos que você já usou aparecem em Imagens recentes, para reaproveitar sem enviar de novo.'],
      tip: 'Foto muito pequena (menos de 400 pixels no lado menor) é recusada, porque sairia pixelada. Quanto maior, mais nítida a arte.' },
    { id: 'ajustar-foto', col: 'fotos', min: 1, kw: 'trocar ajustar enquadrar zoom reposicionar cortar foto',
      title: 'Trocar ou ajustar a foto',
      summary: 'Dá para trocar a foto ou mudar o enquadramento sem refazer a arte.',
      steps: ['Na prévia, toque na foto.', 'Escolha Trocar foto para enviar outra, ou Reposicionar e Zoom para mudar o enquadramento.', 'No chat, o cartão da foto também tem os botões Trocar e Ajustar.'],
      tip: 'No celular, o ajuste abre em tela cheia, com espaço para arrastar a foto com o dedo.' },
    { id: 'logo', col: 'fotos', min: 1, kw: 'logo marca loja parceiro transparente',
      title: 'Usar o logo da loja',
      summary: 'O Luma enquadra o logo sozinho, sem cortar.',
      steps: ['Na pergunta do logo, envie o arquivo da loja. PNG com fundo transparente fica melhor.', 'O Luma dá zoom até a marca ocupar a moldura, sem cortar nada.', 'Se o logo ficar pequeno ou fora do lugar, toque em Ajustar e posicione do seu jeito.'] },

    { id: 'baixar', col: 'entregar', min: 1, kw: 'baixar download png arquivo salvar nome pdf imprimir',
      title: 'Baixar a arte',
      summary: 'Quando a arte fica pronta, ela aparece no chat com os botões de entrega.',
      steps: ['Toque em Baixar PNG.', 'O arquivo sai com um nome fácil de achar: produto, formato e campanha.', 'A arte também fica salva em Minhas artes, para baixar de novo depois.'],
      tip: 'Hoje a arte sai em PNG, o formato que Instagram e WhatsApp aceitam direto. Não há download em PDF.' },
    { id: 'legenda', col: 'entregar', min: 1, kw: 'legenda texto post instagram whatsapp copiar hashtag',
      title: 'Copiar a legenda do post',
      summary: 'Junto com a arte pronta vem uma legenda para publicar.',
      steps: ['Embaixo da arte, procure o cartão Legenda pronta.', 'Toque em Copiar legenda e cole no Instagram ou no WhatsApp.', 'Quando houver outras opções, Gerar outra sugestão troca o texto.'],
      tip: 'O Luma não publica por você: você baixa a arte, copia a legenda e posta pelo app de sempre.' },

    { id: 'lote', col: 'lote', min: 2, kw: 'lote planilha sheets csv excel várias muitas cardápio massa',
      title: 'Gerar várias artes de uma vez',
      summary: 'Precisa de uma arte por produto, tipo um cardápio inteiro? O lote faz tudo de uma vez.',
      steps: ['Com uma arte pronta, toque em Gerar em lote.', 'Preencha a planilha: cada linha vira uma arte. Dá para digitar direto, colar do Excel ou enviar o CSV Modelo.', 'Confira as artes na prévia ao lado da planilha e gere todas.'],
      tip: 'Em "Preencher um campo de uma vez" você aplica o mesmo valor, um desconto ou o final ",90" em todas as linhas.' },

    { id: 'minhas-artes', col: 'minhas', min: 1, kw: 'minhas artes histórico rascunho continuar duplicar baixar de novo',
      title: 'Continuar ou baixar de novo',
      summary: 'Tudo que você começa ou baixa fica salvo em Minhas artes.',
      steps: ['Abra Minhas artes.', 'Em cada arte, use Abrir e editar para continuar de onde parou.', 'Use Baixar PNG para baixar de novo, ou Duplicar para partir dela numa arte nova.'] },

    { id: 'estudio-campos', col: 'estudio', min: 2, aud: 'equipe', kw: 'campo variável editável estúdio designer',
      title: 'Transformar um texto ou imagem em campo',
      summary: 'Campo é o que o franqueado vai poder trocar sem mexer no layout.',
      steps: ['Selecione a camada no Estúdio.', 'Abra Campos: o Luma sugere o campo mais provável pelo nome e pelo conteúdo da camada.', 'Aceite a sugestão ou crie outro, e confira a ordem em que o franqueado será perguntado.'],
      tip: 'Antes de criar um campo novo, o Luma avisa se já existe um igual. Reaproveitar mantém a pergunta igual em toda a rede.' },
    { id: 'estudio-psd', col: 'estudio', min: 2, aud: 'equipe', kw: 'psd photoshop importar camadas fidelidade',
      title: 'Importar um PSD',
      summary: 'O arquivo do Photoshop vira template, camada por camada.',
      steps: ['No Estúdio, use Importar PSD e escolha o arquivo.', 'Na revisão, confira as camadas e quais viram campo.', 'Confirme e compare com o original antes de publicar.'],
      tip: 'Se faltar alguma fonte do PSD, a revisão avisa e deixa enviar o arquivo da fonte ali mesmo.' },
    { id: 'estudio-publicar', col: 'estudio', min: 2, aud: 'equipe', kw: 'publicar template campanha validade permissão catálogo',
      title: 'Publicar para os franqueados',
      summary: 'Publicar leva o template para o catálogo da rede.',
      steps: ['Com o template pronto, toque em Publicar.', 'Escolha a campanha, o que o franqueado pode trocar e a validade.', 'Confirme: o material passa a aparecer no catálogo.'] }
  ];

  /* "Nesta tela": os 2 artigos da tela onde a pessoa está. A ordem importa: a primeira classe
     do body que casar vence (arte pronta é mais específica que o chat). */
  const WM_NESTA_TELA = [
    ['mode-designer',      ['estudio-campos', 'estudio-publicar']],
    ['f-history-mode',     ['minhas-artes', 'baixar']],
    ['f-home-mode',        ['primeira-arte', 'qual-formato']],
    ['f-material-browser', ['primeira-arte', 'qual-formato']],
    ['f-bulk-folha',       ['lote', 'campos']],
    ['f-arte-pronta',      ['baixar', 'legenda']],
    ['mode-franqueado',    ['texto-nao-cabe', 'ajustar-foto']]
  ];

  /* ── NOVIDADES DO LUMA (a primeira tela) ──────────────────────────────────────────────────
     Decisão de 26/09/2026: a novidade mora AQUI, no código, e não numa tabela. Novidade do
     Luma é o que acabou de ir ao ar — isso já exige deploy, então escrever a notícia é uma
     linha a mais no mesmo commit. Tabela editável só compensa quando alguém de fora do
     desenvolvimento for publicar novidade.
     Mais recente PRIMEIRO. `data` em AAAA-MM-DD. `arte` = ilustração em CSS (wmNovidadeArte);
     sem ela, o cartão sai só com o ícone. `requer:'suporte'` esconde a notícia quando o
     suporte ao vivo está desligado — notícia de recurso desligado é promessa falsa.
     ⛔ Mesma regra dos artigos: só o que existe na tela, com o nome que está na tela. */
  const LUMA_NOVIDADES = [
    { id: 'quebra-linha', data: '2026-09-26', icon: 'text', arte: 'quebra',
      title: 'Quebras de linha mais bonitas',
      summary: 'O texto da arte agora se divide em linhas de tamanho parecido, sem palavra sozinha no fim.',
      body: ['O Luma passou a escolher onde quebrar cada texto olhando o conjunto: as linhas saem com tamanho parecido, sem preposição ou "+" pendurado no fim, sem separar o número do que ele conta e sem largar uma palavra sozinha na última linha.', 'Você não precisa fazer nada: vale para todas as artes.'] },
    { id: 'encurtar', data: '2026-09-24', icon: 'scissors', arte: 'encurtar',
      title: 'Texto grande demais? Toque em Encurtar',
      summary: 'O Luma sugere versões mais curtas do seu texto sem mudar o que você está vendendo.',
      body: ['Quando o que você digitou está perto do limite ou não cabe no espaço da arte, o botão Encurtar aparece no campo.', 'O Luma sugere versões mais curtas que mantêm o produto, o preço e a oferta. Você escolhe uma ou edita do seu jeito.'],
      artigo: 'texto-nao-cabe' },
    { id: 'suporte', data: '2026-09-23', icon: 'chat', arte: 'suporte', requer: 'suporte',
      title: 'Fale com a equipe DM por aqui',
      summary: 'Quando alguém da equipe está no Luma, sua pergunta vai direto para uma pessoa.',
      body: ['Travou em alguma etapa? Agora dá para conversar com a equipe DM sem sair do Luma. Quando alguém da equipe está com o Luma aberto, sua pergunta vai direto para essa pessoa.', 'Se ninguém estiver online, o assistente responde na hora. O que você mandar para a equipe fica em Mensagens, e a resposta aparece lá.', 'Aprovação de peça e pedido de arte nova continuam com o marketing da sua empresa.'],
      perguntar: true },
    { id: 'foto-previa', data: '2026-09-23', icon: 'crop', arte: 'foto',
      title: 'Ajuste a foto direto na prévia',
      summary: 'Toque na foto dentro da prévia para trocar, reposicionar ou dar zoom.',
      body: ['A foto agora se ajusta pela própria arte: toque nela na prévia e escolha Trocar foto ou Reposicionar e Zoom.', 'No celular, o ajuste abre em tela cheia, com espaço para arrastar a foto com o dedo.'],
      artigo: 'ajustar-foto' },
    { id: 'enquadramento', data: '2026-09-23', icon: 'image',
      title: 'Foto e logo já entram no lugar certo',
      summary: 'O Luma olha a imagem que você envia e decide o enquadramento de partida.',
      body: ['O logo ganha zoom até a marca ocupar a moldura, sem cortar. A foto do produto é centralizada no que importa.', 'Se quiser mudar, é só tocar em Ajustar.'],
      artigo: 'logo' },
    { id: 'nome-arquivo', data: '2026-09-23', icon: 'file',
      title: 'Arquivo baixado com nome de gente',
      summary: 'A arte baixada vem com o nome do produto, do formato e da campanha.',
      body: ['Nada de nome aleatório na galeria: o arquivo agora sai com um nome que dá para reconhecer, como "X-Tudo Duplo - Story - Copa.png".'],
      artigo: 'baixar' }
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
    users: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    sparkle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/><path d="m5 12 .7 1.8 1.8.7-1.8.7L5 17l-.7-1.8-1.8-.7 1.8-.7L5 12Z"/></svg>'
  };

  // Ícones das coleções, novidades e artigo: só o traço; wmIco monta o SVG no tamanho pedido.
  const WM_ICO = {
    play: '<path d="m9 18 6-6-6-6v12Z"/>',
    text: '<path d="M4 6h16M4 12h10M4 18h13"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.2 1 2h6c0-.8.4-1.4 1-2A6 6 0 0 0 12 3Z"/>',
    up: '<path d="M7 10v11H4V10zM7 10l5-7c1.3 0 2 .9 2 2v3h5.2a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 17 21H7"/>',
    down: '<path d="M17 14V3h3v11zM17 14l-5 7c-1.3 0-2-.9-2-2v-3H4.8a2 2 0 0 1-2-2.3l1.3-7A2 2 0 0 1 7 3h10"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    file: '<path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5M9 13h6M9 17h4"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    ask: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'
  };
  function wmIco(nome, tam) {
    const t = tam || 18;
    return `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WM_ICO[nome] || WM_ICO.text}</svg>`;
  }

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
      detail: 'Busque uma dúvida ou pergunte ao assistente.'
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

  // Equipe (equipe_dm/gestao) vê também a coleção do Estúdio. É só filtro de CONTEÚDO de
  // ajuda — não é fronteira de segurança nenhuma (essa mora na RLS).
  function wmEquipe() { return typeof gIsAdmin === 'function' && gIsAdmin(); }
  function wmVisivel(item) { return !!item && (item.aud !== 'equipe' || wmEquipe()); }
  function wmColecao(id) { return WM_COLECOES.find(function (c) { return c.id === id; }) || null; }
  function wmArtigo(id) { return LUMA_ARTICLES.find(function (a) { return a.id === id; }) || null; }
  function wmArtigosDa(colId) {
    return LUMA_ARTICLES.filter(function (a) { return a.col === colId && wmVisivel(a); });
  }

  const WM_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const WM_MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  // 'T12:00' de propósito: '2026-09-23' puro vira meia-noite UTC e, no Brasil, o dia 22.
  function wmData(iso) { const d = new Date(String(iso) + 'T12:00:00'); return isNaN(d) ? null : d; }
  function wmDataCurta(iso) { const d = wmData(iso); return d ? d.getDate() + ' ' + WM_MESES[d.getMonth()] : ''; }
  function wmDataLonga(iso) { const d = wmData(iso); return d ? d.getDate() + ' de ' + WM_MESES_LONGOS[d.getMonth()] : ''; }
  // "Novo" por idade (14 dias), sem guardar o que a pessoa já viu: o painel abre na Início,
  // então um "não lido" se apagaria no mesmo instante em que aparece.
  function wmNovidadeNova(n) { const d = wmData(n.data); return !!d && (Date.now() - d.getTime()) < 14 * 86400000; }
  function wmNovidades() {
    return LUMA_NOVIDADES.filter(function (n) { return n.requer !== 'suporte' || wmSuporte(); });
  }

  function wmPrimeiroNome() {
    const u = typeof gCurrentUser === 'function' ? gCurrentUser() : null;
    // displayName cai no começo do e-mail quando o perfil não tem nome ("ryan.motta").
    const p = String((u && u.displayName) || '').trim().split(/[\s._-]+/)[0] || '';
    return p ? p.charAt(0).toUpperCase() + p.slice(1) : '';
  }

  function wmRenderArtRow(a, origem, comColecao) {
    const col = comColecao ? wmColecao(a.col) : null;
    return `<button type="button" class="luma-wm-row" onclick="lumaWidgetOpenArticle('${a.id}','${origem}')">
        <span class="luma-wm-row-txt">${col ? `<small>${wmEsc(col.title)}</small>` : ''}<strong>${wmEsc(a.title)}</strong></span>
        <span class="luma-wm-list-arrow" aria-hidden="true">${WIDGET_SVGS.chevronRight}</span>
      </button>`;
  }

  /* Ilustração da novidade: fragmento de UI em CSS, não imagem — zero arquivo novo, nítido em
     qualquer tela e acompanha o tema. O texto de dentro é decoração (aria-hidden). */
  function wmNovidadeArte(chave) {
    const faisca = WIDGET_SVGS.sparkle.replace('width="18" height="18"', 'width="11" height="11"');
    const artes = {
      suporte: `<span class="luma-wm-il-pill"><i class="luma-wm-sup-dot"></i>Equipe online</span>
        <span class="luma-wm-il-bub eu">Como troco a foto depois de gerar?</span>
        <span class="luma-wm-il-bub eles"><b>Equipe DM</b>Toque na foto na prévia e em Trocar foto.</span>`,
      encurtar: `<span class="luma-wm-il-campo"><small>Nome do produto</small><strong>X-Tudo Duplo <s>com Bacon Crocante</s></strong>
        <span class="luma-wm-il-campo-pe"><span>Não cabe na arte</span><span class="luma-wm-il-chip">${faisca}Encurtar</span></span></span>`,
      quebra: `<span class="luma-wm-il-antes"><small>Antes</small><b>X-Tudo Duplo com</b><b>bacon</b></span>
        <span class="luma-wm-il-agora"><small>Agora</small><b>X-Tudo Duplo</b><b>com bacon</b></span>`,
      foto: `<span class="luma-wm-il-moldura"><i class="luma-wm-il-prato"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i></span>
        <span class="luma-wm-il-chip">${wmIco('crop', 11)}Reposicionar e Zoom</span>`
    };
    return artes[chave] ? `<span class="luma-wm-il luma-wm-il-${chave}" aria-hidden="true">${artes[chave]}</span>` : '';
  }

  /* ── CABEÇALHO ────────────────────────────────────────────────────────────────────────────
     Início = saudação (o "Olá! Como podemos ajudar?" do Deskfy). Toda outra tela = barra
     curta com voltar, título e fechar — o espaço vai para o conteúdo. Na conversa, a barra
     diz QUEM responde: assistente ou equipe, que é a informação que muda o que se escreve. */
  function wmVoltarAlvo() {
    const t = widgetState.activeTab;
    if (t === 'news' || t === 'assistente') return 'home';
    if (t === 'novidade') return widgetState.newsBack || 'home';
    if (t === 'collection') return 'help';
    if (t === 'article') return widgetState.articleBack || 'help';
    return null;
  }

  function wmAvataresOnline(tam) {
    return `<span class="luma-wm-sup-avatares${tam ? ' ' + tam : ''}" aria-hidden="true">${G_SUP.online.slice(0, 3).map(function (n) {
      return `<span class="luma-wm-sup-av">${wmEsc(wmSupIniciais(n))}</span>`; }).join('')}</span>`;
  }

  function wmBarCopy() {
    const t = widgetState.activeTab;
    if (t === 'messages' && wmSuporte()) return wmSupHeader();
    if (t === 'assistente' || (t === 'messages' && widgetState.hasActiveChat)) {
      return { title: 'Assistente do Luma', ia: true,
        detail: wmSuporte() ? 'A equipe DM também pode ajudar' : 'Responde pela Central de Ajuda' };
    }
    if (t === 'messages') return { title: 'Mensagens' };
    if (t === 'news') return { title: 'Novidades' };
    if (t === 'novidade') return { title: 'Novidade' };
    return { title: 'Ajuda' };
  }

  function wmHeaderHTML() {
    const fechar = `<button type="button" class="luma-wm-close-btn" onclick="lumaWidgetClose()" aria-label="Fechar central de ajuda">${WIDGET_SVGS.close}</button>`;
    if (widgetState.activeTab === 'home') {
      const nome = wmPrimeiroNome();
      return `<header class="luma-wm-header luma-wm-hero">
          <div class="luma-wm-header-top">
            <div class="luma-wm-brand">
              <img src="assets/logos/luma-h-cor.png" alt="Luma" class="luma-wm-brand-logo-img luma-wm-logo-light">
              <img src="assets/logos/luma-h-branca.png" alt="Luma" class="luma-wm-brand-logo-img luma-wm-logo-dark">
              <span class="luma-wm-brand-divider" aria-hidden="true"></span>
              <span class="luma-wm-brand-label">Ajuda</span>
            </div>
            <div class="luma-wm-header-actions">${wmSupEquipeOnline() ? wmAvataresOnline() : ''}${fechar}</div>
          </div>
          <p class="luma-wm-hero-oi">${nome ? 'Olá, ' + wmEsc(nome) : 'Olá!'}</p>
          <h2 class="luma-wm-hero-title" id="luma-wm-title">Como podemos ajudar?</h2>
        </header>`;
    }
    const c = wmBarCopy();
    const alvo = wmVoltarAlvo();
    const voltar = alvo
      ? `<button type="button" class="luma-wm-icon-btn" onclick="lumaWidgetVoltar()" aria-label="Voltar">${WIDGET_SVGS.back}</button>`
      : '<span class="luma-wm-bar-gap" aria-hidden="true"></span>';
    const ident = c.ia || c.detail;
    const marca = c.ia ? `<span class="luma-wm-bar-mark" aria-hidden="true">${WIDGET_SVGS.sparkle}</span>`
      : (c.online && !G_SUP.souEquipe && G_SUP.online.length ? wmAvataresOnline('mini') : '');
    return `<header class="luma-wm-header luma-wm-bar${ident ? ' is-ident' : ''}">
        ${voltar}${marca}
        <div class="luma-wm-bar-title">
          <h2 id="luma-wm-title">${wmEsc(c.title)}</h2>
          ${c.detail ? `<p${c.online ? ' class="luma-wm-sup-status"' : ''}>${c.online ? '<i class="luma-wm-sup-dot" aria-hidden="true"></i>' : ''}${wmEsc(c.detail)}</p>` : ''}
        </div>
        ${fechar}
      </header>`;
  }

  /* gOpenHelp/gOpenHelpTopic (help.js) abriam, fora do Estúdio, um SEGUNDO widget (#fhw) com
     outra base de artigos — dois caminhos para a mesma ajuda. Agora todo modo cai aqui. O
     portão do Controle do produto (global.help) que o gOpenHelp original fazia vem junto. */
  function connectLegacyDesignerHelp() {
    const abrir = function (trigger, aba) {
      if (typeof gFeatureCan === 'function' && !gFeatureCan('global.help', 'access')) {
        if (typeof gFeatureBlockedFeedback === 'function') gFeatureBlockedFeedback('global.help');
        return;
      }
      window.lumaWidgetOpen(trigger instanceof HTMLElement ? trigger : undefined);
      if (aba) window.lumaWidgetSetTab(aba);
    };
    window.gOpenHelp = function (trigger) { abrir(trigger); };
    window.gOpenHelpTopic = function (topicId, trigger) { abrir(trigger, 'help'); };
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
    if (typeof gSupOnChange === 'function') gSupOnChange(wmSupAoMudar);
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

  /* ── O DOCK NASCE DO BOTÃO QUE FOI CLICADO ───────────────────────────────────────────────
     Antes a posição vinha só de regras de CSS por contexto (`body.mode-designer`,
     `f-home-mode`, slot do dock do franqueado): o painel abria no canto de sempre mesmo
     quando o clique tinha saído de um botão no topo da tela, e a animação crescia de um
     canto onde não havia botão nenhum. Agora medimos o acionador e encostamos o painel
     nele — borda direita alinhada com a do botão, abrindo para baixo se o botão está na
     metade de cima da tela e para cima se está embaixo.
     ⛔ Só no desktop: abaixo de 900px o CSS transforma o painel em folha de tela cheia, e
     ancorar num botão de 44px ali não faz sentido. Fora desses casos, tudo volta ao CSS —
     por isso o reset limpa as propriedades em vez de gravar valores "neutros". */
  function wmAncorar() {
    const modal = document.getElementById('luma-widget-modal');
    if (!modal) return;
    ['right', 'left', 'top', 'bottom', 'height', 'transform-origin'].forEach(function (prop) {
      modal.style.removeProperty(prop);
    });
    const el = lastHelpTrigger;
    // body = aberto sem botão nenhum (gOpenHelp() sem argumento, foco solto): ancorar "no
    // body" jogava o painel para BAIXO da tela inteira — top = altura da janela + folga.
    if (!el || el === document.body || !el.isConnected || window.innerWidth < 900) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;                    // botão escondido: mantém o CSS

    const MARGEM = 16, FOLGA = 12;
    // Mesma largura do CSS (#luma-widget-modal). 400px desde o redesenho de 26/09: o painel é
    // um mensageiro (Deskfy/Intercom), não uma segunda tela — 760px cobria metade do app.
    const largura = Math.min(400, window.innerWidth - 32);
    const direita = Math.min(
      Math.max(window.innerWidth - r.right, MARGEM),
      Math.max(MARGEM, window.innerWidth - largura - MARGEM)
    );
    const paraBaixo = r.top < window.innerHeight / 2;
    const espaco = paraBaixo ? window.innerHeight - r.bottom - FOLGA - MARGEM
                             : r.top - FOLGA - MARGEM;

    modal.style.right = direita + 'px';
    modal.style.height = 'min(720px,' + Math.max(360, espaco) + 'px)';
    if (paraBaixo) {
      modal.style.top = (r.bottom + FOLGA) + 'px';
      modal.style.bottom = 'auto';
      modal.style.transformOrigin = 'top right';
    } else {
      modal.style.bottom = (window.innerHeight - r.top + FOLGA) + 'px';
      modal.style.top = 'auto';
      modal.style.transformOrigin = 'bottom right';
    }
  }

  // Girar o aparelho ou redimensionar a janela com o painel aberto deixava o dock preso a
  // uma posição medida em outra viewport.
  window.addEventListener('resize', function () { if (widgetState.isOpen) wmAncorar(); });

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
    wmAncorar();
    window.setTimeout(function() {
      const campo = document.getElementById('luma-wm-input-box');
      const alvo = campo || document.querySelector('#luma-widget-modal .luma-wm-close-btn');
      if (alvo) alvo.focus();
    }, 80);
  };

  window.lumaWidgetClose = function () {
    widgetState.isOpen = false;
    if (typeof gSupVendo === 'function') gSupVendo(false);
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
    if (tab === 'messages' && wmSuporte()) wmSupEntrar();
    renderWidgetModalContent();
    const corpo = document.querySelector('#luma-widget-modal .luma-wm-body');
    if (corpo) corpo.scrollTop = 0;
  };

  window.lumaWidgetVoltar = function () {
    const alvo = wmVoltarAlvo();
    if (alvo) window.lumaWidgetSetTab(alvo);
  };

  // A ÚNICA porta de "Faça uma pergunta" (Início, Mensagens vazia, fim do artigo, novidade).
  window.lumaWidgetStartChat = function () {
    // Equipe online → a pergunta vai direto para uma PESSOA (decisão do Ryan, 23/09/2026).
    // Vem antes da chave da IA de propósito: com gente para atender, a IA nem entra.
    if (wmSupEquipeOnline()) { window.lumaWidgetSetTab('messages'); return; }
    // Controle do produto: o chat de ajuda pode ser desligado sem derrubar os
    // artigos da Central — por isso a chave é filha de global.help, não a mesma.
    if (typeof gFeatureCan === 'function' && !gFeatureCan('global.help.chat', 'access')) {
      // IA desligada mas suporte ligado: a pergunta ainda tem para onde ir — a equipe lê
      // quando voltar. Só sem nenhum dos dois é que o botão explica o bloqueio.
      if (wmSuporte() && !G_SUP.souEquipe) { window.lumaWidgetSetTab('messages'); return; }
      if (typeof gFeatureBlockedFeedback === 'function') gFeatureBlockedFeedback('global.help.chat');
      return;
    }
    widgetState.hasActiveChat = true;
    // Com o suporte ao vivo, "Mensagens" é a conversa com PESSOAS; a IA vira a aba própria
    // 'assistente' (acesa em "Mensagens" desde 26/09: é uma conversa, não um artigo).
    widgetState.activeTab = wmSuporte() ? 'assistente' : 'messages';
    renderWidgetModalContent();
    window.setTimeout(function () {
      const campo = document.getElementById('luma-wm-input-box');
      if (campo) campo.focus();
    }, 0);
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

  // `origem` diz para onde o "voltar" do artigo leva (coleção, busca, novidade…).
  window.lumaWidgetOpenArticle = function (id, origem) {
    if (!wmVisivel(wmArtigo(id))) return;
    widgetState.selectedArticleId = id;
    widgetState.articleBack = ['collection', 'home', 'novidade', 'help'].indexOf(origem) >= 0 ? origem : 'help';
    window.lumaWidgetSetTab('article');
  };

  window.lumaWidgetOpenCol = function (id) {
    if (!wmVisivel(wmColecao(id))) return;
    widgetState.selectedColId = id;
    window.lumaWidgetSetTab('collection');
  };

  window.lumaWidgetOpenNews = function (id, origem) {
    widgetState.selectedNewsId = id;
    widgetState.newsBack = origem === 'news' ? 'news' : 'home';
    window.lumaWidgetSetTab('novidade');
  };

  // Busca: toda palavra digitada precisa aparecer (título, resumo, passos, dica ou apelidos).
  // Acerto no título sobe. Substring da frase inteira, como era, não achava "foto pequena".
  function wmBuscar(query) {
    const q = wmNormalize(query);
    let termos = q.split(/[^a-z0-9%]+/).filter(function (w) { return w.length > 2; });
    if (!termos.length && q) termos = [q];
    return LUMA_ARTICLES.filter(wmVisivel).map(function (a) {
      const titulo = wmNormalize(a.title + ' ' + (a.kw || ''));
      const tudo = titulo + ' ' + wmNormalize([a.summary, (a.steps || []).join(' '), a.tip || ''].join(' '));
      if (!termos.every(function (t) { return tudo.indexOf(t) >= 0; })) return null;
      return { a: a, peso: termos.filter(function (t) { return titulo.indexOf(t) >= 0; }).length };
    }).filter(Boolean).sort(function (x, y) { return y.peso - x.peso; }).map(function (r) { return r.a; });
  }

  // Filtro de Busca em Tempo Real
  window.lumaWidgetFilterHelp = function (query) {
    widgetState.searchQuery = String(query || '').trim();
    const container = document.getElementById('luma-wm-help-results');
    const colecoes = document.getElementById('luma-wm-help-home');
    if (!container) return;
    const buscando = !!widgetState.searchQuery;
    if (colecoes) colecoes.hidden = buscando;
    container.hidden = !buscando;
    if (!buscando) { container.innerHTML = ''; return; }

    const achados = wmBuscar(widgetState.searchQuery);
    if (!achados.length) {
      container.innerHTML = `
        <div class="luma-wm-no-results" role="status">
          <span class="luma-wm-no-results-icon" aria-hidden="true">${WIDGET_SVGS.search}</span>
          <strong>Nada encontrado para “${wmEsc(widgetState.searchQuery)}”</strong>
          <span>Tente outra palavra, ou pergunte direto.</span>
          ${wmPodePerguntar() ? '<button type="button" class="luma-wm-btn-primary" onclick="lumaWidgetStartChat()">Faça uma pergunta</button>' : ''}
        </div>`;
      return;
    }
    container.innerHTML = `<p class="luma-wm-count" role="status">${achados.length} ${achados.length === 1 ? 'resultado' : 'resultados'}</p>`
      + `<div class="luma-wm-rows">${achados.map(function (a) { return wmRenderArtRow(a, 'help', true); }).join('')}</div>`;
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
  const WM_ABA_DA_NAV = { home: 'home', news: 'home', novidade: 'home', messages: 'messages', assistente: 'messages', help: 'help', collection: 'help', article: 'help' };
  const WM_RENDER = {
    home: function () { return renderHomeTab(); },
    news: function () { return renderNewsTab(); },
    novidade: function () { return renderNovidadeTab(); },
    messages: function () { return wmSuporte() ? renderSuporteTab() : renderMessagesTab(); },
    assistente: function () { return renderMessagesTab(); },
    help: function () { return renderHelpTab(); },
    collection: function () { return renderColTab(); },
    article: function () { return renderArticleViewTab(); }
  };

  function renderWidgetModalContent() {
    const modal = document.getElementById('luma-widget-modal');
    if (!modal) return;

    const aba = WM_RENDER[widgetState.activeTab] ? widgetState.activeTab : 'home';
    widgetState.activeTab = aba;
    const bodyHTML = WM_RENDER[aba]();
    const naNav = WM_ABA_DA_NAV[aba];
    const navBtn = function (tab, icone, rotulo, extra) {
      const on = naNav === tab;
      return `<button type="button" class="luma-wm-nav-btn ${on ? 'active' : ''}" data-tab="${tab}" onclick="lumaWidgetSetTab('${tab}')" ${on ? 'aria-current="page"' : ''}>
          ${icone}<span>${rotulo}</span>${extra || ''}
        </button>`;
    };

    modal.innerHTML = `
      ${wmHeaderHTML()}

      <main class="luma-wm-body luma-wm-body-${aba === 'assistente' ? 'messages' : aba}">
        ${bodyHTML}
      </main>

      <nav class="luma-wm-nav" aria-label="Navegação da ajuda">
        ${navBtn('home', WIDGET_SVGS.home, 'Início')}
        ${navBtn('messages', WIDGET_SVGS.messagesNav, 'Mensagens', wmSupNavBadge())}
        ${navBtn('help', WIDGET_SVGS.helpNav, 'Ajuda')}
      </nav>
    `;

    // Re-bind attachment area if in chat tab
    const naSuporte = widgetState.activeTab === 'messages' && wmSuporte();
    if ((wmNaIA() && widgetState.hasActiveChat) || naSuporte) {
      renderAttachmentPreview();
      const messages = modal.querySelector('.luma-wm-chat-messages');
      if (messages) messages.scrollTop = messages.scrollHeight;
    }
    if (widgetState.activeTab === 'help' && widgetState.searchQuery) {
      window.lumaWidgetFilterHelp(widgetState.searchQuery);
    }
    // Por ÚLTIMO: pode marcar como lida → avisar → re-render. Nada depois disto no render.
    if (typeof gSupVendo === 'function') gSupVendo(widgetState.isOpen && naSuporte && !!G_SUP.conversaDe);
  }

  // Tem para onde mandar uma pergunta? (assistente ligado, ou a equipe pelo suporte ao vivo)
  function wmIaLigada() { return !(typeof gFeatureCan === 'function' && !gFeatureCan('global.help.chat', 'access')); }
  function wmPodePerguntar() { return wmIaLigada() || (wmSuporte() && !G_SUP.souEquipe); }

  /* ── INÍCIO ──────────────────────────────────────────────────────────────────────────────
     Estrutura do Deskfy: UMA entrada para perguntar, a busca, e as novidades do Luma.
     O cartão "Falar com a equipe" separado saiu: com dois botões a pessoa precisava decidir
     entre máquina e gente sem saber quem estava lá. Agora quem decide é o estado real
     (lumaWidgetStartChat): equipe online → pessoa; ninguém → assistente, com a saída para a
     equipe no fim. A equipe DM continua vendo o cartão da própria caixa de conversas. */
  function renderHomeTab() {
    const online = wmSupEquipeOnline();
    const suporteFranq = wmSuporte() && !G_SUP.souEquipe;
    let sub;
    if (online) sub = 'A equipe DM está no Luma agora e responde por aqui.';
    else if (!wmIaLigada()) sub = 'A equipe DM responde por aqui assim que voltar.';
    else if (suporteFranq) sub = 'O assistente responde na hora. Se não resolver, você fala com a equipe.';
    else sub = 'O assistente responde na hora, pela Central de Ajuda.';
    const pergunta = wmPodePerguntar() ? `<button type="button" class="luma-wm-ask" onclick="lumaWidgetStartChat()">
        <span class="luma-wm-ask-txt">
          <strong>Faça uma pergunta</strong>
          <span>${wmEsc(sub)}</span>
          ${online ? `<span class="luma-wm-ask-online"><i class="luma-wm-sup-dot" aria-hidden="true"></i>${wmEsc(wmSupNomes(G_SUP.online))} online agora</span>` : ''}
        </span>
        <span class="luma-wm-ask-go" aria-hidden="true">${wmIco('ask', 20)}</span>
      </button>` : '';

    const lista = wmNovidades();
    const novidades = !lista.length ? '' : `
      <div class="luma-wm-section-head">
        <span class="luma-wm-section-title">Novidades do Luma</span>
        ${lista.length > 5 ? `<button type="button" onclick="lumaWidgetSetTab('news')">Ver todas</button>` : ''}
      </div>
      ${lista.slice(0, 2).map(wmNewsCard).join('')}
      ${lista.length > 2 ? `<div class="luma-wm-news-list">${lista.slice(2, 5).map(function (n) { return wmNewsMini(n, 'home'); }).join('')}</div>` : ''}`;

    return `
      ${G_SUP.souEquipe ? wmSupHomeCard() : ''}
      ${pergunta}
      <button type="button" class="luma-wm-search-btn" onclick="lumaWidgetFocusHelp()">
        ${WIDGET_SVGS.search}<span>Busque uma resposta</span>
      </button>
      ${novidades}
    `;
  }

  function wmNewsTag(n) { return wmNovidadeNova(n) ? '<b class="luma-wm-tag">Novo</b>' : ''; }

  function wmNewsCard(n) {
    return `<button type="button" class="luma-wm-news" onclick="lumaWidgetOpenNews('${n.id}','home')">
        ${n.arte ? `<span class="luma-wm-news-art">${wmNovidadeArte(n.arte)}</span>` : ''}
        <span class="luma-wm-news-body">
          <span class="luma-wm-news-meta">${wmNewsTag(n)}<time datetime="${wmEsc(n.data)}">${wmEsc(wmDataCurta(n.data))}</time></span>
          <strong>${wmEsc(n.title)}</strong>
          <span class="luma-wm-news-sum">${wmEsc(n.summary)}</span>
        </span>
      </button>`;
  }

  function wmNewsMini(n, origem) {
    return `<button type="button" class="luma-wm-news-mini" onclick="lumaWidgetOpenNews('${n.id}','${origem}')">
        <span class="luma-wm-news-ico" aria-hidden="true">${wmIco(n.icon, 18)}</span>
        <span class="luma-wm-news-mini-txt"><strong>${wmEsc(n.title)}</strong><small>${wmNewsTag(n)}${wmEsc(wmDataCurta(n.data))}</small></span>
        <span class="luma-wm-list-arrow" aria-hidden="true">${WIDGET_SVGS.chevronRight}</span>
      </button>`;
  }

  function renderNewsTab() {
    return `<div class="luma-wm-news-list">${wmNovidades().map(function (n) { return wmNewsMini(n, 'news'); }).join('')}</div>`;
  }

  function renderNovidadeTab() {
    const n = wmNovidades().find(function (x) { return x.id === widgetState.selectedNewsId; });
    if (!n) return renderNewsTab();
    const art = n.artigo ? wmArtigo(n.artigo) : null;
    return `<article class="luma-wm-novidade">
        ${n.arte ? `<div class="luma-wm-novidade-art">${wmNovidadeArte(n.arte)}</div>` : ''}
        <div class="luma-wm-novidade-body">
          <p class="luma-wm-news-meta">${wmNewsTag(n)}<time datetime="${wmEsc(n.data)}">${wmEsc(wmDataLonga(n.data))}</time></p>
          <h3>${wmEsc(n.title)}</h3>
          ${(n.body || []).map(function (p) { return `<p>${wmEsc(p)}</p>`; }).join('')}
          ${art && wmVisivel(art) ? `<button type="button" class="luma-wm-link" onclick="lumaWidgetOpenArticle('${art.id}','novidade')">Ler: ${wmEsc(art.title)}${WIDGET_SVGS.chevronRight}</button>` : ''}
          ${n.perguntar && wmPodePerguntar() ? `<button type="button" class="luma-wm-link" onclick="lumaWidgetStartChat()">Fazer uma pergunta${WIDGET_SVGS.chevronRight}</button>` : ''}
        </div>
      </article>`;
  }

  /* ── A CONVERSA ──────────────────────────────────────────────────────────────────────────
     Três avisos diziam a MESMA coisa em lugares diferentes (a tarja de escopo no topo, a
     caixa laranja dentro da primeira bolha e a linha "atendimento automático" no pé). Aviso
     repetido não informa mais: vira ruído e a pessoa para de ler os três. Agora QUEM
     responde mora na barra do topo e na apresentação do início da conversa ("é máquina e
     pode errar"); o escopo ("aprovação é com o seu marketing") é uma linha sob o campo.
     ⛔ O seletor de modelo saiu. Escolher entre Gemini Flash e 1.5 Pro não é decisão do
     franqueado (nem informação que faça sentido para ele) — e o lever continua existindo
     para a equipe no console (`js/core/console.js`, que também escreve LUMA_GEMINI_MODEL).
     As sugestões de pergunta saem dos artigos REAIS da base: assim a pergunta do atalho
     sempre casa com material e nunca cai no "não está na Central". */
  const WM_SUGESTOES = ['texto-nao-cabe', 'ajustar-foto', 'baixar'];

  function renderMessagesTab() {
    if (!widgetState.hasActiveChat) {
      return `
        <div class="luma-wm-chat-empty">
          <div class="luma-wm-chat-empty-icon">${WIDGET_SVGS.chatBubble}</div>
          <strong>Sem conversas ainda</strong>
          <span>Suas conversas com o assistente ficam aqui enquanto o Luma estiver aberto.</span>
          ${wmPodePerguntar() ? `<button type="button" class="luma-wm-empty-ask" onclick="lumaWidgetStartChat()">Faça uma pergunta${WIDGET_SVGS.helpNav}</button>` : ''}
        </div>
      `;
    }

    const sugestoes = widgetState.messages.length ? '' : `
      <div class="luma-wm-sugestoes">
        <span class="luma-wm-sugestoes-label">Perguntas comuns</span>
        ${WM_SUGESTOES.map(id => {
          const art = wmArtigo(id);
          if (!art) return '';
          return `<button type="button" class="luma-wm-sugestao" onclick="lumaWidgetPerguntar(this)" data-pergunta="${wmEsc(art.title)}">${wmEsc(art.title)}</button>`;
        }).join('')}
      </div>`;

    return `
      <div class="luma-wm-chat-active">
        <div class="luma-wm-chat-messages">
          <div class="luma-wm-chat-intro">
            <span class="luma-wm-chat-intro-mark" aria-hidden="true">${WIDGET_SVGS.sparkle}</span>
            <strong>Assistente do Luma</strong>
            <span>Responde pela Central de Ajuda e pode errar: confira antes de agir.${wmSuporte() && !G_SUP.souEquipe ? ' Se não resolver, você fala com a equipe.' : ''}</span>
          </div>

          <div class="luma-wm-bubble bot">
            Conta o que aconteceu e em qual tela. Quanto mais específico, melhor eu acho a resposta.
            <div class="luma-wm-bubble-meta">Assistente Luma · agora</div>
          </div>

          ${sugestoes}

          ${widgetState.messages.map(m => `
            <div class="luma-wm-bubble ${m.sender === 'user' ? 'user' : 'bot'}">
              ${m.image ? `<img src="${m.image}" class="luma-wm-bubble-img" alt="Anexo">` : ''}
              ${wmText(m.text)}
              <div class="luma-wm-bubble-meta">${m.fonte === 'ia' ? '<span class="luma-wm-ia-tag">IA</span>' : ''}${wmEsc(m.author)} · ${wmEsc(m.time)}</div>
            </div>
          `).join('')}

          ${widgetState.pensando ? `<div class="luma-wm-bubble bot luma-wm-digitando" role="status" aria-label="Assistente digitando">
            <span></span><span></span><span></span>
          </div>` : wmSupHandoff()}
        </div>

        <div id="luma-wm-attach-area"></div>

        <div class="luma-wm-chat-input-bar">
          <textarea id="luma-wm-input-box" placeholder="Escreva sua pergunta" aria-label="Pergunta para o assistente do Luma" oninput="lumaWidgetInputCheck(this)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();lumaWidgetSendMsg();}"></textarea>
          <div class="luma-wm-chat-input-tools">
            <div class="luma-wm-input-actions">
              <button type="button" class="luma-wm-tool-btn" onclick="lumaWidgetTriggerFileSelect()" aria-label="Anexar imagem ou arquivo" title="Anexar arquivo">${WIDGET_SVGS.paperclip}</button>
              <button type="button" class="luma-wm-tool-btn" id="luma-wm-mic-btn" onclick="lumaWidgetStartVoiceDictation()" aria-label="Ditar pergunta por voz" title="Ditar por voz">${WIDGET_SVGS.mic}</button>
            </div>
            <button type="button" class="luma-wm-send-btn" id="luma-wm-send-trigger" onclick="lumaWidgetSendMsg()" aria-label="Enviar pergunta">${WIDGET_SVGS.send}</button>
          </div>
        </div>
        <p class="luma-wm-escopo">Aprovação de peça e pedido de arte nova: com o marketing da sua empresa.</p>
      </div>
    `;
  }

  // Atalho de pergunta: escreve no campo e envia pelo MESMO caminho do teclado —
  // nada de rota paralela de envio (o histórico, o teto e o rótulo de origem são os de lá).
  window.lumaWidgetPerguntar = function (btn) {
    const input = document.getElementById('luma-wm-input-box');
    if (!input || !btn) return;
    input.value = btn.dataset.pergunta || '';
    window.lumaWidgetSendMsg();
  };

  /* ── AJUDA: busca → "Nesta tela" → coleções → artigo ─────────────────────────────────────
     "Nesta tela" é o suporte contextual: os dois artigos da tela onde a pessoa está, antes
     de ela ter que adivinhar em qual coleção a dúvida mora. */
  function wmNestaTela() {
    const cl = document.body.classList;
    const par = WM_NESTA_TELA.find(function (p) { return cl.contains(p[0]); });
    return par ? par[1].map(wmArtigo).filter(wmVisivel) : [];
  }

  function renderHelpTab() {
    const ctx = wmNestaTela();
    const cols = WM_COLECOES.filter(function (c) { return wmVisivel(c) && wmArtigosDa(c.id).length; });
    return `
      <div class="luma-wm-help-top">
        <div class="luma-wm-search">
          <input id="luma-wm-help-search" type="search" placeholder="Busque uma resposta" aria-label="Buscar na central de ajuda" value="${wmEsc(widgetState.searchQuery)}" oninput="lumaWidgetFilterHelp(this.value)">
          ${WIDGET_SVGS.search}
        </div>
      </div>

      <div id="luma-wm-help-results" class="luma-wm-help-results" hidden></div>

      <div id="luma-wm-help-home">
        ${ctx.length ? `<div class="luma-wm-ctx">
          <p class="luma-wm-ctx-label">${wmIco('pin', 13)}Nesta tela</p>
          ${ctx.map(function (a) { return `<button type="button" class="luma-wm-ctx-item" onclick="lumaWidgetOpenArticle('${a.id}','help')"><span>${wmEsc(a.title)}</span>${WIDGET_SVGS.chevronRight}</button>`; }).join('')}
        </div>` : ''}
        <p class="luma-wm-count">${cols.length} coleções</p>
        <div class="luma-wm-rows">
          ${cols.map(function (c) {
            const n = wmArtigosDa(c.id).length;
            return `<button type="button" class="luma-wm-col" onclick="lumaWidgetOpenCol('${c.id}')">
                <span class="luma-wm-col-ico" aria-hidden="true">${wmIco(c.icon, 19)}</span>
                <span class="luma-wm-col-txt"><strong>${wmEsc(c.title)}</strong><span>${wmEsc(c.desc)}</span><small>${n} ${n === 1 ? 'artigo' : 'artigos'}</small></span>
                <span class="luma-wm-list-arrow" aria-hidden="true">${WIDGET_SVGS.chevronRight}</span>
              </button>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderColTab() {
    const c = wmColecao(widgetState.selectedColId);
    if (!wmVisivel(c)) return renderHelpTab();
    const arts = wmArtigosDa(c.id);
    return `
      <div class="luma-wm-col-head">
        <p class="luma-wm-crumb">Ajuda › ${wmEsc(c.title)}</p>
        <h3>${wmEsc(c.title)}</h3>
        <p>${wmEsc(c.desc)} · ${arts.length} ${arts.length === 1 ? 'artigo' : 'artigos'}</p>
      </div>
      <div class="luma-wm-rows">${arts.map(function (a) { return wmRenderArtRow(a, 'collection', false); }).join('')}</div>
    `;
  }

  function renderArticleViewTab() {
    const article = wmArtigo(widgetState.selectedArticleId);
    if (!wmVisivel(article)) return renderHelpTab();
    const col = wmColecao(article.col);

    return `
      <article class="luma-wm-article">
        ${col ? `<span class="luma-wm-eyebrow">${wmEsc(col.title)}</span>` : ''}
        <h3 class="luma-wm-article-title">${wmEsc(article.title)}</h3>
        <p class="luma-wm-article-meta">${wmIco('clock', 14)}${article.min || 1} min de leitura</p>
        <p class="luma-wm-article-lead">${wmEsc(article.summary)}</p>
        <ol class="luma-wm-steps">
          ${(article.steps || []).map(function (s) { return `<li><span>${wmEsc(s)}</span></li>`; }).join('')}
        </ol>
        ${article.tip ? `<div class="luma-wm-tip">${wmIco('bulb', 18)}<p>${wmEsc(article.tip)}</p></div>` : ''}
      </article>

      <div class="luma-wm-article-feedback">
        <strong>Isso resolveu?</strong>
        <div class="luma-wm-feedback-actions">
          <button type="button" class="luma-wm-vote" onclick="lumaWidgetArticleFeedback(true)" aria-label="Sim, resolveu">${wmIco('up', 18)}</button>
          <button type="button" class="luma-wm-vote" onclick="lumaWidgetArticleFeedback(false)" aria-label="Não resolveu">${wmIco('down', 18)}</button>
        </div>
        ${wmPodePerguntar() ? `<p class="luma-wm-fb-more">Ainda com dúvida? <button type="button" onclick="lumaWidgetStartChat()">Faça uma pergunta</button></p>` : ''}
      </div>
    `;
  }

  // Mesmo evento que a Central antiga já gravava (help.js, gFhVote) — o painel de Dados
  // continua lendo um nome só. "Não resolveu" leva para a pergunta: é onde a autoajuda acaba.
  window.lumaWidgetArticleFeedback = function (resolved) {
    try { if (typeof gTrackEvent === 'function') gTrackEvent('ajuda_feedback', { util: !!resolved, artigo: widgetState.selectedArticleId }); } catch (e) {}
    if (resolved) {
      if (typeof gToast === 'function') gToast('Que bom! Obrigado pelo retorno.');
      return;
    }
    if (wmPodePerguntar()) { lumaWidgetStartChat(); return; }
    if (typeof gToast === 'function') gToast('Valeu. Vamos melhorar este artigo.');
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
  // O artigo do widget que mais casa com a pergunta. Pontua palavra por palavra (título e
  // apelidos valem 3, o resto do texto 1) — o "alguma palavra do título aparece" de antes
  // casava "como" com qualquer coisa. Palavra-função sai pela mesma lista da Central (help.js).
  function wmArtigoParaPergunta(msg) {
    const stop = typeof G_HELP_STOPWORDS !== 'undefined' ? G_HELP_STOPWORDS : [];
    const termos = wmNormalize(msg).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2 && stop.indexOf(w) < 0; });
    if (!termos.length) return null;
    let melhor = null, nota = 0;
    LUMA_ARTICLES.filter(wmVisivel).forEach(function (a) {
      const titulo = wmNormalize(a.title + ' ' + (a.kw || ''));
      const texto = wmNormalize([a.summary, (a.steps || []).join(' '), a.tip || ''].join(' '));
      const n = termos.reduce(function (t, w) { return t + (titulo.indexOf(w) >= 0 ? 3 : texto.indexOf(w) >= 0 ? 1 : 0); }, 0);
      if (n > nota) { nota = n; melhor = a; }
    });
    return melhor;
  }
  function wmArtigoTexto(a) {
    return a.summary + '\n' + (a.steps || []).map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n') + (a.tip ? '\nDica: ' + a.tip : '');
  }

  function lumaWidgetKnowledge(userMessage) {
    let ctx = '';
    try { if (typeof gHelpKnowledge === 'function') ctx = gHelpKnowledge(userMessage, 4) || ''; } catch (e) {}
    const art = wmArtigoParaPergunta(userMessage);
    // O artigo do widget vai PRIMEIRO: é a base conferida no código (26/09/2026).
    if (art) ctx = '### ' + art.title + '\n' + wmArtigoTexto(art) + (ctx ? '\n\n' + ctx : '');
    return ctx;
  }

  async function lumaWidgetGenerateAIResponse(userMessage) {
    const temIA = typeof gAskAI === 'function' && typeof gAiReady === 'function' && gAiReady();

    // Devolve {text, fonte} — quem renderiza precisa saber a ORIGEM pra rotular a bolha.
    // Sem isso o usuário não distingue resposta de IA de busca na base, e o widget parecia
    // atendimento humano (era o rótulo "Suporte ao Vivo") quando nunca houve humano nenhum.
    const buscarNaBase = () => {
      const matched = wmArtigoParaPergunta(userMessage);
      return matched ? { fonte: 'base', text: `Sobre "${matched.title}":\n` + wmArtigoTexto(matched) } : null;
    };

    if (!temIA) {
      const daBase = buscarNaBase();
      if (daBase) return daBase;
      // Honestidade: NÃO existe notificação a humano nenhum aqui. O texto antigo prometia que
      // "Ryan e Pedro foram notificados no painel" — nada no código faz isso.
      return { fonte: 'indisponivel',
        text: 'Não encontrei isso na Central de Ajuda, e o assistente de IA está desligado no momento.\n\nTente descrever com outras palavras ou procure direto na aba "Ajuda".' };
    }
    
    const material = lumaWidgetKnowledge(userMessage);
    // Sem material que case, NÃO chama a IA: ela responderia por conta própria sobre um
    // produto interno que não conhece. Melhor dizer que não está na Central.
    if (!material) {
      return { fonte: 'indisponivel',
        text: 'Não encontrei isso na Central de Ajuda.\n\nTente descrever com outras palavras, ou abra a aba "Ajuda" pra ver os temas disponíveis.' };
    }

    const prompt = `Você é o assistente da Central de Ajuda do Luma, a ferramenta interna de criação de artes da Delivery Much. Quem pergunta é um franqueado (dono do app na cidade dele, não é designer) ou alguém do time de design.

RESPONDA APENAS COM BASE NO MATERIAL ABAIXO. Ele é a documentação real do produto.

MATERIAL DA CENTRAL DE AJUDA:
${material}

PERGUNTA: "${userMessage}"

REGRAS:
1. Se a resposta NÃO estiver no material, diga exatamente: "Isso não está na Central de Ajuda." e sugira procurar na aba "Ajuda". Não invente tela, botão ou caminho.
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
      text: 'Não consegui falar com o assistente de IA agora.\n\nTente de novo em instantes ou procure na aba "Ajuda".' };
  }

  window.lumaWidgetSendMsg = async function () {
    const input = document.getElementById('luma-wm-input-box');
    const msgText = input ? input.value.trim() : '';

    if (!msgText && !widgetState.attachedFile) return;

    // Alguém da equipe entrou enquanto a pessoa estava na IA: a pergunta vai para ela, não
    // para o modelo — pelo MESMO envio do suporte (lumaWidgetSupEnviar), com o anexo junto.
    if (wmSupEquipeOnline()) {
      widgetState.supRascunho = msgText;
      window.lumaWidgetSetTab('messages');
      window.lumaWidgetSupEnviar();
      return;
    }

    const newMsg = {
      sender: 'user',
      author: 'Você',
      text: msgText,
      image: widgetState.attachedFile ? widgetState.attachedFile.dataUrl : null,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    _podarMensagens();
    renderWidgetModalContent();
  };

  /* ── SUPORTE AO VIVO ────────────────────────────────────────────────────────────────────
     Dados, Realtime e presença moram em js/core/suporte.js (gSup*, estado em G_SUP). Aqui só
     se desenha. Com a chave global.help.suporte desligada (ou sem backend), "Mensagens" volta
     a ser o assistente de IA exatamente como era — nada regride.
     ⛔ Dado de usuário (texto, nome, cidade, contexto, URL) passa SEMPRE por wmEsc/wmText. */
  function wmSuporte() { return typeof gSupDisponivel === 'function' && gSupDisponivel(); }
  // Franqueado com alguém da equipe online agora: é o que manda a pergunta direto para a pessoa.
  function wmSupEquipeOnline() {
    return wmSuporte() && !G_SUP.souEquipe && G_SUP.online.length > 0;
  }
  function wmNaIA() {
    return widgetState.activeTab === 'assistente' || (widgetState.activeTab === 'messages' && !wmSuporte());
  }

  function wmSupData(iso) { const d = new Date(iso); return isNaN(d) ? null : d; }
  function wmSupHora(iso) {
    const d = wmSupData(iso);
    return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  }
  function wmSupDiasAtras(d) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dia = new Date(d); dia.setHours(0, 0, 0, 0);
    return Math.round((hoje - dia) / 86400000);
  }
  function wmSupDia(iso) {
    const d = wmSupData(iso);
    if (!d) return '';
    const n = wmSupDiasAtras(d);
    return n === 0 ? 'Hoje' : n === 1 ? 'Ontem' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function wmSupQuando(iso) {
    const d = wmSupData(iso);
    if (!d) return '';
    const n = wmSupDiasAtras(d);
    return n === 0 ? wmSupHora(iso) : n === 1 ? 'ontem' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  function wmSupIniciais(nome) {
    const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase();
  }
  function wmSupNomes(lista) {
    if (lista.length <= 2) return lista.join(' e ');
    return lista.slice(0, 2).join(', ') + ' e mais ' + (lista.length - 2);
  }
  function wmSupLinhaAberta() {
    return G_SUP.caixa.find(function (c) { return c.franqueado_id === G_SUP.conversaDe; }) || null;
  }

  function wmSupHeader() {
    if (G_SUP.souEquipe) {
      if (G_SUP.conversaDe) {
        const c = wmSupLinhaAberta();
        return { title: (c && c.nome) || 'Franqueado', detail: (c && c.cidade) || 'Conversa com o franqueado' };
      }
      const n = gSupAguardando();
      return { title: 'Conversas', online: true,
        detail: 'Online para a rede · ' + (n ? n + ' aguardando resposta' : 'nenhuma aguardando') };
    }
    if (G_SUP.online.length) return { title: 'Equipe DM', online: true, detail: 'Online agora · ' + wmSupNomes(G_SUP.online) };
    return { title: 'Equipe DM', detail: 'Ninguém online agora — a resposta aparece aqui assim que a equipe voltar.' };
  }

  function wmSupNavBadge() {
    if (!wmSuporte()) return '';
    const n = gSupContador();
    return n > 0 ? `<b class="luma-wm-sup-navbadge"><span aria-hidden="true">${n > 9 ? '9+' : n}</span><span class="g-help-sr-only">, ${n} novas</span></b>` : '';
  }
  // Troca só o contador da aba: re-renderizar o painel inteiro apagaria o que se digita na IA.
  function wmSupPintarNav() {
    const btn = document.querySelector('#luma-widget-modal .luma-wm-nav-btn[data-tab="messages"]');
    if (!btn) return;
    const velho = btn.querySelector('.luma-wm-sup-navbadge');
    if (velho) velho.remove();
    btn.insertAdjacentHTML('beforeend', wmSupNavBadge());
  }

  // Só para a EQUIPE: a caixa de conversas. O franqueado entra pelo "Faça uma pergunta"
  // (renderHomeTab), que já decide sozinho entre pessoa e assistente.
  function wmSupHomeCard() {
    if (!wmSuporte() || !G_SUP.souEquipe) return '';
    const n = gSupAguardando();
    return `<button type="button" class="luma-wm-ask-card luma-wm-sup-card" onclick="lumaWidgetSetTab('messages')">
        <span class="luma-wm-ask-icon" aria-hidden="true">${WIDGET_SVGS.chatBubble}</span>
        <div class="luma-wm-ask-copy"><strong>Conversas do suporte</strong><span>${n ? n + ' aguardando resposta' : 'Nenhuma conversa aguardando'}</span></div>
        <span class="luma-wm-list-arrow" aria-hidden="true">${WIDGET_SVGS.chevronRight}</span>
      </button>`;
  }

  // Depois de uma resposta da IA: a saída para uma pessoa, levando a pergunta junto.
  function wmSupHandoff() {
    if (!wmSuporte() || G_SUP.souEquipe) return '';
    if (!widgetState.messages.some(function (m) { return m.sender === 'bot'; })) return '';
    return `<button type="button" class="luma-wm-sup-handoff" onclick="lumaWidgetFalarComEquipe()">${G_SUP.online.length ? '<i class="luma-wm-sup-dot" aria-hidden="true"></i>' : ''}Não resolveu? Falar com a equipe</button>
      <span class="luma-wm-sup-sys">Sua pergunta vai escrita — é só enviar.</span>`;
  }

  function wmSupEntrar() {
    if (typeof gSupIniciar === 'function') gSupIniciar();   // idempotente; fixa quem é equipe
    if (G_SUP.conversaDe) return;
    if (G_SUP.souEquipe) gSupCarregarCaixa();
    else gSupAbrirConversa();
  }

  function renderSuporteTab() {
    return (G_SUP.souEquipe && !G_SUP.conversaDe) ? renderSupCaixa() : renderSupConversa();
  }

  function renderSupCaixa() {
    const f = widgetState.supFiltro;
    const aguardando = G_SUP.caixa.filter(function (c) { return !c.ultima_da_equipe; });
    const lista = f === 'aguardando' ? aguardando : G_SUP.caixa;
    const seg = `<div class="luma-wm-sup-seg" role="group" aria-label="Filtrar conversas">
        <button type="button" class="${f === 'aguardando' ? 'on' : ''}" aria-pressed="${f === 'aguardando'}" onclick="lumaWidgetSupFiltro('aguardando')">Aguardando · ${aguardando.length}</button>
        <button type="button" class="${f === 'todas' ? 'on' : ''}" aria-pressed="${f === 'todas'}" onclick="lumaWidgetSupFiltro('todas')">Todas</button>
      </div>`;
    if (!lista.length) {
      return seg + `<div class="luma-wm-chat-empty">
          <div class="luma-wm-chat-empty-icon">${WIDGET_SVGS.chatBubble}</div>
          <strong>${f === 'aguardando' ? 'Ninguém esperando resposta' : 'Nenhuma conversa ainda'}</strong>
          <span>${f === 'aguardando' ? 'Quando um franqueado escrever, a conversa aparece aqui e o Luma avisa.' : 'As conversas com os franqueados aparecem aqui.'}</span>
        </div>`;
    }
    return seg + `<div class="luma-wm-sup-lista">${lista.map(renderSupLinha).join('')}</div>`;
  }

  function renderSupLinha(c) {
    const ctx = c.ultimo_contexto || {};
    const onde = [c.cidade, gSupContextoTexto(ctx)].filter(Boolean).join(' · ');
    const ultimo = (c.ultima_da_equipe ? 'Equipe: ' : '') + (c.ultimo_texto || (c.ultimo_tem_anexo ? 'Imagem' : ''));
    const av = c.avatar_url ? `<img src="${wmEsc(c.avatar_url)}" alt="">` : wmEsc(wmSupIniciais(c.nome));
    return `<button type="button" class="luma-wm-sup-linha${c.ultima_da_equipe ? '' : ' espera'}" data-id="${wmEsc(c.franqueado_id)}" onclick="lumaWidgetSupAbrir(this)">
        <span class="luma-wm-sup-av grande${c.avatar_url ? ' foto' : ''}" aria-hidden="true">${av}</span>
        <span class="luma-wm-sup-linha-main">
          <span class="luma-wm-sup-linha-top"><strong>${wmEsc(c.nome || 'Franqueado')}</strong><time>${wmEsc(wmSupQuando(c.ultima_em))}</time></span>
          ${onde || ctx.origem === 'assistente' ? `<span class="luma-wm-sup-linha-onde">${wmEsc(onde)}${ctx.origem === 'assistente' ? ' <b class="luma-wm-sup-tag">veio do assistente</b>' : ''}</span>` : ''}
          <span class="luma-wm-sup-linha-ultima">${wmEsc(ultimo)}</span>
        </span>
        ${c.nao_lidas > 0 ? `<span class="luma-wm-sup-badge"><span aria-hidden="true">${c.nao_lidas}</span><span class="g-help-sr-only">${c.nao_lidas} não lidas</span></span>` : ''}
      </button>`;
  }

  function wmSupBolhas() {
    const eq = G_SUP.souEquipe;
    const eu = typeof gCurrentUser === 'function' ? gCurrentUser() : null;
    const meu = function (m) { return eq ? m.da_equipe : !m.da_equipe; };
    let ultimaMinha = null;
    G_SUP.msgs.forEach(function (m) { if (meu(m)) ultimaMinha = m.id; });
    const franq = wmSupLinhaAberta();
    let html = '', diaAnt = '', ctxAnt = '';
    G_SUP.msgs.forEach(function (m) {
      const dia = wmSupDia(m.created_at);
      if (dia && dia !== diaAnt) { html += `<div class="luma-wm-sup-sys">${wmEsc(dia)}</div>`; diaAnt = dia; }
      const url = m.anexo_path ? gSupAnexoUrl(m.anexo_path) : '';
      const img = !m.anexo_path ? '' : url
        ? `<img src="${wmEsc(url)}" class="luma-wm-bubble-img" alt="Imagem enviada na conversa">`
        : '<span class="luma-wm-sup-sys">Carregando imagem…</span>';
      let autor;
      if (m.da_equipe) autor = (eu && m.autor_id === eu.id) ? 'Você' : (m.autor_nome || 'Equipe') + (eq ? '' : ' · Equipe DM');
      else autor = eq ? ((franq && franq.nome) || 'Franqueado') : 'Você';
      const visto = meu(m) && m.id === ultimaMinha && m.lida_em ? ' · Visto' : '';
      html += `<div class="luma-wm-bubble ${meu(m) ? 'user' : 'bot'}">
          ${img}${m.texto ? wmText(m.texto) : ''}
          <div class="luma-wm-bubble-meta">${wmEsc(autor)} · ${wmEsc(wmSupHora(m.created_at))}${visto}</div>
        </div>`;
      // O contexto só reaparece quando MUDA — repetido em toda bolha, vira ruído.
      if (!m.da_equipe) {
        const t = gSupContextoTexto(m.contexto);
        if (t && t !== ctxAnt) html += `<span class="luma-wm-sup-ctx${meu(m) ? ' meu' : ''}">Estava em: ${wmEsc(t)}</span>`;
        if (t) ctxAnt = t;
      }
    });
    return html;
  }

  function renderSupConversa() {
    const eq = G_SUP.souEquipe;
    let corpo;
    if (G_SUP.carregando && !G_SUP.msgs.length) corpo = '<p class="luma-wm-sup-sys" role="status">Carregando a conversa…</p>';
    else if (G_SUP.msgs.length) corpo = wmSupBolhas();
    else if (eq) corpo = '<p class="luma-wm-sup-sys">Nenhuma mensagem nesta conversa.</p>';
    else corpo = `<div class="luma-wm-chat-empty">
        <div class="luma-wm-chat-empty-icon">${WIDGET_SVGS.users}</div>
        <span class="luma-wm-eyebrow">Equipe DM</span>
        <strong>Fale com uma pessoa</strong>
        <span>Dúvidas de uso e problemas no Luma. Aprovação de peça e pedido de arte continuam com o marketing da sua empresa.</span>
      </div>`;
    const pronto = widgetState.supRascunho.trim() || widgetState.attachedFile;
    return `
      <div class="luma-wm-chat-active luma-wm-sup">
        ${eq ? `<button type="button" class="luma-wm-sup-voltar" onclick="lumaWidgetSupVoltar()">${WIDGET_SVGS.back}<span>Conversas</span></button>` : ''}
        <div class="luma-wm-chat-messages">${corpo}</div>
        <div id="luma-wm-attach-area"></div>
        ${widgetState.supErro ? `<p class="luma-wm-sup-erro" role="status">${wmEsc(widgetState.supErro)}</p>` : ''}
        <div class="luma-wm-chat-input-bar">
          <textarea id="luma-wm-input-box" placeholder="${eq ? 'Responder ao franqueado' : 'Escreva para a equipe'}" aria-label="${eq ? 'Resposta para o franqueado' : 'Mensagem para a equipe DM'}" oninput="lumaWidgetSupDigitando(this)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();lumaWidgetSupEnviar();}">${wmEsc(widgetState.supRascunho)}</textarea>
          <div class="luma-wm-chat-input-tools">
            <div class="luma-wm-input-actions">
              <button type="button" class="luma-wm-tool-btn" onclick="lumaWidgetTriggerFileSelect()" aria-label="Anexar um print da tela" title="Anexar print">${WIDGET_SVGS.paperclip}</button>
            </div>
            <button type="button" class="luma-wm-send-btn${pronto ? ' ready' : ''}" id="luma-wm-send-trigger" onclick="lumaWidgetSupEnviar()" aria-label="Enviar mensagem"${widgetState.supEnviando ? ' disabled' : ''}>${WIDGET_SVGS.send}</button>
          </div>
        </div>
      </div>`;
  }

  /* Re-render vindo do Realtime: guarda foco, cursor e a rolagem de quem está lendo o
     histórico. Só desce até o fim se a pessoa JÁ estava no fim (motion.md: rolagem
     automática é interrupção). */
  function wmSupRerender(forcarFim) {
    const modal = document.getElementById('luma-widget-modal');
    if (!modal || !widgetState.isOpen) return;
    const box = modal.querySelector('.luma-wm-sup .luma-wm-chat-messages');
    const noFim = !box || (box.scrollHeight - box.scrollTop - box.clientHeight < 80);
    const topo = box ? box.scrollTop : 0;
    const corpo = modal.querySelector('.luma-wm-body');
    const corpoTopo = corpo ? corpo.scrollTop : 0;
    const input = document.getElementById('luma-wm-input-box');
    const foco = !!input && document.activeElement === input;
    const sel = foco ? [input.selectionStart, input.selectionEnd] : null;
    renderWidgetModalContent();
    const box2 = modal.querySelector('.luma-wm-sup .luma-wm-chat-messages');
    if (box2 && !noFim && !forcarFim) box2.scrollTop = topo;
    const corpo2 = modal.querySelector('.luma-wm-body');
    if (corpo2 && !box2) corpo2.scrollTop = corpoTopo;
    if (foco) {
      const i2 = document.getElementById('luma-wm-input-box');
      if (i2) { i2.focus(); try { i2.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    }
  }
  function wmSupAoMudar() {
    if (!widgetState.isOpen) return;
    if (widgetState.activeTab === 'home' || (widgetState.activeTab === 'messages' && wmSuporte())) wmSupRerender(false);
    else wmSupPintarNav();
  }

  window.lumaWidgetSupDigitando = function (el) {
    widgetState.supRascunho = el.value;
    widgetState.supErro = '';
    window.lumaWidgetInputCheck(el);
  };

  window.lumaWidgetSupEnviar = async function () {
    if (widgetState.supEnviando || typeof gSupEnviar !== 'function') return;
    const input = document.getElementById('luma-wm-input-box');
    const texto = (input ? input.value : widgetState.supRascunho).trim();
    const anexo = widgetState.attachedFile;
    if (!texto && !anexo) return;
    if (anexo && !anexo.isImage) {
      widgetState.supErro = 'No suporte, o anexo precisa ser uma imagem (PNG, JPG ou WEBP).';
      wmSupRerender(false);
      return;
    }
    widgetState.supEnviando = true;
    const r = await gSupEnviar(texto, anexo ? anexo.dataUrl : null, widgetState.supOrigem);
    widgetState.supEnviando = false;
    if (r.ok) {
      // Se a pessoa seguiu digitando durante o envio, o que é novo fica no campo.
      const atual = document.getElementById('luma-wm-input-box');
      const agora = atual ? atual.value : '';
      widgetState.supRascunho = agora.trim() === texto ? '' : agora;
      widgetState.attachedFile = null;
      widgetState.supOrigem = null;
      widgetState.supErro = '';
    } else {
      widgetState.supErro = r.erro || '';
    }
    wmSupRerender(true);
  };

  window.lumaWidgetSupAbrir = function (btn) {
    const id = btn && btn.dataset ? btn.dataset.id : '';
    if (!id) return;
    widgetState.supRascunho = ''; widgetState.supErro = ''; widgetState.attachedFile = null;
    gSupAbrirConversa(id);
  };
  window.lumaWidgetSupVoltar = function () {
    widgetState.supRascunho = ''; widgetState.supErro = ''; widgetState.attachedFile = null;
    gSupFecharConversa();
    gSupCarregarCaixa();
  };
  window.lumaWidgetSupFiltro = function (f) {
    widgetState.supFiltro = f === 'todas' ? 'todas' : 'aguardando';
    wmSupRerender(false);
  };

  window.lumaWidgetFalarComEquipe = function () {
    const ultima = widgetState.messages.slice().reverse().find(function (m) { return m.sender === 'user' && m.text; });
    if (ultima && !widgetState.supRascunho) widgetState.supRascunho = ultima.text;
    widgetState.supOrigem = 'assistente';
    window.lumaWidgetSetTab('messages');
    const input = document.getElementById('luma-wm-input-box');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  };

  // Porta de entrada do suporte: botão "Conversas" da topbar (equipe) e o "Ver" dos avisos.
  window.lumaWidgetAbrirSuporte = function (trigger, franqueadoId) {
    if (!wmSuporte()) { window.lumaWidgetOpen(trigger); return; }
    if (widgetState.isOpen && widgetState.activeTab === 'messages' && !franqueadoId) { window.lumaWidgetClose(); return; }
    widgetState.activeTab = 'messages';
    if (typeof gSupIniciar === 'function') gSupIniciar();
    if (G_SUP.souEquipe && franqueadoId) gSupAbrirConversa(franqueadoId);
    else wmSupEntrar();
    if (widgetState.isOpen) renderWidgetModalContent();
    else window.lumaWidgetOpen(trigger);
  };

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHelpWidget);
  } else {
    initHelpWidget();
  }
})();
