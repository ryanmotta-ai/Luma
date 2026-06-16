# LUMA — Documento de Contexto do Projeto

> Documento único para o Claude Code. Leia do início ao fim antes de qualquer sessão.
> Consolida: architecture.md · conventions.md · adding-features.md · changelog.md · ANALISE-PROJETO.md · PLANO-5.2-smart-resize.md · PLANO-psd-refino.md

---

## 1. O QUE É O LUMA

**Luma** é uma plataforma interna de **creative automation** da **Delivery Much**.

Dois papéis num único app:

- **Designer** (admin/agência): cria *templates* num editor estilo Canva/Photoshop, define **variáveis** que o franqueado preenche, regras, permissões, e publica.
- **Franqueado** (usuário final): escolhe uma campanha, responde um chat guiado, e gera a arte (PNG/JPG) pronta para postar — sem saber design.

A ponte entre os dois é o sistema de **variáveis** (`{{produto}}`, `foto_produto`...) e o **interpolador único** compartilhado entre a simulação do designer e o gerador de PNG do franqueado.

---

## 2. STACK E ARQUITETURA

| Aspecto | Decisão |
|---|---|
| Stack | Vanilla JS puro, sem framework, sem bundler, sem npm |
| Carregamento | `index.html` carrega ~30 `<script>` em ordem; tudo global |
| Estado | variáveis globais (`dLayers`, `dFolders`, `dVars`, `fState`...) |
| Persistência | `localStorage` (6 chaves) — sem backend ainda |
| Render | Canvas 2D (PNG), DOM absoluto (editor), SVG (export) |
| Roda | Abrindo `index.html` no navegador — Live Server do VS Code |

**Trade-off central:** zero fricção de setup e deploy (é um `index.html`), ao custo de não ter modularidade real, testes, nem tipos. Escala bem para MVP rico; vai precisar de backend + organização para produção multi-tenant (Fase 5.1).

---

## 3. OS QUATRO MÓDULOS

| # | Módulo | Status | Mata o quê |
|---|--------|--------|------------|
| 1 | **Franqueado** — chatbot gerador de artes | ✅ production-ready | Deskfy + Placid |
| 2 | **Designer** — editor visual de templates | 🟡 refinando | Tempo de produção manual |
| 3 | **Analytics** — dados de performance criativa | ⏳ front em construção | Decisões sem dado |
| 4 | **CRM Visual** — inapp, push, comunicação | 💡 ideia validada | CleverTap + ChatGPT manual |

### Módulo 1 — Franqueado (`f*`)

O franqueado acessa o sistema para gerar artes a partir de templates já publicados.

**Fluxo:** catálogo de campanhas → seleciona campanha → catálogo de materiais (formatos) → chat guiado (produto, preço, foto) → confirm card → render PNG → download

**View:** `#view-franqueado` — painel esquerdo (catálogo/histórico) + painel direito (chat + preview lateral)

### Módulo 2 — Designer (`d*`)

O designer cria e publica templates que os franqueados usam.

**Fluxo:** cria pasta de campanha → cria template (Story/Feed/Wide) → edita layers no canvas → define variáveis → publica → aparece no catálogo do franqueado

**View:** `#view-designer` — topbar, canvas central, toolbar vertical esquerda, painel lateral direito

### Módulo 3 — Analytics (`p*`)

Dados de performance criativa. Front em construção (prompt `luma-prompt-modulo-dados.md` gerado). Pedro implementa o backend depois.

Seções planejadas: Dashboard · Performance Loop · Brand Guardian · Auto-tagger · Predição de Aprovação · Coach de Foto (placeholder)

### Módulo 4 — CRM Visual (planejado)

Editor de inapp + push para CleverTap. Hoje o time cria HTMLs no ChatGPT e edita manualmente no CleverTap. O Luma pode oferecer editor com tamanhos corretos, templates com variáveis, Brand Guardian antes de subir, e exportação compatível com o CleverTap.

**Dependência crítica:** estudar formatos aceitos pelo CleverTap antes de desenvolver.

---

## 4. ESTRUTURA DE ARQUIVOS

```
luma-piloto/
├── index.html                    # markup + links CSS/JS (1.088 linhas)
├── css/
│   ├── 00-tokens.css             # variáveis CSS (cores, fontes, logos DM)
│   ├── 01-reset.css              # reset global
│   ├── 02-animations.css         # keyframes globais (gFadeIn, gScaleIn, etc.)
│   ├── 03-fonts.css              # @font-face Realce Black
│   ├── components/
│   │   ├── topbar.css
│   │   ├── modal.css
│   │   ├── toast.css
│   │   ├── buttons.css
│   │   ├── tutorial.css
│   │   ├── help-modal.css
│   │   └── splash.css            # splash screen de entrada
│   └── modules/
│       ├── franqueado.css
│       ├── designer.css
│       ├── chat.css
│       ├── catalog.css
│       ├── live-preview.css
│       ├── history.css
│       ├── canvas-area.css
│       ├── toolbar.css
│       ├── layers-panel.css
│       ├── publish-modal.css
│       └── dados.css             # módulo analytics (a criar)
├── js/
│   ├── 00-config.js              # CAMPS_ATIVAS, CAMPS_OUTRAS, FMTS, HIST_KEY
│   ├── 01-state.js               # fState inicial
│   ├── core/
│   │   ├── storage.js
│   │   ├── toast.js              # gToast
│   │   ├── help.js               # gOpenHelp, gCloseHelp
│   │   ├── utils.js
│   │   ├── layout.js             # motor smart resize 5.2
│   │   └── splash.js             # splash screen (a criar)
│   ├── franqueado/
│   │   ├── catalog.js
│   │   ├── materials.js
│   │   ├── chat.js
│   │   ├── chat-input.js
│   │   ├── upload.js
│   │   ├── confirm.js
│   │   ├── history.js
│   │   ├── live-preview.js
│   │   └── png-generator.js
│   ├── designer/
│   │   ├── canvas.js             # 974 linhas — maior arquivo
│   │   ├── layers.js             # 946 linhas
│   │   ├── templates.js          # 747 linhas — pastas, artboards, PSD
│   │   ├── tools.js
│   │   ├── brush.js
│   │   ├── selection.js
│   │   ├── undo-redo.js
│   │   ├── publish.js
│   │   ├── preview.js
│   │   ├── library.js
│   │   ├── topbar.js
│   │   ├── theme.js
│   │   ├── fonts.js              # upload de fontes TTF/OTF/WOFF
│   │   └── shortcuts.js
│   ├── tutorial/
│   │   ├── engine.js
│   │   ├── catalog.js            # 4 tutoriais originais
│   │   ├── catalog-studio.js     # 14 tutoriais do estúdio
│   │   ├── mocks.js
│   │   └── mocks-studio.js
│   ├── dados/                    # módulo analytics (a criar)
│   │   ├── state.js
│   │   ├── dashboard.js
│   │   ├── performance-loop.js
│   │   ├── brand-guardian.js
│   │   ├── auto-tagger.js
│   │   ├── predicao.js
│   │   ├── coach-foto.js
│   │   └── index.js
│   └── main.js                   # bootstrap: setMode(), inits
├── assets/
│   ├── fonts/realce-black.woff2
│   └── logos/
│       ├── dm-h-branca.png
│       ├── dm-h-preta.png
│       ├── dm-h-laranja.png
│       ├── dm-h-principal.png
│       ├── dm-v-branca.png
│       ├── dm-v-principal.png
│       ├── luma-h-branca.png     # logo Luma versão branca
│       └── luma-h-cor.png        # logo Luma versão colorida
└── docs/
    └── CONTEXTO.md               # este arquivo
```

---

## 5. CONVENÇÕES — LEIA ANTES DE ESCREVER UMA LINHA

### Prefixos de funções JS

| Prefixo | Módulo | Arquivos |
|---------|--------|---------|
| `f*` | Franqueado | `js/franqueado/*.js` |
| `d*` | Designer | `js/designer/*.js` |
| `g*` | Global | `js/core/*.js` |
| `tut*` | Tutorial Engine | `js/tutorial/*.js` |
| `pv*` | Preview Engine | `js/designer/preview.js` |
| `p*` | Analytics (Pedro) | `js/dados/*.js` |
| `sp*` | Splash screen | `js/core/splash.js` |

### Prefixos de IDs HTML

| Prefixo | Onde aparece |
|---------|-------------|
| `f-*` | Elementos do franqueado |
| `d-*` | Elementos do designer |
| `g-*` | Globais (`#g-toast`, `#g-help-modal`) |
| `tut-*` | Tutorial Engine |
| `pub-*` | Modal de publicação |
| `f-mat-*` | Catálogo de materiais |
| `vt-*` | Toolbar vertical do designer |
| `bb-*` | Brush bar |
| `pv-*` | Preview engine |
| `dp-*` | Props panel do designer |
| `sp-*` | Splash screen |
| `p-*` | Módulo analytics |

### Padrões obrigatórios

```javascript
// CERTO — função global, sem export
function fMinhaFuncao(param) { ... }

// ERRADO — ES Module não funciona sem build
export function fMinhaFuncao(param) { ... }
```

Estado é variável `let` global modificada diretamente — sem setState, Redux ou signals.

```javascript
// Modifica → re-renderiza manualmente
fState.tab = 'historico';
fRenderHist();
fSwitchTab('historico', btnEl);
```

Persistência sempre com `try/catch`:

```javascript
function fSaveHist(arr) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(arr.slice(0, 50))); }
  catch(e) {}
}
```

Feedback ao usuário sempre via `gToast` — nunca `alert()` ou `console.log()`.

Cores e espaçamentos sempre via variáveis CSS de `00-tokens.css` — nunca hardcoded.

---

## 6. PERSISTÊNCIA (localStorage)

| Chave | Conteúdo | Risco |
|---|---|---|
| `yngs_folders_v1` | pastas + templates + layers + capas | quota (capas base64) |
| `yngs_artboards_v1` | pranchetas do designer | quota |
| `yngs_vars_v1` | catálogo de variáveis | baixo |
| `yngs_snippets_v1` | blocos reutilizáveis | médio |
| `yngs_fonts_v1` | fontes enviadas (base64) | quota (3MB/fonte) |
| `yngs_tutorials_done` | tutoriais concluídos | baixo |
| `dm_artes_hist_v2` | histórico de artes geradas (máx. 50) | baixo |
| `dm_asset_tags_v1` | tags do auto-tagger | baixo |

**Limitação estrutural:** imagens enviadas (fotos/logos) não persistem — são trocadas por `__local__` ao salvar (somem no reload, com aviso). Resolver = object storage no backend (Fase 5.1).

---

## 7. FLUXO DE DADOS: DESIGNER → FRANQUEADO

1. Designer cria template → clica **Publicar**
2. `dPublishConfirm()` salva em `dFolders` no localStorage
3. `fRenderCatalogs()` lê as pastas publicadas e exibe no catálogo
4. Franqueado seleciona material → `fSelectMaterial()` → chat guiado
5. `fGerarArte()` usa variáveis preenchidas + layers do template → renderiza PNG

---

## 8. COMO ADICIONAR FEATURES

**Regra geral:** mexa no mínimo de arquivos possível. A maioria das features toca 1–2 arquivos. Se estiver abrindo mais de 3, provavelmente há uma forma mais simples.

### Nova campanha no catálogo do franqueado

**Arquivo:** `js/00-config.js` — adicione em `CAMPS_ATIVAS`:

```javascript
{
  id: 'nova-camp',
  name: 'Nome da Campanha',
  color: '#C84B00',
  count: 3,
  badge: 'NOVO',
  expiraDias: 7,
  popular: false,
  previewProd: 'PRODUTO DESTAQUE',
  previewDe: 'R$ 29,90',
  previewPor: 'R$ 9,90',
  perguntas: [
    { id: 'produto', texto: 'Qual o nome do produto?', sugestoes: ['Opção 1'] }
  ],
}
```

### Novo tipo de campo no chat

**Arquivo:** `js/franqueado/chat-input.js` — adicione em `F_FIELD_TYPES`:

```javascript
minha_variavel: {
  tipo: 'texto',  // 'texto' | 'numero' | 'moeda' | 'image'
  maxLen: 60,
  placeholder: 'Digite o valor...',
  validar: (v) => v.length > 0,
  erro: 'Campo obrigatório.',
},
```

### Novo layer no designer

**Arquivos:** `js/designer/layers.js` + `js/designer/canvas.js`

```javascript
// Em layers.js
function dAddMeuLayer() {
  dHistoryPush();
  const f = DFMT_SIZES[dFmt];
  dLayers.unshift({ id: dLyrCnt++, type: 'meu-tipo', x: 40, y: 40, w: 200, h: 100 });
  dRenderCanvas();
  dRenderLayersList();
}
// Em canvas.js, dentro de dRenderCanvas() → adicione case 'meu-tipo':
```

### Nova ferramenta na toolbar do designer

1. `js/designer/canvas.js` → adicione `case` em `dSetTool(t)`
2. `index.html` → adicione botão em `#d-vtoolbar`
3. `css/modules/toolbar.css` → adicione estilo se necessário

### Novo estilo global

**Arquivo:** `css/00-tokens.css` → adicione em `:root {}`:
```css
--minha-cor: #FF5500;
```

### Nova animação CSS

**Arquivo:** `css/02-animations.css`:
```css
@keyframes gMeuEfeito {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

### Adicionar campo em template existente

1. No designer: adicione layer de texto com `{{nome_da_var}}`
2. `js/franqueado/chat-input.js`: defina `F_FIELD_TYPES['nome_da_var']`
3. `js/00-config.js`: adicione pergunta no array `perguntas` da campanha

### Debug rápido (console do navegador)

```javascript
console.log(fState)                                          // estado do franqueado
console.log(dFolders)                                        // templates publicados
console.log(JSON.parse(localStorage.getItem('dm_artes_hist_v2')))  // histórico
localStorage.clear(); location.reload();                     // reset total
```

### O que NÃO fazer

- Não usar ES Modules (`import`/`export`) — sem build
- Não usar `const` no escopo global para variáveis compartilhadas — use `let`
- Não renomear funções existentes — prefixos são convenção e quebram chamadas no HTML
- Não criar arquivo novo sem ter código pra colocar agora
- Não fazer commit automático — sempre mostrar `git diff` e pedir confirmação

---

## 9. STATUS DAS FASES

### ✅ Concluído

**Refatoração modular** — de 1 arquivo 9.300 linhas para 44 arquivos organizados. 15 CSS + 24 JS + assets físicos. Zero mudança de comportamento.

**Fase 0–4 (features core):**
- Ferramentas (smudge/blur/gradiente), undo/redo robusto
- Formas avançadas (círculo/polígono/estrela/linha)
- Efeitos de texto (contorno/sombra/realce)
- Variáveis sólidas: `gInterpolate`, tipos ricos (currency/date/select/color/boolean)
- Bindings `l.bindings` e regras `l.rules` com rule-builder
- Bulk CSV com fila/yield
- Export SVG client-side com fonte embutida
- Pastas com capa estilo Deskfy
- Upload de fontes da marca (TTF/OTF/WOFF)
- 18 tutoriais animados na Central de Ajuda
- Template-modelo de exemplo (showcase)

**Smart resize 5.2** — núcleo implementado (`js/core/layout.js`). Motor de âncoras com `gInferAnchor`, `gEnsureAnchors`, `gReflowLayers`. PNG do franqueado sem distorção. Preview multi-formato. Troca de formato no editor com reflow + confirm.

**PSD import** — ag-psd vendorizado, Web Worker com fallback, tela de revisão por camada, fidelidade parcial (cor sólida, sombra/contorno, fontSize corrigido por DPI), máscaras + clipping masks, quota com compressão.

**Otimizações de performance** (5 fixes documentados):
- Cache de imagens no gerador de PNG (`_fImgCache`)
- Eliminação do double render ao adicionar layer (`dSelLayerState`)
- Cache de elementos DOM no drag/resize (`dDragEls`, `dResizeEl`)
- Debounce em `dHistoryPush` para inputs contínuos
- Preservar paint canvas sem `toDataURL`

### 🟡 Em andamento

**Smart resize 5.2 — UI pendente:**
- UI de âncora (9 pontos) no painel Propriedades
- UI de overrides por formato (`l.overrides[fmt]`)
- Publicação multi-formato explícita no modal de publicação

**PSD import — refinamentos (ver Seção 11):**
- Fase A: z-order, máscaras na quota, testes de fumaça
- Fase B: fontes remap, texto rico (style runs), shapes vetoriais, gradientes
- Fase C: IA de mapeamento (Claude), detecção de moldura de foto
- Fase D: UX da importação (preview por camada, agrupar por tipo)

### ⏳ Próximos (com prompts prontos)

| Tarefa | Arquivo do prompt |
|--------|------------------|
| Splash screen animada | `luma-prompt-splash-screen.md` |
| Redesign UI do Designer | `luma-prompt-redesign-designer.md` |
| Módulo Analytics (front completo) | `luma-prompt-modulo-dados.md` |

### 💡 Planejado (sem prompt ainda)

- Pranchetas múltiplas ao importar PSD com vários artboards
- Módulo CRM Visual (inapp/push para CleverTap)
- Backend Supabase (5.1) — maior gargalo do produto

---

## 10. SMART RESIZE MULTI-FORMATO (5.2)

### Decisões de design

- **Tamanho** escala por fator único `s = min(W₁,H₁) / min(W₀,H₀)` → nunca distorce
- **Posição** re-ancora por eixo: `l.anchor = {h: left|center|right|stretch, v: top|middle|bottom|stretch}`
  - `left/top`: margem inicial × s
  - `right/bottom`: margem final × s (medida da borda oposta)
  - `center/middle`: centro proporcional (`relC × total₁`)
  - `stretch`: proporcional ao eixo (fundos e faixas full-width)
- **Inferência automática** (`gInferAnchor`): por terços do canvas + detecção de cobertura ≥94% → stretch
- **Overrides por formato**: `l.overrides = {feed:{x,y,...}, wide:{...}}` têm a palavra final no reflow

### Motor (`js/core/layout.js`)

Funções: `gInferAnchor`, `gEnsureAnchors`, `gReflowLayers`, `gFmtKey`

Usado em:
- `js/franqueado/png-generator.js` → `fRenderTemplateLayers` (PNG sem distorção)
- `js/designer/preview.js` → `pvRender` e `pvRenderToBlob`
- `js/designer/canvas.js` → `dSetFormat` (troca de formato no editor)
- `js/designer/templates.js` → migração absoluto→relativo no boot

### Verificação manual

1. Designer: abrir template Story → trocar para Feed → aceitar reflow → título mantém canto, fundo cobre tudo, nada esticado. Ctrl+Z desfaz.
2. Preview (P): alternar Story/Feed/Wide — sem distorção
3. Franqueado: gerar Story e depois Wide — PNG não esmaga

---

## 11. PSD IMPORT — PLANO DE REFINAMENTO

### Onde está (✅ implementado)

- Leitura via ag-psd vendorizado (offline-first) + Web Worker com fallback
- Tela de revisão por camada: Texto editável / Variável `{{}}` / Cor / Imagem fiel
- Texto → variável: convenção `{{nome}}` no nome da camada + heurística (preço/produto/regex `R$`)
- Fidelidade parcial: cor sólida, sombra/contorno (`l.shadow`/`strokeW`), fontSize corrigido por DPI
- Máscaras: layer mask + clipping mask importadas e renderizadas
- Quota: rasters comprimidos (JPEG/PNG + downscale ≤1600px)

### Limitações conhecidas

1. z-order depende de confirmação manual — não validado contra PSD real
2. Fontes não-Roboto caem em Roboto sem remap
3. Texto: 1 estilo por camada (sem runs por trecho); alinhamento aproximado
4. Shapes vetoriais viram raster ou cor-sólida-amostrada
5. Gradientes / blend modes / opacity de fill não mapeados
6. Smart objects / camadas de ajuste / grupos com efeito são achatados/ignorados
7. Clipping em cadeia usa só a camada imediatamente abaixo
8. Máscaras grandes não passam por compressão

### Roadmap priorizado

**Fase A — Corretude (fazer primeiro, é barato):**
- Validar z-order com PSD real + heurística de detecção de "precisa inverter"
- Máscaras na quota (passar `l.mask` pelo `gPackImgUrl`)
- Testes de fumaça (fixtures de PSD + asserts de mapeamento)

**Fase B — Fidelidade visual:**
- Fontes: remap + auto-substituição + upload na hora
- Texto rico (style runs): cor/peso/tamanho por trecho
- Shapes vetoriais do PSD (`vectorMask`/`vectorFill`)
- Gradientes (`gradientFill`/`gradientOverlay` → `l.gradient`)
- Blend modes e opacity de fill

**Fase C — Templatização inteligente:**
- IA de mapeamento (Claude): sugerir variáveis a partir de nomes/conteúdos de camadas
- Biblioteca de convenções (`@telefone`, `@endereco`, `logo_unidade`)
- Detecção de moldura de foto (camada de imagem grande + clipping → `frame`)
- Salvar direto como template em pasta

**Fase D — UX da importação:**
- Preview por camada na tela de revisão
- Agrupar por tipo / busca quando PSD tem dezenas de camadas
- Lembrar escolhas (memória do mapeamento por nome de camada)

**Fase E — Performance:**
- Worker incremental com progresso (%)
- Cap de memória para PSDs gigantes
- Normalização total de DPI

**Pranchetas múltiplas (próximo):** ao importar PSD com vários artboards, cada prancheta vira um template separado dentro da mesma pasta. Estrutura `yngs_artboards_v1` já existe no localStorage.

---

## 12. RISCOS E DÍVIDAS TÉCNICAS

| Risco | Severidade | Custo de correção |
|-------|-----------|------------------|
| **XSS armazenado (H.1)** — dados do usuário entram em `innerHTML` sem escape no chat e catálogo | 🔴 Alto em produção | Baixo — criar `gEsc()` global e aplicar nos pontos críticos |
| **Sem backend (5.1)** — single-device, imagens somem, sem auth, sem multi-tenant | 🔴 Teto do produto | Alto — Supabase + Auth + Storage |
| **Quota do localStorage** — fontes + capas + imagens base64 competem por ~5MB | 🟡 Médio | Só resolve com backend |
| **Sem handler global de erro (H.3)** — throw async morre silencioso | 🟡 Médio | Baixo — `window.addEventListener('error')` + `'unhandledrejection'` |
| **Arquivos grandes** — `canvas.js`/`layers.js`/`templates.js` perto de 1k linhas | 🟡 Médio | Médio — split por subdomínio |
| **Sem testes** — regressão detectada só abrindo o navegador | 🟡 Cresce com o tempo | Médio — smoke tests do interpolador + PNG |

---

## 13. PRÓXIMAS SESSÕES — ORDEM SUGERIDA

1. **Splash screen** → rodar `luma-prompt-splash-screen.md` no Code
2. **Redesign UI do Designer** → rodar `luma-prompt-redesign-designer.md`
3. **XSS (H.1)** → prompt específico para `gEsc()` global (30 min, alto impacto)
4. **Módulo Analytics front** → rodar `luma-prompt-modulo-dados.md`
5. **PSD Fase A** → z-order + máscaras na quota (plano detalhado na Seção 11)
6. **Pranchetas múltiplas** → prompt a gerar (base: `yngs_artboards_v1` já existe)
7. **Backend Supabase (5.1)** → maior entrega, precisa de sessão dedicada de planejamento

---

## 14. REGRAS DE OURO PARA O CLAUDE CODE

1. **Leia este documento antes de qualquer sessão.** Não suponha — consulte.
2. **Patch cirúrgico.** Adicione sem quebrar o que funciona. `f*` e `d*` não podem regredir.
3. **Confirme o plano antes de executar.** Mostre o que vai mudar, peça confirmação.
4. **Teste manual após cada fase.** Não avance sem confirmar que funciona.
5. **Prefixos são sagrados.** `fNextStep` continua `fNextStep`. Nunca renomeie.
6. **Sem dependências.** Nada de npm, yarn, Vite, Webpack. Continua puro.
7. **Sem ES Modules.** Funções globais, `<script src>` sequenciais.
8. **Não faça commit automático.** Mostre `git diff`, peça confirmação, eu rodo.
9. **Se ficou em dúvida, pergunte.** Não chute — o estado global é frágil.
10. **Português brasileiro.** Comunicação direta, sem bullet points excessivos.
