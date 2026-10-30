# Skill: banner do app (764 × 204)

> Para o designer de IA do Ateliê (D13, `luma-brain/08_ATELIE.md` §4.9). Você escreve o SVG inteiro.
> O Luma saneia, confere as regras da marca e reprova o que sair daqui. Tudo que está escrito como
> "nunca" é reprovação automática.
>
> Régua desta skill (peças reais, `assets/creative/regua/`): almoço barato, bora ganhar brindes,
> açaí & sorvete, descontaço 12.12, Xanxerê, combos com desconto, rangos que baixaram o preço,
> ofertas em bebidas, mais vendidos do app, promo turbinada.

## 1. O que a peça é

O banner roda no carrossel da home do app, num celular, a ~360 px de largura. A pessoa vê por
1 segundo, rolando. Se o título não se lê de relance, a peça falhou.

- **Canvas:** 764 × 204. **Fora da pílula é transparente** — o app põe o fundo dele.
- **A pílula (card):** `x=23 y=9 width=730 height=175 rx=30`. Todo texto fica dentro dela, com
  pelo menos **23 px** das bordas laterais do canvas.
- **O que pode sair da pílula:** a foto do produto recortada, o selo e os "%" soltos. Texto nunca.
- **Uma ideia por banner.** Título + (no máximo) uma tarja + (no máximo) um valor. Nada de
  parágrafo, nada de letra miúda, nada de botão.

## 2. A planta que a régua repete

```
┌───────────────────────────────────────────────────────────────┐
│  ADESIVO GRANDE            ·  foto recortada saindo da pílula │
│  [ tarja torta ]           ·  (ou valor em bloco amarelo)     │
└───────────────────────────────────────────────────────────────┘
   lado do texto: 45–55% da largura    lado da imagem/valor
```

- **Texto à esquerda, imagem ou valor à direita** é o padrão (8 de 10 peças). Espelhar (foto à
  esquerda, texto à direita) é a variação aceita — "combos com desconto", "descontaço".
- **Três colunas** (texto · foto · valor) só quando há foto E valor: "açaí & sorvete", "mais
  vendidos", "Xanxerê".
- **O título ocupa 60–75% da altura da pílula.** Título pequeno num card grande é o erro nº 1.
- **Folga para o franqueado:** o texto do pedido é um exemplo. Desenhe para caber um texto até
  30% mais longo sem colidir (o Local Fit encolhe; ele não reposiciona).

## 3. Paleta e tipografia

- Cores: `#F85400` (laranja, fundo padrão da pílula), `#FF9000` (solar), `#FFB900` (amarelo),
  `#FFFFFF`, `#434343` (grafite, só sombra). **Nenhuma outra.**
- Fundo da pílula: `#F85400`. `#FF9000` só com textura por cima e sem texto branco direto nele.
- Títulos: `class="hero"` (Realce Black). Texto pequeno de apoio: `class="media"` (Roboto 500).
- Corpo mínimo de qualquer texto: **20 px**.

## 4. Os efeitos

Cada efeito: quando usar, o SVG exato, as medidas. `Z` = corpo (font-size) do adesivo.

### 4.1 Adesivo (o título)

Peças: mercado no app, ofertas favoritas, combos, almoço, açaí, Xanxerê. É a assinatura visual
da DM no banner.

- Letra **laranja com borda branca grossa**, sobre o laranja da pílula. A borda é o que separa
  a letra do fundo.
- `stroke-width` = **0,22 × Z**. `stroke-linejoin="round"` e `paint-order="stroke fill"` são
  obrigatórios (sem eles a borda come a letra).
- Z típico: 70–120 com uma linha; 55–80 com duas. Duas linhas no máximo.
- Variação aceita: letra **branca** com borda laranja escura não existe na marca — não invente.

```svg
<g data-bloco="titulo">
  <text x="56" y="128" class="hero" font-size="104" fill="#F85400"
        stroke="#FFFFFF" stroke-width="23" stroke-linejoin="round" paint-order="stroke fill"
        data-campo="produto">MERCADO</text>
</g>
```

- Inclinação opcional de −2° a −5° no adesivo inteiro (`transform="rotate(-3 x y)"` no `g`),
  nunca em linhas soltas. A régua usa reto e torto quase meio a meio.

### 4.2 Tarja (a 2ª linha)

Peças: "no app", "FAVORITAS", "COM DESCONTO", "O PREÇO", "DA GALERA".

- Retângulo **branco**, texto **laranja** em `hero`, girado de **−3° a −5°**.
- Corpo da tarja ≈ **0,45 × Z**. Altura do retângulo ≈ 1,05 × corpo da tarja. 14 px de respiro
  à esquerda e à direita do texto.
- Fica logo abaixo do adesivo, deslocada uns 15–25 px para a direita do início dele.
- **Vão até o adesivo** ≥ metade da borda do adesivo + 6 px (a inclinação aumenta a caixa:
  some 3% da largura da tarja). Encostar = colisão = reprovação.

```svg
<g data-bloco="apoio" transform="rotate(-4 84 160)">
  <rect x="84" y="140" width="190" height="44" fill="#FFFFFF"/>
  <text x="98" y="175" class="hero" font-size="42" fill="#F85400" data-campo="apoio">NO APP</text>
</g>
```

- Variação "tarja acima" (pré-título): "LOJAS", "rangos que", "MAIS". Mesmo desenho, menor
  (0,35 × Z), em cima do adesivo.

### 4.3 Valor em bloco

Peças: "ATÉ R$ 25", "25% OFF ou mais", "10% OFF", "LANÇAMENTO 24 DE ABRIL".

- O número é o herói do lado direito: `hero`, laranja, dentro de um bloco **amarelo** `#FFB900`
  girado −3° — ou branco sobre a pílula quando o bloco amarelo já é a zona inteira
  ("mais vendidos").
- O número tem **55–80% do corpo do adesivo**. Nunca maior que o adesivo: o produto manda,
  o preço acompanha.
- "R$" e centavos a **55% do número**, com o topo alinhado ao topo do número.
- Palavras pequenas do valor ("ATÉ", "a partir de", "ou mais") em tarja ou em `media` branca,
  20–28 px.

```svg
<g data-bloco="valor" transform="rotate(-3 640 96)">
  <rect x="560" y="62" width="160" height="68" fill="#FFB900"/>
  <text x="640" y="114" class="hero" font-size="58" fill="#F85400" text-anchor="middle" data-campo="desconto">30% OFF</text>
</g>
```

### 4.4 Foto saindo da pílula

Peças: almoço, brindes, açaí, combos, mais vendidos, ofertas em bebidas. É o que faz o banner
parecer peça de designer e não template.

- O produto é **recortado (sem fundo)** e **passa da borda da pílula** por cima, por baixo ou
  pelos dois lados. O canvas tem 9 px acima e 20 px abaixo da pílula para isso.
- Ocupa **35–50% da largura** da pílula, do lado oposto ao texto.
- Sombra leve embaixo do produto: `filter="url(#shs)"`.
- Contrato do campo (o Luma põe a foto do franqueado dentro dessa caixa):

```svg
<g data-bloco="foto" id="foto_produto" filter="url(#shs)">
  <rect x="470" y="0" width="270" height="204" rx="0" fill="#D9D9D9"/>
</g>
```

- Foto com fundo (não recortada): fica DENTRO da pílula, na metade direita, cortada pela
  curva do card (`clip-path` com o mesmo `rx=30`) — "almoço barato".

### 4.5 Textura do fundo

Peças: ondas ("açaí", "ofertas favoritas"), raios ("descontaço", "mais vendidos"), arcos
("brindes", "combos").

- Sempre **dentro da pílula** (`clip-path` com o retângulo do card) e **atrás da foto ou no lado
  da imagem**. A regra da marca não deixa grafismo atrás de texto.
- Tom sobre tom: `#FF9000` sobre `#F85400`, opacidade 0,4–0,6. Nunca branco.
- Assets prontos: `asset:inv/pattern-macarrao.png` (arcos), `asset:inv/explosao.png` (raios).

```svg
<clipPath id="pilula"><rect x="23" y="9" width="730" height="175" rx="30"/></clipPath>
<g data-bloco="decor">
  <image href="asset:inv/pattern-macarrao.png" x="553" y="-51" width="230" height="220" opacity="0.55" clip-path="url(#pilula)"/>
</g>
```

### 4.6 "%" soltos

Peças: almoço, açaí, combos, mais vendidos, promo turbinada.

- 2 a 4 sinais "%" em `hero`, branco com borda laranja fina (0,1 × corpo) ou amarelos, corpo
  22–48, girados entre −15° e +15°, **perto das bordas e fora das caixas de texto**.
- Só em peça de desconto ou oferta. Em peça institucional (Xanxerê, brindes) não entra.

```svg
<g data-bloco="decor">
  <text x="70" y="70" class="hero" font-size="34" fill="#FFFFFF" transform="rotate(-12 70 70)">%</text>
</g>
```

### 4.7 Selo na quina da foto

- Círculo amarelo `#FFB900`, raio 40–55, texto laranja em `hero` (2 linhas: "18%" / "OFF").
- Preso na quina da foto (é o único texto que pode sobrepor a foto).

```svg
<g data-bloco="selo">
  <circle cx="690" cy="58" r="48" fill="#FFB900"/>
  <text x="690" y="58" class="hero" font-size="30" fill="#F85400" text-anchor="middle">18%</text>
  <text x="690" y="86" class="hero" font-size="22" fill="#F85400" text-anchor="middle">OFF</text>
</g>
```

## 5. Nunca

- Texto fora da pílula, ou a menos de 23 px da borda lateral do canvas.
- Caixas de texto se tocando (adesivo × tarja, título × valor). Só o selo toca a foto.
- Grafismo atrás de texto.
- Cor fora da paleta; branco sobre `#FF9000`; laranja sobre laranja **sem** a borda branca.
- Mais de 3 tamanhos de texto na peça.
- Botão, letra miúda, logo grande (o banner já está dentro do app da DM). A peça de Xanxerê tem
  um botão verde "ver lojas confirmadas": é exceção daquela campanha de lançamento, com cor fora
  da paleta — não copie.
- Emoji, ícone desenhado à mão, imagem gerada.

## 6. Antes de entregar, confira

1. A ~360 px de largura, o título se lê sem esforço?
2. O título ocupa 60–75% da altura da pílula?
3. Existe UM ponto focal? (o adesivo, ou o valor quando a peça é de desconto)
4. A foto passa da borda da pílula (se for recortada)?
5. Cabe um texto 30% maior sem colidir?
6. Parece uma das peças da régua — sem ser cópia da planta de nenhuma?
