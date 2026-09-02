# 03 — ENGENHARIA · O manual técnico do time

> As regras de como se escreve código no Luma. É o manual do time — para gente e para IA.
> **Aviso importante:** este projeto tem restrições incomuns (Vanilla JS, sem build, sem framework, sem testes automatizados, estado global por design). Por isso, **alguns "best practices" genéricos aqui aparecem TRADUZIDOS para a realidade do Luma** — e, onde a regra clássica não se aplica, o arquivo diz a verdade em vez de fingir. Seguir cegamente conselho genérico aqui **quebra** o projeto.
> Ordem de autoridade quando algo divergir: **o código > este arquivo > conselho genérico de fora.**
> Última revisão: 2026-07-15. Ver `02_ARCHITECTURE.md` (o "onde") e `docs/LUMA.md` (o detalhe).

---

## As 3 leis que explicam todas as outras

1. **Sem build, sem framework, sem ES Modules.** Funções globais, `<script>` sequenciais no `index.html`. Nada de `import`/`export`, npm em runtime, Vite/Webpack. Bibliotecas entram **vendorizadas** em `assets/vendor/`.
2. **Prefixos e IDs são sagrados.** `f*` `d*` `g*` `tut*` `pv*`. O HTML chama funções por nome (`onclick="fNextStep()"`) e há chamadas cruzadas entre arquivos. **Renomear = quebrar em silêncio.**
3. **Patch cirúrgico.** Adicione sem quebrar. A maioria das features toca **1–2 arquivos**; se abriu mais de 3, quase sempre há caminho mais simples. `f*` e `d*` **não podem regredir**.

Tudo abaixo deriva dessas três.

---

## 1. DRY / Reutilização — "uma fonte de verdade"

O espírito de _"nunca duplicar, sempre reutilizar"_ vale **fortemente** aqui — mas "componente" no Luma é **função global compartilhada**, não componente de framework.

O produto inteiro se apoia em **motores únicos**. Nunca crie um segundo:

| Existe UM só | Papel | ⛔ Nunca crie outro |
|---|---|---|
| `gInterpolate` | Substitui `{{campos}}` por valores | Um segundo interpolador → designer e franqueado divergem |
| motor de render (`fRenderTemplateLayers`) | Desenha camadas em Canvas 2D | Um render "paralelo" → o PNG não bate com a prévia |
| `gEsc` / `_dEsc` | Escape de HTML | Escapar "na mão" em um ponto → brecha de XSS |
| tokens de `00-tokens.css` | Cores, espaçamentos, motion | Hex hardcoded → marca inconsistente |
| motor de smart-resize (`js/core/layout.js`) | Re-ancora entre formatos | Redimensionar "na mão" → distorção |

**Regra prática:** antes de escrever uma função que formata/valida/desenha/escapa, **procure a que já existe** (grep pelo prefixo). Se existe, reutilize. Se quase serve, estenda-a — não clone.

⚠️ **Cuidado com o oposto também:** não "reutilize" copiando-e-colando um bloco. Duplicação de lógica foi origem de vários bugs (dois caminhos que deviam ser um só e saíram de sincronia).

---

## 2. Tamanho e organização — "componentes pequenos" = funções pequenas + 1 arquivo por subdomínio

- **Uma responsabilidade por função.** Funções pequenas e nomeadas pelo que fazem.
- **Um arquivo por subdomínio** (`franqueado/chat.js`, `designer/publish.js`…). Feature nova → mora no arquivo do seu subdomínio, não num arquivo genérico.
- ⚠️ **Dívida conhecida:** `canvas.js`, `layers.js`, `templates.js` beiram 1–3k linhas. **Não engorde-os por reflexo.** Código novo entra no arquivo certo; se um arquivo estourar, o caminho é _split por subdomínio_ (decisão consciente, não no meio de outra tarefa).
- ⛔ **Não crie arquivo novo sem código para colocar agora.** Nada de "esqueleto para o futuro".

---

## 3. Estado global — a regra que se INVERTE aqui

O conselho genérico _"não use estado global sem necessidade"_ **não se aplica como está**: no Luma o **estado global é a arquitetura** (`dLayers`, `fState`, `dVars`, `dFolders`, `gAuthState` — variáveis `let` globais mutadas direto). Não há store nem framework para substituir.

A regra traduzida para a realidade:

- **Use o padrão existente:** `let` global + mutação direta + **re-render manual** (`dRenderCanvas()`, `fRenderHist()`…). Nada de setState/Redux/signals.
- ⛔ **Nunca `const` no escopo global para estado compartilhado** — use `let`.
- **Não adicione um global novo por conveniência.** Prefira variável local; só promova a global se o estado é realmente compartilhado entre arquivos.
- ⛔ **Resolva pelo ID, não pela referência.** O estado global é frágil: `undo/redo`, simulação e sync **trocam** os objetos de `dLayers` por clones. Guardar uma referência viva (uma camada, a origem do carimbo) e usá-la depois aponta para objeto morto. Resolva sempre por `dLayers.find(x => x.id === ...)` na hora de usar. _(Foi origem real de bugs nesta base.)_
- **Mutou? Re-renderize.** E lembre que re-render reconstrói o DOM — referências a elementos antigos ficam órfãs.

---

## 4. Segurança é regra, não opção

Porque **a RLS é a única fronteira** (o front fala direto com o banco), o cuidado no cliente é obrigatório:

- ⛔ **Escape todo dado de usuário antes de `innerHTML`** — `gEsc` (global) / `_dEsc` (designer). Nome de campanha, rótulo de campo, nome de camada, nome de fonte (inclusive vindo do backend). XSS armazenado é risco real e já foi corrigido em 3 frentes.
- ⛔ **Segurança nunca mora no JavaScript.** Se a regra precisa valer, ela é uma _policy_ RLS. Front é UX.
- ⚠️ **Mexeu em backend?** Policy de UPDATE precisa de `WITH CHECK`; RLS sem policy = _deny-all_ silencioso; nada de service role no front. **Toda mudança vai no `docs/LUMA-BACKEND-CHANGELOG.md`.**
- ⚠️ **Never `git add .`** — a raiz tem arquivos pessoais/segredos fora do versionamento.

---

## 5. UI, feedback e marca

- ⛔ **Feedback ao usuário só via `gToast`** — nunca `alert()`, `confirm()` espalhado ou `console.log()` como UI. Toast é status curto, orientado à ação, em PT-BR.
- ⛔ **Confirmação só via `gConfirm`/`gPrompt`** (`core/toast.js`). `confirm()`/`prompt()` nativos **não existem mais no código** — não reintroduza. Cada um vira `async`; e depois do `await`, **re-resolva o alvo por ID/nome**: índice e referência viva apontam para objeto morto quando undo/sync trocam os objetos por clones.
- ⛔ **Sem emoji na copy** (`'⚠ ...'`, `'✓ ...'`). Ícone é SVG; emoji renderiza diferente por sistema. Varredura de 13/08 zerou os 169 que existiam em `gToast`.
- ⛔ **Composição nova (grupo, clipping, máscara, blend) nasce nos DOIS motores** — canvas do Estúdio (`canvas.js`, DOM) e `fRenderTemplateLayers` (Canvas 2D) — ou não nasce. Prévia que diverge do arquivo final é o defeito que este projeto mais evita, e foi assim que a composição de grupo do PSD ficou meio caminho (revisão de 13/08).
- ⛔ **Cores e espaçamentos via tokens** (`00-tokens.css`) — nunca hex hardcoded, nem em CSS, nem em JS.
- ⛔ **Ícone de UI = SVG inline** (`stroke`, `currentColor`) — nunca emoji (renderiza diferente por sistema, quebra a marca).
- **PT-BR em toda a copy**, com o glossário canônico (camada não "layer", campo não "variável", prancheta/Canvas não "artboard"). Erro sempre diz **o que fazer**. `{{ }}` e nome técnico **nunca** aparecem para o usuário.

---

## 6. Persistência

- ⛔ **Todo acesso a `localStorage` em `try/catch`** — a quota (~5MB) estoura e não pode derrubar o app.
- **Offline-first:** localStorage é cache; **Supabase é a fonte**. Escreva local (síncrono) e faça _push_ em background.
- **Imagens grandes não vão no localStorage** — sobem para o Storage (viram URL) ou IndexedDB (`idb://`).
- ⛔ **Sync nunca apaga em massa.** Remoção no banco é sempre explícita (proteção contra um designer apagar o trabalho de outro).

---

## 6.1 Deploy e cache — o número único

O GitHub Pages serve a branch default (`talpaipai`) e **não deixa configurar cabeçalho
de cache**: a query string dos assets é a única alavanca. Por isso:

> **Todo asset local de `js/` e `css/` carrega o MESMO `?v=N` no `index.html`.
> Mexeu em qualquer um deles? Suba o N em TODOS antes do push:**
> ```
> sed -i 's/?v=9/?v=10/g' index.html
> ```

Por que número único e não por arquivo (decisão do Ryan, 02/09): o esquema por arquivo
foi medido e estava furado — **59 dos 95 assets não tinham `?v=` nenhum**, incluindo
`core/auth.js`, `core/supabase.js`, `core/feature-flags.js` e `modules/franqueado.css`,
e os outros 36 usavam seis números diferentes. Conserto nesses arquivos simplesmente
não chegava em quem já tinha aberto o Luma, e nada na tela denunciava. O custo do
número único é um cache miss geral por deploy (~1MB, num app aberto 1–2× por dia);
o ganho é que a classe de bug "esqueci de bumpar" deixa de existir.

`assets/` fica fora por dois motivos: imagem lá muda de nome, não de conteúdo; e as
libs de `assets/vendor/` são versões pinadas — se trocar uma, troque o **nome do
arquivo**, que é cache-busting de verdade e não depende de ninguém lembrar de nada.

### E o que entra no boot é decisão, não acidente

Medido em 02/09: o boot baixava **4.738 KB** de js+css. Antes de somar arquivo novo à
lista do `index.html`, pergunte se ele precisa estar lá no primeiro acesso. O padrão
para lib pesada atrás de flag é o `gPdfLibPronta()` (no `index.html`): busca sob
demanda, memoiza a promessa e zera em falha de rede. O pdf-lib saiu do boot assim —
513 KB, 11% do total, para um caminho que a maioria das sessões nunca toca.

*Lição registrada, da mesma família da do SQL do Pedro: **correção só está entregue
quando chega no navegador de quem usa** — "commitei" não é "chegou".*

## 7. Testes e verificação — a verdade, sem fingimento

O exemplo _"sempre criar testes"_ merece honestidade: **hoje o Luma não tem testes automatizados nem runner** (é consequência do "sem build"). Fingir que tem é pior que não ter. A regra real é:

- **Verificação manual após cada fase é obrigatória.** Abra o navegador e exercite o fluxo tocado (não só "compilou"). Roteiro mínimo: franqueado gera arte ponta a ponta; designer edita → publica → aparece no catálogo; troca de tema claro/escuro; console sem erro novo.
- **Revisão adversarial** para mudanças de risco: procurar o cenário de falha concreto, não só ler o diff. (Foi assim que a caça a bugs desta base encontrou colisão de ID na publicação, `count` não declarado, clone de simulação, etc.)
- **Aspiração documentada (dívida):** _smoke tests_ do interpolador e do gerador de PNG seriam o maior ganho. **Se for adicionar teste, respeite as 3 leis:** zero dependência, sem build — um HTML de asserts que roda no navegador, não Jest/npm.
- ⛔ **Não invente que "os testes passaram".** Se não rodou, diga que não rodou. Se um passo foi pulado, diga.

---

## 8. Explicar decisões — o "porquê" mora no código

_"Sempre explicar decisões"_ vale à risca — e esta base já faz isso bem:

- **Comentário explica o PORQUÊ, não o quê.** O padrão da casa é comentar a _razão_ e a _armadilha_ ("NÃO trocar para relative: reinsere no fluxo e desloca as outras camadas"). Mantenha esse tom.
- **Decisão de arquitetura/negócio** → registre no `luma-brain` (este conjunto) ou no `docs/LUMA-BACKEND-CHANGELOG.md`. Não deixe só na cabeça.
- **Ao propor mudança grande ou de design:** mostre o que vai mudar e o porquê **antes** de executar.
- **Commits explicam intenção**, em PT-BR, com o "por que". ⛔ **Nunca commit automático** — mostre o `git diff`, peça confirmação, a pessoa roda.

---

## 9. Como adicionar uma feature (o método)

1. **Leia** o `luma-brain` + a seção relevante do `docs/LUMA.md`. Não suponha — consulte.
2. **Ache o(s) 1–2 arquivos** do subdomínio. Se o plano abre >3 arquivos, repense.
3. **Reutilize** os motores únicos (interpolador, render, `gEsc`, tokens). Não clone.
4. **Escreva no idioma da casa:** prefixo certo, `let` global se compartilhado, re-render manual, escape, tokens, `gToast`.
5. **Verifique manualmente** o fluxo tocado no navegador.
6. **Explique** (comentário do porquê + descrição da mudança). Mostre o diff. **Não commite sozinho.**
7. Mexeu em backend? **Changelog + teste das 3 roles.**

---

## 10. Checklist antes de entregar

- [ ] Segue as 3 leis (sem build/ESM, prefixos intactos, patch cirúrgico)?
- [ ] Reutilizou os motores únicos em vez de duplicar?
- [ ] Todo dado de usuário em `innerHTML` passou por `gEsc`/`_dEsc`?
- [ ] Cores/ícones via token/SVG (nada de hex/emoji)?
- [ ] `localStorage` em `try/catch`? Imagem grande no Storage, não no LS?
- [ ] Feedback via `gToast`, copy em PT-BR com o glossário?
- [ ] Estado: `let`, re-render manual, resolvendo por ID (não por referência viva)?
- [ ] Verificou **no navegador** o fluxo tocado? Console limpo?
- [ ] Comentou o **porquê** das decisões não óbvias?
- [ ] Backend: `WITH CHECK`, changelog, 3 roles testadas?
- [ ] Vai mostrar o `git diff` e **não** commitar sozinho?

---

## 11. Anti-padrões (o que NÃO fazer — resumo)

- ❌ `import`/`export`, npm, bundler, framework.
- ❌ Renomear função/ID existente.
- ❌ Segundo interpolador / segundo render / escape "na mão".
- ❌ Hex de cor solto; emoji como ícone de UI.
- ❌ `alert`/`confirm`/`console.log` como feedback.
- ❌ `const` global para estado compartilhado; guardar referência viva de camada.
- ❌ `localStorage` sem `try/catch`; imagem base64 grande no localStorage.
- ❌ Confiar no front para segurança; RLS sem `WITH CHECK`; service role no cliente.
- ❌ `innerHTML` com dado de usuário sem escape.
- ❌ Criar arquivo/abstração "para o futuro" sem uso agora.
- ❌ Dizer que testou sem ter aberto o navegador.
- ❌ Commit automático / `git add .`.

---

## Ver também

- `00_PRODUCT.md` · `01_BUSINESS.md` · `02_ARCHITECTURE.md`
- `docs/LUMA.md` — convenções e inventário técnico completo.
- `docs/LUMA-BACKEND-CHANGELOG.md` — registro de mudanças de backend.
