# Luma — notas do apresentador

> Fica fora da tela. Os 16 slides principais cabem em 15–18 minutos (1 min por slide; o 07 e o 08 pedem um pouco mais).
> O apêndice (A–L) é para perguntas: tecle **G** para o índice e pule direto para a letra.
> Toda afirmação com número tem fonte em [`CLAIMS.md`](CLAIMS.md). Se um número não está lá, não fale.

**Três coisas para ter na ponta da língua**

1. As telas são do produto de verdade, capturadas numa cópia local do app (sem dados de produção).
   As artes foram geradas pelo motor de render do Luma. Os templates foram montados importando PSDs
   feitos a partir das capas de campanha do próprio repositório, e as fotos dos produtos são do Unsplash.
   A franqueada "Carla" é uma persona de demonstração.
2. O CI está **vermelho** hoje (27/09). Diga antes que perguntem: é o mecanismo funcionando (slide 12, apêndice E).
3. Não há número financeiro validado neste deck, e não é para ter. O beta mede produto (slide 13).

---

## 01 · Capa — "Crie uma vez. A rede inteira executa."

- **Objetivo:** abrir com a promessa inteira em uma frase e mostrar, desde o primeiro segundo, que existe produto.
- **Frase de abertura:** "Crie uma vez. A rede inteira executa."
- **Discurso:** "Isto é o Luma, a plataforma de creative automation que construímos para a rede Delivery Much.
  Na tela, a home do franqueado de verdade, no computador, no tablet e no celular: as campanhas que a marca publicou,
  prontas para virar arte. Nos próximos minutos eu mostro como elas chegam ali e o que o franqueado faz com elas."
- **Ponto principal:** não é um conceito, é um produto com dois lados funcionando.
- **Transição:** "Antes do produto, o problema que ele resolve."
- **Perguntas difíceis:**
  - *"Essas telas são reais ou mockup?"* As telas são capturas do app, numa cópia local sem dados de produção,
    na resolução nativa de cada aparelho. As molduras dos aparelhos são as oficiais da Apple.
    As campanhas da vitrine foram importadas de PSD e publicadas pelo fluxo normal do Estúdio.

## 02 · O problema — "Escalar a rede não deveria escalar o retrabalho."

- **Objetivo:** nomear a dor. Criar a campanha não é o problema. O problema é executá-la dezenas de vezes.
- **Frase de abertura:** "Toda rede de franquia vive a mesma tensão."
- **Discurso:** "Uma campanha central vira execuções locais: muda o produto, o preço, a foto, a oferta, a cidade.
  A marca é uma só. Essas seis artes são da mesma campanha. [avança] E aqui mora a tensão: quanto mais
  autonomia damos à ponta, maior o risco de perder padrão. Quanto mais centralizamos, maior o gargalo do marketing."
- **Ponto principal:** hoje cada variação local é retrabalho de alguém.
- **Transição:** "A tese do Luma é sair dessa escolha."
- **Perguntas difíceis:**
  - *"Quantas variações a rede produz por mês?"* Não vou chutar. O beta mede recorrência semanal e o
    funil até o download, e é daí que sai esse número.

## 03 · A tese — "Autonomia local. Controle central. Sem colocar design no meio."

- **Objetivo:** fixar a frase que resume o produto.
- **Frase de abertura:** "Autonomia local. Controle central. Sem colocar design no meio."
- **Discurso:** "O fluxo tem quatro passos. No Estúdio, o designer transforma a campanha em regras. Na publicação,
  um material fica disponível para a rede inteira. O franqueado informa só o que é local: produto, preço, foto.
  E sai a arte pronta, dentro da marca. O designer continua decidindo o que é design. O franqueado informa
  apenas o que é local."
- **Ponto principal:** cada um faz o que sabe fazer. Ninguém faz o trabalho do outro.
- **Transição:** "Na prática, isso vira duas experiências dentro de um produto só."
- **Perguntas difíceis:**
  - *"E se o franqueado quiser mudar a cor ou o layout?"* Ele mexe no que o designer liberou na publicação
    (os campos e as permissões). O resto fica com o designer, e esse é o ponto.

## 04 · Duas experiências — "Duas experiências. Um único produto."

- **Objetivo:** mostrar os dois lados e o que os liga.
- **Frase de abertura:** "Duas experiências. Um único produto."
- **Discurso:** "À esquerda, o Estúdio: um editor profissional, escuro, feito para quem desenha. À direita, o
  franqueado: claro, uma pergunta por vez. O que liga os dois não é um arquivo exportado: são os mesmos
  campos, o mesmo motor de render, as mesmas regras e a mesma marca. O que o designer vê na simulação é o
  que o franqueado baixa."
- **Ponto principal:** um motor, dois públicos.
- **Transição:** "Começo pelo lado do designer."
- **Perguntas difíceis:**
  - *"Por que não duas ferramentas?"* Porque o valor está na ponte: publicou, apareceu para a rede, sem
    exportar nada e sem ninguém refazer a arte.

## 05 · O fluxo do designer — "O designer não precisa começar de novo."

- **Objetivo:** o designer aproveita o PSD que já tem, e o Luma é honesto sobre o que conseguiu preservar.
- **Frase de abertura:** "O designer não precisa começar de novo."
- **Discurso:** "Ele traz o PSD do dia a dia. O Luma importa e, em vez de dizer que ficou perfeito, mostra uma
  revisão: [avança] o que foi preservado, [avança] o que foi adaptado, [avança] o que exige atenção. Nesta
  importação são 13 camadas e 5 campos preparados, e o ponto de atenção é uma fonte do Photoshop que não
  existe no Luma. [avança] O designer confere 3 pontos, não 13 camadas. As camadas nomeadas com @campo já
  chegam como campos."
- **Ponto principal:** fidelidade medida e mostrada, revisão por exceção.
- **Transição:** "Revisado, o template vai para a publicação."
- **Perguntas difíceis:**
  - *"O import é 1:1?"* Não prometemos 1:1. O importador mede o visual e a editabilidade separados e diz
    onde aproximou. Nesta arte, a tela mostra fidelidade visual de 90%, e a causa principal é a fonte que faltou.
  - *"E PSD com efeito complexo?"* Cada camada recebe um nível (nativo, nativo com perda, raster fiel ou não
    suportado) com o motivo escrito. Nada some em silêncio. Detalhe no apêndice C, com 73 casos de regressão.

## 06 · Publicação — "O designer publica uma vez."

- **Objetivo:** publicar uma vez = a rede inteira recebe.
- **Frase de abertura:** "O designer publica uma vez."
- **Discurso:** "Publicar não é mandar um arquivo. Junto com a arte vão os campos locais, as permissões e as
  regras. A publicação tem três etapas: qualidade, configuração e revisão. Erro crítico no checklist não
  publica. [avança] Publicado, o material aparece no catálogo de cada franquia."
- **Ponto principal:** uma publicação, toda a rede, dentro da validade.
- **Transição:** "Agora o outro lado: o franqueado."
- **Perguntas difíceis:**
  - *"E quando a campanha acaba?"* A validade vai na publicação. O material fica visível no catálogo
    enquanto estiver dentro dela (está escrito na própria tela de revisão).

## 07 · Uma conversa — "O franqueado não edita uma arte. Ele responde uma conversa."

- **Objetivo:** o momento "aha". A arte se monta enquanto o franqueado responde.
- **Frase de abertura:** "O franqueado não edita uma arte. Ele responde uma conversa."
- **Discurso:** "Cinco perguntas: foto, produto, preço original, preço promocional, validade. [avança a cada
  resposta, deixe a digitação terminar] A cada resposta, a prévia ao vivo se atualiza. Cada quadro que vocês
  veem foi gerado pelo motor de render do Luma, o mesmo do download. Não tem camada, não tem régua, não tem
  como quebrar a arte. [último passo] Arte pronta, salva em Minhas artes, com a legenda sugerida."
- **Ponto principal:** parece vivo e não tem como quebrar.
- **Transição:** "E repara na legenda: ela também saiu pronta."
- **Perguntas difíceis:**
  - *"Funciona no celular?"* Sim. Há uma suíte de estresse que roda o fluxo inteiro numa tela de iPhone.
  - *"E se ele digitar um nome enorme ou errar o preço?"* Está no slide 09.
  - *"A legenda é IA?"* É o próximo slide.

## 08 · A legenda — "A arte sai com a legenda. E ela fala a nossa língua."

- **Objetivo:** mostrar que a legenda também sai pronta, no tom da Delivery Much, e que anos de copy
  viraram um ativo do produto.
- **Frase de abertura:** "A arte sai com a legenda. E ela fala a nossa língua."
- **Discurso:** "Quando a arte fica pronta, a legenda já está do lado. Ela sai de um motor combinatório
  que a gente alimentou com anos de copy da Delivery Much: 107 ganchos, divididos por tipo de cardápio,
  66 moldes de corpo e 25 chamadas. O motor junta um gancho, um corpo e uma chamada que combinam com o
  que o franqueado informou. [avança] Gerar outra sugestão: a opção Engajar puxa conversa. [avança] A de
  WhatsApp vira mensagem, sem hashtag. [avança] E na arte seguinte nenhuma frase se repete. Só para este
  lanche em promoção são 2.430 legendas diferentes, sem contar as hashtags. Três leis: não inventa preço
  nem validade, não repete frase, não soa artificial."
- **Ponto principal:** a voz da marca virou produto. A rede escala sem perder o tom.
- **Transição:** "Parece simples. Por baixo, não é."
- **Perguntas difíceis:**
  - *"Isso é IA?"* O motor, não: roda no navegador, sem rede, combinando frases que a gente escreveu.
    No chat, quando a IA está disponível, ela pode reescrever por cima com as mesmas regras (sem inventar,
    sem emoji) e com o jeito da cidade. Se ela não responder, a legenda do motor já está lá. No Luma
    Sheets, cada arte do lote sai com legenda do motor.
  - *"E se sair uma legenda errada?"* A primeira lei é não inventar: preço, desconto e validade só aparecem
    se o franqueado informou. E é sugestão: ele copia, pede outra ou ajusta antes de publicar.
  - *"Quantas legendas diferentes existem?"* Depende do produto e do que foi informado. Para este lanche
    em promoção, 2.430 na opção Promo, sem contar as hashtags (a conta está no CLAIMS.md).

## 09 · Inteligência invisível — "Por baixo, o Luma resolve o que não deveria virar problema do franqueado."

- **Objetivo:** mostrar a engenharia que o franqueado não vê.
- **Frase de abertura:** "Por baixo, o Luma resolve o que não deveria virar problema do franqueado."
- **Discurso:** "[avança] Local Fit: o nome curto, médio ou longo cabe na caixa que o designer desenhou,
  quebrando linha ou reduzindo dentro dela, e nada mais na arte se move. [avança] Quando não cabe, o Encurtar
  sugere versões mais curtas medidas na própria arte, e preço, números e itens nunca somem. O franqueado
  escolhe. [avança] A aba Respostas mostra tudo o que entrou na arte, com um lápis para corrigir sem refazer
  a conversa. [avança] E as validações: preço "por" maior que o "de" é recusado na hora."
- **Ponto principal:** complexidade por baixo, simplicidade por cima.
- **Transição:** "E isso não vale só para uma arte por vez."
- **Perguntas difíceis:**
  - *"O Encurtar é IA?"* Não. É determinístico, roda em menos de 1 ms, sem rede e sem IA. As regras geram
    versões e o Local Fit mede em pixel quais cabem.
  - *"Resolve todos os casos?"* Não, e não dizemos que resolve. Quando nada cabe com legibilidade, o Luma
    avisa antes do download em vez de estourar a arte.

## 10 · Escala — "Uma arte por vez. Ou dezenas."

- **Objetivo:** mostrar que o chat é só uma das portas do mesmo motor.
- **Frase de abertura:** "Uma arte por vez. Ou dezenas."
- **Discurso:** "No Luma Sheets, cada linha é uma oferta. A fila gera todas com as regras do designer: aqui,
  seis ofertas viram seis artes num ZIP. À direita, 15 artes de 4 campanhas em 2 formatos, todas saídas do
  mesmo motor. O chat é uma interface. Por trás existe um motor de creative automation."
- **Ponto principal:** o motor é o produto; o chat e a planilha são interfaces.
- **Transição:** "E esse produto não para no lançamento."
- **Perguntas difíceis:**
  - *"Essas 15 artes são da rede?"* Não, são artes de demonstração geradas pelo motor a partir de templates
    de demonstração. O motor é o mesmo que a rede vai usar.

## 11 · Produto vivo — "O Luma não termina quando é lançado. Ele aprende."

- **Objetivo:** mostrar o ciclo de melhoria e como a rede fica sabendo.
- **Frase de abertura:** "O Luma não termina quando é lançado. Ele aprende."
- **Discurso:** "O ciclo tem quatro passos: feedback (o convite depois do download, o suporte e o beta),
  melhoria decidida pelo que a rede sentiu, release sem instalar nada, e as Novidades contadas na língua
  de quem usa. [avança] As Novidades saem no máximo uma vez por semana. Commit não é notícia: entra só o que
  a rede sente. E quando a mudança veio de um pedido da rede, a edição diz isso. Vocês pediram, a gente ouviu."
- **Ponto principal:** a rede vê o produto melhorar, e sabe por quê.
- **Transição:** "Para isso funcionar em escala, a engenharia tem que aguentar."
- **Perguntas difíceis:**
  - *"Esse convite de beta já está no ar?"* O recurso é real: a edição pode trazer um convite e o "Quero
    participar" vira um sinal para a equipe. O texto desta captura foi montado para a demonstração.

## 12 · Confiança — "Já existe engenharia suficiente para colocar o produto diante de usuários reais."

- **Objetivo:** dar confiança com prova, sem prometer perfeição.
- **Frase de abertura:** "Já existe engenharia suficiente para colocar o produto diante de usuários reais."
- **Discurso:** "844 verificações automáticas, em 22 suítes, num navegador de verdade. 300 artes geradas e
  conferidas pelo motor real, 60 delas pelo fluxo completo do franqueado no app. 31 cenários de estresse,
  73 casos no importador de PSD. A segurança mora no banco: as 32 tabelas têm RLS. E 41 recursos a gestão
  liga e desliga sem deploy. Não estamos dizendo que nunca vai quebrar. Estamos dizendo que construímos
  mecanismos para saber quando quebra."
- **Ponto principal:** mecanismos para saber quando quebra.
- **Transição:** "Por isso a próxima etapa é pôr o Luma na mão da rede."
- **Perguntas difíceis:**
  - *"Está tudo verde?"* Não. Na execução de 27/09 são 838 de 844: 5 casos no Copy Fit e 1 no corpus do
    Local Fit. E o CI está vermelho no portão de arquitetura (uma catraca de localStorage subiu de 56 para 59).
    É o mecanismo fazendo o trabalho dele, e esses itens estão na lista antes do beta. Apêndice E.
  - *"Quem mantém isso?"* O código tem leis de arquitetura cobradas pelo CI e os motores são únicos
    (um interpolador, um render). Apêndice A.

## 13 · Beta — "A V1 está pronta. Agora começa a parte mais importante."

- **Objetivo:** pedir o beta com a rede e dizer o que ele mede.
- **Frase de abertura:** "A V1 está pronta. Agora começa a parte mais importante: colocar o Luma na mão da rede."
- **Discurso:** "Franqueados reais, uso real, feedback, ajuste, nova rodada, e de novo. O beta mede produto:
  se a primeira arte sai sem ajuda, quanto tempo leva até o download, quantos que começam chegam ao download,
  se voltam toda semana, onde pedem suporte, que problemas aparecem e o que dizem."
- **Ponto principal:** o beta mede produto, não receita.
- **Transição:** "E o que isso vale para a empresa."
- **Perguntas difíceis:**
  - *"Quantas franquias e por quanto tempo?"* É uma decisão da rede e da gestão, e é o que estamos pedindo
    para definir juntos.
  - *"O franqueado vai pagar?"* Não é o que este beta discute.

## 14 · Valor — "Economia foi o ponto de partida. Não precisa ser o teto."

- **Objetivo:** reenquadrar o valor além do corte de custo, sem inventar número.
- **Frase de abertura:** "Economia foi o ponto de partida. Não precisa ser o teto."
- **Discurso:** "O Luma reduz: ferramentas externas, retrabalho, tarefas repetitivas, dependência operacional.
  [avança] Aumenta a capacidade: mais campanhas e mais execuções locais com o mesmo time central. [avança]
  E cria um ativo: software próprio, know-how de creative automation, propriedade intelectual e a
  possibilidade futura de um produto. O cenário financeiro mudou. O produto também."
- **Ponto principal:** de custo evitado para capacidade e ativo.
- **Transição:** "E se funciona aqui..."
- **Perguntas difíceis:**
  - *"Quanto economiza?"* Não vou apresentar número que não foi validado. O beta mede o uso real e o número
    financeiro fecha com esses dados.

## 15 · Horizonte — "Se funciona aqui, o problema não existe só aqui."

- **Objetivo:** abrir o horizonte sem previsão e sem pedir para vender.
- **Frase de abertura:** "Se funciona aqui, o problema não existe só aqui."
- **Discurso:** "Toda rede com marca central e execução local tem esse problema. A Delivery Much é o cliente
  zero. White label não é vender o código: a plataforma continua nossa, outras redes licenciariam, cada uma
  com sua identidade, sobre uma base única que evolui para todos. Hoje não estamos pedindo para vender o Luma.
  Estamos construindo o case que permitiria essa conversa existir depois."
- **Ponto principal:** o beta daqui é o case de amanhã.
- **Transição:** "Para fechar."
- **Perguntas difíceis:**
  - *"O que falta para white label?"* Isolamento por rede no banco (hoje o Luma atende uma rede só),
    configuração e marca por rede, onboarding, suporte e contrato por cliente. Apêndice K.
  - *"Quanto isso vale?"* Não há previsão neste deck, de propósito.

## 16 · Fechamento — "Uma marca no controle. Uma rede com autonomia."

- **Objetivo:** fechar a tese e pedir o próximo passo.
- **Frase de abertura:** "Uma marca no controle. Uma rede com autonomia."
- **Discurso:** "[avança] E um produto pronto para enfrentar o mundo real. [avança] O próximo passo é o beta com a rede."
- **Ponto principal:** o pedido é o beta.
- **Transição:** abra para perguntas. Tecle **G** para o apêndice.

---

## Apêndice — para perguntas

| Letra | Use quando perguntarem… |
|---|---|
| **A · Arquitetura** | "Onde isso roda? Tem servidor?" Um navegador e um banco: SPA estática no GitHub Pages, Supabase, RLS. |
| **B · Segurança** | "E os dados?" 32 de 32 tabelas com RLS, papel vindo do servidor, segredos só em Edge Functions. |
| **C · Importador de PSD** | "O PSD vem igual?" Fidelidade como propriedade explícita: dois eixos, um motivo por camada. |
| **D · Local Fit e Copy Fit** | "E texto grande?" A escada do Local Fit e o Encurtar, com as três artes reais. |
| **E · CI e testes** | "Está testado?" A tabela das 22 suítes, com o estado honesto de 27/09. |
| **F · Suporte** | "Quem ajuda o franqueado?" Atendimento com dono, estado e histórico. |
| **G · Telegram** | "A equipe precisa ficar com o Luma aberto?" A ponte com o Telegram, que nasceu desligada. |
| **H · Feature flags** | "Dá para liberar aos poucos?" A cascata de chaves, com nomes reais do registro. |
| **J · Evoluções pós-V1** | "E Calendário, Academia, CRM?" Fora da V1, com o estado de cada um. |
| **K · White label** | "O que falta para outra rede?" O que existe e o que faltaria. |
| **L · Fluxo anterior × Luma** | "E a ferramenta que usamos hoje?" Comparação de fluxo, nunca de fornecedor. |

**Sobre a ferramenta atual (Deskfy):** é uma ferramenta madura e resolve bem o que se propõe. Não compare
recursos nem preço em público. A diferença está no fluxo: no Luma o franqueado responde perguntas e o
design fica protegido, e o roadmap é nosso, guiado pelo que a rede pede.
