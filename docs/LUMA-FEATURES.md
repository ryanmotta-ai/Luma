# LUMA — Features Implementadas

> Documento gerado em 2026-06-17. Mapeia tudo que foi implementado no projeto desde o commit inicial.
> Organizado por módulo. Commits referenciados no final de cada bloco.

---

## Designer — Ferramentas de Pintura (`js/designer/brush.js` + `canvas.js`)

### Ferramenta Nitidez (Sharpen)
- Implementação de unsharp mask: captura região do canvas, aplica blur 1.5px num canvas temporário, e amplifica a diferença (amount = 1.6) de volta no original.
- Integrada ao pipeline de pintura: `dSyncPaintPointer`, `dPaintStart`, `dPaintMove`, `dPaintEnd`, `dShowBrushBar`.
- Cursor circular dinâmico (mesmo do pincel/borracha) também aplicado para blur, smudge e sharpen.
- Opções de pincel (tamanho, hardness, etc.) expostas para todos os 5 modos: brush, eraser, blur, smudge, sharpen.

### Flyout "Nitidez" (grupo Photoshop-style)
- Botão proxy no toolbar com triângulo de indicação de sub-ferramenta.
- Grupo: **Desfoque** (blur), **Nitidez** (sharpen), **Dedo** (smudge).
- Ícone do proxy atualiza para a última ferramenta usada dentro do grupo.
- Flyout aparece à direita, fecha ao clicar fora (evento de cleanup).
- Estado ativo sincronizado com `dSetTool()` via `dtool-nitidez-proxy`.

### Flyout "Forma" (grupo Photoshop-style)
- Grupo: **Retângulo**, **Elipse**, **Triângulo**, **Polígono**, **Linha**, **Estrela**.
- Linha dispara `dAddLine()`, Retângulo chama `dSetTool('rect')`, demais usam `dAddShapeKind(kind)`.
- Ícone do proxy sincronizado; estado ativo propagado pelo `dSetTool()`.

> Commits: `21d7a45` (Melhorias) — `js/designer/brush.js`, `canvas.js`, `css/modules/toolbar.css`, `index.html`

---

## Designer — Canvas e Zoom (`js/designer/canvas.js`)

### Zoom suave com transição CSS
- `dFitToScreen()` aplica transição `cubic-bezier(0.25, 0.46, 0.45, 0.94)` de 200ms no container e frame.
- Após 220ms a transição é removida para não atrasar o drag de elements.
- Scroll reposicionado suavemente (`behavior: 'smooth'`) para manter o ponto da prancheta sob a âncora de zoom.

### Redimensionamento de Prancheta (AB Resize)
- Throttle via `requestAnimationFrame` — evita jank em monitores de alta frequência.
- Container ganha classe `.resizing-artboard` durante a operação.
- **Background sync em tempo real**: durante o resize, a shape de Fundo (layer `name==='Fundo'`, `x===0, y===0`) tem `w`/`h` atualizados no DOM diretamente — sem re-render completo — evitando expor fundo preto.
- Réguas re-renderizadas (`dRenderRulers`) a cada frame do resize.

> Commits: `21d7a45` — `js/designer/canvas.js`

---

## Designer — Layers e Seleção (`js/designer/layers.js`)

### Seleção de Grupo com Multi-sel automático
- Ao selecionar um layer do tipo `group`, `dSelLayer` preenche `dMultiSel` com os IDs de todos os filhos do grupo.
- Ao selecionar layer não-grupo, `dMultiSel` é limpo.

### Resize Handles 8-posições
- `dResizePos` registra qual handle (tl, tr, bl, br) foi acionado.
- **Shift**: resize proporcional — projeção do drag sobre a diagonal calcula fator de escala uniforme.
- **Alt**: resize do centro — largura/altura são dobradas e o layer é reposicionado para manter o centro.
- **Alt+Shift**: combinação proporcional + do centro.
- Tamanho mínimo: 20×10px.

### Auto-switch de Painel ao Selecionar Layer *(sessão atual)*
- `dSelLayer` e `dSelLayerState` chamam `dActivatePanel('camada')` após `dShowProps(l)`.
- Ao clicar em qualquer layer, o painel de Propriedades vem à frente automaticamente.
- `dShowProps` envolvido em try/catch — erro não impede a seleção.

> Commits: `21d7a45` + working directory (não commitado)

---

## Designer — Edição Inline de Texto (`js/designer/library.js`)

### Fix: Variável inserida via painel não some mais
- **Causa raiz**: `dRenderCanvas()` faz `frame.innerHTML=''`, removendo o `<textarea>` de edição inline do DOM sem limpar `dInlineEl`/`dInlineLayer`. O editor "fantasma" (ainda referenciado) disparava `dEndInlineEdit` com valor stale, sobrescrevendo a var recém-inserida.
- **Fix**: `dEndInlineEdit` verifica `dInlineEl.isConnected === false` — se o textarea foi removido pelo render, descarta o valor e não sobrescreve `l.content`.
- `dInsertVar` agora foca o campo `dp-content` e posiciona o caret após o token inserido.

> Working directory (não commitado) — `js/designer/library.js`, `js/designer/layers.js`

---

## Designer — Novo Arquivo (`js/designer/templates.js` + `index.html`)

### Modal "Novo arquivo" com dimensões e DPI personalizados
- Botão na topbar (ícone de documento novo, antes dos formatos).
- **Presets**: Story (9:16), Feed (1:1), Wide (16:9) — preenchem W/H ao clicar.
- **Campos**: Largura × Altura, unidade (px / pol / cm), botão ⇄ para trocar orientação.
- **DPI**: campo numérico, padrão 72. Conversão automática para px: `pol × DPI`, `cm × DPI / 2.54`.
- **Preview ao vivo**: label "X × Y px" atualizado a cada mudança de input.
- **Fundo**: Branco (shape #FFFFFF), Transparente (sem layer), Cor… (color picker inline).
- **Validação**: clamp 16–8000px por dimensão.
- `dNewArtboardCustom(w, h, bg, dpi, fmt)` cria a prancheta com dimensões explícitas; aproveita o motor existente (`dApplyFormat`, `dFitToScreen`) sem alterar o pipeline de render.

> Working directory (não commitado) — `js/designer/templates.js`, `index.html`

---

## Designer — Painel Lateral (`index.html`)

### Remoção da aba "Publicar" do painel lateral
- Botão da aba `data-panel="publicar"` removido da tira Conteúdo/Propriedades.
- Publicação continua acessível pelo botão da topbar (`dPublishOpen()`) e Ctrl+S.

> Working directory (não commitado) — `index.html`

---

## Designer — Import PSD (`js/designer/psd-import.js`)

### Downscale de Máscaras
- Antes de serializar máscaras para localStorage, escala o canvas para um máximo configurável.
- Evita que máscaras de alta resolução excedam a quota do localStorage.

### Remapeamento de Fontes PSD → Luma
- `_dPsdRemapFont(fontName)`: normaliza ambos (lowercase, só alfanum) e faz correspondência exata ou por prefixo.
- Retorna `'custom:Family'` — formato do seletor de fontes do Luma.

### Acumulação de Opacidade de Grupos-pai
- Walk recursivo nos nós do PSD acumula `parentOp` multiplicada a cada nível.
- Grupos invisíveis propagam `parentHidden=true` para filhos.

### Heurística de Z-Order
- `_dPsdShouldInvert`: detecta se o array de layers precisa ser invertido.
- ag-psd entrega filhos topo-primeiro; Luma quer o fundo visual em `dLayers[0]`.
- Usa nomes canônicos (`background`, `fundo`, `bg`, `base`, `backdrop`) e área para decidir.

### Upload de Fonte na Tela de Revisão
- `dPsdUploadFont(layerIdx, input)`: registra a fonte no sistema (`dFontRegister`, `dFontsPersist`, `dFontsRenderList`, `dPopFontSelects`) e remapeia automaticamente todas as camadas do PSD que usam o mesmo `fontName`.

> Commits: `f0b2240` (Edits no módulo de import do psd) + `a54a10d` (pacote de melhorias no psd import)

---

## Designer — Import SVG (`js/designer/templates.js`)

### Parser SVG Completo com Transformações Afins
- Multiplicação de matrizes afins 2D: `_dSvgMultiplyMatrices`, `_dSvgParseTransform`.
- AABB (axis-aligned bounding box) após aplicação de matrix: `_dSvgApplyMatrixToBBox`.
- Pilha de transformações acumulada recursivamente (DFS).

### Elementos Suportados
- `<text>` / `<tspan>`: concatena tspans, calcula tamanho/baseline transformados.
- `<rect>`: retângulos com rx/ry.
- `<circle>` / `<ellipse>`: preserva propriedades nativas.
- `<image>`: imagens embutidas base64.
- `<path>`: caminhos vetoriais (abertos e fechados), bounding box aproximado.

### CSS Priority Resolution
- `_dSvgProp`: inline style > classe CSS > atributo > herança do pai.
- `_dSvgParseStyles`: extrai seletores de `<style>` do documento SVG.

### Mapeamento de Fontes Illustrator
- `dSvgMapFont`: dicionário estático de fontes do Illustrator + lookup nas fontes custom do Luma.

> Commit: `a54a10d` — `js/designer/templates.js`

---

## Publicação (`js/designer/publish.js`)

### Tela de Sucesso Animada
- Após publicação bem-sucedida, o conteúdo do modal é substituído por uma tela de celebração.
- Checkmark SVG animado (círculo desenhado + traço do check via CSS stroke-dashoffset).
- Mensagem com contagem correta de pranchetas (singular/plural).
- Botão "Entendido" chama `dPublishClose()` e restaura o HTML original do modal.
- Indicador de save na topbar atualiza para "Publicado" com ícone de check.

> Commit: `21d7a45` — `js/designer/publish.js`

---

## Franqueado — Chat (`js/franqueado/chat.js`)

### Bulk Generation CSV
- Botão "Gerar vários (CSV)" exibido na tela de confirmação quando o material tem layers.
- Chama `fBulkOpen()`.

### Edição Inline de Resposta com Highlight
- Ao editar uma resposta específica (`idx`), o card de confirmação entra em `editing-mode`.
- A linha editada recebe `.row-highlight`, as demais `.row-dimmed` — sem remover o card.

### Navegação com Botão "Voltar"
- Botão "Voltar uma pergunta" com ícone de seta circular, chama `fGoBack()`.

> Commit: `21d7a45` — `js/franqueado/chat.js`

---

## Franqueado — Live Preview Mobile (`js/franqueado/live-preview.js`)

### Botão Flutuante de Preview
- `fInitMobilePreviewEvents()`: cria e anexa botão `#mobile-preview-toggle` ao `document.body`.
- Ícone de olho SVG; ao clicar, togla classe `.open` no `#f-live-preview`.
- Clique fora do preview fecha automaticamente (delegação de evento).

> Commit: `21d7a45` — `js/franqueado/live-preview.js`

---

## Dados — Comparador (`js/dados/comparador.js`)

### Crosshair Dinâmico no Gráfico
- `pCmpHover`: move linha vertical (`#p-cmp-crosshair`) e dois círculos de hover (`.p-hover-dot-cmp`) para o ponto exato do cursor.
- `pCmpLeave`: remove classe `.visible` de todos os elementos de hover ao sair da área.

### Linha Expandível nas Tabelas (Accordion)
- Cada row pode expandir exibindo um painel de detalhe (`pExpandPanel`).
- Fechamento automático da linha anteriormente expandida antes de abrir a nova.

### Light Theme
- `body.classList.toggle('p-light-theme', t === 'light')` — alcança tooltips órfãos que não estão dentro do container principal.

> Commit: `21d7a45` — `js/dados/comparador.js`

---

## CSS / Design System

### Flyout Toolbar (`css/modules/toolbar.css`)
- `.vt-group-wrap`, `.vt-sub-arrow` (triângulo indicador de sub-ferramentas).
- `.vt-flyout` posicionado à direita do botão, z-index 600, com sombra e border-radius.
- `.vt-flyout-item` com hover/active states (laranja DM para ativo).

### Tokens, Animações, Efeitos
- Commit `21d7a45` adicionou novos tokens em `css/00-tokens.css`, animações em `css/02-animations.css`, estilos de efeitos do franqueado em `css/modules/franqueado_effects.css`, e refinamentos nos módulos `dados.css`, `designer.css`, `layers-panel.css`, `topbar.css`.

---

## Fluxo de Commits

| Hash | Mensagem | Escopo Principal |
|------|----------|-----------------|
| `f9252a7` | Initial commit | Base do projeto (todos os arquivos) |
| `936c6d3` | files | Assets, vendor, CSS base, docs |
| `f0b2240` | Edits no módulo de import do psd | PSD import usabilidade |
| `a54a10d` | pacote de melhorias no psd import | PSD + SVG import |
| `21d7a45` | Melhorias | Designer, franqueado, dados (26 arquivos) |
| *(WD)* | *(não commitado)* | Auto-switch, fix var, novo arquivo, remove aba publicar |
