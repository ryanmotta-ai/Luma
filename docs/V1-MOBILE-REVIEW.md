# V1 — REVISÃO MOBILE (franqueado no celular)

> Auditoria de **experiência**, não de CSS responsivo. O critério foi um só: *um franqueado
> real, com o polegar, numa tela de 320 a 430px, consegue abrir, personalizar, gerar e baixar
> a arte sem suporte?*
>
> Data: 2026-09-06 · Branch: `talpaipai` · Escopo: superfícies `f*` + o núcleo (`gToast`,
> `gConfirm`, login). O Estúdio (`d*`) ficou de fora — o franqueado não o alcança (gate por role).

---

## Como isto foi medido

App servido em `http://localhost:5605` (`python3 -m http.server`), sessão real de Supabase,
dados reais (7 campanhas, 32 artes no histórico). Cada achado abaixo tem **número medido no
navegador**, não impressão de print. Três instrumentos:

| Instrumento | O que responde |
|---|---|
| `scrollWidth > clientWidth` em **todo** elemento | rolagem horizontal acidental — inclusive **dentro** de contêineres (é onde os bugs estavam; o `documentElement` estava limpo em todos os viewports) |
| `getBoundingClientRect()` de todo alvo clicável | toque abaixo de 44×44 |
| Viewport encolhido (ex.: 390×420) | teclado virtual aberto — é o que `interactive-widget=resizes-content` entrega no Chrome/Android |

⚠️ **Três ressalvas honestas sobre o ambiente — leia antes de duvidar de um número:**
1. O navegador da bancada roda com a janela oculta: `requestAnimationFrame` congela, transições
   ficam paradas em `t=0` e `scroll-behavior:smooth` **não rola**. Todo estado pós-transição foi
   medido depois de `getAnimations().forEach(a=>a.finish())`. **Dois "está quebrado" chegaram a
   parecer bug e não eram** — a gaveta da prévia "não abria" e o `msgs.scrollTop=scrollHeight`
   "não fazia nada". Registrado aqui para ninguém repetir o susto.
2. **A emulação de viewport do pane NÃO dispara `resize` nem `visualViewport.resize`.** Ela
   troca o tamanho em silêncio. Os dois consertos de teclado (P1-3 e P1-4) foram exercitados
   com `window.dispatchEvent(new Event('resize'))` — que é exatamente o que o teclado de um
   aparelho de verdade emite. A *lógica* está medida; a *entrega do evento* é da plataforma.
3. **Download de arquivo e ZIP não são verificáveis** neste ambiente (o pane bloqueia
   download). O fluxo 8 foi auditado até o clique; a entrega do arquivo precisa de aparelho real.

---

## Viewports percorridos

320×568 · 360×800 · 375×812 · 390×844 · 412×915 · 430×932 · paisagem 844×390 ·
teclado aberto simulado (390×420) · tema claro e escuro.

**Rolagem horizontal do documento: zero em todos.** Os problemas de overflow que existem são
todos *internos* — e por isso não apareciam numa varredura de `body`.

---

## Fluxos revisados

| # | Fluxo | Estado |
|---|---|---|
| 1 | Login (campos, autofill, CTA, baralho decorativo, viewport baixo) | ⚠️ 1 P1 |
| 2 | Home (saudação, busca, filtros, rascunhos, favoritas, destaque, campanhas, Minhas artes, Ajuda) | ✅ + 2 P2 |
| 3 | Busca (curta, longa, sem resultado, apagar, sugerir conteúdo) | ✅ |
| 4 | Campanha (entrada, cards, prévias, retorno, N materiais) | ✅ + 1 P2 |
| 5 | Chat (progressão inteira: chips, upload, preço, validação, voltar, gerar) | 🔴 2 P0 + 3 P1 |
| 6 | Prévia ao vivo (abrir/fechar, pinça, pan, swipe, troca de formato) | ⚠️ 1 P1 |
| 7 | Sheets (folha, fila, 13 ofertas, teclado, foto, gerar) | 🔴 1 P1 grave |
| 8 | Download / conclusão | ⚠️ parcial (ver ressalva) |
| 9 | Minhas artes (32 artes, filtros, baixar, editar, duplicar, limpar) | ⚠️ 2 P1 |
| 10 | Feedback (positivo, negativo, textarea, envio, não repetir) | ✅ |

**O que já estava certo e merece registro** — para ninguém "consertar" o que funciona:
`interactive-widget=resizes-content` no viewport meta; `--safe-bottom` na barra de digitar do
chat, no CLI e no painel de upload; guarda global de `prefers-reduced-motion`
(`css/02-animations.css:92`, com `animation-delay:0s` incluído); halo invisível de 44px sob o
favorito e o PRÉVIA do card (`franqueado.css:731`); a cadeia inteira de `min-width:0` que fez a
planilha do Sheets voltar a rolar; pinça, pan e swipe-para-fechar na prévia; feedback com
recibo (não repete) e fila offline; `#f-msg-box` e os campos do Sheets já em 16px.

---

# P0 — bloqueia uso

### P0-1 · A entrega final rola para o lado e corta "Baixar PNG" (320px)

**Onde:** `css/modules/chat.css:243` — `.art-wrap{min-width:280px}`

**Medido a 320×568:** a bolha do bot tem **263px** de conteúdo. O cartão da arte pronta se
recusa a encolher abaixo de 280px, então `#f-messages` fica com `scrollWidth 334` em
`clientWidth 314` e ganha **barra de rolagem horizontal**. O que fica cortado à direita:
`Refazer`, a borda do card `Gerar em lote` e parte de `Baixar PNG`.

É o fim do fluxo inteiro — a pessoa respondeu 5 perguntas e a ação que justifica o produto
está fora da tela, sem nenhuma pista de que existe conteúdo à direita.

O piso de 280px é herança do desktop, onde a coluna é larga. No celular quem manda na largura
é a bolha.

**Depois do conserto, medido a 320px:** `#f-messages` com `scrollWidth 314 = clientWidth 314`
(sem rolagem lateral) e as sete ações do cartão dentro da tela — `Baixar PNG` termina em 168,
`Refazer` em 262, `Gerar em lote` em 276, todas com 44px ou mais de altura.

### P0-2 · Digitar no passo "recuperar rascunho" MATA o chat, em silêncio

**Onde:** `js/franqueado/chat.js`, `fSend()` → `chat-input.js:544`, `fSaveAdv()`

Achado por acidente, durante a auditoria — e é o pior que encontrei.

Nas perguntas de **fluxo** (`"Deseja continuar de onde parou?"` e o pré-início `"Usar dados da
última arte / Começar do zero"`) o `fState.stepIdx` vale **-1**: elas se respondem por chip,
não por campo. Mas **a barra de digitar fica habilitada ao lado**. Quem digita ali e manda cai
em `fSaveAdv`, que faz `pergs[fState.stepIdx].id` → `perguntas[-1]` é `undefined` → **TypeError**.

O `fSend` já tinha adicionado a bolha do usuário antes de chamar. Resultado: **a mensagem
aparece enviada, o erro morre no console, e o chat para.** Sem resposta, sem aviso, sem
avançar. O único caminho é recarregar a página.

A guarda existente (`perguntas[stepIdx]?.id`, com `?.`) protege o `fSend` e **dá a falsa
impressão de que o caso está tratado** — só que `fSaveAdv`, logo abaixo, não tem o `?.`.

**Por que é P0 no celular e não uma esquina rara:** o teclado já está aberto (a pessoa acabou
de tocar a tela), e os dois chips são o alvo pequeno. Digitar "sim" e mandar é o
comportamento natural de quem usa WhatsApp o dia inteiro.

É bug de desktop também — mas no celular a probabilidade de cair nele é outra.

---

# P1 — fricção importante

### P1-1 · O aviso de erro do chat sai cortado no meio da palavra

**Onde:** `css/modules/toolbar.css:765` — `.g-toast-item{white-space:nowrap}`

O toast é o **único canal de erro do chat**: `fShowFieldError` (`chat-input.js:311`) manda o
motivo por toast e o tremor da barra só aponta *qual* campo. O comentário lá diz isso com
todas as letras — "o tremor aponta QUAL campo; o toast diz POR QUÊ".

**Medido a 320px:** `"Não consegui carregar seu perfil completo. Recarregue a página."` →
**421px de texto dentro de uma pílula de 288px**, sem quebra. A pessoa lê "…Recarregu" e
para. Digitar `abcxyz` no passo de preço e mandar produz exatamente isso: um tremor e meia
frase.

### P1-2 · O aviso cobre a barra de digitar que ele está pedindo para corrigir

**Onde:** mesma regra — `#g-toast-container{bottom:24px}`

**Medido a 320×568:** toast em `y 507–544`, `#f-input-row` em `y ~510–560`. O aviso pousa em
cima do campo. Com o teclado aberto (viewport ~420) é pior: o toast fica colado no teclado,
sobre o campo ativo.

### P1-3 · Sheets: com o teclado aberto o campo ativo fica **debaixo** do rodapé

**Onde:** `js/franqueado/png-generator.js:2748` — `_fBulkBindTeclado()`

A folha do Sheets foi desenhada para isso: `body.f-bulk-teclado` encolhe a arte para uma faixa
de 84px e devolve a tela para os campos (`chat.css:1962`). A intenção está escrita — *"A ARTE
NUNCA SAI DA TELA"*.

**A detecção nunca dispara no Chrome/Android.** Ela compara
`window.innerHeight - visualViewport.height > 140`; mas o `interactive-widget=resizes-content`
que o `index.html` declara **encolhe também o `window.innerHeight`**, então a diferença fica
~0. No iOS (que ignora o `interactive-widget` e usa `resizes-visual`) funciona; no Android, não.

**Medido a 390×420 (teclado aberto), sem a classe:** campo "Preço Original" em `y 332–382`,
rodapé grudento `.f-bulk-folha-acoes` em `y 346–419` → **36px do campo debaixo do botão**. O
franqueado digita o preço às cegas.
**Com a classe ligada à mão:** campo em `y 280–330`, rodapé em `346` → 16px de folga. **O
desenho funciona; só a detecção está morta.**

### P1-4 · Chat: o teclado abre e a pergunta atual some

**Onde:** `js/franqueado/chat.js` — não existe nenhum ouvinte de `resize`/`visualViewport`
(as 8 chamadas de `msgs.scrollTop=msgs.scrollHeight` só rodam quando chega mensagem nova).

**Medido a 390:** com a tela cheia a conversa cabe (`scrollHeight 661` = `clientHeight 661`,
folga 0). Teclado abre → o contêiner cai para `clientHeight 237` com `scrollHeight 460` e o
`scrollTop` **continua 0**: 223px de conversa ficam abaixo da dobra. A pergunta e os chips
("Frete grátis", "Pular") saem de vista no exato momento em que a pessoa toca o campo para
respondê-los.

### P1-5 · Campo de preço no chat abre o teclado QWERTY

**Onde:** `js/franqueado/chat.js:615` — `fUpdateInputPlaceholder()`

`#f-msg-box` é `type="text"` sem `inputmode`. Nos passos de preço (`precoDe`, `precoPor`,
`pedidoMin` — `F_FIELD_TYPES` já os marca como `type:'price'`) o franqueado recebe o teclado de
letras para digitar `29,90`.

**O Sheets já resolveu isso** e deixou o porquê escrito (`png-generator.js:2611`): `type="text"`
e não `number` porque o campo numérico do celular recusa a vírgula, com `inputmode="decimal"`
por cima. O chat ficou de fora — e é o caminho principal, não o de lote.

### P1-6 · O diálogo de confirmação da casa tem botões de 32px

**Onde:** `css/modules/toolbar.css:810` — `.g-dialog-*`, **sem nenhum tratamento mobile**.

**Medido a 390×844** (`"Vou gerar 2 arte(s). Gerar agora?"`): `Cancelar` **81×32**,
`Gerar 2` **76×32**, colados por 8px. É o `gConfirm` — o diálogo de *toda* ação irreversível
da casa (limpar planilha, apagar oferta, gerar em lote). É onde errar o toque custa mais caro.

No mesmo componente, `.g-dialog-input` (o `gPrompt`, usado para nomear loja salva) está em
**13px** → o iOS dá zoom automático ao focar.

### P1-7 · Busca de "Minhas artes" dá zoom automático no iPhone

**Onde:** `#f-hist-search` — **12px** medido.

Qualquer `input` abaixo de 16px faz o Safari do iPhone dar zoom no layout ao receber foco. O
franqueado toca a busca, a página inteira aumenta e ele tem que pinçar de volta. É o **único**
campo do caminho do franqueado ainda abaixo de 16px (todos os outros já foram tratados; os que
sobram no app são do Estúdio).

### P1-8 · Minhas artes: ações do card abaixo do alvo de toque

**Onde:** `css/modules/franqueado.css:161` — `.hist-act-btn{min-height:34px}`,
`.hist-act-download{width:34px}`

**Medido a 390:** `Continuar` 202×**40**, `Duplicar` 80×**40**, **baixar 34×40**. O botão de
baixar — a razão de a tela existir — é o menor dos três, é só um ícone e fica encostado no
`Duplicar`. Errar entre "baixar" e "duplicar" cria lixo no histórico.

### P1-9 · Barra da prévia ao vivo: controles de 22×26 no dedo

**Onde:** `css/modules/live-preview.css:281,300,323`

**Medido na gaveta aberta a 390:** `−`/`+` de zoom **22×26**, `27%` 35×26, chips `Zoom` e
`Layout` **39×26**, `Ajustar` e `Mockups` 30×32 — sete controles numa fita de 40px de altura.
O `Baixar PNG` logo abaixo está certo (357×43); a fita é que não passou pelo mesmo tratamento
que o resto do módulo recebeu.

### P1-10 · Login: a 320×568 o "Entrar" nasce 68px abaixo da dobra

**Onde:** `css/components/login.css:191` — o corte mobile é só por **largura** (`max-width:860px`),
não por altura.

**Medido a 320×568:** painel de marca 314px + formulário 467px = 853px de conteúdo em 568px de
tela. `Entrar` em `y 636–684`, `Esqueci minha senha` em `y 700–717` — ambos fora da tela. A
tela **rola** (`#g-login-screen{overflow-y:auto}`, `scrollHeight 853`), então não é bloqueio —
mas o primeiro contato do franqueado é uma tela onde o botão de entrar não aparece, atrás de
314px de arte decorativa.

A 360×800 e acima cabe (`Entrar` em `y 627`). O problema é de **altura**, e volta em qualquer
aparelho baixo — e num iPhone SE real (375×667 menos a barra de URL ≈ 560px de útil) também.

### P1-11 · Modais do franqueado dimensionados em `vh` (não `dvh`)

**Onde:** `posted-box` 92vh (`live-preview.css:716`), `.f-up-box` 86vh
(`upload-panel.css:108`), `.f-arch-box` `min(80vh,640px)`, `.camp-ana-box` `min(84vh,700px)`,
`.f-bulk-table-scroll` 50vh, `.prefs` 86vh.

No celular `100vh` é o viewport **grande** (barra de URL escondida). Com a barra visível —
que é o estado normal — `innerHeight` é ~60–90px menor. Um modal em `92vh` fica mais alto do
que a tela visível e o rodapé (onde mora o CTA) escorrega para debaixo da barra do navegador.
O resto da casa já migrou para `dvh` (`franqueado.css:12`, `chat.css:1890`, `academia.css:31`,
`calendario.css:69`) — estes ficaram para trás.

---

# P2 — polimento

*Levantados na auditoria e atacados numa segunda rodada, a pedido do Ryan. Sete foram
consertados; três ficaram de fora **com medição**, um está bloqueado por outra sessão e um
**não era bug**.*

## Consertados

| # | Achado | Antes → depois |
|---|---|---|
| P2-1 | Chips do chat (`.qr`) são `<div onclick>` em **9 lugares** — sem `role`, sem foco. O toque sempre funcionou; o VoiceOver lia "Começar do zero" como texto solto e o Tab passava por cima | `role="button" tabindex="0"` nos 9 + Enter/Espaço **delegado uma vez** no documento. Verificado: chip recebe foco e o Enter avança o passo. O `.qr:focus-visible` já existia no CSS desde antes — esperando um elemento focável |
| P2-2 | Placeholder velho no pré-início: `"Escolha uma campanha ao lado para começar"` com o campo **habilitado** e a campanha já escolhida | `fStartChat` devolve `"Digite sua resposta..."` ao reabilitar |
| P2-3 | Bolha de boas-vindas: *"Escolha uma campanha **aqui do lado**"* — no celular o catálogo é a tela ANTERIOR, não uma coluna | A palavra saiu das duas frases. **Sem ramificar por `matchMedia`**: sem ela a frase é verdadeira nos dois layouts e não há dois textos para manter em sincronia |
| P2-5 | Sheets: `Ajuda` e `Fechar` do cabeçalho em 36×36 — e um deles fecha o lote em andamento | **44×44**, medido sem corte a 320px |
| P2-6 | `Esqueci minha senha` com **280×17px** — a única saída de quem não consegue entrar | **280×45** (padding, não `min-height`: o link já ocupa a linha, o texto não se move) |
| P2-9 | Iniciais do usuário (`.top-av`, "RY") em **3,35:1** a 10px | **4,67:1** (`color-mix` 82% com `--text`, mesma família da marca) |
| P2-12 | Feedback forçava 16px só em `max-width:480px`; em paisagem de celular voltava a 14px e o iPhone dava zoom | A regra passou para `(hover:none)` — que é a condição verdadeira: isto é toque, não largura |

### 🔎 P2-9 tinha uma camada a mais: a cor estava **inline**, no JS

Vale registrar porque é a razão de o defeito ter sobrevivido. `auth.js:335` fazia
`avEl.style.color = 'var(--dm-orange-d)'`. **`style=` inline vence a folha de estilo** — então
consertar `.top-av` no CSS não mudava nada, e o primeiro conserto que escrevi ficou inerte até
eu medir de novo e descobrir. A cor saiu do JS e passou a viver no `topbar.css`, onde cor é
decidida nesta casa (`04_DESIGN_SYSTEM`). O `background` ficou no JS: ele desfaz o
`transparent` do ramo com foto, não é escolha de cor.

## Não implementados — com o motivo medido

| # | Achado | Por que ficou |
|---|---|---|
| **P2-10** | Os toggles `Zoom`/`Layout` da prévia perdem o rótulo (`.lp-auto-name{display:none}` no `@container lpreview (max-width:390px)`) — em **todo** celular sobra ícone + switch, explicados só por `title`, que não existe no toque | **Medido: devolver o rótulo custa uma segunda linha inteira na barra — 53px → 103px** numa gaveta de 729px. É caro demais para um controle secundário que já vem ligado, e o grupo mostra `Auto` + o ícone de lupa ao lado. Fica documentado; se um dia a barra ganhar espaço, o rótulo volta de graça |
| **P2-7** | Campanha: 1 card de material por tela (447px cada) — 4 materiais = 4 telas de rolagem | É redesenho de densidade, não patch. O brief desta revisão manda **não** redesenhar |
| **P2-8** | Paisagem de celular (844×390) cai no layout de desktop e a arte encolhe para ~80px | O conserto é mudar o **contrato de breakpoint** (`max-width:680` passar a ver altura) em ~8 arquivos, incluindo Estúdio, Academia e Calendário. Blast radius grande para uma postura rara: ninguém deita o celular para montar um Story |
| **P2-4** | Placeholder da busca da home cortado (`"Busque uma campanha, produ…"`) num input de 158px a 320px | Mora em `js/franqueado/catalog.js`, **que outra sessão está editando agora**. Não toquei para não criar conflito |

## Não era bug

| # | O que eu tinha anotado | O que a leitura mostrou |
|---|---|---|
| **P2-11** | "Miniatura de Minhas artes com 400px de conteúdo em caixa de 360, `overflow:hidden` — recorte" | **É de propósito.** `.hist-preview-blur` declara `inset:-24px; width:calc(100% + 48px)` — é o fundo desfocado, feito maior que a caixa justamente para o blur não ter borda visível. O `overflow:hidden` é o mecanismo, não o defeito. Meu detector de rolagem horizontal (`scrollWidth > clientWidth`) não sabe distinguir sangria intencional de estouro — fica o aviso para a próxima varredura |

---

# O que foi implementado — com o antes/depois medido

| Item | Arquivo | Mudança | Antes → depois |
|---|---|---|---|
| **P0-1** | `css/modules/chat.css` | `.art-wrap{min-width:0}` no bloco mobile | `#f-messages` 334/314 (rolava) → **314/314**; `Baixar PNG` e `Refazer` dentro da tela |
| **P0-2** | `js/franqueado/chat.js` | guarda de `stepIdx < 0` no `fSend`, antes da bolha entrar | TypeError + chat morto → **toast "Escolha uma das opções acima"**, sem bolha órfã, texto preservado no campo |
| P1-1 | `css/modules/toolbar.css` | toast quebra linha e ganha largura reservada | 421px de texto em 288px (cortado) → **288×54, 2 linhas, sem corte** |
| P1-2 | `css/modules/toolbar.css` | toast sobe dentro do chat (`body.f-mobile-chat`) | toast em 507–544 sobre a barra (476) → **427–464, 12px de folga** |
| P1-3 | `js/franqueado/png-generator.js` | `_fBulkBindTeclado` mede a **queda** a partir da maior altura vista, com guarda de largura para rotação; ouve também `window.resize` | campo 36px **debaixo** do rodapé → **156px de folga**, arte em 84px como o desenho previa |
| P1-4 | `js/franqueado/chat.js` | `_fChatBindTeclado` re-ancora `#f-messages` no fim (`visualViewport` + `window.resize`) | 148–223px de conversa abaixo da dobra → **folga 0** |
| P1-5 | `js/franqueado/chat.js` | `inputmode` por tipo de campo | preço sem `inputmode` → **`decimal`** no passo de preço, `text` nos demais |
| P1-6 | `css/modules/toolbar.css` | `.g-dialog` mobile: botões 44px, input 16px | 81×32 / 76×32 → **93×44 / 100×44** |
| P1-7 | `css/modules/franqueado.css` | `#f-hist-search` 16px (junto da regra base — ver nota) | 12px → **16px** |
| P1-8 | `css/modules/franqueado.css` | `.hist-act-btn` na régua `--tap-min` | 202/80/**34**×40 → **188/80/44 × 44** |
| P1-9 | `css/modules/live-preview.css` | fita da prévia com alvos de toque (bloco no FIM do arquivo — ver nota) | 22×26 / 30×32 → **36×38 / 40×44**; a 320px quebra em duas linhas em vez de cortar |
| P1-10 | `css/components/login.css` | `@media (max-height:640px)`: baralho sai, painel compacta | `Entrar` em y 636 (fora) → **y 417, visível sem rolar**; conteúdo 853px → 618px |
| P1-11 | 4 arquivos CSS | `vh → dvh` em 6 modais do franqueado | `posted-box`, `f-up-box`, `f-arch-box`, `camp-ana-box`, `f-bulk-table-scroll` |
| P2-1 | `js/franqueado/chat.js` | `role="button" tabindex="0"` nos 9 chips + Enter/Espaço delegado | não focável → **foco + Enter avançam o passo** |
| P2-2/3 | `js/franqueado/chat.js` | "ao lado" sai das duas frases; placeholder devolvido ao reabilitar | instrução falsa no celular → frase verdadeira nos dois layouts |
| P2-5 | `css/modules/chat.css` | cabeçalho do Sheets na régua `--tap-min` | 36×36 → **44×44** |
| P2-6 | `css/components/login.css` | `.gl-link` com padding no mobile | 280×17 → **280×45** |
| P2-9 | `js/core/auth.js` + `css/components/topbar.css` | cor das iniciais sai do `style=` inline e vai para o CSS, escurecida | 3,35:1 → **4,67:1** |
| P2-12 | `css/modules/feedback.css` | 16px passa de `max-width:480px` para `(hover:none)` | 14px em paisagem → **16px em qualquer toque** |
| — | `index.html` | `?v=39` → **`?v=41`** (o número de deploy, um só para os 95 assets) | |

**Duas notas de ordem no CSS que custaram uma medição cada** — quem for mexer precisa saber:
- `#f-hist-search{font-size:12px}` mora na linha ~1288, **depois** do bloco mobile da linha
  ~726, e com a mesma especificidade (1-0-0). A regra de 16px teve que ir para junto da base,
  não para o bloco mobile.
- `.lp-posted-btn{height:32px}` e uma **container query** `@container lpreview (max-width:340px)`
  vêm depois do meio do `live-preview.css`. O bloco `(hover:none)` foi para o **fim do arquivo**;
  em qualquer outro lugar ele perdia por ordem — silenciosamente.

**O que ficou deliberadamente 6px abaixo da régua:** os passos de zoom e os chips `Zoom`/`Layout`
da prévia ficaram em **38px**, não 44. Subir para 44 forçaria a fita a quebrar em duas linhas
mesmo a 390px — 38px é o teto sem gastar uma linha inteira da gaveta. A 320px ela já quebra, e
aí os alvos crescem sozinhos.

---

## Verificação

**Suítes:** `node scripts/run-browser-tests.js` — **8 falhas, exatamente as mesmas 8 da árvore
limpa**, conferido com `git stash` antes e depois:

- `auto-layout` 33/34 — *"teto de linhas não encolhe a letra quando há espaço"* (é o
  desencontro ambiental já conhecido nesta máquina).
- `corpus` 11/18 — 7 casos de deslocamento acima da tolerância de 32px
  (`promo-preco-circulo`, `card-placa-grupo`, `legado-sem-baseline`).

**São pré-existentes e não têm relação com esta revisão** — nada aqui toca o solver. Verdes:
`export` 3/3, `franqueado-honestidade` 26/26, `fuzz` 63/63, `psd-import` 10/10,
`search-feedback` 32/32.

⚠️ **As 7 falhas do `corpus` merecem investigação própria** — não estão registradas no
`07_ROADMAP.md` e não são o mesmo caso ambiental do `auto-layout`.

**Navegador:** cada linha da tabela acima foi medida em 320×568 e/ou 390×844, tema claro e
escuro, antes e depois. O fluxo do chat foi percorrido inteiro (5 passos, upload, preço,
geração) depois das mudanças.

---

## Ver também

`luma-brain/04_DESIGN_SYSTEM.md` (tokens, `--tap-min`, `--safe-*`) ·
`luma-brain/ux-principles.md` (Lei de Fitts, régua de 44px) ·
`css/modules/chat.css` §1–3 do bloco do Sheets (a revisão mobile de 2026-08-14, que é o
padrão de qualidade a seguir).
