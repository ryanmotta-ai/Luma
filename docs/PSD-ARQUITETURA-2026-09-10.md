# PSD Import — arquitetura encontrada, problemas e a fronteira adotada

Data: 10/09/2026. Base auditada: `talpaipai` + esta rodada. Leitura integral dos dois arquivos do
subsistema e de **toda** função externa chamada durante o import (a cadeia está na §1).

Este documento continua o `docs/ESTUDO-PSD-FIDELIDADE-ROADMAP-2026-09-05.md`, que atacou seis
tickets táticos (selo honesto, dedupe por identidade, escala nativa, alpha exato, paridade de
render, promessa de export). **Aquele estudo não mexeu na arquitetura.** Este mexe: nomeia as
etapas do pipeline e move a primeira responsabilidade — a decisão de fidelidade — para uma
fronteira única.

---

## 1. Arquitetura encontrada

### Os dois arquivos do subsistema

| Arquivo | Linhas | Funções | Responsabilidade declarada | Responsabilidade real |
|---|---:|---:|---|---|
| `js/designer/psd-parse.js` | 2.138 | 75 | "leitura e fidelidade" | decode + normalização + geometria + capacidade + dependências + conversão + **semântica de campo** |
| `js/designer/psd-import.js` | 1.734 | 100 | "revisão e importação" | UI de revisão + multi-prancheta + memória + IA + selo de fidelidade + criação de prancheta/template + **estado do motor** |

O split (feito quando o arquivo único passou de 2.400 linhas) é por *tela × não-tela*, não por
etapa do pipeline. Por isso as duas metades trocam estado nos dois sentidos — ver §3, problema A6.

### As funções que concentram responsabilidade

| Função | Linhas | O que faz |
|---|---:|---|
| `dPsdParseItems` | **457** | o walk recursivo. Doze responsabilidades numa função (lista em §3, A8) |
| `dPsdRenderRows` | 155 | monta a lista de camadas e **25 selos** de estado inline |
| `_dPsdEffects` | 148 | dez efeitos do Photoshop → props do Luma, mais a pilha múltipla |
| `_dPsdSuggestVar` | 109 | cinco camadas de palpite de campo (quatro desligadas em 03/09, o código ficou) |
| `_dPsdIsFlippedLayer` | 108 | espelho/180° em texto e forma (o corpo real é ~20 linhas; o resto é `_dPsdNeedsRaster` colado) |
| `dItemToLayer` | 85 | item → camada do Luma, seis ramos de retorno |
| `dImportPSD` | 85 | handler do input: guards, worker, três caminhos de prancheta |

### A cadeia externa — tudo que é chamado durante um import

Lida integralmente nas partes que o import toca:

| Arquivo | Linhas | O que o PSD Import usa |
|---|---:|---|
| `js/00-config.js` | 3.320 | `gFieldInfer` · `gFieldFitCheck` · `gFieldCanonicalDefinition` · `gFieldLabel` · `gFieldTypeMeta` · `gFxRgba` · `gFxOffset` · `gVectorPath{Valid,FillRule,D}` · `gTraceVectorPath` · `gGradient{Css,Canvas}` · `gRoundPolyPath2D` · `gVarRegex` · `gPackImgUrl`/`gPackMask` |
| `js/franqueado/png-generator.js` | 4.652 | `fRenderPreviewToCanvas` → `fRenderTemplateLayers` → `fRenderOneLayer` — **o consumidor do modelo de saída**, e o único render que compõe grupo/clipping/ajuste |
| `js/designer/templates.js` | 3.388 | `DFMT_SIZES` · `dVars` · `dFolders` · `dArtboards` · `dActiveABId` · `dCustomFmt` · `dLayers` · `dSyncLayersToAB` · `dPersistFolders` · `dLoadTemplate` · `dDefaultPublishMeta` |
| `js/designer/layers.js` | 4.498 | `dSyncVarsFromContent` · `dRenderLayersList` |
| `js/designer/canvas.js` | 2.507 | `dRenderCanvas` (o DOM do editor) · `dApplyFormat` · `dRenderWorkspace` · `dFitToScreen` |
| `js/core/auto-layout.js` | 956 | `gStampLayoutBaseline` · `gCompileLayoutRoles` (o compilador semântico roda **no import**) |
| `js/designer/blending.js` | 619 | `DBLEND_PSD_MAP` · `dBlendToComposite` · `dBlendImageData` |
| `js/designer/preview.js` | 1.118 | `pvRenderViaMotor` (o Estúdio entra no motor único desde 05/09) |
| `js/designer/fonts.js` | 234 | `dBuiltinFonts` · `dCustomFonts` · `dFontRegister` · `dFontUniqueFamily` · `dFontsPersist` |
| `js/core/ai.js` | 186 | `gAskAI` · `gAiParseJson` · `gAiReady` (o "Mapear com IA") |
| `js/core/img-store.js` | 125 | `gIdbPut` via `gPackImgUrl` — o `idb://` que tira o raster do localStorage |
| `js/core/layout.js` | **95** | `gEnsureAnchors` · `gReflowLayers` · `gFmtKey` — **o único lugar onde coordenadas convertem** |
| `assets/vendor/ag-psd.js` | 23.468 | o decoder |
| `tests/psd-import-cases.js` | 312 | 24 casos, portão de CI |

**Total sob a mão do import: ~3.900 linhas próprias + ~21.700 linhas de cadeia + 23.500 do decoder.**

### Estado global que o PSD Import muta

| Estado | Declarado em | Mutado por |
|---|---|---|
| `dPsdItems` · `dPsdMeta` | `psd-import.js` | as duas metades |
| `_dPsdAdjustCount` | `psd-import.js` | **`psd-parse.js`** (escrita cruzada) |
| `_dPsdErrorCount` | `psd-parse.js` | `psd-parse.js`, lido por `psd-import.js` |
| `_dPsdGlobalLight` | `psd-parse.js` | **`psd-import.js`** (`dImportPSD`, escrita cruzada) |
| `_dPsdBoards` · `_dPsdBoardIdx` · `_dPsdDocCanvas` · `_dPsdDocRes` · `_dPsdBaseName` | `psd-import.js` | `psd-import.js` |
| `_dPsdCancelled` · `_dPsdActiveWorker` · `_agPsdPromise` · `_dPsdYieldChan` | `psd-parse.js` | as duas metades |
| `dArtboards` · `dActiveABId` · `dCustomFmt` · `dLayers` · `dFmt` · `dSelId` · `dMultiSel` | `templates.js` | `dImportLayersAsArtboard` **substitui** os sete |
| `dVars` · `dFolders` · `dCustomFonts` | `templates.js`/`fonts.js` | `_dPsdSyncVarsFromLayers` · `dPsdSaveArtboardTemplates` · `dPsdUploadFont` |
| `localStorage['yngs_psd_mem_v2']` | — | `_dPsdMemSave` |

---

## 2. O pipeline real (descoberto, não presumido)

```
 .psd / .psb            dImportPSD (psd-import.js)
      │                 guards: extensão · 500 MB
      ▼
 dLoadAgPsd             vendor local → fallback CDN (sem versão fixada)
      ▼
 file.arrayBuffer()
      ▼
 _dPsdReadPsd ─────► Web Worker (fonte é uma STRING, _DPSD_WORKER_SRC)
      │                 · OffscreenCanvas registrado (sem isto o worker sempre morria)
      │                 · ag-psd.readPsd(useImageData:true)
      │                 · strip() = lista branca _DPSD_NODE_FIELDS (viaja por postMessage)
      │                 · transfere os ArrayBuffer de imagem/máscara
      │                 · prazo ~1s/MB, renovado a cada sinal de progresso
      │                 ▼
      │            _dPsdRebuildTree   main thread, fatiado por TEMPO (16 ms), cede via
      │                               MessageChannel; 1 canvas + putImageData por camada
      └─ fallback: readPsd no main thread (bloqueia; indisponível acima de 150 MB porque o
                   buffer foi transferido, não copiado)
      ▼
 {psd:{width,height,children,canvas,imageResources}, res, worker}
      ▼
 _dPsdGlobalLight ← ângulo da luz global do DOCUMENTO (fixado antes de qualquer parse)
      ▼
 ┌───────────────────────── três caminhos de prancheta ─────────────────────────┐
 │ artboards > 1  → _dPsdBuildBoards → _dPsdBoardsPrepRefs → _dPsdBoardLoad(b0) │
 │                  (parse LAZY por prancheta; solta b.layer depois do parse)    │
 │ artboards == 1 → dPsdParseItems({children:ab.children,w,h}, res, ab.l, ab.t)  │
 │ artboards == 0 → dPsdParseItems(psd, res)                    ox = oy = 0      │
 └──────────────────────────────────────────────────────────────────────────────┘
      ▼
 dPsdParseItems  ── UM walk recursivo, 457 linhas ──────────────────────────────
      │  por nó, nesta ordem:
      │   contagem de ajuste → acumula opacity → acumula hidden
      │   ├─ nó com filhos:  artboard? recursa transparente
      │   │                  senão sintetiza o GRUPO (isolation/opacity/blend/efeitos),
      │   │                  recursa, deriva a bbox dos FILHOS, projeta a máscara do grupo
      │   ├─ nó de ajuste:   caixa integral do contexto + tipo/suporte/aproximação
      │   └─ folha:          it{x,y,w,h,opacity,blend,group,_groupChain,_groupMasks,fillOpacity}
      │        ├─ vectorMask → canvas alpha (ou marca falha)
      │        ├─ CAPACIDADE parte 1 (decode) → raster fiel? → efeitos → push, RETURN
      │        ├─ ramo TEXTO   (~90 linhas: fonte, corpo, cor, alinhamento, entrelinha,
      │        │                tracking, runs, caps, faux, gradiente, efeitos, caixa)
      │        ├─ ramo FORMA   (gradiente | cor sólida | traçado → forma editável)
      │        ├─ ramo RASTER  (dataURL + inkBox + sugestão de moldura)
      │        └─ CAPACIDADE parte 2 → raster fiel por combinação não representável
      │  catch por CAMADA → _dPsdParseFail (recupera o pixel composto)
      │
      ├─ dedupe por IDENTIDADE do nó (nunca por aparência — regressão de 05/09)
      ├─ dependências: _clipBaseIndex (busca PARA TRÁS, mesmo grupo) + _dPsdComputeMask
      │                (multiplica camada × clipping × vetorial × máscaras dos grupos-pai)
      ├─ dependências: fallback do clipping (reconstrói o alpha da base)
      ├─ solta _psdNode  (o que pesa: um canvas por camada)
      ├─ out.reverse()   ← Photoshop topo-primeiro → a lista da REVISÃO parece o painel do PS
      └─ carimba _defaultMode
      ▼
 dPsdItems — o array de "itens". É o PSD IR de fato: ~70 campos, sem contrato escrito
      ▼
 _dPsdMemApply — a memória do localStorage sobrescreve mode/varName
      ▼
 REVISÃO (dPsdOpenReview → _dPsdApplyBoardToUI → dPsdRenderRows)
      │  abas de prancheta (parse lazy) · modo por camada · seletor de campo · trilha de campos
      │  arrastar/clicar/teclado · "Mapear com IA" · upload de fonte · inverter ordem · formato
      │  prévia: _dPsdItemsToPreviewLayers → fRenderPreviewToCanvas → _dPsdFidelity → selo
      ▼
 dPsdConfirmImport
      ├─ multi:  _dPsdCollectBoards → dPsdItemsToLayers → dPsdSaveArtboardTemplates
      │                                                   → _dPsdReflowToFmt
      └─ única:  dPsdItemsToLayers → dImportLayersAsArtboard
      ▼
 dPsdItemsToLayers → dItemToLayer por item + marcadores de grupo + gCompileLayoutRoles
      ▼
 dLayers / template.layers — o modelo canônico do Luma
      ▼
 dRenderCanvas (DOM) · fRenderTemplateLayers (Canvas) · dSvg* (SVG)
```

### Os quatro espaços de coordenadas (implícitos)

```
 PSD DOC SPACE      node.left/top/right/bottom · mask.left/top · vectorMask.knots (px absolutos)
      │             vectorOrigination.keyOriginShapeBoundingBox · text.transform[4],[5]
      │  − ox,−oy   subtraído em: it.x/y (walk) · _dPsdVectorShapeBox · _dPsdParagraphBox
      ▼             · nó sintético do ajuste · _dPsdParseFail
 ARTBOARD SPACE     it.x/y/w/h · gd.x/y/w/h (derivado dos filhos)
      │  + ox,+oy   ⚠ RE-SOMADO à mão em UM ponto: a máscara do grupo
      │             (`_dPsdMaskToBox(node.mask,{x:x0+ox,y:y0+oy,…})`), porque todas as funções
      │             de máscara consomem fontes em DOC SPACE via `_dPsdBox(node)`
      ▼
 LUMA SPACE         gEnsureAnchors + gReflowLayers — só quando um preset é escolhido;
                    em 'orig' as coordenadas de prancheta JÁ são as do Luma
```

---

## 3. Problemas arquiteturais, por impacto

### A1 · Não existe PSD IR — o "item" é IR, modelo de UI e entrada de conversão ao mesmo tempo

Um `it` carrega ~70 campos de cinco naturezas misturadas: fatos de decode (`x,y,w,h,content`),
vereditos de capacidade (`needsRaster`, `gradientUnsupported`, `_fxOverflow`, `textOnPath`,
`flipped`, `maskFallback`, `strokeApprox`, `fxSatin`, …), decisões de conversão (`kind`, `mode`),
semântica de campo (`varName`, `varSource`, `_fieldInference`), estado de tela (`include`) e o
grafo transitório (`_psdNode`, `_groupChain`, `_groupMasks`, `_vecMaskCanvas`, `clipBaseId`).

**Consequência:** era impossível responder a pergunta central — *o dado veio errado do decoder,
ou nós interpretamos errado, ou a conversão perdeu, ou o Luma não suporta?* Não havia fronteira
onde olhar. **Atacado nesta rodada** (§6).

### A2 · A decisão de fidelidade estava em seis lugares

`_dPsdNeedsRaster` (nó cru) · o bloco `_fxUnsup` no fim do walk · `dItemToLayer`
(fillOpacity+efeitos — **a mesma regra do `_fxUnsup`, escrita de novo**) · `_dPsdAdjustmentInfo` ·
`_dPsdGradStyle` · `_dPsdEffects`. A revisão remontava o veredito a partir de **doze campos
soltos**. Pior: `dItemToLayer` **mutava** `it.needsRaster` durante a conversão — e a prévia da
revisão chama `dItemToLayer`, então *ver a prévia alterava o estado que o import leria depois*.
**Atacado nesta rodada** (§6).

### A3 · Efeito de camada desaparece em silêncio quando a camada sai como imagem — P1

`_dPsdApplyFx` copia `shadow`/`glow`/`strokeW`/`overlay`/`gradientOverlay`/`layerEffects`/
`bevel`/`innerShadow`/`innerGlow` para camadas que `dItemToLayer` entrega como `type:'image'` ou
`type:'frame'` (os ramos `needsRaster`, `frame` e o fallback). **Nenhum** dos renderizadores lê
efeito nesses tipos:

| Caminho | Onde | Lê efeito em image/frame? |
|---|---|---|
| Canvas (o motor) | `png-generator.js:1132`–`1245` | **não** |
| DOM do editor | `canvas.js:1362` (frame) e `:1479` (image) | **não** |
| SVG | `preview.js` `dSvg*` | só em forma/texto |

O caso mais comum de PSD real cai exatamente aqui: **objeto inteligente com sombra projetada
perde a sombra**, e **todo texto que virou imagem fiel POR CAUSA de um efeito perde justamente
esse efeito**. O dado era gravado e ninguém o consumia. Era a §5.3 do estudo de 05/09, ainda
aberta. **Nesta rodada a perda passou a ser declarada** (§6); *consumir* efeito em imagem nos
três renderizadores é a próxima área (§9, N1).

### A4 · `gReflowLayers` não escala as propriedades que o PSD produz — P1

`js/core/layout.js` é o único lugar onde coordenadas convertem (correto), mas escala só
`fontSize`, `radius` e `strokeW`. Ficam de fora, em px absolutos:

`letterSpacing` (o tracking do PSD) · `radii` (cantos por canto) · `shadowBlur`/`shadowDist`/
`shadowSpread` · `glowSize`/`glowSpread` · `innerShadow*`/`innerGlow*` · `bevelSize` ·
`strokeDash[]` · `layerEffects[].blur|distance|spread|width` · `clipBaseSnapshot{x,y,w,h}`.

**Efeito:** todo PSD importado num preset (Story/Feed/Wide — o caminho comum) sai com tracking,
cantos e sombras na escala errada. E o `clipBaseSnapshot` deixa de casar com a base reflowada, o
que faz o motor descartar o alpha antialiasado que o próprio Photoshop gravou e recair no vínculo
vivo em **todo** primeiro render. Que `strokeW` e `radius` já escalem mostra que a omissão é lacuna,
não decisão.

**Não corrigido nesta rodada, de propósito:** `gReflowLayers` é compartilhado com o franqueado e
com arte que não vem de PSD. Escalar sombra e tracking muda o resultado de templates já
publicados — é mudança de comportamento fora do PSD Import, o que o briefing proíbe (§46).
Patch pronto e justificativa em §9, N2.

### A5 · Modo de render e significado de campo são o mesmo enum

`it.mode` ∈ {`text`,`shape`,`raster`,`adjustment`} ∪ {`var`,`frame`}. Escolher um campo **troca o
tipo de render**: `var` implica texto, `frame` implica moldura. Daí `dPsdUnbindField` ter de
*adivinhar* o modo de volta a partir de `_defaultMode`, e daí `_dPsdSuggestImgVar` — que decide
significado — poder transformar uma **forma de cor sólida em moldura de foto durante o parse**,
apagando o fill. É exatamente o acoplamento que o briefing §24/§39 manda cortar: *"uma falha de
field mapping nunca deve alterar a fidelidade visual do import"*. Hoje altera.

### A6 · O motor chama a tela; a tela é dona do estado do motor

`psd-parse.js` chama `_dPsdBusyUpdate()` (definida em `psd-import.js`) em três pontos.
`_dPsdAdjustCount` é declarado na tela e **escrito pelo motor**. `_dPsdGlobalLight` é declarado no
motor e **escrito pela tela**. E `_dPsdSuggestVar` → `gFieldInfer` → `dVars`: o parse visual
consulta o catálogo do editor.

### A7 · Z-order passa por três inversões e uma heurística

`out.reverse()` no parser (para a lista parecer o painel do Photoshop — uma preocupação de tela
dentro do motor) → `_dPsdShouldInvert` (heurística de fundo por nome/cobertura) → checkbox do
usuário → `chosen.slice().reverse()` no import. O hit-test da arte (`_dPsdHitLayer`) precisa
conhecer o checkbox para não pegar a camada de baixo.

### A8 · `dPsdParseItems`: 457 linhas, doze responsabilidades

percorrer a árvore · acumular opacidade/visibilidade · sintetizar grupos · derivar bbox de grupo ·
projetar máscara de grupo · interpretar texto · interpretar forma · interpretar raster · decidir
capacidade · sugerir campo · resolver clipping · inverter z-order.

### A9 · Geometria recalculada com a caixa errada

No ramo de forma: `_dPsdVectorShapeKind(node,w,h)` e `_dPsdCornerRadii(node,w,h)` recebem o `w,h`
das **bounds do nó** (que incluem a expansão do traço), mas `Object.assign(it,vectorBox)` troca
`x/y/w/h` depois pela caixa do **caminho**. O clamp de raio `min(w,h)/2` usa a caixa errada.

### A10 · Código morto e conceito vestigial

* `dPsdAbSelectPreview` (30 linhas) — os quatro IDs de DOM que ela usa (`d-psd-ab-preview-canvas`,
  `d-psd-ab-overlay`, `d-psd-ab-preview-label`, `.psd-ab-row`) **não existem mais no
  `index.html`**: são o resto do fluxo de duas telas que virou abas. Morta.
* `isMaskBase` — **lido em 15 lugares, nunca escrito**. Conceito vestigial ("camada base de
  recorte, oculta da lista"). Inofensivo, mas é uma condição que nunca é verdadeira.
* `_dPsdNeedsRaster`, ramo `node.adjustment` — inalcançável pelo walk: o ramo de ajuste dá
  `return` antes. Mantido porque a função também é a probe pública do conceito.

Nada disso foi removido: entender por que existe vem antes, e remover 15 leituras de
`isMaskBase` é diff grande com ganho zero de fidelidade.

---

## 4. Classes de falha — como classificar "o PSD importou errado"

| Etapa | A pergunta | Sintomas que caem aqui | Onde se decide hoje |
|---|---|---|---|
| **DECODE** | o ag-psd entregou isso? | camada sumida, 16/32 bits, CMYK, objeto inteligente sem conteúdo | `_dPsdReadPsd` · worker · `_dPsdCapNode` |
| **NORMALIZAÇÃO** | interpretamos o campo certo? | entrelinha absurda, tracking, tamanho de fonte, blend de 2 palavras | `_dPsdFontSize` · `_dPsdAlign` · `_dPsdBlendMode` |
| **GEOMETRIA** | a caixa e o offset estão certos? | texto deslocado, fragmentos de preço empilhados, prancheta com camada de fora | `_dPsdParagraphBox` · `ox/oy` · `_dPsdVectorShapeBox` · `gReflowLayers` |
| **DEPENDÊNCIAS** | a relação entre camadas sobreviveu? | clipping virou crop, foto desapareceu, máscara de grupo não incidiu | `_clipBaseIndex` · `_dPsdComputeMask` · `_groupChain` |
| **CAPACIDADE** | o Luma representa isso? | efeito sumido, gradiente cônico virou faixa, cetim, relevo | **`_dPsdCapNode` + `_dPsdCapItem`** (era: seis lugares) |
| **CONVERSÃO** | o modelo de saída recebeu tudo? | efeito em imagem, runs perdidos em campo, fillOpacity | `dItemToLayer` · `_dPsdApplyFx` |
| **FIDELIDADE** | o render consome o que gravamos? | **A3** · paridade Estúdio × franqueado | `fRenderOneLayer` · `dRenderCanvas` · `dSvg*` |
| **CAMPOS** | o significado está certo? | fundo virou foto do produto, rodapé virou preço | `gFieldInfer` · `_dPsdSuggestImgVar` · IA · memória |
| **UI** | a revisão diz a verdade? | selo, avisos, contadores, z-order | `dPsdRenderRows` · `_dPsdFidelity` |

---

## 5. Inteligência existente — preservada integralmente

Nada abaixo foi tocado. É conhecimento acumulado em bugs reais e vale mais que a simplificação:

* **Worker + rebuild fatiado por tempo** — `OffscreenCanvas` no worker (sem ele o offload *nunca*
  acontecia), lista branca de campos que viaja por `postMessage` (era escrita duas vezes e as
  duas divergiram: `smartObject` faltava no worker), fatia por **tempo** e não por contagem,
  `MessageChannel` em vez de `setTimeout` (aba sem foco: teto de ~1s por yield), prazo ~1s/MB
  renovado por progresso, transferência sem cópia acima de 150 MB, cancelamento com `terminate`.
* **Memória** — `_dPsdBoardLoad` solta `b.layer` depois do parse (um canvas por camada é o que
  pesa de verdade); `_dPsdBoardsPrepRefs` recorta as referências e solta o composto do documento;
  `_psdNode` é liberado no fim do parse; raster grande vai para o IndexedDB via `idb://`.
* **Multi-prancheta como abas** com parse lazy e decisões preservadas por prancheta.
* **Referência visual** — o composto do próprio Photoshop, recortado por prancheta, e o selo que
  se declara "Não verificado" quando não há o que comparar.
* **Resolução de fontes** — remap por família exata e por prefixo, variantes Roboto preservadas,
  upload de fonte na própria revisão que remapeia camadas **e runs**.
* **Geometria de texto** — o *score* de caixa de parágrafo (candidatos × transform, tolerância por
  âncora e corpo) que recupera a caixa real e rejeita o `boxBounds` velho compartilhado por
  fragmentos de preço; o fallback honesto para semântica de point text.
* **Dependências** — busca da base de clipping **para trás** e limitada ao grupo; máscaras
  multiplicadas em vez de sobrescritas; resolução adaptativa; `clipBaseId` vivo com
  `clipBaseSnapshot` como fallback de precisão.
* **Capacidade preservada** — `vectorPath` Bézier normalizado, `radii` por canto, pilha de efeitos
  em ordem, ajustes de cor como camada dinâmica, `inkBox` do assunto, `fillOpacity`, luz global.
* **Campos** — o import **não adivinha** desde 03/09 (só `{{campo}}`/`@campo` explícito);
  memória por nome com bloqueio de nomes genéricos; IA que **propõe** e nunca aplica, com as
  mesmas guardas do arrasto; `gFieldFitCheck` como regra única de compatibilidade.
* **Robustez** — `try/catch` por camada com recuperação do pixel, dedupe por identidade de nó,
  PSD achatado importável, `.psb` aceito, teto de 500 MB com mensagem que diz o que fazer.

---

## 6. A fronteira adotada nesta rodada — o estágio de capacidade

Uma etapa, um dono, um vocabulário. `js/designer/psd-parse.js`:

```
 nó cru do ag-psd
      ▼
 _dPsdCapNode(node)        ETAPA DECODE       obriga raster fiel? (objeto inteligente, padrão,
      │                                       rotação, espelho, warp, texto em curva)
      │  abre o livro-caixa da camada  →  it.capability
      ▼
 (ramos de texto / forma / raster — inalterados)
      ▼
 _dPsdCapItem(it)          ETAPA CAPACIDADE   o que interpretamos é representável?
      │                                       7 condições de raster + 15 perdas conhecidas
      ▼
 aplicação                 pega o pixel (só aqui se sabe se há node.canvas e qual o teto)
      ▼
 _dPsdCapPerdeFx(it)       ETAPA CONVERSÃO    o modo escolhido descarta os efeitos?
```

**Níveis** (o vocabulário do briefing §14): `native` · `native_lossy` · `raster` · `unsupported`.

**Motivos**: 31 códigos fechados, cada um com `nivel`, `etapa` e rótulo PT-BR. Um motivo é
`{code, nivel, etapa, rotulo, detalhe}` — machine-readable *e* legível pelo designer.

O que isso muda na prática:

1. **A decisão tem um dono.** A regra `fillOpacity + efeitos → não representável` existia duas
   vezes; agora existe uma. Adicionar uma capacidade nova é editar `_DPSD_CAP_MOTIVOS` e uma
   linha em `_dPsdCapItem`, não caçar seis lugares.
2. **A conversão parou de decidir.** `dItemToLayer` não muta mais `it.needsRaster`; ele *lê* o
   veredito. A prévia da revisão deixou de alterar o estado que o import lê depois.
3. **`unsupported` passou a existir.** Pedir raster fiel sem haver pixel se confundia com
   `native` (o bloco todo estava dentro do `if(canvas)` e nada era registrado). Agora é um nível.
4. **O objeto inteligente entrou no estágio.** O ramo de raster fiel dá `return` antes do fim do
   walk — a camada mais comum do problema (objeto inteligente **com** sombra) passava sem
   nenhum registro de capacidade.
5. **Duas perdas mudas ganharam aviso** na revisão, derivado do livro-caixa:
   * *"Efeitos não saem em imagem fiel"* — o A3. Depende do **modo atual**, então é lido a cada
     render da lista, não congelado no parse.
   * *"Mesclagem sem equivalente (dissolve) → Normal"* — o selo "Mesclagem · x" só aparece
     quando há render, então um modo sem render era invisível.
6. **Diagnóstico por camada** (§29 do briefing): `dPsdDiagnostico()` no console da equipe lista,
   por camada, o nível, se perde efeito, e **em que etapa** cada perda se decidiu.

### Mudanças, por arquivo e responsabilidade

| Arquivo | Responsabilidade | O que mudou |
|---|---|---|
| `js/designer/psd-parse.js` | motor | **+186 linhas**: o estágio (`_DPSD_CAP_MOTIVOS`, `_dPsdCapNovo/Marca/De/Tem`, `_dPsdCapNode`, `_dPsdCapItem`, `_dPsdCapPerdeFx`, `dPsdCapReport`). `_dPsdNeedsRaster` virou derivada do estágio. O bloco `_fxUnsup` (11 linhas de condição) saiu do walk; sobrou a aplicação. A regra duplicada de `fillOpacity` em `dItemToLayer` virou uma leitura. Cinco marcações nos pontos que realmente decidem: recuperação de exceção, documento achatado, ajuste, fallback de clipping, mesclagem descartada. |
| `js/designer/psd-import.js` | tela | **+~30 linhas**: `_dPsdCapMotivo` (a tela lê o veredito, não recalcula), `dPsdDiagnostico`, e dois avisos novos na lista de camadas, derivados do livro-caixa. |
| `tests/psd-import-cases.js` | verificação | **+7 casos** (17 → 24): nível e etapa do veredito de decode, camada sem perda não inventa motivo, `fillOpacity` decidido uma vez, efeito declarado em imagem e **não** declarado em forma, mesclagem descartada registrada, perda conhecida sem raster, relatório de diagnóstico. |

**Suíte: 259 casos verdes** (`node scripts/run-browser-tests.js`), contra 252 antes — os 7 novos.
Nenhum caso existente mudou de comportamento.

### O que continua legado, e por quê

| Legado | Por que fica |
|---|---|
| Os ~12 booleanos de fidelidade (`fxSatin`, `strokeApprox`, `gradientUnsupported`, …) | A revisão, os testes e os três renderizadores os leem. O livro-caixa é a fonte da **decisão**; os booleanos continuam sendo o **transporte**. Derivar a lista inteira de selos do livro-caixa é churn cosmético — próxima área N4. |
| A lista `fxWarns` escrita à mão em `dPsdRenderRows` | idem: os 11 avisos existentes já estão corretos. Os dois novos entraram derivados; a migração dos outros é N4. |
| `it.mode` acumulando render + significado (A5) | separar toca a UI inteira da revisão (`dPsdSetMode`, `dPsdUnbindField`, `_dPsdFieldSelHTML`, a trilha, a memória). É a próxima área N3, com plano próprio. |
| `dPsdAbSelectPreview`, `isMaskBase`, o ramo `node.adjustment` de `_dPsdNeedsRaster` (A10) | código morto/vestigial. Remover é diff sem ganho de fidelidade e o briefing manda entender antes de apagar. Documentado aqui para não voltar a custar leitura. |
| `_dPsdBusyUpdate` chamado pelo motor; `_dPsdAdjustCount`/`_dPsdGlobalLight` cruzados (A6) | são 5 pontos. Passar contexto explícito é a área N5, junto com a separação motor/UI. |
| `out.reverse()` + heurística + checkbox (A7) | mexer em z-order sem um corpus de PSDs reais é apostar. Depende do pacote de referência, que continua não existindo. |

---

## 7. Limitações reais — o que não dá para reproduzir nativamente

Isto não é dívida a pagar: é o limite do alvo. O Photoshop não vai caber no navegador, e não
precisa (§33 do briefing).

| Recurso do Photoshop | Por quê | Tratamento honesto |
|---|---|---|
| Cetim (satin) | sem equivalente e o pixel do nó não o carrega (efeito é vetorial no PS) | `native_lossy` + aviso |
| Contorno customizado de efeito | o perfil da curva de fade não é publicado | `native_lossy` + aviso |
| Gradiente cônico / losango | não há primitiva nos três renderizadores | **preenchimento** → raster 1:1; **efeito** → só aviso |
| Chanfro/relevo | aproximado por realce + sombra internos | `native_lossy` |
| Texto em curva, warp, rotação, espelho | o modelo do Luma não tem matriz de transformação | raster fiel 1:1 |
| Objeto inteligente | o ag-psd entrega só o composto achatado | raster fiel; o conteúdo interno não existe |
| Blend If, Dissolver | sem caminho de render | `native_lossy` (entra Normal) + aviso |
| Padrão (preenchimento/sobreposição) | não há modelo de padrão | raster do tile já renderizado |
| Ajustes seletivos de Matiz/Saturação, Curvas com spline, Brilho moderno, Vibração | a matemática interna da Adobe não é aberta | `native_lossy` identificado |
| CMYK, 16/32 bits, ICC | o worker transporta os buffers como `Uint8ClampedArray`, sem tipo/profundidade | **não medido** — precisa de arquivo real para delimitar falha × descarte × corrupção |
| Justificado total | nenhum renderizador estica a última linha | `native_lossy` + aviso |

E a limitação de método, que continua valendo do estudo de 05/09: **não existe pacote de
referência no repositório** (PSD + PNG do Photoshop por prancheta). Sem ele, o selo compara a
prévia contra o composto reduzido a 400 px. É aprovação visual, nunca certificação — e nenhum
número deste subsistema deve ser apresentado como "X% fiel" fora desse contexto.

---

## 8. Diagnóstico por camada — como usar

Com a revisão do PSD aberta, no console da equipe:

```js
dPsdDiagnostico()   // tabela: camada · tipo · modo · nível · perdeEfeitos · motivos
```

Cada motivo vem como `etapa:codigo(detalhe)`. Exemplo de leitura:

```
Selo metálico   raster  raster  raster        true   decode:smart_object · conversao:fx_only_native
Preço           text    var     native_lossy  false  fonte:font_missing(Montserrat SemiBold)
Textura         raster  raster  native_lossy  false  capacidade:blend_dropped(dissolve)
Recorte foto    raster  frame   native_lossy  true   dependencia:clip_base_fallback(Placa)
```

Isso responde, sem tentativa e erro visual: *o selo virou imagem porque é objeto inteligente
(decode) e a sombra dele não vai sair (conversão); o preço está com fonte substituída — erro
visual de tipografia, não de posição; a textura entrou Normal porque Dissolver não renderiza.*

---

## 9. Próximas áreas, em ordem

| # | Área | Escopo | Por que agora não |
|---|---|---|---|
| **N1** | **Consumir efeito em `type:'image'`/`'frame'`** nos três renderizadores — fecha o A3 de verdade (hoje só declaramos a perda) | `png-generator.js` (`fRenderOneLayer`, ramo image/frame) + `canvas.js` (DOM) + `preview.js` (SVG) | toca o render central em 3 arquivos; o briefing §36 manda não alterar renderer sem necessidade, e a necessidade agora está **medida e nomeada**. Merece plano próprio |
| **N2** | **Completar `gReflowLayers`** — escalar `letterSpacing`, `radii`, `shadow*`, `glow*`, `inner*`, `bevelSize`, `strokeDash`, `layerEffects[]` e `clipBaseSnapshot`. Fecha o A4 | `js/core/layout.js` (~10 linhas) + caso no `tests/export.html` | muda comportamento de arte **não-PSD** já publicada (o Estúdio também define sombra e tracking). É decisão de produto do Ryan, não de engenharia |
| **N3** | **Separar modo de render de significado de campo** — `it.render` × `it.field`. Fecha o A5 e cumpre o §24/§39 | `psd-import.js` (revisão inteira) + `psd-parse.js` (`dItemToLayer`) | é a segunda fronteira; entra depois que a de capacidade estiver rodada em PSD real |
| **N4** | **Derivar os 25 selos da revisão do livro-caixa** — um render de aviso, não 25 expressões inline | `psd-import.js` (`dPsdRenderRows`) | churn cosmético; ganha valor junto com N3, que reescreve a linha de qualquer jeito |
| **N5** | **Contexto explícito de conversão** — `parseLayer(node, ctx)` com `{doc, artboard, res, globalLight, caps, assets}` em vez de globais cruzadas. Fecha o A6 e parte do A8 | `psd-parse.js` + 5 pontos de `psd-import.js` | precisa de N3 antes, ou muda a mesma assinatura duas vezes |
| **N6** | **Pacote de referência** (PSD + PNG do Photoshop por prancheta) e comparação em resolução de saída | fora do código: arquivos + fixtures | continua sendo o gargalo de **toda** afirmação de fidelidade. É o que destrava medir z-order, cor, 16 bits e texto de verdade |
| **N7** | Corrigir A9 (caixa errada no clamp de raio) e limpar A10 (código morto) | `psd-parse.js` | P2/P3. Entra de carona na próxima rodada que abrir o ramo de forma |

---

## 10. O que foi verificado nesta rodada

**Executado:** leitura integral de `psd-parse.js` e `psd-import.js`; leitura de todas as funções
externas da cadeia nos pontos que o import usa (`00-config.js`, `png-generator.js`
`fRenderTemplateLayers`/`fRenderOneLayer`, `canvas.js` `dRenderCanvas`, `core/layout.js` inteiro,
`auto-layout.js` `gCompileLayoutRoles`/`gStampLayoutBaseline`, `blending.js`, `preview.js`
`pvRenderViaMotor`, `tools.js` métricas de texto); confirmação em código dos achados A3
(varredura do ramo image/frame nos três renderizadores), A4, A5, A9 e A10 (os quatro IDs de DOM
ausentes do `index.html`, `isMaskBase` sem escrita); suíte completa **259/259 verde** em Chromium
real, com os 7 casos novos.

**Não executado:** import de um `.psd` real no navegador — não existe fixture `.psd`/`.psb` no
repositório (confirmado também pelo estudo de 05/09). A suíte não carrega o ag-psd nem lê binário:
ela cobre as funções de parse, geometria de texto, alpha, raster, capacidade e o selo. Portanto
esta rodada **não** comprova leitura binária, worker, UI de revisão nem correspondência com o
Photoshop — nem afirma isso.
