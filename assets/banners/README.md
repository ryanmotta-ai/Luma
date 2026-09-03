# assets/banners — a arte que identifica a campanha

Arte **larga** — `764×204` (proporção **3,75:1**), PNG com fundo transparente e
canto arredondado embutido — com o nome da campanha **dentro da imagem**. É por
ela que o franqueado reconhece a campanha no Calendário.

Não confundir com `assets/covers/` — aquela é a arte `5:3` da vitrine do
Franqueado, outra família, e continua valendo onde já é usada.

## Como o arquivo vira banner na tela

O nome do arquivo é o **id da campanha** (`js/00-config.js`, campo `banner`, ao
lado do `cover`). Os arquivos vieram do Drive com nome de humano
(`Baratissímo 25,00.png`, `Açaí aqui@2x.png`) e foram renomeados para o id:
espaço, acento, vírgula e `@` numa URL servida pelo GitHub Pages é a classe de
bug que ninguém quer caçar depois.

Onde aparece: cartão do evento, cabeçalho da folha de detalhe, prévia do
ponteiro e a tira "sempre no ar". **Não** aparece na grade do mês — lá a faixa
tem 19px de altura e a arte viraria borrão; ali quem identifica é o trilho de cor.

**Arquivo que falta não quebra nada:** o `onerror` do `<img>` remove a imagem e
a peça cai no tratamento tipográfico (trilho de cor + título).

## Ligados a uma campanha

| Arquivo | `id` | Nome no Drive |
|---|---|---|
| `cd.png` | `cd` — Combo Com Desconto | `Combos com desconto.png` |
| `tr25.png` | `tr25` — Tudo até R$ 25 · Baratíssimo | `Baratissímo 25,00.png` |
| `rbp.png` | `rbp` — Rangos Que Baixaram O Preço | `Rangos que baixaram o preço.png` |
| `pt.png` | `pt` — Promo Turbinada | `promo turbinada.png` |
| `gb.png` | `gb` — Bora Ganhar Brindes | `Banner_Boraganharbrindes.png` |
| `aai.png` | `aai` — Açaí Aqui | `Açaí aqui@2x.png` (é 2×: `1528×408`) |
| `mna.png` | `mna` — Mercado no App | `banner mercado.png` |

## Ligado a um evento, não a uma campanha

| Arquivo | Onde | Como |
|---|---|---|
| `mais-vendidos.png` | recorrente "Mais Vendidos do App" | campo `banner` no seed, em `js/calendario/calendario.js` |

## No repositório, ainda sem uso

Existem, estão versionados, e **nenhuma campanha aponta para eles** — porque não
há `id` correspondente em `CAMPS_ATIVAS`/`CAMPS_OUTRAS` e adivinhar aqui erraria
regra de negócio:

- `lojas-favoritas.png` — LOJAS FAVORITAS DA GALERA
- `ofertas-favoritas.png` — OFERTAS FAVORITAS *(parece `otp` — OFERTAS | Tudo no
  Precinho —, mas o nome não bate e a arte não traz "no precinho")*
- `ofertas-bebidas.png` — OFERTAS EM BEBIDAS

Falta também decidir uma ambiguidade: a arte **COMBOS COM DESCONTO** traz
Coca-Cola, então ela pode ser `cd` (*Combo Com Desconto*) ou `cc` (*Combos
Coca*). Hoje está em `cd`, pelo texto literal do banner — `cc` segue sem arte.

**Para ligar qualquer uma:** acrescente `banner:'assets/banners/<arquivo>.png'`
ao lado do `cover:` da campanha em `js/00-config.js`. Nada mais.

## Formato

- **PNG**, `764×204` (ou `1528×408` para 2×), fundo transparente.
- A proporção usada na tela é o token `--cal-banner-ar` em
  `css/modules/calendario.css`. Se a arte mudar de formato, muda lá — num lugar só.
- ⛔ **A tela nunca corta a arte.** O set é misto: `tr25` tem o texto à esquerda e
  a foto à direita, `cd` tem o inverso. Qualquer corte fixo decapitaria metade
  das artes — por isso, em coluna larga, quem se adapta é o cartão (vira
  horizontal, arte à esquerda com largura fixa), não a imagem.
