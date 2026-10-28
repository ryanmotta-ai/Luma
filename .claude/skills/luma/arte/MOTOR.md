# O motor de render, em termos de quem monta artes

> Fonte: `js/franqueado/png-generator.js` (`fRenderTemplateLayers` — o render único), `js/00-config.js` (`gFitTextLayer`, regras), `js/core/local-fit.js` (encaixe). O **harness** (`ferramentas/render.js`) chama exatamente `fRenderTemplateLayers` + Local Fit, então o que você vê é o que o franqueado exporta. **Confirme sempre no código** quando algo parecer diferente — esta página é um atalho, não a lei.

## Layer (jsonb em `luma.templates.layers`)
Campos comuns: `id` (único no template), `name`, `type` (`shape|text|image|frame`), `x,y,w,h` (px do formato), `anchor {h,v}` (`left|right|center|stretch` × `top|bottom|stretch`), `opacity`, `visible`, `rotation` (graus, em torno do **centro da própria layer** — ⚠ na **exportação do franqueado só TEXTO e linha giram**; em shape/imagem a rotação é ignorada, veja "Rotação"), `layoutSemantic` (`produto|titulo|apoio|legal|decoracao|fundo`), `rules`.

| Tipo | Campos próprios |
|---|---|
| `shape` | `shapeKind:'rect'|'ellipse'|'path'`, `fill`, `radii{tl,tr,bl,br}`, `vectorPath{paths:[{knots:[{anchor,in,out,linked}],closed}],fillRule}` (coords **normalizadas 0–1** na caixa), `shadow…` |
| `text` | `content` (com `{{var}}`), `font`, `fontSize`, `color`, `textAlign`, `vAlign:'top'`, `lineHeight`, `letterSpacing`, `textBox:'box'`, `strikethrough`, `underline`, `isVar` |
| `image` | `imgUrl`, `imgVar`, `objectFit`, `frameShape`, `strokeW/strokeColor/strokeAlign`, `shadow…` |
| `frame` | como image **+** `radii` / `shapeKind:'path'` + `vectorPath` (máscara). Recebe a foto do franqueado via `imgVar`. |

- **Variáveis** (`isVar`): `produto, detalhes, descricao, precoDe, precoPor, validade, foto_produto, logo_loja, cupom, codigo, desconto…`. Catálogo em `luma.variaveis` (`required`, `type`, `label`). **Opcional** (`required:false`) ⇒ o chat oferece "Pular". Campo novo que não está no catálogo cai como **obrigatório** — para criar campo opcional, insira em `luma.variaveis` (só com pedido).
- **Preço partido:** `{{precoPor:inteiro}}` e `{{precoPor:centavos}}` (o motor separa em "22" e "90"). A vírgula e o `R$` são layers à parte. Preço ≥ R$ 100 estoura a caixa do inteiro ⇒ **Local Fit bloqueia a exportação** — a arte precisa de um arranjo de 3 dígitos (o chat aceita até R$ 400). Padrão (Combos Coca, 28/10/2026): as 5 camadas do grupo com `{var:'precoPor:inteiro', when:'maxLen', value:'2', then:'hide'}` + cópias `…-3d` escaladas (`visible:false` + a mesma regra com `show`). Dê ~15 % de folga na caixa do inteiro de 3 dígitos: se não couber de primeira, a caixa vizinha (POR/R$) vira parede e ele bloqueia.
  Preço de 1 dígito: o número encosta no `R$` (começa onde "00" começaria) e vírgula + centavos andam junto — padrão do "R$ 22,90". Corpo não muda; `R$`/"POR"/"DE" ficam parados. `_gLfPrecoDigito` no `local-fit.js`. Exige a camada `{{precoPor:centavos}}` no grupo.
- **Imagem por URL:** caminho relativo `assets/...` funciona no app (GitHub Pages) **e** no harness (symlink). Ao renderizar a foto do franqueado no harness use URL `http(s)`/`data:`; relativo não desenha.

## Regras (`rules`)
`[{var, when:'empty'|'filled'|'maxLen', then:'hide'|'show'|'shrinkFont'}]`, várias por layer. Usos:
- Esconder o que depende de campo vazio: risco/rótulo do preço sem `precoPor`; "DE" sem `precoDe`.
- **Reflow manual** (o motor não reflui!): faça **duas cópias** da layer que muda de lugar — uma com `hide when empty` na posição "com campo", outra com `hide when filled` na posição "sem campo". Padrão usado: descrição sobe quando `detalhes` está vazio; preço sobe e centraliza quando `precoDe` está vazio (grupo inteiro duplicado). Ambas usam o mesmo `{{var}}` (vários layers com a mesma variável são normais).

## Texto
- **Fontes:** `custom:Realce` (assets/fonts/Realce-Black…otf; maiúscula ≈ 0,69 em), `'Roboto',400|700`, `'Roboto Black'` (=900). `'Realce Black'` está aposentada (cai em Roboto 900).
- `vAlign:'top'` encosta o texto no topo da caixa; qualquer outro **centraliza verticalmente** (texto maior que a caixa transborda para os dois lados). Use `top` quase sempre.
- **Local Fit** (`gLocalFitArte`): escada **original → quebra de linha → encolhe até o piso → bloqueia**. Em caixa de 1 linha, o título longo quebra em 2 e encolhe — fica **dentro da caixa**, mas a caixa tem altura fixa: se o bloco de baixo estiver colado, **invade**. Solução: caixa do título com altura até o próximo bloco (`th`) e o bloco de baixo começando só depois (rodada 11 do refino pega isso).
- Resultado do encaixe: `status` (`original|wrapped|shrunk|…`), `invalid` (bloqueia exportação), por campo `status:'fits'|'vazio'|…`. `vazio` em campo opcional **não** bloqueia.
- Tachado nativo: `strikethrough:true` (linha de 5 % do corpo, a ~30 % da linha de base). Cor = cor do texto.
- `rotation` em texto funciona (usado até −90° para o "DE" vertical do bilhete). O Local Fit mede a caixa **sem** rotação.

## Efeitos
- **Sombra** (`shadow:true, shadowColor, shadowBlur, shadowDist, shadowAngle`): `shadowAngle` **90** = reta para baixo; padrão 135 = diagonal. Funciona em shape, image e frame.
- **Traçado em imagem** (`strokeW, strokeColor, strokeAlign:'outside'`): segue o **alpha real do PNG** (`_fContornoSilhueta`) — acompanha o canto arredondado do banner sem camada extra.
- **Traçado em shape/frame** segue a caixa/máscara (`radii` ou `vectorPath`).
- Gradiente (`gradient{stops}`) existe no motor; não foi necessário nas artes aprovadas — teste antes de prometer.

## Formas vetoriais
Path normalizado 0–1. Círculo: 4 knots lineares (`CIRC` na `lib.js`). Serrilhado: `star(n, Ro, Ri)`. Brilho de 4 pontas: `sparkle`. Vírgula do preço: `COMMA` (a glifo `,` do Realce é pequena demais, por isso é forma).

## Rotação (⚠ teste feito em 23/10/2026)
`fRenderOneLayer` (png-generator.js) só aplica `rotation` a **texto** e a `shapeKind:'line'`. Em **shape** e **imagem** a propriedade existe no jsonb e o Estúdio pode mostrá-la, mas a arte exportada/prévia do franqueado sai **sem girar**. Portanto:
- **Forma girada** → gire a **geometria**: vetor com os nós já rotacionados (ver `ticketRot` em `ferramentas/lib.js`: gira os pontos em torno do centro e recalcula a caixa).
- **Imagem girada** → gire o **PNG** (PIL `rotate(expand=True)`), nome de arquivo novo, e ajuste `w/h` à caixa nova.
- **Grupo (selo + texto)** → forma/imagem na geometria; só o texto usa `rotation`. `lib.rotarGrupo` reposiciona centros, mas **não** faz a forma girar na exportação.
Confirme no harness (`render.js`) antes de prometer qualquer giro.

## Z-order e ids
Ordem do array = ordem de pintura (primeiro = fundo). Camada de fundo: `layoutRole:'background'`, `layoutSemantic:'fundo'`, `anchor stretch`. Ids estáveis (`l-…`): story é derivado do feed **por id** (mesma lista, só mudam `y`/`h`), então **não** renomeie nem reordene entre os dois.

## O que o motor NÃO faz (planeje em volta)
Reflow automático · alinhamento vertical embaixo/meio com crescimento controlado · texto em arco · sombra com spread fino · blend avançado fora do Estúdio. Para o que falta: duplicar layers com regras, forma vetorial, PNG decorativo no repositório.

## Achados do bilhete de cupom (28/10/2026)
- **Regras `shiftX`/`shiftY`** existem (`then:'shiftY', value:'188'`): em vez de duplicar o grupo inteiro para o caso "campo vazio", desloque as camadas que mudam de lugar. Em peça inclinada some o desvio com `shiftX = −d·sen(θ)`, `shiftY = d·cos(θ)`.
- **Tracejado e pontilhado nativos**: `strokeW` + `strokeColor` + `strokeDash:[traço,vão]` + `strokeCap` num path (fechado ou aberto). Pontilhado = `strokeDash:[0.1,36]` com `strokeCap:'round'` e `strokeW` = diâmetro. Um layer no lugar de dezenas (o JSON do tracejado por retângulos passava de 14 KB).
- **Piso de hierarquia por família**: texto cujo `name`/`id`/`content` casa preço|valor|desconto|cupom|R$ entra numa família só; uma camada não encolhe abaixo do degrau menor **da família**. Código (140) maior que desconto (122) travava o código em 122 e o Local Fit bloqueava com 10 caracteres. **Mesmo `fontSize` nas duas** ⇒ sem piso entre elas e o campo longo só encolhe até 50 %.
- **Reduzir um PNG de fundo** (ex.: o selo): ponha um retângulo da cor chapada embaixo e escale a imagem — a emenda some se a cor for idêntica (medir com `medir.js cor`).
- **Preço partido num layer só**: `R${{x:inteiro}},{{x:centavos}}` vira runs (R$ e centavos pequenos e suspensos). Centralizado, aguenta 1 a 3 dígitos sem nada fixo ao lado.
- **Faixa/rodapé com texto por cima vira "placa"**: retângulo atrás de UM texto com campo, envolvendo-o, é adotado como placa e **encolhe junto** quando o texto encolhe. Faixa decorativa fixa (ex.: rodapé laranja da Entrega promocional) leva `lockPosition:true` — fica de fora da placa.
- **Percentual × reais** do campo `desconto`: o chat normaliza para "20% off" ou "R$ 5,00 off". Distinga por tamanho (`maxLen 9`), nunca 7 ("100% off" tem 8).

## Achados da leva "Aqui tem cupons" (28/10/2026, 10 artes, portão de 254 renders)
- **Texto FIXO também entra na família**: "pega este cupom", "Cole o cupom antes de pagar", "VALE CUPOM" casam `cupom` e viram piso do código se forem MENORES que ele → código de 16 caracteres bloqueia. Ou o texto fixo fica maior que o código, ou a palavra sai ("Cole o **código**").
- **O número só encolhe até 50 % do corpo desenhado.** Dimensione o corpo pelo pior caso no piso. Medido no motor (Roboto Black, runs): `R$150,00` ≈ **6,6×** o corpo, `R$15,00` ≈ 5,4×, `100%` ≈ 5,1×; código "W"×16 em Roboto Bold itálico ≈ 15×. Ex.: caixa de 824 px ⇒ reais com corpo ≤ 250.
- **`{{x:inteiro}}%` não some sozinho com o campo vazio** (o "%" fixo impede o "tudo vazio"): o encaixe mede o nome do campo e bloqueia com "não tem espaço seguro para …". Ponha `{var:x, when:'empty', then:'hide'}` explícito em toda camada que mistura token e texto fixo.
- **Regra por parte inteira**: `var:'desconto:inteiro'` (ou `precoPor:inteiro`) com `maxLen` separa 1, 2 e 3 dígitos (`gApplyRules`, desde 28/10).
- **Texto rico em texto fixo**: `runs:[{text, font, fontSize, color, italic}]` faz Light + Bold numa camada só, centralizada, sem medir nada — só quando o `content` não tem `{{}}`.
