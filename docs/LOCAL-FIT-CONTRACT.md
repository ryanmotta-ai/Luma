# LOCAL FIT CONTRACT

> Frente **paralela** à Fase 6 do Automatic Designer. Camada determinística que faz um texto
> tentar caber **na própria caixa autorada** antes de qualquer composição.
> Estado: **shadow only** — não está no `index.html`, nenhum byte de produção depende dela.
> Código: [`js/core/local-fit.js`](../js/core/local-fit.js) · Testes: `tests/local-fit.html` ·
> Bancada: `tests/_local-fit-bancada.html`

---

## 0. Confirmação explícita de escopo

**Candidate Search, beam, adaptive scale groups, scoring, candidate selection,
`gLayoutEscolherAlternativa` e o comportamento final de produção NÃO foram alterados.**

Prova, em três níveis:

1. **`git diff --stat` não toca nenhum arquivo de produção.** Os únicos arquivos novos são
   `js/core/local-fit.js`, `tests/local-fit.{html,js}` e `tests/_local-fit-bancada.{html,js}`.
   `js/core/auto-layout.js`, `js/00-config.js`, `js/franqueado/*` e `index.html` ficaram
   intocados.
2. **O arquivo não é carregado pela aplicação.** Ele não está no `index.html` de propósito —
   só as suítes de `tests/` o carregam. Enquanto for shadow, nem código morto ele é: ele não
   chega ao navegador do franqueado.
3. **Um teste cobra isso.** `local-fit-cases.js` caso 19 instrumenta
   `gLayoutEscolherAlternativa`, `gApplyRelativeAnchors`, `gScoreComposition`,
   `gLayoutBuscarCandidatos` e `gLayoutBeam` e falha se o Local Fit chamar qualquer um deles.

Nenhuma primitiva compartilhada foi modificada. Duas limitações foram **encontradas** dentro
delas; estão documentadas em §9 e **não** foram corrigidas — a regra é parar e documentar.

---

## 1. Princípio

**EXPLICIT > INFERRED.** Se o designer desenhou uma caixa de texto, essa caixa é informação
explícita: não precisa ser inferida do Composition Graph.

```
conteúdo novo
  → Local Fit
      cabe?  sim → terminou, zero alteração
             não → overflow OBJETIVO (pixels, linhas, corpo, piso)
                   → o Automatic Designer poderá agir depois
```

Esta fase **não** conecta o fallback. O overflow é um valor de retorno, não um gatilho.

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

O arquivo novo contém **duas funções públicas** e cinco privadas. Ele não escreve em nenhuma
camada — nem na que recebe.

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

**Texto de ponto não vira caixa.** Criar uma largura de quebra que o designer não desenhou é
movimento de composição (é o que o `_layoutW` do guardião faz) — é da outra camada. Texto de
ponto só encolhe. `box.quebravel` declara isso.

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

`gLayoutPisoFonte(camada, false)` — modo **NORMAL**, sempre. O `true` (emergência) é escala
proporcional de componente: movimento de composição, não escopo local. Caso 5b cobra a
igualdade com o motor e a recusa da emergência.

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

### Placa interna

Quando a placa/selo faz parte explicitamente do próprio campo e passa pela régua estável
(`gLayoutFormaEhPlaca`), o retorno ganha `diagnostics.placa` com `mismatch`, a geometria atual
e a que seria coerente (`gLayoutPlacaSegue`). **Diagnóstico apenas** — nada é reposicionado, e
o caso 18 falha se a placa for tocada.

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
| Local Fit não conhece obstáculos. Um texto que cabe na própria caixa pode colidir com um vizinho. | por design | é literalmente o trabalho da outra camada — §1. |
| `p95 de 9,5ms` por campo no caminho ponta a ponta do corpus. | média | §11. |

---

## 10. Corpus shadow

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

## 13. Arquivos tocados

**Novos — 5 arquivos, todos fora do caminho de produção:**

```
js/core/local-fit.js            ~300 linhas   a camada
tests/local-fit.html                          o portão (CI)
tests/local-fit-cases.js        26 casos
tests/_local-fit-bancada.html                 instrumento (fora do CI, `_`)
tests/_local-fit-bancada.js                   corpus shadow + stress + benchmark
docs/LOCAL-FIT-CONTRACT.md                    este documento
```

**Modificados: nenhum.** `index.html`, `js/00-config.js`, `js/core/auto-layout.js`,
`js/franqueado/*` e `js/designer/*` não foram tocados. Não há `?v=N` a subir.

---

## 14. Próximos passos (não feitos aqui, de propósito)

1. **Ligar na produção** — entra no `index.html`, sobe o `?v=N`, e aí sim há superfície.
   Antes disso, aplicar a recomendação de §11 (carimbar pisos uma vez por arte).
2. **Conectar o fallback** — `status: 'overflow'` vira a entrada do Automatic Designer. É a
   junção com a Fase 6 e depende da outra frente estar estável.
3. **Corrigir (b) de §9.1** no `gSemanticUnits` — uma linha, dono é a outra frente.
4. **Medir o corpus legado** sem `layoutRefText`, onde a tinta autorada é `{0,0}` (§9.2).
