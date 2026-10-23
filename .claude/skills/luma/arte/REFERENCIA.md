# Quando o Ryan manda uma referência

> "Achei essa arte legal, adapta pra gente." / "Faz igual essa, só trocando fundo e banner." / "Usa essa e essa como referência máxima."
> Há **dois** pedidos bem diferentes escondidos nisso. Descubra qual é antes de desenhar.

## 0 · Qual dos dois?

| Ele diz… | Significa | Fidelidade |
|---|---|---|
| "**Igual** a referência", "mesma diagramação", "literalmente igual, só muda fundo e banner", "recria essa arte" | **Recriação** | Medir e reproduzir: posições, tamanhos, cores, raios. Conferir lado a lado até o bbox bater (≤ 2–3 px). |
| "**Achei legal**", "adapta pra nossa situação", "entendendo a intenção faz da melhor forma", "me inspira nessas" | **Adaptação** | Extrair a **ideia**, reconstruir com os essenciais do Luma. Não copiar pixel. |
| "Usa como referência máxima" (2 refs) | Recriação **e** variação | Entregar 2 layouts: um fiel, um que aplica a ideia no padrão da casa. |

Se não der para saber, assuma **adaptação** e diga em uma linha ("li como inspiração, não como cópia — se for para recriar igual, me fala").

## 1 · Ler a referência (não pule)

Abra a imagem e escreva (para si) uma ficha curta:

1. **Formato e proporção** (feed? story? outro?). Escala = largura do formato ÷ largura da referência (screenshots têm borda escura de ~4 px: descarte).
2. **Grade e blocos:** quantas zonas? onde está o herói? o que está sangrando para fora da margem?
3. **Hierarquia:** o que o olho vê 1º, 2º, 3º? Por quê (tamanho, cor, posição, contraste)?
4. **Paleta:** `node ferramentas/medir.js paleta ref.png 8` (PNG) ou amostre pixels. Marque cor de fundo, de texto, de acento.
5. **Tipografia:** estilo (condensada pesada? serifada? manuscrita?), relação de tamanhos, caixa-alta, tracking.
6. **Formas e raios:** cantos, círculos, serrilhados, inclinações, sombras, contornos.
7. **A ideia:** em uma frase, *por que essa arte funciona?* (ex.: "o preço é um selo inclinado que invade a foto — dá urgência"; "o banner vira cabeçalho — identidade antes do produto"; "fundo claro + foto grande rouba o peso do roxo e deixa o preço respirar").
8. **O que é conteúdo de terceiros** (marca, logo, texto, foto): não entra. Só estrutura e linguagem visual.

## 2 · Mapear para o Luma

| Na referência | No Luma vira |
|---|---|
| Logo da marca | Logo DM (`assets/logos/dm-h-*.png`) |
| Título / nome do produto | `{{produto}}` (+ `{{detalhes}}` opcional, `{{descricao}}`) |
| Preço | `{{precoPor:inteiro}}` / `:centavos` (+ `DE {{precoDe}}` tachado) |
| Foto grande | moldura `frame` com `imgVar:'foto_produto'` |
| Logo do restaurante | moldura circular `imgVar:'logo_loja'` |
| Banner/cabeçalho de campanha | `assets/banners/<campanha>.png` com traçado e sombra |
| Texto legal/validade/rodapé | `{{validade}}` |
| Ícones, selos, mockups de celular | só se a campanha pedir; senão decoração própria (SVG/shape) |
| Cores | paleta da campanha (roxo/amarelo/laranja/lilás…) — **nunca** a paleta de outra marca |
| Fontes | Realce + Roboto (nunca outra família) |

Elementos que a referência tem e o Luma **não** tem (carrossel, vídeo, botão): descarte ou traduza para algo estático equivalente.

## 3 · Adaptar (não copiar)

- Preserve o **mecanismo** (assimetria, escala, ritmo, sobreposição controlada, relação cheio/vazio), troque a **execução** (cores, formas, textos).
- Se a referência usa algo que o motor não faz (textura, gradiente complexo, tipografia em arco), ache o equivalente simples: forma vetorial, camada duplicada com regra, PNG decorativo no repositório.
- Em adaptação, **mostre 3 propostas** a partir da referência (uma conservadora, uma ousada, uma que mistura a referência com o padrão da casa) e recomende.
- Em recriação, **meça** (`medir.js caixa` por cor acha selos e faixas; `bordas` acha margens) e refaça até o render ficar sobreposto à referência. Faça a comparação lado a lado e mostre.

## 4 · Armadilhas já vividas

- **A referência é um screenshot de editor** (com marca d'água, placeholders de imagem, borda escura): o que parece "cinza" é a moldura de foto vazia. Meça só o que é arte.
- **A referência de story pode ter layout diferente do feed** (caixa de preço mais larga, rodapé mais baixo, logo DM maior). Quando ele mandar as duas, siga cada uma — não derive um do outro.
- **Fundo com formas curvas** (anéis, ondas, arcos): se só uma parte aparece (o resto fica sob a foto), reconstrua **só o visível** a partir da imagem (classifique pixels por cor) e deixe o oculto liso. Gere o PNG no repositório (`assets/campanhas/<campanha>/`) com nome novo.
- **Mockup de celular da referência:** se o Ryan mandar tirar, tire e redistribua; não o recoloque "por segurança".
- **"Igual, só trocando fundo e banner"** quer dizer: **mesma composição de preço, mesma diagramação, mesmos tamanhos**; fundo e banner são o que muda por campanha. Não "melhore" a diagramação.

## 5 · Entregar com a referência

No resumo final, diga: *o que peguei da referência* (a ideia, 1–2 frases) e *o que troquei* (execução). Se ele tiver mandado duas referências, diga o que veio de cada uma.
