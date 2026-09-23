# LOCAL FIT CONTRACT

 > **Contrato vigente — 23/09/2026.** Texto cabe na caixa; cadeias verticais declaradas
> podem compartilhar espaço e deslocar seus próprios membros. Fora desses vínculos, apenas
> o par inferido legado e as placas continuam como exceções locais. Nenhuma composição global.

### Cadeia vertical e conjuntos de fonte

- Autoria usa `relativeAnchor: { layerId, type:'top-to-bottom', gap }`, já existente no Estúdio.
- O runtime valida a cadeia por ID antes de mover: pai ausente, ciclo, ramificação, rotação,
  texto vertical ou alinhamento que não seja no topo ficam fora do recorte suportado.
- Mede a altura final de **todos** os membros com `gFitTextLayer`; largura é fixa. A busca
  reduz os tetos de fonte em 8%, no máximo 60 passagens, sempre respeitando os pisos.
- Crescimento mantém os gaps; conteúdo curto preserva a posição autorada. Nenhum membro sobe.
- Cada membro respeita o objeto externo abaixo de sua faixa horizontal e a margem/safe zone.
  Placas acompanham o texto, e sua largura também participa do limite externo.
- A movimentação é transacional: se o conjunto não cabe, nenhum deslocamento da cadeia é aplicado.
- `fitFontGroup` é um identificador autorado para campos com tamanho de fonte sincronizado,
  limitado à mesma prancheta. Sem esse identificador, aparência semelhante não cria vínculo.
  No Estúdio: **Editar → Tipografia → Mesmo tamanho de fonte**; escolher outro campo vincula
  os dois. “Independente” remove o vínculo da camada selecionada. Texto fixo não participa.
- Âncoras e `fitFontGroup` viajam no JSON das camadas e no histórico de desfazer/refazer.
- Diagnóstico de um campo em cadeia/conjunto remede o contexto completo, com os demais valores
  preservados. O encaixe isolado continua atendendo textos independentes.
- O par inferido para templates antigos mantém a heurística anterior; não infere cadeias novas.
- O editor mantém o desenho autorado. A acomodação acontece no runtime do franqueado e no teste
  de tensão do Estúdio, como antes. Não se altera o canvas sob o cursor.

Validação: `tests/local-fit-cases.js` cobre crescimento simultâneo, gaps, ordem no array,
serialização, retorno curto/longo/curto, falha sem movimento parcial, relações inválidas,
fontes independentes, conjunto explícito, placa e igualdade de pixels entre prévia e PNG.

Os números de corpus e descrições datadas abaixo registram etapas anteriores; não são medições
novas desta revisão. O contrato vigente acima substitui as antigas garantias de “nada se move”.

---

## 0. Estado — e o que ele substituiu

Este documento nasceu descrevendo uma **frente paralela em shadow**, construída ao lado do
Automatic Designer para responder a uma pergunta: *quanto dá para resolver sem recompor?*
A resposta medida no corpus foi **87,5%** (§10). Com ela na mesa, a decisão de produto mudou.

**O Automatic Designer foi REMOVIDO do repositório em 09/2026.** Saíram: Layout Grammar,
Composition Graph, Layout Components, elasticidade, impact zones, operational capability,
designer moves, Candidate Search (beam), scoring lexicográfico, candidate selection, adaptive
scale groups, zonas mortas perceptuais, shadow validation, confiança e rollout — e junto com
eles a escada de recomposição que vivia dentro do `gApplyRelativeAnchors` (correntes inferidas,
corredores, respiro, empurrão, escala de componente, emergência, alternativas por nota).

O que ficou no lugar:

| Antes | Agora |
|---|---|
| `gApplyRelativeAnchors(fitText:true)` recompunha a arte | `gApplyRelativeAnchors` interpola e resolve âncora MANUAL, só |
| `gLayoutEscolherAlternativa` escolhia composição por nota | não existe; não há o que escolher |
| `gLayoutDiagnosis` re-rodava o solver até 8 vezes | `gLocalFitDiagnostico`, busca binária sobre o Local Fit de UMA camada |
| `gDescribeFranchiseeLayout` comparava dois solves | `gLocalFitArte` devolve o laudo direto |
| veredito `original`/`adapted`/`unsafe` | `original`/`wrapped`/`shrunk`/`overflow` |
| `LUMA_LAYOUT_UNSAFE` | `LUMA_CONTENT_TOO_LARGE` |

**Garantia histórica da primeira versão (substituída pelo contrato vigente acima):** nenhum elemento se move
por causa de outro. A única geometria que o Local Fit escreve fora do próprio texto é a da
**placa ligada àquele texto** (§9 do `LUMA.md`). O corpus e o fuzz cobram isso camada a camada,
comparando com a geometria publicada.

**Onde ele está ligado:** `index.html` carrega `js/core/local-fit.js`;
`fRenderTemplateLayers` (`png-generator.js`) chama `gLocalFitArte` no escopo `franqueado`;
o teste de tensão do Estúdio (`canvas.js`) chama o mesmo par para não mentir ao designer.

---

## 1. Princípio

**EXPLICIT > INFERRED.** Se o designer desenhou uma caixa de texto, essa caixa é informação
explícita: não precisa ser inferida de grafo nenhum.

```
conteúdo novo
  → Local Fit (na caixa autorada daquele texto)
      cabe?  sim → desenha, zero alteração
             não → CONTENT_TOO_LARGE, com pixels, linhas, corpo e piso
                   → exportação BLOQUEIA · prévia mostra e explica
```

**No contrato original não existia fallback.** As exceções locais vigentes estão descritas acima: era exatamente aqui que o
Automatic Designer entrava, e é por isso que ele não existe mais.

---

## 2. Arquitetura

Uma casca determinística sobre os motores que já existem. **Nenhuma régua nova.**

| O que Local Fit precisa | Quem já responde | Onde |
|---|---|---|
| medir texto como o render mede | `gFitTextLayer` | `js/00-config.js:1579` |
| quebrar linha | `gSmartWrapText` (via `gFitTextLayer`) | `js/00-config.js:3512` |
| unidade semântica, preço, preposição | `gSemanticUnits` | `js/core/auto-layout.js:449` |
| piso de fonte normal | `gLayoutPisoFonte(l, false)` | `js/00-config.js:2037` |
| pisos de hierarquia/legibilidade | `gStampPisosHierarquia` | `js/00-config.js:1374` |
| entrelinha efetiva | `gLineHeightDe` | `js/00-config.js:1461` |
| teto de linhas por papel | `_gLayoutMaxLinhas` → `gLayoutRoleMaxLines` | `js/00-config.js:2575` |
| tirar carimbo da cascata | `gLayoutLimpaCarimbos` | `js/core/auto-layout.js:101` |
| texto autorado provável | `gLayoutTextoAutorado` | `js/core/auto-layout.js:114` |
| "isto é uma placa?" | `gLayoutFormaEhPlaca` / `gLayoutPlacaSegue` | `js/00-config.js:2084` |

A medição isolada não escreve na camada recebida. O runtime da arte aplica resultados em clones.

```js
gAuthoredTextBox(layer, opts)               // → o modelo da caixa autorada (leitura)
gFitTextToAuthoredBox(layer, conteudo, opts) // → { status, degrau, text, lines, ... }
```

`opts`: `{ canvas, layers, placa, ctx }` — todos opcionais.
`layers` + `canvas` só servem para carimbar os pisos **em clones** e obter o mesmo piso que a
produção usaria; sem eles, o piso cai no padrão do render (50% do corpo autorado).

---

## 3. Authored box model

A caixa autorada é formalizada com **origem declarada**, para que seja auditável de onde ela
veio. Ordem de confiança:

| Prioridade | Fonte | `origemCaixa` | Por quê |
|---|---|---|---|
| 1 | `layer.layoutRef` | `'layoutRef'` | é o contrato carimbado no vínculo (`gStampLayoutBaseline`): geometria, corpo, entrelinha, tracking, alinhamento, nº de linhas e a **tinta** do texto original. Imune ao que o runtime fez. |
| 2 | `layer._layoutBase` | `'_layoutBase'` | a base visual do solve corrente (só geometria) — é o pré-adaptação daquela volta. |
| 3 | a camada com os carimbos removidos | `'camada'` | template antigo, sem baseline. |

Em **todos** os casos o objeto passa por `gLayoutLimpaCarimbos`, que retira `_tetoFonte`,
`_layoutW`, `_layoutDx`, `_layoutMaxLines`, `_entrelinha`, `_fit`, `_layoutBase`, `_foraDaArte`.

> ⛔ **Por que isso é a primeira invariante.** `gApplyRelativeAnchors` trabalha em CLONES e
> move/encolhe `x/y/w/h/fontSize` neles. Ler um clone adaptado como "o que o designer desenhou"
> faria a caixa encolher a cada volta. Provado nos casos 14a/14b.

O que o modelo expõe: `x y w h · fontSize · lineHeight · letterSpacing · textAlign · textBox ·
textTransform · vertical · quebravel · piso · textoAutorado · tintaAutorada{w,h} ·
linhasAutoradas · maxLinhasEditorial · larguraDisponivel · alturaDisponivel · origemCaixa`.

### A tinta autorada é o piso da caixa

O `w/h` que vem do PSD costuma ser o bbox **justo** do texto original. Com `lineHeight` 1.2 a
tinta de uma linha pode medir 1px a mais que a caixa desenhada. Sem tratamento, o **próprio
texto do designer** sairia como OVERFLOW — o oposto do ORIGINAL FIRST.

```
larguraDisponivel = max(caixa desenhada, tinta autorada.w)
alturaDisponivel  = max(caixa desenhada, tinta autorada.h)
```

Consequência: **"conteúdo igual ao autorado ⇒ FITS" é verdade por construção**, não por sorte
de arredondamento. Caso 1b cobra isso em quatro geometrias, inclusive caixas propositalmente
apertadas.

---

## 4. A escada local

Conservadora, e **nada além do texto alvo se move**.

| # | Degrau | O que acontece | `degrau` no retorno |
|---|---|---|---|
| 1 | corpo autorado | mede no `fontSize` do desenho | `original` |
| 2 | wrap semântico | `gSmartWrapText` dentro do mesmo passo de medida | `wrap` |
| 3 | linhas novas dentro de `maxLines` | idem — o teto é validado no mesmo passo | `wrap` |
| 4 | shrink progressivo | `fs ← max(piso, floor(fs × 0,92))`, remedindo tudo | `shrink` |
| 5 | parar no piso normal | o laço termina em `fs === piso` | — |
| 6 | declarar overflow | status `overflow` com diagnóstico | `piso` |

> **Por que 1–3 são um passo só de execução.** `gFitTextLayer` no corpo autorado JÁ chama
> `gSmartWrapText` quando a camada é caixa de parágrafo. Transformar isso em três chamadas
> seria criar uma segunda quebra — exatamente o que o contrato proíbe. Eles se distinguem no
> **resultado**, não na execução.

O degrau de **0,92** é o mesmo que o teto de linhas do `gFitTextLayer` usa. Inventar um passo
diferente faria o Local Fit e o motor pararem em corpos distintos para o mesmo texto.

**Texto de ponto quebra na caixa desenhada — caixa do Illustrator (decisão do Ryan, 22/09/2026).**
Antes texto de ponto só encolhia, e o franqueado via a frase atravessar a caixa numa linha só.
Agora, em cada corpo: linha única primeiro (o autorado nunca muda); não coube na LARGURA,
quebra em `w` (a largura que o designer desenhou, nunca uma inventada); as linhas lotaram a
ALTURA, desce o corpo. A quebra chega ao render por `_layoutW = w` (o resultado traz
`layoutW`), que `gFitTextLayer` e `fRenderOneLayer` já honram. Nada se move. `box.quebravel`
continua querendo dizer só "caixa de parágrafo". Casos 7b–7d em `tests/local-fit-cases.js`.

**Fora do escopo, sempre:** mover outro elemento, alterar container externo, escalar componente,
emergência, corredor, `_layoutW`.

---

## 5. Width + height — a caixa é 2D

Os dois eixos são vereditos independentes, e **os dois** podem reprovar sozinhos:

```
overflowX = max(0, larguraNecessaria − larguraDisponivel)
overflowY = max(0, alturaNecessaria  − alturaDisponivel)
FITS ⟺ overflowX ≤ 1 && overflowY ≤ 1 && linhas ≤ maxLinhas
```

A tolerância de **1px** é a mesma do `estourou` do motor (`m.altura > boxH + 1`) — sem ela o
arredondamento de `Math.round` viraria veredito.

O caso que motiva tudo isto (caso 6): *o texto quebra corretamente em largura, mas quatro
linhas ultrapassam a altura* → **ainda é overflow**, e o motor de hoje não enxergaria: o
`estourou` do `gFitTextLayer` só olha largura para caixa de parágrafo.

A largura disponível **espelha** a conta do motor: caixa de parágrafo desconta o padding de
`0,08em` de cada lado; texto de ponto compara com a largura crua. Quem mexer no bloco
"4) ENCOLHER" do `gFitTextLayer` mexe em `_gLfLarguraCaixa` junto.

---

## 6. maxLines — como a inferência funciona

Regra explícita vence sempre. Sem ela, infere-se de forma conservadora.

```
maxLinhas(fs) = max( linhasAutoradas , min( editorial , geométrico(fs) ) )

editorial      = layer.maxLines  (se número finito > 0)
               | _gLayoutMaxLinhas(camada)   → papel compilado, e o nome como rede
                                               título 3 · produto 3 · preço 2 · CTA 2
                                               apoio 4 · legal 8 · default 4
geométrico(fs) = max(1, floor(alturaDisponivel / (fs × lineHeight)))
```

Quatro decisões, e o porquê de cada uma:

1. **`layer.maxLines` manda em tudo.** É o único campo que um designer pode definir à mão.
   Ele não é obrigatório — ninguém precisa configurar nada para o contrato funcionar.
2. **`_layoutMaxLines` (com underscore) NUNCA entra.** É carimbo de runtime, geometria
   adaptada. Caso 8c cobra.
3. **O geométrico é recalculado a cada degrau.** Um corpo menor cabe em mais linhas; travar o
   teto no corpo autorado declararia overflow onde o encolhimento resolveu. Recalculando, o
   teto geométrico vira exatamente o mesmo fato que o `overflowY` — redundante de propósito,
   para que "quantas linhas esta caixa aceita" tenha **um** dono.
4. **Nunca abaixo de `linhasAutoradas`.** Se o designer desenhou em 4 linhas, 4 linhas são
   legais por definição. Um teto que reprova o próprio desenho é teto errado.

---

## 7. Piso

`gLayoutPisoFonte(camada)` — piso único. O modo de **emergência** (escala proporcional de
componente) não existe mais: era movimento de composição, e composição saiu do produto. O
parâmetro foi removido da assinatura. Caso 5b cobra a igualdade com o motor.

O piso real é `min(fontSizeAutorado, max(8, pisoDoMotor))` — Local Fit **nunca aumenta** a
fonte (caso 17 cobra `fontSize ≤ fontSizeAutorado` em toda a grade hostil).

Com `opts.layers` + `opts.canvas`, os pisos de hierarquia e de legibilidade são carimbados em
**clones** e o piso local fica byte a byte igual ao da produção. Sem eles, o piso é o padrão
histórico do render (50% do corpo autorado).

---

## 8. Fail-safe

Chegou ao piso normal e não coube: **para**. Não continua diminuindo.

```js
{
  status: 'overflow',
  degrau: 'piso',
  fontSize: <= piso>,                    // exatamente o piso
  overflowX, overflowY,                  // pixels excedidos, mensuráveis
  diagnostics: {
    motivo: 'largura excedida em 625px · precisa de 5 linhas e o teto é 2',
    larguraDisponivel, larguraNecessaria,
    alturaDisponivel,  alturaNecessaria,
    linhas, maxLinhas, linhasAutoradas,
    fontSizeAutorado, piso, noPiso: true,
    quebravel, degraus, passos: [...],   // a escada inteira, degrau a degrau
    placa                                // §Placa interna
  }
}
```

**Nunca "parece que coube".** O status é sempre um dos dois, e um `overflow` sempre traz
excesso mensurável — caso 5 falha se vier bloqueio sem número.

Na **arte inteira** (`gLocalFitArte`), cada overflow vira um item de `result.bloqueios` no
formato do item 8 do briefing:

```js
{ status:'CONTENT_TOO_LARGE', fieldId, campos, overflowX, overflowY,
  requiredLines, maxLines, fontSize, minimumFontSize, motivo }
```

`fRenderTemplateLayers` lança `LUMA_CONTENT_TOO_LARGE` na **exportação** e segue desenhando na
**prévia** — a pessoa precisa VER o que não cabe para saber o que encurtar.

### Placa interna

Quando a placa/selo faz parte explicitamente do próprio campo e passa pela régua estável
(`gLayoutFormaEhPlaca`), o retorno ganha `diagnostics.placa` com `mismatch`, a geometria atual
e a que seria coerente (`gLayoutPlacaSegue`). Na API de UMA camada isso é **diagnóstico
apenas** — nada é reposicionado, e o caso 18 falha se a placa for tocada. Na arte inteira
(`gLocalFitArte`) a placa do próprio campo de fato ACOMPANHA a tinta: é a única exceção do
contrato (item 9 do briefing), e o caso 22 cobra que seja a única geometria escrita.

---

## 9. Riscos e limitações

### 9.1 Duas limitações **encontradas** em primitivas compartilhadas — não corrigidas

Achadas ao montar os testes. A regra desta frente é **parar e documentar**, e é o que foi feito.
Ambas são pré-existentes, valem para a produção de hoje e pertencem ao dono do motor de quebra.

**(a) A proteção de preposição órfã só vale no regime de busca.**
`gSmartWrapText` busca partição para `n = 2..3` linhas e no máximo 12 palavras (exaustivo até
8). Fora disso cai no encaixe guloso, que é prova de encaixe e não de editoria. Medido:

```
caixa 360px / 48px, frase de 7 palavras → "Combo de" / "Burger com" / "Batata e" / "Refrigerante"
                                           três linhas terminando em conector
```

Na bancada, sobre 71 resultados com 2+ linhas: **4,2% terminam linha em preposição**.

**(b) Em `gSemanticUnits`, a cola de conector é avaliada antes do par semântico.**
O laço testa `casaConector` junto com `casaPar` e sai com `break` depois de colar UMA palavra.
Em `"... por R$ 999,90"`, o `por` gruda no `R$` e o valor fica órfão na linha seguinte:

```
"De R$ 1.249,00 por R$"
"999,90 com 500 ml de brinde"
```

Medido: **4,2%** dos resultados multi-linha saem com unidade semântica partida.
Correção provável (uma linha): dar precedência ao par semântico sobre o conector quando ambos
casarem. **Não aplicada** — é primitiva da outra frente.

### 9.2 Riscos desta camada

| Risco | Gravidade | Mitigação |
|---|---|---|
| `_gLfLarguraCaixa` **espelha** a conta de padding do `gFitTextLayer`. Se alguém mudar lá e não aqui, medida e veredito divergem. | alta | comentário apontando o bloco de origem nos dois lados; caso 15 compara os dois resultados e falha na divergência. |
| O piso depende de `opts.layers`. Sem eles, o piso é o padrão de 50% — mais permissivo que o de produção, então o shadow pode **subestimar** o overflow. | média | documentado; a bancada sempre passa `layers`. |
| `gLayoutTextoAutorado` devolve `''` quando não há baseline nem exemplo confiável. Aí a tinta autorada é `{0,0}` e a caixa desenhada vira o único limite — que pode ser mais apertado que a realidade autoral. | média | é o comportamento conservador correto (declara overflow em vez de aprovar no escuro), mas vale medir no corpus legado. |
| Local Fit só enxerga o vazio ABAIXO da caixa (respiro, §16). Texto centralizado, crescendo para o lado ou um vizinho desenhado dentro da própria caixa continuam fora da conta. | média | o respiro para no primeiro objeto da faixa, com folga de ¼ do corpo; o linter 4b avisa o designer quando não há vazio. |
| `p95 de 9,5ms` por campo no caminho ponta a ponta do corpus. | média | §11. |

---

## 10. Corpus — a medição que motivou a decisão

> ⚠ Os números abaixo foram medidos com o Local Fit em SHADOW, antes de ele virar o runtime, e
> ficam como o registro da medição que motivou a decisão. As medições de hoje:
>
> | Instrumento | Unidade | Resolvido sozinho |
> |---|---|---|
> | `tests/_local-fit-bancada.html` | por CAMPO (48) | **83,3%** — original 50%, wrap 6,3%, shrink 27,1%, overflow 16,7% |
> | `tests/corpus.html` | por ARTE (23 cenários) | **78,3%** — curto 100% original, médio 100% original, longo 50% shrink / 50% overflow, extremo 60% shrink / 40% overflow |
>
> A diferença entre os dois é de método, não de motor: uma arte com quatro campos vira overflow
> se um único deles não couber.

`node scripts/run-browser-tests.js _local-fit-bancada` (com `LUMA_VERBOSE=1`).
48 campos = 6 materiais reais de `tests/corpus/` × cenários × campos dinâmicos.
**Nenhuma escrita em produção, nenhuma camada tocada.**

| Recorte | original | wrap | shrink | overflow |
|---|---|---|---|---|
| **TOTAL (n=48)** | **50,0%** | 8,3% | 29,2% | **12,5%** |
| cenário `nominal` (n=16) | **100%** | 0% | 0% | 0% |
| cenário `longo` (n=16) | 25,0% | 18,8% | 37,5% | 18,8% |
| cenário `extremo` (n=13) | 7,7% | 7,7% | 61,5% | 23,1% |
| `promo-preco-circulo` | 33,3% | 11,1% | 22,2% | 33,3% |
| `card-placa-grupo` | 33,3% | 0% | 66,7% | 0% |
| `de-por-lateral` | 66,7% | 0% | 16,7% | 16,7% |
| `foto-safe-zone` | 33,3% | 0% | 66,7% | 0% |
| `legado-sem-baseline` | 77,8% | 11,1% | 0% | 11,1% |
| `bloco-arejado` | 33,3% | 33,3% | 33,3% | 0% |

**A leitura que importa:**

- **O cenário nominal sai 100% `original`.** ORIGINAL FIRST vale no corpus inteiro: conteúdo do
  tamanho autorado ⇒ zero alteração, em todos os 16 campos.
- **87,5% do corpus resolve sem o Automatic Designer.** Os 12,5% restantes são o trabalho real
  da outra frente.
- **Os overflows têm um padrão.** Quatro dos seis são **texto de ponto** (`Título` de
  `promo-preco-circulo` e `legado-sem-baseline`), que por contrato não quebra no escopo local:

```
[promo-preco-circulo · longo]   Título  → largura excedida em 109px · corpo 88→58px (piso 58)
[promo-preco-circulo · extremo] Título  → largura excedida em 625px · corpo 88→58px (piso 58)
[promo-preco-circulo · extremo] Produto → altura excedida em 196px · precisa de 5 linhas
                                          e o teto é 2 · corpo 58→56px (piso 56)
[de-por-lateral · longo]        Produto → largura excedida em 117px · corpo 96→84px (piso 84)
[de-por-lateral · extremo]      Produto → largura 117px + altura 153px · 4 linhas, teto 2
                                          · corpo 96→84px (piso 84)
[legado-sem-baseline · longo]   Título  → largura excedida em 66px · corpo 80→54px (piso 54)
```

  É exatamente onde o corredor (`_layoutW`) e o empurrão da cascata ganham o pão: dar largura
  de quebra a um texto de ponto é decisão de composição, não local.
- **O piso morde cedo.** Em `de-por-lateral` o piso é 84 de 96px — a escada desce dois degraus
  e para. É o piso de legibilidade/hierarquia funcionando, não uma falha.

### Stress (n=72, grade sintética)

| | original | wrap | shrink | overflow |
|---|---|---|---|---|
| **TOTAL** | 19,4% | 22,2% | 34,7% | 23,6% |

Grade: 6 formas de caixa (referência, estreita, baixa, larga/baixa, estreita/alta, generosa) ×
6 conteúdos (curto, médio, longo, absurdo, palavra muito longa, preço+unidade) × 2 fontes
(texto e display em caixa alta). Achados:

- **Caixa estreita e alta é a mais resiliente** — quase tudo resolve só com wrap (até 12 linhas).
- **Caixa baixa é a mais frágil**: `620×70` chega a −44% de corpo no título longo.
- **Fonte display em caixa alta custa caro.** A mesma grade sai com 4 `OVER` onde a fonte de
  texto sai com 1: caixa alta + peso 900 + tracking medem muito mais. Ex.: `260×900` com
  "título longo" é `wrap` em texto e `OVER` em display.
- **Texto absurdo (~200 palavras) é `OVER` em 11 das 12 caixas** — é o limite honesto: nenhum
  encaixe local salva conteúdo dessa ordem, e é bom que ele diga isso em vez de encolher até 8px.

---

## 11. Benchmark

`N=200` por regime, medido quente (cache do motor aquecido — o caso real de quem digita letra a
letra no mesmo campo) e frio (`_G_MEDIDA_CACHE` zerado a cada volta — a primeira tecla).

| Regime | degraus | quente p50 / p95 | frio p50 / p95 |
|---|---|---|---|
| fit original (cabe de primeira) | 1 | 0 / 0,1 ms | 0 / 0,1 ms |
| wrap (2–3 linhas, sem encolher) | 1 | 0 / 0,1 ms | 0,3 / 0,6 ms |
| shrink até resolver | 2 | 0 / 0,1 ms | 0,4 / 1,0 ms |
| shrink até o piso (overflow) | 8 | 0 / 0,1 ms | 2,8 / 4,2 ms |

**Campo do corpus, ponta a ponta** (inclui clonar a arte e carimbar os pisos, com `opts.layers`):
`p50 2,3ms · p95 9,5ms · máx 11,5ms · n=48`. O máximo é o primeiro campo medido — ele paga o
aquecimento do canvas e da fonte e não se repete.

**Leitura.** O caminho quente é grátis (memoização do próprio motor). O custo real é o
**`p95 de 9,5ms`**, e ele **não** vem do encaixe: vem de clonar a arte inteira e rodar
`gStampPisosHierarquia` a **cada chamada**.

> **Recomendação para quando esta camada for ligada:** carimbar os pisos **uma vez por arte**
> e passar a camada já carimbada, em vez de passar `opts.layers` por campo. Isso tira a parte
> `O(nº de camadas)` do caminho de digitação e deixa o custo por tecla na casa do sub-milissegundo.
> Não foi feito agora porque mudaria a assinatura por causa de um consumidor que ainda não existe.

---

## 12. Testes

`node scripts/run-browser-tests.js local-fit` — **26/26 verdes**. É portão de CI (sem `_`).

| # | Caso | Cobre |
|---|---|---|
| 1 | conteúdo do tamanho autorado → FITS, `original`, zero alteração | item 1, 9 |
| 1b | o próprio texto autorado sempre cabe, em 4 geometrias | invariante da tinta autorada |
| 2 | texto cresce, a caixa tem altura → resolve só com wrap | item 2 |
| 3 | wrap não basta → sobe para shrink, a escada só desce e respeita o piso | item 3 |
| 4 | shrink resolve **antes** do piso, corpo final entre piso e autorado | item 4 |
| 5 | chegou ao piso → OVERFLOW com diagnóstico completo e não vago | itens 5, 11 |
| 5b | o piso é `gLayoutPisoFonte(l,false)`, nunca emergência | item 6 |
| 6 | largura cabe, altura não → overflow vertical mensurável | item 6, 7 |
| 7a | caixa alta e estreita: só falta largura → wrap | item 7 |
| 7b | texto de ponto não vira caixa: não quebra, só encolhe | item 4 |
| 8 | `maxLines` explícito manda e nunca é ultrapassado num FITS | item 8 |
| 8b | sem regra explícita, o teto é papel ∩ altura, nunca abaixo do autorado | item 8 |
| 8c | o teto nunca vem de `_layoutMaxLines` (carimbo de runtime) | itens 2, 8 |
| 9 | nenhuma linha termina em preposição, nenhuma unidade é partida | item 5 |
| 9b | a quebra é byte a byte a de `gSmartWrapText` | item 5 |
| 10 | uppercase e fonte display: transformação do render, medida honesta | item 10 |
| 11 | preço e unidade não quebram errado | item 11 |
| 12 | mesmo conteúdo → mesmo resultado, byte a byte | item 12 |
| 13 | texto A em overflow → fundo, texto B, preço, CTA, foto e placa externa **idênticos** | item 12 |
| 14a | carimbos da cascata ignorados (teto, corredor, entrelinha) | item 2 |
| 14b | com baseline, `layoutRef` vence a geometria corrente | item 2 |
| 15 | paridade: texto, linhas, corpo, largura e altura iguais ao `gFitTextLayer` | item 10 |
| 16 | bordas: shape → `null`, texto vazio/nulo → FITS sem inventar veredito | fail-safe |
| 17 | 35 combinações hostis: status sempre válido, geometria finita, nunca passa do piso, nunca aumenta a fonte, escada limitada | itens 10, 11 |
| 18 | placa do próprio campo vira diagnóstico e nada é reposicionado | item 13 |
| 19 | espiões: Local Fit não chama Candidate Search / beam / scoring / alternativa | item 18 |

As asserções são **relacionais** de propósito (status, degrau, ordem, monotonia). Cravar pixels
ataria a suíte à métrica da fonte instalada na máquina — é exatamente o que derruba o bloco
golden do `tests/corpus.html` fora do CI.

### Suíte completa

`node scripts/run-browser-tests.js` — **verde em 10 das 12 suítes**, `local-fit` inclusa (26/26).
As duas vermelhas são **pré-existentes e ambientais**, não desta frente:

```
✕ auto-layout — 220/221   "teto de linhas não encolhe a letra quando há espaço"
✕ corpus      —  17/25    8× "a camada X moveu Npx (tolerância 32)"
```

Elas rodaram contra o HEAD **limpo**: `git status` não mostra nenhum arquivo de produção
modificado, e `local-fit.js` só é carregado por `tests/local-fit.html` e
`tests/_local-fit-bancada.html`. É estruturalmente impossível que esta frente as cause. A causa
conhecida: `tests/corpus.html` não carrega `js/designer/canvas.js`, então `dTextFontParts` fica
`undefined`, o `font:'Arial'` dos fixtures é ignorado e a medida cai no fallback `Roboto` — que
existe nesta máquina e não existia na que gravou o golden.

---

## 13. Arquivos

```
js/core/local-fit.js              o motor: caixa autorada, escada, arte inteira, diagnóstico
tests/local-fit.html/-cases.js    37 casos — o comportamento inteiro
tests/_local-fit-bancada.*        instrumento (fora do CI): corpus, stress e benchmark
docs/LOCAL-FIT-CONTRACT.md        este documento
```

Ligado em `index.html`, consumido por `js/franqueado/png-generator.js` (prévia e exportação) e
por `js/designer/canvas.js` (teste de tensão do Estúdio).

---

## 14. O que ficou em aberto

1. **Wrap puro quase não aparece.** No corpus, nenhum cenário resolve só com quebra: ou já cabe,
   ou precisa encolher. É consequência de caixa de PSD ser o bbox justo do texto — a altura não
   sobra. Não é defeito, mas significa que o degrau `wrapped` está pouco exercido em arte real.
2. **A UI do bloqueio existe** (`fCorrigirTextoLongo`, em `js/franqueado/chat.js`) — ver §15.
3. **Placa em cadeia.** Uma placa que é placa de um texto que é placa de outro não existe no
   corpus e não é tratada. Se aparecer, o comportamento é: só a placa direta acompanha.
4. **Safari/iOS e Android reais.** A deriva de fonte é medida e corrigida, mas nunca foi
   exercida nesses navegadores — segue no `luma-brain/07_ROADMAP.md`.
5. **Piso que preserva a hierarquia — medido e NÃO ligado (22/09/2026).** Guardar 1/3 do salto
   até o degrau de baixo (título de 60 não desce a 34 sobre subtítulo de 30) levou o bloqueio
   do corpus de 17,4% a 26,1% e +16 bloqueios no fuzz. Decisão de produto pendente (Ryan);
   hoje a hierarquia achatada cai no aviso de letra pequena (§16).
6. **No bloqueio, a prévia desenha o texto estourando** — e o texto de ponto agora estoura
   para BAIXO, podendo cobrir o campo vizinho. O download continua travado; o aviso só nomeia
   o PRIMEIRO campo bloqueado.

## 16. Rodada de 22/09/2026 — o que entrou

| O quê | Onde | Caso |
|---|---|---|
| Texto de ponto quebra na caixa desenhada antes de encolher | `gFitTextToAuthoredBox` | 7b–7d |
| Com placa, a altura útil é o INTERIOR da placa (CTA de 70px virava 152px e cobria a foto) | idem | 15b |
| Campos com `fitFontGroup` explícito saem no mesmo corpo, respeitando seus pisos | `gLocalFitArte`, fase 2 | 15c, 15d |
| "por R$ 999,90" não parte o preço | `gSemanticUnits` | 15e |
| Viúva (palavra sozinha fechando o bloco) pesa na escolha da quebra, quando há alternativa | `_gSmartWrapCalc` | — |
| Contador de caracteres mede com o Local Fit, não com a régua antiga | `fMaxLenDaCaixa` | — |
| Aviso laranja "letra pequena" na prévia: coube a ≤75% do corpo com 20+ caracteres | `_fLpSyncBloqueio` | fluxo |
| Linter 4b: campo com altura para 1 linha só, somando o respiro livre embaixo | `linter.js` | — |
| **Respiro abaixo da caixa** (decisão do Ryan): texto ancorado no topo cresce PARA BAIXO até o próximo objeto na mesma faixa, menos ¼ do corpo; teto na margem e na safe zone do Story; o painel que contém a caixa e a placa do próprio texto não contam; sem camadas/prancheta não cresce. Nada se move — o render já desenha para baixo; `_layoutH` só alarga o toque da prévia. Na arte da Copa, "COMBO FAMÍLIA TORCEDOR" e "PIZZA GRANDE CALABRESA" deixaram de bloquear | `_gLfEspacoAbaixo` | 15f–15i |
| Palavra partida ("RECHEA-" / "DA") não conta como caber: desce o corpo | `gFitTextToAuthoredBox` | 15j |
| **Copy Fit** — a versão curta que cabe, oferecida (nunca aplicada sozinha) nas três portas abaixo | `js/core/copy-fit.js` | `tests/copy-fit.html` (31) |
| **Pilha do designer** (decisão do Ryan): `relativeAnchor top-to-bottom` passa a valer com o encaixe. O TOPO da pilha cresce até o menor vazio livre embaixo de qualquer membro; depois do encaixe os membros descem exatamente o que o topo cresceu (placa junto) — fase 4 do `gLocalFitArte`. Só âncora MANUAL; só desce; membro não reserva respiro. Na arte da Copa, com o Detalhes ancorado, "X-TUDO DUPLO COM BACON" e "VAMO DALE MEU PRA NAO TOMAR" deixam de bloquear (67px, 3 linhas) e "COMBO FAMÍLIA" fica no corpo do designer (95px, 2 linhas) | `_gLfTetoPilha` · `_gLfPilha` | 15k–15n |
| **Pilha inferida no bloqueio** (23/09/2026, revê o "só âncora manual"): sem âncora, quando o texto BLOQUEARIA, o vizinho que o linter 4c aponta (logo abaixo, até 1,5 linha; mesma coluna pela borda esquerda ou centro; nada entre os dois) vira membro e desce junto. Um nível só; o que cabe sem pilha não mexe em ninguém. Na arte da Copa sem âncora, "QUANTO TU SABE MANO SOBRE" deixou de bloquear (61px, 4 linhas) e parou de ser desenhado por cima do Detalhes. Na bancada do Copy Fit, 73 dos 260 bloqueios passaram a caber sozinhos | `_gLfPilhaInferida` | 15l–15l3 |
| Linter 4c: sugere ancorar a camada que está logo abaixo de um campo de texto na mesma coluna ("Ancorar"), com o gap que mantém a posição de hoje; preço/desconto/código não são topo | `linter.js` | — |

⚠ O respiro muda o contrato de 18/09: o Local Fit deixou de ser cego para vizinhos, mas SÓ para ler o vazio abaixo — continua sem mover, empurrar ou recompor nada. A única exceção é a pilha (ancorada, ou o par inferido no bloqueio): o membro só DESCE, no y, e só até antes do próximo objeto.

### Copy Fit — a saída do bloqueio (23/09/2026)

Motor puro em `js/core/copy-fit.js` (saiu de `js/franqueado/` no `c9d6e8e`: é `g*`, mora no core).
Não mede nada — gera candidatos; quem decide se cabe é o Local Fit.

**Onde o franqueado vê.** Toda porta mostra a versão que CABE, com um toque e Desfazer por toast.
Sem versão que caiba, nenhuma porta inventa: fica o fluxo do §15.

| Porta | Onde | Como |
|---|---|---|
| **Balão na prévia** (desktop) | `_fLpSyncBalao` · `fLpBalaoSolucao` (`live-preview.js`) | Em cima da caixa bloqueada; o balão É o botão. Percorre os bloqueios e mostra o 1º que tem solução; o que saiu vai no title ("sem Delicioso"); anunciado no `aria-live` da barra |
| **Diálogo "Esse texto não cabe"** ao gerar, baixar ou trocar de formato — também no celular | `fCorrigirTextoLongo` (`chat.js`) | `gConfirm` com "Usar esta versão" / "Editar" / "Agora não" (3ª saída = `altLabel`, opcional, em `toast.js`). Usar gera a arte de novo; "Editar" e "Encurtar agora" abrem o campo com o texto atual |
| **"Encurtar" do chat**, sem IA | `fFitTextWithAI` (`chat-input.js`) | Aparece quando o Copy Fit tem versão que cabe; a IA vira "Mais opções com IA" e também passa pela régua em pixel. Versão de um texto que já mudou não aplica |

**Uma medida, um culpado.** Balão, diálogo e Encurtar medem com `gLocalFitMedidor` (`local-fit.js`):
os mesmos dados e a mesma placa da prévia, caminho único do runtime (caso 15g). Aviso, balão e laudo
culpam o mesmo campo via `gLocalFitCulpado`.

**Ranking.** `gCopyFitCandidatos` combina os degraus (não só a escada cumulativa) e ordena por custo
perceptível (`_G_CF_PESO`: limpeza < unidades < curtas < tamanho/lista < enfeite); até 12, e o mais
curto sempre fica. `gCopyFitSugestoes(texto, cabe, max)` devolve a 1ª que cabe (a que menos mexeu);
as outras só entram se deixam a letra maior. Sem nenhuma, devolve `maisPerto` (o mais curto) —
**nenhuma UI consome ainda**.

**Garantias** (cobradas por `gCopyFitGuarda` e em `tests/copy-fit.html`: 31 casos, fuzz de 2.000
combos, 2 medidos em pixel): número nenhum muda; nunca fica mais longo; item nenhum some — o motor só
limpa ("por apenas"), abrevia unidade (litros → L), troca por forma curta consagrada (refrigerante →
refri, hambúrguer → burger, "50% de desconto" → "50% OFF"), compacta lista ("A com B e C" → "A + B +
C", só antes de item de pedido; nunca um "Com" abrindo a frase), abrevia tamanho SÓ depois de algo
que tem tamanho e tudo-ou-nada por trecho (Batata Grande → Batata G; "Grande São Paulo" e "Casa do
Pastel Grande" ficam) e tira enfeite anteposto de lista fechada ("Especial" nunca sai). Preserva a
caixa do que foi digitado. `{{campo}}`, tags e entidades HTML viram marcadores opacos e voltam
intactos; quebra de linha e NBSP preservadas.

**Medido** (bancada em pixel, 14 caixas reais × 177 copies): o Copy Fit resgata **~22%** dos
bloqueios (20,8% → 22,4% no `d72901c`). **92% dos não resgatados estão a >15% de caber** — ali só
cortando produto, o que é decisão de quem vende. Regras novas que renderiam mais estão em
**Decisões pendentes do Ryan**, abaixo.

#### Decisões pendentes do Ryan (Copy Fit)

Regras medidas e **não ligadas** — cada uma é gosto/negócio, não técnica. Ganho = resgates a mais em
784 bloqueios, sobre a base de 172:

| Regra | Ganho |
|---|---|
| "com" → "c/" e "para N pessoas" → "p/ N" | +27 |
| Combinado → Combo, peças → pçs, acompanhamentos → acomp. | +9 |
| Tirar emoji usado como separador | +5 |
| "R$ 25,00" → "R$ 25" (todos os preços do texto ou nenhum) | +4 |
| "40 reais" → "R$ 40" | +4 |
| Tamanho longe do item | +4 |
| "taxa de entrega grátis"/"entrega grátis" → "frete grátis" | +3 |
| Enfeite de chamada: imperdível, aproveite, peça já — **"só hoje" nunca** | +2 |
| "das 11h às 15h" → "11h às 15h" | +2 |
| **Todas juntas** | **172 → 232 (29,6%)** |

Propostas de UX abertas (achadas percorrendo o fluxo, nada implementado):

- Avisar no fim do fluxo quando "Sua arte está pronta" tem texto que não cabe.
- Linha curta sob o campo no celular (hoje só o diálogo ao gerar/baixar).
- O toast com Desfazer cobre o campo no celular (`toolbar.css`: `bottom: calc(96px + …)`).
- O corte mudo pelo `maxLen` do designer quebra palavra ("2 litros" → "2 litro").
- Botões do diálogo empilhados no celular.
- A revisão marcar o campo que não cabe.
- Copy: "Pizza G de Calabresa" soa estranho; "Petit gâteau + sorvete de baunilha" idem.

---

## 15. A UI do bloqueio

Bloquear sem saída é o pior resultado do produto: a pessoa preenche tudo, clica em baixar e
leva um toast que some em segundos. A UI do bloqueio responde três coisas, nesta ordem: **qual
campo**, **quanto sobra** e **como chegar lá**.

**Uma porta só.** `fCorrigirTextoLongo(result)` é chamada pelos dois caminhos:
`gHandleLayoutUnsafeError` (exportação, PNG/PDF/compartilhar/lote) e o aviso da prévia. Duas
portas com comportamentos diferentes para o mesmo evento é o defeito de sempre.

**Na prévia, no momento em que acontece.** O `#lp-layout-nota` — que estava desligado desde a
rodada de usabilidade de 09/2026 — volta **só para o bloqueio**: ponto vermelho, o rótulo do
campo e "encurtar", clicável. Enquanto o texto cabe (encolhendo ou não) a linha fica calada: a
arte na tela já é a resposta, e narrar "layout ajustado" era pedir que o franqueado
administrasse mecanismo interno. A prévia continua **desenhando** a arte — ver o texto
estourando é o que explica o aviso.

**No download, com o número.** O diálogo (`gConfirm`, nenhum componente novo) diz: *"O texto de
«Nome do produto» é longo demais para esta arte. Cabem até 28 caracteres aqui — hoje tem 46."*
— e o botão é **"Encurtar agora"**, que leva ao campo. O limite sai de `gLocalFitDiagnostico`
(busca binária sobre o próprio Local Fit daquele campo).

**O contador adota o alvo medido.** A partir do bloqueio, `fMarcaLimiteSeguro(campo, limite)`
grava o número por `materialId|campo` e o contador passa a mostrar **46/28** em vez de 46/60.
O botão **Encurtar** (IA, opcional) passa a mirar no mesmo número.
⛔ O limite medido **não corta** o que a pessoa digitou: ele é estimativa por caractere ("WWWW"
e "iiii" têm a mesma contagem e larguras diferentes), e cortar por estimativa comeria copy que
talvez coubesse. O corte continua sendo só o `maxLen` do designer.

**Sem campo editável** (texto fixo do designer, ou arte reaberta fora do fluxo do chat), a
única saída honesta é trocar de material — e é isso que a mensagem diz. ⛔ Aqui a frase do
motor **não** vale mesmo trazendo o número: mandar alguém encurtar o que ela não pode editar é
pior que não dizer nada.

**Medido no navegador:** contraste do aviso 6,44:1 no escuro e 5,83:1 no claro (AA nos dois);
alvo de toque 206×32px no container de 300px, sem estouro nem rolagem na barra. O aviso comum
vira só o ponto a partir de 340px, mas **o bloqueio não encolhe** — um ponto vermelho sozinho
não diz o que houve, e 17px de largura não se acerta com o dedo.

**Cobertura:** 6 casos em `tests/franqueado-fluxo.html` — o diálogo nomeia o campo e leva até
ele; "Agora não" não mexe no fluxo; o contador adota o limite medido e **não** corta o texto;
sem campo editável a saída é trocar de material; o aviso da prévia acende, nomeia e apaga
quando a arte volta a caber; e a porta é única.
