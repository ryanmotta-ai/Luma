# O motor de render, em termos de quem monta artes

> Fonte: `js/franqueado/png-generator.js` (`fRenderTemplateLayers` — o render único), `js/00-config.js` (`gFitTextLayer`, regras), `js/core/local-fit.js` (encaixe). O **harness** (`ferramentas/render.js`) chama exatamente `fRenderTemplateLayers` + Local Fit, então o que você vê é o que o franqueado exporta. **Confirme sempre no código** quando algo parecer diferente — esta página é um atalho, não a lei.

## Layer (jsonb em `luma.templates.layers`)
Campos comuns: `id` (único no template), `name`, `type` (`shape|text|image|frame`), `x,y,w,h` (px do formato), `anchor {h,v}` (`left|right|center|stretch` × `top|bottom|stretch`), `opacity`, `visible`, `rotation` (graus; gira em torno do **centro da própria layer**), `layoutSemantic` (`produto|titulo|apoio|legal|decoracao|fundo`), `rules`.

| Tipo | Campos próprios |
|---|---|
| `shape` | `shapeKind:'rect'|'ellipse'|'path'`, `fill`, `radii{tl,tr,bl,br}`, `vectorPath{paths:[{knots:[{anchor,in,out,linked}],closed}],fillRule}` (coords **normalizadas 0–1** na caixa), `shadow…` |
| `text` | `content` (com `{{var}}`), `font`, `fontSize`, `color`, `textAlign`, `vAlign:'top'`, `lineHeight`, `letterSpacing`, `textBox:'box'`, `strikethrough`, `underline`, `isVar` |
| `image` | `imgUrl`, `imgVar`, `objectFit`, `frameShape`, `strokeW/strokeColor/strokeAlign`, `shadow…` |
| `frame` | como image **+** `radii` / `shapeKind:'path'` + `vectorPath` (máscara). Recebe a foto do franqueado via `imgVar`. |

- **Variáveis** (`isVar`): `produto, detalhes, descricao, precoDe, precoPor, validade, foto_produto, logo_loja, cupom, codigo, desconto…`. Catálogo em `luma.variaveis` (`required`, `type`, `label`). **Opcional** (`required:false`) ⇒ o chat oferece "Pular". Campo novo que não está no catálogo cai como **obrigatório** — para criar campo opcional, insira em `luma.variaveis` (só com pedido).
- **Preço partido:** `{{precoPor:inteiro}}` e `{{precoPor:centavos}}` (o motor separa em "22" e "90"). A vírgula e o `R$` são layers à parte. Preço ≥ R$ 100 estoura a caixa do inteiro ⇒ **Local Fit bloqueia a exportação** (intencional).
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

## Rotação em grupo
O motor gira cada layer em torno do **próprio centro**. Para girar um **grupo** (selo + texto dentro): calcule o centro de cada layer, rode em torno do centro do grupo, reposicione e some o ângulo — `lib.rotarGrupo(layers,cx,cy,graus)`.

## Z-order e ids
Ordem do array = ordem de pintura (primeiro = fundo). Camada de fundo: `layoutRole:'background'`, `layoutSemantic:'fundo'`, `anchor stretch`. Ids estáveis (`l-…`): story é derivado do feed **por id** (mesma lista, só mudam `y`/`h`), então **não** renomeie nem reordene entre os dois.

## O que o motor NÃO faz (planeje em volta)
Reflow automático · alinhamento vertical embaixo/meio com crescimento controlado · texto em arco · sombra com spread fino · blend avançado fora do Estúdio. Para o que falta: duplicar layers com regras, forma vetorial, PNG decorativo no repositório.
