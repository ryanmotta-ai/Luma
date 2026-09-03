# assets/banners — a arte que identifica a campanha

Arte **larga** (~`768×140`, proporção `5,5:1`) com o nome da campanha **dentro da
imagem**. É por ela que o franqueado reconhece a campanha no Calendário.

Não confundir com `assets/covers/` — aquela é a arte `5:3` da vitrine do
Franqueado, outra família, e continua valendo onde já é usada.

## Como o arquivo vira banner na tela

O nome do arquivo é o **id da campanha** (`js/00-config.js`, campo `banner`).
Solte o `.png` aqui com o nome da tabela abaixo e ele aparece sozinho — no
cartão do evento, no cabeçalho da folha de detalhe, na prévia do ponteiro e na
tira "sempre no ar".

**Arquivo que falta não quebra nada:** o `onerror` do `<img>` remove a imagem e
a peça cai no tratamento tipográfico (trilho de cor + título). Dá para subir as
artes uma a uma.

## Os arquivos esperados

| Arquivo | Campanha (`id`) | O texto do banner |
|---|---|---|
| `cd.png` | `cd` — Combo Com Desconto | COMBOS COM DESCONTO |
| `tr25.png` | `tr25` — Tudo até R$ 25 · Baratíssimo | TUDO ATÉ R$ 25 |
| `rbp.png` | `rbp` — Rangos Que Baixaram O Preço | RANGOS QUE BAIXARAM O PREÇO |
| `pt.png` | `pt` — Promo Turbinada | PROMO TURBINADA |
| `gb.png` | `gb` — Bora Ganhar Brindes | BORA GANHAR BRINDES |
| `aai.png` | `aai` — Açaí Aqui | AÇAÍ AQUI · até R$ 15 |
| `mna.png` | `mna` — Mercado no App | MERCADO NO APP |
| `mais-vendidos.png` | — (recorrente do calendário, sem campanha) | MAIS VENDIDOS DO APP · 25% OFF ou mais |

## Ainda sem campanha para ligar

Três artes existem e **não têm `id` correspondente** em `CAMPS_ATIVAS` /
`CAMPS_OUTRAS`. Ficam de fora até alguém dizer a qual campanha pertencem —
adivinhar aqui erraria a regra de negócio:

- **LOJAS FAVORITAS DA GALERA**
- **OFERTAS FAVORITAS** — parece `otp` (*OFERTAS | Tudo no Precinho*), mas o
  nome não bate e a arte não traz "no precinho".
- **OFERTAS EM BEBIDAS** — e a arte **COMBOS COM DESCONTO** traz Coca-Cola, o
  que deixa ambíguo se ela é `cd` (*Combo Com Desconto*) ou `cc` (*Combos Coca*).
  Hoje está em `cd`, pelo texto literal do banner.

Para ligar qualquer uma: crie a campanha em `js/00-config.js` e acrescente
`banner:'assets/banners/<arquivo>.png'` ao lado do `cover:`. Nada mais.

## Formato

- **PNG**, largura ~1536px (2× para tela retina), proporção `5,5:1`.
- A proporção usada na tela é o token `--cal-banner-ar` em
  `css/modules/calendario.css`. Se a arte mudar de formato, muda lá — num lugar só.
- Sem transparência necessária; o recorte é `object-fit: cover` centralizado,
  então **não** coloque texto colado nas bordas laterais.
