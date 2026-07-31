# motion.md — Diretrizes de Animação e Movimento (Motion) do Luma

> **A Regra de Ouro:** O movimento no Luma serve para dar fisicalidade, guiar o foco e acelerar a velocidade percebida. Animações lentas ou meramente decorativas são proibidas.

---

## 1. Constantes Técnicas (Tokens)

Toda animação deve utilizar as seguintes durações e curvas de atenuação definidas em `css/00-tokens.css`:

> ⚠️ **Correção (2026-07-31):** os valores de easing listados aqui estavam **errados** —
> eram os do Material Design, não os do Luma. O `00-tokens.css` é a fonte da verdade
> (04_DESIGN_SYSTEM §0) e foi o que venceu. Abaixo, os valores REAIS do código.

### Durações
* `--dur-micro`: `140ms` (Reações instantâneas, micro-estados, hover de botões/links)
* `--dur-fast`: `180ms` (Transições simples, abertura de dropdowns, hovers de cards grandes)
* `--dur-base`: `260ms` (Transições de layout, movimentação de painéis laterais/sidebars)
* `--dur-slow`: `420ms` (Grandes áreas, heros de página, entradas de canvas complexos)
* `--dur-celebration`: `720ms` (**único degrau acima do slow** — momento de conquista:
  conclusão de módulo, splash de formação. ⛔ Nunca em UI cotidiana: 720ms num hover
  é lentidão, não elegância. Acrescentado pela Academia em 2026-07-31.)

### Curvas de Atenuação (Easing) — valores reais de `00-tokens.css`
* `--ease-standard`: `cubic-bezier(.2,.9,.4,1)` (Movimentos gerais dentro da tela)
* `--ease-out`: `cubic-bezier(.16,1,.3,1)` (Entrada de elementos na tela — amortece no fim)
* `--ease-in`: `cubic-bezier(.5,0,.9,.4)` (Saída de elementos da tela — acelera no fim)
* `--ease-spring`: `cubic-bezier(.34,1.56,.64,1)` (Pop elástico de botões, cards ou badges)
* `--ease-spring-soft`: `cubic-bezier(.22,1.2,.36,1)` (Movimento elástico suave para containers)

### Duração e curva DENTRO do JavaScript
⛔ **Nunca escreva ms nem cubic-bezier em JS** — é o mesmo erro que hex solto no CSS.
A Academia resolveu com dois leitores de token (`js/academia/motion.js`):

```js
acDur('base')   // → 260 (lê --dur-base; devolve 0 em prefers-reduced-motion)
acEase('out')   // → cubic-bezier(.16,1,.3,1)
```

Precisa animar por JS em outro módulo? Use o mesmo padrão em vez de duplicar valores.

---

## 2. Padrões de Interação e Estados

### 🖱️ Hover
* **Botões CTAs e Ações Primárias:**
  * *Efeito:* Elevação sutil (`translateY(-2px)`), incremento leve de contraste/brilho (`filter: brightness(1.05)`) e sombra difusa colorida com o acento do botão (laranja no primário).
  * *CSS:* `transition: transform var(--dur-micro) var(--ease-spring), box-shadow var(--dur-micro) var(--ease-spring), filter var(--dur-micro) var(--ease-standard);`
* **Cards de Campanha:**
  * *Efeito:* Elevação de `5px` (`translateY(-5px)`), borda destacada em laranja, e sombra suave e colorida da marca.
  * *CSS:* `transition: transform var(--dur-fast) var(--ease-spring-soft), border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-spring-soft);`

### ⌨️ Focus
* **Outline de Foco:**
  * *Efeito:* O outline de foco deve surgir de forma expandida para o seu estado final com uma transição suave de escala e opacidade.
  * *CSS:* `box-shadow: 0 0 0 3px rgba(255, 144, 0, 0.12); transition: box-shadow var(--dur-micro) var(--ease-standard);`

### ⏳ Loading e Progresso
* **Shimmer de Skeletons:**
  * Animação horizontal contínua de um gradiente linear sutil de cinza/neutro.
  * *CSS:*
    ```css
    @keyframes gShimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .skeleton {
      background: linear-gradient(90deg, var(--gray-light) 25%, var(--gray-mid) 50%, var(--gray-light) 75%);
      background-size: 200% 100%;
      animation: gShimmer 1.5s infinite linear;
    }
    ```
* **Indicadores de Processamento (Spinners/Dots):**
  * Spinners circulares ou três pontos pulsantes que entram de forma elástica, giram em loop e desaparecem sutilmente com fade.
  * *CSS:*
    ```css
    @keyframes gSpin {
      100% { transform: rotate(360deg); }
    }
    .spinner {
      animation: gSpin 0.8s infinite linear;
    }
    ```

### 📦 Skeletons
* **A Regra:** O skeleton deve imitar fielmente a forma física do componente que está substituindo (cards de imagem devem carregar um bloco de skeleton de mesma proporção, linhas de texto devem carregar barras de altura correspondente).
* **Animação de Pulso de Opacidade:** Skeletons de texto simples usam variação suave de opacidade (`0.6` a `1.0`) em vez de shimmer para evitar fadiga visual.
* *CSS:*
  ```css
  @keyframes gPulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  .skeleton-text {
    animation: gPulse 1.2s infinite ease-in-out;
  }
  ```

### 🔁 Transitions Gerais de Estado
* Toda modificação visual via JavaScript ou hover deve ser acompanhada de uma transição suave.
* **Transição de Tema (Claro/Escuro):** Cores de fundo e superfícies devem mudar com transição suave de `200ms` para evitar piscar de tela agressivo.
* **Dropdowns e Menus:**
  * *Efeito:* Entrada via `gFadeInUp` (opacidade de `0` para `1` e translação para cima de `8px`).
  * *CSS:* `animation: gFadeInUp var(--dur-fast) var(--ease-out) forwards;`

---

## 3. Respeito às Preferências do Usuário (Acessibilidade)

Toda animação estrutural ou decorativa que possa causar distração ou enjoo visual deve respeitar a preferência de acessibilidade `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
> **Nota:** Em modo de redução de movimento, as animações elásticas ou translações são anuladas, mantendo-se apenas transições imediatas de opacidade (`fade`).

⛔ **A regra que não se viola: remover o MOVIMENTO, nunca a informação.** Coreografia
que revela conteúdo em etapas (ex.: a splash de conclusão da Academia) tem de mostrar
**tudo de uma vez** nesse modo — e não pode depender do JS para revelar, senão o
conteúdo fica invisível para sempre. O padrão da casa:

```css
@media (prefers-reduced-motion: reduce){
  [data-passo]{ opacity:1!important; transform:none!important }  /* estado final imediato */
  .ac-conc-pular{ display:none }                                 /* sem animação, nada a pular */
}
```

---

## 4. Padrões de motion FUNCIONAL (o que cada movimento resolve)

Motion sem função é decoração — e decoração é o que este arquivo proíbe. Os padrões
que a Academia consolidou, cada um resolvendo um problema medido no navegador:

| Padrão | O problema que resolve |
|---|---|
| **Cascata de entrada** (atraso de 30ms por bloco, teto de 6) | A tela aparecia inteira de uma vez. A estrutura entra na hora; só o conteúdo escalona. |
| **Progresso que percorre** | O valor era escrito inline e a barra/anel nascia pronta: a transição CSS não tinha de onde partir. Agora o render pinta o valor ANTERIOR e o JS leva até o atual. |
| **Altura real no acordeão** | `display:none → block` fazia o layout saltar e sumia com as aulas que a pessoa estava olhando. Mede-se o conteúdo, anima-se até o número e devolve-se `auto`. |
| **Crossfade de troca** | Substituir `innerHTML` piscava. Saída rápida (`--dur-micro`), entrada suave (`--dur-fast`), altura mínima preservada durante a troca. |
| **Pulso de confirmação** | "Concluí, e aí?" — o item que mudou pulsa uma vez e a classe é removida. Estado permanente de animação vira árvore de natal. |
| **Anexar só o que é novo** | Re-renderizar uma lista re-anima tudo. No chat, só a bolha nova recebe a classe de entrada. |

⚠️ **Rolagem automática é interrupção, não ajuda.** Só desça até o fim se a pessoa
já estava no fim; se ela subiu para reler, preserve a posição e ofereça um botão de
volta (`acAgenteRolar`).
