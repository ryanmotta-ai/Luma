# motion.md — Diretrizes de Animação e Movimento (Motion) do Luma

> **A Regra de Ouro:** O movimento no Luma serve para dar fisicalidade, guiar o foco e acelerar a velocidade percebida. Animações lentas ou meramente decorativas são proibidas.

---

## 1. Constantes Técnicas (Tokens)

Toda animação deve utilizar as seguintes durações e curvas de atenuação definidas em `css/00-tokens.css`:

### Durações
* `--dur-micro`: `140ms` (Reações instantâneas, micro-estados, hover de botões/links)
* `--dur-fast`: `180ms` (Transições simples, abertura de dropdowns, hovers de cards grandes)
* `--dur-base`: `260ms` (Transições de layout, movimentação de painéis laterais/sidebars)
* `--dur-slow`: `420ms` (Grandes áreas, heros de página, entradas de canvas complexos)

### Curvas de Atenuação (Easing)
* `--ease-standard`: `cubic-bezier(0.4, 0, 0.2, 1)` (Movimentos gerais dentro da tela)
* `--ease-out`: `cubic-bezier(0, 0, 0.2, 1)` (Entrada de elementos na tela — rápido no início, amortece no fim)
* `--ease-in`: `cubic-bezier(0.4, 0, 1, 1)` (Saída de elementos da tela — acelera no fim)
* `--ease-spring`: `cubic-bezier(0.34, 1.56, 0.64, 1)` (Pop elástico de botões, cards ou badges)
* `--ease-spring-soft`: `cubic-bezier(0.175, 0.885, 0.32, 1.1)` (Movimento elástico suave para containers)

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
