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
│                                  # publish-modal, topbar, academia
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
│   ├── academia/                  # academia (estado/dados/home), aula (player+abas), agente (IA),
│   │                              # gestao (equipe_dm), certificado — ver §21
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
- **Capa do card = capa da PASTA** (`fCampCover`): só a capa que o designer subiu no Estúdio. Sem capa → cor da marca + nome (placeholder programático). ⚠ A antiga fila de "miniaturas reais" (renderizava o 1º material da campanha e usava como capa — `_fCampThumbs`/`fHomeFillThumbs`, removida em 2026-07-30) mostrava a arte com os **campos vazios**: card em branco no boot ("pastas invisíveis") e a identidade da campanha trocada pelo conteúdo. Mesma regra do `01_BUSINESS.md`: pasta manda, capa vazia = removida de propósito.

### Estado (`fState` em `01-state.js`)

`{camp, fmt, stepIdx, dados, done, editIdx, tab, material, materialView, categoria}` — `stepIdx:-1` = não iniciado, `>= perguntas.length` = confirmação; `dados` = `{idVar: valor}`; `material` = template publicado carregado.

### Campanhas e formatos (`00-config.js`)

`CAMPS_ATIVAS`, `CAMPS_OUTRAS`, `CAMPS_IMPLEMENTACAO` (onboarding de novos franqueados) — cada uma `{id, name, color, badge, expiraDias, popular, previewProd/De/Por, perguntas:[{id, texto, sugestoes}]}`. `FMTS`: story 1080×1920 · feed 1080×1350 · post 1200×628.

**Tema por campanha (2026-07-23, 1º caso: Much+).** Campanha com `theme:'muchplus'` — ou pasta com badge "MUCH+" — re-tokeniza o app enquanto o franqueado está dentro dela: `fApplyCampTheme`/`fRemoveCampTheme` (materials.js) põem/tiram `body.camp-theme-<slug>`; os tokens do tema moram em `00-tokens.css`, o visual (véu de transição + motion do logo no header, `assets/motion/logo_muchplus.webm` VP9 com alpha) em `modules/franqueado.css`. Entradas: `fOpenMaterialCatalog`, `fEditFromHist`, early-return do `fSelectCamp`. Saídas: `fGoHome`, `fCloseMaterialCatalog`. ⚠ Nunca pendurar remoção no `fRestoreCatalog` (é re-render de rail, roda dentro da campanha). Pastas do banco propagam `theme` via `fGetCampaigns`.

**Na VITRINE o tema é sóbrio (decisão do Ryan, 2026-07-30 — não "restaure" o magenta).** O hero e o card da grade do Much+ eram chapados de `--muchplus-magenta`, com um filete amarelo de 5px entre a capa e o texto. Dois problemas: em ~56% de um card daquele tamanho o magenta roubava a atenção do conteúdo, e o filete lia como sobra de renderização em vez de divisória. Agora **o painel não tem cor própria** — herda o fundo do card, então claro e escuro saem de graça e o Much+ volta a pertencer à mesma vitrine das outras campanhas. A marca aparece só nos acentos: filete magenta no topo, olho-de-boi e CTA. **Quem carrega a identidade é a capa da campanha**, não o cromo em volta — por isso caiu também a marca d'água "MUCH+" que ficava no canto do painel: 100px de tipografia a 7% de opacidade só sujavam o fundo ao lado de uma capa que já diz a marca. O CTA usa `--muchplus-magenta-d` porque o `#F8006E` com texto branco dá só ~4.2:1 e o rótulo tem 12px. Dentro da campanha o tema segue re-tokenizando o app normalmente — a mudança é só na vitrine.

### Tipos de campo do chat (`chat-input.js`)

A fonte de verdade do tipo é `dVars[id].type`; `F_FIELD_TYPES` é fallback legado por nome (produto, precoDe, precoPor, codigo, desconto…). Resolução por 3 funções: `fGetFieldType(id)` (config efetiva com precedência permissão do designer > dVars > fallback), `fApplyMask(id, raw)` (formata sem rejeitar: moeda BR, desconto %/R$, código maiúsculo, texto truncado), `fValidate(id, val)` (required, maxLen, formato).

### Funções-chave

| Função | Arquivo | Papel |
|---|---|---|
| `fRenderHome` / `fCampCover` | catalog.js | Home da vitrine + capa da pasta no card |
| `fSelectCamp` → `fOpenMaterialCatalog` → `fSelectMaterial` | catalog/materials.js | Campanha → materiais → chat (gera perguntas das vars + permissões) |
| `fNextStep` / `fSend` / `fQR` / `fSaveAdv` | chat/chat-input.js | Passo a passo do chat (texto/upload) |
| `fMostrarConfirm` → `fConfirmarGerar` → `fGerarArte` | chat.js | Confirmação editável → arte + histórico |
| `fBaixar` / `fBaixarPDF` / `fOutroFormato` | chat.js | Download PNG/PDF, variação de formato |
| `fGenPNG` / `fGenPDF` / `fRenderCanvasHelper` | png-generator.js | Render final 2× supersampling |
| `fRenderTemplateLayers` / `fRenderOneLayer` | png-generator.js | **Motor de render** (reflow smart-resize, bindings, regras, máscaras, blend modes) — usado por PNG e preview. ⚠ Lê `fState.material` (bg + tamanho nativo via `fMaterialSize`); para renderizar material arbitrário: save/restore de `fState.material` |
| `fUpdateLivePreview` | live-preview.js | Preview lateral em tempo real com placeholders |
| `fAddHist` / `fMarkHistBaixada` / `fGetHist` | history.js | Histórico (localStorage `dm_artes_hist_v2`, cap 50, dedup) + push pra `luma.artes` |
| `fAskClearHist` (catalog.js) → `fClearHist` | history.js | Limpar a biblioteca. Confirmação `gConfirm` danger no porteiro; apaga `luma.artes` (policy "dono apaga suas artes") **antes** do localStorage — na ordem inversa o `fSyncArtesFromBackend` traz tudo de volta. Banco recusou → nada é apagado |
| Validade em "Minhas artes" (`_fHistVencida` / `_fHistBloqueiaVencida`) | catalog.js | Arte de material fora da validade não baixa, não duplica e não edita (as três terminam em PNG). Checagem na leitura (`publishMeta.validade` do sync), nunca em flag salvo; material não encontrado **não** bloqueia (falha aberta) |
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

### Caixa de texto: ponto × parágrafo (`textBox`) — 2026-08-05

Espelha o Photoshop. Quem decide é o campo **`textBox`** da camada:

| | **Ponto** (`textBox` ausente/`'point'`) | **Parágrafo** (`textBox:'box'`) |
|---|---|---|
| Como nasce | **clique** com a ferramenta Texto | **arrasto** com a ferramenta Texto |
| Caixa (`w`/`h`) | **modular**: `dTextFitBox` re-mede a caixa a cada mudança de conteúdo/tipografia | **fixa**: é o contrato: o texto quebra dentro dela |
| Quebra de linha | só em `\n` (`white-space:pre`) | por largura (`pre-wrap`) |
| Alça de canto | **escala a tipografia** (`fontSize`), caixa reabraça ao soltar | redimensiona a caixa, o texto re-quebra |
| Overflow | nunca (a caixa acompanha) | selo `text-overflow` por contagem de linhas |

**`dTextFitBox(l)`** (`tools.js`) é o motor único da caixa modular: mede com `dMeasureText` (agora com `letterSpacing`) sobre `dTextDisplayString(l)` — o texto **como aparece** (token `{{campo}}` já virou valor de exemplo/simulação, `textTransform` aplicado). Ao encolher a caixa, **re-ancora `x`/`y`** pelo `textAlign`/`vAlign`, porque render e `png-generator` posicionam o texto _dentro_ da caixa: sem compensar, texto centralizado/à direita andaria na tela. Fica de fora (retorna `false`): parágrafo, texto vertical e rich text (`runs`, tamanho por trecho).

Chamado nos funis de mutação — `dAddTextAt`, `dUpdateProp` (conteúdo/tipografia, **nunca** em `w`/`h`: ali o número é do usuário), `dEndInlineEdit` e `dStopResize`. ⚠ Camada antiga com caixa larga só reabraça na **primeira edição** — não há passe retroativo em massa (mexer em `w`/`h` no load quebraria o 1:1 dos PSDs importados).

A **edição inline** (`dStartInlineEdit`, `library.js`) é WYSIWYG: a `textarea` herda leading, tracking, caixa alta, itálico e peso, sem padding nem fundo, `wrap='off'` no ponto, `rows=1` antes de medir a altura, e cresce/re-ancora enquanto se digita.

### Ambiente de trabalho: rodapé da régua e barras da prancheta (2026-07-31)

**Rodapé da régua** (`.dpi-rail-foot`, dois botões no fim do `#d-vtoolbar`, fora da `.vt-tools-grid` de propósito — não são ferramentas de desenho e não somem no modo simples):

- **Atalhos de teclado** → `dOpenCheat()`.
- **Ocultar os painéis** → `dToggleChrome()` liga `body.d-chrome-off`, que esconde `#d-right`, `#d-pages-tray` e as ferramentas da régua, e encolhe o `#d-vtoolbar` para 48px. O próprio botão **nunca** é escondido: é o único caminho de volta. Não persiste (é gesto, não preferência) e reenquadra o canvas em +240ms.

**Barras da prancheta** — vivem dentro do `#d-canvas-container` e fora do `#d-canvas-frame`: o contêiner já é medido em pixels de tela e reposicionado por `_dSyncAllPositions`, então as barras acompanham zoom, scroll e pan sem JS de posição.

- **Acima, à direita** (`#d-page-bar`): bloquear edição · duplicar (`dDuplicatePageInTray`) · adicionar depois desta.
- **Abaixo, na largura da prancheta** (`.dpg-add-below`): `dAddPageAfterCurrent()` → `dAddPageToCurrentFolder(afterId)` insere a nova **logo depois** da atual (sem `afterId` continua indo pro fim, que é o que a bandeja usa) e `dPageEntranceAnim()` sobe a página nova com `@keyframes dpgEntra` (`--dur-slow`/`--ease-out`, desligada em `prefers-reduced-motion`).
- Sai de cena quando não há página gravada (`body.d-sem-pagina`) ou quando a bandeja de páginas está aberta (o filmstrip cobriria o botão). A pílula recolhida da bandeja foi para o canto direito para não cair sobre ele.
- `dFitToScreen` reserva 150px de folga vertical (era 80) para as duas barras nascerem dentro da área visível.

**Bloqueio de edição da página** — `dTogglePageLock`/`dPageLocked`, chave `yngs_pages_locked_v1`. É um **freio local contra edição acidental, por dispositivo**: não é permissão, não é fronteira de segurança (§16: a RLS é a única) e por isso não pede coluna no banco nem viaja no sync. `body.d-page-locked` desliga as quatro superfícies que mudam conteúdo — canvas (`#d-canvas-frame`), propriedades, lista de camadas e ferramentas da régua — e o dispatcher de atalhos (`publish.js`) barra o teclado deixando passar só Esc, zoom e `?`. A barra da página fica ativa: é por ela que se destrava. `dSyncPageLock()` é chamada de um lugar só, o topo de `dRenderPagesTray()`.

### Painel lateral direito

Abas: **Camadas** (lista plana DnD + props contextuais `dShowProps` na mesma aba), **Dados** (Centro de Campos), **Campanhas** (árvore compacta Figma-style com hover preview e importação PSD/SVG contextual por campanha), **Assets/Recursos** (biblioteca, snippets, fontes).

### Centro de Campos (aba Dados — redesign 2026-07-09)

Linha compacta (ícone SVG do tipo tingido — único canal de cor — + nome + meta "Tipo · Obrigatório · N usos" + ponto de status verde/anel) com **detalhe em acordeão**: exemplo (só quando existe), **chips de uso clicáveis** (`dFieldFlashLayer` pisca a camada no canvas), ações ＋Inserir no texto (ou ＋Usar em moldura para tipo imagem — `dFieldUse`), Editar, Excluir. Filtros **Todos/Em uso/Livres** (pílulas laranja) + rodapé de inventário ("N campos · N em uso · N livres"). **Detecção de duplicata** por rótulo normalizado (aviso âmbar). Kebab `dFieldMenu` (Editar/Renomear/Onde é usada/Remover). Busca com "Criar {termo}". Categorias sticky com recolher.

### Publicação (`publish.js`)

Wizard em três etapas: **Qualidade** (linter + materiais), **Configuração** (campanha, validade, permissões `{edit, maxLen}` e instruções) e **Revisão** (pré-visualização pelo renderizador oficial + resumo). A configuração possui rascunho automático local, validação por etapa, confirmação explícita para publicar/republicar e retorno ao editor após o sucesso. `dPublishConfirm()` grava `publishMeta {publicado, publicadoEm, validade, instrucoes, permissoes}` no template e persiste → aparece no catálogo do franqueado. Os atalhos de `templates.js` carregam o material e encaminham para esse mesmo wizard; nenhum atalho publica diretamente.

### Preview/Export (`preview.js`, prefixo `pv*`)

Modal multi-formato (Story/Feed/Wide sem distorção via smart resize), shells de dispositivo, export PNG/JPEG 1–3×, **export SVG** com fontes embutidas (com `{{vars}}` ou preenchido), checklist de publicação.

### Import PSD (`psd-parse.js` + `psd-import.js`)

Dois arquivos, uma responsabilidade cada: **`psd-parse.js` lê** (ag-psd, worker, camada → item intermediário, `dItemToLayer`) e **`psd-import.js` revisa/importa** (modal, abas de prancheta, prévia, relatório de fidelidade, criação dos templates). `psd-import.js` carrega DEPOIS, então **função de parse definida lá sobrescreve a de `psd-parse.js` em silêncio** — foi o que aconteceu de 29/07 a 05/08/2026 (36 funções duplicadas; o parse refinado ficou inteiro sem efeito). Leitura muda só em `psd-parse.js`.

ag-psd vendorizado + Web Worker (prazo ~1s/MB, teto 10min, renovado a cada sinal de progresso; abaixo de 150MB o buffer vai duplicado e há fallback main-thread, acima ele é transferido e o worker é o único caminho). Fluxo: validação (máx 500MB, `.psd`/`.psb`) → parse → **uma única tela de revisão**: multi-prancheta vira abas dentro dela (cada prancheta com suas próprias decisões, formato e destino; parse sob demanda) e um só "Importar" cria um template rascunho por prancheta; prancheta única cria a prancheta no editor. Por camada: Texto editável / Campo `{{}}` / Cor / Moldura de foto / Imagem fiel, com auto-criação de campos e reflow.

**Mapeamento camada → campo (auto + arrastar).** A sugestão é do parse: `_dPsdSuggestVar`/`_dPsdSuggestImgVar` consultam o **`dVars` real** (`_dPsdCatalogMatch`) antes do dicionário fixo de delivery, e `auto:true` já liga o modo campo; `_dPsdMemApply`/`_dPsdMemSave` guardam em `localStorage` (`yngs_psd_mem_v2`) só a **decisão** do usuário, ignorando nome genérico do Photoshop — o 2º PSD parecido abre pré-mapeado. Na revisão (`psd-import.js`): **trilha de campos** arrastáveis (`_dPsdRenderFieldRail`) com contador de camadas por campo e o número de **campos sem camada**; dois alvos de soltura — a linha da camada e a **própria arte** na prévia, via o hit-test único `_dPsdHitLayer` (compartilhado com o hover; respeita "Inverter ordem"); **guarda de tipo** `_dPsdBindCheck` (campo de imagem só em imagem/forma, campo de texto só em texto) que pinta o realce em vermelho **antes** do drop. Arrastar nunca é o único gesto: clicar no chip "pega" o campo e o clique seguinte na camada liga (`dPsdFieldArm`/`dPsdRowClick`), e cada linha tem um `<select>` de campos compatíveis + "Criar campo…" (o caminho por teclado). Sugestão que o parser não teve certeza de ligar aparece como botão **"Sugerido: X"** na linha, com "Aplicar N sugestões" no cabeçalho. Todo vínculo é só `it.mode`/`it.varName` — quem persiste é o `_dPsdMemSave` e quem cria o campo no catálogo é o `_dPsdSyncVarsFromLayers`, no import.

**Regra única de compatibilidade campo × alvo:** `gFieldFitCheck(campo, 'text'|'imagem')` em `00-config.js`. Campo de imagem só onde uma foto entra; qualquer outro tipo só em texto. Os dois chamadores falam vocabulários diferentes (`it.kind` no PSD, `l.type` na prancheta), normalizam e perguntam ali — a regra estava escrita duas vezes, com duas mensagens que divergiriam. Guardas de contexto (camada travada, base de recorte) ficam com cada chamador.

**Campo → prancheta por arrasto** (painel Campos, `layers.js`). O cartão de campo é `draggable`; soltar **numa camada** liga o campo (`dLayerBindField`, o bind único), soltar **no vazio da prancheta** cria a camada JÁ ligada no ponto (`dAddTextAt`/`dAddFrameAt` + bind — caso que não existia), e campo de imagem sobre uma **forma** converte em moldura (`dConvertLayerToFrame`). Roteado pelo pipeline de drop que o canvas já tinha (`canvas.js`, mime `application/x-luma-field` ao lado de `application/x-luma-asset`); o alvo sai de `e.target.closest('.canvas-layer')`, que é como o editor resolve quem está por cima. Guarda de tipo (`_dFieldCanBind`) avaliada no `dragover`: incompatível ou camada travada acende em vermelho **antes** de soltar. Um `Ctrl+Z` desfaz o gesto inteiro porque `dHistoryPush` é coalescido por microtask. Hover no cartão contorna as camadas que usam o campo. ⚠ **`props-panel.js` (`dPropEnhanceDataRows` + MutationObserver) REESCREVE os cartões depois do render** — remove `tabindex`, troca o `role`, transforma o nome num botão de detalhes e injeta o botão "Usar": por isso o arrasto vive no `.field-item` (que o passe não toca) e a linha não recebe clique próprio. O CSS do painel mora em `css/modules/layers-panel.css` com `#d-panel-dados` (especificidade de ID vence `designer.css`); o realce do alvo precisa de `body.d-fielddrag` na frente, senão perde do contorno fantasma do arrasto.

**Mapear com IA** (`dPsdMapWithAI`, botão na trilha). Manda pro Gemini a **imagem da arte** (`_dPsdArtePart`: a prévia, ou o composto do PS; sempre repintada sobre branco porque JPEG não tem alpha) + a lista de camadas com tipo/conteúdo/caixa + o catálogo real, e recebe `[{camada, campo, motivo}]`. Passa por `gAskAI` (`core/ai.js`, task `mapear-psd`) — motor único, chave no servidor; prompt montado no front como as outras tasks. A imagem é a razão de existir: o motor por nome não decide nada quando a camada se chama "Camada 5", e o papel do elemento está na arte. **A IA propõe, não decide:** o resultado entra como **sugestão pendente** (`varSource:'ia'`, `varWhy` = o motivo que ela deu, que vai pro `title` do badge "IA sugere: X") e o designer aceita uma a uma ou em "Aplicar N sugestões" — camada que ele já ligou nunca é tocada. Toda resposta é validada no cliente: índice fora da lista, campo fora do catálogo, tipo incompatível (`_dPsdBindCheck`) e camada repetida são descartados; **fundo virando moldura de foto é barrado por código** (`_dPsdLooksBackground` — nome de fundo ou ≥70% da prancheta), porque a mesma proibição existe no parse por bug real e um pedido no prompt não é guarda. O botão só aparece com `gAiReady()` e catálogo não vazio.

**Fidelidade:** cor e forma exatas do vetor (`vectorFill`/`keyOriginType` + caixa real do caminho, sem confundir a expansão do contorno com a geometria), gradiente linear/radial/refletido (cônico e losango rasterizam), sombra projetada/interna, brilho externo/interno, chanfro, sobreposição de cor e gradiente, contorno com alinhamento e tracejado, luz global do documento, `fontSize` por DPI + caixa de parágrafo 1:1, auto-entrelinha do PS, máscaras compostas em resolução adaptativa (700–1400px), **clipping vinculado à camada-base** (snapshot fiel até a primeira edição; depois acompanha a geometria ao vivo), árvore de grupos aninhados por `parentId` e composição isolada de máscara/opacidade/blend do grupo, e **camadas de ajuste dinâmicas** para Brilho/Contraste, Níveis, Curvas, Exposição, Vibração, Matiz/Saturação, Inverter, Posterizar e Limiar. Formas também preservam **pilhas múltiplas** de sombra projetada/interna, sobreposição de cor/gradiente e contorno; o renderer compõe todas as instâncias, e o painel enxuto edita a primeira de cada tipo sem desconectar o resultado. Ajustes respeitam ordem, grupo, máscara, clipping, opacidade e blend; seus parâmetros continuam editáveis no painel da camada. Remap de fontes com upload na hora, heurística de z-order e relatório de fidelidade por diff de pixel contra o composto do Photoshop completam o pipeline.

**Viram imagem fiel** (visual 1:1, sem edição): smart object, padrão, rotação, espelho/180°, texto em curva, texto com warp, pilhas múltiplas em texto/imagem e combinações de efeito que o modelo não representa. Tipos de ajuste ainda fora do motor (ex.: LUT, Cor seletiva, Mapa de gradiente) permanecem identificados na pilha como não aplicados — nunca são descartados em silêncio. **Perdas avisadas na revisão:** cetim, contorno customizado de efeito, escala de efeitos ≠100%, traço com gradiente/padrão, texto justificado (entra alinhado pela última linha), estilos mistos de texto.

**Resolução de raster:** teto adaptativo à prancheta — comum `min(3200, max(1600, 2×maiorLado))` a q0.82; o de fidelidade (única fonte do visual) nunca abaixo de 2400px, a q0.92. **Moldura de foto** nasce com a arte importada em `imgUrl`: a foto do franqueado a substitui, não é mais um espaço vazio. Nome de camada com `fundo`/`background`/`bg` **não** vira moldura (o fundo é a arte; o designer promove na revisão se quiser).

**Checklist (`linter.js`) — "Texto Fixo que Deveria Ser Campo".** O espelho do painel Campos: aponta a camada de texto cravada na mão que vai sair com o valor velho na próxima promoção. Precisão acima de recall (checklist que grita demais ninguém lê): só acusa com sinal forte — valor em `R$`, ou nome da camada casando com o catálogo pelo `_dPsdSuggestVar` com `auto:true` (o mesmo motor do importador). Três filtros cortam o falso positivo: texto >60 caracteres é disclaimer, rótulo (`"Preço:"` ou texto igual ao nome do campo) é legenda, e camada já ligada não conta. O botão **Corrigir** usa `autoFix:'bindField'` → `dLayerBindField` — o mesmo bind do arrasto e do botão "Usar".

### Layout vivo (o texto do franqueado reacomoda a arte)

**O problema:** `maxLen` limita CARACTERE, mas o layout quebra em PIXEL — e quando o nome do produto ocupa 3 linhas, o bloco de baixo colide.

**A causa achada em 2026-08-05:** medir e desenhar eram caminhos separados. `gApplyRelativeAnchors` (`00-config.js`) media a altura com `gMeasureLayerHeight`, que conta só as quebras MANUAIS (`split('\n')`), enquanto o render quebrava depois (`gSmartWrapText`, `png-generator.js:393`) e podia encolher a fonte. A cascata media 1 linha, empurrava 1 linha, o render desenhava 3. Mais duas divergências da mesma família: a medida usava `lineHeight` 1.25 e o render 1.2; e a medida ignorava o tracking extra que o render dá a fonte black (peso ≥900).

**A correção:** `gFitTextLayer(layer, texto, ctx, opts)` (`00-config.js`) é a **única** resposta para "como este texto ocupa esta caixa" — quebra → caixa-alta → mede → encolhe, na ordem do render. O render passou a chamá-la (o encolhimento só é APLICADO depois, porque sombra/brilho/traço são dimensionados pelo tamanho desenhado), e `gApplyRelativeAnchors` mede por ela quando o layout vivo está ligado. O mesmo contrato cobre texto horizontal, vertical e a escala proporcional dos runs de rich text. Refactor provado **pixel-idêntico** em 16 casos, incluindo alinhamento à direita/justificado com encolhimento (onde o `innerPad`, calculado antes do encolhimento, desloca o texto).

**Correntes inferidas do desenho** (`_gInferirCorrentes`, só com o layout vivo ligado). `relativeAnchor` existe há tempos mas é marcado camada a camada, à mão — por isso a cascata quase nunca entrava em ação numa arte real. Agora a corrente sai do próprio desenho: bloco alinhado logo abaixo de outro (cruzamento horizontal ≥30% da faixa mais estreita) e a menos de **duas linhas** de distância (na escala tipográfica da própria arte) vira filho dele; o vizinho imediato acima ganha a paternidade. Ficam de fora: fundo, travada, com posição travada, filha de grupo e grupo — é assim que logo e selo não são empurrados por texto, e o caminho real é **travar** a camada. ⚠ `layoutRole` é lido mas **nenhuma UI o escreve** (6 leituras, 0 escritas — varredura pró-1.0); fica como reserva. **Âncora manual do designer sempre vence a inferida.**

A régua do gap é a **caixa desenhada**, não uma medida de referência: `gap = B.y − (A.y + A.h)`, e a corrente inferida **só empurra, nunca puxa** (`Math.max` com a posição publicada). Lê-se assim: *o texto cabe na caixa que o designer deu → nada se move, arte idêntica à publicada; passa da caixa → o de baixo desce exatamente o excedente.* Escolhida por ser estável e IGUAL nos dois contextos — medir um "estado de referência" dependeria de `gFieldSampleValue`/`dVars`, que pode estar vazio na sessão do franqueado, e referência diferente entre Estúdio e franqueado seria a divergência de sempre.

**A escada — quebrar → empurrar → encolher**, nessa ordem, e encolher é o ÚLTIMO recurso. Achado ao medir: `gSmartWrapText` tem quebra DURA de fallback (busca binária em `pushToken`), então qualquer texto cabe em qualquer caixa mais larga que um glifo e o encolhimento por largura quase nunca dispara sozinho. Com a cascata viva, o risco deixa de ser só "empurrou para FORA da prancheta": uma camada podia atravessar um preço, CTA ou foto e ainda ser considerada válida porque permanecia dentro do canvas. O laço fecha dentro de `gApplyRelativeAnchors` quando recebe `opts.canvas`: posiciona → testa bordas **e colisões internas** → aperta entrelinha → reduz `_tetoFonte` em 8% → re-mede → reposiciona (60 voltas é apenas a guarda de segurança para hierarquias grandes).

**Corredores de composição e respiro.** `_gLayoutBaseVisual` registra a composição de referência antes de qualquer movimento. Se título e obstáculo não se tocavam no desenho, o intervalo entre eles vira área protegida; se já se tocavam (texto sobre placa/foto), a relação é intencional e fica intacta. `_gInferirCorredores` pode dar a um point text uma caixa **transitória** (`_layoutW/_layoutDx`) somente no clone renderizado: o template não é reescrito, mas o valor real quebra linha antes do círculo de preço, CTA, foto, logo travado ou outra área relevante. Rich text e preço dividido não são quebrados entre runs; participam da colisão e da redução proporcional. `fRenderTemplateLayers` devolve as camadas efetivas, e foco, contorno e hit-test da prévia usam essa mesma geometria — o campo não fica clicável no lugar antigo depois de se acomodar.

**Dois pisos.** `gStampPisosHierarquia` carimba `_pisoFonte` = o degrau tipográfico imediatamente menor da própria arte, ou 50% do tamanho desenhado quando esse é mais restritivo (título 92 com subtítulo 20 para em 46, não em 20). É o que impede que "diminuir" INVERTA a hierarquia — o erro silencioso, que ninguém percebe para reclamar. `_pisoLegivel` é o segundo freio: campos comerciais/títulos não descem de 2,2% do lado curto da arte; textos de apoio, de 1,35% (sempre limitado ao tamanho que o designer desenhou). O carimbo é feito **antes** do laço de medida, para medida e desenho usarem o mesmo piso. Quando todos os culpados chegam ao degrau de hierarquia e ainda não cabe, `relaxou` reduz **toda a tipografia pela mesma escala global**, sem aumentar nenhuma camada e sem permitir que o título fique menor que o preço. Não coube nem no piso legível/50%: `estourou`/`_layoutInvalido` fica marcado e o Estúdio bloqueia a publicação no pior caso autorizado.

**Três divergências medida × desenho** caíram junto, todas achadas MEDINDO, nenhuma lendo:
1. Com `_tetoFonte` imposto, a quebra ainda usava o tamanho DESENHADO — 7 linhas onde cabiam 3, encolhendo a fonte e crescendo em altura ao mesmo tempo. `gFitTextLayer` agora quebra com um clone no tamanho efetivo.
2. Sem `vAlign:'top'` o render **centraliza** o texto na caixa (`png-generator.js`, `blockStartY`), então o que passa da caixa transborda metade para CIMA — e a cascata só media para baixo. O título comia a margem do topo da prancheta.
3. O encadeamento era caixa-a-caixa e virou **tinta-a-tinta** (`_gInkDy`): `filho.tinta.topo = pai.tinta.base + gap`, convertido de volta para o topo da caixa (que é a origem do render). Mesma régua para âncora manual e inferida.

**A regra que resolveu a (2): texto não sobe.** Enquanto cabe na caixa segue centralizado (é o desenho do designer); quando passa dela, ancora no topo e cresce só para baixo — que é exatamente o que a corrente sabe absorver. `_gStampVTop` carimba `_vTopAuto` na medida e o render lê o mesmo carimbo (`_vTop = l.vAlign==='top' || l._vTopAuto===true`). Sem layout vivo o carimbo não existe e o desenho de hoje é byte a byte o mesmo.

**Interruptor, DOIS em série** (`gLayoutVivoAtivo()`, sem argumento): a flag `franqueado.layout-vivo` no Controle do produto governa a **rede** (é da gestão), e `gLayoutVivoOff` é o botão **Auto-layout** ao lado do Auto-zoom na barra da prévia ao vivo (`live-preview.js`) — a chave de **quem está olhando** a arte. Fica em `localStorage` (`luma-lp-auto-layout`), igual ao Auto-zoom.

⛔ **NÃO existe chave por template.** Todo template nasce com o layout vivo ligado e o designer não decide nada no publicar (decisão do Ryan, 2026-08-06): não é escolha de design peça a peça, é o comportamento do produto. `publishMeta.layoutVivo` foi removido de `dDefaultPublishMeta`, do publicar e do render — se aparecer num publishMeta antigo, é ignorado.

⚠ **O layout vivo é SÓ do lado do franqueado**: prévia ao vivo e PNG baixado, que saem do mesmo `fRenderTemplateLayers` — prévia que mente sobre o arquivo final é o defeito que este projeto mais evita. O Estúdio (`canvas.js`), a prévia do designer (`preview.js`) e o **Simular dados reais** mostram a geometria DESENHADA: camada escorregando sob o cursor de quem está posicionando é o oposto de uma ferramenta de autoria — e o simulador serve para o designer ver o *problema*, não o conserto (por isso ele força a chave desligada em volta da chamada). O checklist audita pela mesma régua: o franqueado pode desligar o Auto-layout, então a arte desenhada é a pior situação real, e é a que o designer tem poder de consertar.

**Custo medido:** 0,8ms por render numa arte de 7 camadas com inferência; 12ms com 30 camadas encadeadas — dentro do debounce de 110ms da digitação (`chat-input.js:295`).

**O eixo X (2026-08-06).** A cascata nasceu vertical e por isso deixava passar três coisas, todas medidas antes de corrigir:
- **Point text normalmente não quebra nem encolhe pela própria caixa** (regra do render, para não quebrar a fidelidade 1:1 do PSD). Um nome de produto longo gerava **2385px de tinta numa prancheta de 1080** — corria para fora e ninguém segurava. A escada impõe `_tetoFonte` por largura; e, quando há um obstáculo que não era sobreposto no desenho, o corredor transitório permite quebrar esse point text sem alterar o template. Caixa de parágrafo continua quebrando pela largura publicada.
- **`_gInkDx`** é o irmão do `_gInkDy`: point text centralizado cresce para os dois lados e alinhado à direita cresce para a esquerda (`png-generator.js` posiciona pelo `textAlign`). Sem isso a cascata achava que todo texto começa em `l.x`. ⚠ Diferente do eixo Y, aqui **não** se força âncora à esquerda: centralizar horizontalmente é intenção de desenho, não acidente.
- **Corrente lateral** (`left-to-right` inferida): o caso "De R$ 149,90 por" ao lado do preço, em que o primeiro crescia e cobria o segundo (**211px de sobreposição** medidos). Mais exigente que a vertical de propósito — pai obrigatoriamente texto, sobreposição vertical ≥60% (contra 30% na coluna) e vão de no máximo uma linha. Quem já tem pai acima não ganha pai ao lado: uma camada com dois pais automáticos teria duas verdades.

**Quem cede primeiro — por ORDEM, não por ritmo.** Antes todos os culpados caíam 8% por volta e o resultado era o avesso: o TÍTULO ia ao piso enquanto o regulamento jurídico parava um degrau antes. Pesar o passo não resolveu (rodando em paralelo, o maior tem mais o que ceder e chega ao fundo do mesmo jeito). Agora encolhe o **menor degrau com folga, sozinho**, até ele parar de estourar a própria caixa; só então a escada sobe um degrau. Medido: título −14% e regulamento −22% onde antes era −50% e −39%.

**O vão do campo vazio.** Campo opcional em branco (ou oculto por regra) deixava um buraco: a corrente só empurra, e o gap saía da geometria desenhada, que já incluía a faixa dele. Agora `_gInferirCorrentes` soma a altura das faixas que sumiram (`anchor.colapso`) e o filho pode subir **exatamente isso, nada além** — a única exceção ao "só empurra", e ela não recompõe nada: fecha um vão que só existe quando o conteúdo existe.

**`_foraDaArte` e `_layoutInvalido`.** A escada tem limite de voltas. Quando desiste, carimba as camadas que ficaram fora da prancheta e, separadamente, as que continuam invadindo uma área protegida. O checklist usa o `maxLen` que está sendo escolhido no modal de publicação (não o valor antigo de `dVars`), transforma o pior caso sem solução em erro e impede publicar a falha em silêncio.

**Custo.** `_posicionar` era O(n²) (repassava a lista até estabilizar). Agora resolve em ordem topológica — pai antes de filho — e **uma passada** basta. Arte real de 4 textos longos: **2,6ms**. Caso patológico de 40 textos encadeados estourando: **64ms**, contra 116ms antes — dentro do debounce de 110ms da digitação.

⛔ **O que NÃO foi mexido, e por quê.** O piso da hierarquia (`gStampPisosHierarquia`) parecia degenerar quando a arte tem uma assinatura miúda no rodapé. Medido em quatro hierarquias reais: **não degenera** — `degraus.find` devolve o MAIOR degrau abaixo, não o menor, então a assinatura de 14px só entra em cena para camadas menores que ela. Em nenhum caso uma camada ficou autorizada a descer abaixo de outro texto da arte. Suspeita descartada, código intacto.

**A placa cresce com o texto (2026-08-07).** O padrão "card" — retângulo colorido com o preço ou o título em cima. A escada empurrava e encolhia o TEXTO, mas nunca a forma que servia de fundo: 62px de transbordo medidos numa placa de 140px, com a cor saindo debaixo da letra. `_gInferirPlacas` lê a relação do próprio desenho e `_seguirPlacas` faz a forma grudar no topo do texto e crescer **exatamente o excedente** — texto que cabe deixa a placa idêntica à publicada. Cresce nos DOIS eixos: em altura por qualquer texto, em **largura só por point text** (caixa de parágrafo quebra a linha e nunca passa da própria largura) — e a largura segue a direção da tinta: centralizado abre para os dois lados, à esquerda abre só para a direita. Regras apertadas para não adotar decoração: só **retângulo** (esticar círculo ou polígono deformaria), só quem está **atrás** no z-order, tem que **envolver** a caixa do texto, no máximo **6× a área** dele (painel de seção não é placa) e **um texto só** dentro (com dois, crescer por causa de um seria arbitrário). O laço de posicionamento ganhou uma terceira volta **só quando há placa**: ela cresce depois que o texto se acomodou, e quem está encadeado abaixo precisa enxergar a altura nova.

**A entrelinha é o degrau ANTES de encolher a fonte.** Designer não sai reduzindo a letra — primeiro fecha o espaçamento, porque a hierarquia mora no tamanho. `gLineHeightDe(l)` é a régua única lida pela medida e pelo desenho (sem o carimbo devolve o 1.2 de sempre, então arte de hoje não muda). O aperto é **calculado, não tateado**: a entrelinha que faria a tinta caber é `altura / (fonte × linhas)`, uma conta e uma re-medida só — tatear de 0.05 em 0.05 custava três voltas de re-medida em toda a arte (144ms a mais numa peça pesada) e chegava no mesmo lugar. Piso 1.05, e só para quem tem mais de uma linha.

**Checklist em dois níveis.** `_foraDaArte` deixou de ser carimbo sem consumidor: o checklist roda o pior caso **também com o Auto-layout ligado** e separa dois problemas diferentes — *alerta* quando o Auto-layout conserta (mas o franqueado pode desligar) e *erro* quando nem ele salva (a peça sai errada para todo mundo).

**Teste de estresse (o Estúdio avisa antes de publicar).** `maxLen` limita CARACTERE e o layout quebra em PIXEL — o designer autoriza 32 caracteres e não tem como saber, olhando os valores de exemplo, que aos 32 o título encosta no preço. `gStressValues(usados, dVars)` monta o texto mais longo que o franqueado PODE digitar (frase realista cortada EXATO no `maxLen`; frase curta demais repete até encher; sem `maxLen` vai inteira). Consome isso:
- **Checklist** (`_dLinterEstresse`, `linter.js`): monta a arte com o pior caso pelo MESMO caminho do render — posições de `gApplyRelativeAnchors` com o interruptor real do template, tinta de `gFitTextLayer` — e acusa (a) colisão, (b) saída da prancheta **nos quatro lados** — o eixo X entrou junto com a corrente lateral, e para point text a mensagem ensina o conserto certo (virar caixa de parágrafo, já que ele não quebra linha) —, (c) `estourou`. Mensagem com o número que o designer controla: *"com 32 caracteres em «Produto», «Título» invade «Preço»"*. **Só acusa par que NÃO se sobrepõe no estado de exemplo** — selo atrás de texto é desenho, não estrago. ~3ms.
- **Simular dados reais** (`canvas.js`): o cenário "Limite" passou a usar `gStressValues` (antes tinha frases cravadas que ignoravam o `maxLen` e reprovavam texto que o franqueado nem consegue digitar). O selo "Revisar encaixe" por campo existia no HTML e nunca acendia — faltava ligar `window._fOverflowSink`, que o render já expõe; `dSimMarkOverflow` faz o caminho de volta camada → `{{campo}}`.

⚠ `gStressValues` usa frase realista, **não** `WWWW…`: a string mais larga possível reprovaria toda arte e o designer aprenderia a ignorar o aviso. Precisão acima de recall, igual ao resto do checklist.

⛔ **Não** se roda `gResolveIntelligentLayout` no render: a decisão está em `png-generator.js:259` com o motivo (custo por tecla + divergência prévia/publicado). O layout vivo usa CORRENTES (`relativeAnchor`), não o solver.

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

### 12.1. IA — motor único (`core/ai.js`)

**Todo** recurso de IA fala por aqui; nenhum outro arquivo monta chamada pro modelo (regra do motor único, §`03_ENGINEERING`). A IA é **auxiliar**: cada recurso tem caminho de queda e o produto funciona sem ela (`00_PRODUCT.md` §9).

| Função | Papel |
|---|---|
| `gAskAI(task, prompt, opts)` | Pergunta ao modelo. Nunca lança, nunca trava (timeout 30s). `opts.parts` = anexos (`{mimeType,data}`), `opts.json`, `opts.cache`. Devolve texto ou **null** — quem chama decide o fallback |
| `gAiReady()` | Tem caminho pra IA? A UI usa pra decidir se mostra o recurso (otimista; desliga só depois de falha real) |
| `gAiParseJson(txt)` | Parser tolerante (modelo às vezes embrulha em ```json) — nunca lança |
| `gAiFileToPart(file)` | Arquivo → `{mimeType, data}` base64 pro anexo |
| `gAiModel()` | Modelo atual (`window.LUMA_GEMINI_MODEL`, trocável no config e pelo seletor do widget) |

**Caminhos, nesta ordem:** Edge Function `ai` (chave no servidor — ver `LUMA-BACKEND-CHANGELOG.md` 2026-07-30) → **transição**: chamada direta com a chave do front ⚠ (sai de cena quando a function subir) → `null`.

**Onde a IA é usada (5 pontos):**

| Recurso | Onde | Queda quando a IA falha |
|---|---|---|
| **Legenda do post** | `franqueado/chat.js` (`fFetchAICaptionSuggestions`) | motor local `fBuildCopy`; o selo do painel diz a origem real (`_fCaptionSrcTag`) |
| **Encaixar no limite** (`maxLen`) | `franqueado/chat-input.js` (`fFitTextWithAI`) | botão não aparece; opção que não cabe é descartada no código |
| **Ajuda aterrada** | `widgets/help-widget.js` + `gHelpKnowledge` (`core/help.js`) | artigo cru da base; sem material que case, **não chama** o modelo |
| **Ler cardápio** (foto/PDF/texto) | `franqueado/png-generator.js` (`fBulkReadMenu`, `_fBulkItensPorIA`) | parser heurístico local (`fBulkParseHeuristicText`) segue sendo o 1º caminho no texto |
| **Casar fotos com linhas** | `franqueado/png-generator.js` (`fBulkMatchPhotos`) | casamento por nome de arquivo (local) resolve a maioria; sobra fica sem foto |

**Regras dos recursos de IA nesta base:** (1) validar no **código** o que o prompt pediu (tamanho, formato, repetição) — modelo erra contagem; (2) **marcar a origem** na UI (selo/chip) — app que finge não mentir é bug; (3) nunca inventar dado de negócio (preço, validade) — prompt proíbe e a grade exige revisão; (4) toda linha lida por IA passa pela mesma validação das digitadas.

### 12.2. Luma CLI — console do time (`core/console.js`)

Terminal interno, **Ctrl+`** abre, **Esc** fecha. Só monta pra `gIsAdmin()` (equipe_dm/gestao). Existe porque o diagnóstico de sync era feito colando snippet no DevTools — conhecimento que morava em log de conversa (incidente de 07/2026: "30 pastas no banco e 0 templates"). Agora é comando nomeado.

**No celular** não há Ctrl+`: a entrada é o item **Console · DEV** no painel de perfil (sidebar, ao lado de "Equipe") — revelado pelo mesmo `gIsAdmin()`, escondido do franqueado. Toque nele fecha o modal e abre o console. Lá também não há Tab nem ↑/↓, então aparece uma faixa de **chips** com os comandos de leitura (`ajuda`, `diag`, `modelo`, `sync status`, `pastas ls`, `cache ls`) — só comando que não muda nada. Três detalhes que fazem "funcionar no celular" ser verdade: `_gCliAjustaViewport()` sobe o painel a altura que o **teclado virtual** comeu (`position:fixed` não vê o teclado, e o campo ficava embaixo dele); `font-size:16px` no input (menos que isso e o iOS dá zoom); e `body.cli-on` tira do rodapé os flutuantes com z-index maior — aviso de PWA (13000, via CSS) e FAB do widget de ajuda (9999, no `checkVisibility` do próprio widget, porque o display dele é inline).

| Comando | O que faz |
|---|---|
| `ajuda` | Lista os comandos |
| `diag` | Radiografia: sessão/role, backend, IA, catálogo local, `_syncPending`, fila de deleção, MB do localStorage e **contagem no banco** (a linha que explicou o incidente) |
| `sync status\|push\|pull` | Estado do sync ou força `_dPushFoldersNow()` / `dSyncFoldersFromBackend()`, mostrando antes → depois |
| `pastas [ls\|<id>]` | Lista `dFolders` ou detalha uma pasta (remoteId, capa, materiais, flags) |
| `cache [ls\|clear <chave>]` | Tamanho por chave do localStorage; `clear` exige `gConfirm` |
| `ia <pergunta>` | Pergunta em PT-BR — **também é o padrão**: qualquer frase que não seja comando vai pra IA |
| `modelo [nome]` | Mostra/troca o modelo do Gemini. Grava em `localStorage.luma_gemini_model`, que **`gAiModel()` lê antes de `window.LUMA_GEMINI_MODEL`** — sem essa ordem a escolha morria no reload, porque `00-config.js` redefine o window a cada boot. Vale pra **todo** recurso de IA daquele aparelho; `modelo padrao` desfaz. Só apelidos `-latest` na lista sugerida (versão fixa aposenta e quebra) |
| `limpar` · `sair` | Limpa a tela · fecha |

**A IA do console** recebe o contexto real da sessão (o mesmo que o `diag` mede) + a lista de comandos, e devolve `{passos, resposta, comando}`. Os `passos` viram um bloco **raciocínio** esmaecido acima da resposta — é o que o modelo diz ter feito, não roteiro nosso. O `comando` só **pré-preenche** o campo, nunca executa. Task `cli` na Edge Function.

**Enquanto trabalha** (`_gCliSpinStart` / `_gCliSpinPasso`): um bloco mostra o que está acontecendo **de verdade** — rótulo girando, tempo decorrido e os passos anunciados por quem chama conforme acontecem (contexto lido → perguntando pro `<modelo>` → resposta recebida). Sem barra de progresso: não há como saber a fração de uma chamada de rede, e passo inventado é mentira bonita. O bloco some quando a resposta chega, pra não virar histórico falso.

**Teclado (desktop):** ↑/↓ histórico da sessão · Tab autocompleta comando · o `keydown` do campo para no console (atalho do Estúdio não dispara por baixo). **Esc fecha de qualquer lugar** — o listener mora no `#luma-cli`, não no campo: como o campo para a propagação, com o foco num chip ou no corpo o Esc não chegava a ninguém e o cabeçalho mentia.

**Palavra solta parecida com comando** (`diagg`, `pasta`) **não vai pra IA** — vira "não é comando, você quis dizer X?" com o botão que pré-preenche. Sem isso, um erro de digitação com a IA desligada terminava em "IA indisponível": beco sem saída pra quem só errou uma tecla.

⛔ **Não é fronteira de segurança.** O gate por role é de UX; quem governa é a RLS, e todo comando roda com a sessão do próprio usuário — o console não dá poder que o DevTools já não desse. Comando que só é seguro "porque só dev vê" não entra.

**Visual** (`css/modules/console.css`): superfície do Estúdio, acento laranja, mono do sistema (nenhuma fonte baixada) e flip completo em `body.theme-light`.

A caixa de boas-vindas é **texto monoespaçado**, não CSS: a moldura é o próprio caractere, com o mascote numa coluna e o contexto na outra. A largura é contada em **caracteres** (`padEnd`) porque é o que fecha a moldura em fonte mono — medir em pixel aqui não fecha nunca. O miolo é `robô(22) + ' │ '(3) + info(IW)`, com `IW` 48 no desktop e 30 no celular; **as duas colunas têm que ter o mesmo número de linhas (13)**.

O **mascote bate embaixadinha**: uma arte base de 13×22 e um quadro montado por mutação dela (olhos que seguem a bola, piscada, boca que abre no toque, antena pulsando, painel de LEDs correndo, braços por altura, perna que sobe, rastro, sombra que engorda e contador `×N`). A trajetória é declarada só pela **metade esquerda** — o meio-ciclo seguinte é o espelho (`col → 20-col`), e é isso que faz o **pé alternar** sozinho. Cada célula carrega uma classe (`cli-r-body`, `cli-r-face`, `cli-r-led`, `cli-r-ball`…) pra colorir peça por peça sem mexer na largura. Timer único, parado no `gCliClose()`, e `prefers-reduced-motion` deixa no quadro do ápice.

**Motion do chat:** a saída de comando entra **linha a linha** — `_gCliEscalona` põe `animation-delay` em cada uma (teto de 420ms), CSS resolve o resto. Foi feito no CSS de propósito: com `setTimeout`, um `diag` de 30 linhas viraria 30 timers. Enquanto roda, o **único** indicador é o bloco de pensamento + o prompt aceso (havia também um spinner de 12px no canto do campo — dois sinais pro mesmo estado, o menos informativo saiu).

**Regras de UI que o console tem de manter** (revisão de 2026-07-30, tudo medido no Chromium):

- **Piso de 12px** na tipografia. Abaixo disso só micro-badge em caixa-alta bold (`.cli-title` 10.5px, `.cli-badge` 9px).
- **Contraste ≥ 3:1 para objeto gráfico** — vale pra moldura da caixa (`.cli-fr`, opacity `.75`), o rastro da bola e **as bolinhas do `diag`**. Duas armadilhas reais aqui: `body.theme-light .cli-dot` tem especificidade maior que `.cli-dot.warn`, então **warn e err precisam de override explícito no claro** (sem eles as duas viravam cinza — a bolinha existe justamente pra distinguir verde/amarelo/vermelho); e a bolinha de erro usa `--d-error`, não `--dm-red`, porque o `#C81818` sobre o `#1A1A1A` mede 2.98:1.
- **44px de alvo de toque no celular** (fechar, chips, linha de comando) — lei de Fitts, `ux-principles.md`.
- **Clicar em qualquer ponto da linha de comando foca o campo.** O campo tem ~20px dentro de uma linha de 40px; sem o handler na linha, dois terços do alvo não faziam nada.
- **Banner do celular é fluido:** `clamp(7.5px,2.6vw,11px)`. A caixa tem 57 colunas fixas, então quem manda no tamanho é a largura da tela — com px cravado ela usava 257px de 364 disponíveis.
- **Radius só pelos tokens** (`--r` 10px / `--r-sm` 6px / `--r-pill`).
- **Coluna de descrição do `ajuda` sai do comando mais longo**, nunca de número fixo.

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
| `dp-workspace-mode` | Modo simples/complexo do Estúdio (opção no painel de gestão do perfil) |
| `yngs_pages_locked_v1` | Ids das páginas com edição travada **neste dispositivo** (freio contra edição acidental, não permissão — §10) |
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

**Funcionais:** `opacity` só em shape · `gToast` sem fila · eyedrop/bucket só texto/forma · PSD (texto justificado não distribui palavras; smart object/ajuste/padrão/rotação/espelho/warp entram como imagem fiel; z-order às vezes manual) · SVG (classes em `<style>` não lidas, grupos 1 nível, bbox de path aproximada).

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
- **2026-07-30**: **IA sai do improviso** — Edge Function `ai` (chave fora do front), motor único `core/ai.js` e 5 recursos plugados nele: encaixar texto no `maxLen`, ajuda aterrada na Central, ler cardápio (foto/PDF) no Sheets, casar fotos com as linhas, legenda com prompt sério. Ver §12.1.
- **2026-07-30**: capa do card da vitrine volta a ser **a capa da pasta** — a fila de miniaturas do conteúdo (`_fCampThumbs`/`fHomeFillThumbs`, ~100 linhas) saiu: renderizava a arte com campos vazios e deixava o card em branco. Capa do Storage que não baixa agora cai na cor da pasta também na lista do Estúdio (`dRenderFolders`).
- **2026-07-31**: **Refino da Academia** — sistema de motion sobre os tokens (`js/academia/motion.js` + `--dur-celebration`), progresso que percorre em vez de nascer pronto, acordeão com altura real, crossfade na troca de aula/aba, chat que anexa só a mensagem nova e preserva a rolagem, retomada como escolha, fim de vídeo com próxima ação, e a **experiência de conclusão** (splash + vídeo dos CEOs configurável + nova jornada). Corrigido um furo na regra de progresso: `ended` concluía a aula com 0% assistido.
- **2026-07-31**: **Academia Delivery Much** — módulo de formação e implementação do franqueado: jornada com mapa de módulos, ambiente de aula em 3 regiões (player MP4 com retomada, materiais, anotações, transcrição, atividade), tutor de IA com prompt no servidor, gestão de conteúdo com upload de MP4, conclusão e certificado em PDF. Ver §21 e `docs/LUMA-ACADEMIA.md`.
- **2026-07-09**: home do franqueado responsiva (thumbs reais, vitrine honesta, scroll-reveal, busca sticky), redesign do painel Campos (linha compacta + filtros + higiene), topbar (hierarquia + paleta), **auditoria de contraste WCAG aplicada** (tokens `--green-text`, `--var-color` claro, `--d-text3`, CTAs em `--dm-orange-d`). Este documento.

---

## 21. MÓDULO ACADEMIA (`ac*`)

**Doc completa: [LUMA-ACADEMIA.md](LUMA-ACADEMIA.md).** Resumo do que um agente precisa saber antes de tocar aqui:

- **O que é.** Terceira aba de modo na topbar: a **Academia Delivery Much**, onde o franqueado faz a **Formação do Franqueado** (jornada de implementação). Visível às 3 roles; a gestão de conteúdo é `equipe_dm`/`gestao`.
- ⛔ **Não chamar de "Implementação".** Esse nome já é a categoria de materiais do catálogo (`CAMPS_IMPLEMENTACAO`, `fRenderImplementacao`).
- **Arquivos:** `js/academia/{academia,aula,agente,gestao,certificado}.js` + `css/modules/academia.css`. Prefixo **`ac*`**; `f*`/`d*`/`g*` intocados.
- **Estado:** `acState` (curso, matrícula, progresso, notas, certificado, rota, aulaId). Rotas internas por `acGo(rota, arg)`; `setMode('academia')` chama `acInit()` lazy.
- **Backend:** 8 tabelas em `luma` (`cursos`, `curso_modulos`, `curso_aulas`, `matriculas`, `aula_progresso`, `aula_notas`, `aula_mensagens`, `certificados`) + bucket **privado** `luma-aulas` + RPC `luma.ac_emitir_certificado`. Ver §14 e o changelog.
- **Certificado não é falsificável:** `luma.certificados` não tem policy de escrita; só a RPC `SECURITY DEFINER` grava, revalidando as aulas obrigatórias. O PDF sai de um Canvas 2D pelo **pdf-lib vendorizado** (mesmo caminho de `fGenPDF`).
- **Tutor de IA:** task `aula` no motor único `gAskAI`. **O prompt vive na Edge Function** — é a única task assim (as outras montam no front por causa do modo de transição). O front manda só pergunta + contexto, e **nunca** o gabarito da atividade nem dado pessoal. Gate de disponibilidade: `gAiEdgeReady()`, não `gAiReady()`.
- **Progresso honesto:** o player soma só deltas `< 2s` de `timeupdate`; arrastar a barra até o fim não conclui a aula. Critério de conclusão (`cursos.criterios.pct_min`, padrão 85%) é o mesmo no front e na RPC.
- **Anotações e conversas são privadas até da equipe** (policy só do dono, sem `is_designer()`).
- **Motion:** `js/academia/motion.js` é o sistema — helpers que leem os tokens (`acDur`, `acEase`). ⛔ Nunca escreva ms/cubic-bezier em JS. A Academia acrescentou **um** token: `--dur-celebration` (720ms), só para marco de conquista.
- **Experiência de conclusão:** `js/academia/conclusao.js` — splash + vídeo dos CEOs + próxima jornada, configurável em `luma.cursos.conclusao` e persistida em `luma.matriculas`. Dispara **uma vez por versão**, só com conclusão do servidor + certificado emitido.

---

## 22. CONTROLE DO PRODUTO / FEATURE FLAGS (`gFeature*` · `gProd*`)

**O que é.** A área exclusiva da `gestao` que liga e desliga recursos do Luma **sem editar código e sem deploy**. Nome na interface: **Controle do produto**. "Feature flag" é linguagem técnica interna — nunca aparece como título de tela.

**Onde vive.** 5ª aba do painel da conta que já existia (`#g-profile-modal`), ao lado de Equipe. ⛔ **Não** é um modo novo na topbar: o painel da conta é justamente a superfície que continua alcançável quando todos os módulos estão desativados. Gate visual `gIsSuperAdmin()`; quem autoriza a escrita é a **RLS**.

**Arquivos.**

| Arquivo | Responsabilidade |
|---|---|
| `js/core/feature-flags.js` | O motor: registro, cache, sync, resolução, cascata, overrides, evento. **Única camada que fala com a tabela de flags.** |
| `js/core/product-control.js` | Só a UI da Gestão. Não conhece o Supabase. |
| `css/components/product-control.css` | Estilos (dentro de `.g-profile-modal`, herda as `--prof-*` e os dois temas) |
| `supabase/migrations/20260731190000_luma_feature_flags.sql` | `luma.feature_flags` + `luma.feature_flag_history` + trigger + RLS + seed |

**Quatro camadas, nesta ordem:**
1. **`G_FEATURE_REGISTRY`** — o que existe (32 chaves, versionado com o código: rótulo, descrição, pai, comportamentos válidos, ações preservadas, ferramentas governadas, tags).
2. **Estado configurado** — o que a gestão gravou (Supabase + cache `luma_feature_flags_v1`).
3. **Estado efetivo** — `gFeatureState()`: default → global → override por role → estado dos pais.
4. **Aplicação** — `data-feature` no HTML (visual) + guard no handler (o que realmente bloqueia).

**API global:**
```js
gFeatureInit()                 // boot, SÍNCRONO, antes de gLoadProfile()
gFeatureEnabled(key)           // estado efetivo
gFeatureCan(key, acao)         // access|view|create|edit|execute|render|export|load
gFeatureState(key)             // {configurado, efetivo, comportamento, motivo, bloqueadoPor}
gFeatureReason(key)            // por que está indisponível, em PT-BR
gFeatureToolBlocked(tool)      // ferramenta do Estúdio → chave que bloqueou, ou null
gFeatureBlockedFeedback(key)   // gToast único de indisponibilidade
gFeatureApplyToDOM(root)       // aplica os data-feature
gFeatureSave(key, patch)       // só gestão; RLS decide
gFeatureSyncFromBackend()      // pull + reconcilia + dispara evento
```

**⛔ A regra que sustenta tudo:** `render`, `export` e `load` continuam `true` mesmo com o recurso desativado (declarados em `preserva`). **Desativar a ferramenta que CRIA nunca some com o que ela já criou.** Nenhuma linha dos motores de render/preview/PNG recebeu condição de flag.

**Cascata.** Pai desativado torna os filhos **efetivamente** indisponíveis, mas o estado **configurado** de cada filho é preservado — no cliente, nunca no banco. Religar o pai devolve cada filho ao próprio estado. Sem isso, desligar um grupo apagaria em silêncio a decisão de cada ferramenta dentro dele.

**Comportamentos:** `hide` (some) · `disabled` (visível, `aria-disabled`, clique explica) · `readonly` (vê, não cria/altera) · `maintenance` (reconhecível, com motivo). Cada recurso declara quais aceita.

**Fallback (fail-open, de propósito).** Sem backend e sem cache, tudo funciona como antes. Feature flag **não é segurança** — a RLS é. Uma flag indisponível não pode derrubar o produto. O erro só aparece quando a Gestão **tenta salvar**, e o estado visual reverte. Nunca "salvo" falso.

**Boot.** `gFeatureInit()` roda **antes** de `gLoadProfile()` (é síncrono: registro + cache). O sync remoto vem depois da sessão e dispara `luma:feature-flags-changed`, que reconstrói só o que mudou — **sem reload**. Atualiza também no `visibilitychange` e ao reabrir a tela. Sem polling, sem Realtime.

**Recursos protegidos (sem chave, de propósito):** login/logout/sessão, carregamento do perfil, o próprio sistema de flags e o painel da conta. Ausência de chave é proteção mais forte que "chave proibida" — a gestão não consegue se trancar do lado de fora.

### Matriz de cobertura (32 chaves — cada uma ligada a fluxo real)

| Chave | UI (`data-feature`) | Guard no handler | Atalho | Estado salvo | Render antigo |
|---|---|---|---|---|---|
| `module.franqueado` / `.academia` / `.designer` | aba da topbar | `setMode` + `gApplyModeAccess` | — | redireciona | preservado |
| `franqueado.catalogo` / `.historico` | aba do franqueado | `fSwitchTab` | — | cai na outra aba | preservado |
| `franqueado.chat` | — | `fSend` | — | — | histórico intacto |
| `franqueado.legendas` | — | `fGenCaptionSuggestions` (devolve `[]`) | — | — | — |
| `franqueado.sheets` | — | `fBulkOpen` (funil de `fBulkOpenFromArt`) | — | — | — |
| `franqueado.export.png` / `.pdf` / `.zip` | — | `fBaixar` / `fBaixarPDF` / `fBulkDownloadAll` | — | — | — |
| `designer.tools.*` (6 grupos) | proxy do grupo na régua | **`dSetTool`** (funil central) | ✅ cobre | cai em `select` | preservado |
| **`designer.tools.text.vertical`** | flyout + painel "Todas" | `dSetTool` + `dAddTextAt` + `dAddTextMaskAt` | ✅ Shift+T pula | cai em `select` | **✅ verificado** |
| `designer.tools.text.mask` | flyout + painel "Todas" | `dSetTool` + `dAddTextMaskAt` | ✅ | cai em `select` | preservado |
| `designer.import.psd` / `.svg` | — | `dImportToFolder` (funil dos dois) | — | — | — |
| `designer.publish` | 2 botões | `dPublishOpen` | — | — | — |
| `designer.campos` / `.campanhas` / `.checklist` | aba do painel direito | `dActivatePanel` (cai em Camadas) | — | — | — |
| `designer.assets` | botão Recursos | `dToggleResources` | — | — | — |
| `global.help` | botão flutuante | `gOpenHelp` | — | — | — |
| `global.help.chat` | — | `lumaWidgetStartChat` | — | — | — |
| `global.tutorials` | — | `tutOpen` | — | — | — |

**Por que tão poucos arquivos tocados:** os guards ficam nos **funis** (`dSetTool`, `dAddTextAt`, `dImportToFolder`, `setMode`), não em cada botão. Um guard em `dSetTool` cobre flyout, painel "Todas as ferramentas", atalho, ciclo Shift+T, estado restaurado e chamada pelo console — de uma vez.

**Ficou para depois (declarado, não abandonado):** granularidade por ferramenta individual dentro dos grupos Formas/Pintura/Preenchimento/Efeitos/Medição (hoje o grupo inteiro é uma chave); flags por curso/aula da Academia; guard programático em `dSvgImport`/`dImportPSD` além do funil.

---

## 20. GOVERNANÇA DA DOCUMENTAÇÃO

- **Este arquivo (`docs/LUMA.md`)** é a documentação oficial. Feature nova, mudança de arquitetura, token novo, tabela nova → atualizar a seção correspondente AQUI.
- **`docs/LUMA-BACKEND-CHANGELOG.md`** continua como registro append-only de TODA mudança de backend (com data e migration).
- **`docs/LUMA-ACADEMIA.md`** — doc do módulo Academia (formação do franqueado). O §21 aqui é o resumo; o detalhe mora lá.
- Docs substituídos por este (podem ser removidos): `LUMA-CONTEXTO.md`, `LUMA-FEATURES.md`, `LUMA-INVENTARIO.md`, `LUMA-BACKUP.md`, `UX-WRITING-DESIGN.md`.
- `LUMA-BACK_CONTEXT.md` e `LUMA-REGRAS_BACKEND.md` (removidos em 2026-07-16) documentavam **outro projeto** (Portal de Franqueados / DM CRM, Supabase `gplxnzgsculryjykbcuo`) — as lições relevantes vivem no §14.9; os originais, no repo do portal. Também removidos na mesma limpeza: `BACKLOG-EDITOR-FASE5.md` e `CENTRAL-AJUDA-DIAGNOSTICO.md` (auditorias concluídas; o que seguia aberto foi absorvido pelo `luma-brain/07_ROADMAP.md`, e o estado da Central de Ajuda está no §12).
- Para inventário exaustivo de funções/IDs além do que está aqui: o código é o inventário — `grep` pelos prefixos.
