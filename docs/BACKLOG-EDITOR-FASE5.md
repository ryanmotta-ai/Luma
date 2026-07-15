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
| 16 | **Conta-gotas não amostrava pixel real** — o amostrador composto (`dEyedropPixel`) existia mas nunca era ligado à ferramenta; agora imagem/moldura/pintura amostram o pixel (com paint canvas composto e fallback pra leitura direta em canvas contaminado por CORS); texto/forma seguem com leitura exata | `js/designer/tools.js` (dEyedropAt), `measurement.js`, `canvas.js`, `brush.js` |
| 17 | **Carimbo tinha dois caminhos divergentes** — sobre camada colava em +20/+20, zerava a fonte e voltava pra select (com "Fundo" cobrindo o canvas, o modo Alinhado nunca rodava); unificado em `dStampAt` (posiciona no cursor, fonte persiste, alinhado funciona) | `js/designer/brush.js` (dStampAt), `canvas.js` |
| 18 | **Réguas desalinhadas do artboard** — o "0" partia do canto do painel e pan/scroll/relayout não re-renderizavam; agora ancoradas no frame real, com watcher em rAF que segue qualquer movimento da arte | `js/designer/canvas.js` (dRenderRulers/_dRulersTick) |
| 19 | **Carimbo guardava referência viva** — `dStampAt` re-resolve a origem por id nos dois caminhos (undo/exclusão da origem não carimba mais estado morto) | `js/designer/brush.js` |
| 20 | **`dIsLayerVisible` não existia** — chamada 9× em selection.js; TODA a seleção avançada (objeto, rápida, varinha) morria em ReferenceError no 1º uso, em silêncio. Helper definido (grupo já propaga `visible` aos filhos) | `js/designer/selection.js` |
| 21 | **Varinha usava a prancheta [0]** em vez da ativa no composite de imagem | `js/designer/selection.js` |
| 22 | **Varinha ignorava Shift/Alt** — agora soma/subtrai da seleção, como a seleção rápida | `js/designer/canvas.js` |
| 23 | **Seleção de objeto: clique sem arrasto desselecionava** — agora seleciona a camada sob o cursor (vazio segue desselecionando) | `js/designer/selection.js` |
| 24 | **K (máscara) em grupo criava máscara degenerada** — guard em `dMaskAdd` com toast | `js/designer/mask.js` |
| 25 | **Régua sumia após undo/redo** — o overlay agora recria linha/label quando o estado existe sem DOM (inclusive label com medida) | `js/designer/measurement.js` |
| 26 | **Nota/contagem/sampler/régua/criação-por-clique deslocadas na transição de zoom** — `_dScreenToCanvas` e o click do frame usam a escala real do DOM (mesma razão do pincel) | `js/designer/measurement.js`, `brush.js` |
| 27 | **No-ops silenciosos ganharam feedback** — balde em área vazia orienta ("pinta texto/forma"); desfoque/nitidez/dedo avisam 1× por sessão que agem sobre traços do pincel | `js/designer/brush.js` |
| 28 | **Ferramenta Linha virou ferramenta de verdade** — clique-e-desenha no eixo dominante do arrasto (`dAddLineAt`); clique solto cria linha padrão no ponto (antes caía uma linha fixa no centro e voltava pra select) | `js/designer/brush.js`, `canvas.js`, `layers.js` |
| 29 | **Borracha mágica quebrava o undo em área grande** — o commit do histórico agora acontece no fim dos chunks assíncronos (o push do mouseup capturava o estado pré-apagamento e se dedupava); undo restaura, redo re-apaga | `js/designer/eraser-tools.js` |
| 30 | **Cursor das formas** — elipse/triângulo/polígono/estrela/linha ganham crosshair (só o retângulo tinha) | `js/designer/canvas.js` |

---

## 🔴 P0 — abertos, confirmar e corrigir primeiro

_(vazio — os três P0 da rodada 1 foram corrigidos na rodada 2)_

## 🟠 P1 — abertos, corrigir na sequência

_(vazio — todos os P1 foram corrigidos)_

## 🟡 P2 — polimento / UX

| # | Item | Onde |
|---|---|---|
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
