# Yungas Piloto

Plataforma interna de Creative Automation da Delivery Much.  
Substitui Deskfy + Placid com fluxo customizado para franqueados e designers.

---

## Como rodar localmente

**Opção 1 — Live Server (recomendado):**
1. Abra a pasta no VS Code
2. Instale a extensão **Live Server** (ritwickdey.LiveServer) se ainda não tiver
3. Clique com botão direito em `index.html` → **Open with Live Server**
4. O navegador abre em `http://127.0.0.1:5500`

**Opção 2 — Direto no navegador:**
1. Abra o arquivo `index.html` diretamente no Chrome/Firefox
2. Funciona sem servidor local, mas alguns recursos de upload podem ter restrições

> **Não precisa de npm, Node.js, build ou qualquer instalação.**

---

## Estrutura de pastas

```
yungas-piloto/
├── index.html                    # Markup principal + links pra CSS e JS
├── README.md                     # Este arquivo
├── .gitignore
│
├── css/
│   ├── 00-tokens.css             # Variáveis CSS (cores, fontes, espaçamentos)
│   ├── 01-reset.css              # Reset global, body, html
│   ├── 02-animations.css         # Keyframes globais
│   ├── 03-fonts.css              # @font-face do Realce Black
│   ├── components/
│   │   ├── topbar.css            # Barra superior e mode-tabs
│   │   ├── modal.css             # Modais genéricos
│   │   ├── toast.css             # Notificações (gToast)
│   │   ├── buttons.css           # Botões reutilizáveis
│   │   ├── tutorial.css          # TutorialEngine (stage, cursor, spotlights)
│   │   └── help-modal.css        # Modal de ajuda
│   ├── modules/
│   │   ├── franqueado.css        # View do franqueado
│   │   ├── designer.css          # View do designer
│   │   ├── chat.css              # Bolhas, input, sugestões do chat
│   │   ├── catalog.css           # Grid de campanhas e cards
│   │   ├── live-preview.css      # Preview lateral do franqueado
│   │   ├── history.css           # Aba "Minhas artes"
│   │   ├── canvas-area.css       # Canvas, rulers, guides do designer
│   │   ├── toolbar.css           # Toolbar vertical e brush bar
│   │   ├── layers-panel.css      # Painel de layers
│   │   └── publish-modal.css     # Modal de publicação (4 abas)
│   └── responsive.css            # Media queries gerais
│
├── js/
│   ├── 00-config.js              # Constantes globais (CAMPS_ATIVAS, FMTS, etc)
│   ├── 01-state.js               # Estados globais (fState, dFolders, tutState, etc)
│   ├── core/
│   │   ├── storage.js            # Helpers de localStorage (get/set/parse seguros)
│   │   ├── toast.js              # gToast e sistema de notificações
│   │   ├── help.js               # gOpenHelp, gCloseHelp, gHelpAction
│   │   └── utils.js              # Helpers compartilhados (formatação, datas, etc)
│   ├── franqueado/
│   │   ├── catalog.js            # Renderização do catálogo, fSwitchTab
│   │   ├── materials.js          # Visualização de materiais
│   │   ├── chat.js               # Fluxo conversacional, fAddBot, fAddUser
│   │   ├── chat-input.js         # Input box, máscaras, validação
│   │   ├── upload.js             # Upload com drag & drop
│   │   ├── confirm.js            # Confirm card antes de gerar
│   │   ├── history.js            # Aba minhas artes, filtros
│   │   ├── live-preview.js       # Preview lateral em tempo real
│   │   └── png-generator.js      # fGenPNG, fRenderTemplateLayers
│   ├── designer/
│   │   ├── canvas.js             # Render canvas, zoom, pan
│   │   ├── layers.js             # CRUD de layers, painel
│   │   ├── tools.js              # Ferramentas (move, text, shape, frame, etc)
│   │   ├── brush.js              # Pincel/borracha/carimbo
│   │   ├── selection.js          # Multi-select, agrupamento, smart guides
│   │   ├── undo-redo.js          # Histórico de ações
│   │   ├── publish.js            # Modal de publicação 4 abas
│   │   ├── templates.js          # CRUD de templates, dBuildLayers
│   │   ├── library.js            # Biblioteca de assets
│   │   ├── preview.js            # pvRender, modal de preview
│   │   ├── topbar.js             # Topbar do designer
│   │   ├── theme.js              # Dark/light mode toggle
│   │   └── shortcuts.js          # Atalhos de teclado
│   ├── tutorial/
│   │   ├── engine.js             # tutOpen, tutClose, tutNext, tutGoToScene
│   │   ├── catalog.js            # TUTORIALS = {...} (4 tutoriais definidos)
│   │   ├── mocks.js              # tutMockCampaign, tutMockMaterial, tutMockHist
│   │   └── controls.js           # Play/pause/replay, progress, keyboard
│   └── main.js                   # Bootstrap: chama init de cada módulo
│
├── assets/
│   ├── fonts/
│   │   └── realce-black.woff2    # Fonte Realce Black
│   └── logos/                    # Logos da DM em PNG
│       ├── dm-h-branca.png
│       ├── dm-h-preta.png
│       ├── dm-h-laranja.png
│       ├── dm-h-principal.png
│       ├── dm-v-branca.png
│       └── dm-v-principal.png
│
└── docs/
    ├── architecture.md           # Visão geral da arquitetura
    ├── adding-features.md        # Como adicionar feature nova
    └── conventions.md            # Convenções de prefixo e padrões
```

---

## Como adicionar uma feature nova

| O que você quer fazer | Arquivo(s) a mexer |
|-----------------------|--------------------|
| Novo estilo global (cor, espaçamento) | `css/00-tokens.css` |
| Novo componente visual reutilizável | `css/components/` + criar arquivo novo |
| Nova lógica do chat do franqueado | `js/franqueado/chat.js` |
| Novo tipo de layer no designer | `js/designer/layers.js` + `js/designer/canvas.js` |
| Nova ferramenta do designer | `js/designer/tools.js` |
| Novo tutorial | `js/tutorial/catalog.js` (adicionar entrada em `TUTORIALS`) |
| Nova constante global | `js/00-config.js` |
| Nova variável de estado | `js/01-state.js` |

---

## Glossário de prefixos

| Prefixo | Módulo | Exemplos |
|---------|--------|---------|
| `f*` | Franqueado | `fStartChat`, `fSelectMaterial`, `fGenPNG` |
| `d*` | Designer | `dRenderCanvas`, `dPublishOpen`, `dBuildLayers` |
| `g*` | Global (compartilhado) | `gToast`, `gOpenHelp`, `gCloseHelp` |
| `tut*` | Tutorial Engine | `tutOpen`, `tutClose`, `tutNext`, `tutGoToScene` |
| `pv*` | Preview Engine | `pvRender`, `pvClose` |
| `pub-*` | Modal de publicação (IDs HTML) | `pub-modal`, `pub-tab-*` |
| `f-mat-*` | View de materiais (IDs HTML) | `f-mat-grid`, `f-mat-back` |
| `dLib*` | Biblioteca de assets do designer | `dLibOpen`, `dLibSearch` |
| `vt*` | Toolbar vertical do designer | `vtSelectTool` |
| `bb*` | Brush bar do designer | `bbSetSize` |

---

## Tecnologias

- **HTML, CSS e JavaScript puro** — sem framework, sem npm, sem build
- **localStorage** para persistência de templates e histórico
- Roda abrindo `index.html` no navegador

---

*Fase 2 futura: integração com backend Python (projeto Pedro).*
