# 02 — ARQUITETURA · Como o sistema é dividido

> Como o Luma é montado, em camadas e fronteiras. **Sem código — só arquitetura.**
> O `01_BUSINESS.md` diz as regras do domínio; este diz onde cada coisa mora e como as partes conversam. Para o "como" no detalhe (funções, tabelas, policies), a fonte é `docs/LUMA.md`.
> Última revisão: 2026-07-11.

---

## 1. Visão em uma imagem

O Luma é uma **SPA estática que fala direto com o Supabase**. Não há servidor de aplicação próprio no meio.

```
        NAVEGADOR (o "servidor" é o navegador do usuário)
 ┌─────────────────────────────────────────────────────────────┐
 │  index.html  →  ~60 <script> globais (Vanilla JS, sem build)  │
 │                                                               │
 │  VIEWS/MÓDULOS        MOTORES                 ESTADO          │
 │  · Franqueado (f*)    · Render (Canvas 2D)    variáveis let   │
 │  · Estúdio  (d*)      · Interpolador único    globais         │
 │  · Dados    (p*)      · Smart resize          (dLayers,       │
 │  · Tutorial (tut*)    · Import PSD/SVG          fState, dVars) │
 │  · Core     (g*)      · Pintura (paint canvas)                │
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

**Como carrega.** O `index.html` traz **~60 `<script>` em ordem** — tudo global, sem `import`/`export`. A ordem importa (um arquivo depende do anterior já ter definido suas funções globais).

**Como se organiza.** Não há módulos ES; a separação é por **prefixo de função** e por **arquivo por subdomínio**:

| Prefixo | Domínio | Onde |
|---------|---------|------|
| `f*` | Franqueado | `js/franqueado/*` |
| `d*` | Designer / Estúdio | `js/designer/*` |
| `g*` | Core / global | `js/core/*`, `js/00-config.js` |
| `p*` | Dados / Analytics | `js/dados/*` |
| `tut*` | Tutoriais | `js/tutorial/*` |
| `pv*` | Preview engine | `js/designer/preview.js` |

**Estado.** Variáveis `let` **globais** (`dLayers`, `fState`, `dVars`, `dFolders`, `gAuthState`…), mutadas diretamente + re-render manual. Não há store, signals ou virtual DOM.

**Views.** O `index.html` tem containers por modo (`#view-franqueado`, `#view-designer`, Dados). O boot (`main.js`, `DOMContentLoaded` async) checa a sessão, decide login × app, e `setMode()` troca a classe do `body` e inicializa cada módulo _lazy_ (só na primeira vez).

**Bibliotecas** entram **vendorizadas** em `assets/vendor/` (Color Thief, Pica, PapaParse, pdf-lib, ag-psd, supabase-js) — nunca via CDN em runtime.

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

O ponto arquitetural mais importante do produto: **um único motor de render, três alvos de saída, um interpolador de campos compartilhado.**

```
                       CAMPOS ({{var}})  +  dados
                              │
                    ┌─────────┴──────────┐  (gInterpolate — UM interpolador)
                    ▼                    ▼
   ┌────────────────────────────────────────────────────┐
   │           MOTOR DE RENDER (mesmas camadas)           │
   └───────┬───────────────┬───────────────────┬─────────┘
           ▼               ▼                   ▼
   DOM absoluto      Canvas 2D            SVG (export)
   (edição no        (prévia + PNG/JPG    (vetorial, com
    Estúdio)          final 2×)            fontes embutidas)
```

**Por que importa:** a simulação do designer, a prévia ao vivo do franqueado e o PNG final passam pelo **mesmo motor e o mesmo interpolador**. Por isso **o que o designer monta é exatamente o que o franqueado obtém** — não há dois renderizadores para divergir.

**Smart resize:** um motor de âncoras (`js/core/layout.js`) re-ancora as camadas entre formatos (Story/Feed/Wide) por fator único de escala — nunca distorce. Usado no editor, na prévia e no PNG.

**Formatos:** Story 1080×1920 · Feed 1080×1350 · Post/Wide 1200×628 (mais tamanhos nativos de PSD).

---

## 5. Backend

**O que é.** **Supabase** (projeto `uqrqzjafhigjuvtjqzid`, plano Free) = Postgres gerenciado + Auth (GoTrue) + Storage + API auto-gerada. É um backend **próprio do Luma**, separado do Portal/CRM da DM (que é outro projeto Supabase).

**O que NÃO é.** ⛔ **Não há servidor de aplicação próprio** — sem Node, sem Express, sem Next, sem Edge Functions deployadas no Luma. Toda a "lógica de servidor" é **RLS + funções SQL** dentro do Postgres. Operações administrativas (criar usuário) são feitas **no Dashboard do Supabase**, não por um endpoint da aplicação.

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
| `luma` | `pastas`, `templates`, `variaveis`, `fontes`, `snippets`, `biblioteca_assets`, `artes` | Leitura autenticada; escrita de conteúdo só designer (`is_designer()`); `artes` por dono |
| `analytics` | `fct_eventos` + views `vw_*` de extração | INSERT autenticado em nome próprio; SELECT só `gestao` |

**Princípios de arquitetura do banco:**
- **RLS como fronteira** — `anon` sem acesso; regra por role via funções `get_user_role()` / `is_designer()` embutidas nas policies.
- **Analytics por extração**, não por dashboard: as views `analytics.vw_*` são consumidas via SQL Editor/BI, sem grant para o front. O módulo Dados do app mostra dados **simulados**.
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

**Fluxo:** imagem base64 / referência `idb://` no estado → **upload para o Storage** → o banco guarda apenas a **URL**. Isso resolve o antigo "imagens somem no reload" e alivia a quota do localStorage (~5MB).

---

## 9. Autenticação

- **Supabase Auth (GoTrue)** — login por e-mail + senha; reset por e-mail; logout real.
- **No boot**, a app carrega o perfil (`auth.getUser()` + `SELECT` em `profiles`) e popula o estado de sessão (`gAuthState`) **antes** de decidir login × app.
- **Role sempre do servidor** (`profiles.role`), nunca do metadata do JWT.
- **Gate por role** no front esconde as abas Designer/Dados do franqueado; a RLS garante no dado. As duas camadas coexistem de propósito.
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
- ⛔ **Sem API intermediária.** O front fala direto com PostgREST/Storage.
- ⛔ **Sem multi-tenant real** no Luma hoje — todos os franqueados veem o mesmo catálogo publicado. Isolar por cidade seria uma decisão de arquitetura nova, não um dado existente.
- ⛔ **Sem testes automatizados** — regressão se detecta abrindo o navegador (por isso _patch cirúrgico_ é regra).

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
