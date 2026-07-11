# design-review.md — Manual de Revisão de Design do Luma

> **Aviso Importante:** Este documento é uma ferramenta de auditoria visual obrigatória para o Claude. Antes de entregar qualquer interface ou alteração visual ao usuário, você deve rodar a auto-revisão descrita aqui, dar uma nota matemática sincera e refatorar se a nota for menor que `9.5`.

---

## 1. O Grid de Avaliação (Auto-Revisão)

Avalie sua proposta visual atribuindo uma nota de `0.0` a `10.0` em cada um dos seguintes critérios:

| Critério | O que avaliar | Nota (0-10) |
|---|---|---|
| **Hierarquia** | O herói da tela é óbvio? Elementos secundários e terciários estão visualmente abaixo do principal? | |
| **Espaçamento** | O layout respira? As margens e paddings seguem múltiplos de 4px e usam clamp() fluido em vitrines? | |
| **Tipografia** | O uso de Roboto 900 (Black) nos títulos cria contraste de peso com o corpo? O letter-spacing em caixas-altas foi aplicado? | |
| **Contraste** | Todos os textos atendem às razões WCAG AA-large? O texto em CTAs pequenos usa `--dm-orange-d` em vez de `#FF9000`? | |
| **Componentização** | Os componentes são limpos, focados, reutilizáveis e usam propriedades existentes? | |
| **Acessibilidade** | `:focus-visible` está nítido com outline de 2px e offset? O HTML é semântico? | |
| **Responsividade** | A tela se adapta perfeitamente do mobile a monitores ultrawide sem larguras rígidas ou quebras? | |
| **Microinterações** | Hovers elásticos, transições de estado e motion estão polidos e fluidos? | |
| **Consistência** | O layout herda os padrões visuais e comportamentais do resto do Luma? | |
| **Escaneabilidade** | O usuário consegue ler a tela em 3 segundos e entender onde clicar ou o que preencher? | |
| **Design Premium** | A interface passa a sensação de software moderno e polido no nível de Linear ou Stripe? | |

### ⛔ Regra de Ouro da Nota
> Se a média aritmética de suas notas for **menor que 9.5**, a interface está **reprovada**. Você deve refatorar o código visual e de layout imediatamente, sem entregar ao usuário uma solução mediana.

---

## 2. O que o Luma NUNCA pode ter (Lista de Proibições)

Para evitar que a IA caia em padrões de design genéricos e simplórios de mercado, as seguintes práticas são **estritamente proibidas**:

* **❌ Não usar cards enormes:** Cards de conteúdo não devem ter dimensões exageradas que tomem a tela sem necessidade. A densidade de conteúdo deve ser elegante e equilibrada.
* **❌ Não usar muito cinza:** O tema escuro usa pretos ricos (`--d-bg: #111`) e variações de superfícies discretas (`--d-surf`). O tema claro usa off-white e cinzas extremamente suaves. Tons cinza puros e opacos de softwares legados são proibidos.
* **❌ Não usar muito branco vazio:** "Respiro" é bom, mas o excesso de grandes blocos vazios sem uma âncora visual dá a sensação de layout inacabado. Use espaçamento dinâmico proporcional com `clamp()`.
* **❌ Não usar botões gigantes:** Botões CTAs devem ter tamanhos refinados, paddings proporcionais (como `7px 16px`) e peso visual elegante. Nada de botões que pareçam de aplicativos infantis.
* **❌ Não usar inputs sem hierarquia:** Inputs devem ter labels claros em caixa-alta discretos, bordas suaves de contraste e estado de foco impecável. Nunca use inputs com bordas pretas grossas ou sem estados de interação.
* **❌ Não usar Bootstrap, Material Design ou Tailwind padrão:** O Luma tem uma identidade de marca própria inspirada em sofisticação e minimalismo (Delivery Much). O visual genérico de componentes do Bootstrap ou cards gigantes azuis/cianos do Material Design quebra completamente o produto. Tailwind só pode ser usado se expressamente requisitado e com a versão configurada em tokens do Luma.
* **❌ Não usar gradientes exagerados:** O gradiente sutil de laranja da topbar (`#FF9400 → #FA8200`) e de CTAs é elegante. Gradientes multicoloridos (ex: roxo para azul, arco-íris) ou contrastes agressivos de gradiente são proibidos.
* **❌ Não usar sombras pesadas:** Sombras não devem ser pretas puras de opacidade alta. O Luma usa sombras extremamente difusas (`rgba(0,0,0, 0.08)`) no repouso e sombras coloridas leves de marca no hover.
* **❌ Não usar radius inconsistente:** Misturar cantos retos com arredondados aleatoriamente é proibido. Siga estritamente `--r` (10px), `--r-sm` (6px) e `--r-pill` (999px).
* **❌ Não usar tipografia pequena:** Textos corporais com menos de `12px` são proibidos (exceto micro badges de 9-10px em caixa-alta bold). Garanta a legibilidade.
* **❌ Não usar layout apertado:** Elementos colados sem margens consistentes ou containers espremidos são proibidos. Utilize a escala de espaçamento de múltiplos de 4px.
* **❌ Não usar componentes desalinhados:** Garanta o alinhamento central vertical (`align-items: center`) de ícones com textos, alinhamento consistente à esquerda ou direita em grelhas e bordas uniformes em toda a página.
