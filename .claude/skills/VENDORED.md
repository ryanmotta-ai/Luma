# Skills vendorizadas (origem externa)

Copiadas na mão (só o `SKILL.md`, sem scripts/instaladores). Para atualizar, rebaixe o
mesmo caminho do upstream e confira o diff antes — elas mudam o comportamento de TODO prompt.

| Skill | Origem | Commit | Licença |
|---|---|---|---|
| `caveman/` | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) · `skills/caveman/SKILL.md` | `e2c09c9a7e66` | MIT |
| `ponytail/` | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) · `skills/ponytail/SKILL.md` | `b6c04480c03e` | MIT |

Baixadas em 2026-07-27. Níveis em uso no Luma: **caveman = lite**, **ponytail = full**
(ver `CLAUDE.md` → "Modos sempre ativos").

Os repositórios trazem sub-skills que **não** foram instaladas de propósito: `caveman-compress`
(scripts Python), `cavecrew`, `caveman-commit/review/stats/help` e `ponytail-audit/debt/gain/
review/help`. Instale sob demanda, revisando o conteúdo — `caveman-compress` executa código.
