# Backlog — Auditoria do Editor (Fase 5)

> Resultado da auditoria de ferramentas do Estúdio em **2026-07-15** (Fase 5 — Atalhos e auditoria do editor).
> Método: 3 varreduras paralelas de código (pintura · seleção/canvas/zoom · camadas/histórico/atalhos) → **cada achado crítico verificado na fonte antes de corrigir** (plausível ≠ real; 1 falso positivo descartado).
> Regra ao trabalhar neste backlog: os itens ainda abertos com origem "auditoria" precisam de **confirmação na fonte + reprodução no navegador** antes do fix.

---

## ✅ Corrigido nesta rodada (verificado no navegador via Chromium headless)

| # | Bug | Onde |
|---|---|---|
| 1 | **`tooltip.js` inteiro morto** — crases escapadas (`\\\``) quebravam o parse do arquivo; nenhum tooltip rico de ferramenta existia em runtime desde o commit `e7a3da1` | `js/designer/tooltip.js:162` |
| 2 | **Modal de atalhos desatualizado/errado** — dizia "Publicar Ctrl+S" (é **Salvar**), faltavam ~25 atalhos reais (U, N, K, Q, X, I, G, H, Espaço, `[` `]`, Ctrl+C/V, estilo, F2…); reescrito completo, por categorias, com `<kbd>`, tokens, animação e ARIA | `index.html` + `css/modules/toolbar.css` |
| 3 | **Esc não fechava o modal de atalhos** (nenhum handler); agora fecha, com foco devolvido a quem abriu | `js/designer/layers.js` (dOpenCheat/dCloseCheat) |
| 4 | **Atalhos errados na UI** — "Y" na Varinha (não existe; é ciclo Shift+V) e "O" na Nitidez (é N) no painel Todas as Ferramentas e nos dados do tooltip; "W"/"Z"/"L" fantasmas no tooltip.js | `index.html`, `js/designer/tooltip.js` |
| 5 | **Del ignorava a multi-seleção** — apagava só a camada primária; agora usa `dDeleteSelectedLayer` | `js/designer/publish.js` (handler de teclado) |
| 6 | **Del com dedo/desfoque/nitidez/borracha-de-fundo apagava a CAMADA** em vez de limpar a pintura; guard estendido a todas as ferramentas de pintura | `js/designer/publish.js` |
| 7 | **Ctrl+D em grupo duplicava um grupo VAZIO** (filhos ficavam só no original; x/y do contêiner virava NaN); agora clona filhos reapontando pro novo contêiner | `js/designer/library.js` (dDuplicateLayer) |
| 8 | **Copiar/colar grupo não recriava o contêiner** — dCopy agora leva os filhos junto e dPaste remapeia `parentId` para o grupo clonado | `js/designer/publish.js` (dCopy/dPaste) |
| 9 | **Setas em grupo = NaN** (contêiner sem x/y) e ignoravam multi-seleção; agora movem os filhos do grupo / toda a multi-seleção, como o arrasto | `js/designer/publish.js` |
| 10 | **Mão não fazia pan sobre camadas** — mousedown da camada engolia o evento antes do pan do wrapper (com camada "Fundo" cobrindo tudo, a Mão nunca funcionava) | `js/designer/canvas.js:1126` |
| 11 | **Régua não sumia ao trocar de ferramenta** (o comentário prometia); `dSetTool` agora chama `dRulerClear` | `js/designer/canvas.js` (dSetTool) |
| 12 | **`[` `]` não ajustava a borracha de fundo** (bg-eraser usa raio do pincel) | `js/designer/publish.js` |
| 13 | **× do fechar invisível no tema claro** — `.pv-close-btn` usava branco fixo; agora tokens `--d-*` (afeta todos os modais que o usam) | `css/modules/designer.css` |
| 14 | **Emoji ⌨ em botão** (proibitivo do DS) → SVG | `index.html:1929` |
| 15 | Comentário/código mortos do Ctrl+Alt+V ("Alt = colar no lugar" nunca rodava; Alt é colar estilo) | `js/designer/publish.js` |

---

## 🔴 P0 — abertos, confirmar e corrigir primeiro

| # | Bug | Cenário | Onde | Status |
|---|---|---|---|---|
| 16 | **Conta-gotas não amostra pixel real** — existe um amostrador completo (`dEyedropPixel`/`dEyedropPreview`, composita as camadas offscreen) que nunca é ligado à ferramenta; ela usa `dEyedropFromLayer` (só lê `l.color` de texto/forma). Clicar em imagem/pintura não pega cor | usuário clica numa foto com o conta-gotas → toast "funciona em texto e forma" | `js/designer/measurement.js:54,182,209` vs `canvas.js:1129` | auditoria (ALTA) — confirmar |
| 17 | **Carimbo tem dois caminhos divergentes** — clique sobre camada (`dDoStamp`: cola em +20/+20, zera fonte, volta pra select) vs clique no frame (`brush.js`: posiciona no cursor, modo alinhado, fonte persiste). Com camada "Fundo" cobrindo o canvas, o caminho bom nunca roda | marcar fonte, clicar no canvas → clone cai em lugar errado e a ferramenta some | `canvas.js:1162` vs `brush.js:253-272` | auditoria (ALTA) — confirmar |
| 18 | **Réguas (Shift+R/toggle) desalinhadas do artboard** — marcas partem do canto do painel, sem compensar offset de centralização nem scroll; nunca re-renderizam em pan/scroll | ativar réguas → "0" fora do canto da arte; rolar piora | `canvas.js:1758-1799` | auditoria (ALTA) — confirmar |

## 🟠 P1 — abertos, corrigir na sequência

| # | Bug | Onde | Status |
|---|---|---|---|
| 19 | Carimbo via tecla S guarda **referência viva** da camada (`dStampSource = l`); o caminho de clique-no-frame clona sem re-resolver por id → carimba estado morto após undo/exclusão (viola a regra "estado por ID") | `publish.js` (tecla S) + `brush.js:257` | auditoria (MÉDIA) |
| 20 | Varinha mágica dimensiona o composite com `dArtboards[0].w/h` fixo em vez do artboard ativo → falha silenciosa fora da 1ª prancheta | `selection.js:712-716` | auditoria (MÉDIA) |
| 21 | Varinha mágica ignora Shift/Alt (não soma/subtrai da seleção; quick-select respeita) | `canvas.js:604-618` | auditoria (MÉDIA) |
| 22 | Seleção de Objeto: clique sem arrasto sobre a camada **desseleciona** (trata como retângulo < 4px) em vez de selecionar | `selection.js:116-122` | auditoria (MÉDIA) |
| 23 | Ferramenta Linha não é ferramenta — cai uma linha fixa no centro e volta pra select; sem clique-e-desenha | `brush.js:591-597` + `layers.js` (dAddLine) | auditoria (MÉDIA) |
| 24 | Borracha mágica em área grande quebra o undo (flood-fill em chunks assíncronos; `dHistoryPush` captura estado parcial; fim não entra no histórico) | `eraser-tools.js:135-175` | auditoria (MÉDIA) |
| 25 | Desfoque/Nitidez/Dedo só agem sobre a camada de pintura — sobre imagem importada não fazem nada, **sem aviso** (mínimo: toast explicando) | `brush.js:125-155,506-539` | auditoria (MÉDIA) |
| 26 | Balde/conta-gotas são no-ops silenciosos em área vazia e camada de imagem (sem feedback do que a ferramenta cobre) | `canvas.js:1129-1130` | auditoria (MÉDIA) |
| 27 | K (máscara) em grupo/camada sem w/h cria máscara degenerada (`_dMaskBlank(undefined)`) — validar tipo + toast | `publish.js` (tecla K) + `mask.js:36` | auditoria (MÉDIA) |
| 28 | Régua some após undo/redo (estado restaurado sem recriar `lineEl`/`labelEl` — fica estado fantasma) | `undo-redo.js:105-121` + `measurement.js:881-889` | auditoria (MÉDIA) |
| 29 | Nota/contagem/color-sampler usam `dZoomLevel/100` em vez da escala real do DOM → clique durante a transição de zoom (~220ms) posiciona deslocado (o pincel já foi corrigido; usar `dCanvasPos`) | `brush.js:235` + `measurement.js:29` | auditoria (MÉDIA) |

## 🟡 P2 — polimento / UX

| # | Item | Onde |
|---|---|---|
| 30 | Cursor não muda para elipse/triângulo/polígono/estrela (só rect tem crosshair no `dToolCursors`) | `canvas.js:232-275` |
| 31 | Cursor "move" das camadas sobrepõe o cursor da ferramenta ativa (balde/conta-gotas/carimbo sobre imagem parecem drag) | `canvas.js:1031` |
| 32 | F2 em camada dentro de grupo colapsado falha em silêncio (linha não está no DOM) | `layers.js` (dRenameLayer) |
| 33 | F2 sem seleção: `dRenameAB` é função vazia (resquício multi-prancheta) — implementar ou remover o caminho | `templates.js:373` |
| 34 | `dDeleteLayer` de grupo usa `confirm()` nativo — trocar por `gConfirm` (padrão da casa) | `layers.js:478` |
| 35 | Toasts com emoji (🔒 etc.) no canvas.js — dívida contra o DS (ícone = SVG) | `canvas.js:1119,1160` |
| 36 | `js/designer/rich-tooltips.js` é arquivo morto (não referenciado no index.html; o vivo é `tooltip.js`) — remover ou consolidar | `js/designer/rich-tooltips.js` |

---

## ⚪ Descartados na verificação (falso positivo — NÃO "corrigir")

- **"Clique único cria DUAS camadas (rect/texto/moldura/img)"** — o mousedown cria via `dEndDrawShape`, mas `dAddShapeAt`/`dAddTextAt`/`dAddFrameAt`/`dAddImageAt` fazem `dSetTool('select')` na criação; quando o `click` chega ao handler do `brush.js`, a ferramenta já não é de criação e nada duplica. Compensação intencional — não mexer sem reproduzir.
- Colar camada **não** perde vínculo `{{campo}}` (deep-clone preserva `imgVar`/`content`).
- Undo/redo restaura grupos e `parentId` corretamente (snapshot JSON completo).
- Formas triangle/polygon/star renderizam e são selecionáveis; texto vertical e máscara de texto funcionam.

---

## Verificação usada nesta rodada (repetível)

Sem servidor: Chromium headless (Playwright) direto no `file://.../index.html`, forçando `mode-designer` e escondendo `#g-login-screen`, depois exercitando as funções reais (`dAddShapeAt` → `dGroupSelected` → `dDuplicateLayer`/`dCopy`/`dPaste` → eventos de teclado) e conferindo `dLayers`. Scripts de referência ficaram na sessão (scratchpad `verify-cheat.js` / `verify-fixes.js`) — recriar conforme necessário.
