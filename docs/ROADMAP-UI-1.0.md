# ROADMAP — UI 1.0 do Luma

> **O que é:** o plano, tela a tela, para levar a interface do Luma ao nível "versão 1.0" — consistente com o `luma-brain` (04_DESIGN_SYSTEM, 05_DESIGN_PHILOSOPHY, design-review).
> **Como nasceu:** auditoria de 2026-07-15 — instrumentada (scripts de medição no navegador, tela a tela) + análise estática do CSS/JS. Números citados foram **medidos**, não estimados.
> **Método de trabalho:** cada item segue o loop do `06_OPERATING_SYSTEM` — patch cirúrgico, verificação no navegador, sem commit automático. Redesign de tela = **mockup aprovado antes de código** (lição §10.2).
> Status: 🔴 não começado · 🟡 em andamento · ✅ feito

---

## 1. Estado atual — notas honestas por superfície

Notas pelo grid do `design-review.md` (média dos 11 critérios). Onde a inspeção visual fina não foi possível (captura de tela indisponível no ambiente da auditoria), a nota é estrutural e está marcada com *.

| Superfície | Nota | Diagnóstico em uma linha |
|---|---|---|
| **Franqueado · Home (vitrine)** | ~9.0 | A melhor tela do produto: fluida, hierárquica, na marca. Falta pouco (thumbs de rascunho são bloco de cor). |
| **Franqueado · Materiais** | ~8.5 | Consistente; thumbs reais; empty state bom. |
| **Franqueado · Chat + Prévia** | ~8.5 | Fluxo forte; prévia com avisos já corrigida (teto de chips). Intro do chat tem bloco de estilo inline. |
| **Franqueado · Histórico** | ~8.5 | Filtros + busca ok; cards limpos. |
| **Luma Sheets (modal)** | ~6.5 | Funciona muito, mas é o epicentro de estilo inline (o grosso dos 343 `style=` do index) e a toolbar cresceu por acreção (12+ controles no mesmo nível). |
| **Estúdio (editor)** | ~7.5* | Denso como deve ser, mas é o campeão de hex fora de token (109 no CSS) e ~70 toasts com emoji. Empty state sem documento é pobre (verificar visualmente). |
| ~~**Dados**~~ | — | 🗑️ **Sai do produto** (decisão de 2026-07-15) — não é mais avaliado nem refinado. Ver §2.7. |
| **Perfil do usuário (modal)** | ~5.5 | O módulo mais fora da régua: 45 hex no CSS, 14 toasts com emoji (📸✅🔐), `alert()` nativo, emoji na própria UI (☀/🌙/💡), badge "ADMIN" fora do vocabulário, métricas vazias ("Tempo em Sessão 0 min"). |
| **Ajuda (modal + chat)** | ~6.0 | Emoji na UI (📚 Trilha, 🔍 Catálogo, 🔎 no placeholder), 90 hex no CSS, rodapé "piloto interno v0.4". |
| **Login / Splash** | n/a* | Não avaliado visualmente; estruturalmente tem o problema arquitetural mais sério (§2.1). |
| **Tutorial** | ~7.0* | 34 hex CSS + 31 timings fora de token; mocks com hex inline por design (aceitável — são cenas). |

---

## 2. Achados transversais (o que sangra em todas as telas)

### 2.1 Arquitetura de overlays — o achado nº 1 (acessibilidade + higiene)

> ✅ **RESOLVIDO em 2026-07-15.** E **corrigindo minha própria nota**: a 1ª versão dizia que o
> `#g-login-screen` ficava visível "permanentemente" com o app por baixo. **Estava errado** — medi
> deslogado. `gOnLoginSuccess()` esconde o login com `display:none` ([main.js:62](../js/main.js));
> ele só aparece sem sessão, o que é correto. Fica registrado porque doc que mente é pior que doc ausente.

**Medido (o problema real):** o padrão `.modal-overlay` fechava com `opacity:0; pointer-events:none`
mas **mantinha `display:flex`** — isso não tira da árvore de acessibilidade nem do Tab. Somando a
gaveta `#d-resources-drawer` (fora da tela via `translateX`) e o `#d-export-modal`, eram
**76 elementos focáveis alcançáveis por Tab dentro de overlays invisíveis** (só o Sheets tinha 19).

**Correção aplicada:** `visibility:hidden` no fechado (+ `visible` no `.open`), com o flip atrasado
para o fim do fade — preserva a animação de saída e some dos dois lugares.
**Verificado: 76 → 0 focáveis vazando**; os 8 overlays continuam abrindo/fechando.

### 2.1b Bug achado no caminho: a exportação em lote estava MORTA — ✅ RESOLVIDO

Investigando o overlay, o navegador mostrou `#d-export-modal` com `position:static`, `z-index:auto`,
em `y≈900` (fora da tela) **mesmo depois de `dOpenExportModal()`**. Causa: **nenhuma regra CSS casava**
`.d-modal-overlay`, `.d-modal`, `.d-modal-header`, `.d-modal-close`, `.dbtn-primary`, `.dbtn-secondary`
nem `.d-export-fmt-btn` — o markup e o JS existiam, a folha de estilo nunca existiu. O botão "Exportar"
era um **no-op silencioso** e o `.active` do seletor de formato também. (Mesma classe do bug do `tooltip.js`.)

Corrigido reusando o padrão de modal da casa. A ressurreição expôs a dívida de hex inline do markup
(assumia tema escuro): no tema claro o título tinha contraste **1.00** — branco no branco. Tokenizado.
**Medido depois:** título **19.8** (claro) / 15.27 (escuro), corpo e label ≥6.6, chip ativo 5.29,
CTA 3.35 (o AA-large que o DS §2 bendiz para `--dm-orange-d`).

### 2.1c Guarda de `prefers-reduced-motion` incompleta — ✅ RESOLVIDO

`css/02-animations.css` zerava `animation-duration`/`transition-duration` mas **não** os `delay`s —
com movimento reduzido, transições atrasadas continuavam *esperando*. Movimento reduzido tem que ser
instantâneo, não só rápido. Adicionado `transition-delay`/`animation-delay: 0s`.

**Ainda aberto (P0.1b):** `aria-hidden`/`inert` nos overlays que usam `display:none` já saem da árvore,
então o ganho seria marginal; o app renderizar atrás do login (sem sessão) segue como higiene menor.

### 2.2 Cor fora de token — a regra-mãe violada em escala

**Medido (hex de 6 dígitos por arquivo CSS):** designer.css **109** · help-chat.css **90** · ~~dados.css **74**~~ 🗑️ · user-profile.css **45** · toolbar.css **34** · tutorial.css **34** · pages-tray.css **29** · chat.css **28** · live-preview.css **24** · topbar.css **15** · franqueado.css **15** · catalog.css **10**. Em JS (style inline): tutorial/catalog-studio.js **48** · png-generator.js **33** · e mais 8 arquivos.
> 🗑️ = sai junto com o módulo Dados (§2.7); não entra na conta do trabalho de P1.2.

**Consequência:** temas claro/escuro não flipam de graça (o motivo de ter token), e a marca deriva.
**Nota:** parte é fallback legítimo (`var(--x,#hex)`) — a varredura deve converter o que é cor crua e **manter** fallbacks de token.

### 2.3 Emoji na UI — proibitivo do design system

**Medido:** UI real com emoji no modal de Ajuda (📚 Trilha, 🔍 Catálogo, 🔎 placeholder) e no Perfil (☀/🌙 no select de tema, 💡 dica). Toasts com emoji espalhados: layers.js **40**, user-profile.js **14**, canvas.js e library.js **10** cada, e mais ~8 arquivos.
**Regra do DS:** sucesso sem emoji (ou `✓` texto), alerta com `⚠ ` — esses dois **caracteres** são aceitos; 📸✅🔐📚 não.

### 2.4 Motion fora de token

**Medido (cubic-bezier/ms/s hardcoded):** ~~dados.css **45**~~ 🗑️ (era o pior, sai com o módulo — §2.7) · designer.css **39** · tutorial.css **31** · toolbar.css **22** · chat.css **13** · topbar.css **12**.

### 2.5 Feedback fora do canal

**Medido:** `alert()` nativo em `user-profile.js:154` (única ocorrência no app — regra: feedback só via `gToast`).

### 2.6 Vocabulário e copy

- ~~Badge de role "**ADMIN**"~~ 🔍 **ACHADO FALSO (corrigido em 2026-07-15).** `gUpdateUserTopbar()`
  ([auth.js:266](../js/core/auth.js)) **já é canônico**: `{gestao:'GESTÃO', equipe_dm:'EQUIPE DM',
  franqueado:'FRANQUEADO'}` com as cores certas. **Medido:** gestao → `rgb(200,24,24)` (`--dm-red`) ·
  equipe_dm → `rgb(255,185,0)` (`--dm-yellow`) · franqueado → vidro. Eu tinha lido "ADMIN" porque
  estava **deslogado** — era o **placeholder estático** do HTML. Sobrava um risco real e pequeno:
  o placeholder piscava uma palavra que **nem existe** no vocabulário do produto. ✅ Esvaziado
  (`index.html`) — quem preenche é o JS com o papel real.

> ⚠️ **Lição de método (vale para toda a fase P3).** Medir cor nesta aba de preview **mente**: a aba
> não pinta, o relógio de animação congela e as `CSSTransition` ficam presas em `running` — e
> transição **vence até `!important`**, então o valor fica preso no inicial. Sintoma: o badge de
> GESTÃO lia amarelo mesmo com `background: var(--dm-red)` inline. **Antes de medir qualquer
> propriedade animada/transicionada: injetar `transition:none` ou chamar `el.getAnimations().forEach(a=>a.finish())`.**
> (Foi o que salvou a medição do P0.1.) Some a isso o cache agressivo de CSS/JS: para validar JS
> alterado é preciso **subir o servidor em outra porta** (origem nova) — recarregar a página não basta.
- Rodapé da Ajuda: "Luma · piloto interno · v0.4" — a 1.0 precisa de versão/rotulagem real.
- ~~Nav do módulo Dados duplica cada rótulo na árvore de acessibilidade~~ 🗑️ — some com o módulo (§2.7).

### 2.7 Módulo Dados — ✅ REMOVIDO DO PRODUTO (2026-07-15)

**Decisão executada: o módulo Dados foi removido do Luma.** A auditoria tinha
proposto rotular a tela como "dados de demonstração" (o módulo roda 100% sobre mocks
`P_MOCK_*` sem indicação visível). **Removê-lo é a resposta mais honesta** e é coerente com o
que a arquitetura já diz: *"Analytics por extração, não por dashboard — as views `analytics.vw_*`
são consumidas via SQL Editor/BI, sem grant para o front"* (`02_ARCHITECTURE.md` §7). O
dashboard era uma casca simulada na frente de um analytics que, de verdade, vive fora do app.

**Consequência para este roadmap:** todo trabalho de UI no Dados está **cancelado** (P0.4, P0.5),
e o módulo sai do escopo de P1.2/P1.3 — o que **reduz a dívida medida**, não só a adia:

| Dívida que some junto com o módulo | Peso |
|---|---|
| `css/modules/dados.css` — hex fora de token | **74** (era o 3º pior) |
| `css/modules/dados.css` — timings fora de token | **45** (era o **pior**) |
| Nav duplicado na árvore de acessibilidade | resolvido por remoção |
| Front com dado 100% falso sem rótulo | resolvido por remoção |

**Raio removido:** `js/dados/*` (10 arquivos) · `css/modules/dados.css` · `index.html`
(link do CSS, `#tab-dados`, `#view-dados` e 10 `<script>`) · `js/main.js`
(`setMode`, `gApplyModeAccess`, `pInit`) — **~4,6 mil linhas** ao todo.
⚠️ **Não confundir** com a aba **"Dados" do Estúdio** (`#rtab-dados` → `dActivatePanel('dados')`),
que é o **centro de campos do designer** e **fica** — nome igual, coisa diferente.

**O que permanece:** `gTrackEvent` → `analytics.fct_eventos` (`js/core/supabase.js`, chamado de
`main.js` e dos arquivos do franqueado) continua coletando. A coleta é independente do dashboard
removido e alimenta a extração por SQL/BI.

---

### 2.8 Luma Sheets no celular — ✅ RESOLVIDO (2026-08-14)

Revisão feita **abrindo a tela** (desktop 1440, celular 390, claro e escuro) e medindo o DOM, não lendo código. O que estava quebrado, com o número que provou:

**A planilha não cabia e não rolava.** 46 elementos passavam da borda em 390px e a coluna de preço simplesmente não existia para quem usa celular. O container da tabela SEMPRE teve `overflow-x:auto` — e mesmo assim nada rolava, porque a cadeia inteira de ancestrais herdava `min-width:auto` e inflava em vez de rolar. A raiz ficava dois níveis acima do suspeito: `.f-bulk-modal-box` declara `grid-template-rows` e **nenhuma coluna**, então a coluna implícita nasce `auto` e cresce com o conteúdo mais largo. Junto: `.f-bulk-split` usava `1fr` (mínimo implícito `auto`) onde a regra de duas colunas logo acima já usava `minmax(0,1fr)`, e o cabeçalho da planilha é full-bleed com margem negativa de 20px — 40px a mais numa tela de 390. Corrigido elo a elo; **0 elementos vazando**, a tabela rola com 260px de conteúdo alcançável.

**A prévia comia 35% da tela** e empurrava a planilha — o trabalho de verdade — para baixo da dobra. Agora 24%; a arte continua conferível e quem manda na tela é a planilha.

**Campo não parecia campo no toque.** As células são invisíveis de propósito (`border-color:transparent`) e só ganham contorno no `tr:hover` — elegante com mouse, **inexistente no dedo**. O contorno passou a ser permanente em `@media (hover:none)`, os alvos por linha foram de 28×28 para 44×44 e as miniaturas da fita de 38×64 para 44×75 (`ux-principles.md`, Lei de Fitts). A primeira linha ganhou `placeholder` com o nome da coluna — nas demais seria ruído.

**Ação irreversível colada na primária.** "Limpar planilha" ficava a **12px** de "Adicionar linha". Foi para dentro de "Mais opções da planilha", com o resto do ferramental.

**Acessibilidade:** as células da tabela não tinham nome acessível — quem usa leitor de tela ouvia "editar texto" sem saber a coluna. Agora `aria-label="Nome do produto, linha 1"`. Botões desligados deixaram de anunciar `cursor:pointer`.

**Dois seletores frágeis viraram classe.** `.f-bulk-table input[style*="--dm-red"]` e `.f-bulk-preview>div>div[style*="overflow-x:auto"]` casavam pelo **texto do atributo style**. O segundo cobrou o preço na hora: ao trocar o estilo inline por classe, ele parou de casar em silêncio e a tabela perdeu `min-height`/`flex` — regressão introduzida e corrigida no mesmo pacote, com o layout do container reconferido (`min-height:180px`, `flex:1 1 0%`).

⛔ **Descartado ao medir — não "corrigir":** a borda vermelha em campo de preço vazio e o cabeçalho escrito `preco` em vez de "Preço". Os dois eram artefato do harness de teste (`dVars` e `fBulkRows` são `let` de script e não vivem no `window`, então a injeção não chegava no app e o campo caía em tipo desconhecido). Com o catálogo real: `erros: []`, nenhum vermelho, rótulos corretos.

⚠ **Não verificado aqui:** o estado de repouso no **desktop com mouse**. Este Chromium headless responde `hover:none` mesmo com emulação de mídia, então os screenshots de desktop mostram o tratamento de toque. Em navegador real a regra não se aplica e o comportamento original (contorno só no hover) continua. Confirmar na máquina.

⚠ **Achado não tocado:** `fBulkEditRow` (o formulário da antiga "vista em cartões") não tem mais nenhum chamador — a vista foi removida de propósito, a função ficou. Usa o **nome cru da variável** como rótulo, então se voltar a ser alcançada mostra "preco" para o franqueado. Candidata a remoção.

### 2.9 O chat do franqueado no celular — ✅ RESOLVIDO (2026-08-15)

Pedido do Ryan: *"quero pensar principalmente na experiência mobile, ela precisa ser muito boa"*. O franqueado do interior opera pelo celular — é a tela que mais importa no Luma. Mesmo método: uma bancada dirige o **fluxo real** (campanha → material → chat → responder → prévia) num iPhone de 390×844 com toque emulado, e mede. Nada aqui foi deduzido lendo CSS.

**A arte estava escondida e metade da tela estava vazia.** O chat abria com **441px vazios entre a pergunta e a barra de digitar — 52% da tela** — e a arte era um selo flutuante de 64px no canto. O vazio só sumia conforme a pessoa respondia (52% → 39% → 18%), ou seja: era pior justamente no **primeiro contato**, onde a confiança do franqueado se ganha ou se perde. Decisão do Ryan entre quatro opções: trazer a arte para dentro da conversa. Agora um cartão ocupa a sobra (**45% da tela**, vazio de 2%), tocar nele abre a prova em tela cheia, e ele **encolhe até um piso de 140px** conforme as bolhas crescem. Não é um segundo renderizador: `drawImage` do `#lp-canvas`, a mesma lei que a miniatura flutuante já seguia.

**O `padding-bottom:150px` era herança do que foi removido.** Existia só para a miniatura flutuante (~114px em `bottom:80px`) não tampar o fim da rolagem. Com a arte no fluxo o selo some — e a reserva virava 150px de vazio no rodapé de toda conversa. Foi ela que impediu o cartão de crescer no primeiro corte: sem folga, o `flex:1` não tinha o que absorver.

**8 alvos de toque abaixo de 44px → 0.** Chips de resposta rápida a 38px (o jeito **principal** de responder no celular — tocar "Combo Burger" evita abrir o teclado), "Recomeçar" a 36×36, logo a 72×22, badge de perfil a 38×38. ⛔ **A aba de modo não cresceu de propósito:** 32px + o padding da pílula dá 40px, e levá-la a 44 empurraria a pílula para 52px — a altura exata da topbar, sem respiro. Seria redesenhar o controle-assinatura do produto, não corrigir um alvo. Em vez disso o **alvo** cresce e o desenho fica: um `::after` estende a área tocável 6px para cada lado (32+12=44). Verificado por `elementFromPoint`, não pela caixa.

**Teclado:** o viewport ganhou `interactive-widget=resizes-content`. Sem isso o padrão é `resizes-visual` — o `100dvh` continua valendo a tela inteira e a barra de digitar fica sob o teclado. Medido: a **390×508** (o que sobra com o teclado aberto) o layout do chat se comporta inteiro, então basta o navegador entregar esse tamanho.

⛔ **Descartados na medição — não "corrigir":** `#lp-zoom-range` com fonte 13px (é `input[type=range]`; só campo de **digitação** dispara o zoom do iOS) e a gaveta de prévia "fora da tela" (fechada em `translateY(100%)` é o desenho, não defeito). O campo de mensagem já estava em 16px e o safe-area já estava aplicado em 9 lugares — a base mobile existia, o que faltava era o que a bancada achou.

⚠ **Não verificado aqui:** o comportamento real do teclado no **iOS**. Não há teclado no headless; o que foi verificado são as duas condições que decidem (o app pede o encolhimento, e o layout aguenta a altura curta). Safari ainda ignora `interactive-widget` — valor desconhecido é inerte, não quebra —, então **o iPhone precisa de conferência em aparelho real**. Se o sintoma aparecer lá, o próximo degrau é o `visualViewport`, e já existe implementação da casa para espelhar (`_gCliAjustaViewport`, `js/core/console.js`).

⚠ **Achado não tocado:** a arte no cartão mostra as **caixas tracejadas de campo vazio** (`fLpHighlightEmpty` — "toque pra preencher"). É comportamento deliberado do motor de prévia, herdado fielmente pela cópia de pixels; some conforme os campos são preenchidos. Tirá-las mudaria também a prova em tela cheia — decisão de design, não defeito.

### 2.10 Luma Sheets repensado como app de celular — ✅ ENTREGUE (2026-08-15)

Pedido do Ryan: *"o Luma Sheets está numa proposta de layout adaptada do computador; precisa ser pensado pra ser um aplicativo mobile"*. Antes de codar, três propostas navegáveis (`docs/mockups/sheets-mobile.html`) — **A** carrossel, **B** conversa em lote, **C** lista e folha. Escolha: **C como tela principal, com o carrossel da A dentro da folha de edição.**

**O estudo mudou a recomendação.** No mockup eu tinha escrito que a proposta B "reaproveita o motor de chat". **Não reaproveita:** o parser sim (`fBulkParseHeuristicText` + `gAskAI('cardapio')`), mas a superfície de chat mora em `chat.js` amarrada a `fState`/`#f-messages` — outro estado, outro módulo. B era a mais cara, não a mais barata.

**Quase nada é motor novo, e é o ponto.** `fBulkGetReadiness` já separava pronta / falta algo / vazia — a lista só desenha o que ela calcula. As setas da folha são os botões que já chamavam `fBulkStepRow(±1)`. A arte é o mesmo `_fBulkRenderHero`, no mesmo canvas. A folha **é** a `.f-bulk-live` do desktop reposicionada por CSS, não um componente novo. Os inputs usam os mesmos ids da tabela, então `fBulkSaveRow` e `fBulkCollectCurrentInputs` valem sem uma linha de mudança.

**Quatro defeitos achados medindo, dois deles meus:**
- 🔴 **Digitar na folha e fechar deixava o campo VAZIO.** Cada tecla chama `fBulkLiveEdit → fBulkSetActive → _fBulkSyncLiveHead → _fBulkRenderFolhaCampos`, que reconstruía os inputs a partir de `r.dados` — gravado só 160ms depois. Repintava por cima da letra digitada. Agora só repinta quando a linha muda (`_fBulkFolhaRid`). É a mesma armadilha que a tabela já evitava ("re-render roubaria o foco de quem está digitando").
- 🔴 **Os campos saíam com 11px e 34px** — zoom automático do iOS ao focar e alvo abaixo dos 44px. **Erro meu de leitura de especificidade:** `#f-bulk-modal input[type=text]` vale **1‑1‑1**, porque `[type=text]` pesa como CLASSE e não como elemento; meu `#f-bulk-modal .f-bulk-fin` valia 1‑1‑0 e perdia por um ponto. Resolvido com `.f-bulk-folha-campos` no meio (1‑2‑0).
- 🟠 **A arte na folha media 74×132px** — um selo, quando ela é o motivo de a folha existir. Causa: o tratamento mobile antigo cravava `height:132px` no palco, certo para quando a prévia era uma faixa no topo da planilha. Dentro da folha vira `34dvh`, com a largura saindo da proporção do material.
- 🟠 **As setas do carrossel estavam `display:none` no celular** (mesma herança). Sem elas `fBulkStepRow` funcionava só por código, sem jeito de a pessoa chamar — metade da direção escolhida não existia na tela.

**De quebra, defeito pré-existente:** o rodapé punha "Legenda e cidade", "Fechar" e "Gerar N artes" na mesma linha sem quebra; em 390px o primeiro ia para **x=−59** e 13 elementos vazavam pela borda esquerda. Agora quebra em duas linhas, sem tirar nenhuma ação.

**Verificado no navegador:** lista no lugar da tabela, 0 elementos vazando (nos dois lados), filtros e alvos em 44px, campos em 16px, arte em 161×287, o carrossel repinta os campos, digitar e fechar grava em `fBulkRows`, e o estado da linha vira "pronta" na volta. **Desktop reconferido item a item:** tabela intacta, lista ausente, coluna de prévia `position:static`, campos e botão da folha em `display:none`, célula da tabela ainda em 12px. As 4 suítes seguem em **119 casos verdes**.

⚠ **Miniatura por linha ficou de fora, de propósito:** cada uma é um `fRenderTemplateLayers` completo, e 30 delas na abertura da lista é caro. O estado (`pronta` / `N a preencher`) carrega o trabalho de varredura, e a arte aparece grande na folha. Se as miniaturas entrarem, o caminho é a mesma preguiça da fita (`_fBulkDesenharFitaVisivel`, que só desenha o que está em cena).

⚠ **Ainda não implementado da proposta C:** o **modo seleção** (segurar para marcar várias e aplicar em lote). `fBulkApplyFill` já existe no código e é o motor natural dele.

## 3. O roadmap

### FASE P0 — Fundações que sangram (≈1–2 dias) 🔴

| # | Item | Arquivos prováveis | Critério de aceite |
|---|---|---|---|
| ✅ P0.1 | **Overlay fechado sai da árvore de a11y/Tab** (`visibility:hidden` no `.modal-overlay`, `.d-modal-overlay` e na gaveta) + guarda de reduced-motion zerando delays | `css/modules/designer.css`, `css/02-animations.css` | **FEITO** — verificado 76 → **0** focáveis vazando; 8 overlays abrem/fecham |
| ✅ P0.1b | **Exportação em lote ressuscitada**: escritas as regras que nunca existiram (`.d-modal*`, `.dbtn-*`, `.d-export-fmt-btn`) + markup tokenizado | `css/modules/designer.css`, `index.html` | **FEITO** — modal abre centralizado; contraste do título **1.00 → 19.8** no claro |
| ✅ P0.2 | `alert()` → `gToast` | `js/core/user-profile.js` | **FEITO** — 0 `alert(` nativos no repo; toast sai com tipo `error` e `⚠ ` (caractere, não emoji) dizendo o que fazer. O `alert()` era **fallback morto** (`toast.js` carrega antes). Os `confirm()` restantes são tratados separadamente no roadmap principal. |
| ⚠️ ~~P0.3~~ | ~~Badge "ADMIN" → "GESTÃO"~~ | — | 🔍 **ACHADO FALSO** — ver §2.6. O badge já é canônico. Sobrou só o placeholder estático do HTML (corrigido). |
| ~~P0.4~~ | ~~Rótulo "demonstração" no módulo Dados~~ | — | 🗑️ **CANCELADO** — o módulo sai do produto (§2.7). Não se pinta parede de casa que vai ser demolida. |
| ~~P0.5~~ | ~~Nav do Dados sem duplicação de rótulo~~ | — | 🗑️ **CANCELADO** — idem (§2.7). |

**Risco:** P0.1 toca o mecanismo de todos os modais — testar abrir/fechar cada um (lista em §5). É mudança de mecanismo, não de layout: diff pequeno, superfície de teste grande.

### FASE P1 — Consistência de marca em escala (≈3–5 dias) 🔴

| # | Item | Ordem/critério | Critério de aceite |
|---|---|---|---|
| P1.1 | **Varredura de emoji** → SVG `currentColor` (UI) e `✓`/`⚠ ` texto (toasts) | Ajuda e Perfil primeiro (emoji em UI real); depois toasts por arquivo (layers.js 40 → user-profile 14 → canvas/library 10…) | `grep` de emoji em `js/` e `index.html` retorna zero fora de conteúdo de tutorial |
| P1.2 | **Tokenização de cor** módulo a módulo | designer.css → help-chat.css → user-profile.css → toolbar/tutorial → resto; JS inline junto com o módulo dono. ~~dados.css (74)~~ saiu do escopo (§2.7) | Contagem de hex por arquivo cai a ~0 (exceto fallback `var(--x,#hex)` e cenas de tutorial); flip de tema visualmente íntegro nos 2 sentidos |
| P1.3 | **Motion pelos tokens** nos 3 piores (designer, tutorial, toolbar) | usar `--dur-*`/`--ease-*`; manter `prefers-reduced-motion`. ~~dados.css (45, era o pior)~~ saiu do escopo (§2.7) | Zero `cubic-bezier(`/ms cru nesses arquivos |
| P1.4 | **Ferramenta viva de auditoria**: `tools/ui-audit.html` (HTML puro, sem build) que roda os checks desta auditoria (hex, emoji, fontes, aria, alvos de toque) e imprime o placar | novo arquivo, zero dependência | Abrir a página = relatório; vira o "teste" de regressão visual da casa |

**Por que P1.4 aqui:** é o que impede a régua de regredir enquanto as fases P2/P3 mexem em tela — e respeita a lei "teste = HTML de asserts no navegador, sem build" (03_ENGINEERING §7).

### FASE P2 — Telas repensadas (≈1–2 semanas) 🔴

> Regra desta fase: **mockup navegável aprovado antes de tocar código** (06 §10.2). Cada redesign roda o grid do `design-review.md` e só entrega com média ≥9.5.

| # | Tela | O que repensar | Por quê |
|---|---|---|---|
| P2.1 | **Perfil do usuário** (redesign completo) | Layout na régua (tokens, radius, labels caixa-alta); badges de role canônicos; select de tema sem emoji; **repensar o conteúdo**: "Tempo em Sessão 0 min" e "Nível da Conta: Designer Principal" são métricas vazias/gamificação boba (contra a filosofia §3) — trocar por dados úteis (artes geradas, campanhas usadas) ou cortar | Nota 5.5 — pior superfície do app; é a cara do produto no dia a dia |
| P2.2 | **Ajuda** (redesign leve) | Tirar emoji; unificar identidade com o tutorial; rodapé de versão real; revisar se Trilha/Catálogo/Chat de ajuda são 3 coisas ou 1 | 90 hex + emoji + copy de piloto |
| P2.3 | **Login + Splash** (rearquitetura de montagem) | Tela própria que desmonta; transição login→app na régua de motion; sem app renderizado por baixo (depende de P0.1) | Primeiro contato com o produto; hoje é a maior violação estrutural |
| P2.4 | **Luma Sheets** (extração + hierarquia) | Extrair os estilos inline para `css/modules/sheets.css`; agrupar a toolbar por função (Fonte de dados / Edição / Modelos / Ferramentas); manter TODAS as funções — é reorganização, não corte | Epicentro dos 343 `style=` do index; toolbar por acreção |
| P2.4b | **Luma Sheets no celular** — ✅ FEITO (2026-08-14) | Ver §2.8 | Medido na tela real: 46 elementos vazavam da tela de 390px |
| P2.5 | **Estúdio — estado vazio** | Empty state com CTA (Novo projeto / Recentes / Importar PSD) no lugar da tela apagada ao entrar sem documento | ⚠ verificar visualmente antes (plausível ≠ real — a auditoria viu ~30 elementos, mas sem screenshot) |
| P2.6 | **Home franqueado — rascunhos** | Thumb real da arte no card "Continuar de onde parou" (hoje é bloco de cor); reusar a fila de thumbs que já existe (`_fRenderCampThumb`) | Última aresta da melhor tela |

### FASE P3 — Gate da 1.0 (contínuo + semana final) 🔴

| # | Item | Detalhe |
|---|---|---|
| P3.1 | **Roteiro visual completo** (agora com captura de tela funcionando): cada tela × {claro, escuro} × {desktop 1440, laptop 1280, mobile 390} × 3 roles | O que a auditoria de hoje não pôde fazer por limitação do ambiente |
| P3.2 | **Grid de avaliação ≥9.5 por tela** — reprovou, refatora (regra do design-review) | Registrar as notas finais neste arquivo |
| P3.3 | **Acessibilidade**: foco visível em tudo; alvos ≥44px no toque; contraste AA nas combinações da §2 do DS; `tools/ui-audit.html` verde | Critérios já são lei no 04 §2 |
| P3.4 | **Docs**: atualizar `04_DESIGN_SYSTEM.md` (se nascerem tokens novos, ex. spacing), este roadmap com ✅, e `docs/LUMA.md` | Doc desatualizado engana |
| P3.5 | **Versão real** na UI (Ajuda/rodapé): "Luma 1.0" | Tira o "piloto v0.4" |

---

## 4. O que fica explicitamente FORA da UI 1.0

- **OCR de cardápio no Sheets** (dependência vendorizada pendente de decisão).
- **CRM Visual** (módulo planejado, não existe).
- **Multi-tenant/catálogo por cidade** (decisão de arquitetura, não de UI).
- Refatorar os arquivos gigantes do Estúdio (`canvas.js`, `layers.js`) — dívida de engenharia consciente, não entra junto com mudança visual.

## 5. Roteiro de verificação por fase (navegador, sempre)

Mínimo após **cada** item: franqueado gera arte ponta a ponta · designer edita→publica→aparece no catálogo · flip claro/escuro nos dois sentidos · console sem erro novo. Para P0.1, adicionalmente abrir/fechar **cada** modal: login, perfil, ajuda, tutorial, prévia campanha, Sheets, copy, e no Estúdio: newdoc, publish, var, folder, tmpl, sim, export, psd, fx, cheat, preview.

## 6. Pendências conhecidas da auditoria (honestidade)

- Captura de tela do ambiente estava quebrada em 2026-07-15 → notas com * são estruturais; a passada visual fina é a P3.1 (e deve rodar **antes** de fechar o design de P2).
- Bug pré-existente fora de escopo de UI: `js/designer/tooltip.js` não parseia (backticks escapados) — tooltips do Estúdio mortos; já flagged como tarefa própria.
- `fBulkImportFromLink` ("importar exemplos") continua gerando só demo — decidir se o rótulo atual de demonstração basta ou se sai na 1.0.
