---
name: luma
description: "Use em QUALQUER tarefa no projeto Luma (creative automation da Delivery Much) — antes de ler, planejar ou mexer em código, CSS, docs ou backend. Fluxo obrigatório: lê o luma-brain, planeja e só então implementa. Gatilhos: editor/Estúdio (designer, canvas, camadas, templates, campos {{}}, publicar), Franqueado (catálogo, chat, gerar arte, PNG/PDF, prévia), Dados/Analytics, CRM Visual, Supabase/RLS, tokens/design system, ou qualquer pedido de mudança/dúvida sobre este repositório."
metadata:
  author: luma
  version: "1.0.0"
---

# Luma — fluxo de trabalho obrigatório

> **Aja como um engenheiro sênior responsável por um sistema frágil, em produção, que você não construiu sozinho.**
> Toda tarefa no Luma passa por três fases, nesta ordem: **1) Lê o luma-brain → 2) Planeja → 3) Implementa.** Não pule fases. Verificar e não commitar sozinho nunca se pulam.

---

## FASE 1 — LÊ o luma-brain (entender antes de mexer)

Antes de escrever ou propor **qualquer** coisa, consulte a pasta `luma-brain/` (a "mente" do projeto). Não suponha — abra e confira.

| Sua dúvida é sobre… | Leia |
|---|---|
| Propósito, público, escopo, o que o Luma NÃO faz | `luma-brain/00_PRODUCT.md` |
| **Regra de negócio**, o que uma entidade significa (campanha, template, permissão, franquia) | `luma-brain/01_BUSINESS.md` |
| Onde algo mora, como as partes conversam, o que NÃO existe | `luma-brain/02_ARCHITECTURE.md` |
| Como escrever/organizar código (as 3 leis) | `luma-brain/03_ENGINEERING.md` |
| Cor, tipografia, componente, layout, tokens | `luma-brain/04_DESIGN_SYSTEM.md` |
| **Como se comportar** (o loop, guardrails, quando perguntar) | `luma-brain/06_OPERATING_SYSTEM.md` |
| Detalhe técnico (função, tabela, policy) | `docs/LUMA.md` |
| O que mudou no backend | `docs/LUMA-BACKEND-CHANGELOG.md` |

**Mínimo para qualquer tarefa:** leia `06_OPERATING_SYSTEM.md` (é o loop) + o arquivo do assunto da tarefa. Para mudança de código, adicione `03_ENGINEERING.md`. Para UI, `04_DESIGN_SYSTEM.md`. Para regra de negócio, `01_BUSINESS.md` — **sempre**.

⛔ **Nunca assuma regra de negócio.** O caso clássico: "criar campanhas" NÃO é ação do franqueado — campanha é uma pasta que agrupa materiais, criada pelo designer/gestão. Sem consultar o `01`, a IA inventa o oposto.

Ordem de autoridade quando algo divergir: **palavra do usuário > código real > luma-brain/docs > conhecimento genérico.** Conselho genérico de fora (use framework, Jest, evite estado global) **quebra** o Luma — ver `03_ENGINEERING.md`.

---

## FASE 2 — PLANEJA

Com o contexto na mão, antes de codar:

1. **Resultado, não pedido literal:** o que o usuário realmente quer que aconteça?
2. **Arquitetura confere?** Não proponha solução para camada que não existe (sem servidor de aplicação, sem build, sem multi-tenant; RLS é a única fronteira de segurança).
3. **Mapeie os 1–2 arquivos.** Se o plano abre mais de 3 arquivos, quase sempre há caminho mais simples — repense.
4. **Grep antes de criar.** Ache o motor único que já existe (há UM interpolador, UM render, UM `gEsc`). Reutilizar/estender, nunca clonar.
5. **Confirme antes de executar** quando a mudança for grande, de design/estética, ou irreversível — mostre o plano (para redesign visual, uma proposta/mockup antes de tocar no código).

---

## FASE 3 — IMPLEMENTA

- **Patch cirúrgico.** Adicione sem quebrar; `f*` e `d*` não regridem; toque o mínimo.
- **Idioma da casa:** prefixos sagrados (`f*` `d*` `g*` `p*` — nunca renomear), `let` global só se compartilhado + re-render manual, **sem** `import`/`export`/npm/build.
- **Não duplique** — reutilize os motores únicos.
- **Estado por ID, não por referência viva** (undo/sim/sync trocam objetos por clones).
- **Segurança e marca são regra:** `gEsc`/`_dEsc` em todo dado de usuário; cor/radius/motion via **token** (nunca hex solto); ícone = SVG `currentColor` (nunca emoji); feedback só via `gToast`; `localStorage` sempre em `try/catch`.
- **Comente o PORQUÊ** (a razão e a armadilha), não o quê.

Depois de implementar:

- **VERIFIQUE no navegador** o fluxo tocado — "compilou" não é verificação. Não há teste automatizado; a verificação manual é obrigatória. Ao corrigir bug, **confirme o achado na fonte antes** (plausível ≠ real).
- **EXPLIQUE o impacto:** o que muda, o que pode regredir, o que ficou de fora. Recomende (não faça menu de opções).
- **DOCUMENTE** se mudou algo estrutural: atualize o `luma-brain`/`docs/LUMA.md`; backend → `docs/LUMA-BACKEND-CHANGELOG.md` + teste as 3 roles.
- ⛔ **NUNCA commite sozinho. Nunca `git add .`.** Mostre o `git diff`, peça confirmação.

---

## Quando parar e perguntar

- Dúvida de **negócio ou gosto** (regra ambígua, direção de design, trade-off de produto) → **pergunte, não invente.**
- Dúvida **técnica** (como algo funciona) → **vá ao código e descubra.**
- Ação **destrutiva/irreversível** não autorizada → confirme antes.
- No modo autônomo, não trave pedindo permissão para o trivial: decida o razoável, faça, e diga o que decidiu.

---

## Economia de uso (enxugar o gasto)

O que mais consome limite aqui: **subagentes em paralelo**, **contexto alto (>150k)** e **sessões longas**. Trabalhe enxuto:

- **Subagente só quando a tarefa pede escala de verdade.** Investigação pontual ou de 1–2 arquivos → leia você mesmo, direto. Reserve fan-out de subagentes (ex.: auditoria ampla) pra quando o usuário pediu amplitude — e **confirme o escopo antes** pra rodar uma vez, certo (rodar de novo custa dobrado).
- **Leia só a fatia que precisa.** Use `offset`/`limit` e `grep` mirado em vez de abrir arquivos de 1000+ linhas inteiros. Localize com busca, depois leia o trecho.
- **Não re-leia o que acabou de editar** nem re-verifique o que o Edit já garante. A ferramenta erra se a edição falhar — confie. Agrupe chamadas independentes num turno só.
- **Verificação enxuta.** Cheque a lógica/DOM no ponto tocado em vez de reconstruir harness gigante; reuse o servidor local já no ar em vez de reiniciar; screenshot só quando o visual é o alvo.
- **Sessão longa fica cara** (contexto alto encarece cada request). Terminou um assunto? **Abra sessão nova** pro próximo — começa leve. Evite arrastar uma sessão por muitas tarefas distintas.
- **Patch cirúrgico também é economia:** menos arquivos tocados = menos leitura, menos verificação, menos contexto.

> O detalhe completo de cada regra está em `luma-brain/`. Esta skill é o ponto de entrada; a profundidade mora lá. Toda lição nova de comportamento entra em `06_OPERATING_SYSTEM.md`.
