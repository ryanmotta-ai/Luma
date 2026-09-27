/* ── NOVIDADES DO LUMA — o changelog curado que a rede lê na Ajuda ──
 * Uma EDIÇÃO por semana, no máximo, com as mudanças que quem usa sente. Lido por
 * js/widgets/help-widget.js (Início, "Ver todas", a edição aberta e o destaque na aba Ajuda).
 *
 * POR QUE EDIÇÃO E NÃO NOTÍCIA SOLTA (27/09/2026): em 23–26/09 saíram 6 notícias em 4 dias.
 * Cada uma era verdade, mas juntas viravam ruído, e ninguém lê a sétima. A edição junta a
 * semana numa leitura só e dá ritmo: a pessoa percebe o Luma andando sem ser cutucada a
 * cada commit.
 *
 * AS REGRAS (o `node scripts/novidades.js --checar` reprova no CI o que der para medir):
 *   · no máximo 1 edição a cada 7 dias. Mudou mais coisa? Entra na mesma edição ou na próxima;
 *   · mais recente PRIMEIRO; `data` (AAAA-MM-DD) é o dia em que a edição vai ao ar, nunca futura;
 *   · só entra o que a rede SENTE. Refator, teste, doc e correção invisível ficam de fora;
 *   · a copy fala do benefício, na língua de quem usa, com o nome que está na tela. Nunca
 *     prometa o que não existe: quem lê vai procurar o botão;
 *   · `pedido` só quando a mudança veio de pedido da REDE (franqueado, beta tester). Diz o
 *     que pediram, sem nome de pessoa. Vira o "Vocês pediram… A gente ouviu." do item;
 *   · `beta` é opcional e só aparece enquanto a edição é a mais recente. É convite, não
 *     enquete: um botão, "Quero participar", e nada de curtir ou comentar.
 *
 * DE ONDE VEM O RASCUNHO: `node scripts/novidades.js` lê os commits com o trailer
 * `Novidade:` desde a última edição e imprime a próxima já no formato daqui, com
 * "✎ REVISAR" onde falta mão humana. Alguém cura, cola no topo desta lista e faz o deploy.
 * O CI reprova "✎ REVISAR" esquecido, então rascunho não curado não chega na rede.
 *
 * FORMATO
 *   edição: { id, data, titulo, resumo, itens: [item…], beta? }
 *   item:   { id, icon, title, body: [parágrafo…], arte?, artigo?, perguntar?, requer?, pedido? }
 *     icon    = chave do WM_ICO (help-widget.js). arte = ilustração em CSS (wmNovidadeArte).
 *     artigo  = id de um artigo da Ajuda; vira o link "Ler: …" no fim do item.
 *     requer  = 'suporte' esconde o item com o suporte ao vivo desligado (recurso desligado
 *               não é notícia; é promessa falsa).
 *   beta:   { id, titulo, texto }  titulo no molde "Estamos testando X."
 *     Quem toca em "Quero participar" vira o evento `beta_interesse` (payload.beta = id):
 *     a equipe vê nome e data em Dados › Eventos. Sem tabela nova.
 *
 * ⛔ Nada aqui é HTML: tudo passa por wmEsc na hora de desenhar.
 * Depende de: nada. Carrega antes de js/widgets/help-widget.js.
 */
const LUMA_NOVIDADES = [
  { id: '2026-09-27', data: '2026-09-27',
    titulo: 'Menos ajuste até a arte ficar pronta',
    resumo: 'O texto que não cabe ganhou uma saída, as linhas quebram com mais cuidado e a foto já entra no lugar certo.',
    itens: [
      { id: 'encurtar', icon: 'scissors', arte: 'encurtar',
        title: 'Texto grande demais? Toque em Encurtar',
        body: ['Quando o que você digitou está perto do limite ou não cabe no espaço da arte, o botão Encurtar aparece no campo.', 'O Luma sugere versões mais curtas que mantêm o produto, o preço e a oferta. Você escolhe uma ou edita do seu jeito.'],
        artigo: 'texto-nao-cabe' },
      { id: 'quebra-linha', icon: 'text', arte: 'quebra',
        title: 'Quebras de linha mais bonitas',
        body: ['O Luma passou a escolher onde quebrar cada texto olhando o conjunto: as linhas saem com tamanho parecido, sem preposição ou "+" pendurado no fim, sem separar o número do que ele conta e sem largar uma palavra sozinha na última linha.', 'Você não precisa fazer nada: vale para todas as artes.'] },
      { id: 'foto-previa', icon: 'crop', arte: 'foto',
        title: 'Ajuste a foto direto na prévia',
        body: ['A foto agora se ajusta pela própria arte: toque nela na prévia e escolha Trocar foto ou Reposicionar e Zoom.', 'No celular, o ajuste abre em tela cheia, com espaço para arrastar a foto com o dedo.'],
        artigo: 'ajustar-foto' },
      { id: 'enquadramento', icon: 'image',
        title: 'Foto e logo já entram no lugar certo',
        body: ['O Luma olha a imagem que você envia e decide o enquadramento de partida. O logo ganha zoom até a marca ocupar a moldura, sem cortar. A foto do produto é centralizada no que importa.', 'Se quiser mudar, é só tocar em Ajustar.'],
        artigo: 'logo' },
      { id: 'suporte', icon: 'chat', arte: 'suporte', requer: 'suporte',
        title: 'Fale com a equipe DM por aqui',
        body: ['Travou em alguma etapa? Agora dá para conversar com a equipe DM sem sair do Luma. Quando alguém da equipe está com o Luma aberto, sua pergunta vai direto para essa pessoa.', 'Se ninguém estiver online, o assistente responde na hora. O que você mandar para a equipe fica em Mensagens, e a resposta aparece lá.', 'Aprovação de peça e pedido de arte nova continuam com o marketing da sua empresa.'],
        perguntar: true },
      { id: 'nome-arquivo', icon: 'file',
        title: 'Arquivo baixado com nome de gente',
        body: ['Nada de nome aleatório na galeria: o arquivo agora sai com um nome que dá para reconhecer, como "X-Tudo Duplo - Story - Copa.png".'],
        artigo: 'baixar' }
    ] }
];
