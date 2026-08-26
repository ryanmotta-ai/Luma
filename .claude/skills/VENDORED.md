# Skills vendorizadas (origem externa)

Copiadas na mão (só o `SKILL.md`, sem scripts/instaladores). Para atualizar, rebaixe o
mesmo caminho do upstream e confira o diff antes — elas mudam o comportamento de TODO prompt.

| Skill | Origem | Commit | Licença |
|---|---|---|---|
| `caveman/` | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) · `skills/caveman/SKILL.md` | `e2c09c9a7e66` | MIT |
| `ponytail/` | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) · `skills/ponytail/SKILL.md` | `b6c04480c03e` | MIT |
| `impeccable/` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) · `.claude/skills/impeccable/` **inteiro** | `63b04e2530f5` | Apache 2.0 |

Baixadas em 2026-07-27. Níveis em uso no Luma: **caveman = lite**, **ponytail = full**
(ver `CLAUDE.md` → "Modos sempre ativos").

Os repositórios trazem sub-skills que **não** foram instaladas de propósito: `caveman-compress`
(scripts Python), `cavecrew`, `caveman-commit/review/stats/help` e `ponytail-audit/debt/gain/
review/help`. Instale sob demanda, revisando o conteúdo — `caveman-compress` executa código.

---

## `impeccable` (design de frontend) — baixada em 2026-08-19, v4.1.2

**Exceção à regra do topo: aqui vieram os scripts também.** Caveman e ponytail são só prompt;
esta não é. O `Setup` do `SKILL.md` manda rodar `scripts/context.mjs` e carregar
`reference/*.md` — copiar só o `SKILL.md` entregaria uma skill que quebra na primeira
linha. São 36 referências e 107 scripts (3,6MB).

**Auditoria feita antes de instalar** (o motivo de a regra existir):
- **Zero dependência externa** — os scripts importam só `node:*`. Os `import 'react'`/`'svelte'`
  que aparecem no grep estão DENTRO de templates de código que o modo `live` gera, não são
  dependências da skill. Não há `package.json`, `postinstall`, `curl` nem `eval`.
- **Rede:** um `GET https://impeccable.style/api/version` (checagem de versão, com timeout e
  não-fatal). Nenhum dado do projeto sai. Desligar: `IMPECCABLE_NO_UPDATE_CHECK=1`.
- **Fora do projeto** escreve só cache de versão em `~/.impeccable/`.
- `spawn()` em 3 pontos (navegador do modo `live` e do detector).

**Não é modo sempre ativo.** Diferente de caveman/ponytail, entra por invocação:
`/impeccable [comando] [alvo]`. A tabela de comandos está no `SKILL.md`.

⛔ **Onde ela contraria o Luma — e o Luma vence** (`CLAUDE.md`, ordem de autoridade):

| A skill diz | No Luma | Por quê |
|---|---|---|
| `overused-font: Roboto` "não é distintiva" | **Roboto fica** | É a fonte da marca Delivery Much (`04_DESIGN_SYSTEM.md`). Trocar fonte por conselho de detector é peça fora da marca. |
| `bounce-easing` é "datado e vulgar" | **`--ease-spring*` fica** | O overshoot é decisão registrada em `luma-brain/motion.md` para pops e modais. |
| Contexto vive em `PRODUCT.md` / `DESIGN.md` | **A verdade é o `luma-brain/`** | Rodar `/impeccable init` criaria um segundo lugar de verdade sobre o produto. Se um dia for útil, gerar apontando para o `luma-brain`, nunca duplicando. |

⚠️ **Dois comandos escrevem no projeto e não foram acionados:** `hooks on` (instala hook que
roda o detector a cada edição de UI) e `pin` (cria atalho `/<comando>`). Decisão do Ryan, não
automática.

**Achados reais do detector no Luma** (rodado em `css/modules/video.css` na instalação): além
dos dois choques acima, apontou `transition: width` na barra de progresso da exportação —
esse é legítimo (animar largura causa layout thrash; `transform: scaleX()` resolve).

Como rodar o detector direto, sem a skill:
```
node .claude/skills/impeccable/scripts/detector/detect-antipatterns.mjs <arquivo|dir|url>
```
