# 04 — DESIGN SYSTEM · Como o Luma se parece

> O diferencial visual do produto. Com este arquivo, a IA desenha telas que **parecem do Luma** — mesma paleta, mesmo ritmo, mesmos componentes.
> **Fonte da verdade é o código:** `css/00-tokens.css` (tokens), `css/components/*` e `css/modules/*`. Valores aqui refletem o estado em 2026-07-11. Se divergir do CSS, o CSS vence — e corrija este arquivo.
> ⛔ **Regra-mãe:** cor, radius, sombra e timing **sempre via token**. Hex/px solto no código é bug de marca, não escolha de estilo.

---

## Princípios

1. **Marca por construção.** Laranja Delivery Much é a assinatura; tudo orbita ele. O usuário não consegue "sair da marca" sem querer.
2. **Dois mundos, um sistema.** O **Franqueado** é claro e acolhedor (vitrine); o **Estúdio/Designer** é escuro e focado (ferramenta profissional). Mesmos tokens semânticos, temas opostos. (§3)
3. **Laranja é a única ousadia.** Ao redor dele, tudo é quieto: neutros, tipografia sóbria, movimento contido.
4. **Contraste é lei, não gosto.** As regras WCAG da §2.2 não são negociáveis.

---

## 1. Cores

Paleta em `:root` de `css/00-tokens.css`. **Use o token, nunca o hex.**

### Marca

```
--dm-orange     #FF9000   Primária — seleção, acentos, superfícies display grandes
--dm-orange-d   #F85400   Laranja escuro — FUNDO de CTA com texto pequeno; texto laranja sobre claro
--dm-red        #C81818   Vermelho DM — preços, badge GESTÃO, perigo
--dm-yellow     #FFB900   Amarelo — badges, identidade "campo" no tema escuro
--dm-orange-bg  #FFF2E0   Fundo suave laranja (chips, realces)
--dm-orange-tint #FFE0BD  Tint laranja (bordas suaves)
```

### Neutros (tema claro / Franqueado)

```
--white     #FFFFFF     --off-white  #FAFAFA
--gray-light #F2F2F2    --gray-mid   #D4D4D4
--text  #0A0A0A   --text-2  #3A3A3A   --text-3  #6B6B6B
```

### Superfícies do Estúdio (tema escuro / Designer)

```
--d-bg #111 · --d-dark #1A1A1A · --d-surf #222 · --d-surf2 #2A2A2A · --d-surf3 #333
--d-border rgba(255,255,255,.08) · --d-border2 rgba(255,255,255,.14)
--d-text #F0F0F0 · --d-text2 #A0A0A0 · --d-text3 #8A8A8A · --d-error #FF6B6B
```

### Semânticos (separados do acento — nunca conte com o laranja para significado)

```
--green      #22C55E   Sucesso — SÓ pontos/bordas/fundos
--green-text (#22C55E no escuro / #15803D no claro)  Verde para TEXTO — vira com o tema
--var-color  (#FFB900 no escuro / #8A6500 no claro)  Identidade dos campos {{}}
--var-bg     rgba(255,185,0,.12)                     Fundo dos chips de campo
```

> ⚠️ **Verde e amarelo mudam de tom por tema.** `--green-text` e `--var-color` **flipam** em `body.theme-light` justamente porque o vivo falha em contraste sobre fundo claro. **Para texto verde use `--green-text`, nunca `--green`.**

### Vidro & gradientes

```
--glass-bg rgba(255,255,255,.75) · --glass-blur blur(16px)
--glass-shadow 0 8px 32px rgba(15,23,42,.08)
--gradient-orange linear-gradient(135deg, #FF9000, #F85400)
```

Topbar usa um gradiente próprio, sutil: `#FF9400 → #FA8200`.

---

## 2. Contraste (as regras que viram lei)

Auditoria WCAG aplicada — não reintroduza os erros:

- **Texto branco sobre `#FF9000` dá só 2.27:1 (reprova).** Por isso **CTA de texto pequeno usa fundo `--dm-orange-d`** (3.35:1, passa AA-large). `#FF9000` puro fica para **display grande** (heros, títulos).
- **Texto laranja sobre claro** → `--dm-orange-d` (grande/bold) ou `--dm-red` (pequeno, 5.8:1). Nunca `#FF9000` como texto sobre branco.
- **Verde como texto** → sempre `--green-text` (5.0 claro / 7.5 escuro). O `--green` vivo é só dot/borda/fundo.
- **Amarelo de campo** → `--var-color` (já resolve por tema: dourado `#8A6500` no claro).
- **Aceitos como marca** (decisão consciente): branco sobre laranja na topbar/badges display; vermelho sobre amarelo em badge curto bold.

---

## 3. Os dois temas

A classe `body.theme-light` significa **claro em todos os módulos**; sua ausência = **escuro**. O `<body>` nasce `mode-franqueado theme-light`.

| | Franqueado | Estúdio / Designer |
|---|---|---|
| Tema padrão | **Claro** (`theme-light`) | **Escuro** (sem a classe) |
| Tokens de superfície | `--white`, `--off-white`, `--gray-*` | `--d-bg` … `--d-surf3` |
| Tema alternativo | Escuro via `body:not(.theme-light)` (overrides) | Claro via `body.theme-light` (redefine os `--d-*`) |

**Regra prática:** estilize **pelos tokens semânticos** e os dois temas saem "de graça". Só escreva override de tema quando o token não cobrir (e cubra os **dois** lados).

---

## 4. Tipografia

- **Roboto** (Google Fonts, carregada no `<head>`), pesos **300–900**.
- **`font-weight:900` = "Roboto Black"** — a fonte dos títulos da marca.
- **Realce Black foi aposentada** — o valor `'Realce Black'` mapeia para Roboto 900.
- **Fontes custom** do designer entram via FontFace API, referenciadas como `custom:Família`.

**Escala de fato** (px, tema claro; o Estúdio usa tamanhos menores por densidade):

```
Display/hero   clamp(26–40)  900   títulos de vitrine
Título seção   20–22         900
Corpo forte    14–15         700
Corpo          13–14         400–500
Meta/label     11–12         500–700  (labels em UPPERCASE, letter-spacing ~.06–.1em)
Nano           9–10          700      badges, contadores
```

- Títulos com `text-wrap: balance`; labels em caixa-alta ganham `letter-spacing`.
- Tipografia fluida (`clamp()`) na home do franqueado para escalar com o monitor.

---

## 5. Espaçamento

⚠️ **Honestidade:** o Luma **não tem escala de spacing tokenizada** (`--space-*` não existe). Os valores são px diretos. Para telas novas **parecerem do Luma, siga a escala de fato** abaixo (múltiplos de 2, base 4):

```
4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32 · 40
```

- **Gaps de layout:** 8–16px entre itens; seções respiram com 18–24px.
- **Padding de componente:** botão ~7×16px; input ~8–13px; card ~7–12px.
- **Padding de página:** o franqueado usa **fluido** — `padding: clamp(24px, 4.2vw, 96px)` lateral — para não deixar faixa branca em telas largas. Prefira esse padrão em telas de vitrine.
- Quando fizer sentido, gap/padding em `clamp()` para acompanhar a resolução.

---

## 6. Radius

```
--r      10px   padrão — cards, inputs, superfícies
--r-sm   6px    pequeno — botões, chips retangulares
--r-pill 999px  pílula — filtros, tags, botões arredondados, badges
```

One-offs comuns e aceitos: **7–9px** (linhas/tiles densos do Estúdio), **12–16px** (heros e cards grandes da vitrine). Fora disso, use o token.

---

## 7. Elevação, sombra e movimento

**Sombra** — leve e colorida pela marca quando é interação:
- Card em repouso: sombra difusa suave (`0 8px 32px rgba(0,0,0,.08–.12)`).
- Hover de card/CTA: eleva (`translateY(-2/-3px)`) + sombra laranja (`rgba(255,144,0,.2)` / `rgba(248,84,0,.3)`).
- Vidro (topbar/busca sticky): `--glass-shadow` + `backdrop-filter: var(--glass-blur)`.

**Motion** — sempre pelos tokens, nunca cubic-bezier/ms na mão:

```
Curvas:  --ease-standard (geral) · --ease-out (entradas) · --ease-in (saídas)
         --ease-spring / --ease-spring-soft (pops de botão/card)
Durações: --dur-micro 140 · --dur-fast 180 · --dur-base 260 · --dur-slow 420
```

Keyframes globais em `css/02-animations.css` (`gFadeInUp`, `gPopIn`…), com guarda de `prefers-reduced-motion`. Efeito é tempero: hover sutil, entrada em cascata, pulso ao atualizar. Menos é mais.

---

## 8. Componentes

### Botões

| Tipo | Aparência | Uso |
|---|---|---|
| **Primário (CTA)** | Fundo `--dm-orange-d`, texto branco, `--r-sm`, ~7×16px, 600; hover escurece (brightness) + eleva | Ação principal ("Novo", "Publicar", "Criar") |
| **Pílula CTA** | Igual, `--r-pill` | Vitrine do franqueado ("Ver campanhas →") |
| **Ghost** | Transparente, borda + texto `--dm-orange-d`, `--r-pill` | Ação secundária |
| **Vidro (topbar)** | `rgba(255,255,255,.12)` + borda `.18`, texto branco, `--r-pill` | Ajuda/Sair na topbar |
| **Ícone** | Circular ou quadrado, transparente; hover troca tinta | Fechar, kebab, ferramentas |

Foco visível sempre (`:focus-visible` com outline laranja). Alvos de toque ≥44px no mobile.

**Contraste do par laranja — medido, não estimado** (auditoria de 2026-08-19, no navegador):

| Par | Razão | Serve para |
|---|---|---|
| branco sobre `--dm-orange` #FF9000 | **2,27:1** | ⛔ nada com texto. É o pior contraste do produto. |
| branco sobre `--dm-orange-d` #F85400 | **3,35:1** | AA-large (≥18,66px bold). É o teto do par com branco. |
| `--dm-orange-d` como TEXTO sobre branco | **3,35:1** | idem — daí a §77 mandar `--dm-red` no texto pequeno. |
| `#0A0A0A` sobre `--dm-orange` #FF9000 | **8,6:1** | AA e AAA. A única forma de passar com o laranja claro. |

Consequência prática: **CTA com texto pequeno usa `--dm-orange-d` de fundo** (é a §26) e ainda assim fica em 3,35 — abaixo do 4,5 que a AA pede para texto pequeno. Fechar esse último vão exige decisão de marca: texto quase-preto sobre o laranja, ou um laranja mais escuro que sai da paleta. Enquanto não houver decisão, `--dm-orange-d` é o melhor que a paleta documentada permite, e **`--dm-orange` como fundo de texto pequeno é regressão**.

⚠️ Alvo de toque pequeno por desenho (enfeite de canto, como o favorito do card) não precisa inflar: um halo `::after` de `var(--tap-min)` centrado recebe o dedo sem mexer no visual. Padrão em uso em `.camp-fav` / `.camp-prev-btn`.

### Chips / filtros

Pílula (`--r-pill`), borda fina. **Ativo = fundo `rgba(255,144,0,.12)` + borda `--dm-orange` + texto laranja**, contagem ao lado. É o padrão dos filtros do histórico do franqueado e do painel Campos (Todos / Em uso / Livres).

### Inputs / busca

- Borda `--gray-mid` (claro) / `--d-border2` (escuro), `--r` ou `--r-pill`.
- **Foco:** borda `--dm-orange` + anel `0 0 0 3px rgba(255,144,0,.12)`.
- Busca com ícone SVG à esquerda; no franqueado, vira **sticky com vidro** ao rolar.
- Mobile: `font-size:16px` para evitar auto-zoom do iOS.

### Cards

- **Card de campanha:** borda `1.5px --gray-light`, `--r`(10), thumb em cima + corpo embaixo; hover = borda laranja + `translateY(-5px)` + sombra laranja. Selecionado = borda `2px --dm-orange` + anel.
- **Linha de campo (Estúdio):** tile do tipo (cor por tipo) + nome + meta + ponto de status; hover realça; detalhe expande em acordeão.

### Toasts

Canto, via `gToast` apenas. Sucesso sem emoji (ou `✓`); alerta/erro com `⚠ ` + o que fazer. Sem ponto final, PT-BR, uma linha.

### Badges

Pílula nano (9–10px, 700, caixa-alta). Semânticos: GESTÃO = `--dm-red`/branco; EQUIPE DM = `--dm-yellow`/`--dm-red`; sucesso/rascunho usam os tons AA (`#15803D` / `#8A6500`).

---

## 9. Estruturas

### Topbar (global)

Altura **52px**, gradiente `#FF9400→#FA8200`. **Esquerda:** logo + seletor de modos (pill ativa **branca com texto laranja em todos os modos**, inativas a 85% de opacidade). **Direita:** contexto do modo · Ajuda · perfil (badge de role + avatar + nome) · Sair (ícone discreto; vermelho só no hover). Controles de vidro na mesma família (`rgba(255,255,255,.12)` + borda `.18`).

### Sidebar / painel lateral (Estúdio)

Painel direito escuro com abas: **Camadas** (lista + propriedades contextuais), **Dados** (centro de campos), **Campanhas** (árvore compacta Figma-style), **Assets**. Superfícies `--d-surf*`, texto `--d-text*`, cabeçalhos de seção em label UPPERCASE `--d-text3`.

### Toolbar vertical (Estúdio)

Coluna de ferramentas à esquerda. Botão de ferramenta com estado ativo laranja; grupos com **flyout** à direita (formas, nitidez). Cursor customizado por ferramenta.

### Canvas / stage

- **Editor:** `#d-canvas-frame` com `transform: scale` (zoom); fundo xadrez sutil; camadas em DOM absoluto; réguas opcionais.
- **Prévia (franqueado):** stage com **grade de pontos sutil**, a arte centralizada com sombra, toolbar com zoom real + guias de composição.

### Grid de catálogo

Fluido: `grid-template-columns: repeat(auto-fill, minmax(clamp(...), 1fr))` + `gap` em `clamp()`. Densifica e escala com a resolução — **não** trave largura fixa em telas de vitrine.

---

## 10. Ícones

- **SVG inline, sempre.** ⛔ Nunca emoji em UI (renderiza diferente por sistema, quebra a marca). _(Alguns toasts legados ainda têm emoji — dívida a limpar, não padrão a copiar.)_
- Spec: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"` (herda a cor do contexto), `stroke-width` ~2–2.5, `stroke-linecap/linejoin="round"`.
- Tamanho de render 11–16px na maioria da UI; herdam cor via `currentColor` (um ícone serve claro e escuro).

---

## 11. Regras de ouro do design system

1. **Token sempre** — cor, radius, sombra, timing. Zero hex/ms solto.
2. **Estilize por token semântico** → os dois temas saem de graça; cubra ambos se criar override.
3. **`--dm-orange-d` para fundo de CTA pequeno**; `#FF9000` só display grande.
4. **Texto verde = `--green-text`; campo = `--var-color`** (flipam por tema).
5. **Ícone = SVG `currentColor`**, nunca emoji.
6. **Vitrine é fluida** (`clamp()`, grids `auto-fill`), não largura travada.
7. **Motion pelos tokens**, com `prefers-reduced-motion` respeitado.
8. **Foco visível** e alvos ≥44px no toque.
9. Quando faltar token (ex.: spacing), **siga a escala de fato** (§5) — não invente valor aleatório.

---

## Ver também

- `css/00-tokens.css` — a fonte da verdade dos tokens.
- `03_ENGINEERING.md` — por que token é regra (marca por construção).
- `docs/LUMA.md` §Design System — brandbook aplicado e detalhes.
