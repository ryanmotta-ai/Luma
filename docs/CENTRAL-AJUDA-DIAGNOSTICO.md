# Diagnostico - Central de Ajuda do Luma

> Status: diagnostico concluido; Entrega A implementada em 2026-07-15.
> Escopo: unificar a experiencia de ajuda; nao inclui backend, suporte humano real ou redefinicao do design system.

## Objetivo

Transformar o botao flutuante na entrada unica da Central de Ajuda. A central deve reunir os tutoriais existentes, busca, ajuda contextual e o onboarding do franqueado. O botao superior de Ajuda so sera removido depois que a nova entrada preservar todos os seus caminhos uteis.

## Entrega A registrada

- O botao flutuante agora abre a Central de Ajuda; o botao da topbar permanece como gatilho equivalente durante a transicao.
- O modal recebeu `role="dialog"`, `aria-modal`, abas semanticas, estado `aria-expanded`, foco inicial, retorno ao gatilho e focus trap por Tab/Shift+Tab.
- Os cards clicaveis da trilha passaram de `div` para `button`, permitindo navegacao por teclado.
- O chat legado continua inicializado somente para nao quebrar o CTA de erro atual; sua retirada permanece na Entrega D, depois da migracao de conteudo e de uma validacao manual no navegador.

## Entrega B registrada

- Busca unica por titulo, descricao e palavras-chave para tutoriais e guias rapidos verificados.
- Migrados para a Central os guias de PDF, CSV e envio de foto, com copy alinhada ao fluxo real do produto.
- Secao "Nesta tela" usa o modo atual e a aba ativa do Estudio para sugerir os proximos tutoriais relevantes.
- O chat legado ainda mantem seu catalogo proprio ate a Entrega D; a Central passa a ser a fonte de descoberta para o usuario.

## Entrega C registrada

- O onboarding do franqueado agora aparece como progresso dentro da Central, reutilizando as mesmas chaves de localStorage existentes.
- `gToast` so exibe um CTA de ajuda quando a chamada informa um artigo correspondente; erros genericos nao apontam mais para upload.
- A falha de geracao que orienta reenviar foto abre o guia de upload da Central.
- O fluxo de suporte humano do chat deixou de habilitar envio simulado e informa honestamente que esse canal ainda nao existe no Luma.

## Estado atual

| Superficie | Implementacao | O que entrega hoje | Problema principal |
|---|---|---|---|
| Ajuda superior | `#top-help-btn` + `js/core/help.js` | trilha por papel, catalogo pesquisavel e abertura dos 18 tutoriais | segunda entrada concorrente; modal nao gerencia foco como dialogo completo |
| Widget flutuante | `js/core/help-chat.js` + `css/components/help-chat.css` | FAQ por arvore, autocomplete, spotlight e onboarding do franqueado | mistura ajuda, onboarding e falso suporte humano em um componente de 1067 linhas |
| Tutorial animado | `js/tutorial/engine.js` + catalogos | 4 tutoriais de franqueado e 14 do Estudio, progresso persistido | e o conteudo certo, mas esta exposto por duas experiencias diferentes |
| Guia no Estudio | `dtab-tutorial` + `tutorial-panel.js` | acordeoes explicativos, modelo de exemplo, links para tutoriais e atalhos | e um ponto de descoberta valido, mas duplica copy e ainda usa icones emoji |

Fluxo atual:

```text
Topbar Ajuda -> modal (Trilha / Catalogo) -> tutorial animado
Botao flutuante -> chat/FAQ -> spotlight, onboarding ou resposta simulada
Painel Tutorial do Estudio -> modal de Ajuda / atalhos / modelo de exemplo
Toast de erro -> chat -> resposta fixa de upload
```

## Conteudo e estado que devem ser preservados

- Os 18 tutoriais e seus IDs em `js/tutorial/catalog.js` e `js/tutorial/catalog-studio.js`.
- Progresso dos tutoriais em `yngs_tutorials_done`.
- Escolha de aba e primeira visita da ajuda em `yngs_help_active_tab` e `yngs_help_visited`.
- Onboarding do franqueado em `luma_onboarding_franqueado`, alimentado por escolha de material, download de PNG e CSV.
- Spotlight contextual do Estudio para Dados, pintura e publicacao.
- O painel Tutorial do Estudio, incluindo o carregamento do modelo de exemplo e a folha de atalhos.
- Fechamento por `Esc`, clique externo e `prefers-reduced-motion`, que ja existem parcialmente.

## Achados confirmados

### P0 - confianca e honestidade

1. O fluxo "Falar com o Suporte Humano" nao possui integracao de envio. Depois de uma mensagem, ele apenas mostra uma confirmacao local e desabilita o campo. O texto promete que alguem chamara o usuario no proprio chat. Fonte: `js/core/help-chat.js:451-511`.
2. Todo toast de erro oferece "Como resolver?" e encaminha para a FAQ de upload, independentemente do erro que ocorreu. Fonte: `js/core/toast.js:22-39`.

### P1 - navegacao e acessibilidade

1. O modal superior nao tem `role="dialog"`, `aria-modal`, retorno do foco ao gatilho ou focus trap. O stage de tutorial ja possui parte dessa semantica e pode servir de referencia. Fontes: `index.html:283-312`, `index.html:500`, `js/core/help.js:221-251`.
2. O widget flutuante nao fecha por `Esc`, nao declara `aria-expanded` e nao move o foco para a primeira acao quando abre. Fonte: `js/core/help-chat.js:300-321`.
3. Os estilos dos dois pontos de ajuda usam `:focus` ou nenhum estado de foco, em vez de `:focus-visible` consistente. Fontes: `css/components/help-modal.css`, `css/components/help-chat.css`.
4. O spotlight bloqueia a interacao do alvo destacado com `pointer-events:none`; hoje ele serve apenas para explicar, nao para guiar a acao. Fonte: `css/components/help-chat.css:767-784`.

### P1 - duplicacao e manutencao

1. Ajuda superior e widget possuem catalogos e buscas independentes. O primeiro usa `G_HELP_CATALOG`; o segundo usa `G_CHAT_FLOW` e `G_AUTOCOMPLETE_DATABASE`.
2. O widget concentra FAQ, reconhecimento de voz, busca, onboarding, sandbox de regras e spotlight. Essa mistura torna qualquer ajuste de ajuda de alto risco.
3. O painel Tutorial do Estudio continua no DOM, mas `dActivatePanel` o esconde; seus botoes ainda apontam para os sistemas atuais. Fontes: `index.html:1914-1922`, `js/designer/layers.js:1952-1953`.

### P2 - consistencia visual e copy

1. A interface de ajuda ainda usa emojis como icones fixos e possui cores, timings e sombras fora dos tokens. A auditoria de UI ja registra 90 hex em `help-chat.css` e emoji em Ajuda. Fonte: `docs/ROADMAP-UI-1.0.md:24,72,80,175`.
2. O rodape do modal informa "piloto interno" e "v0.4", em desacordo com a direcao de v1. Fonte: `index.html:307-311`.
3. "Suporte Luma", "Central de Ajuda" e "Ajuda" sao usados para coisas diferentes. A nova experiencia deve usar "Central de Ajuda" como nome do produto e reservar "suporte" apenas para um canal real.

## Arquitetura recomendada

Evoluir `js/core/help.js` para ser a fonte unica de navegacao e conteudo. Nesta etapa nao e necessario criar uma camada nova ou mudar o motor de tutorial.

```text
Botao flutuante (entrada unica)
  -> Central de Ajuda
       -> Comecar / continuar trilha por papel
       -> Buscar tutoriais e atalhos
       -> Ajuda desta tela
       -> Progresso inicial do franqueado
       -> Acoes indisponiveis, rotuladas com honestidade
  -> tutOpen(id) para a experiencia de tutorial existente
```

Principios da central:

- Uma unica fonte para IDs, titulo, descricao, papel, palavras-chave e destino contextual.
- Conteudo contextual deriva do modo ativo (`franqueado` ou `designer`) e de uma lista pequena de contextos conhecidos: editor, simulacao, publicacao, campos, campanhas e catalogo.
- Itens sem integracao real devem aparecer como indisponiveis, com copy explicita; nao podem simular atendimento, envio de sugestao ou abertura de chamado.
- A central deve manter foco, retornar ao gatilho, fechar por `Esc` e clique externo, e respeitar reduced motion.
- O widget nao deve mais carregar voz, sandbox ou chat livre como requisitos para a central. Esses recursos so sobrevivem se houver caso de uso confirmado em revisao posterior.

## Fluxo proposto

1. O usuario abre o botao flutuante "Central de Ajuda".
2. A primeira secao mostra uma unica proxima acao: continuar trilha ou iniciar a tarefa contextual da tela atual.
3. A busca encontra tutoriais, atalhos e artigos pela mesma base de conteudo.
4. Um tutorial abre o stage existente; ao sair, o foco retorna a central e o progresso e atualizado.
5. O onboarding do franqueado aparece como progresso discreto dentro da central, sem competir com a FAQ.
6. Quando nao ha canal real de suporte, a central informa isso claramente e oferece apenas caminhos que funcionam.

## Plano incremental de implementacao

### Entrega A - fundacao acessivel e ponto de entrada

- Tornar o widget flutuante o gatilho para `gOpenHelp()`.
- Adicionar semantica de dialogo, focus trap, retorno de foco e estado `aria-expanded` ao modal.
- Preservar Topbar Ajuda por compatibilidade nesta entrega; os dois gatilhos abrem a mesma central.
- Nao alterar catalogos, tutorial engine ou onboarding ainda.

Criterio de aceite: mouse, teclado e `Esc` abrem/fecham de forma previsivel; foco nunca fica atras do modal; os 18 tutoriais continuam abrindo.

### Entrega B - consolidacao de conteudo

- Levar os topicos de FAQ realmente validos do chat para a base de conteudo de `help.js`.
- Fazer busca unica por titulos, descricoes e palavras-chave.
- Adicionar uma secao "Nesta tela" para o modo/contexto atual.
- Manter o spotlight somente nos tres destinos existentes e validar cada um no navegador.

Criterio de aceite: nenhum tutorial ou caminho contextual perde cobertura; pesquisa encontra conteudo equivalente ao FAQ atual.

### Entrega C - onboarding e erros

- Mover o progresso do franqueado para a central, sem trocar suas chaves de localStorage.
- Substituir o CTA generico de toast por um payload de ajuda opcional e especifico por erro; toasts sem artigo nao exibem CTA enganoso.
- Trocar o fluxo de suporte humano simulado por estado indisponivel ate existir canal real aprovado.

Criterio de aceite: cada CTA de erro leva a orientacao correspondente ou nao aparece; nenhuma tela promete envio que nao acontece.

### Entrega D - retirada do legado

- Remover o botao superior depois de uma rodada manual completa nas duas personas.
- Remover o widget/chat legado, CSS e inicializacao que nao tiverem consumidores.
- Manter o painel Tutorial do Estudio apenas como atalho para a central e para o modelo de exemplo, ou simplifica-lo em tarefa propria.

Criterio de aceite: nao ha mais duas centrais de ajuda, referencias orfas, nem scripts/CSS sem uso.

## Arquivos previstos por entrega

| Entrega | Arquivos principais | Risco |
|---|---|---|
| A | `index.html`, `js/core/help.js`, `css/components/help-modal.css` | medio; modal e navegacao global |
| B | `js/core/help.js`, `js/core/help-chat.js` | medio; migracao de conteudo e spotlights |
| C | `js/core/help.js`, `js/core/toast.js`, chamadas de erro selecionadas | medio; exige verificar mensagens reais |
| D | `index.html`, `js/main.js`, `js/core/help-chat.js`, `css/components/help-chat.css` | alto; remocao de legado e verificacao ampla |

Cada entrega deve ser feita isoladamente, com diff revisado antes de tocar no proximo pacote. Nenhuma delas requer backend.

## Validacao obrigatoria

- Franqueado: abrir central, pesquisar, iniciar tutorial, gerar uma arte, conferir onboarding e voltar para o fluxo.
- Designer: abrir central no Estudio, abrir Dados, pintura e publicacao por ajuda contextual, iniciar tutorial e sair com `Esc`.
- Teclado: Tab/Shift+Tab dentro da central, `Esc`, retorno ao gatilho e foco visivel.
- Responsividade: 360px, desktop e janela baixa; sem sobreposicao do botao flutuante com controles criticos.
- Estados: primeiro acesso, trilha parcial, trilha completa, busca vazia, item indisponivel e reduced motion.
- Regressao: tutorial engine, modelo de exemplo, atalhos e toasts continuam funcionando.

## Decisoes necessarias antes da Entrega C/D

1. Qual canal real deve receber relatos de problema e sugestoes: email, WhatsApp, formulario ou ferramenta de tickets.
2. O reconhecimento de voz e o sandbox de regras tem uso comprovado para justificar migracao; a recomendacao e aposenta-los se nao tiverem uso.
3. O painel Tutorial do Estudio deve continuar como guia resumido ou virar somente um atalho para a Central de Ajuda.
