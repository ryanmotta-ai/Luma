# Apresentação oficial do Luma

Deck de produto: 16 slides principais (15–18 min) e um apêndice técnico (A–L) para perguntas.
HTML, CSS e JavaScript puros, sem build e sem dependência. Fica isolado do app: só **lê** os tokens
(`../css/00-tokens.css`), as fontes (`../assets/fonts/`), os logos e as capas do repositório. Nada daqui
é carregado pelo `index.html` do Luma.

## Abrir

- **Publicado:** <https://ryanmotta-ai.github.io/Luma/presentation/> (GitHub Pages da `talpaipai`).
- **Local:** sirva a **raiz do repositório** e abra `/presentation/`:

  ```bash
  python -m http.server 5605
  ```

  Depois abra <http://localhost:5605/presentation/> (é a mesma config `luma-static` do `.claude/launch.json`).
  Não abra pelo `file://`: o navegador bloqueia as fontes locais e o deck cai na fonte do sistema.

Funciona sem internet. Não usa Supabase, IA, upload, Telegram nem login, e não escreve em lugar nenhum.

## Apresentar

| Tecla | Faz |
|---|---|
| → · espaço · PgDn · Enter · clique | avança (primeiro os passos do slide, depois o próximo slide) |
| ← · PgUp · Shift+clique | volta |
| Home · End | primeiro slide · último slide principal (o apêndice fica depois) |
| **F** | tela cheia (Esc sai) |
| **G** | índice de todos os slides, com o apêndice (Esc fecha) |
| **H** | modo limpo: esconde o número e a barra de progresso |
| deslizar no toque | avança ou volta |

- **Link direto:** `#7` abre o slide 7; `#apx-c` abre o apêndice C.
- **Demonstrações:** o 06 (publicação), o 07 (a conversa), o 08 (a legenda) e o 10 (o lote) são animados.
  No 07, espere a digitação terminar antes de avançar.
- **Qualquer tela:** o palco é 1920×1080 e escala para caber. Se a proporção não for 16:9, as faixas
  ficam na cor do slide. Testado em 1920×1080, 1440×900 e 1366×768.
- **Notas do apresentador:** [`SPEAKER_NOTES.md`](SPEAKER_NOTES.md). **Fontes de cada número:** [`CLAIMS.md`](CLAIMS.md).

## Estrutura

```
presentation/
  index.html          os 28 slides (16 principais + divisor + apêndice A–L)
  presentation.css    layout; cor, raio e movimento a partir dos tokens do Luma
  presentation.js     escala do palco, navegação, passos, índice e as demonstrações
  captures/           telas reais do produto (WebP, capturadas em 2×); o conjunto completo, nem todas entram nos slides
  assets/artes/       artes geradas pelo motor de render do Luma
  assets/fotos/       miniatura da foto usada na demonstração do chat
  SPEAKER_NOTES.md    roteiro por slide
  CLAIMS.md           cada afirmação com a fonte; o que saiu do deck antigo
```

## Como as telas foram feitas

- **Onde:** numa cópia local do app no commit `0549b67` (`node scripts/versao.js HEAD --porta 8100`),
  com o Supabase desligado e uma sessão de demonstração. Nenhum dado de produção, token ou ID aparece.
- **Templates:** PSDs montados a partir das capas de campanha do repositório (`assets/covers/`) e importados
  pelo importador de PSD de verdade, com a revisão do Estúdio. Depois, publicados pelo fluxo normal.
- **Artes:** geradas pelo motor de render do Luma (o mesmo do download), pelo chat e pelo Luma Sheets.
- **Fotos de produto** (Unsplash, licença Unsplash):
  - hambúrguer: `images.unsplash.com/photo-1568901346375-23c9450c58cd`
  - açaí: `images.unsplash.com/photo-1627308594190-a057cd4bfac8`
  - pizza: `images.unsplash.com/photo-1513104890138-7c749659a591`
  - sushi: `images.unsplash.com/photo-1579871494447-9811cf80d66c`
- **Captura:** Edge sem janela, pelo DevTools Protocol, em escala 2×, com movimento reduzido para não pegar
  animação no meio. Depois, convertidas para WebP.
- **Aparelhos da capa** (`assets/devices/`): molduras oficiais da Apple (Apple Design Resources, *Product Bezels*,
  acabamento prata): MacBook Pro M5 14", iPad Pro (M5) 11" em paisagem e iPhone 18 Pro. A tela de cada uma é a home
  do franqueado capturada na resolução nativa do aparelho (`captures/franqueado-home-macbook|tablet|mobile.webp`).
  O MacBook mostra o Safari em tela cheia, com a faixa preta de 37 pt atrás do notch. O iPad e o iPhone mostram o Luma
  aberto pela tela inicial, com a barra de status do sistema no laranja do `theme-color`, 21:41 porque a saudação é
  "Boa noite". Atenção: a capa sobrepõe, corta pela borda e sombreia as molduras (decisão de 27/09). As diretrizes de
  marketing da Apple pedem o contrário (aparelho inteiro, sem sobrepor, sem cortar, sem sombra, em escala real); se o
  deck virar material de divulgação, reveja a capa.

## Atualizar

- Número novo: primeiro no `CLAIMS.md`, com a fonte. Depois no slide e nas notas.
- Tela nova: tire na mesma cópia local, sem dado pessoal, e aponte o recorte com `data-crop="x,y,w,h"`
  (em pixels da imagem). O `presentation.js` enquadra sozinho.
