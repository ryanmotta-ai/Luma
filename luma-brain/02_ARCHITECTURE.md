# 02 — ARQUITETURA · Como o sistema é dividido

> Como o Luma é montado, em camadas e fronteiras. **Sem código — só arquitetura.**
> O `01_BUSINESS.md` diz as regras do domínio; este diz onde cada coisa mora e como as partes conversam. Para o "como" no detalhe (funções, tabelas, policies), a fonte é `docs/LUMA.md`.
> Última revisão: 2026-07-31.

---

## 1. Visão em uma imagem

O Luma é uma **SPA estática que fala direto com o Supabase**. Não há servidor de aplicação próprio no meio.

```
        NAVEGADOR (o "servidor" é o navegador do usuário)
 ┌─────────────────────────────────────────────────────────────┐
 │  index.html  →  69 <script> globais (Vanilla JS, sem build)   │
 │                                                               │
 │  VIEWS/MÓDULOS        MOTORES                 ESTADO          │
 │  · Franqueado (f*)    · Render (Canvas 2D)    variáveis let   │
 │  · Estúdio  (d*)      · Interpolador único    globais         │
 │  · Academia (ac*)     · Smart resize          (dLayers,       │
 │  · Tutorial (tut*)    · Import PSD/SVG          fState, dVars, │
 │  · Core     (g*)      · IA única (gAskAI)       acState)      │
 │                       · Pintura (paint canvas)                │
 │                                                               │
 │  PERSISTÊNCIA LOCAL:  localStorage (cache)  ·  IndexedDB (img) │
 └───────────────┬───────────────────────────────────────────────┘
                 │  supabase-js (vendorizado) · anon key pública
                 ▼
        SUPABASE  (projeto uqrqzjafhigjuvtjqzid)
 ┌─────────────────────────────────────────────────────────────┐
 │  AUTH (GoTrue)   API (PostgREST)   STORAGE (buckets luma-*)   │
 │        └────────────────┬───────────────────┘                │
 │                         ▼                                     │
 │              POSTGRES  +  RLS  (a ÚNICA fronteira de segurança)│
 │              schemas: public · luma · analytics               │
 └─────────────────────────────────────────────────────────────┘
                 │  (offline / fora da app)
                 ▼
        GitHub Actions → BACKUP diário   ·   CleverTap → CRM (planejado)
```

**A ideia-força:** não existe camada intermediária. O navegador é cliente do Supabase; **quem decide o que cada usuário pode ler/escrever é a RLS no Postgres**, não código JavaScript.

---

## 2. Frontend

**O que é.** Uma **Single Page Application em Vanilla JS puro** — sem framework, sem bundler, sem npm no runtime. Roda abrindo o `index.html` (Live Server em dev). O trade-off central: **zero fricção de setup/deploy** em troca de não ter modularidade real, tipos ou testes automatizados. O acoplamento é controlado por **convenção**, não por ferramenta.

**Como carrega.** O `index.html` traz **69 `<script>` em ordem** (a lista, sempre atual, em `luma-brain/MAPA.md`) — tudo global, sem `import`/`export`. A ordem importa (um arquivo depende do anterior já ter definido suas funções globais).

**Como se organiza.** Não há módulos ES; a separação é por **prefixo de função** e por **arquivo por subdomínio**:

| Prefixo | Domínio | Onde |
|---------|---------|------|
| `f*` | Franqueado | `js/franqueado/*` |
| `d*` | Designer / Estúdio | `js/designer/*` |
| `g*` | Core / global | `js/core/*`, `js/00-config.js` |
| `tut*` | Tutoriais | `js/tutorial/*` |
| `pv*` | Preview engine | `js/designer/preview.js` |
| `ac*` | Academia (formação do franqueado) | `js/academia/*` |

**Estado.** Variáveis `let` **globais** (`dLayers`, `fState`, `dVars`, `dFolders`, `gAuthState`…), mutadas diretamente + re-render manual. Não há store, signals ou virtual DOM.

**Views.** O `index.html` tem containers por modo (`#view-franqueado`, `#view-academia`, `#view-designer`). O boot (`main.js`, `DOMContentLoaded` async) checa a sessão, decide login × app, e `setMode()` troca a classe do `body` e inicializa Estúdio e Academia _lazy_ (só na primeira entrada de cada um).

⚠️ **Armadilha do `viewEntrance`:** as views guardam o `transform` final da animação de entrada (`animation-fill-mode: forwards`). `transform` ≠ `none` cria **bloco de contenção**, então um filho `position:fixed` ancora na view, não no viewport. Painel/drawer dentro de uma view usa `position:absolute` num pai explícito. _(Bug real da Academia: os drawers saíam 52px deslocados.)_

**Bibliotecas** entram **vendorizadas** em `assets/vendor/` (Color Thief, Pica, PapaParse, pdf-lib, ag-psd, supabase-js). O vendorizado é o **padrão** — boot previsível, sem depender de rede. Um **fallback via CDN é permitido** quando o vendorizado falhar (ex.: o loader do ag-psd tenta o local e cai no CDN). Decisão de 2026-07: rede externa em runtime deixou de ser proibida; o vendorizado continua sendo a primeira escolha.

**Distribuição.** Produção é o **GitHub Pages** (subpath `/Luma/` — por isso manifest e links usam caminhos **relativos**). O app é um **PWA instalável**: `manifest.json` + ícones + metas Apple no `<head>`; no iPhone, Safari → Compartilhar → Adicionar à Tela de Início (abre standalone, sem barra do navegador). ⛔ **Sem service worker, de propósito:** não há build/hash de arquivos, então cache de SW congelaria versão velha no celular do franqueado — a atualização instantânea a cada deploy vale mais que instalação com um toque no Android.

---

## 3. Editor / Estúdio

O Estúdio é a parte mais pesada do frontend. Sua arquitetura tem três superfícies sobrepostas dentro de um mesmo "canvas":

```
 #d-canvas-frame  (transform: scale = ZOOM)
 ├─ camadas .canvas-layer   → DOM absoluto (position:absolute), 1 div por camada
 ├─ #d-paint-canvas         → um Canvas 2D SEPARADO para pintura (brush/eraser…)
 └─ decorações              → handles de seleção, guias, réguas, marquee
```

**Decisões de arquitetura:**
- **Canvas único por template** (a era multi-artboard acabou). `dLayers` é a lista plana de camadas; `dLayers[0]` é o fundo.
- As camadas são **DOM absoluto**, não pixels — por isso são selecionáveis, arrastáveis e editáveis inline. O **zoom é `transform: scale`** no frame (coordenadas de mouse dividem pela escala).
- A **pintura** vive num Canvas 2D à parte (preservado por _detach/reattach_ quando o DOM do editor é reconstruído).
- Tipos de camada: `text`, `shape`, `frame` (moldura de foto), `image`.
- **Import** de PSD (via `ag-psd` + Web Worker com fallback) e SVG (via DOMParser) alimentam o mesmo modelo de camadas.

---

## 4. Canvas / Motor de render

O ponto arquitetural mais importante do produto: **um interpolador de campos compartilhado — e, ao contrário do que este arquivo afirmava, QUATRO caminhos de render.**

```
                       CAMPOS ({{var}})  +  dados
                              │
                    ┌─────────┴──────────┐  (gInterpolate — UM interpolador, de verdade)
                    ▼                    ▼
   ┌──────────────────────────────────────────────────────────────┐
   │   CAMINHOS DE RENDER (as mesmas camadas, 4 implementações)     │
   └──┬──────────────┬──────────────────┬───────────────────┬──────┘
      ▼              ▼                  ▼                   ▼
 DOM absoluto   Canvas 2D nº1      Canvas 2D nº2        SVG (export)
 dRenderCanvas  pvRenderLayer      fRenderOneLayer      dSvgShape/Text/Fx
 canvas.js:1107 preview.js:145     png-generator.js:675 preview.js:523+
 (edição no     (prévia e export   (prévia do           (vetorial, com
  Estúdio)       do Estúdio)        franqueado + PNG)    fontes embutidas)
```

⚠️ **Correção (2026-09-03): o "motor único de render" não existe.** Este arquivo afirmava
"um único motor, três alvos"; o código foi medido e **o código venceu**. `preview.js` não
chama `fRenderTemplateLayers` em lugar nenhum — é um renderizador paralelo vivo, entrando
por `dPreviewOpen`. E `measureText` (a quebra de linha, a parte difícil) aparece em **6
arquivos**.

**O que continua verdade:** `gInterpolate` é único, e a prévia do franqueado e o PNG final
compartilham `fRenderTemplateLayers` — por isso **o que o franqueado vê é o que ele baixa**.

**A consequência ao mexer:** composição nova de camada (grupo, clipping, máscara, blend,
efeito) precisa nascer em **todo caminho que a exibe**, ou a prévia passa a divergir do
arquivo final — foi assim que a composição de grupo do PSD ficou meio caminho. Comece por
`fRenderOneLayer` (é o que o franqueado baixa) e confira o espelho em `pvRenderLayer`.
Mapa dos pontos de entrada: `luma-brain/MAPA.md` → "Os motores únicos".

**Smart resize:** um motor de âncoras (`js/core/layout.js`) re-ancora as camadas entre formatos (Story/Feed/Wide) por fator único de escala — nunca distorce. Usado no editor, na prévia e no PNG.

**Formatos:** Story 1080×1920 · Feed 1080×1350 · Post/Wide 1200×628 (mais tamanhos nativos de PSD).

**Motor de copy (legendas):** separado do motor de render — é o **combinatório** que gera as 3 legendas do post (auxiliar, NÃO IA). Vive em `js/franqueado/png-generator.js` (`fBuildCopy` → `_fAssembleCopy`, bancos `_COPY_BLOCKS`, segmento `_fCopySegment`), acionado pelo assistente de legenda em `chat.js` (`fGenCaptionSuggestions`). Detalhe completo (peças, como estender) em `docs/LUMA.md` §9 → "Motor de copy / legendas".

---

## 5. Backend

**O que é.** **Supabase** (projeto `uqrqzjafhigjuvtjqzid`, plano Free) = Postgres gerenciado + Auth (GoTrue) + Storage + API auto-gerada. É um backend **próprio do Luma**, separado do Portal/CRM da DM (que é outro projeto Supabase).

**O que NÃO é.** ⛔ **Não há servidor de aplicação próprio** — sem Node, sem Express, sem Next. A "lógica de servidor" é **RLS + funções SQL** dentro do Postgres.

⚠️ **Correção (2026-07-31):** este arquivo afirmava "sem Edge Functions deployadas". **Existem duas**, e o código venceu o doc:
- `supabase/functions/invite-user` — convite de usuário (precisa de service role).
- `supabase/functions/ai` — **tubulação única de IA**: guarda a chave do provedor fora do front, valida JWT, aplica rate-limit e mantém a allowlist de tarefas. Desde 2026-07-31 também monta o **prompt pedagógico** do tutor da Academia (task `aula`), a primeira tarefa cujo prompt vive no servidor.

Isso **não** transforma o Luma num app com backend próprio: as functions são fronteiras pontuais (segredo e regra que não pode viver no cliente), não uma camada por onde o app passa. O front continua falando **direto** com PostgREST/Storage, e a RLS continua sendo a única fronteira de segurança dos dados. Criação de usuário segue no Dashboard quando o convite não serve.

**Consequência arquitetural central:** como o front fala direto com o banco usando a **anon key pública**, **a RLS é a única fronteira de segurança**. Não existe "camada de servidor" para validar regra de negócio — se a regra precisa valer, ela vive numa _policy_ SQL. O JavaScript é conveniência/UX, nunca segurança.

---

## 6. API

Não há API REST escrita à mão. A "API" do Luma é o que o Supabase expõe:

- **PostgREST** — API REST auto-gerada sobre as tabelas (`/rest/v1/*`). Aplica RLS automaticamente. É por aqui que o front lê/escreve dados.
- **Storage API** — upload/download de arquivos nos buckets.
- **Auth API** (GoTrue) — login, sessão, reset de senha.

Tudo acessado pelo **cliente `supabase-js` vendorizado** (`window.sb`), criado no boot com URL + anon key. Sem credenciais configuradas, a app **degrada para modo local** (só localStorage) — o backend é opcional por design.

**Schemas expostos na API:** apenas `public`, `graphql_public`, `luma`. ⛔ `analytics` e schemas internos **nunca** são expostos (já causou incidente).

---

## 7. Banco de dados

Postgres, três schemas, **RLS habilitado em tudo**:

| Schema | Contém | Acesso |
|--------|--------|--------|
| `public` | `profiles` (estende `auth.users`: role, nome, departamento) | Usuário lê o próprio; staff lê todos |
| `luma` | `pastas`, `templates`, `variaveis`, `fontes`, `snippets`, `biblioteca_assets`, `artes` + **Academia** (`cursos`, `curso_modulos`, `curso_aulas`, `matriculas`, `aula_progresso`, `aula_notas`, `aula_mensagens`, `certificados`) + **Controle do produto** (`feature_flags`, `feature_flag_history`) | Leitura autenticada; escrita de conteúdo só designer (`is_designer()`); `artes`/progresso por dono; `aula_notas` e `aula_mensagens` **só do dono** (nem a equipe lê); `certificados` sem policy de escrita (grava só a RPC `ac_emitir_certificado`); `feature_flags` lidas por todo autenticado e escritas só por `gestao`; `feature_flag_history` sem policy de escrita (grava só o trigger) |
| `analytics` | `fct_eventos` + views `vw_*` de extração | INSERT autenticado em nome próprio; SELECT só `gestao` |

**Princípios de arquitetura do banco:**
- **RLS como fronteira** — `anon` sem acesso; regra por role via funções `get_user_role()` / `is_designer()` embutidas nas policies.
- **Analytics por extração**, não por dashboard: as views `analytics.vw_*` são consumidas via SQL Editor/BI, sem grant e sem módulo no front.
- Estrutura desenhada para eventualmente **fundir com o CRM da DM**.
- Migrations versionadas em `supabase/migrations/`; toda mudança vai no `docs/LUMA-BACKEND-CHANGELOG.md`.

---

## 8. Storage

Arquivos (imagens, fontes) não moram no banco nem no localStorage — vão para **buckets** no Supabase Storage. Cinco buckets `luma-*`:

| Bucket | Guarda | Visibilidade |
|--------|--------|--------------|
| `luma-covers` | Capas de campanha/pasta | — |
| `luma-template-assets` | Imagens de camadas dos templates | — |
| `luma-fontes` | Fontes enviadas pelo designer | — |
| `luma-user-uploads` | Fotos que o franqueado envia (produto) | **Público** (viram arte pública) |
| `luma-renders` | Renders | Privado |
| `luma-aulas` | Vídeos MP4 e materiais das aulas da Academia | **Privado** (URL assinada; vídeo de formação não vira link público) |

**Fluxo:** imagem base64 / referência `idb://` no estado → **upload para o Storage** → o banco guarda apenas a **URL**. Isso resolve o antigo "imagens somem no reload" e alivia a quota do localStorage (~5MB).

---

## 9. Autenticação

- **Supabase Auth (GoTrue)** — login por e-mail + senha; reset por e-mail; logout real.
- **No boot**, a app carrega o perfil (`auth.getUser()` + `SELECT` em `profiles`) e popula o estado de sessão (`gAuthState`) **antes** de decidir login × app.
- **Role sempre do servidor** (`profiles.role`), nunca do metadata do JWT.
- **Gate por role** no front esconde o Estúdio do franqueado; a RLS garante a proteção do conteúdo. Analytics não tem superfície no app.
- Um **trigger guard** no banco bloqueia auto-promoção de role.

⛔ **Sem middleware / sem auth guard server-side** — é uma SPA estática, não há servidor para interceptar rotas. A proteção efetiva é: front esconde + **RLS retorna vazio** para quem não tem direito.

---

## 10. Persistência e sincronização

Modelo **offline-first**, três camadas:

```
  localStorage  ──(cache síncrono, boot rápido)──┐
  IndexedDB     ──(imagens grandes, refs idb://)─┤──►  ESTADO (memória)
  Supabase      ──(FONTE compartilhada, cross-device)─┘
```

- **localStorage** = cache. Boot é rápido e nunca bloqueia. ~16 chaves (`yngs_*`, `dm_artes_hist_v2`…).
- **IndexedDB** (`js/core/img-store.js`) = cache local de imagens grandes (refs `idb://`).
- **Supabase** = a fonte de verdade compartilhada. No boot, uma rodada de **syncs** puxa o catálogo do banco (com _merge_ não-destrutivo); escritas fazem **push em background** com debounce (só designer para conteúdo).

⛔ Remoção no banco é sempre **explícita** — o sync nunca apaga em massa (proteção contra um designer apagar o trabalho de outro).

---

## 11. CRM (fronteira, planejado)

O **módulo CRM Visual** (💡 não implementado) é uma **fronteira de saída**, não um backend novo:

```
  Luma (templates + campos)  →  peça de inapp/push  →  CleverTap (envio)
```

- O Luma **prepara** a peça compatível; **quem envia é o CleverTap**. O Luma não dispara mensagem.
- ⚠️ Não confundir com o **Portal/CRM de Franqueados** — outro produto, outro Supabase, com comunicados/tickets. Não faz parte da arquitetura do Luma.
- Dependência antes de construir: mapear os formatos que o CleverTap aceita.

---

## 12. O que a arquitetura NÃO tem (fronteiras conscientes)

Saber o que **não** existe evita a IA propor solução para camada inexistente:

- ⛔ **Sem etapa de build/bundler.** Nada de Vite/Webpack/npm no runtime. Script novo = `<script>` no `index.html`, na ordem certa.
- ⛔ **Sem servidor de aplicação** (Node/Edge/Next). A lógica de servidor é RLS + SQL.
- ⛔ **Sem SSR / sem middleware de rota.** É SPA estática.
- ⛔ **Sem API intermediária.** O front fala direto com PostgREST/Storage. As duas Edge Functions são exceções pontuais (segredo/regra), não uma camada de passagem — ver §5.
- ⛔ **Sem streaming adaptativo de vídeo.** A Academia serve MP4 progressivo por URL assinada; o modelo separa `video_path` de `video_url` pra trocar por HLS depois sem mexer no schema.
- ⛔ **Sem multi-tenant real** no Luma hoje — todos os franqueados veem o mesmo catálogo publicado. Isolar por cidade seria uma decisão de arquitetura nova, não um dado existente.
- ⚠ **Testes automatizados existem** (correção de 2026-09-03 — este arquivo dizia que não): `tests/*.html` rodam em Chromium real via `scripts/run-browser-tests.js`, **119 casos**, portao de CI em `.github/workflows/tests.yml`. Cobrem o **solver de Auto-layout** e o **importador de PSD** — e só eles. Interpolador, gerador de PNG, chat, catálogo e toda a UI **continuam sem cobertura**: para esses, regressão se detecta abrindo o navegador (por isso _patch cirúrgico_ segue regra).

---

## 12.1 Controle do produto (camada de disponibilidade, 2026-08-01)

Uma camada transversal nova, entre o estado e as views: **o que está disponível agora**.

```
  G_FEATURE_REGISTRY (versionado)  →  o que EXISTE
            +
  luma.feature_flags (Supabase)    →  o que a gestão CONFIGUROU
            +
  cache local + override por role + cascata pai/filho
            ↓
  gFeatureCan(chave, ação)         →  o estado EFETIVO
            ↓
  data-feature no HTML (visual)  +  guard no handler (o bloqueio real)
```

Motor em `js/core/feature-flags.js` — **é o motor único**, como `gInterpolate` e `gEsc`. Nenhum outro arquivo fala com a tabela de flags. A tela da gestão (`js/core/product-control.js`) entra como 5ª aba do painel da conta que já existia, não como superfície nova.

**A fronteira que importa:** isto governa **experiência**, não segurança. A RLS continua sendo a única fronteira dos dados (§5). Por isso o fallback é **fail-open** — sem backend e sem cache, o Luma funciona como antes. E por isso `render`/`export`/`load` continuam permitidos com o recurso desativado: desligar a ferramenta que cria nunca pode sumir com o conteúdo já criado.

Detalhe completo e matriz de cobertura: `docs/LUMA.md` §22.

---

## 13. Fluxo de dados, ponta a ponta

```
 Designer publica template
   → supabase-js (anon key)
   → PostgREST valida via RLS (is_designer)
   → grava em luma.templates  +  imagens no Storage (URL no banco)
   → localStorage atualizado (cache)

 Franqueado abre o catálogo
   → sync no boot puxa luma.pastas/templates (RLS: só publicado)
   → escolhe material, preenche campos no chat
   → MOTOR DE RENDER (interpolador único) desenha no Canvas 2D
   → PNG/PDF baixado; entrada gravada em luma.artes (RLS: por dono)
```

---

## Ver também

- `00_PRODUCT.md` — propósito, público, escopo.
- `01_BUSINESS.md` — regras do domínio e invariantes.
- `docs/LUMA.md` — documentação técnica oficial (funções, tabelas, policies).
- `docs/LUMA-BACKEND-CHANGELOG.md` — histórico de mudanças de backend.
