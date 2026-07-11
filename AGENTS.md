# AGENTS.md — Projeto Luma (regras para agentes / Antigravity + Gemini)

> Instruções permanentes para **qualquer agente** que trabalha neste repositório.
> No **Antigravity**, use este arquivo como **Workspace Rule** com ativação **"Always On"** (vale para todo prompt). Ele pode ser referenciado por `@AGENTS.md` e referencia os arquivos do `luma-brain/`.
> A mente do projeto é a pasta `luma-brain/`. Este arquivo é o ponto de entrada; a profundidade mora lá.

---

## Fluxo obrigatório — 3 fases, nesta ordem

**1) LÊ o `luma-brain/` → 2) PLANEJA → 3) IMPLEMENTA.** Não pule fases. Verificar e não commitar sozinho nunca se pulam.

### FASE 1 — LÊ o luma-brain (entender antes de mexer)

Nunca suponha — abra e confira. Qual dúvida → qual arquivo:

- `@luma-brain/00_PRODUCT.md` — o que é o Luma, público, escopo.
- `@luma-brain/01_BUSINESS.md` — **regras de domínio** (sempre que envolver negócio).
- `@luma-brain/02_ARCHITECTURE.md` — como o sistema é dividido; **o que NÃO existe**.
- `@luma-brain/03_ENGINEERING.md` — as 3 leis do código.
- `@luma-brain/04_DESIGN_SYSTEM.md` — tokens, cores, componentes.
- `@luma-brain/06_OPERATING_SYSTEM.md` — como se comportar (o loop, guardrails).
- Técnico detalhado: `@docs/LUMA.md`. Backend: `@docs/LUMA-BACKEND-CHANGELOG.md`.

Mínimo por tarefa: `06` + o arquivo do assunto. Código → some `03`. UI → `04`. Negócio → `01` **sempre**.

### FASE 2 — PLANEJA

- Foque no **resultado**, não no pedido literal.
- **Arquitetura confere?** Não proponha solução para camada que não existe (sem servidor de aplicação, sem build, sem multi-tenant; RLS é a única fronteira de segurança).
- **Mapeie 1–2 arquivos.** Mais de 3 = quase sempre há caminho mais simples.
- **Grep antes de criar.** Há UM interpolador, UM motor de render, UM `gEsc`. Reutilize, não clone.

### FASE 3 — IMPLEMENTA

- **Patch cirúrgico.** `f*` e `d*` não regridem. Prefixos e IDs **nunca** renomeados.
- Vanilla JS: **sem `import`/`export`, sem build, sem dependência nova.** `let` global só se compartilhado + re-render manual.
- Estado **por ID, não por referência viva** (undo/simulação/sync trocam objetos por clones).
- `gEsc`/`_dEsc` em todo dado de usuário; cor/motion via **token** (nunca hex solto); ícone = SVG `currentColor` (nunca emoji); feedback via `gToast`; `localStorage` em `try/catch`.
- **Verifique no navegador** — não há teste automatizado; "compilou" não é verificação.
- **Nunca commit automático. Nunca `git add .`.** Mostre o diff, peça confirmação.

Ordem de autoridade: **palavra do usuário > código real > luma-brain/docs > genérico.**

---

## Coleira do Gemini (leia com atenção — evita as cagadas)

O Gemini 3.1 Pro é forte em **entender, pesquisar e rascunhar** com contexto amplo. Ele erra quando recebe pedido **aberto e grande**. Portanto, neste projeto:

- ⛔ **Nunca faça refatoração autônoma de vários arquivos.** Máximo **1–2 arquivos por tarefa**, com critério de aceite claro.
- ⛔ **Não invente função/API/arquivo.** Se não achou no `grep`, **não existe** — pergunte ou procure mais. (Alucinar API é a falha mais comum aqui.)
- ⛔ **Não toque no núcleo frágil sem plano aprovado:** `js/designer/canvas.js`, `layers.js`, `templates.js`, o motor de render (`png-generator.js`/`preview.js`), `undo-redo.js`, `publish.js`, e **qualquer RLS/backend**. Isso é território de revisão cuidadosa — proponha o diff e **peça revisão antes de aplicar**.
- ⛔ **Não "melhore" o que não foi pedido.** Nada de mexer em código vizinho por conta própria.
- **Antes de editar mais de 1 arquivo ou algo do core: mostre um PLANO + o diff proposto e espere o OK.**
- **Na dúvida, faça MENOS.** Escopo fechado > escopo esperto.
- Dúvida de **negócio/gosto → pergunte**; dúvida **técnica → vá ao código**.

---

## Lanes — o que é do Gemini e o que passar pro Claude

**Fica bem com o Gemini 3.1 Pro (leitura, contexto amplo, escopo fechado):**
- Entender/mapear código; achar ONDE está um bug (não corrigir); onboarding; resumir o luma-brain.
- Pesquisa e síntese (ex.: formatos do CleverTap, libs, comparar abordagens); rascunho de doc.
- Coisas isoladas e autocontidas em 1 arquivo: módulo CSS novo, dados estáticos (nova campanha em `00-config.js`), copy/UX, utilitário puro, dados de teste/CSV.
- Análise sobre muito input: revisar diff grande e **listar candidatos** a bug; traduzir; resumir.
- Multimodal: "print da tela, o que está desalinhado?", crítica de design.

**Passe pro Claude (Opus/Fable) — escrita cirúrgica no frágil + verificação:**
- Mudança multi-arquivo no núcleo (canvas/layers/templates/render/undo/publish).
- Qualquer coisa nos motores únicos (interpolador, render, RLS) ou segurança.
- **Corrigir** bugs (Gemini acha candidatos; Claude confirma na fonte e corrige sem quebrar).
- Backend/RLS/migrations; sequências autônomas longas; o passo final "implementa + verifica + não regride".

**Regra de bolso:** _Gemini propõe; Claude dispõe no core._ Gemini para ENTENDER/PESQUISAR/RASCUNHAR; Claude para MEXER no frágil e VERIFICAR.
