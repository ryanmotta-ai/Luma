# LUMA — Documentação Oficial do Projeto

> **Fonte única de verdade.** Leia este documento do início ao fim antes de qualquer sessão de trabalho no projeto.
> Gerado em **2026-07-09** a partir do estudo completo dos docs anteriores + verificação direta do código e do repositório.
> Última atualização estrutural: **2026-07-15** (dashboard Dados removido; analytics permanece por extração SQL/BI).
> **Substitui:** `LUMA-CONTEXTO.md` · `LUMA-FEATURES.md` · `LUMA-INVENTARIO.md` · `LUMA-BACKUP.md` · `UX-WRITING-DESIGN.md`.
> **Companheiro vivo:** `LUMA-BACKEND-CHANGELOG.md` (registro append-only de toda mudança de backend).
>
> **Hierarquia de verdade quando algo divergir:** código > este documento > qualquer doc antigo. Se você encontrar divergência entre este doc e o código, o código venceu — corrija este doc.

---

## 1. O QUE É O LUMA

**Luma** é a plataforma interna de **creative automation** da **Delivery Much** (rede de franquias de delivery). Substitui ferramentas pagas (Deskfy, Placid) e trabalho manual de design.

Três papéis num único app (SPA em `index.html`):

- **Franqueado** (usuário final): escolhe uma campanha, responde um chat guiado (produto, preço, foto), e baixa a arte pronta (PNG/PDF) — sem saber design.
- **Designer** (equipe DM / "Estúdio"): cria templates num editor estilo Canva/Photoshop, define **campos** (variáveis) que o franqueado preenche, permissões e validade, e publica.
- **Gestão**: tudo acima + administração de usuários e leitura de analytics por SQL/BI.

A ponte entre designer e franqueado é o **sistema de campos** (`{{produto}}`, `foto_produto`…) com **um único interpolador** (`gInterpolate`) compartilhado entre a simulação do designer, o live preview e o gerador de PNG final.

### Módulos e status (2026-07-09)

| # | Módulo | Prefixo | Status |
|---|--------|---------|--------|
| 1 | **Franqueado** — catálogo + chat gerador de artes | `f*` | ✅ Produção (com backend) |
| 2 | **Designer/Estúdio** — editor visual de templates | `d*` | ✅ Funcional, em refino contínuo |
| 3 | **CRM Visual** — inapp/push para CleverTap | — | 💡 Ideia validada, nada implementado. Dependência: estudar formatos aceitos pelo CleverTap antes |

---

## 2. REGRAS DE OURO PARA AGENTES DE IA

1. **Leia este documento antes de qualquer sessão.** Não suponha — consulte. Divergiu do código? O código venceu.
2. **Patch cirúrgico.** Adicione sem quebrar o que funciona. `f*` e `d*` não podem regredir. A maioria das features toca 1–2 arquivos; se estiver abrindo mais de 3, provavelmente há um caminho mais simples.
3. **Confirme o plano antes de executar** mudanças grandes ou de design. Mostre o que vai mudar.
4. **Teste manual após cada fase** (abrir no navegador). Não há testes automatizados.
5. **Prefixos e IDs são sagrados.** Nunca renomeie funções ou IDs existentes — há chamadas cruzadas no HTML (`onclick="fNextStep()"`) e entre arquivos.
6. **Sem dependências e sem build.** Nada de npm/Vite/Webpack no front. Libs entram **vendorizadas** em `assets/vendor/`.
7. **Sem ES Modules.** Funções globais, `<script src>` sequenciais (60 scripts no `index.html`, ordem importa).
8. **Não faça commit automático.** Mostre o `git diff`, peça confirmação. Nunca use `git add .` sem revisar o que entra.
9. **Se ficou em dúvida, pergunte.** O estado global é frágil.
10. **Português brasileiro** na comunicação e em toda copy de UI.
11. **Backend:** RLS é a única fronteira de segurança (anon key pública no front). Toda mudança de backend entra no `LUMA-BACKEND-CHANGELOG.md`.
12. **Docs:** feature nova ou mudança estrutural → atualizar ESTE documento (seção correspondente).

---

## 3. STACK E ARQUITETURA

| Aspecto | Decisão |
|---|---|
| Front | Vanilla JS puro, sem framework, sem bundler, sem npm |
| Libs vendorizadas | `assets/vendor/`: Color Thief (paleta de fotos), Pica (resize Lanczos3), PapaParse (CSV), pdf-lib (PDF client-side), ag-psd (import PSD), supabase-js v2 UMD |
| Carregamento | `index.html` carrega ~60 `<script>` em ordem; tudo global |
| Estado | Variáveis `let` globais (`fState`, `dLayers`, `dFolders`, `dVars`, `gAuthState`…) modificadas diretamente + re-render manual |
| Persistência | **Offline-first**: localStorage é cache (boot rápido, síncrono); **Supabase é a fonte compartilhada** (cross-device). IndexedDB (`js/core/img-store.js`) como cache local de imagens grandes |
| Backend | Supabase (projeto **`uqrqzjafhigjuvtjqzid`**, plano Free) — Postgres + Auth + Storage. Front fala direto via anon key; **RLS é a única fronteira de segurança** |
| Render | Canvas 2D (PNG/preview), DOM absoluto (editor), SVG (export) |
| Roda | Abrindo `index.html` no navegador (Live Server do VS Code) |
| Repo | `github.com/ryanmotta-ai/Luma` (privado), branch `main` |

**Trade-off central:** zero fricção de setup/deploy, ao custo de não ter modularidade real, testes nem tipos. O acoplamento é controlado por convenção (prefixos, um arquivo por subdomínio).

### Boot (`js/main.js`)

`DOMContentLoaded` **async**: `await gLoadProfile()` (sessão Supabase real) decide login vs app → `fGoHome()` (home do franqueado) → dispara **6 syncs** de backend em background (variáveis, folders, fontes, snippets, biblioteca, artes). `setMode(m)` troca `body.mode-<m>`, alterna topbars e chama `dInit()` lazy (1ª vez). Franqueado (role) **não vê** o Estúdio (gate no front por role).

### Temas

`body.theme-light` presente = tema **claro**; ausente = **escuro**. Vale para TODOS os módulos (o body nasce `mode-franqueado theme-light`). O designer usa tokens `--d-*` (dark-first, redefinidos no claro); o franqueado usa tokens claros com overrides `body:not(.theme-light)` para o escuro.

---

## 4. ESTRUTURA REAL DE ARQUIVOS (verificada 2026-07-09)

```
Luma/
├── index.html                     # SPA: markup completo + 60 <script> em ordem
├── css/
│   ├── 00-tokens.css              # TODOS os tokens (paleta, motion, glass, logos)
│   ├── 01-reset.css
│   ├── 02-animations.css          # keyframes g* + guarda reduced-motion
│   ├── 03-fonts.css               # vazio (Realce Black aposentada; Roboto via Google Fonts no <head>)
│   ├── components/                # topbar, splash, tutorial, help-modal, user-profile, pages-tray
│   └── modules/                   # franqueado, franqueado_effects, designer, chat, catalog,
│                                  # live-preview, layers-panel, toolbar, all-tools, color-picker,
│                                  # publish-modal, topbar
├── js/
│   ├── 00-config.js               # HIST_KEY, CAMPS_ATIVAS/OUTRAS/IMPLEMENTACAO, FMTS,
│   │                              # regex/validação de var, gInterpolate, bindings, regras,
│   │                              # DFIELD_CATS/DFIELD_TYPES (ícones SVG), gPackImgUrl, polígonos
│   ├── 01-state.js                # fState inicial
│   ├── main.js                    # bootstrap: setMode(), boot async, syncs
│   ├── core/                      # auth, user-profile, supabase(.config)(.example), img-store,
│   │                              # layout (smart resize), toast (gToast+gEsc), help, splash
│   ├── franqueado/                # catalog (com HOME), materials, chat, chat-input, history,
│   │                              # live-preview, png-generator
│   ├── designer/                  # canvas, layers, templates, tools, brush, mask, blending,
│   │                              # eraser-tools, color-picker, measurement, selection, props-panel,
│   │                              # undo-redo, publish, preview, library, fonts, psd-import,
│   │                              # tooltip, tutorial-panel
│   └── tutorial/                  # engine, catalog (4), catalog-studio (14), mocks, mocks-studio
├── assets/
│   ├── logos/                     # luma-h-branca.png, luma-h-cor.png (+ DM legadas no disco)
│   ├── illustrations/             # empty states
│   ├── favicon.svg
│   └── vendor/                    # colorthief, pica, papaparse, pdf-lib, ag-psd, supabase.js
├── supabase/
│   ├── migrations/                # 13 migrations (schema luma.* completo — ver §14)
│   ├── seed.sql · apply_all.sql · config.toml · README.md
├── scripts/                       # backup-storage.js, restore-storage.js, gen-favicon.js
├── .github/workflows/backup.yml   # backup diário automatizado (ver §14.8)
└── docs/                          # LUMA.md (este) + LUMA-BACKEND-CHANGELOG.md
```

⚠️ Docs antigos citavam arquivos que **não existem** (`core/storage.js`, `core/utils.js`, `franqueado/upload.js`, `franqueado/confirm.js`, `designer/shortcuts.js`, `designer/theme.js`, `designer/topbar.js`) — a lógica deles vive consolidada nos arquivos acima. Confie nesta árvore.

---

## 5. CONVENÇÕES DE CÓDIGO

### Prefixos de funções JS (sagrados)

| Prefixo | Módulo | Arquivos |
|---------|--------|----------|
| `f*` | Franqueado | `js/franqueado/*.js` |
| `d*` | Designer | `js/designer/*.js` |
| `g*` | Global/core | `js/core/*.js`, `js/00-config.js` |
| `tut*` | Tutorial engine | `js/tutorial/*.js` |
| `pv*` | Preview engine | `js/designer/preview.js` |
| `sp*` | Splash | `js/core/splash.js` |
| `_x*` (underscore) | Helper interno do arquivo | qualquer |

### Prefixos de IDs HTML

`f-*` franqueado · `fh-*` home do franqueado · `d-*` designer · `dp-*` props panel · `dv-*` modal de campo · `dt-*`/`df-*` modais de template/pasta · `pub-*` publicação · `pv-*` preview · `vt-*` toolbar vertical · `bb-*` brush bar · `g-*` globais · `tut-*` tutorial · `sp-*` splash · `lp-*` live preview.

### Padrões obrigatórios

```javascript
// CERTO — função global, sem export
function fMinhaFuncao(param) { /* ... */ }

// Estado: let global + re-render manual
fState.tab = 'historico';
fRenderHist();

// Persistência SEMPRE com try/catch (quota)
try { localStorage.setItem(HIST_KEY, JSON.stringify(arr.slice(0, 50))); } catch(e) {}

// Feedback ao usuário SEMPRE via gToast — nunca alert() ou console.log()
gToast('Arte baixada!');            // sucesso
gToast('⚠ Selecione uma camada primeiro');  // alerta/erro

// Escape de dados do usuário antes de innerHTML — SEMPRE
el.innerHTML = `<b>${gEsc(nome)}</b>`;   // gEsc global (toast.js); _dEsc no designer

// Cores/espaçamentos via tokens de 00-tokens.css — nunca hex hardcoded (nem no JS)
roleEl.style.background = 'var(--dm-red)';
```

### O que NÃO fazer

- ❌ ES Modules (`import`/`export`) — não há build.
- ❌ `const` no escopo global para estado compartilhado — use `let`.
- ❌ Renomear funções/IDs existentes.
- ❌ Criar arquivo novo sem código pra colocar agora.
- ❌ Commit automático / `git add .` sem revisar.
- ❌ `innerHTML` com dado de usuário sem `gEsc`/`_dEsc`.
- ❌ Hex de cor solto (JS ou CSS) — token sempre.
- ❌ Emoji como ícone de UI — a linguagem é SVG inline (stroke, `currentColor`).

---

## 6. DESIGN SYSTEM E BRANDBOOK

### Paleta (tokens em `css/00-tokens.css`)

| Token | Hex | Uso |
|---|---|---|
| `--dm-orange` | `#FF9000` | Cor primária (seleção, acentos, superfícies display) |
| `--dm-orange-d` | `#F85400` | Laranja escuro — **fundo padrão de CTAs com texto pequeno** e texto laranja sobre claro |
| `--dm-red` | `#C81818` | Vermelho DM (preços, badge GESTÃO, perigo) |
| `--dm-yellow` | `#FFB900` | Amarelo (badges, identidade "campo" no escuro) |
| `--dm-orange-bg` / `--dm-orange-tint` | `#FFF2E0` / `#FFE0BD` | Fundos suaves |
| `--white` / `--off-white` / `--gray-light` / `--gray-mid` | `#FFF` / `#FAFAFA` / `#F2F2F2` / `#D4D4D4` | Neutros claros |
| `--text` / `--text-2` / `--text-3` | `#0A0A0A` / `#3A3A3A` / `#6B6B6B` | Texto (tema claro) |
| `--green` | `#22C55E` | Sucesso — **pontos/bordas/fundos apenas** |
| `--green-text` | `#22C55E` escuro / **`#15803D` claro** | Verde para TEXTO — vira com o tema (flip em `body.theme-light`) |
| `--d-bg`→`--d-surf3` | `#111`→`#333` | Superfícies do designer (dark) |
| `--d-text` / `--d-text2` / `--d-text3` | `#F0F0F0` / `#A0A0A0` / `#8A8A8A` | Texto do designer dark (`d-text3` foi `#666`, subiu para AA) |
| `--d-error` | `#FF6B6B` | Erro no dark |
| `--var-color` / `--var-bg` | `#FFB900` escuro / **`#8A6500` claro** | Identidade dos campos `{{var}}` — override no `theme-light` do designer |

### Regras de contraste (auditoria WCAG 2026-07-09)

- **Texto verde** → sempre `--green-text` (nunca `--green` como cor de texto): 5.0:1 no claro, 7.5:1 no escuro.
- **Texto amarelo/dourado de campo** → `--var-color` já resolve por tema (5.3:1 no claro via `#8A6500`).
- **Hints do designer** → `--d-text3` (4.6–5.0:1 no dark).
- **CTAs com texto branco pequeno (≤14px)** → fundo `--dm-orange-d` (3.35:1, AA-large), nunca `#FF9000` puro (2.27:1). `#FF9000` fica para superfícies display grandes.
- **Texto laranja sobre claro** → `--dm-orange-d` (grande/bold) ou `--dm-red` (pequeno, 5.8:1).
- **Aceitos como marca** (decisão consciente): branco sobre `#FF9000` na topbar/badges display; vermelho sobre amarelo nos badges bold caps curtos (3.39:1).
- Badges do histórico usam tons AA precedentes: `#8A6500` (rascunho) e `#15803D` (baixada).

### Motion (tokens)

Curvas: `--ease-standard` (geral), `--ease-out` (entradas), `--ease-in` (saídas), `--ease-spring`/`--ease-spring-soft` (pops).
Durações: `--dur-micro` 140ms · `--dur-fast` 180ms · `--dur-base` 260ms · `--dur-slow` 420ms.
Keyframes globais em `02-animations.css` (`gFadeIn`, `gFadeInUp`, `gPopIn`, `gFadeInRight`…) com guarda global de `prefers-reduced-motion`. **Sempre use os tokens** — nada de cubic-bezier/ms na mão.

### Tipografia e logos

- **Roboto** (Google Fonts no `<head>`), pesos 300–900. `font-weight:900` = "Roboto Black" (títulos da marca). **Realce Black foi aposentada** (`03-fonts.css` vazio; o valor `'Realce Black'` mapeia para Roboto 900).
- Fontes custom: designer envia `.ttf/.otf/.woff/.woff2` (máx 3MB) → FontFace API → referenciadas como `custom:Família` → persistidas no bucket `luma-fontes`.
- Logos: `--logo-h-branca` (fundos escuros/coloridos) e `--logo-h-cor` (fundos claros) apontam para as logos **Luma**; aliases DM legados apontam para as mesmas. Classes `.dm-logo--h-*`.

### Topbar global

Degradê sutil `#FF9400→#FA8200`, altura 52px. Esquerda: logo + seletor de modos (pill ativa **branca em todos os modos**, inativas a 85%). Direita: contexto do modo · Ajuda · perfil (badge de role + avatar + nome) · Sair (ícone discreto; vermelho `--dm-red` só no hover). Badge de role: GESTÃO = `--dm-red`/branco, EQUIPE DM = amarelo/vermelho, FRANQUEADO = tinta branca. Avatar sem foto = branco com iniciais em `--dm-orange-d`. Tintas de vidro unificadas: `rgba(255,255,255,.12)` + borda `.18`.

---

## 7. UX WRITING (obrigatório em toda copy nova)

**Voz:** parceira de trabalho competente — clara, direta, calma. PT-BR sempre. Erro sempre diz **o que fazer**. Terceira pessoa neutra ("Não foi possível salvar", nunca "Não consegui"). Nunca expor `e.message`, nome de função, `{{token}}` cru ou jargão de código.

### Glossário canônico (✅ usar / ❌ nunca)

| Conceito | ✅ | ❌ |
|---|---|---|
| Elemento da lista | **camada** | layer |
| Tela de trabalho | **prancheta** (interno) / **Canvas** (área) | artboard |
| Objeto geométrico | **forma** | shape |
| Dado editável pelo franqueado | **campo** | variável, var, token |
| Contorno | **traçado** | stroke, borda |
| Preenchimento | **preenchimento** | fill |
| Apagar permanente | **excluir** | deletar |
| Material salvo | **template** (interno) / **material** (catálogo do franqueado) | modelo, rascunho |
| Borrar / conta-gotas | **Borrar** / **Conta-gotas** | Smudge / Eyedrop |

Formatos com dimensão na 1ª aparição: `Story (1080×1920)` · `Feed (1080×1350)` · `Post wide (1200×628)`.

### Toasts

Sem ponto final; frase capitalizada normal. Sucesso sem emoji (ou só `✓` — padronizado). Alerta/erro com `⚠ ` + ação corretiva. Nada de zoo de emojis. Mesma ação = exatamente a mesma frase. Atalho vai no tooltip (`Nome da ferramenta (X)`), nunca no toast. Reticências `…` (1 caractere). Botões no infinitivo ("Publicar", "Criar campo"). Placeholders com `Ex.: `. Estados vazios = título curto + próximo passo.

---

## 8. SISTEMA DE CAMPOS (VARIÁVEIS) — O CORE

Fonte de verdade única em `js/00-config.js`, compartilhada entre designer (simulação/preview) e franqueado (PNG).

- **Sintaxe** `{{nome}}` — nome válido `[a-zA-Z0-9_]` (`gValidVarName`); regex única `gVarRegex()`.
- **Catálogo `dVars`** (array global, persistido em `yngs_vars_v1` + tabela `luma.variaveis`). Entrada: `{name, label, type, defaultValue?, example?, required, options?, palette?, maxLen?, category}`. Categorias (`DFIELD_CATS`): produto, preco, campanha, midia, outros. Tipos (`DFIELD_TYPES`, com rótulo humano + ícone SVG): `text`, `number`, `currency`, `date`, `image`, `select`, `color`, `boolean`.
- **Interpolador `gInterpolate(content, dados, opts)`**: troca `{{nome}}` por `dados[nome]` → `opts.defaults[nome]`; `opts.onEmpty:'remove'|'keep'`. Helpers: `gVarDefaults()`, `gAllVarsEmpty()` (todos os tokens vazios → layer não renderiza, evita "R$" órfão), `gTruthy`, `gResolveVar`, `gFieldSampleValue` (valor de exemplo por tipo), `gFieldSlugify` (rótulo → slug único).
- **Bindings** `l.bindings = {prop: varName}` via `gApplyBindings` — resolve props (fill, visible…) a partir dos campos. Só se aplica com dados (PNG/simulação), não no editor cru.
- **Regras** `l.rules = [{when:'empty'|'filled'|'maxLen', var, value?, then:'hide'|'show'|'shrinkFont'}]` via `gApplyRules`.
- **Auto-criação**: `dSyncVarsFromContent` varre `{{tokens}}` novos e adiciona ao catálogo (edição inline + imports PSD/SVG).
- **Sync backend**: `dPersistVars` (cache local) + `dPushVarsToBackend` (upsert por `name`, **não-destrutivo** — remoção só explícita via `dDeleteVarFromBackend`); `dSyncVarsFromBackend` no boot com merge.

---

## 9. MÓDULO FRANQUEADO (`f*`)

### Fluxo completo

Home em tela cheia (vitrine) → seleciona campanha → catálogo de materiais publicados (filtra expirados) → chat guiado (1 pergunta por vez, com máscara/validação e live preview lateral) → card de confirmação editável → gera arte → baixa PNG (2× supersampling) ou PDF → registrado no histórico (rascunho→baixada).

### Home (`fGoHome`/`fRenderHome` em `catalog.js`)

Estado inicial em tela cheia (`body.f-home-mode` esconde as colunas). Layout fluido (`clamp()`, container até 2000px, grids `auto-fill` com minmax fluido) — escala com a resolução. Fundo com glow laranja sutil da marca (claro/escuro). Conteúdo:
- Saudação por hora + nome do perfil, botão "Minhas artes".
- Busca **sticky** com glass (`.is-stuck` via scroll) — atalho de revelação por rolagem via IntersectionObserver (blocos `#fh-body>*` com `.in`; refresh silencioso/reduced-motion não animam; fallback try/catch marca tudo visível).
- "Continuar de onde parou" (até 3 rascunhos).
- Hero da recomendada (a popular **entre as que têm material**; nunca campanha vazia).
- **Vitrine honesta**: "Prontas pra usar" (com material publicado e válido) vs **"Em breve"** (cards ghost menores, `pointer-events:none`).
- **Miniaturas reais**: o 1º material válido da campanha é renderizado em ~360px pelo MESMO motor do PNG (`fRenderTemplateLayers`) numa fila assíncrona com cache por campanha (`_fCampThumbs`, invalida se o material mudar). Prioridade de capa: upload do designer > thumb renderizada > cor da marca. Padrão de segurança: `fState.material` save/restore condicional.

### Estado (`fState` em `01-state.js`)

`{camp, fmt, stepIdx, dados, done, editIdx, tab, material, materialView, categoria}` — `stepIdx:-1` = não iniciado, `>= perguntas.length` = confirmação; `dados` = `{idVar: valor}`; `material` = template publicado carregado.

### Campanhas e formatos (`00-config.js`)

`CAMPS_ATIVAS`, `CAMPS_OUTRAS`, `CAMPS_IMPLEMENTACAO` (onboarding de novos franqueados) — cada uma `{id, name, color, badge, expiraDias, popular, previewProd/De/Por, perguntas:[{id, texto, sugestoes}]}`. `FMTS`: story 1080×1920 · feed 1080×1350 · post 1200×628.

### Tipos de campo do chat (`chat-input.js`)

A fonte de verdade do tipo é `dVars[id].type`; `F_FIELD_TYPES` é fallback legado por nome (produto, precoDe, precoPor, codigo, desconto…). Resolução por 3 funções: `fGetFieldType(id)` (config efetiva com precedência permissão do designer > dVars > fallback), `fApplyMask(id, raw)` (formata sem rejeitar: moeda BR, desconto %/R$, código maiúsculo, texto truncado), `fValidate(id, val)` (required, maxLen, formato).

### Funções-chave

| Função | Arquivo | Papel |
|---|---|---|
| `fRenderHome` / `fHomeFillThumbs` | catalog.js | Home + fila de miniaturas reais |
| `fSelectCamp` → `fOpenMaterialCatalog` → `fSelectMaterial` | catalog/materials.js | Campanha → materiais → chat (gera perguntas das vars + permissões) |
| `fNextStep` / `fSend` / `fQR` / `fSaveAdv` | chat/chat-input.js | Passo a passo do chat (texto/upload) |
| `fMostrarConfirm` → `fConfirmarGerar` → `fGerarArte` | chat.js | Confirmação editável → arte + histórico |
| `fBaixar` / `fBaixarPDF` / `fOutroFormato` | chat.js | Download PNG/PDF, variação de formato |
| `fGenPNG` / `fGenPDF` / `fRenderCanvasHelper` | png-generator.js | Render final 2× supersampling |
| `fRenderTemplateLayers` / `fRenderOneLayer` | png-generator.js | **Motor de render** (reflow smart-resize, bindings, regras, máscaras, blend modes) — usado por PNG, preview, thumbs. ⚠ Lê `fState.material` (bg + tamanho nativo via `fMaterialSize`); para renderizar material arbitrário: save/restore de `fState.material` |
| `fUpdateLivePreview` | live-preview.js | Preview lateral em tempo real com placeholders |
| `fAddHist` / `fMarkHistBaixada` / `fGetHist` | history.js | Histórico (localStorage `dm_artes_hist_v2`, cap 50, dedup) + push pra `luma.artes` |
| `fBulkOpen` → `fBulkDownloadAll` | png-generator.js | Geração em lote via CSV (PapaParse) com fila/yield |
| `fResizeImageIfNeeded` | chat.js | Resize nítido via Pica (fallback canvas); Color Thief sugere paleta da foto |

### Motor de copy / legendas (combinatório, NÃO IA)

Gera 3 variações de **legenda** (Promo · Engajar · WhatsApp) pro post depois que a arte é criada — o "assistente de legenda". É **combinatório** (combina frases pré-definidas), não IA: alinhado ao `00_PRODUCT.md` §9 ("sugestão de conteúdo é auxiliar, não o produto"). Onde mora:

| Peça | Arquivo:função | Papel |
|---|---|---|
| Entrada (UI) | `chat.js` → `fGenCaptionSuggestions(dados, camp, formato)` | Extrai prod/de/por/val/desc do estado e chama o motor; devolve `[{id,label,text}]` pras abas. `fFetchAICaptionSuggestions` é só o **stub** pra plugar IA no futuro (hoje delega ao local) |
| Motor | `png-generator.js` → `fBuildCopy(prod, de, por, val, desc, format)` | Monta as 3 opções (op1 curta ≤120 p/ stories/promo, op2/op3 completas). Dedup **compartilhado** de gancho+corpo+CTA entre as 3 |
| Montador | `png-generator.js` → `_fAssembleCopy(...)` | Uma legenda = gancho + corpo + validade + CTA + hashtags. Cálculo de economia (economiaReais/Pct), formato feed vs stories, e pool `semPreco` quando `por` não tem dígito (ex.: "Ver no app") |
| Bancos | `png-generator.js` → `_COPY_BLOCKS` | Os dados combinados: `hooks` (por segmento + universal), `bodies` (comDesconto/semDesconto/comPercentual/semPreco, com placeholders `{prod}{de}{por}{val}{desconto}{economiaReais}{economiaPct}`), `ctas` (delivery/engajamento), `hashtags` (por segmento + universal + cidade) |
| Segmento | `png-generator.js` → `_fCopySegment(prod)` | Detecta o segmento (pizzas, lanches, japonesa, bebidas, sobremesas, refeicoes, porcoes, acai, saudavel, cafe, mexicana, massas, churrasco → senão `universal`). Detecção própria + fallback `fBulkAutoCategorize`; NÃO mexe no bulk |
| Copiar | `chat.js` → `fCopyCaption` / `_fActiveCaptionText` | Copia a aba ativa pra área de transferência; `_fArtCaptions[canvasId]` é o cache das legendas geradas |

**Como estender:** mais variedade → adicionar itens nos pools de `_COPY_BLOCKS`. Novo segmento → adicionar detecção em `_fCopySegment` **e** os pools `hooks[seg]`/`hashtags[seg]` correspondentes (corpos/CTAs são compartilhados). Placeholders novos → registrar em `_fInterpolate`.

---

## 10. MÓDULO DESIGNER / ESTÚDIO (`d*`)

### Arquitetura: Canvas Único

O editor opera com **um canvas por template** (a era multi-artboard acabou; funções `dNewArtboard`/`dRenderABList` etc. foram removidas). `dLayers` é a lista plana global de camadas; `dGetActiveAB()`/`dSyncLayersToAB()` fazem a ponte com a estrutura persistida. `dLayers[0]` = fundo visual.

### Ferramentas (toolbar vertical, atalhos)

`select` (V) · `text` (T) · `rect` (R, flyout de formas: elipse/triângulo/polígono/linha/estrela) · `frame` (F, moldura de foto) · `img` (M) · `brush` (B, presets round/soft/square/dotted/calligraphy) · `eraser` (E) · `stamp` (S) · `eyedrop` (I — só texto/forma) · `bucket` (G — só texto/forma) · grupo nitidez: `blur`/`sharpen`/`smudge` · `gradient`. Cursor dinâmico por ferramenta; pintura vive no `#d-paint-canvas` separado.

Outros atalhos: Ctrl+Z/Shift+Z (undo/redo, histórico coalescido cap 30 com pintura serializada), Ctrl+S (salvar), Ctrl+D (duplicar), Ctrl+G/Shift+G (agrupar), Ctrl+0/1/± (zoom), setas (mover 1px/10px), P (pré-visualização), ? (folha de atalhos), Esc (cancela contexto).

### Tipos de camada (`dLayers[]`)

Comum: `{id, name, type, x, y, w, h, visible, locked, opacity, mask, anchor, overrides, bindings, rules, groupId, blendMode}`.
- **text**: `content` (com `{{tokens}}`), `font` (`'Roboto Black'` ou `custom:Família`), `fontSize`, `color`, `textAlign`, efeitos (`strokeW/strokeColor`, `shadow/shadowColor`, `bg/bgColor`, `strikethrough`).
- **shape**: `fill`, `radius`, `shapeKind` (rect/circle/ellipse/triangle/polygon/star), `sides`/`points`/`inner`.
- **frame** (moldura): `imgUrl`, `imgVar` (default `foto_produto`), `objectFit`, `frameShape`, enquadramento (`imgScale`, `imgOffsetX/Y`).
- **image**: `imgUrl`, `imgVar`, `objectFit`.
⚠ `opacity` só é aplicada no render de **shape** (text/frame/image ignoram) — limitação conhecida.

### Painel lateral direito

Abas: **Camadas** (lista plana DnD + props contextuais `dShowProps` na mesma aba), **Dados** (Centro de Campos), **Campanhas** (árvore compacta Figma-style com hover preview e importação PSD/SVG contextual por campanha), **Assets/Recursos** (biblioteca, snippets, fontes).

### Centro de Campos (aba Dados — redesign 2026-07-09)

Linha compacta (ícone SVG do tipo tingido — único canal de cor — + nome + meta "Tipo · Obrigatório · N usos" + ponto de status verde/anel) com **detalhe em acordeão**: exemplo (só quando existe), **chips de uso clicáveis** (`dFieldFlashLayer` pisca a camada no canvas), ações ＋Inserir no texto (ou ＋Usar em moldura para tipo imagem — `dFieldUse`), Editar, Excluir. Filtros **Todos/Em uso/Livres** (pílulas laranja) + rodapé de inventário ("N campos · N em uso · N livres"). **Detecção de duplicata** por rótulo normalizado (aviso âmbar). Kebab `dFieldMenu` (Editar/Renomear/Onde é usada/Remover). Busca com "Criar {termo}". Categorias sticky com recolher.

### Publicação (`publish.js`)

Wizard em três etapas: **Qualidade** (linter + materiais), **Configuração** (campanha, validade, permissões `{edit, maxLen}` e instruções) e **Revisão** (pré-visualização pelo renderizador oficial + resumo). A configuração possui rascunho automático local, validação por etapa, confirmação explícita para publicar/republicar e retorno ao editor após o sucesso. `dPublishConfirm()` grava `publishMeta {publicado, publicadoEm, validade, instrucoes, permissoes}` no template e persiste → aparece no catálogo do franqueado. Os atalhos de `templates.js` carregam o material e encaminham para esse mesmo wizard; nenhum atalho publica diretamente.

### Preview/Export (`preview.js`, prefixo `pv*`)

Modal multi-formato (Story/Feed/Wide sem distorção via smart resize), shells de dispositivo, export PNG/JPEG 1–3×, **export SVG** com fontes embutidas (com `{{vars}}` ou preenchido), checklist de publicação.

### Import PSD (`psd-import.js`)

ag-psd vendorizado + Web Worker (timeout 25s → fallback main-thread). Fluxo: validação (máx ~200MB) → parse → multi-artboard? (seletor + revisão em sequência, 1 template rascunho por prancheta) → revisão por camada (Texto editável / Campo `{{}}` / Cor / Imagem fiel) → import com auto-criação de campos e reflow. Fidelidade: cor sólida, sombra/contorno, fontSize corrigido por DPI, máscaras + clipping, opacidade de grupos acumulada, remap de fontes (com upload na hora na tela de revisão), heurística de z-order. Limitações: 1 estilo de texto por camada, shapes vetoriais viram raster/cor, gradientes/smart objects/camadas de ajuste ignorados, raster ≤1600px comprimido.

### Import SVG (`templates.js`)

DOMParser puro. Suporta text/tspan, rect, circle/ellipse, image, path (bbox aproximada), transforms afins com pilha de matrizes, CSS por prioridade (inline > classe > atributo > herança), fontes Illustrator mapeadas. Revisão por elemento → template rascunho. ⚠ Grupos achatados em 1 nível.

### Smart Resize multi-formato (`js/core/layout.js`)

- Tamanho escala por fator único `s = min(W₁,H₁)/min(W₀,H₀)` → **nunca distorce**.
- Posição re-ancora por eixo: `l.anchor = {h: left|center|right|stretch, v: top|middle|bottom|stretch}` (inferência automática `gInferAnchor`: menor margem vence; cobertura ≥94% → stretch).
- `l.overrides[fmtKey]` têm a palavra final.
- Funções: `gInferAnchor`, `gEnsureAnchors` (idempotente), `gReflowLayers` (retorna NOVO array), `gFmtKey` (`post`→`wide`).
- Usado por: `fRenderTemplateLayers` (PNG), `pvRender` (preview), `dSetFormat` (troca no editor com confirm), migração no boot.
- Verificação manual: Story→Feed no editor (título mantém canto, fundo cobre, nada esticado, Ctrl+Z desfaz); preview alterna formatos sem distorção; franqueado gera Story e Wide sem esmagar.

### Persistência do designer (offline-first)

`dPersistFolders`/`dPersistArtboards`/`dPersistVars` gravam no localStorage **e** disparam push em background para o Supabase (debounce; só para roles designer). Imagens base64 sobem para o Storage e viram URL pública. Sync no boot com merge não-destrutivo (preserva o que é local e ainda não subiu).

---

## 11. ANALYTICS (SEM FRONT)

O dashboard simulado foi retirado em 2026-07-15. Analytics real continua em `analytics.fct_eventos` e nas views `analytics.vw_*`, consumidas por **extração SQL/BI** (ver §14.6). Não existe rota, aba, CSS ou JavaScript de analytics no frontend.

---

## 12. TUTORIAIS E COMPONENTES GLOBAIS

- **Tutorial engine** (`tutorial/engine.js`): 18 tutoriais (4 franqueado + 14 estúdio) com cenas animadas, cursor virtual, tooltips, play/pause, mocks de tela (não tocam estado real). Conclusão grava `yngs_tutorials_done`.
- **Central de Ajuda** (`core/help.js`): botão flutuante, trilha, busca, guias rápidos, ajuda contextual e onboarding do franqueado. Tutorial → `tutOpen(id)`.
- **Toast** (`core/toast.js`): `gToast(msg, type, helpTopic?)` — 2.8s (4.2s erro). CTA de ajuda só existe com artigo explícito. ⚠ **Sem fila** — chamadas em sequência se sobrescrevem. Também: `gBtnLoading`, `gWarnImagesNotPersisted`, **`gEsc`** (escape HTML global).
- **Splash** (`core/splash.js`): overlay de entrada, mínimo 2.8s, tudo em try/catch.
- **Auth UI** (`core/auth.js` + `core/user-profile.js`): login/logout/reset de senha reais (Supabase), perfil com foto (localStorage `__luma_user_photo_*`), gestão de equipe (listar/role/ativo via RLS), `gUpdateUserTopbar`.

---

## 13. AUTENTICAÇÃO E ROLES

- **3 roles** em `public.profiles.role`: `franqueado` (1) < `equipe_dm` (2) < `gestao` (3) — `ROLE_HIERARCHY` em `auth.js`. `gIsAdmin()` = equipe_dm ou gestao; `gIsSuperAdmin()` = gestao.
- Login: `sb.auth.signInWithPassword`; logout real com `signOut`; reset por e-mail. Boot: `gLoadProfile()` = `auth.getUser()` + SELECT em `profiles` → popula `gAuthState`. **Nunca confiar em metadata do JWT** — sempre ler `profiles.role`.
- Gate no front: franqueado não vê o Estúdio (a RLS garante a proteção do conteúdo; o front só esconde).
- Criação/exclusão de usuário: **direto no Dashboard do Supabase** (decisão 2026-06-19; Edge Function admin ficou adiada).
- **Guard anti-auto-promoção**: trigger `guard_profile_role` no banco bloqueia UPDATE de role por não-gestão (testado: HTTP 400).

---

## 14. BACKEND SUPABASE

> Projeto **`uqrqzjafhigjuvtjqzid`** (banco próprio do Luma, plano Free — separado do DM CRM/Portal `gplxnzgsculryjykbcuo`). Toda mudança registrada em `LUMA-BACKEND-CHANGELOG.md`. Schema desenhado para eventualmente fundir com o DM CRM.

### 14.1. Arquitetura

Front Vanilla fala **direto** com o Supabase via `supabase-js` v2 vendorizado (`assets/vendor/supabase.js` → `window.sb` criado em `js/core/supabase.js`). Credenciais em `js/core/supabase-config.js` — **versionado** (repo privado; contém só URL + anon key pública). Sem credenciais, o app degrada para modo local (`gHasBackend()`). **RLS é a única fronteira de segurança.**

### 14.2. Schemas e tabelas

- `public.profiles` — estende `auth.users` (role, nome, departamento, ativo) + trigger `handle_new_user` + guard de role.
- `luma.pastas` · `luma.templates` (com publishMeta aberto em colunas) · `luma.variaveis` · `luma.fontes` · `luma.snippets` · `luma.biblioteca_assets` · `luma.artes` (histórico do franqueado, escopo por usuário; índice `idx_artes_template`).
- `analytics.fct_eventos` (event sourcing leve; INSERT autenticado em nome próprio, SELECT só gestão) + **6 views de extração** `analytics.vw_*` (artes_por_dia, uso_por_campanha, uso_por_formato, taxa_download, franqueados_ativos, templates_publicados) — `security_invoker`, **sem grant** para anon/authenticated (acesso só admin/SQL Editor).
- **RLS em tudo**: anon sem acesso; leitura autenticada; escrita de conteúdo só designer (`is_designer()`); `artes` por dono. Policies com `(select auth.uid())` (initplan otimizado).

### 14.3. Storage (5 buckets `luma-*`)

`luma-covers` (capas de pasta) · `luma-template-assets` (imagens de layers) · `luma-fontes` · `luma-user-uploads` (fotos do franqueado — **público**, viram arte pública) · `luma-renders` (privado). Fluxo: base64/idb:// no estado → upload → URL pública gravada no JSON/banco. Resolve o antigo "imagens somem no reload".

### 14.4. Sync offline-first (padrão de todas as entidades)

1. Escrita local síncrona (localStorage) → boot rápido nunca bloqueia.
2. Push em background com debounce (só designer para conteúdo; upsert por chave natural).
3. Sync no boot (`gOnLoginSuccess` → 6 syncs) com **merge não-destrutivo** — remoção no banco é sempre explícita (`dDeleteVarFromBackend`, `dDeleteFontFromBackend`…), nunca em massa (proteção contra um designer apagar o trabalho de outro).
4. Objetos ganham `remoteId` (UUID = PK no banco) **sem mexer no id interno**.

### 14.5. Hardening aplicado (estado: 0 ERROR no advisor)

- Guard anti-auto-promoção de role + anti-spoofing de eventos + teto de payload.
- `REVOKE EXECUTE` das funções de trigger e SECURITY DEFINER não-essenciais. ⚠ **Lição**: `get_user_role`/`is_designer` PRECISAM de EXECUTE (são avaliadas nas policies no contexto do usuário — revogar quebra o RLS; já aconteceu e foi revertido).
- Views de analytics `security_invoker = on`.
- **Exposed schemas** na API: só `public`, `graphql_public`, `luma` (NUNCA expor `analytics` ou schemas internos — já causou incidente de advisor).
- WARN aceitos: EXECUTE nos 2 helpers de policy + Leaked Password Protection (toggle do Dashboard).

### 14.6. Analytics

Decisão: **sem dashboard no app** — estudos saem por extração (SQL Editor/BI) nas views `analytics.vw_*`.

### 14.7. Migrations (13, em `supabase/migrations/`)

`initial_schema` → `content_schema` → `artes_schema` → `analytics_schema` → `storage_buckets` → `hardening` → `harden_definer_functions` → `fontes_extra_cols` → `analytics_views` → `perf_indexes` → `perf_rls_initplan` → `analytics_views_security_invoker` → `sec_revoke_trigger_funcs`. Mapa localStorage→Postgres em `supabase/README.md`.

### 14.8. Backup (GitHub Actions, diário 03:00 BRT)

`.github/workflows/backup.yml` — 2 jobs independentes: **db-backup** (`supabase db dump` de `public,luma,analytics` → `schema.sql.gz` + `data.sql.gz`) e **storage-backup** (`scripts/backup-storage.js` baixa os 5 buckets). Artifacts com retenção 90 dias. Secrets no GitHub: `SUPABASE_DB_URL` (**Session pooler** — IPv4; a Direct é IPv6-only e não conecta do Actions), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (só nos secrets, nunca no front/repo). Runner Node 22 (WebSocket nativo). Validado end-to-end 2026-06-25.

**Restore** — 3 cenários:
1. *Mesmo projeto*: `psql "<DB_URL>" -f data.sql` (baixar artifact, gunzip).
2. *Projeto novo*: migrations primeiro (`supabase db push`), recriar usuários no Dashboard (auth.users NÃO está no backup; trigger recria profiles), depois `data.sql`.
3. *Storage*: `node scripts/restore-storage.js` com `IN_DIR=./storage-backup` (upsert com mesmos paths → URLs voltam a funcionar).

`auth.users` não entra no backup (GoTrue). Migrations são a verdade da estrutura; o backup guarda dados + arquivos.

### 14.9. Checklist para mudanças de backend (lições do DM CRM)

Antes de criar/alterar tabela ou policy:
- [ ] RLS habilitado **com policy** (RLS sem policy = deny-all silencioso que quebra feature).
- [ ] Policy de UPDATE tem `WITH CHECK` (sem ele = vetor de escalonamento, ex. auto-promoção de role).
- [ ] `FOR ALL` sem `WITH CHECK` **bloqueia INSERT** — sempre explicitar.
- [ ] Nada controlado pelo cliente decide privilégio (role fixo em triggers de signup; snapshot de role server-side).
- [ ] Funções SECURITY DEFINER: `SET search_path` + REVOKE quando não são helpers de policy.
- [ ] Bucket público = conteúdo acessível pra internet inteira via URL — decisão consciente.
- [ ] Testar as 3 roles após a mudança.
- [ ] Registrar no `LUMA-BACKEND-CHANGELOG.md`.

---

## 15. PERSISTÊNCIA LOCAL

### localStorage (chaves reais, verificadas)

| Chave | Conteúdo |
|---|---|
| `yngs_folders_v1` | Pastas + templates + layers + capas + publishMeta (cache do banco) |
| `yngs_artboards_v1` | Canvas do designer |
| `yngs_vars_v1` | Catálogo de campos (`dVars`) |
| `yngs_snippets_v1` | Blocos reutilizáveis |
| `yngs_fonts_v1` | Fontes enviadas |
| `yngs_layers_v1` / `yngs_bg_v1` / `yngs_fmt_v1` / `yngs_wh_v1` | Estado do canvas em edição |
| `yngs_tutorials_done` / `yngs_fields_onboard_v1` / `yngs_help_visited` / `yngs_help_active_tab` | Flags de UX |
| `dm_artes_hist_v2` (`HIST_KEY`) | Histórico de artes (cap 50) |
| `luma_tb_cols` | Preferências de colunas |
| `__luma_user_photo_<email>` / `__luma_user_phone_<email>` | Perfil local |

Todo acesso com try/catch (quota ~5MB). `gPackImgUrl` mantém imagens ≤~70KB no JSON local; maiores vão pro Storage (URL) ou IndexedDB (`img-store.js`, refs `idb://`).

---

## 16. SEGURANÇA — ESTADO ATUAL

| Item | Estado |
|---|---|
| XSS armazenado (H.1) | ✅ **Corrigido** em 3 passes (core/franqueado/designer) — `gEsc` global + `_dEsc`; commits `17ce15f`/`69e2e22`/`e68c309`. Regra: TODO dado de usuário passa por escape antes de `innerHTML` |
| Auto-promoção de role | ✅ Bloqueada por trigger guard no banco (testada) |
| Anon key no front | ✅ By design — RLS protege; service role só em GitHub Secrets |
| Views/schemas expostos | ✅ Endurecidos (só public/graphql_public/luma na API) |
| Handler global de erro (H.3) | ⚠️ **Pendente** — throw async ainda morre silencioso (`window.addEventListener('error'/'unhandledrejection')` é barato) |
| Auditoria de mudança de role | ⚠️ Sem trilha (aceito por ora) |

---

## 17. LIMITAÇÕES CONHECIDAS E DÍVIDAS

**Funcionais:** `opacity` só em shape · `gToast` sem fila · eyedrop/bucket só texto/forma · PSD (1 estilo por camada, sem gradientes/smart objects, z-order às vezes manual) · SVG (classes em `<style>` não lidas, grupos 1 nível, bbox de path aproximada).

**Técnicas:** arquivos grandes (`canvas.js`, `layers.js`, `templates.js` ~1k linhas) · sem testes automatizados (regressão só no navegador) · pontas soltas conhecidas (`fStartChatPreservandoDados` órfã; `fDownloadHist` marca "baixada" mesmo se o PNG falhar; `return` morto em `dMeasureText`; `realce-black.woff2` órfã no disco).

**Produto:** plano Free do Supabase (retenção curta de logs/backup — mitigado pela rotina própria) · multi-prancheta de PSD vira templates separados mas o editor é canvas único.

---

## 18. GUIA PRÁTICO

### Adicionar campanha no catálogo
`js/00-config.js` → objeto em `CAMPS_ATIVAS` (id, name, color, badge, expiraDias, popular, previews, perguntas).

### Adicionar campo num template
1. Designer: layer de texto com `{{nome_da_var}}` (auto-cria no catálogo) ou aba Dados → ＋Novo.
2. Tipagem/label/exemplo no modal do campo (o chat do franqueado deriva pergunta, máscara e validação disso).

### Novo tipo de layer
`layers.js` (função `dAdd*` com `dHistoryPush` + `dLayers.unshift` + re-render) + `canvas.js` (case no `dRenderCanvas`) + `png-generator.js` (case no `fRenderOneLayer` — senão não sai no PNG!).

### Nova ferramenta na toolbar
`canvas.js` (`dSetTool`) + botão em `index.html` (`#d-vtoolbar`, id `dtool-<nome>`) + estilo em `toolbar.css`.

### Debug rápido (console)
```javascript
fState            // estado do franqueado
dFolders          // pastas/templates
dVars             // catálogo de campos
gAuthState        // sessão/role
JSON.parse(localStorage.getItem('dm_artes_hist_v2'))  // histórico
localStorage.clear(); location.reload();               // reset local (backend re-sincroniza)
```

### Verificação manual mínima antes de commitar
1. Franqueado: home → campanha → material → chat completo → PNG baixa.
2. Designer: abrir template → editar → Ctrl+Z → salvar → publicar → aparece no catálogo.
3. Trocar tema claro/escuro nos dois módulos.
4. Trocar formato (smart resize sem distorção).
5. Console sem erros novos.

---

## 19. LINHA DO TEMPO (condensada)

- **Fases 0–4**: refatoração modular (1 arquivo 9.3k linhas → dezenas), ferramentas de pintura, formas, efeitos de texto, sistema de campos completo (tipos ricos, bindings, regras), bulk CSV, export SVG, pastas com capa, fontes custom, 18 tutoriais, libs vendorizadas e Central de Ajuda unificada.
- **5.2 Smart resize**: motor de âncoras em `core/layout.js`, PNG/preview/editor sem distorção.
- **PSD/SVG import**: revisão por camada, multi-artboard, remap de fontes, máscaras.
- **Redesign do Estúdio**: canvas único, aba Campanhas em árvore, propriedades integradas às Camadas.
- **2026-06-18/19 — Fase 5.1 Backend**: projeto Supabase próprio, 13 migrations, auth real, persistência completa offline-first, Storage.
- **2026-06-22/25**: analytics por extração (views), performance (índices + RLS initplan), hardening pós-incidente, backup diário automatizado e validado.
- **2026-06-fim**: XSS corrigido (3 passes com `gEsc`), gate por role no front, refatoração de performance/memory leaks (Fase 3).
- **2026-07-09**: home do franqueado responsiva (thumbs reais, vitrine honesta, scroll-reveal, busca sticky), redesign do painel Campos (linha compacta + filtros + higiene), topbar (hierarquia + paleta), **auditoria de contraste WCAG aplicada** (tokens `--green-text`, `--var-color` claro, `--d-text3`, CTAs em `--dm-orange-d`). Este documento.

---

## 20. GOVERNANÇA DA DOCUMENTAÇÃO

- **Este arquivo (`docs/LUMA.md`)** é a documentação oficial. Feature nova, mudança de arquitetura, token novo, tabela nova → atualizar a seção correspondente AQUI.
- **`docs/LUMA-BACKEND-CHANGELOG.md`** continua como registro append-only de TODA mudança de backend (com data e migration).
- Docs substituídos por este (podem ser removidos): `LUMA-CONTEXTO.md`, `LUMA-FEATURES.md`, `LUMA-INVENTARIO.md`, `LUMA-BACKUP.md`, `UX-WRITING-DESIGN.md`.
- `LUMA-BACK_CONTEXT.md` e `LUMA-REGRAS_BACKEND.md` documentam **outro projeto** (Portal de Franqueados / DM CRM, Supabase `gplxnzgsculryjykbcuo`) — serviram de referência; as lições relevantes foram absorvidas no §14.9. Candidatos a remoção deste repo (vivem no repo do portal).
- Para inventário exaustivo de funções/IDs além do que está aqui: o código é o inventário — `grep` pelos prefixos.
