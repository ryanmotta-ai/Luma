# MAPA — onde mora cada coisa no Luma

> **Leia este arquivo ANTES de dar `grep` ou abrir arquivo.** Ele existe para você não gastar
> leitura descobrindo o que já está escrito aqui: 67 arquivos JS, 53 mil linhas, 2.131 funções
> globais. Achar o arquivo certo de primeira é a diferença entre uma leitura e oito.
>
> **Metade deste arquivo é gerada** (`node scripts/mapa.js`), a partir do cabeçalho de cada
> arquivo do código. Por isso ele não envelhece como a árvore do `docs/LUMA.md` §4 envelheceu
> — aquela dizia 44 arquivos JS quando já existiam 67.
>
> Este mapa diz **ONDE**. O `docs/LUMA.md` diz **COMO** (funções, tabelas, policies em detalhe)
> e o `luma-brain/02_ARCHITECTURE.md` diz **POR QUÊ**. Última regeneração: no rodapé do trecho gerado.

---

## Como usar (o contrato de leitura)

1. **Ache o assunto na rota rápida abaixo** → ela dá o arquivo. Vá direto nele.
2. **Antes de escrever função nova**, confira "Os motores únicos". Criar o segundo interpolador,
   o segundo escape ou o segundo render **é o bug**, não a solução (`03_ENGINEERING` §1).
3. **Não leia o que está em "Armadilhas de leitura"** — tem doc neste repositório que descreve
   outro projeto e doc que se declara removido sem ter sido.
4. Precisa de uma função específica e o mapa não a cita? `grep -rn "^function nome" js` é uma
   chamada e resolve. O mapa serve para escolher o arquivo, não para substituir o `grep`.

---

## A rota rápida — "quero mexer em X"

### Franqueado (`f*`) — quem consome o template

| Quero mexer em… | Vai em |
|---|---|
| Vitrine, campanhas, categorias, abas, filtro, home | `js/franqueado/catalog.js` |
| Lista de materiais dentro da campanha | `js/franqueado/materials.js` |
| As perguntas do chat, ordem dos passos, voltar, gerar arte | `js/franqueado/chat.js` |
| Tipo de campo, máscara, validação, limite de caracteres, erro de campo | `js/franqueado/chat-input.js` (`F_FIELD_TYPES`) |
| Prévia ao vivo, gaveta da prévia no celular, zoom da prévia | `js/franqueado/live-preview.js` |
| Como o PNG/JPG/PDF é desenhado e baixado | `js/franqueado/png-generator.js` |
| Sheets / geração em massa (folha, fila de ofertas, rascunho) | `js/franqueado/png-generator.js` (`_fBulk*`, a partir da linha ~1300) |
| Legendas sugeridas do post (combinatório, **não é IA**) | `js/franqueado/png-generator.js:4435` (`fBuildCopy`, bancos em `_COPY_BLOCKS:4016`) |
| Postar no Instagram / enviar no WhatsApp | `js/franqueado/png-generator.js` (`fPostarInstagram`, `fEnviarWhatsApp`) |
| Histórico de artes, badge, "baixada" | `js/franqueado/history.js` |
| Lojas salvas, favoritos, fotos recentes | `js/franqueado/prefs.js` + `prefs-panel.js` + `upload-panel.js` |
| Arrastar as 3 colunas do workspace (desktop largo) | `js/franqueado/panel-dock.js` |

### Estúdio (`d*`) — quem cria o template

| Quero mexer em… | Vai em |
|---|---|
| Canvas, zoom, pan, réguas, guias, simulação de dados, mouse | `js/designer/canvas.js` |
| Criar/apagar/renomear camada, painel de camadas, multi-seleção | `js/designer/layers.js` |
| Painel de propriedades (acordeão, alinhamento, sub-nav) | `js/designer/props-panel.js` |
| Template e pasta: CRUD, carregar, montar camadas, modal | `js/designer/templates.js` |
| Publicar template (o modal de 4 abas) | `js/designer/publish.js` |
| Caixa de seleção, handles, transform | `js/designer/selection.js` + `canvas.js` |
| Pincel, borracha, carimbo | `js/designer/brush.js` (borrachas avançadas: `eraser-tools.js`) |
| Máscara de camada | `js/designer/mask.js` |
| Blend mode | `js/designer/blending.js` |
| Importar PSD — a tela de revisão | `js/designer/psd-import.js` |
| Importar PSD — a leitura do arquivo e a fidelidade | `js/designer/psd-parse.js` |
| Prévia do Estúdio, export PNG e export SVG | `js/designer/preview.js` |
| Fonte enviada pelo designer (.ttf/.otf/.woff) | `js/designer/fonts.js` |
| Biblioteca de assets, painel lateral, tema do Estúdio | `js/designer/library.js` |
| Linter de design / auditoria de layout | `js/designer/linter.js` |
| Régua, conta-gotas, medição | `js/designer/measurement.js` · `tools.js` |
| Undo/redo | `js/designer/undo-redo.js` |

### Core (`g*`) — o que os dois lados usam

| Quero mexer em… | Vai em |
|---|---|
| Campanhas, formatos, categorias de campo, ícones SVG de campo | `js/00-config.js` (`CAMPS_ATIVAS:27`) — ⚠️ campanha ainda é hardcode, criar campanha exige deploy |
| Abas e modos (franqueado/estúdio/academia), gate por role+flag | `js/main.js` (`setMode:68`, `G_MODE_FEATURE:23`, `gModeAllowed:26`) |
| Toast, confirm, prompt | `js/core/toast.js` (`gToast:20`, `gConfirm:129`, `gPrompt:130`) |
| Login, logout, role, `gIsAdmin` | `js/core/auth.js` |
| Cliente Supabase (`window.sb`) | `js/core/supabase.js` (+ `supabase-config.js`) |
| Feature flags — o motor | `js/core/feature-flags.js` (`gFeatureCan:370`) |
| Feature flags — a tela da gestão | `js/core/product-control.js` |
| Qualquer recurso de IA | `js/core/ai.js` (`gAskAI:78`) + `supabase/functions/ai/index.ts` (a chave e os prompts) |
| Imagem grande / cache `idb://` | `js/core/img-store.js` |
| Central de ajuda | `js/core/help.js` + `js/widgets/help-widget.js` |
| Console CLI da equipe | `js/core/console.js` |
| QR Code | `js/core/qr.js` |
| Som, splash, instalar PWA | `js/core/sound.js` · `splash.js` · `pwa-install.js` |
| Painel da conta do usuário | `js/core/user-profile.js` |

### Calendário (`cal*`) — o que a rede comunica e quando

| Quero mexer em… | Vai em |
|---|---|
| **A fonte do dado** (trocar o seed pela tabela/CSV oficial) | `js/calendario/calendario.js` — `calFetch()`, o **único** ponto de troca |
| Estado, helpers de data, Visão geral, grade do Mês, faixas de vários dias | `js/calendario/calendario.js` |
| Vista Semana e Dia, régua de horas, linha do agora, conflito, vão livre | `js/calendario/agenda.js` |
| Criar/editar evento, date/time picker, preview do ponteiro | `js/calendario/evento.js` |
| Qualquer estilo do módulo | `css/modules/calendario.css` |

⚠️ Três regras que o módulo assume e que não estão óbvias no código:
**recorrente não ocupa pista na grade** (cobre o mês inteiro; sai na tira "sempre no ar");
**só `gIsAdmin` cria/edita/arrasta** — o franqueado lê; e **não existe "adicionar na
minha agenda"** — é o calendário de marketing da REDE, não a agenda pessoal do
franqueado (o Quick Add em linguagem natural existiu e saiu em 03/09).

### Academia (`ac*`) e Tutorial (`tut*`)

| Quero mexer em… | Vai em |
|---|---|
| Núcleo, home, estado, matrícula | `js/academia/academia.js` |
| Ambiente de aula, player MP4, abas de aprendizado | `js/academia/aula.js` |
| Tutor educacional (o prompt mora no **servidor**) | `js/academia/agente.js` + `supabase/functions/ai` (task `aula`) |
| Gestão de conteúdo do curso (equipe) | `js/academia/gestao.js` |
| Certificado (emite pela RPC, não por insert) | `js/academia/certificado.js` · `conclusao.js` |
| Movimento/animação da Academia | `js/academia/motion.js` |
| Tutoriais interativos | `js/tutorial/engine.js` (motor) · `catalog.js` / `catalog-studio.js` (conteúdo) |

### Visual

| Quero mexer em… | Vai em |
|---|---|
| **Qualquer cor, espaçamento, curva de motion** | `css/00-tokens.css` — nunca hex solto |
| Keyframes globais + guarda de `reduced-motion` | `css/02-animations.css` |
| Tela de login (⚠️ geometria do baralho é contrato medido) | `css/components/login.css` |
| Estilo de um módulo | `css/modules/<módulo>.css` — tabela completa no trecho gerado |

---

## Os motores únicos — ⛔ nunca crie um segundo

| Motor | Onde | Papel |
|---|---|---|
| `gInterpolate` | `js/00-config.js:349` | Troca `{{campo}}` por valor. **Um só**, ou designer e franqueado divergem |
| `gEsc` / `_dEsc` | `js/core/toast.js:49` | Escape antes de `innerHTML`. Escapar "na mão" em um ponto = brecha de XSS |
| Smart resize | `js/core/layout.js` (`gReflowLayers:67`) | Re-ancora entre formatos por fator único. Nunca redimensione à mão |
| Solver de composição | `js/00-config.js:1745` (`gApplyRelativeAnchors`) | Âncoras relativas |
| Julgamento de layout | `js/core/auto-layout.js` | A camada que decide, acima do solver |
| Feature flags | `js/core/feature-flags.js` | Nenhum outro arquivo fala com a tabela de flags |
| Tubulação de IA | `js/core/ai.js` (`gAskAI:78`) | Ninguém monta `fetch` para o modelo na mão |
| Tokens | `css/00-tokens.css` | Cor e motion nascem aqui |

### ⚠️ O render NÃO é um motor único — são quatro (medido em 2026-09-03)

O `02_ARCHITECTURE` §4 promete "um único motor de render, três alvos". **O código diz outra
coisa.** Existem quatro implementações independentes de "desenhar uma camada":

| Caminho | Onde | Serve |
|---|---|---|
| DOM absoluto | `js/designer/canvas.js:1107` (`dRenderCanvas`) | edição no Estúdio |
| Canvas 2D nº 1 | `js/designer/preview.js:145` (`pvRenderLayer`, ~225 linhas) | prévia e export do Estúdio |
| Canvas 2D nº 2 | `js/franqueado/png-generator.js:675` (`fRenderOneLayer`, ~536 linhas) | prévia do franqueado e PNG final |
| SVG | `js/designer/preview.js:523+` (`dSvgShape`/`dSvgText`/`dSvgFx`, ~563 linhas) | export vetorial |

`preview.js` **não chama** `fRenderTemplateLayers` em lugar nenhum — é renderizador paralelo
vivo, entrando por `dPreviewOpen`. E `measureText` (quebra de linha, a parte difícil) aparece
em **6 arquivos**.

**Consequência prática ao mexer em composição:** feature nova de camada (grupo, clipping,
máscara, blend, efeito) precisa nascer em **todos os caminhos que a exibem**, ou a prévia
passa a divergir do arquivo final. Foi assim que a composição de grupo do PSD ficou meio
caminho. Ponto de entrada de cada caminho está na tabela acima — comece por `fRenderOneLayer`
(é o que o franqueado baixa) e confira o espelho no `pvRenderLayer`.

---

## Armadilhas de leitura — ⛔ não gaste leitura aqui

| Arquivo | O problema |
|---|---|
| `docs/LUMA-REGRAS_BACKEND.md` (1.865 linhas) | **É de outro projeto** — Portal de Franqueados / DM CRM, Supabase `gplxnzgsculryjykbcuo`. Não é o Luma |
| `docs/LUMA-BACK_CONTEXT.md` (1.000 linhas) | Mesmo caso: outro projeto |
| `docs/LUMA.md` §20 | Declara os dois acima (+ `BACKLOG-EDITOR-FASE5.md` e `CENTRAL-AJUDA-DIAGNOSTICO.md`) **removidos em 2026-07-16**. Os quatro continuam no disco: ~3.100 linhas que o doc jura que não existem |
| `docs/LUMA.md` §4 | A árvore de arquivos ("verificada 2026-07-09") lista 44 arquivos JS de 67. **Use este MAPA no lugar** |
| `docs/ROADMAP-UI-1.0.md` | Roadmap antigo. O oficial é `luma-brain/07_ROADMAP.md` |
| `extract-css.pl` · `extract-js.pl` · `__codex_audit.html` | Ferramentas de extração de uma migração já concluída. Não são o app |
| `check.js` (raiz) | Usa `puppeteer`, que não está nas dependências. Não roda — **o runner de verdade é `scripts/run-browser-tests.js`** (ver abaixo) |

---

## Verificação — o Luma TEM teste automatizado

⚠️ **O `CLAUDE.md`, o `03_ENGINEERING` §7 e o `06_OPERATING_SYSTEM` §4 dizem que este projeto
não tem teste nem runner. Isso deixou de ser verdade.** Rodado em 2026-09-03: **119 casos
verdes**. Os docs são de antes da suíte existir.

```
node scripts/run-browser-tests.js              # todas as suítes
node scripts/run-browser-tests.js auto-layout  # filtra por nome
CHROMIUM_PATH=/caminho/chrome node scripts/run-browser-tests.js
```

| Suíte | Cobre | Casos |
|---|---|---|
| `tests/auto-layout.html` | invariantes do solver de layout | 34 |
| `tests/corpus.html` | corpus de composições reais + golden de geometria | 18 |
| `tests/fuzz.html` | exceção, `NaN`, laço que não converge, bloqueio sem diagnóstico | 63 |
| `tests/psd-import.html` | regressão do importador de PSD | 4 |
| `tests/_bancada.html` | bancada de sondagem (exploração, não é portão) | — |

**Como respeita a 1ª lei:** o runner fala DevTools Protocol direto, com o WebSocket nativo do
Node 22 e o Chromium que já existe na máquina. Zero dependência, nenhum `npm install`, nada
disso entra no `index.html`. `.github/workflows/tests.yml` roda a cada push e PR que toque
`js/**` — **é portão de CI, reprova o commit.**

**O que a suíte cobre e o que não cobre:** ela cobre o solver de layout e o importador de PSD.
Ela **não** cobre o interpolador, o gerador de PNG, o chat, o catálogo nem nada de UI — para
esses a verificação continua sendo o navegador. Suíte verde não substitui abrir o fluxo tocado.

---

## Fora do `js/` e do `css/`

| Assunto | Onde |
|---|---|
| Schema, RLS, policy, RPC, migration | `supabase/migrations/*.sql` — **toda** mudança vai no `docs/LUMA-BACKEND-CHANGELOG.md` |
| Chave da IA, prompt do tutor, rate-limit, allowlist de tarefas | `supabase/functions/ai/index.ts` |
| Convite de usuário (precisa de service role) | `supabase/functions/invite-user/index.ts` |
| Cache-busting: **um `?v=N` para todos** os assets de `js/` e `css/` | `index.html` — `sed -i 's/?v=9/?v=10/g' index.html` (`03_ENGINEERING` §6.1) |
| Ordem de carga dos `<script>` | `index.html` — a lista completa está no trecho gerado |
| Backup diário | `.github/workflows/` + `scripts/backup-storage.js` |
| Suítes de regressão (solver de layout, PSD) | `tests/*.html` + `scripts/run-browser-tests.js` |
| Este mapa | `scripts/mapa.js` |

---

<!-- AUTO-INICIO: gerado por scripts/mapa.js — nao edite a mao -->

> Gerado por `node scripts/mapa.js` a partir dos cabeçalhos dos próprios arquivos.
> **Não edite este trecho à mão** — a próxima regeneração sobrescreve.

**Tamanho real de hoje:** 72 arquivos JS (57.023 linhas, 2.282 funções) · 32 arquivos CSS (27.823 linhas) · `index.html` com 3.793 linhas e 74 `<script>`.

## JS — o que cada arquivo é

### js (raiz)

**`js/00-config.js`** · 3015 linhas
Constantes globais imutaveis: HIST_KEY, CAMPS_ATIVAS, CAMPS_OUTRAS, FMTS. Deve ser carregado PRIMEIRO (todos os modulos dependem destas constantes).
· API: gVarRegex, gValidVarName, gXmlEsc, gRoundPolyD, gRoundPolyPath2D, gVectorPathFillRule, gVectorPathValid, gTraceVectorPath, gVectorPathD, gFxOffset, gFxRgba, gGradStopsCss, gGradientCss, gGradientCanvas … (+42; 85 funções no total)
· Estado global: gLayoutVivoOff, _gCanvasWrap

**`js/01-state.js`** · 11 linhas
Estado global do franqueado: fState. Deve ser carregado apos 00-config.js.

**`js/main.js`** · 288 linhas
Bootstrap: setMode (troca entre franqueado/designer) e chamadas de inicializacao. Deve ser carregado por ULTIMO (apos todos os modulos).
· API: dUpdateTabPill, gModeAllowed, gFirstAllowedMode, gGoHome, setMode, gRestoreMode, gApplyModeAccess, gOnLoginSuccess

### js/core

**`js/core/ai.js`** · 187 linhas
MOTOR ÚNICO de IA do front. Todo recurso de IA do Luma (legenda, encurtar texto, ajuda, leitura de cardápio, casar fotos, mapear camadas do PSD) fala com o modelo POR AQUI — ninguém mais monta fetch pro Gemini na mão. Um…
· API: gAiReady, gAiEdgeReady, gAiModel, gAskAI, gAiParseJson, gAiFileToPart
· Depende de: core/supabase.js (gSupabase), core/img-store.js (gImgHash).

**`js/core/auth.js`** · 340 linhas
AUTH via Supabase (Fase 5.1). Login/logout/recuperação usam supabase.auth (window.sb, criado em js/core/supabase.js). gLoadProfile() carrega a sessão + o role do profile e popula gAuthState, pra que gCurrentUser/gCurrentRole…
· API: gRoleLevel, gLoadProfile, gLogin, gLogout, gCurrentUser, gCurrentRole, gIsAdmin, gIsSuperAdmin, gCanManageUsers, gForgotPassword, gResetPassword, gGetAllUsers, gSetUserRole, gSetUserAtivo … (+9; 24 funções no total)

**`js/core/auto-layout.js`** · 953 linhas
AUTO-LAYOUT — a camada de JULGAMENTO O solver de composição mora em `00-config.js` (`gApplyRelativeAnchors`):
· API: gLayoutFontProbe, gStampLayoutBaseline, gLayoutLimpaCarimbos, gLayoutTextoAutorado, gEnsureLayoutBaseline, gLayoutFontDrift, gLayoutFontStatus, gLayoutRefInk, gLayoutRoleOf, gLayoutSemanticRole, gCompileLayoutRoles, gLayoutRoleMaxLines, gLayoutCampoEhPreco, gLayoutEhPrecoDinamico … (+18; 38 funções no total)

**`js/core/console.js`** · 887 linhas
LUMA CLI Console de comandos do Luma, só pra quem é da casa (equipe_dm/gestao).
· API: gCliOpen, gCliClose, gCliToggle
· Depende de: core/toast.js (gToast/gConfirm), core/auth.js (gIsAdmin/gCurrentRole),

**`js/core/feature-flags.js`** · 697 linhas
CONTROLE DO PRODUTO — o motor único de disponibilidade funcional do Luma.
· API: gFeatureLoadCache, gFeatureState, gFeatureEnabled, gFeatureCan, gFeatureReason, gFeatureBlockedFeedback, gFeatureToolBlocked, gFeatureApplyToDOM, gFeatureSyncFromBackend, gFeatureSave, gFeatureRefresh, gFeatureHistory, gFeatureInit, gFeatureResolveTree … (+1; 23 funções no total)
· Estado global: _gFFValores, _gFFSyncedAt, _gFFOrigem, _gFFErroSync, _gFFIniciado, _gFFPorChave, _gFFFilhos, _gFFPorTool
· Depende de: core/toast.js (gToast, gEsc), core/auth.js (gCurrentRole,

**`js/core/help.js`** · 760 linhas
gOpenHelp, gCloseHelp — modal de ajuda com trilha de aprendizado e catálogo livre.
· API: gHelpContactSupport, gFraHelpEmail, gFhRenderCols, gFhSearch, gFhOpenCol, gFhOpenArt, gFhVote, gFhBack, gFhSetActive, gFhGo, gFraHelpOpen, gFraHelpClose, gHelpIcon, gHelpKnowledge … (+23; 46 funções no total)
· Depende de: tutorial/engine.js (tutOpen), core/auth.js (gCurrentUser)

**`js/core/img-store.js`** · 117 linhas
Armazenamento de imagens grandes (fundos de PSD, fotos) em IndexedDB, fora do localStorage.
· API: gImgHash, gIdbPut, gIdbGet, gIdbDel, gResolveImgUrl, gHydrateLayers, gHydrateFolders

**`js/core/layout.js`** · 96 linhas
5.2 — SMART RESIZE MULTI-FORMATO (motor de layout relativo). Converte layers entre formatos sem distorcer: tamanho escala por UM fator (s = minDim destino / minDim origem) e a POSIÇÃO re-ancora por eixo (left/center/right ×…
· API: gInferAnchor, gEnsureAnchors, gReflowLayers, gFmtKey
· Depende de: nada (puro). Carregar antes de franqueado/ e designer/.

**`js/core/product-control.js`** · 570 linhas
CONTROLE DO PRODUTO — a tela da Gestão, dentro do painel da conta.
· API: gProdRender, gProdRenderTree, gProdFilter, gProdSetFilter, gProdClearFilters, gProdToggleGroup, gProdFocusKey, gProdRefresh, gProdAskToggle, gProdCancelToggle, gProdConfirmToggle, gProdOpenHistory
· Depende de: core/feature-flags.js, core/toast.js (gToast/gEsc), core/auth.js.

**`js/core/pwa-install.js`** · 130 linhas
dica de instalação do Luma como app (PWA) Mostra UMA dica discreta e dispensável para deixar o Luma na tela de início (celular) ou no Dock (Mac).

**`js/core/qr.js`** · 257 linhas
Gerador de QR Code (modo byte, correção nível M) em Canvas — vanilla, zero dependência.
· API: gQRCanvas

**`js/core/sound.js`** · 161 linhas
Motor de Sound Design Sintetizado (Web Audio API) do Luma. Zero dependências de rede, 0 KB de arquivo MP3, latência zero (0ms). Oferece feedback tátil elegante para momentos de conquista e utilidade: 1.…

**`js/core/splash.js`** · 89 linhas
Controla a splash screen de entrada do Luma. Exibe a animação completa uma vez por dia e usa uma passagem curta nos demais acessos. O boot acontece por baixo: a splash só cobre trabalho real e nunca o cria. Exporta…
· Depende de: nada (roda antes de qualquer módulo).

**`js/core/supabase-config.example.js`** · 16 linhas
MODELO versionado. Copie para `supabase-config.js` (que é gitignored) e preencha com as credenciais do seu projeto Supabase. cp js/core/supabase-config.example.js js/core/supabase-config.js A anon/publishable key é PÚBLICA por…

**`js/core/supabase-config.js`** · 16 linhas
Credenciais do projeto Supabase. PREENCHA com a Project URL e a anon key. A anon key é PÚBLICA por design — vai no front e está protegida pela RLS (ver supabase/migrations/). NUNCA coloque aqui a chave `service_role`. Este…

**`js/core/supabase.js`** · 99 linhas
Cria o client Supabase global `window.sb`, usado pela auth e pela camada de persistência (fase 5.1).
· API: gSupabase, gHasBackend, gTrackEvent, gPendingDeletes, gRemoteDelete, gIsPendingDelete, gFlushPendingDeletes

**`js/core/toast.js`** · 140 linhas
gToast(msg) — exibe notificacao flutuante de 2.8s.
· API: gToast, gEsc, gBtnLoading, gConfirm, gPrompt, gWarnImagesNotPersisted
· Depende de: nada (usa apenas o DOM).

**`js/core/user-profile.js`** · 921 linhas
Controladores do Modal e Configurações de Perfil do Usuário. Suporta edição de perfil, troca de avatar via Base64 persistente, validação de senha e monitoramento de tempo de sessão.
· API: gOpenUserProfileModal, gCloseUserProfileModal, gProfileOpenCli, gProfileSwitchTab, gProfileUpdateModalAvatars, gProfileTriggerUpload, gProfileHandleUpload, gProfileSaveData, gProfileApplyTheme, gProfileApplyStudioMode, gProfileCheckPasswordStrength, gProfileChangePassword, gProfileRenderStats, fToggleTheme … (+14; 30 funções no total)

### js/franqueado

**`js/franqueado/catalog.js`** · 1503 linhas
Catalogo de campanhas: fRenderCatalogs, fFilterCamps, fSelectCamp, fSwitchTab, fSetHistFilter, fRenderHist, fEditFromHist, fDuplicateInOtherFmt.
· API: fSwitchTab, fSetHistFilter, fGoToCampaigns, fAskClearHist, fHistVoltar, fRenderHist, fDownloadHist, fEditFromHist, fDuplicateInOtherFmt, fConfirmDuplicate, fEditCampFolder, fCampAdminMenu, fCampAnalyticsClose, fCampAnalyticsOpen … (+32; 79 funções no total)
· Depende de: 00-config.js, 01-state.js

**`js/franqueado/chat-input.js`** · 616 linhas
F-02: tipos de campo, mascaras de input, validacao por campo. F_FIELD_TYPES define o comportamento de cada variavel do template.
· API: fMaxLenDaCaixa, fGetFieldType, fCleanTextNumber, fApplyMask, fValidate, fShowFieldError, fAttachInputGuard, fUpdateCharCount, fFitTextWithAI, fFitApply, fSaveAdv, fInitSmartInputFormatter
· Depende de: 00-config.js

**`js/franqueado/chat.js`** · 1605 linhas
Fluxo conversacional completo: fStartChat, fNextStep, fAddBot, fAddUser, fSend, fQR, fTyping, fGoBack, upload de imagem, confirm card, fGerarArte.
· API: fValidadeSuggestions, fGetSuggestionsForVar, fStartChatComMaterial, fMaterialPreStart, fSkipPreStart, fPickLoja, fUseLastArte, fSaveLojaPrompt, fConfirmSaveLoja, fSelectFmt, fRenderFmts, fUpdateCtx, fUpdateProg, fShowWelcome … (+40; 68 funções no total)
· Depende de: 00-config.js, 01-state.js, franqueado/chat-input.js

**`js/franqueado/history.js`** · 270 linhas
Historico de artes do franqueado: fGetHist, fSaveHist, fAddHist, fMarkHistBaixada, fUpdateHistBadge, fRenderHist, fDownloadHist. Persiste em localStorage (HIST_KEY).
· API: fGetHist, fSaveHist, fPushArtesToBackend, fMarkBaixadaBackend, fSyncArtesFromBackend, fClearHist, fAddHist, fMarkHistBaixada, fUpdateHistBadge, fFormatHistDate
· Depende de: 00-config.js (HIST_KEY), 01-state.js (fState)

**`js/franqueado/live-preview.js`** · 2009 linhas
Preview lateral em tempo real (fUpdateLivePreview) e modal de preview multi-formato (fOpenPreview, fClosePreview, fStartFromPreview).
· API: fOpenPreview, fStartFromPreview, fClosePreview, fPostedSetCtx, fPostedCloseQR, fPostedOpenQR, fPostedCopyQRLink, fOpenPosted, fClosePosted, fLpToggleAutoZoom, fLpToggleAutoLayout, fUpdateLivePreview, fLpSizeCanvas, fLpRefit … (+14; 99 funções no total)
· Depende de: 00-config.js, 01-state.js

**`js/franqueado/materials.js`** · 700 linhas
Catalogo de materiais do franqueado: fOpenMaterialCatalog, fRenderMaterialCatalog, fRenderMaterialCard, fCloseMaterialCatalog, fSelectMaterial.
· API: fGetMaterialsForCamp, fIsMaterialValid, fGenerateCampaignKit, fApplyCampTheme, fRemoveCampTheme, fOpenMaterialCatalog, fRenderMaterialCatalog, fRenderMaterialCard, fCloseMaterialCatalog, fMaterialImageVars, fEnsureMaterialLayers, fSelectMaterial
· Depende de: 00-config.js, 01-state.js, franqueado/chat.js

**`js/franqueado/panel-dock.js`** · 170 linhas
Drag & drop das 3 colunas do workspace do franqueado (só desktop largo).
· API: fLoadPanelOrder, fSavePanelOrder, fSetPanelOrder, fInitPanelDock
· Depende de: index.html (grips + #fran-main), css/modules/panel-dock.css,

**`js/franqueado/png-generator.js`** · 4438 linhas
Geracao de PNG a partir dos templates: fGenPNG, fRenderTemplateLayers, fBaixar, fOutroFormato. Sistema de nomenclatura padronizado para downloads.
· API: fLoadLogoBranca, fMaterialSize, fRenderCanvasHelper, fGenPNG, fGenPDF, fPostarInstagram, fEnviarWhatsApp, fDrawDMLogo, fAdjustImageData, fRenderTemplateLayers, fRenderOneLayer, roundedRect, roundedRectPath, fLoadImageDataUrl … (+69; 146 funções no total)
· Estado global: _fLogoBrancaImg, fBulkRows, _fBulkAudit, _fBulkAsyncAudit, _fBulkAuditFingerprint, _fBulkImageAudit, _fBulkAutosaveTimer, _fBulkAutosaveSeq, _fBulkGenerationState, _fBulkPreflightRunning (+37)
· Depende de: 00-config.js, 01-state.js, designer/canvas.js (dRenderCanvas)

**`js/franqueado/prefs-panel.js`** · 131 linhas
Tela "Minhas fotos" — aba do painel de conta (gOpenUserProfileModal).
· API: fPrefsPanelOpen, fPrefsPanelRender, fPrefsPanelDeletePhoto, fPrefsPanelClearPhotos, fPrefsPanelZoom, fPrefsPanelCloseZoom
· Depende de: upload-panel.js, core/img-store.js (gResolveImgUrl/gIdbDel),

**`js/franqueado/prefs.js`** · 78 linhas
Preferências do franqueado persistidas localmente (cache offline-first):
· API: fGetLojas, fSaveLojas, fAddLoja, fRemoveLoja, fGetFavs, fIsFav, fToggleFav, fGetSeen, fMarkCampSeen, fMaterialIsNew, fCampHasNew, fSetHistSearch
· Depende de: 00-config.js. Consumido por catalog.js, materials.js, chat.js.

**`js/franqueado/upload-panel.js`** · 181 linhas
Painel de upload do chat do franqueado: ao enviar uma foto, abre um painel com · Imagens recentes — as últimas usadas, pra reaproveitar sem re-upload. · Minhas lojas — perfis de loja salvos (logo), quando o campo é o logo. ·…
· API: fGetRecentImgs, fRecordRecentImg, fRemoveRecentImg, fOpenUploadPanel, fCloseUploadPanel, fUploadPanelNewFile, fPickRecentImg, fUploadPanelPickLoja, fUploadPanelManage, fUploadPanelDeleteLoja
· Depende de: franqueado/chat.js (_fApplyImageToField, fState, fProcessImageFile),

### js/designer

**`js/designer/blending.js`** · 620 linhas
· API: dBlendPixel, dBlendModeList, dBlendModeLabel, dBlendToComposite, dBlendImageData, dBlendSelfTest

**`js/designer/brush.js`** · 1039 linhas
Sistema de pincel/borracha/carimbo: dPaintStart, dPaintMove, dPaintEnd, dStampAt, dBrushUpdate, dBrushSetPreset, dShowBrushBar.
· API: dPaintTargetSize, dEnsurePaintCanvas, dSyncPaintPointer, dGetPaintCtx, dPaintStart, dPaintMove, dPaintEnd, dBlurRegion, dSmudgeStep, dApplyGradient, dCanvasPos, dClearPaint, dStampAt, dAttachPaintListeners … (+41; 58 funções no total)
· Depende de: designer/canvas.js

**`js/designer/canvas.js`** · 2486 linhas
Render do canvas, zoom, pan, formato, réguas, barra contextual, smart guides, simulacao de dados e interacoes de mouse.
· API: dSetFormat, dApplyFormat, dFitToScreen, dPositionArtboard, dZoom, dSetZoom, dSampleImg, dSetPhTest, dEscolherFotoDaMoldura, dRenderWorkspace, dABAddResizeHandles, dABToolAttach, dUpdateBrushCursor, dSetTool … (+55; 81 funções no total)
· Depende de: designer/templates.js, designer/layers.js

**`js/designer/color-picker.js`** · 288 linhas
Custom Color Picker for Luma

**`js/designer/eraser-tools.js`** · 182 linhas
Borrachas avançadas sobre ImageData do #d-paint-canvas. NÃO altera o pipeline de pintura (brush.js) nem a borracha simples. API pública: dBgEraseAt(ctx, x, y, radius, tolerance) dMagicEraseAt(ctx, x, y, tolerance)
· API: dBgEraseAt, dMagicEraseAt

**`js/designer/fonts.js`** · 235 linhas
Fontes customizadas enviadas pelo usuário (.ttf/.otf/.woff/.woff2).
· API: dFontsPersist, dFontsRestore, dPushFontsToBackend, dDeleteFontFromBackend, dSyncFontsFromBackend, dFontRegister, dFontUniqueFamily, dFontUpload, dFontRemove, dFontsRenderList, dFontOptionsHTML, dPopFontSelects
· Depende de: 00-config.js, core/toast.js, designer/canvas.js (dRenderCanvas).

**`js/designer/layers.js`** · 4407 linhas
CRUD de layers, painel lateral, props, multi-select, rename: dSelLayer, dDeselect, dRenderLayersList, dShowProps, dAddText, dAddShape, dToggleMultiSel, dRenameLayer, dAddIcon, dAddLine.
· API: dSelLayer, dHoverLayer, dSelLayerState, dDeselect, dStartCrop, dStopCrop, dOnCropDrag, dStopCropDrag, dStartDrag, dOnDrag, dStopDrag, dStartResize, dOnResize, dStopResize … (+193; 255 funções no total)
· Depende de: designer/canvas.js

**`js/designer/library.js`** · 659 linhas
Painel lateral e biblioteca de assets: dTogglePanel, dLibRenderCats, dLibRender, dLibUpload, dLibUse, dLibDelete, dToggleTheme.
· API: dTogglePanel, dToggleResources, dResourcesTab, dToggleTheme, dLibRenderCats, dLibSetCat, dLibRender, dLibFilter, dLibUpload, dLibUse, dLibDelete, dPushLibToBackend, dDeleteLibFromBackend, dSyncLibFromBackend … (+17; 34 funções no total)
· Depende de: designer/canvas.js

**`js/designer/linter.js`** · 485 linhas
Design System Linter & Auditor de Layout do Luma Designer. Varre as camadas em busca de erros estéticos, Safe Zones e otimizações de performance.
· API: dRunLinter, dLinterFocusLayer, dDadoLinterAutoFix

**`js/designer/mask.js`** · 195 linhas
Máscaras de camada no editor: adicionar, pintar (esconder/revelar), inverter, remover. Modelo unificado: l.mask = dataURL de ALPHA mask (opaco=visível, transparente=escondido) — o mesmo usado no canvas (CSS mask), no PNG e no…
· API: dMaskAdd, dMaskInvert, dMaskPaintStart, dMaskSetMode, dMaskSetSize, dMaskExit, dMaskShowToolbar, dMaskRenderProps
· Estado global: _dMaskState
· Depende de: designer/canvas.js (dRenderCanvas, dFmt), designer/layers.js (dLayers, dSelId), core/toast.js.

**`js/designer/measurement.js`** · 959 linhas
Ferramentas de medição e amostragem do designer Luma, inspiradas no Photoshop.
· API: dEyedropPixel, dEyedropPreview, dEyedropHidePreview, dColorSamplerAdd, dColorSamplerRemove, dColorSamplerRender, dColorSamplerClear, dRulerStart, dRulerMove, dRulerEnd, dRulerClear, dNoteAdd, dNoteRender, dNoteRemove … (+8; 27 funções no total)
· Depende de: designer/canvas.js, designer/layers.js, designer/tools.js,

**`js/designer/preview.js`** · 1087 linhas
Preview engine do designer: pvRender, pvRenderLayers, pvRenderLayer, dPreviewOpen, dPreviewClose, dPreviewSetFmt, dPreviewDownload.
· API: dPreviewSetScale, dPreviewSetType, dPreviewOpen, dPreviewClose, dPreviewSetFmt, dPreviewSetDevice, pvRender, pvRenderLayers, pvRenderLayer, pvRenderFramePlaceholder, pvRoundRect, pvApplyDevice, pvUpdateSidebar, dBuildTemplateFilename … (+21; 40 funções no total)
· Depende de: designer/canvas.js, designer/layers.js

**`js/designer/props-panel.js`** · 2358 linhas
Accordion, sub-nav scroll, alignment button group para o painel de props.
· API: dPropToggleSection, dPropSaveSections, dPropRestoreSections, dPropScrollTo, dPropSetAlign, dPropSyncAlign, dPropShowSections, dPropWorkspaceMode, dPropReadWorkspaceMode, dPropSetWorkspaceMode, dToggleChrome, dPropBuildWorkspaceMode, dPropBuildEssentialChrome, dPropBuildPanelNav … (+62; 76 funções no total)

**`js/designer/psd-import.js`** · 1612 linhas
REVISÃO e IMPORTAÇÃO do .psd — a metade do importador que é tela.
· API: dPsdOpenReview, dPsdRenderRows, dPsdSetMode, dPsdSetVar, dPsdSetInclude, dPsdSelectAll, dPsdSelectNone, dPsdUploadFont, dPsdUpdateCount, dPsdCancel, dPsdConfirmImport, dImportLayersAsArtboard, dPsdRenderPreview, dPsdHoverLayer … (+18; 82 funções no total)
· Depende de: designer/templates.js, core/layout.js, core/toast.js, 00-config.js.

**`js/designer/psd-parse.js`** · 1900 linhas
LEITURA e FIDELIDADE do .psd — a metade do importador que não toca a tela.
· API: dLoadAgPsd, dPsdCancelLoad, dPsdDetectFmt, dPsdParseItems, dItemToLayer, dPsdItemsToLayers

**`js/designer/publish.js`** · 1427 linhas
Modal de publicacao de templates (4 abas): dPublishOpen, dPublishClose, dPublishSwitchTab, dPublishRender, dPublishConfirm.
· API: dPublishDraftKey, dPublishCollectDraft, dPublishPersistDraft, dPublishQueueDraft, dPublishLoadDraft, dPublishClearDraft, dPublishSaveDraft, dGetActiveTemplate, dPublishSetupWizard, dPublishShowError, dPublishClearError, dPublishValidateStep, dPublishGoStep, dPublishShowStep … (+31; 48 funções no total)
· Depende de: designer/templates.js

**`js/designer/selection.js`** · 808 linhas
Ferramentas avançadas de seleção inspiradas no Photoshop: 1. Object Selection (obj-select) — retângulo + IOU 2. Quick Selection (quick-select) — hit-test por clique/arrasto 3. Magic Wand (magic-wand) — seleção por cor dominante
· API: dIsLayerVisible, dObjSelectStart, dObjSelectMove, dObjSelectEnd, dQuickSelectAt, dQuickSelectCoordsFromEvent, dMagicWandAt, dRenderSelectionOverlay, dObjSelectInRect, dMagicWandSelect
· Depende de: designer/canvas.js, designer/layers.js

**`js/designer/templates.js`** · 3338 linhas
Estado e CRUD de templates/pastas: dFolders, dInit, dRenderFolders, dLoadTemplateById, dBuildLayers, dLoadTemplate, dOpenNewFolder, dConfirmTemplate.
· API: dSyncLyrCnt, dBuildMockLayersForCamp, dDefaultFolders, dBuildShowcaseLayers, dPreloadFolders, dDefaultPublishMeta, dExtractTemplateVars, dBuildLayers, dBuildBlankLayers, dBuildBlankLayersWH, dGetActiveAB, dSyncLayersToAB, dSetActiveAB, dNewArtboard … (+133; 156 funções no total)
· Depende de: 00-config.js

**`js/designer/tools.js`** · 362 linhas
Ferramentas do designer: eyedropper, auto-fit de texto, bucket fill, dStartInlineEdit, dEndInlineEdit, dHexSync, dHexInput, dToggleLock.
· API: dMeasureText, dTextGlyphMetrics, dTextInkTopGap, dTextDisplayString, dTextFitBox, dCheckTextOverflow, dAutoFitText, dEyedropFromLayer, dEyedropAt, dUpdateBgColor, dSwapColors, dResetColors, dBucketFillLayer, dToggleToolbarCols … (+1; 16 funções no total)
· Depende de: designer/canvas.js, designer/layers.js

**`js/designer/tooltip.js`** · 192 linhas
Luma Designer - Rich Educational Tooltips Fornece tooltips explicativos e educacionais para as ferramentas da barra lateral.
· API: initRichTooltips, showRichTooltip, hideRichTooltip

**`js/designer/tutorial-panel.js`** · 90 linhas
Aba "Tutorial" do designer: guia em acordeão que explica cada ferramenta, atalho e recurso da plataforma + botão "Abrir modelo de exemplo".
· API: dRenderTutorialPanel, dTutToggle, dTutLoadExample
· Depende de: designer/templates.js (dLoadTemplate, dBuildShowcaseLayers), canvas.js (dRenderCanvas).

**`js/designer/undo-redo.js`** · 167 linhas
Historico de acoes do designer: dHistoryPush, dUndo, dRedo, dUpdateUndoButtons, dFlashLayer, dDuplicateLayer.
· API: dHistoryPush, dHistoryPushDebounced, dCapturePaint, dHistorySnapshot, dHistoryCommit, dHistoryReset, dApplyPaintSnapshot, dRestoreSelection, dApplyHistoryEntry, dHistoryFlush, dUndo, dRedo, dUpdateUndoButtons, dFlashLayer
· Depende de: designer/canvas.js

### js/academia

**`js/academia/academia.js`** · 904 linhas
ACADEMIA DELIVERY MUCH — núcleo do módulo de formação do franqueado.
· API: acIco, acAulas, acAula, acModulo, acProg, acConcluiu, acIniciou, acModuloLiberado, acAulaLiberada, acAulaAtualizada, acModuloEstado, acResumo, acFmtDur, acFmtTempo … (+29; 48 funções no total)
· Depende de: core/supabase.js (gSupabase, gTrackEvent), core/toast.js (gToast,

**`js/academia/agente.js`** · 373 linhas
ACADEMIA — AGENTE EDUCACIONAL. A coluna direita do ambiente de aula: um tutor que ajuda o franqueado a ENTENDER a aula atual, com método socrático. ONDE MORA O PROMPT: no SERVIDOR (supabase/functions/ai, task 'aula'). Este…
· API: acRenderAgente, acAgenteIndisponivel, acAgenteBoasVindas, acAgenteBolha, acAgenteTexto, acAgenteAtalhos, acAgenteAutoAltura, acAgenteNoFim, acAgenteRolar, acAgenteMostrarVoltar, acAgenteIrParaUltima, acAgenteCarregarHistorico, acAgenteReiniciar, acAgenteEnviar … (+6; 21 funções no total)

**`js/academia/aula.js`** · 1140 linhas
ACADEMIA — AMBIENTE DE AULA. O núcleo do módulo: três regiões no desktop (estrutura do curso · aula · agente educacional), player MP4 com retomada e as ferramentas de aprendizado em abas. DECISÃO DE PLAYER: `<video controls>`…
· API: acRenderAula, acAulaBloqueada, acRenderSidebar, acSidebarModulo, acSidebarAula, acToggleModulo, acAbrirAula, acRenderAulaMain, acPlayerHTML, acMontarPlayer, acVideoTick, acPlayerEstado, acMostrarRetomada, acReiniciarVideo … (+41; 57 funções no total)
· Depende de: academia.js (acState, acProg, acSalvarProgresso, acVideoUrl…),

**`js/academia/certificado.js`** · 431 linhas
ACADEMIA — CONCLUSÃO E CERTIFICADO. EMISSÃO: sempre pela RPC `luma.ac_emitir_certificado` (SECURITY DEFINER). O cliente NÃO insere em luma.certificados — a tabela não tem policy de INSERT, então quem valida a conclusão é o…
· API: acRenderCertificado, acCertRequisitos, acCertRevisao, acEmitirCertificado, acCertZoom, acDesenharCertificado, acBaixarCertificado

**`js/academia/conclusao.js`** · 513 linhas
ACADEMIA — EXPERIÊNCIA DE CONCLUSÃO DA FORMAÇÃO. O momento em que o franqueado deixa de estar "em implementação" e passa a fazer parte da rede como formado. Sequência em 4 telas dentro de um overlay: 1. CONFIRMAÇÃO progresso…
· API: acConclusaoCfg, acConclusaoJaVista, acVideoCeoNovo, acVideoCeoDisponivel, acConclusaoTalvezAbrir, acConclusaoAbrir, acConclusaoFechar, acConclusaoPular, acConclusaoIr, acConcEtapaConfirmacao, acConcEtapaSplash, acConcEtapaVideo, acConcVideoFalhou, acConcVideoSeguir … (+6; 25 funções no total)
· Depende de: motion.js (acSequencia, acDur, acMotionReduzido, acSomConquista),

**`js/academia/gestao.js`** · 1146 linhas
ACADEMIA — GESTÃO DE CONTEÚDO (equipe_dm / gestao). Permite administrar a formação sem editar código: curso, módulos, aulas, upload de MP4, materiais, atividade, preview como franqueado e publicação. SEGURANÇA: o gate daqui é…
· API: acRenderGestao, acGestaoTrocarAba, acGestaoAvisos, acGestaoRenderCorpo, acGestaoArvore, acGestaoArvoreDemo, acGestaoModItem, acGestaoEditar, acGestaoFecharEditor, acGestaoEditor, acGestaoFormCurso, acGestaoFormConclusao, acGestaoCcDestino, acGestaoVideoCeoHTML … (+38; 58 funções no total)

**`js/academia/motion.js`** · 251 linhas
ACADEMIA — SISTEMA DE MOTION. As decisões de movimento do módulo moram AQUI, não espalhadas em cada render. Quem anima chama um destes helpers. REGRA: nenhum valor de duração ou curva nasce neste arquivo. Tudo vem dos tokens…
· API: acMotionReduzido, acDur, acEase, acCascata, acProgLembrado, acProgGuardar, acAnimaNumero, acAnimaBarra, acAnimaAnel, acAltura, acTroca, acPulso, acSequencia, acSomConquista
· Depende de: nada. Carrega antes de academia.js.

### js/tutorial

**`js/tutorial/catalog-studio.js`** · 539 linhas
Tutoriais animados adicionais (franqueado + designer/Estúdio).
· Depende de: tutorial/catalog.js (TUTORIALS), tutorial/mocks.js, tutorial/mocks-studio.js

**`js/tutorial/catalog.js`** · 441 linhas
TUTORIALS = {...} — catalogo dos 4 tutoriais interativos. Cada tutorial define titulo, descricao e array de cenas com build().
· Depende de: tutorial/mocks.js (tutMockCampaign etc)

**`js/tutorial/engine.js`** · 321 linhas
Engine do TutorialEngine: tutState, tutOpen, tutClose, tutNext, tutGoToScene, tutRenderScene, cursor virtual, spotlights, progress. Exporta: tutOpen, tutClose, tutNext, tutPrev, tutTogglePlay, tutGoToScene
· API: tutSceneTimeout, tutClearSceneTimers, tutOpen, tutClose, tutAskClose, tutExitCancel, tutGoToScene, tutRenderScene, tutShowTooltip, tutMoveCursor, tutRenderProgress, tutUpdateProgress, tutUpdateButtons, tutNext … (+6; 20 funções no total)
· Depende de: 01-state.js, tutorial/catalog.js, tutorial/mocks.js

**`js/tutorial/mocks-studio.js`** · 81 linhas
Mocks dark do ESTÚDIO (designer) para as cenas de tutorial: tutStudio, tutStudioTool, tutArtCanvas, tutLayerRow, tutPanelCard, tutVarPill, tutKey, tutChip. Retornam strings HTML (como mocks.js).
· API: tutStudioTool, tutStudio, tutArtCanvas, tutLayerRow, tutPanelCard, tutVarPill, tutKey, tutChip
· Depende de: nada. CSS em css/components/tutorial.css (.tut-studio*).

**`js/tutorial/mocks.js`** · 53 linhas
tutMockCampaign, tutMockMaterial, tutMockHist — builders de HTML de mock usados nas cenas de tutorial.
· API: tutMockCampaign, tutMockMaterial, tutMockHist
· Depende de: nada (retorna strings HTML).

### js/widgets

**`js/widgets/help-widget.js`** · 1035 linhas
── LUMA HELP WIDGET ── Ajuda contextual, artigos e mensagens com a mesma linguagem visual do Luma.

### js/calendario

**`js/calendario/agenda.js`** · 358 linhas
CALENDÁRIO — as vistas de TEMPO: semana e dia. A grade do mês responde "quando"; estas duas respondem "a que horas" e "onde sobra espaço". Aqui moram: a régua de horas, a faixa de dia inteiro, o posicionamento proporcional, a…
· API: calAlturaHora, calVistaSemana, calPistasSemana, calFaixaSemana, calVistaDia, calVaos, calVaosHtml, calBlocoLivre, calReguaHtml, calGradeHoras, calBlocosDoDia, calLinhaAgora, calAgendaMontada, calAtualizaAgora … (+2; 16 funções no total)
· Estado global: _calRelogio
· Depende de: calendario.js (estado, helpers de data, calCardEvento).

**`js/calendario/apresentacao.js`** · 288 linhas
CALENDÁRIO — A APRESENTAÇÃO DO MÊS. O ritual que a operação fazia em PowerPoint (ver `Calendário JULHO - 2025.pdf`): capa do mês → o que é novidade → as campanhas que ficam → e o mês assenta no calendário. Aqui isso vira uma…
· API: calApresCenas, calApresAbrir, calApresFechar, calApresJaViu, calApresMarcaVista, calApresTalvez, calApresPinta, calApresAgenda, calApresIr, calApresPlay, calApresTecla, calApresNumeros
· Estado global: calApres
· Depende de: calendario.js (estado, helpers, calBannerImg, CAL_TIPOS).

**`js/calendario/calendario.js`** · 1190 linhas
CALENDÁRIO — o módulo que responde "o que a rede comunica e quando".
· API: calIco, calData, calISO, calHoje, calAddDias, calAddMeses, calDiasNoMes, calDiff, calDiaSemana, calSegundaDe, calMesmoMes, calFimDeSemana, calGradeMes, calSemanaDe … (+83; 97 funções no total)
· Estado global: calState, _calBuscaT, _calFocoGrade, _calArrasto
· Depende de: 00-config.js (CAMPS_ATIVAS/CAMPS_OUTRAS), core/toast.js (gToast,

**`js/calendario/conteudo.js`** · 1133 linhas
CALENDÁRIO — o CONTEÚDO do calendário oficial de marketing da rede.

**`js/calendario/evento.js`** · 479 linhas
CALENDÁRIO — tudo que acontece EM CIMA da grade: · Context preview — o resumo que aparece ao passar o ponteiro, sem modal · Detalhe do evento — a folha que expande do cartão clicado · Criar/editar — o fluxo progressivo (um…
· API: calNovoEvento, calEditarEvento, calAbreFolha, calPintaFolha, calFecharFolha, calFecharTudo, calAbrirDetalhe, calDetalheHtml, calDetalheRico, calPreviewEntra, calPreviewMostra, calPreviewSai, calEditorHtml, calCampsOpcoes … (+13; 27 funções no total)
· Estado global: calEd, _calPrevT, _calPrevEl
· Depende de: calendario.js (estado, helpers), agenda.js (calVaos),

## CSS — onde mora cada folha

| Arquivo | Linhas |
|---|---|
| `css/00-tokens.css` | 239 |
| `css/01-reset.css` | 27 |
| `css/02-animations.css` | 179 |
| `css/03-fonts.css` | 60 |
| `css/components/help-modal.css` | 719 |
| `css/components/login.css` | 367 |
| `css/components/pages-tray.css` | 335 |
| `css/components/prefs-panel.css` | 232 |
| `css/components/product-control.css` | 437 |
| `css/components/pwa-install.css` | 129 |
| `css/components/splash.css` | 143 |
| `css/components/topbar.css` | 451 |
| `css/components/tutorial.css` | 740 |
| `css/components/user-profile.css` | 1084 |
| `css/modules/academia.css` | 1330 |
| `css/modules/all-tools.css` | 113 |
| `css/modules/calendario.css` | 1544 |
| `css/modules/catalog.css` | 291 |
| `css/modules/chat.css` | 2305 |
| `css/modules/color-picker.css` | 153 |
| `css/modules/console.css` | 244 |
| `css/modules/designer.css` | 5822 |
| `css/modules/franqueado.css` | 1506 |
| `css/modules/franqueado_effects.css` | 418 |
| `css/modules/help-widget.css` | 1698 |
| `css/modules/layers-panel.css` | 4317 |
| `css/modules/live-preview.css` | 915 |
| `css/modules/panel-dock.css` | 116 |
| `css/modules/publish-modal.css` | 628 |
| `css/modules/toolbar.css` | 956 |
| `css/modules/topbar.css` | 217 |
| `css/modules/upload-panel.css` | 108 |

## Ordem de carga do `index.html`

A ordem **é** a arquitetura: sem ESM, um arquivo depende de o anterior já ter definido suas globais. Script novo entra na posição certa desta lista.

```
 1. js/core/splash.js
 2. js/00-config.js
 3. js/core/img-store.js
 4. js/01-state.js
 5. js/core/toast.js
 6. js/core/sound.js
 7. js/core/qr.js
 8. js/core/layout.js
 9. js/core/auto-layout.js
10. js/core/help.js
11. js/tutorial/catalog.js
12. js/tutorial/mocks.js
13. js/tutorial/mocks-studio.js
14. js/tutorial/catalog-studio.js
15. js/tutorial/engine.js
16. js/franqueado/history.js
17. js/franqueado/prefs.js
18. js/franqueado/catalog.js
19. js/franqueado/materials.js
20. js/franqueado/chat.js
21. js/franqueado/live-preview.js
22. js/franqueado/panel-dock.js
23. js/franqueado/upload-panel.js
24. js/franqueado/prefs-panel.js
25. js/franqueado/chat-input.js
26. js/academia/motion.js
27. js/academia/academia.js
28. js/academia/aula.js
29. js/academia/agente.js
30. js/academia/gestao.js
31. js/academia/certificado.js
32. js/academia/conclusao.js
33. js/calendario/conteudo.js
34. js/calendario/calendario.js
35. js/calendario/agenda.js
36. js/calendario/evento.js
37. js/calendario/apresentacao.js
38. js/designer/blending.js
39. js/franqueado/png-generator.js
40. js/designer/templates.js
41. js/designer/canvas.js
42. js/designer/selection.js
43. js/designer/brush.js
44. js/designer/eraser-tools.js
45. js/designer/layers.js
46. js/designer/props-panel.js
47. js/designer/measurement.js
48. js/designer/publish.js
49. js/designer/preview.js
50. js/designer/library.js
51. js/designer/undo-redo.js
52. js/widgets/help-widget.js
53. js/designer/tools.js
54. js/designer/fonts.js
55. js/designer/psd-parse.js
56. js/designer/psd-import.js
57. js/designer/mask.js
58. js/designer/tutorial-panel.js
59. assets/vendor/colorthief.js
60. assets/vendor/pica.js
61. assets/vendor/jszip.min.js
62. assets/vendor/supabase.js
63. js/core/supabase-config.js
64. js/core/supabase.js
65. js/core/ai.js
66. js/core/auth.js
67. js/core/feature-flags.js
68. js/core/user-profile.js
69. js/core/product-control.js
70. js/core/console.js
71. js/main.js
72. js/designer/color-picker.js
73. js/designer/tooltip.js
74. js/designer/linter.js
```

<!-- AUTO-FIM -->
