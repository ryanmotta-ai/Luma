# LUMA — Inventário Completo do Produto

> Gerado a partir do código em **2026-06-14** (leitura dos 31 arquivos JS, CSS de tokens, `index.html`, assets).
> Atualizar sempre que uma feature nova for adicionada.
>
> **Nota de fidelidade:** este inventário reflete o código real. A estrutura de arquivos descrita no `LUMA-CONTEXTO.md` lista alguns arquivos que **não existem** (`js/dados/*`, `core/storage.js`, `core/utils.js`, `franqueado/upload.js`, `franqueado/confirm.js`, `designer/selection.js`, `designer/shortcuts.js`, `designer/topbar.js`, `designer/theme.js`) — a lógica deles foi consolidada em outros arquivos ou ainda não foi escrita. Ver Seção 8 para a lista real.

---

## 0. VISÃO GERAL

| Aspecto | Realidade |
|---|---|
| Stack | Vanilla JS puro, sem framework, sem build, sem npm (com bibliotecas utilitárias locais Color Thief, Pica, PapaParse, pdf-lib, ag-psd) |
| Carregamento | `index.html` carrega ~31 `<script>` em ordem; tudo global |
| Estado | variáveis `let` globais (`fState`, `dLayers`, `dFolders`, `dArtboards`, `dVars`, `dMultiSel`...) |
| Persistência | `localStorage` (7 chaves) — sem backend |
| Render | Canvas 2D (PNG/preview), DOM absoluto (editor), SVG (export) |
| Módulos | 1) Franqueado ✅ · 2) Designer 🟡 · 3) Analytics ⛔ não implementado · 4) Tutoriais ✅ |
| Prefixos | `f*` franqueado · `d*` designer · `g*` global · `tut*` tutorial · `pv*` preview · `sp*` splash · `p*` analytics (reservado, sem código) |

---

## 1. MÓDULO FRANQUEADO

### Fluxo completo
O franqueado entra na aba "catalogo" e vê o catálogo de campanhas (`fRenderCatalogs`), com uma recomendada, as ativas e as "outras". Ao clicar numa campanha (`fSelectCamp`), abre-se a "pasta" daquela campanha mostrando os materiais publicados pelo designer (`fOpenMaterialCatalog` → `fRenderMaterialCatalog`), filtrando os expirados por validade. Ao escolher um material (`fSelectMaterial`), o sistema sincroniza o formato com o do template, extrai as variáveis dos layers (`dExtractTemplateVars`), respeita a ordem/permissões definidas pelo designer e gera as perguntas do chat guiado. O chat (`fStartChatComMaterial` → `fNextStep`) faz uma pergunta por vez — texto (com máscara/validação por tipo via `fApplyMask`/`fValidate`) ou upload de imagem (`fAddBotImageUpload`) — enquanto um preview lateral em tempo real (`fUpdateLivePreview`) renderiza o template real no canvas `#lp-canvas` usando o mesmo motor do PNG final. Ao terminar, mostra-se o card de confirmação (`fMostrarConfirm`) com resumo editável campo a campo; ao confirmar (`fConfirmarGerar` → `fGerarArte`), renderiza-se um thumbnail no chat, salva-se a entrada no histórico como "rascunho" (`fAddHist`) e oferecem-se variações em outros formatos (`fOutroFormato`). O download (`fBaixar` → `fGenPNG`) gera o PNG em super-sampling 2× e marca a entrada como "baixada". Tudo fica registrado no histórico em localStorage (`HIST_KEY`), de onde é possível reabrir (`fEditFromHist`), duplicar em outro formato (`fDuplicateInOtherFmt`) ou rebaixar (`fDownloadHist`). Há ainda geração em lote por CSV (`fBulkOpen` → `fBulkDownloadAll`).

### Ferramentas e funcionalidades
- Catálogo de campanhas: cards com capa, badge, "popular", urgência por dias restantes e botão de prévia
- Modal de prévia multi-formato: vê a campanha nos 3 formatos lado a lado e inicia direto dali (`fOpenPreview`/`fStartFromPreview`)
- Catálogo de materiais: "pasta" da campanha com materiais publicados, filtrando os expirados por validade
- Chat guiado: uma pergunta por vez, derivada das variáveis do template, com "Passo X de Y" e dica de tipo/maxLen
- Quick replies (sugestões): chips clicáveis que aplicam máscara + validação igual ao envio manual (`fQR`)
- Upload de imagem: clique ou drag&drop, valida tipo/tamanho (máx 4MB), redimensiona de forma nítida via **Pica.js** (Lanczos3), extrai cores dominantes com **Color Thief** (swatches) e mostra prévia com "Trocar"
- Máscara/validação por tipo: preço (R$ BR), desconto (% ou R$), código (alfanumérico maiúsculo), texto, select/boolean/color/date
- Live preview em tempo real: canvas lateral que renderiza o template real com placeholders `{{var}}` nos campos vazios
- Confirmação editável: card-resumo com edição campo a campo e botão "Alterar tudo"
- Voltar uma pergunta: navegação para trás no fluxo linear (`fGoBack`)
- Geração em lote (CSV): baixa modelo CSV, importa usando **PapaParse** (compatível com aspas/vírgulas escapadas), valida por célula e baixa N PNGs em fila (`fBulk*`)
- Histórico: lista com filtro por status (todas/rascunho/baixada), badge de contagem, empty states
- Download PNG: super-sampling 2× + logo Luma, nome padronizado `DM_<Campanha>_<Produto>_<Formato>_<data>.png`
- Download PDF: geração client-side embutindo o canvas na proporção exata (`fGenPDF` / `fBaixarPDF` via `pdf-lib`)
- "Gerar outro formato": gera variação em outro formato sem refazer perguntas (`fOutroFormato`/`fDuplicateInOtherFmt`)
- Reabrir/editar do histórico: restaura material original (ou fallback por chaves dos dados) e volta ao confirm (`fEditFromHist`)
- Trocar campanha/formato no meio do fluxo: pede confirmação se há dados (`fAskCampSwitch`, `fSelectFmt`)
- Reset/refazer fluxo com confirmação inline (`fResetFlow`/`fRefazer`)

### Funções principais
| Função | Arquivo | O que faz |
|---|---|---|
| fSelectCamp | catalog.js | Seleciona campanha; se há dados pergunta antes de descartar, senão abre catálogo de materiais |
| fOpenMaterialCatalog | materials.js | Esconde o chat e mostra a view de materiais publicados da campanha |
| fSelectMaterial | materials.js | Entra no chat com perguntas geradas das variáveis do template + permissões do designer |
| fStartChatComMaterial | chat.js | Inicia o chat com mensagem do material (instruções do designer) e dispara a 1ª pergunta |
| fNextStep | chat.js | Avança um passo: renderiza pergunta de texto ou de imagem; ao fim chama o confirm |
| fSend / fQR | chat.js | Captura resposta (digitada/clicada), aplica máscara, valida e salva (`fSaveAdv`) |
| fSaveAdv | chat-input.js | Grava o valor em `fState.dados`, atualiza preview e segue pra próxima pergunta ou confirm |
| fMostrarConfirm | chat.js | Monta o card de resumo editável antes de gerar |
| fGerarArte | chat.js | Marca done, salva rascunho no histórico e renderiza thumbnail + opções de formato/baixar |
| fBaixar / fOutroFormato | chat.js | Gera o PNG final (`fGenPNG`) e marca/insere no histórico como "baixada" |
| fBaixarPDF | chat.js | (async) Dispara a geração de PDF final via `fGenPDF` e registra o download no histórico |
| fGetContrastColor | chat.js | Calcula contraste do texto (preto/branco) para cores hex via luminância YIQ |
| fGenPNG | png-generator.js | Renderiza o PNG (layers do template em 2× ou fallback programático) e dispara o download |
| fGenPDF | png-generator.js | (async) Cria o documento PDF com pdf-lib, insere a arte renderizada e baixa |
| fRenderTemplateLayers | png-generator.js | Motor de render dos layers (reflow, bindings, regras, texto/shape/imagem) — usado por PNG e preview |
| fUpdateLivePreview | live-preview.js | Renderiza o template real no canvas lateral com placeholders nos campos vazios |
| fAddHist / fMarkHistBaixada | history.js | Persiste/atualiza entradas do histórico (com dedup por assinatura) em localStorage |
| fEditFromHist / fDuplicateInOtherFmt | catalog.js | Reabre uma arte no chat / duplica em outro formato a partir do histórico |
| fBulkOpen / fBulkDownloadAll | png-generator.js | Abre o modal de geração em lote e baixa N PNGs a partir de um CSV |

### Estado (fState)
Objeto inicial (`js/01-state.js`): `{camp:CAMPS_ATIVAS[0], fmt:FMTS[0], stepIdx:-1, dados:{}, done:false, editIdx:null, tab:'catalogo', material:null, materialView:false}`
- **camp** → campanha selecionada (objeto de `CAMPS_ATIVAS`/`CAMPS_OUTRAS`); pode ser clonado com `perguntas` customizadas e `materialName` injetados
- **fmt** → formato de saída selecionado (objeto de `FMTS`: story/feed/post)
- **stepIdx** → índice da pergunta atual no chat; `-1` = não iniciado, `>= perguntas.length` = na tela de confirmação
- **dados** → mapa `{idVar: valor}` com as respostas do franqueado (texto ou data URL de imagem)
- **done** → `true` quando a arte já foi gerada (fluxo concluído)
- **editIdx** → índice da pergunta em edição via card de confirmação; `null` quando não está editando
- **tab** → aba ativa do painel esquerdo: `'catalogo'` ou `'historico'`
- **material** → template/material publicado selecionado (com `layers`, `publishMeta`); `null` quando não há
- **materialView** → `true` quando a view de catálogo de materiais está visível (chat escondido)
- *(runtime)* **_lastHistId** → id da última entrada criada por `fGerarArte`, usado por `fBaixar` para promover a "baixada" sem duplicar

### Tipos de campo do chat (F_FIELD_TYPES)
`F_FIELD_TYPES` (chat-input.js) é um mapa **nome-da-pergunta → `{type, maxLen, label}`**, usado como **fallback legado por nome**. A fonte de verdade real é o tipo da variável no catálogo do designer (`dVars[id].type`); tudo é resolvido por três funções: `fGetFieldType` (config efetiva), `fApplyMask` (formata) e `fValidate` (valida pós-máscara).

Chaves de `F_FIELD_TYPES`: **produto** (text/32) · **categoria** (text/32) · **brinde** (text/40) · **oferta** (text/40) · **codigo** (code/16) · **precoDe** (price/14) · **precoPor** (price/14) · **pedidoMin** (price/18) · **desconto** (discount/24) · **validade** (text/40) · **bairros** (text/60) · **condicao** (text/60).

Como o sistema de tipos funciona:
- **fGetFieldType(id)** → `{type, maxLen, label, required, vDef, options, palette}`. Precedência de `maxLen`: permissão do designer (`publishMeta.permissoes[id].maxLen`) > `dVars[id].maxLen` > fallback por nome. Precedência de `type`: `dVars.type` manda (`number`/`currency`→`price`; `image`→`image`; ricos `date/select/color/boolean` passam direto); sem `dVars` cai no mapa por nome.
- **fApplyMask(id, raw)** formata sem rejeitar: `price` (moeda BR, aceita "grátis"/"qualquer valor"), `discount` (% ou R$ "off", clamp 99%), `code` (maiúsculo `[A-Z0-9]`), `text` (colapsa espaços + trunca); `image/date/select/color/boolean` passam intactos.
- **fValidate(id, val)** retorna erro ou `null`: vazio só bloqueia se `required`; bloqueia se exceder maxLen; `price` exige valor/keyword; `discount` exige %/R$; `code` exige ≥3 chars; `select` exige uma das `options`.

---

## 2. MÓDULO DESIGNER

### Ferramentas da toolbar vertical
(Atalhos: ver subseção "Atalhos de teclado" mais abaixo.)

| Ferramenta | Atalho | O que faz |
|---|---|---|
| `select` | V | Seleção/movimento. Clique seleciona layer e inicia drag; shift+click multi-seleção; arrasto no vazio cria marquee. Cursor `default`. |
| `text` | T | Clique no canvas cria layer de texto (`dAddTextAt`). Cursor I-beam SVG. |
| `rect` | R | Clique cria shape retângulo (`dAddShapeAt`), fill laranja. Cursor crosshair SVG. |
| `frame` | F | Clique cria moldura de foto (`dAddFrameAt`) com `imgVar:'foto_produto'`. Cursor crosshair SVG. |
| `img` | M | Clique cria layer de imagem (`dAddImageAt`) vazio. Cursor crosshair SVG. |
| `brush` | B | Pinta no `#d-paint-canvas` (round/soft/square/dotted/calligraphy). Cursor circular dinâmico (`dUpdateBrushCursor`) que segue tamanho × zoom. |
| `eraser` | E | Apaga pixels do paint canvas (`destination-out`). Cursor circular dinâmico cinza. |
| `stamp` | S | Carimbo/clone: tecla S marca um layer como source; clica para clonar (`dDoStamp`). Cursor stamp SVG. |
| `eyedrop` | I | Conta-gotas: coleta cor de texto/shape clicado (`dEyedropFromLayer`); aplica no layer selecionado e no swatch do pincel. ⚠ não funciona em frame. |
| `smudge` | — | Borra/arrasta pixels já pintados (`dSmudgeStep`). Cursor `grab`. |
| `blur` | — | Desfoca pixels pintados numa região (`dBlurRegion`). Cursor `cell`. |
| `bucket` | G | Balde: preenche cor sólida em texto/shape clicado (`dBucketFillLayer`). ⚠ só texto/shape, não pinta área do canvas. |
| `gradient` | — | Arrasta para preencher o paint canvas com gradiente linear cor→transparente (`dApplyGradient`, no mouseup). |
| ~~`artboard`~~ | — | **[REMOVIDA]** Ferramenta prancheta (arrasto no workspace para criar/ativar) foi removida da barra de ferramentas; planejado substituição futura por um sistema de páginas estilo Canva. |

Cursores customizados: cada ferramenta troca o cursor do `#d-canvas-frame` por um SVG inline (mapa `dToolCursors`). Brush/eraser usam cursor circular gerado dinamicamente (`dUpdateBrushCursor`) cujo raio acompanha `#d-brush-size` × zoom.

### Tipos de layer
**Propriedades comuns** (todo layer): `id`, `name`, `type` (`text`|`shape`|`frame`|`image`), `x`, `y`, `w`, `h`, `visible`, `locked`, `opacity` (⚠ aplicada no render só de **shape**; text/frame/image ignoram), `mask` (dataURL alpha → CSS `mask-image`), `anchor` (`{h,v}` smart-resize), `overrides` (`{fmtKey:{...}}` por formato), `bindings` (`{prop:varName}`), `rules` (`[{when,var,then,value}]`), `groupId` (agrupamento).

- **text** (`dAddTextAt`): `content` (com `{{tokens}}`), `font` (default `'Roboto Black'`, ou `custom:Família`), `fontSize` (32), `color` (`#FFFFFF`), `textAlign` (`left`). Opcionais: `isVar` (borda tracejada + label roxo), `strokeW`/`strokeColor` (contorno), `shadow`/`shadowColor`, `bg`/`bgColor` (caixa de realce), `strikethrough`.
- **shape** (`dAddShapeAt`): `fill` (`#FF9000`), `opacity` (100), `radius` (0), `shapeKind` (`rect`|`circle`|`ellipse`|`triangle`|`polygon`|`star`), `sides` (polygon, 6), `points` (star, 5), `inner` (star, 0.5). Formas não-retangulares renderizam via SVG path (`dShapePoints` + `gRoundPolyD`).
- **frame** (`dAddFrameAt`): `imgUrl` (URL/base64 fixo), `imgVar` (default `'foto_produto'`), `objectFit` (`cover`), `frameShape` (`rect`|`rounded`|`circle`), `radius` (8). Enquadramento: `imgScale`, `imgOffsetX`, `imgOffsetY`. Renderiza com botão "+ FOTO", botão limpar e label.
- **image** (`dAddImageAt`): `imgUrl`, `imgVar`, `objectFit` (`cover`). `dAddIcon` cria `type:image` com SVG inline e `objectFit:'contain'`.

### Painel de propriedades
Há **dois** lugares de edição:

**1. Barra contextual dinâmica `dUpdateCtxBar()`** (reconstrói `#d-ctx-bar`):
- Sem seleção: "Nenhum layer selecionado".
- Sempre: grupo XYWH; alinhamento (left/center/right/top/vmid/bottom + distribuir h/v → `dAlign`/`dDistribute`); ordem/z (`dReorder(±1)`, `dDuplicateLayer`, `dDeleteLayer`).
- **text**: fonte, fontSize, textAlign, cor (swatch+hex); 2º grupo: Contorno (`strokeW`+cor), Sombra (toggle+cor), Realce (`bg` toggle+cor).
- **shape**: select Forma (`shapeKind`), Lados/Pontas, Fill, Opac., Rx (`radius`).
- **frame**: Forma (`frameShape`), Rx, objectFit, upload/limpar foto; 2º grupo: Zoom (`imgScale`), X/Y (`imgOffset`), "Testar foto" (`dSetPhTest`).

**2. Painel lateral `dShowProps(l)`** (mostra `#d-props-form`, esconde `#d-no-sel`): Integrado diretamente na aba **Camadas** (Layers) no painel lateral direito, abaixo da lista de camadas. Exibe header de contexto por tipo; sempre `dp-x/y/w/h`; toggla `#d-text-props`/`#d-shape-props`/`#d-image-props`. Inclui autocomplete de var no `dp-content`, selects de binding (`dPopBindingSelects`), rule builder (`dRenderRules`) e seção de máscara (`dMaskRenderProps`).

### Marquee selection e multi-seleção
- **Marquee (rubber band)** — só com `select`, listener no `#d-canvas-frame` (anexado 1× por `dAttachMarquee`). `dStartMarquee` aborta se o alvo é `.canvas-layer`/`.layer-handle` (drag normal). `dEndMarquee`: se retângulo > 6px, seleciona todos os layers `visible && !locked` cuja bbox intersecta (`dLayerIntersects` = overlap AABB). Sem shift limpa antes; com shift acumula.
- **Multi-seleção** (`dMultiSel`): `dToggleMultiSel(id)` (shift+click) garante o primário no conjunto antes de alternar; colapsa para seleção simples se sobra ≤1. Clique simples num **membro** mantém o grupo (move junto) e adia o isolamento para o mouseup via `dPendingIsolate` (só isola se não houve arrasto, `dDragMoved`). Mover grupo: `dStartDrag` salva posições de siblings de grupo + multi-sel e aplica o mesmo delta a todos.

### Sistema de variáveis
**Uma única fonte de verdade** (`js/00-config.js`), compartilhada entre designer (simulação/preview) e franqueado (PNG).
- **Sintaxe** `{{nome}}` — nome válido `[a-zA-Z0-9_]` (`gValidVarName`); regex única `gVarRegex()` → `/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g`.
- **Catálogo `dVars`** (array em `templates.js`, persistido por `dPersistVars`/`dRestoreVars` em `yngs_vars_v1`). Cada entrada: `{name, label, type, defaultValue?, required, options?, palette?, maxLen?}`. `options` só em `select`; `palette` (hex[]) só em `color` — apagados ao trocar de tipo.
- **Tipos**: `text` · `number` · `currency` (R$) · `image` (liga a layers via `imgVar`, ex. `foto_produto`/`logo_loja`) · `select` (→ `options`) · `date` · `color` (→ `palette`) · `boolean` (Sim/Não).
- **Interpolador único `gInterpolate(content, dados, opts)`**: troca `{{nome}}` por `dados[nome]`/`opts.defaults[nome]`; `opts.onEmpty='remove'` (default) ou `'keep'` (mantém token — usado no preview). Helpers: `gVarDefaults()` (mapa nome→default do catálogo), `gAllVarsEmpty()` (todos os tokens vazios → layer não renderiza, evita "R$" órfão), `gTruthy`, `gResolveVar`.
- **BINDINGS** `l.bindings = {prop:varName}` via `gApplyBindings`: resolve props (ex. `fill`, `visible`) a partir das vars; `visible` usa `gTruthy`. ⚠ Só se aplica quando há dados (PNG/simulação) — no editor sem simulação NÃO se aplica (designer continua editando).
- **REGRAS** `l.rules = [{when:'empty'|'filled'|'maxLen', var, value?, then:'hide'|'show'|'shrinkFont'}]` via `gApplyRules`: `shrinkFont` faz `fontSize = max(8, round(fs*0.7))`.
- **Auto-criação**: `dSyncVarsFromContent(content)` varre `{{tokens}}` e adiciona ao catálogo as que faltam (`type:'text'`). Chamado na edição inline (`dEndInlineEdit`) e nos imports de PSD/SVG.

### Sistema de publicação
Modal `dPublish*` (`publish.js`), 4 abas (Pranchetas · Pasta & Nome · Validade · Permissões + Instruções):
1. `dPublishOpen()` sincroniza layers, exige ≥1 prancheta, pré-seleciona **todas** e abre.
2. Cards de prancheta com thumb + nome editável + checkbox; hover mostra preview real (`dPubRenderPreview`).
3. Select de pasta (`#pub-folder` de `dFolders`); validade (`#pub-validade`, default hoje+30d); permissões por variável (`dPublishRenderPerms` → `dPubPermissoes[v]={edit, maxLen}`); instruções livres.
4. `dPublishConfirm()`: cria/atualiza um template `'tmpl-ab-'+abId` por prancheta na pasta (move de pasta se já existir), aplicando `publishMeta` e persistindo (`dPersistFolders`).

**`dDefaultPublishMeta()`** retorna: `publicado` (false=rascunho / true=visível ao franqueado), `publicadoEm` (ts), `validade` (ISO hoje+30d), `instrucoes`, `permissoes` (`{varName:{edit:bool, maxLen:int}}`). Publicar marca `publicado=true` (também via `dToggleTemplatePublish`) → aparece no catálogo do franqueado.

### Import de PSD
Fluxo (`psd-import.js`): `dImportPSD(input)` (valida `.psd`, ⚠ máx ~200MB) → `dLoadAgPsd()` (vendorizado `assets/vendor/ag-psd.js` → ⚠ fallback CDN) → `_dPsdReadPsd` (Web Worker com ⚠ timeout 25s, fallback main-thread) → `dPsdParseItems` (achata a árvore em itens) → revisão por camada `dPsdOpenReview`/`dPsdRenderRows` → `dPsdConfirmImport` (mapeia via `dItemToLayer`, opção de inverter z-order, auto-cria vars) → `dImportLayersAsArtboard` (cria a prancheta, com `gEnsureAnchors`+`gReflowLayers` se o formato escolhido ≠ nativo).

**Multi-prancheta:** detecta filhos com `c.artboard.rect`; se >1 → `dPsdShowArtboardSelector` (lista pranchetas + formato detectado `dPsdDetectFmt` + pasta destino) → `dPsdProcessArtboardsSequence` (abre a revisão de cada uma em sequência, normaliza coords pra origem 0,0) → `dPsdSaveArtboardTemplates` (1 template rascunho por prancheta, reflow ao fmt via `_dPsdReflowToFmt`).

**Detectado por camada:** texto (fonte/fontSize por DPI, cor, alinhamento, sugestão de variável); cor sólida uniforme → shape re-colorável (`_dPsdSolidColor`); imagem fiel/raster (`_dPsdRasterURL`, ⚠ downscale ≤1600px, JPEG/PNG); sombra/contorno (`_dPsdEffects` → `l.shadow`/`strokeW`); máscara de camada + clipping compostas (`_dPsdComputeMask` → `l.mask`).
**Limitações:** fonte não-Roboto cai em Roboto (⚠ avisa); worker 25s; raster ≤1600px; fontSize estimado pela caixa quando incoerente.

### Import de SVG
Fluxo (`templates.js`, SVG = XML puro via `DOMParser`, sem libs): `dSvgImport()` (input `.svg,.ai`) → `dSvgHandleFile` (parse, dimensões do `viewBox`/`width`-`height`) → `dSvgExtractElements` (achata grupos `<g>` em **1 nível**) → `dSvgShowReviewModal` (modo por elemento + nome de var) → `dSvgRevConfirm` → `dSvgCreateTemplate` (cria layers, auto-cria vars, novo template rascunho na 1ª pasta `dFolders[0]`).

**Mapeamento SVG → layer Luma:**

| Elemento SVG | Detectado | Modos | Layer resultante |
|---|---|---|---|
| `text` / `tspan` | text | Texto editável / Variável `{{}}` / Ignorar | `text` (`isVar` se variável) |
| `rect` | shape | Shape / Ignorar | `shape` (`radius` de `rx`) |
| `circle` / `ellipse` | shape | Shape / Ignorar | `shape` (`radius:999`) |
| `image` | image | Moldura (foto) / Imagem fixa / Ignorar | `frame` (com `imgVar`) ou `image` |
| `path` simples | shape | Shape / Ignorar | `shape` |
| `path` complexo (>3 sub-paths) | path-complex | Ignorar (default) / Shape (parcial) | `shape` ⚠ baixa fidelidade |

Texto: `y` (baseline) → topo (`y-fontSize`); `text-anchor` → `textAlign`; heurísticas `dSvgSuggestVarName`/`dSvgSuggestImgVar`/`dSvgMapFont`.
**Limitações:** ⚠ lê estilo de atributo OU `style=""` inline (`_dSvgProp`) — **classes via `<style>` NÃO cobertas**; ⚠ `transform` ignorado (coords tratadas como absolutas); ⚠ bbox de path aproximada (`_dSvgPathBBox`, números do `d` como pares x,y, pois `getBBox` não funciona em DOM destacado).

### Smart resize (5.2) — `js/core/layout.js`
Motor puro que adapta layers entre formatos sem distorcer. Acionado por `dSetFormat` (com `confirm`) e reutilizado por png-generator/preview.
- **`gInferAnchor(l, W, H)`** → `{h:'left'|'center'|'right'|'stretch', v:'top'|'middle'|'bottom'|'stretch'}`. Heurística "menor margem vence": cobertura ≥94% do eixo + pos ≤4% → `stretch`; margens dentro de ~14% → `center`; senão a borda mais próxima vence.
- **`gEnsureAnchors(layers, W, H)`** — idempotente; atribui `l.anchor` só onde falta.
- **`gReflowLayers(layers, from, to, opts)`** → NOVO array. Fator único `s = min(to.w,to.h) / min(from.w,from.h)` (escala isotrópica, nunca distorce). Tamanho `w*s`/`h*s`; posição re-ancorada por eixo (`_gAxis`); `fontSize`/`strokeW` escalam (mín 8/1); `radius` escala exceto `999` (círculo); `overrides[fmtKey]` ganha por cima.
- **`gFmtKey(id)`** normaliza chave (`'post'` → `'wide'`).

### Atalhos de teclado
Listener `keydown` global em `publish.js` (ativo só em `mode-designer`; atalhos Ctrl/Cmd funcionam em inputs, os demais são bloqueados com foco em input/textarea/select/contentEditable):

| Tecla | Ação | | Tecla | Ação |
|---|---|---|---|---|
| `V` | Selecionar/Mover | | `Ctrl/Cmd+Z` | Desfazer |
| `T` | Texto | | `Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y` | Refazer |
| `R` | Retângulo/Formas | | `Ctrl/Cmd+S` | Salvar (`dSave`) |
| `F` | Moldura | | `Ctrl/Cmd+D` | Duplicar layer |
| `M` | Imagem | | `Ctrl/Cmd+G` | Agrupar |
| `B` | Pincel | | `Ctrl/Cmd+Shift+G` | Desagrupar |
| `E` | Borracha | | `Ctrl/Cmd+0` | Ajustar à tela |
| `I` | Conta-gotas | | `Ctrl/Cmd+1` | Zoom 100% |
| `G` | Balde | | `Ctrl/Cmd+=` / `+` | Zoom in |
| `S` | Carimbo (captura source) | | `Ctrl/Cmd+-` / `_` | Zoom out |
| `P` | Preview | | Setas ←↑→↓ | Mover layer 1px (Shift = 10px) |
| `?` / `Shift+/` | Folha de atalhos | | `Delete`/`Backspace` | Excluir layer (ou limpar pintura em brush/eraser) |
| `Esc` | Fecha modal var / volta a Selecionar / limpa stamp | | `Ctrl/Cmd + roda` | Zoom ancorado no cursor (em `library.js`) |

### Funções principais
Inventário completo na **Seção 8**. Núcleo: `dRenderCanvas` (reconstrói o DOM do canvas), `dSetTool`, `dShowProps`/`dUpdateCtxBar`, `dStartDrag`/`dOnDrag`, `dHistoryPush`/`dUndo`/`dRedo`, `dLoadTemplate`, `dPublishConfirm`, `dImportPSD`, `dSvgImport`, `gReflowLayers`.

---

## 3. MÓDULO ANALYTICS (p*)

⛔ **NÃO IMPLEMENTADO.** Não existe a pasta `js/dados/` nem nenhum arquivo com prefixo `p*` no código atual. O `LUMA-CONTEXTO.md` reserva o prefixo `p*` e descreve seções planejadas (Dashboard, Performance Loop, Brand Guardian, Auto-tagger, Predição de Aprovação, Coach de Foto), e há um prompt gerado (`luma-prompt-modulo-dados.md`), mas **nenhum código foi escrito**.

### Seções implementadas
Nenhuma.

### Dados mockados
Nenhum mock de analytics existe. (A chave `dm_asset_tags_v1` citada no CONTEXTO para o Auto-tagger **não existe** no código.)

---

## 4. SISTEMA DE TUTORIAIS

### Tutoriais disponíveis
**Catálogo base (`catalog.js`)** — 4:
- `primeira-arte` — "Como criar minha primeira arte" — fluxo completo campanha → material → chat → arte.
- `editar-arte` — "Como editar uma arte que já fiz" — aba "Minhas artes", filtros e reabrir.
- `qual-formato` — "Qual formato escolher" — Story (9:16) / Feed (1:1) / Post wide (12:6).
- `regras-marca` — "Regras da marca DM" — paleta, tipografia, uso da logo.

**Catálogo Studio (`catalog-studio.js`, via `Object.assign`)** — 14:
- `enviar-foto`, `gerar-varios` (franqueado) · `studio-tour`, `criar-elementos`, `editar-elementos`, `pintura`, `variaveis`, `vinculos-regras`, `simular`, `pastas-capas`, `blocos-fontes`, `publicar`, `exportar`, `atalhos` (designer).

**Total: 18 tutoriais.**

### Como o engine funciona
`engine.js` trata cada tutorial como `{title, description, duration?, scenes:[...]}`. Cada scene = `{id, duration, build()→html, tooltip?{text,target,placement}, after?()}`. Estado em `tutState`.
- Abertura: `tutOpen(id)` → header/progress → `tutGoToScene(0)`. Fechamento `tutClose`/`tutAskClose` (confirm se no meio).
- Passo: `tutRenderScene(idx)` injeta `scene.build()` em `#tut-scene`, roda `after()`, posiciona tooltip.
- **Spotlight/destaque**: classe CSS `highlight-target highlighted` nos elementos-mock (visual, sem recorte de overlay no JS).
- **Cursor virtual**: `tutMoveCursor(targetSel, action)` move `#tut-cursor` até o centro do alvo (cubic-bezier) e simula clique.
- **Tooltips**: `tutShowTooltip` posiciona `#tut-tooltip` (placement + clamp na stage) com "Passo X de Y".
- Navegação prev/next (`tutNext`/`tutPrev`) + teclas; play/pause (`tutTogglePlay`, auto-advance via `sceneTimer`); barra de progresso clicável (`tutRenderProgress`/`tutUpdateProgress`); tela final `tutShowFinale` grava o id em `yngs_tutorials_done`.
- **Mocks**: telas falsas em HTML (`mocks.js` claro/franqueado: `tutMockCampaign`/`tutMockMaterial`/`tutMockHist`; `mocks-studio.js` escuro/Estúdio: `tutStudio`/`tutArtCanvas`/`tutPanelCard`/...) que reproduzem o app só para demonstração — não tocam dados/estado reais.

---

## 5. COMPONENTES GLOBAIS

### Toast (`gToast`)
`gToast(msg, type)` exibe `#g-toast` por 2800ms (4200ms se `type==='error'` + classe `g-toast-error`). Reanima removendo/readicionando `.show`. ⚠ **Sem fila/empilhamento** — cada chamada sobrescreve o texto e reinicia o timer; toasts em sequência rápida se atropelam. Também em `toast.js`: `gBtnLoading(btn,label)` (estado loading + restore) e `gWarnImagesNotPersisted()` (aviso 1×/sessão).

### Central de Ajuda (`gOpenHelp`)
`gOpenHelp()` abre `#g-help-modal` e renderiza o catálogo. ⚠ **Sem abas reais** — catálogo único agrupado por 2 categorias ("Para o franqueado" / "Para o designer · Estúdio") em `G_HELP_CATALOG` (18 cards). Busca `#g-help-search` filtra por título/sub. Cada card → `gHelpPlay(id)` fecha o modal e chama `tutOpen(id)`; só lista cards cujo id existe em `TUTORIALS`. Esc fecha.

### Splash screen (`sp*`)
`splash.js` (IIFE). Overlay `#sp-overlay` no carregamento (1º script do `<body>`). `spDismiss()` (em `window.spDismiss`) adiciona `.sp-done` (fade) e esconde após 450ms. No `DOMContentLoaded` agenda o dismiss respeitando o mínimo `SP_MIN`=2800ms (alinhado à barra de progresso). Tudo em try/catch para nunca travar o app.

### Favicon
SVG vetorial em `assets/favicon.svg` (quadrado laranja `#FF9000` com border-radius + varinha mágica branca com estrelas e faíscas ao redor). Linkado no `<head>` (`rel="icon" type="image/svg+xml"` + fallback PNG apontando pro SVG) com `<meta name="theme-color" content="#FF9000">`. Script `scripts/gen-favicon.js` gera o PNG 180×180 (Apple Touch) se o pacote `canvas` estiver disponível.


### Bootstrap (`main.js`)
Define `setMode(m)` e, na carga, inicializa o franqueado em ordem: `fRenderCatalogs(CAMPS_ATIVAS, CAMPS_OUTRAS)` → `fRenderFmts()` → `fUpdateHistBadge()` → `fStartChat()`. `setMode(m)` troca body class para `mode-<m>` (preserva `theme-light`), alterna abas `#tab-fran`/`#tab-design`, mostra/esconde topbars e chama `dInit()` ao entrar no designer (lazy: só na 1ª vez). ⚠ Toast/help/splash/tutorial se auto-registram via listeners — não há init explícito no `main.js`.

### Config global (`00-config.js`)
- `HIST_KEY` = `'dm_artes_hist_v2'`.
- `CAMPS_ATIVAS` — campanhas ativas; cada uma `{id, name, color, count, badge, expiraDias, popular, previewProd, previewDe, previewPor, perguntas:[{id, texto, sugestoes}]}` (ids: hf, cd, eg, ac).
- `CAMPS_OUTRAS` — mesma estrutura (ids: pt, gb, of).
- `FMTS` — `[{id, name, dim}]`: story (1080×1920), feed (1080×1080), post (1200×628).
- Helpers `g*` (ver Seção 8): regex/validação de var, interpolador, bindings, regras, polígonos arredondados, pack de imagem.

---

## 6. PERSISTÊNCIA (localStorage)

7 chaves reais (confirmadas por grep). Risco de quota = imagens base64 (capas, fotos, fontes) competindo por ~5MB.

| Chave | Conteúdo | Escreve / Lê | Risco quota |
|---|---|---|---|
| `yngs_folders_v1` | Pastas + templates + layers + capas + `publishMeta` | `dPersistFolders` (layers.js) / `dPreloadFolders`,`dInit` (templates.js) | 🔴 Alto (capas + imagens base64) |
| `yngs_artboards_v1` | Pranchetas do designer + seus layers | `dPersistArtboards` (templates.js) | 🟡 Médio (imagens grandes viram `__local__`) |
| `yngs_vars_v1` | Catálogo `dVars` (variáveis) | `dPersistVars` / `dRestoreVars` (layers.js) | 🟢 Baixo |
| `yngs_snippets_v1` | Blocos reutilizáveis (snippets) | `dSaveSnippetsStore` / `dLoadSnippets` (library.js) | 🟡 Médio (descarta base64) |
| `yngs_fonts_v1` | Fontes enviadas (base64) | `dFontsPersist` / `dFontsRestore` (fonts.js) | 🔴 Alto (~3MB/fonte) |
| `yngs_tutorials_done` | IDs de tutoriais concluídos | `tutShowFinale` (engine.js) / `gHelpTutDone` (help.js) | 🟢 Baixo |
| `dm_artes_hist_v2` (`HIST_KEY`) | Histórico de artes do franqueado (máx 50) | `fSaveHist` / `fGetHist` (history.js) | 🟢 Baixo |

**Limitação estrutural:** imagens enviadas (fotos/logos) não persistem — `gPackImgUrl` mantém só ≤~70KB e troca grandes por `'__local__'` (somem no reload, com aviso `gWarnImagesNotPersisted`). Resolver = object storage no backend.

---

## 7. BRAND BOOK APLICADO

### Paleta de cores (CSS vars — `css/00-tokens.css`)
| Var | Hex | Uso |
|---|---|---|
| `--dm-orange` | `#FF9000` | Cor primária da marca (CTAs, seleção, acentos) |
| `--dm-orange-d` | `#F85400` | Laranja escuro (hover/realces) |
| `--dm-orange-l` | `#FFA533` | Laranja claro |
| `--dm-orange-bg` | `#FFF2E0` | Fundo suave laranja (chips/cards) |
| `--dm-orange-tint` | `#FFE0BD` | Tint laranja (bordas suaves) |
| `--dm-red` | `#C81818` | Vermelho DM (preços/destaques) |
| `--dm-yellow` | `#FFB900` | Amarelo (preço promo, avisos) |
| `--white` / `--off-white` | `#FFFFFF` / `#FAFAFA` | Brancos |
| `--gray-light` / `--gray-mid` | `#F2F2F2` / `#D4D4D4` | Cinzas claros |
| `--text` / `--text-2` / `--text-3` | `#0A0A0A` / `#3A3A3A` / `#6B6B6B` | Hierarquia de texto (claro) |
| `--green` | `#22C55E` | Sucesso (publicado, baixado) |
| `--d-bg` / `--d-dark` / `--d-surf` / `--d-surf2` / `--d-surf3` | `#111` / `#1A1A1A` / `#222` / `#2A2A2A` / `#333` | Superfícies do designer (dark) |
| `--d-border` / `--d-border2` | `rgba(255,255,255,.08)` / `.14` | Bordas dark |
| `--d-text` / `--d-text2` / `--d-text3` | `#F0F0F0` / `#A0A0A0` / `#666` | Texto do designer (dark) |
| `--var-color` / `--var-bg` | `#7C6EFF` / `rgba(124,110,255,.12)` | Identidade das **variáveis** (roxo) |

Radii: `--r:10px`, `--r-sm:6px`, `--r-pill:999px`.

### Tipografia
- **Roboto** (Google Fonts, carregada no `<head>`), pesos 300/400/500/700/**900**/italic. `font-weight:900` = "Roboto Black". É a fonte oficial.
- ⚠ **Realce Black foi aposentada** — `css/03-fonts.css` está vazio (só comentário). Pode existir `assets/fonts/realce-black.woff2` físico, mas **não é usado**; o valor de fonte `'Realce Black'` mapeia para Roboto 900 (`dTextFontParts`/`dSvgMapFont`).
- **Fontes custom**: o designer pode enviar `.ttf/.otf/.woff/.woff2` (máx 3MB) na aba Assets → registradas via FontFace API (`dFontRegister`), persistidas em `yngs_fonts_v1`, referenciadas como `custom:Família`.

### Logos disponíveis (`assets/logos/`)
8 PNGs. As CSS vars `--logo-h-*`/`--logo-v-*` em uso apontam para as **Luma**; as variações DM antigas continuam no disco como aliases/legado.
- **Luma** (atuais): `luma-h-branca.png` (fundos escuros/coloridos), `luma-h-cor.png` (fundos claros). Aspect ratio horizontal ≈ 2163/706.
- **DM** (legado, ainda no disco): `dm-h-branca.png`, `dm-h-preta.png`, `dm-h-laranja.png`, `dm-h-principal.png`, `dm-v-branca.png`, `dm-v-principal.png`.
- Aliases de compatibilidade (`--logo-h-preta`/`-laranja`/`-principal`/`-v-*`) apontam todos para `luma-h-cor.png`/`luma-h-branca.png`. Classes utilitárias: `.dm-logo--h-branca`, `.dm-logo--h-cor`, etc.

---

## 8. INVENTÁRIO DE FUNÇÕES POR ARQUIVO

> Constantes globais e o `fState` inicial estão documentados nas Seções 1, 5 e 7. `js/01-state.js` contém apenas a declaração de `fState` (ver Seção 1).

### js/00-config.js
| Função | Parâmetros | O que faz |
|---|---|---|
| gVarRegex | — | Retorna a regex global de tokens `{{var}}` |
| gValidVarName | name | Valida nome de variável (`^[a-zA-Z0-9_]+$`) |
| gXmlEsc | s | Escapa `& < > " '` para XML/SVG |
| _gRoundPolyCorners | points, r | (interno) Cantos arredondados de um polígono |
| gRoundPolyD | points, r | String de path SVG de polígono arredondado |
| gRoundPolyPath2D | ctx, points, r | Traça polígono arredondado num Canvas 2D |
| gPackImgUrl | url | Empacota data-URL p/ persistência (≤~70KB; grandes → `'__local__'`) |
| gInterpolate | content, dados, opts | Substitui `{{nome}}` por valor/default; `onEmpty:'keep'` mantém token |
| gVarDefaults | — | Mapa `{nome:defaultValue}` do catálogo `dVars` |
| gTruthy | v | Interpreta valor como booleano (vazio/0/false/nao/no/off → false) |
| gResolveVar | varName, dados, defaults | Resolve valor da variável (dado → senão default) |
| gApplyBindings | layer, dados, opts | Aplica bindings de propriedade resolvendo vars; clona o layer |
| gApplyRules | layer, dados, opts | Avalia regras condicionais (hide/show/shrinkFont) |
| gAllVarsEmpty | content, dados, defaults | True se há token(s) e todos resolvem vazio |

### js/main.js
| Função | Parâmetros | O que faz |
|---|---|---|
| setMode | m | Troca modo franqueado/designer (body class, abas, topbars; `dInit()` no designer) |
| (nível de módulo) | — | Na carga: `fRenderCatalogs`, `fRenderFmts`, `fUpdateHistBadge`, `fStartChat` |

### js/core/toast.js
| Função | Parâmetros | O que faz |
|---|---|---|
| gToast | msg, type | Mostra `#g-toast` 2.8s (4.2s erro); ⚠ sem fila, reinicia a cada chamada |
| gBtnLoading | btn, label | Põe botão em loading (spinner, bloqueia); retorna função de restore |
| gWarnImagesNotPersisted | — | Avisa 1×/sessão que imagens enviadas não persistem |

### js/core/help.js
| Função | Parâmetros | O que faz |
|---|---|---|
| gHelpTutDone | — | Lê `yngs_tutorials_done` → array de ids |
| gHelpTutDuration | id | Soma durações das scenes e formata "~Ns"/"~N min" |
| gHelpRenderCatalog | query | Renderiza catálogo agrupado por categoria, filtrando por busca |
| gHelpPlay | id | Fecha ajuda e abre o tutorial (`tutOpen`) |
| gOpenHelp | — | Abre `#g-help-modal`, renderiza catálogo, trava scroll |
| gCloseHelp | — | Fecha o modal e restaura scroll |
| gHelpAction | action | Mapeia ações de cards → tutorial; slack/email = toast placeholder |
| (keydown) | e | Esc fecha o modal de ajuda |

### js/core/splash.js
| Função | Parâmetros | O que faz |
|---|---|---|
| spDismiss | — | (em IIFE; `window.spDismiss`) Fade-out e esconde `#sp-overlay` após 450ms |
| (IIFE init) | — | No `DOMContentLoaded` agenda o dismiss respeitando `SP_MIN`=2800ms |

### js/core/help-chat.js
| Função | Parâmetros | O que faz |
|---|---|---|
| gInitHelpChat | — | Cria e insere no `body` o botão flutuante e o container de chat (`#g-chat-btn` e `#g-chat-window`), e inicializa o fluxo |
| gToggleHelpChat | — | Alterna o estado de exibição do chat (abre/fecha com efeito CSS transition e troca o ícone do botão) |
| gChatReset | — | Reseta a conversa para o menu inicial do bot e desabilita entrada manual de texto |
| gAddChatBubbleBot | htmlText, options | Injeta uma bolha de mensagem do robô no corpo do chat com chips de opções clicáveis |
| gAddChatBubbleUser | text | Injeta uma bolha de mensagem do usuário (direita, cor laranja) no corpo do chat |
| gChatSelectOption | id, label | Manipula a escolha de uma opção pelo usuário, mostra indicador de digitação ("Digitando...") e avança na árvore de decisão |
| gChatSendMessage | — | Envia a mensagem manual digitada no input para o modo Suporte Humano, simulando resposta do time comercial após delay |
| gCheckHelpChatVisibility | — | Verifica a visibilidade do botão flutuante com base na presença de usuário logado e ocultação do splash e tela de login |


### js/core/layout.js
| Função | Parâmetros | O que faz |
|---|---|---|
| gInferAnchor | l, W, H | Infere âncora `{h,v}` pela posição ("menor margem vence") |
| gEnsureAnchors | layers, W, H | Atribui `l.anchor` onde falta (idempotente) |
| _gAxis | anchor, pos, size, total0, size1, total1, s | Reposiciona/escala um eixo conforme a âncora |
| gReflowLayers | layers, from, to, opts | Reflow completo: escala por `s` + re-ancora + overrides |
| gFmtKey | id | Normaliza chave de formato (`post`→`wide`) |

### js/franqueado/catalog.js
| Função | Parâmetros | O que faz |
|---|---|---|
| fSwitchTab | tab, btn | Alterna abas catálogo/histórico |
| fSetHistFilter | f, btn | Define filtro do histórico (todos/rascunho/baixada) |
| fGoToCampaigns | — | CTA do empty state → aba catálogo |
| fRenderHist | — | Renderiza o histórico (filtros, contadores, empty states, cards) |
| fDownloadHist | id | (async) Rebaixa uma arte do histórico; marca "baixada" ⚠ marca mesmo se `fGenPNG` falhar |
| fEditFromHist | id | Reabre entrada no chat com dados pré-preenchidos |
| fDuplicateInOtherFmt | id | Barra inline pra escolher outro formato pra duplicar |
| fConfirmDuplicate | id, fmtId | (async) Confirma duplicação: salva "baixada" e gera PNG |
| fFolderForCamp | c | Acha a pasta (`dFolders`) ligada à campanha |
| fCampCover | c | URL da capa da pasta da campanha |
| fCampEl | c, isRec | HTML de um card de campanha |
| fRenderCatalogs | a, o | Renderiza recomendada + ativas + outras |
| fFilterCamps | q | Filtra campanhas por busca |
| fSelectCamp | id | Seleciona campanha (confirma se há dados); abre materiais |

⚠ `catalog.js` termina (linha ~328) com um comentário órfão ("Encontra todos os materiais publicados...") sem função abaixo — função aparentemente truncada/removida.

### js/franqueado/materials.js
| Função | Parâmetros | O que faz |
|---|---|---|
| fGetMaterialsForCamp | campId | Templates publicados da pasta da campanha (casa por campId ou nome) |
| fIsMaterialValid | material | True se sem validade ou ainda não expirou |
| fOpenMaterialCatalog | camp | Cria/mostra `#f-material-view`, esconde o chat |
| fRenderMaterialCatalog | camp, container | Grid de materiais válidos (ou empty state) |
| fRenderMaterialCard | material, camp | HTML do card de um material |
| fCloseMaterialCatalog | — | Fecha materiais ⚠ reseta `fState.camp` pra cor laranja fixa e id vazio |
| fMaterialImageVars | layers | `Set` de variáveis usadas como imagem (frame/image) |
| fSelectMaterial | materialId | Sincroniza formato, gera perguntas (texto/imagem/select/...) e inicia o chat |

### js/franqueado/chat.js
| Função | Parâmetros | O que faz |
|---|---|---|
| fGetSuggestionsForVar | varName, camp | Sugestões pra uma variável (perguntas da campanha ou defaults) |
| fStartChatComMaterial | material | Inicia chat com intro do material + instruções |
| fAskCampSwitch | c | Confirmação inline pra trocar de campanha |
| fApplyCampSwitch | cId, keepData | Aplica troca de campanha (limpa estado, abre materiais) |
| fCancelSwitch | — | Remove a confirmação de troca |
| fSelectFmt | id | Troca formato (regera/mantém/reinicia conforme o estado) |
| fStartChatPreservandoDados | — | ⚠ Reinicia preservando dados — aparentemente código órfão (não chamado) |
| fRenderFmts | — | Renderiza botões de formato |
| fUpdateCtx | — | Atualiza tags de contexto + live preview |
| fUpdateProg | — | Atualiza barra de progresso (`#prog-fill`) |
| fStartChat | — | Inicia o chat do zero |
| fNextStep | — | Avança um passo (imagem/texto); ao fim → confirm |
| fAddBotImageUpload | stepLabel, pergunta, canGoBack | Bolha de upload de imagem |
| fHandleImageUpload | event, varId, uploadId | Handler do `<input file>` |
| fProcessImageFile | file, varId, uploadId | Valida (4MB), skeleton, lê dataURL, redimensiona, salva |
| fResizeImageIfNeeded | dataUrl, maxDim, cb | Redimensiona imagem de forma nítida via **Pica.js** (com fallback nativo canvas) |
| fReplaceImage | varId, btn | Apaga imagem e re-pergunta |
| fGoBack | — | Volta uma pergunta (remove bolhas, limpa dados) |
| fUpdateInputPlaceholder | id | Placeholder conforme tipo do campo |
| fMostrarConfirm | — | Card de confirmação editável (+ CSV se há material) |
| fEditCampo | idx | Reabre uma pergunta pra edição |
| fEditarTudo | — | Descarta tudo e reinicia |
| fConfirmarGerar | — | Remove o card e chama `fGerarArte` |
| fGerarArte | — | Marca done, salva rascunho, thumbnail + opções ⚠ fallback usa nomes mágicos `foto_produto`/`logo_loja` |
| fOutroFormato | id | (async) Variação em outro formato |
| fBaixar | btn | (async) Baixa o PNG do formato atual |
| fBaixarPDF | btn, snapId | (async) Dispara fGenPDF, atualiza histórico e mostra toast |
| fGetContrastColor | hex | Calcula cor de contraste (#000000 ou #ffffff) via luminância YIQ |
| fRefazer | — | Reinicia o fluxo da campanha atual |
| fResetFlow | — | Reset com confirmação inline |
| fConfirmReset / fCancelReset | — | Confirma / cancela o reset |
| fAddBot | html, qrs, canGoBack | Bolha do bot (HTML + quick replies + voltar) |
| fAddUser | txt | Bolha do usuário |
| fTyping | cb | Indicador "digitando" (~900ms) → callback |
| fQR | val, el | Quick reply: máscara, valida, salva |
| fSend | — | Envio manual: lê, máscara, valida, salva |

### js/franqueado/chat-input.js
| Função | Parâmetros | O que faz |
|---|---|---|
| fGetFieldType | id | Resolve `{type, maxLen, label, required, vDef, options, palette}` |
| fApplyMask | id, raw | Formata por tipo (preço/desconto/código/texto); ricos passam intactos |
| fValidate | id, val | Valida pós-máscara (required, maxLen, preço, desconto, código, select) |
| fShowFieldError | msg | Erro inline no chat (auto-remove 4s) |
| fAttachInputGuard | — | Sanitização de paste + limite vivo no `#f-msg-box` |
| fUpdateCharCount | — | Atualiza `#f-char-count` (len/maxLen) |
| fSaveAdv | val | Grava em `fState.dados`, atualiza preview, segue/confirm |

### js/franqueado/live-preview.js
| Função | Parâmetros | O que faz |
|---|---|---|
| fOpenPreview | e, id | Modal de prévia da campanha (3 formatos clicáveis) |
| fStartFromPreview | campId, fmtId | Fecha modal, define formato, seleciona campanha |
| fClosePreview | — | Fecha o modal de prévia |
| fUpdateLivePreview | opts | (async) Renderiza o template no `#lp-canvas` com placeholders ⚠ `opts.animateField` é ignorado |
| fLpSizeCanvas | canvas, W, H | Dimensiona o canvas no `.lp-stage` sem distorcer |
| fLpShowEmpty | canvas | Estado "aguardando template..." |
| fLpInjectPlaceholders | layers, dadosPreview, defaults | Injeta `{{var}}` nos textos vazios sem default; retorna `Set` de pendentes |
| fLpHighlightEmpty | ctx, layers, pendentes, W, H | Véu sobre layers pendentes (só sem reflow) |
| fLpUpdateMeta | hasTemplate | Atualiza lista de campos (`#lp-fields`) e sub-header (`#lp-sub`) |

### js/franqueado/png-generator.js
| Função | Parâmetros | O que faz |
|---|---|---|
| fLoadLogoBranca | — | Carrega/cacheia a logo Luma branca da CSS var |
| fGenPNG | d, c, fmt | (async) Gera e baixa o PNG (layers 2× ou fallback programático) |
| fGenPDF | d, c, fmt | (async) Cria documento PDF com pdf-lib, insere a arte renderizada e baixa |
| fDrawDMLogo | ctx, w, h | (async) Desenha a logo no rodapé |
| fRenderTemplateLayers | ctx, layers, W, H, dados, camp | (async) Motor de render: reflow, bindings/regras, fundo, layers |
| fRenderOneLayer | ctx, l, dados, scaleX, scaleY | (async) Desenha 1 layer (auto-fit, sombra, contorno, clip de imagem) |
| roundedRect | ctx, x, y, w, h, r | Retângulo arredondado |
| fLoadImageDataUrl | dataUrl | Carrega/cacheia imagem (dataURL ou http CORS) |
| fClearImgCache | — | Limpa o cache de imagens |
| fRenderMaterialToDataURL | dados, camp, fmt | (async) Renderiza em 2× e devolve dataURL (bulk) |
| fBulkOpen / fBulkClose | — | Abre/fecha o modal de geração em lote |
| fBulkVars | — | Variáveis do material ordenadas por `dVars` |
| fBulkTemplateCSV | — | Gera/baixa CSV-modelo |
| fBulkParseCSV | text | Parser CSV usando **PapaParse** (com fallback) |
| fBulkHandleCSV | input | Lê CSV, aplica máscara/validação por célula |
| fBulkRenderPreview | — | Preview das linhas (chips + erros) |
| fBulkDownloadAll | — | (async) Baixa 1 PNG por linha válida, em fila |
| fSanitizeNamePart | s | Normaliza trecho de nome (sem acento, PascalCase, ≤28) |
| fBuildFilename | c, fmt, d | Monta `DM_<Campanha>_<Produto>_<Formato>_<data>.png` |

### js/franqueado/history.js
| Função | Parâmetros | O que faz |
|---|---|---|
| fGetHist | — | Lê o histórico do localStorage (`HIST_KEY`) |
| fSaveHist | a | Salva (cap 50); avisa via toast se quota estourar |
| fAddHist | d, c, f, status | Adiciona com dedup por assinatura (camp+fmt+dados em 5min); retorna id |
| fMarkHistBaixada | id | Promove "rascunho" → "baixada" |
| fUpdateHistBadge | — | Atualiza o badge `#hist-badge` |
| fFormatHistDate | ts | Data relativa pt-BR ("agora", "5min", "Hoje 14:32", ...) |

### js/designer/canvas.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dSetFormat | fmt, btn | Troca formato; oferece smart-resize se dimensões mudam |
| dApplyFormat | animate | Aplica largura/altura/scale ao frame; centraliza |
| dFitToScreen | — | Zoom para caber no wrapper e centraliza scroll |
| dPositionArtboard | — | Dimensiona o workspace e centraliza o container |
| dZoom | delta | Zoom multiplicativo (×1.2) |
| dSetZoom | z, clientX, clientY | Define zoom (10–400%) mantendo o ponto-âncora |
| dRenderWorkspace | — | Limpa ghosts e re-centraliza |
| dSampleImg | ar | Gera/cacheia foto-amostra (teste de foto) |
| dSetPhTest | ar | Define proporção de teste e re-renderiza |
| dABAddResizeHandles | — | Cria 8 handles de resize do artboard |
| dABResizeStart/Move/Up | e, pos / e / — | Resize do artboard ativo (min 80px) |
| dABDragStart/OnDrag/StopDrag | e, ab / e / — | Move a prancheta (min 40) |
| dUpdateBrushCursor | — | Cursor circular dinâmico do pincel/borracha |
| dSetTool | t | Ativa ferramenta: botão, cursor, opções de pincel |
| dEnsureMarqueeEl | — | Garante o `#d-marquee` dentro do frame |
| dAttachMarquee | — | Anexa mousedown de marquee no frame (1×) |
| dStartMarquee / dUpdateMarquee / dEndMarquee | e | Retângulo de seleção por arrasto |
| dLayerIntersects | l, x1, y1, x2, y2 | Overlap AABB layer × retângulo |
| dABToolAttach / dABWorkspaceDown / dABDrawMove / dABDrawUp | — / e | Ferramenta prancheta (desenhar/ativar) |
| dTextFontParts | fv | Resolve valor de fonte → `{family, weight, custom?}` |
| dRenderCanvas | — | Renderiza todos os layers visíveis + handles + máscaras + paint canvas |
| dUpdateCtxBar | — | Reconstrói a barra contextual conforme o layer |
| dCalculateSnap | movingLayer, newX, newY | Snap (6px) a edges + guias |
| dToggleSnap | — | Liga/desliga smart guides |
| dShowGuides / dClearGuides | guides / — | Desenha/remove guias |
| dOpenSimModal / dCloseSimModal | — | Abre/fecha o modal de simulação |
| dSimVarInput / dSimVarUpdateMeta / dSimVarOverflow | vn, value, maxLen | Simulação de variáveis (valor, contador, overflow) |
| dApplySim / dResetSim | — | Ativa/desativa a simulação |
| dInterpolate | text | Interpola `{{var}}` com valores simulados |
| dToggleRulers / dRenderRulers | — | Liga/desenha as réguas |

### js/designer/layers.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dSelLayer | id | Seleciona layer + re-render + props/ctx-bar |
| dHoverLayer | id, on | Espelha hover canvas ↔ lista |
| dSelLayerState | id | Seleciona sem re-render (usado nos `dAdd*`) |
| dDeselect | e | Desseleciona ao clicar no vazio |
| dStartDrag / dOnDrag / dStopDrag | e, l / e / — | Drag de layer (com snap, grupo e multi-sel; isola membro se não arrastou) |
| dStartResize / dOnResize / dStopResize | e, l, pos / e / — | Resize via handle (min 20×10) |
| dAddText / dAddShape / dAddImage / dAddFrame | — | Adiciona layer (posição padrão) |
| dAddTextAt / dAddShapeAt / dAddImageAt / dAddFrameAt | x, y | Cria layer na posição |
| dDeleteLayer | — | Remove o layer selecionado |
| dReorder | dir | Sobe/desce na ordem (z) |
| dAlign | dir | Alinha (2+ entre si, senão ao canvas) |
| dDistribute | axis | Distribui 3+ com gap igual |
| dRenderLayersList | — | Lista lateral de layers |
| dLyrDragStart/Over/Leave/Drop | — | DnD de reordenação da lista |
| dToggleVis | e, id | Liga/desliga visibilidade |
| dShowProps | l | Preenche e exibe o painel lateral por tipo |
| dPopVarSel / dInsertVar | — | Select e inserção de `{{var}}` no conteúdo |
| dBindOptions / dPopBindingSelects / dSetBinding | ... | Bindings prop→variável |
| dRenderRules / dAddRule / dUpdateRule / dRemoveRule | ... | Rule builder condicional |
| dUpdateProp | prop, val | Atualiza propriedade do layer (debounce p/ contínuas) |
| dActivatePanel / dSwitchPanelTo* / dToggleSection / dSwitchTab | ... | Navegação do painel direito |
| dPersistVars / dRestoreVars | — | Salva/restaura `dVars` (`yngs_vars_v1`) |
| dVarUsage / dHighlightVarLayers | name | Uso de uma variável / flash nos layers |
| dVarsRender / dVarTypeFields | — | Lista de variáveis / campos por tipo |
| dOpenVarModal / dEditVar / dCloseVarModal / dConfirmVar | ... | CRUD do modal de variável |
| dReadVarOptions / dReadVarPalette | — | Lê options/palette do modal |
| dRemoveVar / dMoveVar / dRenameVar | i / i,dir / i | Remove/reordena/renomeia variável |
| dRemoveMask | id | Remove a máscara do layer |
| dSyncVarsFromContent | content | Auto-cria variáveis dos `{{tokens}}` |
| dAttachVarAutocomplete / dVarAc* | ... | Autocomplete de `{{var}}` (box, input, teclado, pick) |
| dVarTypePopover | name, anchorEl | Mini-popover de tipo p/ var recém-criada |
| dAssetsRender / dHandleUpload / dUseAsset | ... | Grid de assets / upload / aplicar |
| dSave | — | Salva rascunho (sincroniza AB, persiste folders/artboards) |
| dPersistFolders | — | Persiste folders (`yngs_folders_v1`; packs/descarta imagens) |
| dToggleMultiSel / dClearMultiSel | id / — | Multi-seleção (shift+click) |
| dGroupSelected / dUngroupSelected / dGetGroupSiblings | — / — / layer | Agrupamento |
| dRenameLayer | id, e | Renomeia layer inline |
| dOpenCheat / dCloseCheat | — | Modal de atalhos |
| dAddIcon / dAddLine | — | Adiciona ícone (image SVG) / linha (shape fino) |
| dShapePoints | l | Pontos [0..1] da forma (triangle/polygon/star) |
| dAddShapeKind | kind | Cria forma nativa (circle/ellipse/triangle/polygon/star) |

### js/designer/tools.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dMeasureText | text, font, fontSize, maxWidth | Mede largura/altura/linhas (canvas oculto, com wrap) ⚠ `return` morto no `forEach` |
| dCheckTextOverflow | layer | Se o texto excede a altura do layer (+2px) |
| dAutoFitText | layerId | Ajusta `fontSize` até caber na caixa |
| dEyedropFromLayer | sourceLayer | Conta-gotas (text/shape) ⚠ bloqueia em frame |
| dBucketFillLayer | targetLayer | Preenche cor sólida ⚠ só texto/shape |

### js/designer/brush.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dPaintTargetSize | — | Tamanho lógico do paint canvas = artboard ativo |
| dEnsurePaintCanvas | — | Cria/recria `#d-paint-canvas` e anexa listeners |
| dSyncPaintPointer | — | Liga/desliga `pointer-events` do paint canvas por ferramenta |
| dGetPaintCtx | — | Contexto 2d do paint canvas |
| dPaintStart / dPaintMove / dPaintEnd | e / e / — | Traço; ou smudge/blur; gradient no mouseup |
| dBlurRegion | ctx, pos, sz | Desfoca pixels pintados numa região |
| dSmudgeStep | ctx, from, to, sz, bs | Arrasta pixels com alpha parcial |
| dApplyGradient | p0, p1 | Gradiente linear cor→transparente no paint canvas |
| dCanvasPos | e | clientX/Y → coords do canvas |
| dClearPaint | — | Limpa a pintura (desfazível) |
| dDoStamp | targetLayer | Clona o layer-source (+20,+20) |
| dAttachPaintListeners | — | Anexa eventos no paint canvas (1×) |
| dShowBrushBar | toolName | Mostra/oculta a barra de opções do pincel |
| dBrushUpdate | prop, val | Atualiza `dBrush[prop]` e sincroniza UI |
| dBrushSetPreset | preset | Preset (round/soft/calligraphy/dotted) + hardness |
| dGetBrushStyle | — | Estilo atual do pincel normalizado |

(Há também um listener `click` no `#d-canvas-frame` no nível do módulo que cria text/rect/frame/img/stamp no clique.)

### js/designer/undo-redo.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dHistoryPush | — | Agenda commit coalescido (microtask) |
| dHistoryPushDebounced | — | Commit com debounce 400ms (props contínuas) |
| dCapturePaint | — | Serializa o paint canvas → dataURL PNG |
| dHistorySnapshot | — | Monta `{layers, paint}` (reusa pintura se não dirty) |
| dHistoryCommit | — | Cria entrada (dedup do topo, cap 30, trunca redo) |
| dHistoryReset | — | Reseta o histórico com o estado atual |
| dApplyPaintSnapshot | dataUrl | Redesenha/limpa o paint canvas |
| dRestoreSelection | — | Limpa seleção de layers inexistentes |
| dApplyHistoryEntry | entry | Aplica layers + pintura |
| dUndo / dRedo | — | Desfaz / refaz |
| dUpdateUndoButtons | — | Ajusta opacidade dos botões undo/redo |
| dFlashLayer | id | Flash visual no layer |

### js/designer/mask.js
| Função | Parâmetros | O que faz |
|---|---|---|
| _dMaskLayer | — | Layer selecionado |
| _dMaskBlank | w, h | Canvas alpha NxN visível |
| _dMaskLoad | url, w, h, cb | Carrega máscara num canvas (fallback branco) |
| _dMaskRenderView | — | "View" vermelha (vermelho = escondido) |
| dMaskAdd | — | Cria máscara em branco e entra no modo pintura |
| dMaskInvert | — | Inverte o alpha |
| dMaskPaintStart | — | Entra no modo pintura |
| dMaskSetMode | m | Modo do pincel (`hide`/`reveal`) |
| dMaskSetSize | v | Tamanho do pincel de máscara |
| dMaskExit | save | Sai (salva em `l.mask` ou restaura) |
| dMaskShowToolbar | — | Renderiza a barra flutuante `#d-mask-toolbar` |
| dMaskRenderProps | l | Seção de máscara no painel de props |

### js/designer/fonts.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dFontsPersist / dFontsRestore | — | Salva/restaura fontes (`yngs_fonts_v1`) |
| dFontRegister | f | Registra via FontFace API e re-renderiza |
| dFontUniqueFamily | base | Nome de família único |
| dFontUpload | input | Valida e carrega .ttf/.otf/.woff/.woff2 (máx 3MB) |
| dFontRemove | i | Remove fonte (textos voltam p/ Roboto) |
| dFontsRenderList | — | Lista de fontes enviadas |
| dFontOptionsHTML | currentVal | `<option>`s dos seletores (Roboto + custom) |
| dPopFontSelects | — | Repovoa o select `#dp-font` |

### js/designer/templates.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dDefaultFolders | — | Pastas das campanhas + "⭐ Modelo de exemplo" (1 template showcase) |
| dBuildShowcaseLayers | fmt | Layers do template-modelo polido |
| dPreloadFolders | — | Pré-carrega pastas/`dVars`/fontes no boot; migra permissões/âncoras |
| dDefaultPublishMeta | — | Meta padrão de publicação (rascunho, validade +30d) |
| dExtractTemplateVars | layers | Extrai variáveis usadas (`{{}}` + `imgVar`) |
| dBuildLayers / dBuildBlankLayers / dBuildBlankLayersWH | fmt / fmt / w,h | Layers de template promo / em branco |
| dGetActiveAB / dSyncLayersToAB | — | Canvas ativo / sincroniza `dLayers` → estrutura de Canvas Único |
| ~~dNewArtboard~~ | fmt, posX, posY | **[OBSOLETA/REMOVIDA]** (Substituída por Novo Documento no Canvas Único) |
| ~~dSetActiveAB / dDeleteAB / dRenameAB / dDuplicateAB~~ | id | **[OBSOLETAS/REMOVIDAS]** (Controles de múltiplos artboards removidos) |
| ~~dRenderABList~~ | — | **[OBSOLETA/REMOVIDA]** (Aba de lista de pranchetas removida) |
| dPersistArtboards | — | Salva o canvas atual (`yngs_artboards_v1`) |
| dInit | — | Inicializa o designer (idempotente, configurando o canvas único) |
| dRenderFolders | — | Árvore de campanhas/pastas (exibe pastas e templates compactos com suporte a hover preview de capa e botões de importação contextual) |
| dLoadTemplateById | folderId, tmplId | Acha e chama `dLoadTemplate` |
| dTemplateMenuOpen | ev, folderId, tmplId | Menu de contexto do template |
| dToggleTemplatePublish | folderId, tmplId, publicar | Marca `publicado` e persiste |
| dDeleteTemplate | folderId, tmplId | Exclui template |
| dQuickEditValidade / dQuickEditPerms | folderId, tmplId | Validade rápida / abre publicação na aba permissões |
| dToggleFolder | id | Expande/recolhe pasta |
| dLoadTemplate | tmpl, folder | Carrega template no artboard ativo |
| dPopFolderCampaignSelect / dFolderRenderGroups / dFolderGroupChange | ... | Modal de pasta (campanha, grupos de acesso) |
| dFolderToggleAdv / dFolderToggleSchedule / dFolderUpdateCoverPreview | — | Avançado / agendamento / preview de capa |
| dFolderCoverUpload / dFolderClearCover / dCompressCover | ... | Capa da pasta (upload, limpar, comprimir) |
| dCloseFolderModal / dOpenNewFolder / dEditFolder / dConfirmFolder | — / — / id / — | CRUD do modal de pasta |
| dRenameFolder / dDeleteFolder / dFolderMenu | id / id / ev,id | Renomeia/exclui/menu da pasta |
| dOpenNewTemplate / dConfirmTemplate | — | Modal de novo template (em branco) |
| _dSvgProp | el, name | Lê prop SVG: atributo OU `style=""` inline |
| dSvgImport | — | Entry point do import de SVG |
| dSvgHandleFile | svgText, fileName | Parseia SVG, extrai dimensões/elementos, abre revisão |
| dSvgExtractElements | svgEl, docW, docH | Achata grupos 1 nível e extrai elementos |
| dSvgGetName | el | Nome do elemento (`inkscape:label`/`data-name`/`id`) |
| dSvgParseElement | el, name, docW, docH | Despacha por tag |
| dSvgParseText / dSvgParseRect / dSvgParseCircle / dSvgParseImage / dSvgParsePath | el, name, docW, docH | Parsers por tipo |
| _dSvgPathBBox | d | ⚠ Estima bbox do path (números do `d` como pares x,y) |
| dSvgSuggestVarName / dSvgSuggestImgVar / dSvgMapFont | ... | Heurísticas de nome de var/fonte |
| _dSvgEsc | s | Escapa string p/ HTML |
| dSvgShowReviewModal / dSvgBuildReviewHTML / dSvgModesForType | ... | Tela de revisão do SVG |
| dSvgRevSetMode / dSvgRevSetVar / dSvgRevCancel / dSvgRevConfirm | ... | Interações da revisão |
| dSvgCreateTemplate | elements, meta, fmt | Cria layers + template rascunho na 1ª pasta |

### js/designer/publish.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dGetActiveTemplate | — | Template ativo + sua pasta |
| dPublishPanelRender | — | Resumo de publicação na sidebar |
| dPublishOpen / dPublishClose | — | Abre/fecha o modal |
| dPublishSwitchTab | tab, btn | Troca a aba do modal |
| dPublishRender | — | Renderiza todas as abas |
| dPublishRenderArtboards | — | Cards de pranchetas (checkbox, thumb, nome) |
| dPubIsLight | hex | Contraste do texto da thumb |
| dPubRenderPreview / dPubHidePreview | ab, cardEl / — | Preview real no hover |
| dPubToggleAB / dPubSelectAllAB | id / sel | Seleção de pranchetas |
| dPublishRenderPerms / dPublishUpdatePerm | — / varName, key, value | Permissões por variável |
| dPublishConfirm | — | Cria/atualiza templates publicados e persiste |
| dSetSaveState / dMarkUnsaved | state / — | Estado de gravação |
| dPreview | — | Atalho → `dPreviewOpen` |
| dStats | — | Contador de layers |
| (keydown) | e | Listener global de atalhos do designer |
| (beforeunload) | e | Avisa se há alterações não guardadas |

### js/designer/preview.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dPreviewSetScale / dPreviewSetType | v | Escala (1×/2×/3×) / tipo (PNG/JPEG) de export |
| dPreviewOpen / dPreviewClose | — / e | Abre/fecha o modal de preview |
| dPreviewSetFmt / dPreviewSetDevice | fmt,btn / dev,btn | Troca formato / shell de dispositivo |
| pvRender | — | Renderiza o preview (smart-resize se fmt ≠ prancheta) |
| pvRenderLayers / pvRenderLayer | ctx,layers,W,H,idx,done / ctx,l,W,H,next | Renderiza layers (vars → `[Rótulo]`); aplica máscara |
| pvRenderFramePlaceholder / pvRoundRect | ctx,l,r / ctx,x,y,w,h,r | Placeholder de moldura / retângulo arredondado |
| pvApplyDevice / pvUpdateSidebar | — | Shell de dispositivo / sidebar (info, layers, checklist) |
| dBuildTemplateFilename / dExportFilename | fmtKey | Nome do arquivo (PNG/JPG) |
| dPreviewDownload / dPreviewDownloadAll | btn / — | Baixa formato atual / os 3 formatos |
| pvRenderToBlob | fmt, cb | Render offscreen → blob (JPG ganha fundo branco) |
| dExportSVGTemplate / dExportSVGFilled | — | Exporta SVG com `{{vars}}` / preenchido |
| dSvgColor / dSvgShape / dSvgText / dSvgImage | ... | Geradores de fragmentos SVG |
| _dB64 / dSvgFontFace / dSvgCustomFontFaces | buf / — / layers | base64 / embute Roboto / fontes custom |
| dExportSVG | opts | Monta e baixa o SVG completo |

### js/designer/library.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dTogglePanel / dToggleResources / dResourcesTab | panel / open / which | Painel esquerdo / drawer de recursos |
| dToggleTheme | — | Alterna tema claro/escuro |
| dLibRenderCats / dLibSetCat / dLibRender / dLibFilter | ... | Biblioteca de assets (categorias, grade, busca) |
| dLibUpload / dLibUse / dLibDelete / dLibNewCat | ... | Upload / aplicar / remover asset / nova categoria |
| dDuplicateLayer | — | Duplica o layer selecionado (+20,+20) com histórico |
| dStartInlineEdit / dEndInlineEdit | l, elDiv / e, cancel | Edição inline de texto (autocomplete + auto-cria vars) |
| dLayersPanelResizeStart | e | Redimensiona o painel de layers |
| dHexSync / dHexInput | ... | Sincroniza/valida inputs hex de cor |
| dToggleLock | e, id | Bloqueia/desbloqueia layer |
| _dEsc | s | Escapa string p/ HTML |
| dLoadSnippets / dSaveSnippetsStore | — | Carrega/persiste blocos (`yngs_snippets_v1`) |
| dSaveSnippet / dInsertSnippet / dDeleteSnippet / dRenderSnippets | ... | CRUD de blocos reutilizáveis |
| (DOMContentLoaded) | — | Drag&drop no dropzone da biblioteca |
| (wheel Ctrl/Cmd) | e | Zoom ancorado no cursor |
| (ResizeObserver IIFE) | — | Re-centraliza a prancheta ao redimensionar |

> ⚠ `dStartInlineEdit`/`dEndInlineEdit`/`dDuplicateLayer` vivem **aqui** em `library.js` — são chamadas por `canvas.js`/`undo-redo.js` (cross-file global), não estão ausentes.

### js/designer/psd-import.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dLoadAgPsd | — | Carrega a lib ag-psd (vendorizada → ⚠ fallback CDN) |
| _dPsdHex / _dPsdTextStyle / _dPsdAlign | ... | Helpers de leitura (cor, estilo, alinhamento) |
| _dPsdFontSize | t, h, content, res | ⚠ fontSize robusto (corrige por transform/DPI, ancora na caixa) |
| _dPsdEffects | node | Sombra/contorno de `layer.effects` |
| _dPsdSolidColor / _dPsdHasAlpha / _dPsdRasterURL | canvas | Cor sólida / alpha / dataURL (⚠ ≤1600px) |
| _dPsdBox / _dPsdLayerMaskCanvas / _dPsdClipMaskCanvas / _dPsdComputeMask | node[, base] | Caixa / máscara / clipping / composição |
| _dPsdSuggestVar | name, content | Sugere nome de variável |
| _dPsdRebuildNode / _dPsdResolution / _dPsdReadPsd | ... | Reconstrói node (worker) / DPI / parse (worker+fallback) |
| dPsdDetectFmt | w, h | Detecta formato pela proporção (story/feed/wide) |
| dPsdParseItems | psd, res, ox, oy | Achata a árvore → itens intermediários (offset p/ artboards) |
| dItemToLayer | it | Item revisado → layer Luma |
| dPsdOpenReview / dPsdRenderRows | — | Modal de revisão por camada |
| dPsdSetMode / dPsdSetVar / dPsdSetInclude / dPsdUpdateCount | i, ... | Interações da revisão |
| dPsdCancel | — | Cancela (⚠ aborta a sequência multi-prancheta) |
| dPsdConfirmImport | — | Confirma: layers, z-order, auto-cria vars; prancheta ou callback |
| dImportLayersAsArtboard | w, h, layers, name, fmtChoice | Cria a prancheta no editor (reflow opcional) |
| _dPsdEsc | s | Escapa string p/ HTML |
| dPsdShowArtboardSelector / dPsdBuildArtboardSelectorHTML | psd, artboards, res, baseName / items | Seletor de pranchetas (multi-artboard) |
| dPsdAbToggle / dPsdAbSetFmt / dPsdAbCancel / dPsdAbConfirm | ... | Interações do seletor |
| dPsdProcessArtboardsSequence | psd, items, res, baseName, folderId, idx, results | Revisão de cada prancheta em sequência |
| _dPsdReflowToFmt | layers, w, h, fmt | Reflow das layers para o tamanho do formato |
| dPsdSaveArtboardTemplates | results, folderId, baseName | 1 template rascunho por prancheta na pasta |
| _dPsdBusy | on | Overlay "Lendo PSD…" |
| dImportPSD | input | Handler: valida (⚠ máx 200MB), parseia, decide multi/single |

### js/designer/tutorial-panel.js
| Função | Parâmetros | O que faz |
|---|---|---|
| dRenderTutorialPanel | — | Guia em acordeão (`DTUT_SECTIONS`) na aba Tutorial |
| dTutToggle | i | Abre/fecha uma seção |
| dTutLoadExample | — | Carrega o template-modelo (reconstrói se a pasta sumiu) |

### js/tutorial/engine.js
| Função | Parâmetros | O que faz |
|---|---|---|
| tutSceneTimeout / tutClearSceneTimers | fn, ms / — | Timeout cancelável / limpa timers da cena |
| tutOpen / tutClose / tutAskClose | id / — / — | Abre / fecha / fecha-com-confirm |
| tutGoToScene / tutRenderScene | idx | Anima e renderiza a cena (build + after + tooltip) |
| tutShowTooltip | config | Posiciona `#tut-tooltip` (placement + clamp) |
| tutMoveCursor | targetSel, action | Move `#tut-cursor` e simula clique |
| tutRenderProgress / tutUpdateProgress / tutUpdateButtons | — | Dots de progresso e rótulo do next |
| tutNext / tutPrev | — | Navegação de cena |
| tutTogglePlay / tutPlay / tutPause | — | Auto-advance (play/pause) |
| tutShowFinale / tutReplay | — | Tela final (grava `yngs_tutorials_done`) / reinicia |
| (keydown) | e | Esc/→/←/Espaço na stage aberta |

### js/tutorial/catalog.js & catalog-studio.js
Majoritariamente **dados**. `catalog.js` define `const TUTORIALS` com 4 tutoriais; `catalog-studio.js` estende via `Object.assign(TUTORIALS, {...})` com 14. Estrutura: tutorial `{title, description, duration, scenes:[{id, duration, build()→html, tooltip?, after?}]}`. Helpers locais de `catalog-studio.js`: `_tutIntro(svgPath, titulo, resumo, grad)` (cena de intro padrão) e `_tutKeyRows(rows)` (grade tecla+descrição animada).

### js/tutorial/mocks.js & mocks-studio.js
Builders de HTML (telas falsas para demonstração). `mocks.js` (claro/franqueado): `tutMockCampaign`, `tutMockMaterial`, `tutMockHist`. `mocks-studio.js` (escuro/Estúdio): `tutStudioTool`, `tutStudio`, `tutArtCanvas`, `tutLayerRow`, `tutPanelCard`, `tutVarPill`, `tutKey`, `tutChip`.

---

## 9. IDs HTML CRÍTICOS

IDs referenciados diretamente por JS (`getElementById`) — "sagrados", renomear quebra chamadas no HTML.

### Globais / topo
| ID | Usado por | O que é |
|---|---|---|
| `g-toast` | gToast | Elemento do toast global |
| `g-help-modal` / `g-help-tut-catalog` / `g-help-search` | help.js | Central de Ajuda (modal, catálogo, busca) |
| `sp-overlay` | splash.js | Overlay da splash screen |
| `tab-fran` / `tab-design` | main.js | Abas de modo |
| `topbar-right-fran` / `topbar-right-design` | main.js | Blocos da topbar por modo |

### Franqueado
| ID | Usado por | O que é |
|---|---|---|
| `f-catalog` / `f-hist-tab` | catalog.js | Catálogo de campanhas / aba histórico |
| `camp-rec` / `camp-main` / `camp-other` | catalog.js | Recomendada / ativas / outras |
| `f-fmt-wrap` / `f-fmt-row` / `f-search-row` | catalog/chat.js | Seletor de formato / busca |
| `f-chat-col` / `f-material-view` | materials.js | Coluna do chat / view de materiais |
| `f-messages` / `f-msg-box` / `f-char-count` / `f-snd` | chat/chat-input.js | Chat (mensagens, input, contador, enviar) |
| `f-ctx-tag` / `top-camp-pill` / `prog-fill` | chat.js | Contexto (campanha·formato) / progresso |
| `lp-canvas` / `lp-fields` / `lp-sub` | live-preview.js | Live preview (canvas `<canvas>`, campos, status) |
| `hist-badge` | history.js | Badge de contagem do histórico |
| `f-preview-modal` / `pv-title` / `pv-note` / `pv-multi` | live-preview.js | Modal de prévia multi-formato |
| `f-bulk-modal` / `f-bulk-status` / `f-bulk-preview` / `f-bulk-dl-btn` | png-generator.js | Geração em lote (CSV) |

### Designer — canvas/edição
| ID | Usado por | O que é |
|---|---|---|
| `d-canvas-wrapper` / `d-workspace` / `d-canvas-container` / `d-canvas-bg` / `d-canvas-frame` | canvas/layers/brush.js | Viewport → workspace → container → frame (onde os `.canvas-layer` vivem; `transform:scale` = zoom) |
| `d-paint-canvas` | brush/undo.js | Canvas de pintura (z-index 50) |
| `d-marquee` | canvas.js | Retângulo de seleção por arrasto |
| `d-ctx-bar` | canvas.js | Barra contextual dinâmica |
| `d-no-sel` / `d-props-form` | layers.js (dShowProps) | Placeholder "nada selecionado" / formulário de props |
| `dp-x` / `dp-y` / `dp-w` / `dp-h` | dShowProps, dUpdateProp | Inputs de posição/tamanho |
| `dp-content` / `dp-font` / `dp-fsize` / `dp-align` | dShowProps | Conteúdo/fonte/tamanho/alinhamento (texto) |
| `dp-color-*` / `dp-fill-*` / `dp-opacity` / `dp-radius` | dShowProps | Cores, opacidade, radius |
| `dp-imgurl` / `dp-imgfit` / `dp-imgvar` / `dp-frame-*` | dShowProps | Imagem/moldura |
| `d-text-props` / `d-shape-props` / `d-image-props` | dShowProps | Seções por tipo |
| `d-layers-list` / `d-layers-panel` | dRenderLayersList | Lista lateral de layers |
| `dtool-<tool>` | dSetTool | Botões da toolbar (1 por ferramenta) |
| `dbtn-undo` / `dbtn-redo` | undo-redo.js | Botões undo/redo |
| `d-zoom-val` / `d-dim-label` / `d-ab-active-label` | canvas/templates.js | Labels de zoom/dimensão/prancheta ativa |
| `d-brush-bar` / `d-brush-opts` / `d-brush-size` / `d-brush-val` / `bb-*` | brush/canvas.js | Opções do pincel (size sincroniza com cursor dinâmico) |
| `d-mask-toolbar` | mask.js | Barra flutuante de máscara |
| `d-ruler-h` / `d-ruler-v` | canvas.js | Réguas |

### Designer — dados/modais
| ID | Usado por | O que é |
|---|---|---|
| `d-panel-campaigns` | templates.js / main.js | Painel lateral de Campanhas |
| `d-folder-list` | dRenderFolders | Contêiner da árvore de campanhas/pastas |
| `d-hover-preview` | templates.js | Elemento flutuante de hover preview para capas |
| ~~`d-ab-list`~~ | dRenderABList | **[REMOVIDO]** Lista de pranchetas |
| `d-folder-modal` / `df-*` | templates.js | Modal de pasta (nome, cor, campanha, grupos, capa) |
| `d-tmpl-modal` / `dt-name` / `dt-folder` / `dt-fmt` | templates.js | Modal de novo template |
| `d-publish-modal` / `pub-folder` / `pub-validade` / `pub-instrucoes` / `pub-ab-grid` / `pub-perm-list` | publish.js | Modal de publicação |
| `d-preview-overlay` / `pv-canvas-el` / `pv-layers-list` / `pv-checklist` | preview.js | Modal/engine de preview |
| `d-var-modal` / `dv-name` / `dv-type` / `dv-label` / `dv-default` / `dv-options` / `dv-palette` | layers.js | Modal de variável |
| `d-var-ac` / `d-var-insert` / `d-vars-list` | layers.js | Autocomplete / inserir / lista de variáveis |
| `d-psd-modal` / `d-psd-rows` / `d-psd-fmt` / `d-psd-invert` / `d-psd-count` | psd-import.js | Revisão por camada do PSD |
| ~~`d-psd-ab-overlay`~~ / `d-psd-busy` | psd-import.js | Seletor de prancheta removido / overlay "Lendo PSD" |
| `d-svg-review-overlay` / `svg-rev-fmt` | templates.js | Revisão do import de SVG |
| `d-resources-drawer` / `d-lib-grid` / `d-lib-upload` / `d-snippets-list` | library.js | Drawer de recursos, biblioteca, blocos |
| `d-fonts-list` | fonts.js | Lista de fontes enviadas |
| `d-sim-modal` / `d-sim-body` | canvas.js | Modal de simulação |
| `d-save-indicator` | publish.js | Indicador de gravação |

### Tutorial
| ID | Usado por | O que é |
|---|---|---|
| `tut-stage` / `tut-stage-area` / `tut-scene` | engine.js | Stage, área de referência, cena atual |
| `tut-title` / `tut-finale` / `tut-finale-desc` | engine.js | Título / tela final |
| `tut-progress` / `tut-tooltip(-text/-step)` / `tut-cursor` | engine.js | Progresso / tooltip / cursor virtual |
| `tut-btn-prev` / `tut-btn-next(-label)` / `tut-icon-play` / `tut-icon-pause` | engine.js | Navegação e play/pause |

---

## 10. LIMITAÇÕES CONHECIDAS

### Estruturais (teto do produto)
- **Sem backend** — single-device, sem auth, sem multi-tenant. Maior gargalo.
- **Imagens não persistem** — `gPackImgUrl` mantém só ≤~70KB; grandes viram `'__local__'` e somem no reload (aviso via `gWarnImagesNotPersisted`). Vale para fotos, capas e imagens de layers.
- **Quota do localStorage** (~5MB) — fontes (base64, ~3MB/fonte), capas e folders competem pelo mesmo espaço; `dPersistFolders`/`dSaveHist`/`dSaveSnippetsStore` tratam `QuotaExceededError` com toast.
- **Módulo Analytics (p\*) não existe** — só planejado no CONTEXTO.

### Funcionais / parciais
- **`opacity`** só é aplicada no render de **shape**; em text/frame/image a propriedade é ignorada. ⚠
- **`gToast` não enfileira** — toasts em sequência rápida se sobrescrevem; só o último aparece. ⚠
- **Central de Ajuda sem abas reais** — é um catálogo único agrupado por 2 categorias (o CONTEXTO fala em "abas"). ⚠
- **`eyedrop`/`bucket`** operam só em texto/shape (não em moldura/imagem nem nos pixels do paint canvas). ⚠

### Import de PSD
- Fonte não-Roboto cai em Roboto (avisa para enviar a fonte na aba Assets).
- Web Worker tem timeout de 25s → cai pro main-thread; raster comprimido a ≤1600px.
- `fontSize` é estimado pela caixa quando o valor do PSD vem incoerente.
- z-order pode precisar de "inverter ordem" manual; clipping em cadeia usa só a camada imediatamente abaixo; gradientes/blend modes/smart objects/camadas de ajuste não são mapeados (achatados/ignorados).
- Tamanho máximo ~200MB.

### Import de SVG
- ⚠ Lê estilo de **atributo de apresentação OU `style=""` inline** — **classes via `<style>` NÃO são cobertas** (export do Illustrator com "Style: Internal CSS" perde cores/fontes).
- ⚠ `transform` (translate/matrix) em grupos/elementos é **ignorado** — coords tratadas como absolutas.
- ⚠ Grupos aninhados além de **1 nível** não são achatados.
- ⚠ Bounding box de `<path>` é **aproximada** (`_dSvgPathBBox` lê os números do `d` como pares x,y) porque `getBBox()` não funciona em DOM destacado do `DOMParser`; paths complexos (>3 sub-paths) saem como shape de baixa fidelidade (default: ignorar).

### Pontas soltas no código (candidatas a limpeza)
- ⚠ `js/franqueado/catalog.js` termina com um comentário órfão sem função abaixo (função truncada/removida).
- ⚠ `fStartChatPreservandoDados` (chat.js) parece não ser chamada por nenhum fluxo (código órfão/legado).
- ⚠ `fDownloadHist` (catalog.js) chama `fMarkHistBaixada` fora do try — pode marcar como "baixada" uma arte cujo PNG falhou.
- ⚠ `dMeasureText` (tools.js) tem um `return` morto dentro de um `forEach`.
- ⚠ `assets/fonts/realce-black.woff2` provavelmente ainda no disco, mas a fonte foi aposentada (não usada).

### Riscos de segurança (do CONTEXTO, ainda válidos)
- **XSS armazenado** — dados do usuário entram em `innerHTML` sem escape em vários pontos do chat/catálogo (há `_dEsc`/`_dPsdEsc`/`_dSvgEsc` em partes do designer, mas não é universal). Risco alto em produção com backend.
- **Sem handler global de erro** — throw assíncrono morre silencioso.
