# CLAUDE.md — Projeto Luma

> Instruções permanentes do projeto (carregadas em toda sessão, valem para **todo prompt**).

## Regra nº 1 — rode o fluxo Luma em toda tarefa

Para **qualquer** pedido neste repositório (código, CSS, docs, backend, dúvida, análise), siga a skill **`luma`** — o fluxo obrigatório em três fases:

1. **Lê o `luma-brain/`** (a mente do projeto) — entender antes de mexer.
2. **Planeja** — resultado esperado, arquitetura, os 1–2 arquivos, reutilizar o que já existe.
3. **Implementa** — patch cirúrgico → verifica no navegador → explica o impacto → mostra o diff.

Se a skill `luma` estiver disponível, invoque-a. Se não, siga o fluxo manualmente lendo `luma-brain/06_OPERATING_SYSTEM.md` (o loop de operação) + o arquivo do assunto.

## Atalhos de leitura do `luma-brain/`

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
- Técnico detalhado: `docs/LUMA.md`. Backend: `docs/LUMA-BACKEND-CHANGELOG.md`.

## Inegociáveis (resumo — detalhe no luma-brain)

- **Ordem de autoridade:** palavra do usuário > código real > luma-brain/docs > genérico. Conselho genérico de fora que contradiz o Luma **está errado aqui**.
- Vanilla JS, **sem build, sem ES Modules, sem dependências novas**. Funções globais, prefixos (`f*` `d*` `g*` `p*`) **nunca** renomeados.
- **Patch cirúrgico**; `f*`/`d*` não regridem; a maioria das features toca 1–2 arquivos.
- **RLS é a única fronteira de segurança** — nada de segurança no front; sem segredo hardcoded.
- Escape (`gEsc`/`_dEsc`) em todo dado de usuário; cor/motion via **token**; feedback via `gToast`; ícone = SVG (não emoji).
- **Verifique no navegador** — não há teste automatizado; "compilou" não é verificação.
- **Nunca commit automático. Nunca `git add .`** — mostre o `git diff`, peça confirmação.
- **PT-BR** na comunicação e na copy.
- Dúvida de **negócio/gosto → pergunte**; dúvida **técnica → vá ao código**.
