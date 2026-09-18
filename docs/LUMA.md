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
| Carregamento | `index.html` carrega 69 `<script>` em ordem; tudo global (lista em `luma-brain/MAPA.md`) |
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

## 4. ESTRUTURA DE ARQUIVOS → `luma-brain/MAPA.md`

⚠️ **Esta seção era uma árvore de arquivos escrita à mão, "verificada 2026-07-09". Ela
envelheceu e passou a mentir:** listava 44 arquivos JS quando o código já tinha **67** —
`core/ai.js`, `core/console.js`, `core/feature-flags.js`, `core/product-control.js`,
`core/auto-layout.js`, `core/qr.js`, `core/sound.js`, `core/pwa-install.js`,
`js/widgets/` inteiro, `franqueado/prefs.js`, `prefs-panel.js`, `upload-panel.js`,
`panel-dock.js`, `designer/linter.js`, `psd-parse.js`, `academia/conclusao.js` e
`academia/motion.js` eram invisíveis para quem lia este doc.

**A árvore foi removida em vez de atualizada** — manter duas cópias garante que uma esteja
errada. O mapa agora é **gerado do código**:

```
node scripts/mapa.js      # regenera luma-brain/MAPA.md
```

`luma-brain/MAPA.md` traz, sempre atual: o propósito de cada arquivo (tirado do cabeçalho do
próprio arquivo), as funções globais que ele expõe, o estado global que ele detém, suas
dependências declaradas, a lista de CSS, a ordem de carga dos 69 `<script>` — e mais uma
tabela semântica escrita à mão ("quero mexer em X → vai no arquivo Y"), os motores únicos com
`arquivo:linha` e as **armadilhas de leitura** (docs deste repositório que não devem ser lidos).

Um hook de `UserPromptSubmit` (`.claude/settings.json`) regenera o mapa quando `js/`, `css/`
ou `index.html` mudam, então ele não depende de ninguém lembrar de rodar o script.

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
gToast('Arte baixada!');                   // sucesso
gToast('Selecione uma camada primeiro');   // alerta — SEM emoji na copy (ícone é SVG)

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
| `fPostarInstagram` / `fEnviarWhatsApp` | png-generator.js | **Os dois destinos reais da arte** (2026-08-29), ações de 1ª linha do card de entrega. Núcleo comum `_fArtePreparar` (renderiza uma vez com o material daquela arte) + `_fArteEntregue` (histórico `baixada` + `gTrackEvent`). Celular: `navigator.share` com o arquivo. Desktop: baixa o PNG e abre instagram.com / web.whatsapp.com com o que dá pra colar. ⛔ O Luma **não posta e não envia** — entrega arquivo e legenda; quem publica é a pessoa. `AbortError` (cancelou a folha nativa) é silencioso. Mesmo guard de feature flag do download (`franqueado.export.png`). ⚠ No WhatsApp desktop a área de transferência recebe a **imagem** (é ela que o Ctrl+V cola); copiar a legenda depois a sobrescreveria, então a legenda só entra quando o navegador não sabe copiar imagem (Firefox). Substituiu o botão "Compartilhar" genérico (`fCompartilhar`, removido) |
| `fGenPNG` / `fGenPDF` / `fRenderCanvasHelper` | png-generator.js | Render final 2× supersampling |
| `fRenderTemplateLayers` / `fRenderOneLayer` | png-generator.js | **Motor de render** (reflow smart-resize, bindings, regras, máscaras, blend modes) — usado por PNG e preview. ⚠ Lê `fState.material` (bg + tamanho nativo via `fMaterialSize`); para renderizar material arbitrário: save/restore de `fState.material` |
| `fUpdateLivePreview` | live-preview.js | Preview lateral em tempo real com placeholders |
| `_fLpPaintPip` → `_fLpPaintCartao` | live-preview.js | **A arte no celular.** Abaixo de 680px o painel lateral vira gaveta em tela cheia (`#f-live-preview.open`) e a arte aparece no fluxo do chat como cartão (`#f-chat-art`, desde 15/08) — tocar abre a gaveta. As duas superfícies são `drawImage` do `#lp-canvas`: **cópia de pixels do motor único, nunca um segundo renderizador**. O cartão é o último item flex por `order:1` (as bolhas entram por `appendChild` em ~6 pontos do `chat.js` e cairiam depois dele), com `flex:1 1 auto` para absorver a sobra e `min-height:140px` de piso. ⚠ O JS define só o BITMAP — o encaixe é CSS (`max-*:100%` + `width/height:auto`); cravar pixel no JS realimenta o flex e congela a altura do cartão. Com o cartão no fluxo, o selo flutuante (`#mobile-preview-toggle`) e o `padding-bottom:150px` que o acomodava saem do chat |
| `fAddHist` / `fMarkHistBaixada` / `fGetHist` | history.js | Histórico (localStorage `dm_artes_hist_v2`, cap 50, dedup) + push pra `luma.artes` |
| `fAskClearHist` (catalog.js) → `fClearHist` | history.js | Limpar a biblioteca. Confirmação `gConfirm` danger no porteiro; apaga `luma.artes` (policy "dono apaga suas artes") **antes** do localStorage — na ordem inversa o `fSyncArtesFromBackend` traz tudo de volta. Banco recusou → nada é apagado |
| Validade em "Minhas artes" (`_fHistVencida` / `_fHistBloqueiaVencida`) | catalog.js | Arte de material fora da validade não baixa, não duplica e não edita (as três terminam em PNG). Checagem na leitura (`publishMeta.validade` do sync), nunca em flag salvo; material não encontrado **não** bloqueia (falha aberta) |
| `fBulkOpen` → `fBulkDownloadAll` | png-generator.js | Geração em lote via CSV (PapaParse) com fila/yield. **Uma tela só desde 13/08:** a arte ao vivo da linha ativa à esquerda (`_fBulkRenderHero`, mesmo `fRenderTemplateLayers` do PNG) e a planilha à direita; `_fBulkActive` é o vínculo entre as duas, `fBulkLiveEdit` acompanha a digitação com debounce de 160ms sem re-renderizar a tabela (re-render roubaria o foco). A trilha de 3 passos saiu — o passo 1 era um menu de importação (virou painel que abre sozinho com a planilha vazia) e o passo 3, três controles (foram pro rodapé). A vista em cartões foi aposentada (a coluna da esquerda faz o mesmo, maior) e os chips de formato saíram do rodapé — o ZIP sai no formato do material aberto (`selectedFmts=[fState.fmt]`), porque escolher formato de novo aqui repetia a decisão já tomada ao abrir o material. Multi-formato num lote só deixou de existir; o caminho para isso é o par vinculado feed↔story do roadmap |
| `_fBulkRenderLista` / `fBulkAbrirFolha` / `_fBulkRenderFolhaCampos` | png-generator.js | **O Sheets no celular (15/08).** Abaixo de 680px a grade linha × coluna dá lugar a uma **lista** (nome, detalhe e o estado de cada oferta: pronta / N a preencher / vazia) e a **coluna de prévia vira a folha** que sobe por cima — só CSS, `body.f-bulk-folha`. Quase nada é motor novo: `fBulkGetReadiness` já separava os três estados, as setas "anterior/próxima" da folha são os botões que já chamavam `fBulkStepRow(±1)`, e a arte é o mesmo `_fBulkRenderHero`. Os inputs da folha usam os **mesmos ids** `f-bulk-edit-{i}-{k}` da tabela — é isso que deixa `fBulkSaveRow`/`fBulkCollectCurrentInputs` valerem sem mudança (leem por id e caem em `row.dados` quando o input não está na tela). ⚠ `_fBulkRenderFolhaCampos` **só repinta quando a linha muda** (`_fBulkFolhaRid`): cada tecla passa por `fBulkLiveEdit → fBulkSetActive → _fBulkSyncLiveHead`, e repintar ali reconstrói os inputs a partir de `r.dados`, que só é gravado 160ms depois — apagando a letra recém-digitada. ⚠ `fBulkSetActive` usa `[data-row]` e não `tr[data-row]`: no celular a linha é um `<button>` da lista |
| `fResizeImageIfNeeded` | chat.js | Resize nítido via Pica (fallback canvas); Color Thief sugere paleta da foto |

### Lojas e fotos (atalhos do franqueado) — tela em 2026-08-29

Dois atalhos que o franqueado acumula usando o Luma. Os dados **já existiam**; o que entrou foi a tela pra mexer neles.

| Peça | Onde | Papel |
|---|---|---|
| Perfil de loja | `prefs.js` (`fGetLojas`/`fAddLoja`/`fRemoveLoja`/`fSaveLojas`, chave `dm_lojas_v1`, cap 12) | `{id, nome, logo, cor, whatsapp}` do restaurante parceiro |
| Oferta no chat | `chat.js` (`fMaterialPreStart` → `fPickLoja`) | Chips antes da 1ª pergunta; aplicar preenche os campos e **remove as perguntas já respondidas** |
| Apelidos de campo | `chat.js` → `F_LOJA_CAMPOS` | Nome do campo varia por template: `logo_loja` · `nome_loja`/`nomeLoja`/`loja`/… · `whatsapp`/`telefone`/`contato` · `cor`/`cor_marca`/`cor_loja`. Fonte única — `fPickLoja`, `fConfirmSaveLoja` e o gate do atalho leem daqui |
| Fotos recentes | `upload-panel.js` (`fRecordRecentImg`/`fGetRecentImgs`, chave `dm_recent_imgs_v1`, cap 12) | Índice leve no localStorage (`{ref:'idb://…', thumb, ts, field}`); a imagem mora no IndexedDB |
| Escolha no chat | `upload-panel.js` (`fOpenUploadPanel`) | Recentes + lojas + "enviar novo arquivo", com link **Gerenciar** pra tela |
| **Tela de gerência** | `prefs-panel.js` (`fPrefsPanelRender`) + `css/components/prefs-panel.css` | Aba **"Lojas e fotos"** do painel de conta (`gProfileSwitchTab('atalhos')`, pane `#prof-pane-atalhos`). CRUD de loja (nome/logo/cor/WhatsApp), grade de fotos com apagar/ampliar |
| Entrada externa | `prefs-panel.js` (`fPrefsPanelOpen`) | Abre o painel de conta já nesta aba (usado pelo link Gerenciar) |

⚠ Apagar uma foto tira o índice **e** a imagem (`gIdbDel`, `img-store.js`) — só o índice deixaria blob órfão no aparelho pra sempre.
⚠ O logo entra redimensionado a 400px (`fResizeImageIfNeeded`): logo cru estoura a cota do localStorage.
⚠ Tudo é local (localStorage + IndexedDB), não sincroniza entre aparelhos. Prefs cross-device seguem no roadmap (v1.1).

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
| **Jeito local** | `chat.js` → `fGiriasDaCidade` / `fCidadeAtual` / `fGiriasCache` | **2026-08-29.** As expressões da cidade do franqueado entram no prompt da legenda como TEMPERO — no máximo uma por legenda, e só quando couber sozinha. Pesquisado **uma vez por cidade** (task `girias`) e guardado em `localStorage dm_girias_v1` (`{cidade, ts, termos}`, teto de 6, validade 180 dias); sumiu ou mudou de cidade → pesquisa de novo na próxima legenda. Console: `girias [ver\|limpar]` |

**O jeito local, em detalhe (2026-08-29).** O franqueado é vizinho de quem lê — "o dono do app mora na cidade" (`00_PRODUCT` §1) — e legenda em português neutro perde justamente isso.

- **De onde vem a cidade.** Ela **não é entidade do Luma** (`01_BUSINESS` §1), então `fCidadeAtual()` só LÊ o que já existe, nesta ordem: o campo `cidade` da arte em andamento → o "Sua cidade" do Sheets (`luma_bulk_city`) → o último visto (`dm_cidade_v1`, gravado quando a arte traz a cidade). Sem nenhum dos três **o recurso não roda** e a legenda sai como sempre saiu. Nenhuma tela de cadastro nova para um dado que mora no Portal.
- **⚠ Não é busca na web.** A Edge Function chama o modelo sem ferramenta de busca: ele responde do que sabe, e para cidade pequena pode não saber. Por isso o prompt pede lista **curta e certa** em vez de longa, aceita `[]` como resposta legítima (e **guarda o vazio**, senão cidade desconhecida viraria uma chamada por legenda, para sempre) e proíbe gíria nacional genérica, palavrão e termo que possa soar pejorativo com quem mora lá.
- **Filtro de formato no código, não só no prompt:** termo com mais de 24 caracteres (o modelo devolvendo frase), emoji ou termo vazio são descartados, e a lista é cortada em 6.
- **Sutileza é regra explícita:** o prompt da legenda ganha "use NO MÁXIMO UMA dessas expressões, em UMA das três opções, e só se couber com naturalidade; se nenhuma couber, não force". Quem revisa é quem publica — a legenda já é sugestão editável.

**Como estender:** mais variedade → adicionar itens nos pools de `_COPY_BLOCKS`. Novo segmento → adicionar detecção em `_fCopySegment` **e** os pools `hooks[seg]`/`hashtags[seg]` correspondentes (corpos/CTAs são compartilhados). Placeholders novos → registrar em `_fInterpolate`.

---

## 10. MÓDULO DESIGNER / ESTÚDIO (`d*`)

### Arquitetura: Canvas Único

O editor opera com **um canvas por template** (a era multi-artboard acabou; funções `dNewArtboard`/`dRenderABList` etc. foram removidas). `dLayers` é a lista plana global de camadas; `dGetActiveAB()`/`dSyncLayersToAB()` fazem a ponte com a estrutura persistida. `dLayers[0]` = fundo visual.

### Criar material: duas etapas (2026-08-19)

O modal `#d-newdoc-modal` ("Novo material", `dNewDocOpen`) pede **duas** coisas: **1)** o formato — só **Feed** (1080×1350) ou **Story** (1080×1920), o mapa `DNEWDOC_FORMATS` em `templates.js` — e **2)** a campanha (pasta) + o nome, já pré-preenchido por `dUniqueTemplateName`. Não há mais trilha de categorias, busca de formato, campos de largura/altura, unidade, ppi, orientação nem escolha de fundo: todo material nasce em **72 ppi com fundo branco**. `dNewArtboardCustom(w,h,bg,dpi,fmt)` segue aceitando dimensão arbitrária — é por ele que a importação de PSD entra com tamanho nativo.

### Ferramentas (toolbar vertical, atalhos)

`select` (V) · `text` (T) · `rect` (R, flyout de formas: elipse/triângulo/polígono/linha/estrela) · `frame` (F, moldura de foto) · `img` (M) · `brush` (B, presets round/soft/square/dotted/calligraphy) · `eraser` (E) · `stamp` (S) · `eyedrop` (I — só texto/forma) · `bucket` (G — só texto/forma) · grupo nitidez: `blur`/`sharpen`/`smudge` · `gradient`. Cursor dinâmico por ferramenta; pintura vive no `#d-paint-canvas` separado.

Outros atalhos: Ctrl+Z/Shift+Z (undo/redo, histórico coalescido cap 30 com pintura serializada), Ctrl+S (salvar), Ctrl+D (duplicar), Ctrl+G/Shift+G (agrupar), Ctrl+0/1/± (zoom), setas (mover 1px/10px), P (pré-visualização), ? (folha de atalhos), Esc (cancela contexto).

### Mover camada: `dLayerMove` é o motor ÚNICO (2026-08-14)

**Nada muda `l.x`/`l.y` na mão.** Todo caminho de movimento passa por `dLayerMove(l, dx, dy)`
(`js/designer/layers.js`) — alinhar (`dAlign`), distribuir (`dDistribute`), setas do teclado
(`publish.js`) e o arrasto. Duas responsabilidades moram lá, e é por isso que a função existe:

1. **Grupo se move pelos filhos.** Camada `type:'group'` **não tem `x`/`y`/`w`/`h`** — é um
   marcador, e os filhos apontam para ela por `parentId`. Quem lê `l.x` de um grupo pega
   `undefined` e propaga `NaN`. Para medir um grupo existe **`dLayerBox(l)`**, que devolve a
   caixa envolvente dos filhos. `dAlign` e `dDistribute` medem por ela.
2. **A trava vive aqui.** `locked` e `lockPosition` são checados no motor, não em cada chamador.
   Antes cada caminho refazia a conta e três deles furavam a trava (medido: forma travada em
   `x=100` indo para `x=930` num "alinhar à direita"). Travar é a defesa do designer para logo,
   selo e assinatura — ou vale em todo caminho, ou não vale.

⚠ Ao ligar um comando novo de posição, **roteie por `dLayerMove`**. `t.x += dx` reintroduz os
dois bugs de uma vez.

### Histórico: `dHistoryFlush` antes de navegar (2026-08-14)

Os commits são coalescidos: `dHistoryPush` fecha numa microtask e `dHistoryPushDebounced`
(setas do teclado, props em `oninput` contínuo) espera **400ms**. Dentro dessa janela o estado
atual ainda **não** está no histórico — e um Ctrl+Z ali passa na frente do commit e desfaz uma
ação a **mais**. Sintoma real: duas formas na tela, seta para a direita, Ctrl+Z imediato → o
movimento é desfeito *e a segunda forma some*.

`dUndo` e `dRedo` chamam **`dHistoryFlush()`** na primeira linha, fechando o commit pendente.
No `dRedo` isso pode truncar a pilha de refazer, e é o certo: se havia alteração não commitada,
o futuro que existia antes dela deixou de valer.

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

**Fidelidade:** cor e forma exatas do vetor (`vectorFill`/`keyOriginType` + caixa real do caminho, sem confundir a expansão do contorno com a geometria), incluindo **custom shapes Bézier**: âncoras e alças entram normalizadas na layer, continuam nítidas no resize e usam a mesma geometria no Estúdio, PNG e SVG. Path invertido ou com operações booleanas `subtract/intersect/exclude` conserva o fallback raster fiel em vez de ser simplificado. Também preserva gradiente linear/radial/refletido (cônico e losango rasterizam), sombra projetada/interna, brilho externo/interno, chanfro, sobreposição de cor e gradiente, contorno com alinhamento e tracejado, luz global do documento, `fontSize` por DPI + caixa de parágrafo 1:1, auto-entrelinha do PS, máscaras compostas em resolução adaptativa (700–1400px), **clipping vinculado à camada-base** (snapshot fiel até a primeira edição; depois acompanha a geometria ao vivo), árvore de grupos aninhados por `parentId` e composição isolada de máscara/opacidade/blend do grupo (o PNG compõe o grupo de verdade em `_fRenderGroup`; o canvas do Estúdio, que desenha em coordenadas absolutas por causa do drag, **carimba a mesma herança em cada filho** via `_dGrupoHeranca`), e **camadas de ajuste dinâmicas** para Brilho/Contraste, Níveis, Curvas, Exposição, Vibração, Matiz/Saturação, Inverter, Posterizar e Limiar. Formas também preservam **pilhas múltiplas** de sombra projetada/interna, sobreposição de cor/gradiente e contorno; o renderer e a prancheta compõem todas as instâncias, e o Estilo de Camada permite selecionar, reordenar, duplicar, remover e editar cada efeito. Gradientes preservam todos os stops importados e expõem as duas extremidades sem apagar as cores intermediárias. Ajustes respeitam ordem, grupo, máscara, clipping, opacidade e blend; seus parâmetros continuam editáveis no painel da camada. Remap de fontes com upload na hora, heurística de z-order e relatório de fidelidade por diff de pixel contra o composto do Photoshop completam o pipeline. `boxBounds` de texto que cobre os glifos mas diverge da âncora real é tratado como metadado obsoleto do Photoshop; o importador cai no bbox de glifos com semântica de point text, evitando empilhar ou quebrar verticalmente fragmentos independentes de preço.

**Viram imagem fiel** (visual 1:1, sem edição): smart object, padrão, rotação, espelho/180°, texto em curva, texto com warp, pilhas múltiplas em texto/imagem e combinações de efeito que o modelo não representa. Tipos de ajuste ainda fora do motor (ex.: LUT, Cor seletiva, Mapa de gradiente) permanecem identificados na pilha como não aplicados — nunca são descartados em silêncio. **Perdas avisadas na revisão:** cetim, contorno customizado de efeito, escala de efeitos ≠100%, traço com gradiente/padrão, texto justificado (entra alinhado pela última linha), estilos mistos de texto.

**Resolução de raster:** teto adaptativo à prancheta — comum `min(3200, max(1600, 2×maiorLado))` a q0.82; o de fidelidade (única fonte do visual) nunca abaixo de 2400px, a q0.92. **Moldura de foto** nasce com a arte importada em `imgUrl`: a foto do franqueado a substitui, não é mais um espaço vazio. Nome de camada com `fundo`/`background`/`bg` **não** vira moldura (o fundo é a arte; o designer promove na revisão se quiser).

**Checklist (`linter.js`) — "Texto Fixo que Deveria Ser Campo".** O espelho do painel Campos: aponta a camada de texto cravada na mão que vai sair com o valor velho na próxima promoção. Precisão acima de recall (checklist que grita demais ninguém lê): só acusa com sinal forte — valor em `R$`, ou nome da camada casando com o catálogo pelo `_dPsdSuggestVar` com `auto:true` (o mesmo motor do importador). Três filtros cortam o falso positivo: texto >60 caracteres é disclaimer, rótulo (`"Preço:"` ou texto igual ao nome do campo) é legenda, e camada já ligada não conta. O botão **Corrigir** usa `autoFix:'bindField'` → `dLayerBindField` — o mesmo bind do arrasto e do botão "Usar".

### Controle e confiança do franqueado (09/2026)

**Restart tem UMA porta.** `fAskRestartArt()` é o único caminho de UI (confirma via `gConfirm`); `fRestartArt()` é o motor e não pergunta nada — código interno e teste chamam ele. `fRefazer`/`fResetFlow` viraram alias; `fEditarTudo` (um terceiro reset, sem confirmação e sem chamador) foi removido. Antes do reset, `_fSnapshotArte()` guarda respostas, passo, conclusão, material, formato, cores extraídas, fotos, enquadramentos **e o HTML da conversa** — sem este último o chat volta vazio com a prévia cheia. O reset agora também limpa o rascunho do `localStorage`, que antes sobrevivia como fantasma.

**Desfazer é UM SLOT, não um histórico.** `_fUndoRegistra(rotulo, restaurar)` guarda a última ação desfazível do franqueado; `fDesfazer()` consome. Alimentado por refazer arte, aplicar enquadramento e editar pela prévia. ⛔ Não tem parentesco com `dUndo`/`dRedo` (`js/designer/undo-redo.js`), que empilha estados de camada no Estúdio. Ctrl/Cmd+Z só vale no modo franqueado e fora de campo de texto — senão roubaria o atalho do Estúdio e o desfazer nativo do navegador.

**`gToast` aceita ação:** `gToast(msg, tipo, helpTopic, {acao:{rotulo, onClick}})`. Com ação o toast vive 7s (2,8s é tempo de ler, não de decidir voltar atrás).

**Feedback é convite pós-download com carência local.** Não nasce mais grudado na entrega. `fFeedbackPodeConvidar(campId)`: 1 convite a cada 7 dias por dispositivo, 30 dias por campanha, um por sessão. ⛔ A decisão é local por design — o Supabase não é consultado para saber se pode perguntar; a persistência remota do feedback em si não mudou.

**`fPostedContextForFormat(fmt)`** decide o ambiente de publicação pela GEOMETRIA do material (`w/h` reais, ou o preset do formato): `≤0,72 → 'story'`, `≤2,20 → 'feed'`, senão `null` — e `null` esconde o botão "Ver como fica". Story nunca aparece como Feed nem o contrário.

**Olho da senha:** `gTogglePass()` troca o `type`; `gSyncPassToggle()` pinta ícone, `aria-pressed` e `aria-label` a partir do `input.type` real; `gResetPassToggle()` reesconde ao voltar da recuperação. O ícone tem dois estados (antes era um olho aberto fixo, que contradizia o campo metade do tempo).

### Encaixe do texto do franqueado — como a arte reage ao conteúdo

⚠ **Esta seção foi reescrita em 09/2026.** Ela descrevia o "layout vivo": uma cascata que inferia correntes entre camadas, abria corredores, empurrava o bloco de baixo, apertava respiro e entrelinha, devolvia tracking, escalava componentes e escolhia entre composições por nota. **Nada disso existe mais** — a seção seguinte (`Local Fit`) descreve o que substituiu tudo. O que segue aqui é só o que continua verdadeiro.

**O problema, que não mudou:** `maxLen` limita CARACTERE, mas o layout quebra em PIXEL.

**A régua única, que também não mudou.** `gFitTextLayer(layer, texto, ctx, opts)` (`00-config.js`) é a **única** resposta para "como este texto ocupa esta caixa" — quebra → caixa-alta → mede → encolhe, na ordem do render. A causa de 2026-08-05 era ter duas contas: a medida usava `gMeasureLayerHeight` (só quebras manuais, `lineHeight` 1.25, sem o tracking da fonte black) e o render quebrava depois com `gSmartWrapText`. A medida via 1 linha, o render desenhava 3. Hoje o render, o Local Fit e o Estúdio chamam a MESMA função; o encolhimento só é APLICADO depois no render, porque sombra/brilho/traço são dimensionados pelo tamanho desenhado.

**Texto não sobe.** Sem `vAlign:'top'` o render **centraliza** o texto na caixa (`png-generator.js`, `blockStartY`), então o que passa da caixa transborda metade para CIMA e come a margem do topo. A regra: enquanto cabe segue centralizado (é o desenho do designer); quando passa, ancora no topo e cresce só para baixo. `_gStampVTop` carimba `_vTopAuto` e o render lê o mesmo carimbo (`_vTop = l.vAlign==='top' || l._vTopAuto===true`). Quem escreve o carimbo hoje é o Local Fit, que é quem de fato mediu o encaixe.

**Interruptor, UM só**: a flag `franqueado.layout-vivo` no Controle do produto governa a **rede** (é da gestão). `gLayoutVivoOff` continua em `00-config.js` como estado dessa flag, mas **não tem botão**. Desligada, a arte sai com a geometria publicada e sem encaixe nenhum.

⚠ **Mudou em 09/2026 (rodada de usabilidade V1).** O botão **Auto-layout** e o botão **Auto-zoom** saíram da barra da prévia, com estado, preferência em `localStorage` e copy. Motivo: os dois pediam ao franqueado administrar mecanismo interno ("acomodação automática", "composição original", "versão segura" — vocabulário de solver na tela de quem só quer a arte da promoção). A preferência `luma-lp-auto-layout` é **apagada** na carga: salva como `"0"`, ela desligaria a proteção para sempre naquele aparelho, sem UI para religar.

⛔ **NÃO existe chave por template.** Todo template nasce com o encaixe ligado e o designer não decide nada no publicar (decisão do Ryan, 2026-08-06): não é escolha de design peça a peça, é o comportamento do produto. `publishMeta.layoutVivo` foi removido de `dDefaultPublishMeta`, do publicar e do render — se aparecer num publishMeta antigo, é ignorado.

⚠ **O encaixe é SÓ do lado do franqueado**: `fRenderTemplateLayers` exige `scope:'franqueado'`; qualquer chamada sem escopo cai em `designer` (fail-safe). Prévia e exportação recebem o mesmo clone resolvido. O Estúdio (`canvas.js`) e a prévia do designer (`preview.js`) usam `scope:'designer'` e mostram a geometria DESENHADA. O botão **Corrigir layout** e o solver genérico antigo foram removidos do Estúdio.

**O eixo X.** `_gInkDx` é o irmão do `_gInkDy`: point text centralizado cresce para os dois lados e alinhado à direita cresce para a esquerda (`png-generator.js` posiciona pelo `textAlign`). ⚠ Diferente do eixo Y, aqui **não** se força âncora à esquerda: centralizar horizontalmente é intenção de desenho, não acidente.

**A placa cresce com o texto (2026-08-07; grupos em 2026-08-13).** O padrão "card" — retângulo colorido com o preço ou o título em cima. Sem isso, a forma de fundo ficava parada enquanto o texto mudava: 62px de transbordo medidos numa placa de 140px, com a cor saindo debaixo da letra. `_gInferirPlacas` lê a relação do próprio desenho e `gLayoutPlacaSegue` faz a forma abraçar a tinta — texto que cabe deixa a placa idêntica à publicada. Regras apertadas para não adotar decoração: retângulo ou pill horizontal, atrás no z-order, envolvendo a TINTA autorada pelos quatro lados, no máximo 6× a área e um texto só dentro, com campo. PSD agrupado é aceito quando placa e texto têm o **mesmo `parentId`** e nenhum ancestral está travado/protegido; grupos diferentes nunca são unidos por coincidência visual. **Esta é a única exceção** ao "nada se move": a placa é parte do próprio campo.

⛔ **O piso da hierarquia não degenera** com uma assinatura miúda no rodapé. Medido em quatro hierarquias reais: `degraus.find` devolve o MAIOR degrau abaixo, não o menor, então a assinatura de 14px só entra em cena para camadas menores que ela. Suspeita descartada, código intacto.

**Checklist do Estúdio.** Ele audita somente a geometria publicada e os limites escolhidos pelo designer. Não oferece correção automática e não persiste adaptação. A garantia final fica na prévia/exportação do franqueado.

**Teste de estresse (o Estúdio avisa antes de publicar).** `maxLen` limita CARACTERE e o layout quebra em PIXEL — o designer autoriza 32 caracteres e não tem como saber, olhando os valores de exemplo, que aos 32 o título não cabe mais. `gStressValues(usados, dVars)` monta o texto mais longo que o franqueado PODE digitar (frase realista cortada EXATO no `maxLen`; frase curta demais repete até encher; sem `maxLen` vai inteira). Consome isso:
- **Checklist** (`_dLinterEstresse`, `linter.js`): monta o pior caso sobre a geometria original e acusa (a) colisão, (b) saída da prancheta nos quatro lados e (c) `estourou`. Mensagem com o número que o designer controla: *"com 32 caracteres em «Produto», «Título» invade «Preço»"*. Só acusa par que não se sobrepõe no estado de exemplo — selo atrás de texto é desenho, não estrago.
- **Teste de tensão** (2026-08-29, `canvas.js` + `modules/toolbar.css`): dentro do **Simular dados reais**, uma régua de 0% (vazio) a 100% (o pior caso PERMITIDO) que estica todos os campos juntos e diz o veredito a cada parada — verde "sai exatamente como você desenhou", laranja "o texto se encaixa sozinho", vermelho "trava aqui — <campo> não cabe na caixa". O botão **Onde trava?** varre a régua de 10 em 10 e conta a história numa frase, levando a régua ao ponto que interessa olhar. ⚠ **Exceção consciente ao escopo do Estúdio**: a prévia do simulador continua mostrando a geometria DESENHADA, mas o veredito responde a outra pergunta — "o que o FRANQUEADO vai receber?" —, então roda o runtime do franqueado (âncoras autoradas + `gLocalFitArte`) em clones. Se aqui rodasse outra coisa, o Estúdio mentiria para o designer.
- **Simular dados reais** (`canvas.js`): o cenário "Limite" usa `gStressValues` (antes tinha frases cravadas que ignoravam o `maxLen` e reprovavam texto que o franqueado nem consegue digitar). O selo "Revisar encaixe" por campo é ligado por `window._fOverflowSink`, que o render expõe; `dSimMarkOverflow` faz o caminho de volta camada → `{{campo}}`.

⚠ `gStressValues` usa frase realista, **não** `WWWW…`: a string mais larga possível reprovaria toda arte e o designer aprenderia a ignorar o aviso. Precisão acima de recall, igual ao resto do checklist.

⛔ O solver genérico `gResolveIntelligentLayout` foi removido. `core/layout.js` permanece apenas com Smart Resize entre formatos.

### Local Fit — o texto cabe na própria caixa, ou bloqueia (`js/core/local-fit.js`, 09/2026)

⛔ **O Automatic Designer foi REMOVIDO do produto.** Entre 08 e 09/2026 este arquivo cresceu para ~6.900 linhas construindo um designer automático: Layout Grammar, Composition Graph, Layout Components, elasticidade, impact zones, operational capability, designer moves, Candidate Search (beam, 240 candidatos × profundidade 8), scoring lexicográfico em 6 tiers, adaptive scale groups, zonas mortas perceptuais, shadow validation e faixas de confiança. **A decisão de produto mudou: o Luma não recompõe mais a arte de ninguém.** Tudo isso saiu do repositório, junto com a escada de recomposição que vivia dentro do `gApplyRelativeAnchors` (correntes inferidas, corredores, respiro, empurrão, escala de componente, emergência, alternativas por nota). O histórico está no Git.

**O fluxo oficial, inteiro:**

```
conteúdo novo → caixa autorada do texto → cabe no corpo original? → desenha
                                        → quebra (wrap)           → desenha
                                        → encolhe progressivamente → desenha
                                        → chegou ao piso de legibilidade → CONTENT_TOO_LARGE
```

**O que ele NÃO faz** — e a lista é o contrato: não move nenhum outro elemento, não empurra o CTA, não reancora, não abre corredor, não escala componente, não gera candidato, não pontua e não escolhe entre composições. A ÚNICA geometria que ele escreve fora do próprio texto é a da **placa ligada àquele texto** (o padrão "card": retângulo ou pill horizontal, atrás no z-order, abraçando a tinta pelos quatro lados, no máximo 6× a área do texto, um texto só e com campo).

**EXPLICIT > INFERRED.** A caixa que o designer desenhou é informação explícita — largura, altura, corpo, entrelinha, alinhamento, `maxLines` quando existe. Nada disso é inferido do grafo de composição, porque nada disso precisa ser.

**A API.** `gAuthoredTextBox(layer, opts)` formaliza a caixa autorada; `gFitTextToAuthoredBox(layer, conteudo, opts)` responde por UMA camada; `gLocalFitArte(layers, opts)` é o runtime que a prévia e o PNG chamam. Devolve `{layers, result}`, com `result.status ∈ original | wrapped | shrunk | overflow`, um laudo por campo e o payload de bloqueio.

**As duas invariantes que sustentam tudo:**
1. **A caixa autorada nunca vem da geometria adaptada.** Ordem de confiança: `layoutRef` (o contrato carimbado no vínculo) > `_layoutBase` > a camada com os carimbos removidos. Ler um clone adaptado como "o que o designer desenhou" faria a caixa encolher a cada volta.
2. **A tinta autorada é o piso da caixa.** O `w/h` que vem do PSD costuma ser o bbox JUSTO do texto original; com `lineHeight` 1.2 a tinta de uma linha pode medir 1px a mais que a caixa. Sem isso o próprio texto do designer seria declarado overflow. Espaço disponível = `max(caixa desenhada, tinta autorada)` — e "conteúdo igual ao autorado ⇒ cabe" passa a ser verdade por **construção**.

**ORIGINAL FIRST ABSOLUTO.** Quando o conteúdo cabe como desenhado, a camada sai **sem um único carimbo** — é o mesmo objeto que a arte publicada produz. Não é tolerância de comparação, é ausência de escrita. O corpus trava isso com igualdade exata contra o `x/y/w/h` que o designer salvou.

**Como o resultado chega ao desenho.** O único carimbo é `_tetoFonte`. `gFitTextLayer` (a régua do render, em `00-config.js`) lê `min(_tetoFonte, fontSize)` como corpo de partida, então prévia e PNG desenham no corpo que o Local Fit decidiu — sem segundo motor, sem segunda medida. É daí que sai a paridade prévia = exportação, e o corpus compara os dois PNGs byte a byte.

**Caixa 2D.** Não basta caber horizontalmente: wrap que cria linhas demais e ultrapassa a altura continua sendo overflow.

**Teto de linhas — e a distinção que custou caro.** `maxLines` EXPLÍCITO bloqueia. O teto SEMÂNTICO (título 3, preço 2, CTA 2, legal 8, apoio 4) é **preferência editorial, não dano**: o motor antigo bloqueava por ele, e 12 dos 14 bloqueios do corpus eram artes inteiras dentro da prancheta, sem tocar em nada, barradas só por isso. Reduzir linhas exige uma caixa mais larga — e alargar caixa é recompor, que saiu do produto. Então o teto semântico informa e não trava.

**Shrink.** Progressivo e determinístico, em degraus de 8% (o mesmo degrau do `gFitTextLayer` — inventar outro faria os dois pararem em corpos distintos). Nunca direto para o mínimo. Para no piso de `gLayoutPisoFonte`: hierarquia (`_pisoFonte`, não inverter os degraus do designer) ∪ legibilidade (`_pisoLegivel`, 2,2% do lado curto para destaque, 1,35% para apoio) ∪ metade do corpo desenhado. **Não existe modo de emergência** — emergência era escala proporcional de componente, que é movimento de composição.

**A UI do bloqueio.** Na **prévia**, o `#lp-layout-nota` acende só quando a arte trava: ponto vermelho, o rótulo do campo e "encurtar", clicável. Enquanto o texto cabe, a linha fica calada. No **download**, um diálogo diz o número medido (*"cabem até 28 caracteres aqui — hoje tem 46"*) e leva ao campo, com o contador já no alvo (`fMarcaLimiteSeguro`). Os dois caminhos chamam a mesma função (`fCorrigirTextoLongo`, em `chat.js`). ⛔ O limite medido **não corta** o texto: é estimativa por caractere. Detalhe e números em `docs/LOCAL-FIT-CONTRACT.md` §15.

**Fail safe.** Nunca desenha texto quebrado em silêncio. Na **exportação**, o bloqueio vira `LUMA_CONTENT_TOO_LARGE` com `{fieldId, overflowX, overflowY, requiredLines, fontSize, minimumFontSize}`. Na **prévia**, não interrompe — a pessoa precisa VER o que não cabe para saber o que encurtar. `gLocalFitDiagnostico` acha o campo culpado e o **maior conteúdo seguro** por busca binária sobre o próprio Local Fit daquele campo (~12 encaixes de uma camada; a versão anterior re-rodava o solver inteiro até 8 vezes). Mensagem em PT-BR com o rótulo do Dado, nunca o nome técnico: *"O texto de «Nome do produto» é longo demais para esta arte. Cabem até 28 caracteres aqui — hoje tem 47."*

**Campo vazio não é erro.** Não encaixa, não bloqueia, não adapta nada. Texto FIXO do designer também fica de fora: ele escreveu, ele mediu, ele publicou — encaixar o que o franqueado não pode editar só produziria bloqueio sem saída.

**Distribuição medida no corpus** (6 pranchetas reais × 4 níveis de copy, 23 cenários): o Local Fit resolve sozinho **78,3%** — `curto` 100% original, `medio` 100% original, `longo` 50% shrink / 50% overflow, `extremo` 60% shrink / 40% overflow. Overflow seguro é resultado válido; 100% seria a meta errada.

**Desempenho por edição de campo** (runtime completo, âncoras + Local Fit, conteúdo real): cabe de primeira p95 **12,1ms**, shrink p95 **11,2ms**, até o piso p95 **8,2ms**. O fuzz de 60 rodadas adversariais: p50 0,3ms, p95 3,9ms, pior caso 43ms (era 141ms). A Candidate Search custava 14,5s numa arte de 344 camadas.

---

#### As primitivas que sobreviveram (`js/core/auto-layout.js`, 544 linhas)

Elas descrevem a arte; nenhuma decide composição.

**1. Baseline autorado universal (`layoutRef` + `layoutRefText`).** Antes só o import de PSD gravava a referência do desenho; camada ligada pelo painel Campos não gravava nada e template antigo não tinha. Agora: **no vínculo** (`dLayerBindField`, `layers.js`), `gStampLayoutBaseline` grava a frase que o designer compôs, a geometria, as métricas (corpo, entrelinha, tracking, alinhamento, nº de linhas), a tinta medida e uma **sonda de fonte**; **na importação** (`psd-parse.js`), o mesmo carimbo, DEPOIS de todas as propriedades; **no material antigo** (`gEnsureLayoutBaseline`), reconstruída a partir do **exemplo do campo**. Rótulo do campo nunca entra: é nome técnico travestido de conteúdo. Sem exemplo confiável, fica sem baseline em vez de ganhar um falso. É a migração dos materiais publicados, sem deploy e sem reabrir template.

**2. Determinismo de fonte.** O mesmo template abre em Chrome, Safari/iOS e Android; se a fonte da marca não carregou num deles, o navegador substitui e o MESMO texto mede diferente. `gLayoutFontDrift` mede a sonda de novo e corrige o baseline pela razão; `gLayoutFontStatus` classifica `ok`/`substituida`/`desconhecida` e isso vai para a telemetria. ⚠ **A promessa é DECISÃO igual, não pixel igual** — rasterizadores diferentes desenham diferente. *(Falta exercer em Safari/iOS e Android reais — ver `luma-brain/07_ROADMAP.md`.)*

**3. Compilador semântico (`layoutSemantic` + `layoutRole`).** `gCompileLayoutRoles` classifica cada camada em título/produto/preço/apoio/legal/CTA/fundo/decoração/protegida a partir de nome, conteúdo, posição/área e degrau tipográfico. **Dois vocabulários de propósito:** `layoutSemantic` é a classificação rica; `layoutRole` é o contrato antigo do runtime e só recebe `'background'`/`'protected'`. Campo dinâmico **nunca** é carimbado. `layoutRoleManual` vence sempre. O papel governa o teto de linhas (`gLayoutRoleMaxLines`) e alimenta o piso de hierarquia.

**4. Safe zones de imagem.** `_dPsdInkBox` (psd-parse) mede a caixa do que é OPACO enquanto os pixels ainda estão na memória. `gLayoutObstacleRect` protege o ASSUNTO em vez da moldura. Sem `inkBox`/`safeZones` devolve a caixa de sempre: material publicado não muda.

**5. Quebra semântica.** `gSemanticUnits` agrupa o que não é "duas palavras" e sim UMA informação — `R$ 29,90`, `US$ 15`, `50 %`, `500 ml`, `2 por` — e cola a preposição na palavra seguinte para não ficar órfã. A cola é **condicional**: só vale se a unidade colada continuar cabendo, senão cairia na quebra dura por grafema e partiria a palavra no meio.

**6. Telemetria (`layout_resolvido`).** Registra em `analytics.fct_eventos`: veredito, origem (prévia/exportação), template, material, formato, **tempo**, camadas alteradas/inválidas, **campo culpado**, limite seguro e estado das fontes. ⚠ Nunca vai CONTEÚDO do franqueado — só o NOME do campo e o tamanho. A prévia re-renderiza a cada tecla, então há trava por chave (template+formato+status+campo); exportação sempre registra.

⚠ **O preço não tem mais regra especial.** A regra de 19/08 ("preço só cede por causa do próprio preço") existia porque a escada de recomposição podia encolher o preço por causa de um TÍTULO longo (medido: 36% menor por motivo alheio). Com o Local Fit isso virou consequência da arquitetura: cada texto encaixa sozinho, na própria caixa, então nenhum campo cede por causa de outro. `gLayoutEhPrecoDinamico` sobrevive só para o teto de linhas do preço e para o reconhecimento do par de preço. **Consequência assumida:** como cada campo encolhe isolado, uma camada autorada maior pode terminar menor que o preço — nas artes da marca o preço costuma ser o maior elemento, então a inversão é tolerada no corpus em vez de reprovar a arte.

#### O que sobrou do `gApplyRelativeAnchors`

Interpola o conteúdo e resolve as âncoras **manuais** do designer. É tudo. Não mede encaixe, não quebra, não encolhe, não empurra ninguém por causa de conteúdo. O laço de âncoras existe porque `relativeAnchor` é intenção AUTORADA — o designer encadeou dois elementos de propósito, e isso continua valendo.

#### Cobertura

`node scripts/run-browser-tests.js` — **382 casos**. `tests/local-fit.html` (37) é a suíte do comportamento: escada, caixa 2D, maxLines, palavras longas, uppercase, display, preço/unidades, campo vazio, placa local, terceiros intocados, determinismo, prévia = exportação, e o portão de que nenhum símbolo do Automatic Designer voltou. `tests/corpus.html` (30) roda 6 pranchetas reais em 4 níveis de copy com golden de geometria e imagem. `tests/fuzz.html` (63) prova que o motor sobrevive ao que o franqueado digita de verdade. `tests/auto-layout.html` (14) cobre as primitivas de leitura. `tests/franqueado-fluxo.html` (42) cobre a UI do bloqueio, em 6 casos.


#### O CONTRATO: a geometria publicada manda (2026-08-14, reafirmado em 09/2026)

> *"As medidas que eu deixei no momento em que cliquei em publicar são as medidas que eu quero que sejam respeitadas. Caso a pessoa digite a mais, ele vai se autoajustando pra não quebrar a hierarquia que eu, como designer, pensei."* — Ryan

A frase continua sendo a regra. O que mudou em 09/2026 foi **onde** o "se autoajustando" acontece: dentro da caixa daquele texto, nunca na composição. A primeira metade é literal — enquanto couber, a arte do franqueado é a arte do Estúdio, mesma fonte, mesma posição, mesma quebra, veredito `original`.

Duas lições medidas na época continuam valendo, porque as duas são sobre MEDIR A REFERÊNCIA CERTA — e é delas que saiu a invariante da tinta autorada do Local Fit:

**A referência é a tinta autorada, não a caixa desenhada.** Quando o texto autorado já ocupa mais que a própria caixa — o caso NORMAL de PSD, onde a caixa é o bbox justo dos glifos da frase original — comparar contra a caixa declarava crescimento onde não houve nenhum. Medido na época: com o texto idêntico ao do designer, o produto descia 64px e o veredito saía `adapted`. Vale para caixa de parágrafo também: a largura continua sendo a da caixa (é fixa por definição), a **altura** é a da tinta autorada.

**A prévia abre com o TEXTO AUTORADO, não com o rótulo do campo.** Antes de a pessoa digitar, `fLpInjectPlaceholders` preenche os campos vazios; a ordem antiga caía num exemplo de dicionário ou no rótulo ("Nome do produto") quando o campo não tinha `example` — quase sempre mais longo que a frase original, então a arte já abria adaptada e menor. Hoje o placeholder é o próprio `layoutRefText`, que o baseline universal garante em toda camada. ⚠ Só quando a camada é o campo INTEIRO: em `De {{de}} por`, o `layoutRefText` guarda a frase montada e usá-la como valor do campo produziria *"De De R$ 49,90 por por"*.

⛔ **O que continua encolhendo, e deve:** texto que genuinamente não cabe na caixa que o designer desenhou. E o que NÃO acontece mais: ninguém é empurrado para abrir espaço.

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
- **Toast** (`core/toast.js`): `gToast(msg, type, helpTopic?)` — 2.8s, **sempre neutro**. O Luma não alarma (decisão do dono, 12/08): `type:'error'` perde a cor, o `role=alert` e o CTA de ajuda, **mas a mensagem aparece** — o corte era um `return` e deixava 171 chamadas mudas, incluindo instruções ("converta o vídeo para MP4"), corrigido em 13/08. ⚠ **Sem fila** — chamadas em sequência se sobrescrevem. Também: `gBtnLoading`, `gWarnImagesNotPersisted`, **`gEsc`** (escape HTML global — `_dEsc` e `_dSvgEsc` delegam nele; não há terceira régua).
- **Diálogo** (`core/toast.js`): `gConfirm(msg, opts) → bool` e `gPrompt(msg, def, opts) → string|null` são o **único** caminho de confirmação. ⛔ `confirm()`/`prompt()` nativos não existem mais no código (migração fechada em 13/08 — cada chamada virou `async` e re-resolve o alvo **por ID/nome** depois do `await`, porque undo/sync trocam os objetos por clones). Estilo em `css/modules/toolbar.css` (`.g-dialog*`), com tokens.
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
| `dm_lojas_v1` | Perfis de loja do franqueado (nome/logo/cor/WhatsApp), cap 12 |
| `dm_recent_imgs_v1` | Índice das fotos recentes (ref `idb://` + thumb), cap 12 — imagem no IndexedDB |
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

**Técnicas:** arquivos grandes (`canvas.js`, `layers.js`, `templates.js` ~1k linhas) · cobertura de teste estreita (só solver de Auto-layout e importador de PSD; o resto, regressão só no navegador — §4 e `luma-brain/MAPA.md`) · pontas soltas conhecidas (`fStartChatPreservandoDados` órfã; `fDownloadHist` marca "baixada" mesmo se o PNG falhar; `return` morto em `dMeasureText`; `realce-black.woff2` órfã no disco).

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
- **`luma-brain/MAPA.md`** — o mapa do código (onde mora cada coisa). Metade é **gerada** por `node scripts/mapa.js` dos cabeçalhos do próprio código; a outra metade (rota rápida, motores únicos, armadilhas de leitura) é escrita à mão e sobrevive à regeneração. Substituiu a árvore de arquivos que era o §4 daqui. **Não descreva estrutura de arquivos neste doc** — vai desencontrar do código como o §4 desencontrou.
- ⚠️ **Correção (2026-09-03): a linha acima sobre docs "removidos em 2026-07-16" é falsa.** `LUMA-BACK_CONTEXT.md` (1.000 linhas), `LUMA-REGRAS_BACKEND.md` (1.865), `BACKLOG-EDITOR-FASE5.md` (84) e `CENTRAL-AJUDA-DIAGNOSTICO.md` (194) **continuam em `docs/`** — ~3.100 linhas que este doc jura não existirem, e as duas primeiras descrevem **outro projeto** (Portal de Franqueados / DM CRM). Estão marcadas como armadilha de leitura no `MAPA.md`. Apagar de verdade é decisão do Ryan.
- Para inventário exaustivo de funções/IDs além do que está aqui: o `MAPA.md` lista as globais por arquivo; para o resto, o código é o inventário — `grep` pelos prefixos.
