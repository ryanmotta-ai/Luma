# design-system.md — Regras de Design do Luma

> **Importante:** Este arquivo contém apenas regras e especificações técnicas obrigatórias. Sem explicações redundantes ou rodeios conceituais. Siga estas regras à risca em toda implementação visual.

---

## 1. Cores e Contraste
Toda cor deve utilizar tokens do `css/00-tokens.css`. Hexadecimais puros são proibidos.

### Marca e Acentos
* `--dm-orange`: `#FF9000` (Somente para acentos de exibição e elementos decorativos grandes)
* `--dm-orange-d`: `#F85400` (Uso obrigatório para fundos de botões/CTAs que contenham texto branco pequeno para garantir contraste AA-large)
* `--dm-red`: `#C81818` (Preços, alertas, badges de gestão, perigo)
* `--dm-yellow`: `#FFB900` (Badges de equipe, avisos)

### Neutros (Tema Claro / Franqueado)
* `--white`: `#FFFFFF`
* `--off-white`: `#FAFAFA`
* `--gray-light`: `#F2F2F2`
* `--gray-mid`: `#D4D4D4`
* `--text`: `#0A0A0A`
* `--text-2`: `#3A3A3A`
* `--text-3`: `#6B6B6B`

### Superfícies (Tema Escuro / Designer)
* `--d-bg`: `#111111`
* `--d-dark`: `#1A1A1A`
* `--d-surf`: `#222222`
* `--d-surf2`: `#2A2A2A`
* `--d-surf3`: `#333333`
* `--d-border`: `rgba(255, 255, 255, 0.08)`
* `--d-border2`: `rgba(255, 255, 255, 0.14)`
* `--d-text`: `#F0F0F0`
* `--d-text2`: `#A0A0A0`
* `--d-text3`: `#8A8A8A`

### Semânticos por Tema
* **Texto de Sucesso:** `--green-text` (`#22C55E` no escuro / `#15803D` no claro)
* **Texto de Variável/Campos:** `--var-color` (`#FFB900` no escuro / `#8A6500` no claro)
* **Fundo de Variável:** `--var-bg` (`rgba(255, 185, 0, 0.12)`)

---

## 2. Tipografia (Roboto)
O Luma utiliza a fonte **Roboto**. 
* **Roboto Black (font-weight: 900):** Títulos da marca e realces.
* **Escala de Tamanhos e Pesos:**
  * **Display/Hero:** `clamp(26px, 3.5vw, 40px)` | `weight: 900` (Títulos de vitrine)
  * **Título Seção:** `20px` a `22px` | `weight: 900`
  * **Corpo Forte:** `14px` a `15px` | `weight: 700`
  * **Corpo Geral:** `13px` a `14px` | `weight: 400` ou `500`
  * **Meta/Label:** `11px` a `12px` | `weight: 500` ou `700` (Em UPPERCASE com `letter-spacing: 0.08em`)
  * **Nano Badge:** `9px` a `10px` | `weight: 700` (Uppercase)

---

## 3. Radius
* `--r`: `10px` (Cards, inputs, superfícies padrão)
* `--r-sm`: `6px` (Botões padrão, chips retangulares)
* `--r-pill`: `999px` (Filtros, tags, badges, CTAs arredondados)
* **Exceções:** `7px` a `9px` para elementos muito densos no Estúdio; `12px` a `16px` para cards de vitrine de destaque.

---

## 4. Espaçamento
* **Escala Padrão (px):** `4` | `6` | `8` | `10` | `12` | `14` | `16` | `20` | `24` | `32` | `40`
* **Gaps de Layout:** `8px` a `16px` entre itens correlatos; `18px` a `24px` entre seções.
* **Padding Lateral de Página (Vitrine):** `padding: clamp(24px, 4.2vw, 96px)` (Garante que a tela respire em resoluções altas).
* **Paddings de Componentes:**
  * **Botões padrão:** `7px 16px`
  * **Inputs:** `8px 12px` ou `13px`
  * **Cards:** `8px 12px`

---

## 5. Grid e Layout
* **Grelha de Vitrine:** Sempre dinâmica e responsiva:
  `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`
* **Responsividade:** Proibido o uso de larguras estáticas fixas (`width: 320px`, etc.) em layouts principais. Utilize `clamp()`, porcentagens ou `flex-grow`.

---

## 6. Elevação e Sombras
* **Cards em Repouso:** `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08)`
* **Hover de Cards/CTAs:** `transform: translateY(-3px)` + `box-shadow: 0 12px 36px rgba(248, 84, 0, 0.2)` (sombra colorida com tom laranja)
* **Topbar e Sticky Header:** Efeito vidro:
  `background: var(--glass-bg)` | `backdrop-filter: var(--glass-blur)` | `box-shadow: var(--glass-shadow)`

---

## 7. Componentes
* **Botão Primário:** Fundo `--dm-orange-d`, texto branco, `--r-sm`, `weight: 600`.
* **Chips de Filtro:** `--r-pill`, borda fina. Estado ativo = Fundo `rgba(255, 144, 0, 0.12)`, borda `--dm-orange`, texto `--dm-orange-d`.
* **Inputs:** Borda `--gray-mid` (ou `--d-border2`), `--r`. Foco = Borda `--dm-orange` + `box-shadow: 0 0 0 3px rgba(255, 144, 0, 0.12)`.
* **Toasts:** Controlados por `gToast`. Texto em uma única linha, sem ponto final, em PT-BR.
* **Badges:** Nano (9-10px), uppercase, weight 700. Gestão = vermelho/branco; Equipe DM = amarelo/vermelho.

---

## 8. Estados
* **Hover:** Transições suaves em todas as propriedades interativas (cor, borda, shadow).
* **Focus-Visible:** Outline laranja de `2px` com offset de `2px` obrigatório para navegação via teclado.
* **Disabled:** `opacity: 0.5`, `cursor: not-allowed`, pointer-events desativados.
* **Loading:** Skeletons ou spinners semânticos sem travar a interface inteira de forma desnecessária.

---

## 9. Ícones
* **Formato:** Apenas SVGs inline (`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`).
* **Tamanho Padrão:** `16px` a `18px` de renderização.
* **Proibição:** Nunca use emojis como ícones ou elementos fixos de UI.
