# CLAUDE.md — Projeto Luma

> Instruções permanentes do projeto (carregadas em toda sessão, valem para **todo prompt**).

## Regra nº 1 — rode o fluxo Luma em toda tarefa

Para **qualquer** pedido neste repositório (código, CSS, docs, backend, dúvida, análise), siga a skill **`luma`** — o fluxo obrigatório em três fases:

1. **Lê o `luma-brain/`** (a mente do projeto) — entender antes de mexer.
2. **Planeja** — resultado esperado, arquitetura, os 1–2 arquivos, reutilizar o que já existe.
3. **Implementa** — patch cirúrgico → explica o impacto → mostra o diff. Verificar no navegador é recomendado quando possível, mas não é bloqueante para dar a tarefa por concluída.

Se a skill `luma` estiver disponível, invoque-a. Se não, siga o fluxo manualmente lendo `luma-brain/06_OPERATING_SYSTEM.md` (o loop de operação) + o arquivo do assunto.

## Regra nº 2 — modos sempre ativos (todo prompt)

Junto do fluxo Luma, carregue **sempre** estas duas skills vendorizadas em `.claude/skills/`
(procedência e commits em `.claude/skills/VENDORED.md`):

| Skill | Nível | O que governa |
|---|---|---|
| **`ponytail`** | **full** | *O que você constrói.* A escada YAGNI: o recurso precisa existir? já tem no código? o nativo resolve? menor diff que funciona. |
| **`caveman`** | **lite** | *Como você fala.* Sem enrolação, sem hedging — mas mantendo artigos e frases completas. Profissional e enxuto. |

Elas valem em toda resposta, sem precisar ser pedidas. Desligar: **"stop ponytail"** / **"stop caveman"** / **"normal mode"**. Trocar de nível: `/ponytail lite|full|ultra`, `/caveman lite|full|ultra`.

⛔ **Precedência em caso de conflito:** a ordem de autoridade não muda — **palavra do usuário > código real > CLAUDE.md/luma-brain > skill importada > genérico.** Onde as duas skills contrariarem o Luma, **o Luma vence**. Os choques conhecidos:

- **Teste automatizado:** ponytail pede deixar um `test_*.py`/self-check para lógica não-trivial. Aqui o formato é outro: **existe** runner (`scripts/run-browser-tests.js`, suítes em `tests/*.html`, zero dependência), então caso novo de solver/PSD entra numa suíte que já existe — **nunca** um `test_*.py`, nunca Jest/npm, nunca arquivo de teste solto. Para todo o resto, a verificação é **manual no navegador** (`03_ENGINEERING.md` §7).
- **Idioma:** caveman preserva o idioma dominante; no Luma é sempre **PT-BR**.
- **Dependências/stdlib:** ponytail sobe a escada até uma lib já instalada — no Luma o teto é **vanilla JS, zero dependência nova, sem build/ESM**.
- **Prosa que o usuário pediu** (relatório, plano, passo a passo) não é dívida: entregue completa. O corte vale para prosa não solicitada.
- Caveman já se desliga sozinho em **aviso de segurança e confirmação de ação irreversível** — o que casa com o "nunca commit automático, confirme antes" daqui.

## Atalhos de leitura do `luma-brain/`

- **`MAPA.md` — LEIA PRIMEIRO, antes de qualquer `grep`/`read`.** Diz em que arquivo mora cada coisa (67 arquivos JS, 53 mil linhas, 2.131 funções), onde estão os motores únicos e **quais docs deste repositório não ler**. É gerado por `node scripts/mapa.js` a partir dos cabeçalhos do próprio código, e o hook de cada prompt o mantém em dia.

- `00_PRODUCT.md` — o que é o Luma, público, escopo.
- `01_BUSINESS.md` — **regras de domínio** (nunca assuma regra de negócio; consulte).
- `02_ARCHITECTURE.md` — como o sistema é dividido; o que NÃO existe.
- `03_ENGINEERING.md` — as 3 leis do código (sem build/ESM, prefixos sagrados, patch cirúrgico).
- `04_DESIGN_SYSTEM.md` — tokens, cores, componentes.
- `05_DESIGN_PHILOSOPHY.md` — **filosofia de design** (valores, o que deve/não deve parecer).
- `design-system.md` — **regras de design** (tipografia, radius, cores, componentes).
- `references.md` — **referências de design** (produtos inspiradores, hierarquia).
- `design-process.md` — **processo de design** (como o Claude deve planejar interfaces).
- `ux-principles.md` — **princípios de UX** (leis de UX, tratamentos de erro, acessibilidade).
- `motion.md` — **animações e movimento** (hovers, focus, skeletons, easings).
- `design-review.md` — **revisão de design** (checklist de auto-revisão e proibitivos).
- `design-role.md` — **papel de design** (Principal Product Designer).
- `06_OPERATING_SYSTEM.md` — **como se comportar** (o loop, guardrails, quando perguntar).
- `07_ROADMAP.md` — **roadmap oficial da v1** (fases, bugs com file:line, decisões abertas; atualize os checks ao concluir itens).
- Técnico detalhado: `docs/LUMA.md`. Backend: `docs/LUMA-BACKEND-CHANGELOG.md`.
- **Academia** (formação do franqueado, prefixo `ac*`): `docs/LUMA-ACADEMIA.md`.

## Inegociáveis (resumo — detalhe no luma-brain)

- **Ordem de autoridade:** palavra do usuário > código real > luma-brain/docs > genérico. Conselho genérico de fora que contradiz o Luma **está errado aqui**.
- Vanilla JS, **sem build, sem ES Modules, sem dependências novas**. Funções globais, prefixos (`f*` `d*` `g*`) **nunca** renomeados.
- **Patch cirúrgico**; `f*`/`d*` não regridem; a maioria das features toca 1–2 arquivos.
- **RLS é a única fronteira de segurança** — nada de segurança no front; sem segredo hardcoded.
- Escape (`gEsc`/`_dEsc`) em todo dado de usuário; cor/motion via **token**; feedback via `gToast`; ícone = SVG (não emoji).
- **Existe teste automatizado, estreito:** `node scripts/run-browser-tests.js` (119 casos, portão de CI) cobre o solver de Auto-layout e o importador de PSD — rode ao tocar nesses dois. O resto (interpolador, PNG, chat, catálogo, Estúdio, UI) não tem cobertura. Verificar no navegador é recomendado ("compilou" não é verificação), mas não é obrigatório para concluir a tarefa.
- **Nunca commit automático. Nunca `git add .`** — mostre o `git diff`, peça confirmação.
- **PT-BR** na comunicação e na copy.
- Dúvida de **negócio/gosto → pergunte**; dúvida **técnica → vá ao código**.
