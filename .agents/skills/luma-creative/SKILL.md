---
name: luma-creative
description: "Diretriz definitiva para geração e composição de templates de arte da Delivery Much no Luma. Use SEMPRE que for solicitado para criar, diagramar, sugerir ou compor novas artes, templates de feed (1080x1350), stories (1080x1920) ou variações criativas para o catálogo. Aplica o princípio de Design Atômico Estrito: NUNCA desenha vetores do zero, apenas orquestra ativos e blocos oficiais das bibliotecas sob regras rígidas de grid, contraste WCAG, hierarquia de 4 níveis de tipografia, tamanhos mínimos legíveis no celular e auditoria visual obrigatória do print. Responda e escreva a copy sempre em PT-BR."
metadata:
  author: luma-design-team
  version: "1.3.0"
---

# Luma Creative — Diretriz de Composição de Artes e Templates

> **Regra Suprema de Geração:** A IA **NUNCA desenha vetores livres nem inventa ilustrações do zero**.  
> Sua função é atuar como um **Diretor de Arte / Diagramador Sênior**: você seleciona blocos e ativos oficiais do inventário (`assets/`), define a hierarquia visual, respeita as zonas seguras (safe zones) e compõe a cena em SVG puro paramétrico.

---

## 1. O Princípio da Geração sob Restrição (Constrained Design)

A consistência de marca da Delivery Much em mais de 100 cidades depende de **previsibilidade absoluta**:
1. **Ativos Fechados:** Logos, selos, molduras e grafismos vêm **exclusivamente** da biblioteca oficial da skill.
2. **SVG Autônomo e Paramétrico:** Todo SVG publicado embute fontes e logos em base64 (renderização idêntica em qualquer sistema) e contém as tags do Luma (`{{produto}}`, `{{preco}}`, `foto_produto`). **Escreva a arte legível**, apontando os arquivos como `asset:<caminho em assets/>` (ex.: `href="asset:logos/dm-h-branca.png"`, `url('asset:fontes/Roboto-Black.woff2')`), guarde essa fonte em `assets/templates/refino/fontes/` e feche com `node scripts/embutir-arte.js <fonte.svg> <saida.svg>`. Nunca cole base64 à mão.
3. **Consistência acima de Invenção:** Menos é mais. O design da DM é limpo, assertivo, solar e funcional (Retail Moderno).

---

## 2. Escala Tipográfica Oficial (4 Níveis Estritos)

O Luma utiliza uma escala disciplinada de 4 níveis. O peso `Bold (700)` foi **eliminado** para evitar degraus intermediários confusos e garantir contraste dinâmico máximo.

| Nível | Família & Peso | Função no Design | Exemplos Obrigatórios |
| :--- | :--- | :--- | :--- |
| **1. Impacto / Hero** | **`Realce Black` (900)** | A voz expressiva e proprietária da Delivery Much | Título principal (`{{produto}}`), Preço promocional (`R$ 22,90`), Destaques centrais de selos (*"VENDIDOS"*, *"25% OFF"*). |
| **2. Apoio & Âncoras** | **`Roboto Medium` (500)** ou Regular (400) com tracking | Leitura técnica, limpa e sofisticada | Subtítulos (`DETALHES`), Preço anterior riscado (*R$ 28,00*), código de cupom (`NIVERDM`), labels com tracking expandido (`letter-spacing: 1px`). |
| **3. Corpo & Instrução** | **`Roboto Regular` (400)** | Clareza e funcionalidade | Descrição do produto, texto guia do slot (*"Use aqui sua foto do produto"*). |
| **4. Legal & Respiro** | **`Roboto Light` (300)** | Discrição e elegância máxima | Disclaimers em rodapé (*"Consulte os restaurantes participantes"*, regras de cupom). |

> ⚠️ **Embutimento Obrigatório:** Todo SVG gerado deve conter a fonte `Realce Black` (`realce-black.woff2`) **e cada peso de Roboto realmente usado** embutidos via `@font-face` (o `embutir-arte.js` faz isso a partir de `asset:`). **Proibido `@import` de Google Fonts**: dentro de SVG renderizado como imagem ou offline ele não carrega e o texto cai em Arial (já aconteceu nos prints dos templates 01–10). Use os **`.woff2` de `assets/fontes/`** (recortados para o latim do PT-BR, ~14 KB cada): `Roboto-Light`, `Roboto-LightItalic`, `Roboto-Regular`, `Roboto-Medium`, `Roboto-Black`. Os `.ttf` antigos (170 KB) deixam a arte 6× mais pesada. Declare a itálica com `font-style:italic` e a Black com `font-weight:900`.
> Um `Roboto Black (900)` existe **só para as receitas da §2.4**; ele não é o Bold 700 eliminado (continua proibido).

### 📏 Tamanhos Mínimos (canvas de 1080px de largura — o post é visto no celular)
> Texto pequeno é o erro nº 1 das artes geradas. Na tela do celular a arte encolhe ~3×: o que tem 14px no canvas vira ilegível.

| Nível | Feed 1080×1350 | Story 1080×1920 | Piso absoluto |
| :--- | :--- | :--- | :--- |
| **1. Hero (`{{produto}}`)** | 96–150px | 110–170px | **80px** |
| **1. Preço promocional** | 110–170px | 120–190px | **96px** (o maior número da peça depois do hero) |
| **2. Apoio / cupom / preço riscado** | 34–48px | 38–52px | **32px** |
| **3. Corpo** | 30–38px | 32–42px | **28px** |
| **4. Legal** | 24–28px | 26–30px | **24px** |
| **Texto dentro de selo/badge** | — | — | **22px** (nunca menos; se não cabe, o selo cresce ou o texto encurta) |

* **Nenhum `font-size` abaixo de 22px** em nenhum lugar da arte (exceção: nenhuma).
* **Hierarquia mínima:** o hero é pelo menos **2,5× maior** que o apoio. Se hero e apoio parecem do mesmo tamanho, a arte falhou.
* **Máximo 3 tamanhos de texto visíveis** por peça (hero, apoio, legal), mais o preço. Mais que isso vira ruído.
* **Largura do hero: MEÇA, não estime.** Rode `node scripts/medir-texto.js "TEXTO DO HERO" --largura 880` (largura útil = `1080 − 2×margem`). Ele mede o Realce Black real e devolve o maior `font-size` que cabe em 1, 2 e 3 linhas, com a quebra balanceada e a recomendação. Use o que ele recomendar; se nenhuma quebra chega a 80px, **encurte a copy** (≤ 4 palavras), não baixe o piso.
* **Linha de texto de apoio:** no máximo ~38 caracteres por linha; mais que isso, quebre.

### 🔤 Consciência de Caixa Alta (Uppercase vs. Minúsculas / Sentence Case)
> **Atenção:** **Não coloque tudo em caixa alta!** A IA deve sempre se questionar criticamente: *"Esse texto precisa mesmo ser em caixa alta?"*
* **O que DEVE ser em Caixa Alta (`text-transform: uppercase`):**
  * Título principal / Hero (`Realce Black` 900) para impacto de retail (*"FESTIVAL GASTRONÔMICO"*, *"PIZZA EM DOBRO"*).
  * Tags e badges curtos de voucher (*"CUPOM"*, *"ENTRADA FRANCA"*, *"MAIS VENDIDOS"*).
* **O que NÃO DEVE ser forçado em Caixa Alta:**
  * Frases de apoio, descrições secundárias, instruções de app e disclaimers legais.
  * Exemplos corretos em caixa normal: *"Peça nos restaurantes do evento pelo app"*, *"O melhor da nossa cidade reunido"*, *"Consulte horários e programação completa no aplicativo."*.
  * Forçar tudo em caixa alta polui o layout, diminui a legibilidade e dá a sensação de que a arte está "gritando" desnecessariamente.

### 🧱 2.1 Lockup do Hero (como montar o título)
* **Palavra de impacto + complemento:** quando o hero tem 2 linhas, a **palavra-chave** vai maior e o complemento menor, na razão **1,15–1,30×** (ex.: `NOVO` 180 / `PARCEIRO` 150; `SEXTOU` 230 / `COM BURGER` 150). Duas linhas do mesmo tamanho só quando as duas têm peso igual (`PIZZA CALABRESA / TRADICIONAL`).
* **Entrelinha:** **0,92–0,96 × font-size** (baseline a baseline). Mais solto que isso desfaz o bloco; mais apertado colide acentos com a linha de cima.
* **`letter-spacing`:** hero `0.5px`; apoio (Roboto 400) `1px`–`1.2px`.
* **Quebra por sentido**, nunca no meio de uma expressão ("PIZZA EM / DOBRO" ✖ → "PIZZA / EM DOBRO" ✔).
* **Preço (lockup fixo, a especialidade da marca):** `DE R$ 28,00` → `POR` → **`R$ 22,90`**.
  * **`DE`:** Roboto 400 **≥ 40px**, **branco 100%** (ou `#434343` sobre card branco), **risco de 4px** na altura do meio das letras. Pequeno ou fino demais some no celular.
  * **`POR`:** Roboto 400, 34–38px, `letter-spacing` 1.2px, **empilhado logo acima do "R$"** (card largo) ou **na altura do "R$" suspenso**, à esquerda dele (card de lista). Nunca solto na linha de base, longe do valor.
  * **Valor = assinatura da marca:** número em Realce **≥ 96px** (alvo 120–170); **"R$", vírgula e centavos a 55% do número e suspensos 35%** (como `R$22,90` das referências). É a mesma proporção que o Luma desenha em `{{preco:inteiro}}`/`{{preco:centavos}}` (`gBuildVirtualRuns`, `js/00-config.js`), então a arte bate com o app. Para número de 168px:
    ```svg
    <text x="146" y="1134" class="hero" font-size="168" fill="#F85400"><tspan font-size="92" dy="-59">R$</tspan><tspan dy="59" dx="6">22</tspan><tspan font-size="92" dy="-59">,90</tspan></text>
    ```
    (`font-size` dos pequenos = 0,55 × N; `dy` = ∓0,35 × N). O `lint-art.js` avisa preço com centavos no tamanho do número. É o 2º maior elemento da peça, depois do hero.
  * **Desconto confere com a conta:** o `%` do selo é `(DE − POR) ÷ DE`, arredondado para baixo. Selo "25% OFF" em DE 28,00 → POR 22,90 (18%) é peça mentindo.
  * **Selo de desconto preso ao preço ou ao título:** o selo amarelo (`25% OFF`, `-22%`) fica **colado ao lockup do preço ou ao hero** (≤ 200px), nunca solto no meio da arte. O `lint-art.js` avisa ("Selo solto").
  * O lockup é **uma unidade**: os vãos internos (24–48px) não seguem a regra de 60px entre blocos.

### 📐 2.2 Sistema de Proporções (tokens: nada de valor solto)
| Token | Valores permitidos |
| :--- | :--- |
| **Espaçamento** (vãos entre blocos, margens internas) | `24` · `40` · `60` · `80` · `120` px. Hero→apoio = `40`; entre blocos independentes = `60`/`80`/`120`; dentro de card = `24`–`40`. |
| **Raio** | Foto/slot `56` · card/ticket `36` · botão/tag = **pílula** (`rx = altura/2`) · selo = círculo · canvas `0` |
| **Sombra** (único preset) | Card/ticket: `feDropShadow dy=12 stdDeviation=16 flood-color=#434343 flood-opacity=0.25`. Selo/badge: `dy=6 stdDeviation=10 opacity=0.2`. Nenhuma outra. |
| **Linha/divisória** | `stroke #434343` com `opacity 0.25`, `stroke-width 3` |

* **Um eixo de alinhamento por peça:** todos os textos soltos à **esquerda (x=100)** ou todos **centralizados (x=540)**. Misturar os dois é o erro mais comum de "arte amadora". Textos dentro de um card seguem o eixo do card.
* **Sobreposição intencional (é o que dá coesão às referências):** blocos soltos a 60px uns dos outros parecem template de sistema; nas artes oficiais, peças se **prendem à borda da foto**. Lista fechada do que pode sobrepor o slot de foto:
  1. **Card de preço** invadindo a borda inferior ou lateral da foto: marque o grupo com `data-sobrepoe="foto"`. Limite: **≤ 25% da área da foto** e **nunca o miolo** (o terço central, onde está o sujeito). O lint mede os dois.
  2. **Selo** na quina da foto (já permitido; ≤ 35% da largura da foto).
  3. **Logo da loja** (círculo) metade sobre a borda da foto.
  * **Uma camada por vez:** cada bloco sobrepõe só a foto. Selo em cima da foto **e** do card ao mesmo tempo empilha três camadas e vira bagunça (apontado na revisão de 10/2026).
  * Fora dessa lista, a regra de respiro (60px+) continua valendo.
* **Uma inclinação por peça (opcional):** no máximo **um** elemento (selo, ticket de cupom ou tag) com `rotate` entre **-6° e -10°** para dar energia. Nunca o hero, o preço, texto corrido ou a foto.
* **Ritmo:** repita os mesmos vãos entre blocos equivalentes (se hero→foto é 80, foto→card também é 80).

### ✍️ 2.3 Copy (tom Delivery Much)
* Para texto institucional, de lançamento ou de campanha, **use a skill `branding-delivery-much`** (tom de voz, personas Paulo/Lucas).
* **Fórmulas que funcionam:** `[Ocasião] com [produto]!` ("Sextou com burger!"), `Peça pelo app`, `Entrega grátis`, `[N]% OFF`, `Novo parceiro`, `Use o cupom [CÓDIGO]`.
* **Hero ≤ 4 palavras**, apoio ≤ 1 frase (~38 caracteres/linha), legal ≤ 2 linhas.
* **CTA em imperativo curto**: `PEDIR`, `PEDIR AGORA`, `APROVEITAR`. Sem emoji. Valores sempre `R$ 22,90` (vírgula).
* **Não invente preço, regra, prazo ou condição** do franqueado: se a peça precisa e o briefing não deu, **pergunte** (negócio não se assume). Texto de exemplo nas artes-modelo usa valores fictícios claros.
* **Copy não se contradiz:** "ENTRADA FRANCA" (evento presencial) + "peça pelo app" (delivery) na mesma peça confunde. Uma mensagem só (Fase 1).

### 🎚️ 2.4 Receitas Tipográficas (contraste de peso e caixa — o que tira a arte do "template")

Hero sempre em Realce maiúsculo deixa as peças iguais. As referências da marca **misturam peso e caixa**; isso entra por **receitas fechadas**, não por mistura livre. **No máximo uma receita expressiva por peça**; o resto segue a escala da §2.

| Receita | Como é | Quando usar | Exemplo |
| :--- | :--- | :--- | :--- |
| **A. Frase mista** | Mesma linha, mesmo tamanho (64–80px): trecho de conversa em **Roboto Light Itálica (300i)** + palavra-chave em **Roboto Black (900)**. Minúsculas. | Chamada de conversa acima do valor: cupom, convite, benefício. | *pega este* **cupom** / *pra você* **economizar!** (`refino_02`) |
| **B. Minúscula + vazado** | Palavra 1 em **Roboto Black minúscula** (200–260px, `letter-spacing` −1 a −3); palavra 2 em **Realce maiúsculo vazado**: `fill="none" stroke="#FFFFFF" stroke-width="5–8"`, ≥ 140px (alvo 300–380), na largura útil. | Benefício de 2 palavras que é o ponto focal: frete, novidade. | **entrega** / GRÁTIS vazado (`refino_04`) |
| **C. Lockup de valor** | Número gigante em Realce (300–380px) + `R$` ou `%` a ~36% do número alinhado ao topo + coluna à direita: `OFF` (Realce) sobre o complemento em **Roboto Black** maiúsculo (44–56px, 2 linhas). | Cupom/desconto em que o valor é o ponto focal. | R$ **15** OFF / NO SEU PEDIDO (`refino_02`) |
| **D. Rótulo de produto** | Nome do produto em **Realce maiúsculo #434343** (40–48px) dentro do card branco, acima do preço riscado. | Cards de lista e card de preço com nome. | BURGER CLÁSSICO (`refino_10`) |

* A receita C e o rótulo D convivem com A ou B (são lockups de informação, não de expressão). A + B na mesma peça, não.
* **Itálico só na Light 300** (nunca Black itálica, nunca Realce itálica): o `lint-art.js` dá ERRO. Itálico nunca em preço, código de cupom nem texto legal.
* **Vazado:** uma palavra por peça, ≥ 140px, sempre branco sobre `#F85400`/`#FF9000`; nunca em preço, nunca sobre foto ou pattern (o contorno some). O lint avisa abaixo de 140px e mais de um vazado.
* **Minúscula** é voz de conversa da marca: Black minúscula ou Light Itálica. O Realce continua maiúsculo.
* **Medir antes de compor:** a largura de cada trecho sai do navegador (mesma técnica do `medir-texto.js`), não do olho. Na receita B, cada palavra ocupa a largura útil (~870px).


---

## 3. Paleta Oficial Fechada (Zero Subtons) & Leis de Contraste

> ⛔ **REGRA SUPREMA: PALETA FECHADA (ZERO SUBTONS)**  
> A marca Delivery Much utiliza **exclusivamente** estas 5 cores oficiais + Branco (`#FFFFFF`).  
> **Ou é essa cor ou nenhuma outra.** A IA está terminantemente proibida de inventar tons intermediários, subtons ou gradientes aleatórios.

| Hexadecimal | Nome Oficial | Papel & Aplicação |
| :--- | :--- | :--- |
| **`#434343`** | **Cinza Neutro / Grafite** | Texto e ícone sobre o placeholder, fundos de container neutros, badges e selos escuros. (O **slot** de foto em si é `#D9D9D9` — ver §3.2.) |
| **`#F62900`** | **Laranja Avermelhado** | Alertas, detalhes quentes de alta energia, contraste de urgência. |
| **`#FFB900`** | **Amarelo Ouro** | Selos de desconto (*"25% OFF"*), badges de cupom e vouchers de destaque. |
| **`#F85400`** | **Laranja DM Ação / Primário** | Cor de ação da marca, fundos vibrantes, preços em destaque sobre card branco. |
| **`#FF9000`** | **Laranja Solar DM** | Fundo solar da marca, gradientes autorizados de base. |
| **`#FFFFFF`** | **Branco Puro** | Superfícies claras (cards flutuantes), tipografia sobre fundos escuros/laranjas, logos. |

### ⚖️ Matriz Rígida de Contraste e Sobreposição
1. **Em cima de `#F85400` (Laranja Ação):**
   * ✅ **SEMPRE use BRANCO (`#FFFFFF`)**.
   * ❌ **NUNCA use preto** (preto quebra o brilho e a identidade solar da marca).
2. **Em cima de `#FF9000` (Laranja Solar):**
   * ✅ Use **BRANCO (`#FFFFFF`)** para textos e logos.
   * ✅ Use elementos e detalhes em **Laranja `#F85400`** para gerar profundidade e destaque.
   * ⚠️ **Branco sobre `#FF9000` tem contraste baixo (~2,3:1):** compense com **tamanho**. Hero e preço **≥ 110px** (feed) / **≥ 120px** (story); apoio **≥ 36px** e só em Regular (400) — nunca Light (300) abaixo de 30px. **Prefira fundo `#F85400`** quando a peça tiver 3+ blocos de texto ou texto pequeno; reserve `#FF9000` para peças **limpas**: poucas palavras, hero grande. **`DE`, `POR` e o valor em branco ficam sobre `#F85400` (ou card branco)**, nunca direto sobre `#FF9000`: em peça `#FF9000` mova o preço para uma área `#F85400` (ex.: split diagonal, topologia 5 do repertório) ou para um card.
3. **Em cima de BRANCO (`#FFFFFF`):**
   * ✅ **SEMPRE use Laranja `#F85400`** para preços, botões e tipografia de destaque.
   * ❌ **NUNCA use `#FF9000` sobre branco**: `#FF9000` fica totalmente sem contraste no fundo branco (reprova WCAG e fica ilegível/lavado).
4. **Em cima de `#434343` (Cinza Grafite):**
   * ✅ Use **BRANCO (`#FFFFFF`)** ou **Amarelo `#FFB900`**.
5. **Botões, CTAs e tags (pílulas de texto curto) — padrão fixo por fundo:**
   * **Sobre `#FF9000`:** botão/tag **`#F85400` com texto BRANCO**. ❌ Nunca amarelo com texto preto sobre `#FF9000`.
   * **Sobre `#F85400`:** botão/tag **BRANCO com texto `#F85400`**.
   * **Sobre branco/card branco:** botão `#F85400` com texto branco.
   * `#FFB900` fica reservado a **selos de desconto e badges de cupom/voucher** (círculo/selo com "25% OFF", "R$ 29,90", "ENTRADA FRANCA"), nunca a botão ou tag de ação.
6. **Em cima de `#FFB900` (Amarelo Ouro):**
   * ✅ Texto em **`#434343`** ou **`#F85400`**. ❌ Nunca branco sobre amarelo (reprova WCAG).
7. **Uso do `#F62900` (Laranja Avermelhado):** só como **acento pequeno** (tag de urgência, "ÚLTIMOS DIAS", faixa lateral de cupom) sobre branco ou `#434343`. ❌ Nunca como fundo grande, nunca ao lado de `#F85400` sem separação (as duas brigam), nunca para texto corrido.
8. **Opacidade, sombra e "cinza":**
   * Opacidade de uma cor oficial **é permitida** (`opacity`, `fill-opacity`, `flood-opacity`) — não cria hex novo.
   * **Sombras (`feDropShadow`)**: `flood-color="#434343"`, `flood-opacity` entre `0.15` e `0.28`. ❌ Nunca `#000000`, `#802000` nem marrom/preto inventado.
   * **Linhas, divisórias e tracejados**: `#434343` com opacidade (`0.15`–`0.3`) ou `#FFB900`/`#F85400`. ❌ Nunca `#E0E0E0`, `#F0F0F0` ou qualquer cinza claro avulso.
   * **Proibido** gradiente com hex fora da paleta; gradiente só entre `#F85400` ↔ `#FF9000`.
9. **Pattern / Sorriso da Delivery Much no Fundo (Grafismo de Marca) — REGRA DE INVERSÃO:**
   * **Fundo `#F85400` → pattern `#FF9000`.** Obrigatório.
   * **Fundo `#FF9000` → pattern `#F85400`.** Obrigatório (e vice-versa: o pattern nunca usa a mesma cor do fundo, nem outra cor).
   * **Opção extra: pattern em BRANCO (`#FFFFFF`)** sobre qualquer um dos dois fundos, **sempre com `opacity` entre `0.40` e `0.50`**. Nunca branco opaco nem fora dessa faixa.
   * **Um pattern por peça:** escolha a versão laranja invertida **ou** a branca; não misture as duas.
   * Vale para `pattern-dm-oficial.svg`, arcos tone-on-tone e qualquer grafismo de fundo. Detalhes na §3.1.

### 🌀 3.1 Pattern Oficial — OPCIONAL, ANCORADO e NÍTIDO (`assets/grafismos/pattern-dm-oficial.svg`)

O pattern é o **sorriso da DM repetido**: textura de marca, nunca protagonista e **nunca uma folha cobrindo a arte inteira**. Nas artes oficiais ele aparece como **sorrisos inteiros e nítidos** perto de um bloco gráfico (o cupom, a moldura da foto), e **a zona do texto fica em cor lisa**, para a copy ter contraste e o pattern não roubar a leitura.

> ⛔ **Sem desfoque, sem degradê, sem máscara, sem "esmaecer".** O pattern é sempre **nítido**; a única forma de suavizá-lo é a **opacidade** (tabela abaixo). Para ele não atrapalhar o texto, **não se apaga o pattern: escolhe-se onde ele fica** (passo 3). Desfocar/dissolver o pattern, `feGaussianBlur`, `mask` ou `linearGradient` sobre ele estão **proibidos**.

**PASSO 1 — Usar pattern? (opcional; na dúvida, NÃO use)**

Use **somente se as 4 condições forem verdadeiras**:
1. Existe um **bloco-âncora** gráfico grande: foto/moldura, ticket de cupom, logo de parceiro em círculo ou selo grande (≥ 30% da largura do canvas).
2. O texto (hero, apoio, preço, CTA, logo DM, legal) fica em **zona separada** do âncora.
3. Sobra **ar ao redor do âncora**: o script do passo 3 encontra **pelo menos 2 sorrisos inteiros** (com metade ou mais da forma dentro do canvas) fora de qualquer texto.
4. A peça **não é dominada por texto** (hero 2+ linhas + preço + card + muito apoio) nem tem foto cobrindo mais de ~60% do canvas.

Qualquer condição falsa → **arte clean: fundo liso `#F85400` ou `#FF9000`, sem pattern, sem arcos.** É uma composição completa e correta, não uma peça "faltando coisa". Composição clean é a escolha **padrão** quando o layout já está cheio.

**PASSO 2 — Defina a zona e as caixas de texto**
* **Âncora** = o maior bloco gráfico. A **zona** é a região onde os sorrisos podem ficar: **elipse** (`ellipse:cx,cy,rx,ry`) para âncora redondo (logo de parceiro), **retângulo** (`rect:x,y,w,h`) para âncora retangular, ticket ou foto lateral. Faça a zona **generosa e do lado oposto ao texto**; pode passar das bordas do canvas (o pattern pode sangrar).
* **Caixas de texto** (`x,y,w,h`): uma para **cada** hero, apoio, preço, CTA, logo DM e legal. O script mantém **30px** de distância delas.

**PASSO 3 — Rode o script (decide a posição; a IA não deliberar)**
```bash
node scripts/pattern-ancorado.js --canvas 1080x1350 \
  --zone ellipse:540,365,600,400 --anchor 240,90,600,550 \
  --text 185,742,710,235 --text 180,1020,720,40 --text 410,1112,260,77 \
  --scale 2.6 --color "#FFFFFF" --opacity 0.4
```
* O script escolhe **só sorrisos inteiros** do arquivo oficial cujo centro está na zona e que **não encostam em nenhum texto**, testa o deslocamento (`translate`) e imprime o `<g>` pronto. Cole-o **logo depois do fundo liso**, antes do conteúdo.
* **Saiu "SEM PATTERN"** (menos de 2 sorrisos): faça **arte clean**. Não force: não amplie a zona por cima do texto nem reduza as caixas de texto.
* Âncora opaco cobre sorrisos; `--anchor` evita contar os que ficariam escondidos.
* **Em massa, não farelo:** `--scale` feed **`2.4`–`3.0`**, story **`2.6`–`3.2`** (padrão do script: `2.6`). Nas referências cada arco tem 450–500px; na escala antiga (`1.4`–`1.8`) eles saíam com ~170px e viravam lascas espalhadas (ver `referencias/antirreferencias/`). O lint avisa abaixo de `2.2`.
* **Onde a massa fica bem** (escolha a zona assim): (1) **faixa inferior do story** (`y` 1640–2300: a zona proibida de conteúdo vira moldura, como em `referencia-cupom-feed.png`) — `refino_02`, `refino_04`, `refino_08`; (2) **canto** livre de texto; (3) saindo de trás do âncora pelas laterais. **Nunca no vão entre dois blocos** (título ↔ foto): um toco de arco ali parece sobra de máscara.
* **Um arco solto num canto também é farelo:** se o script devolve sorrisos que aparecem só como lasca na borda, ou a zona livre é uma faixa < 300px, faça **arte clean** (foi o caso de `refino_01` e `refino_03`).
* Nunca desenhar, recortar nem editar formas do pattern; só o script escolhe quais aparecem.

**Cor e opacidade** (inversão da §3 item 9):
| Fundo | Pattern | Opacidade |
| :--- | :--- | :--- |
| `#F85400` | `#FF9000` | `0.30`–`0.50` |
| `#FF9000` | `#F85400` | `0.30`–`0.45` |
| `#F85400` ou `#FF9000` | `#FFFFFF` | `0.40`–`0.50` |

**Complementos**
* **Um pattern por peça.** Pattern + arcos tone-on-tone + selo grande + foto com sombra pesada na mesma região é ruído: máximo um grafismo de fundo.
* **Branco nunca atrás de texto branco** e **preço, código de cupom e CTA nunca sobre pattern**: já garantido pelas caixas de texto; confira no print.
* **Story:** o pattern pode ocupar as faixas proibidas (250px de topo/base) — são fundo, não conteúdo.
* **Exemplos aprovados:** `referencias/referencia-cupom-foto-arco.png` (pattern só atrás do cupom, à esquerda; copy à direita limpa) e o Festival Gastronômico do refino (pattern em volta da moldura; texto de baixo limpo).

### 🖼️ 3.2 Placeholder de Foto e Logo — SVG Padrão (reaproveitar, nunca recriar)

Onde a foto do produto, da loja ou o logo do parceiro vai entrar, a arte mostra **sempre o mesmo placeholder**: um bloco em **cinza claro `#D9D9D9`** com **ícone e texto em cima em `#434343`**. É o padrão das artes oficiais (`referencias/referencia-cupom-foto-arco.png`, `grade-variacoes-templates.png`).

* **`#D9D9D9` é a única exceção à paleta fechada** e **só vale para o slot** (foto/logo). Nunca como fundo decorativo, card, divisória ou texto. O slot é substituído pela foto real no Luma; o cinza não aparece na arte publicada.
* **FORMA DO SLOT DE FOTO: SÓ RETÂNGULO.** A foto do produto, do prato, da loja ou do evento é **sempre um retângulo** com `rx=56`, em **qualquer largura, altura e proporção** (paisagem, retrato, quadrado, faixa larga). ⛔ **Proibido** slot de foto em **arco/cúpula/domo, círculo, elipse** ou qualquer outra forma. **Única exceção:** o **logo da loja/parceiro** continua circular (`slot-logo-loja.svg`), como nas artes oficiais.
* **SVGs padrão em `assets/placeholders/`** — copie o `<g id="foto_produto">` (ou `id="logo_loja"`) do arquivo e altere **apenas posição e dimensão**. **Não redesenhe, não troque a cor, o raio, o ícone ou o texto**:
  * **Retângulo:** largura e altura livres; `rx` fixo em `56` (miniaturas < 300px usam `rx=36`).
  * **Logo da loja:** só o diâmetro (≥ 220px).
  * **Ícone e texto nunca escalam** (ficam no tamanho do arquivo, sempre centralizados no slot) — assim a legenda continua legível.
  * **Retângulo que sangra pelas bordas do canvas** (encostando em um ou mais lados): os **cantos arredondados ficam só nos lados que permanecem dentro do canvas**; os lados que sangram seguem para fora (o `rx` desses cantos fica fora da arte). Mesmo cinza, ícone e texto.

  | Arquivo | Uso | Texto fixo |
  | :--- | :--- | :--- |
  | `slot-foto-produto-retangulo.svg` (880×560, `rx=56`) | **toda** foto de produto/prato/fachada/evento, em qualquer proporção | "Use aqui sua foto do produto" |
  | `slot-logo-loja.svg` (220×220, círculo) | logo/foto da loja ou do parceiro | "Logo da loja" |

* **Texto do slot:** `Roboto Regular 400`, **≥ 28px** (≥ 24px no logo da loja), `#434343`, centralizado abaixo do ícone. Só os textos fixos da tabela. Para foto de loja/evento use "Use aqui sua foto da loja" / "Use aqui a foto do evento" **trocando só a frase**, mantendo o mesmo SVG.
* **Slot pequeno (< 300px, miniatura em lista/card):** mesmo cinza `#D9D9D9`, ícone reduzido a ~60% e legenda curta em 2 linhas **"Foto do" / "produto"**, Roboto 400 **≥ 24px**. Slots ≥ 300px usam o texto fixo completo.
* **Slot que sangra pela borda do canvas:** ícone e legenda ficam **centralizados na parte visível** do slot, nunca cortados pela borda.
* **Mantenha o `id`** (`foto_produto` / `logo_loja`): é o gancho que o Luma usa para trocar pela imagem real.
* **Variam só as proporções do retângulo; a cor, o raio e a forma não.** Moldura/aba/aro ao redor do slot segue as regras de paleta (`#434343`, branco ou `#FFB900`). O `lint-art.js` reprova slot de foto em círculo, elipse ou arco.
* **Tamanho mínimo:** logo da loja ≥ **220px**; foto ≥ **35%** da largura do canvas (senão não dá para ler a legenda).
* Proibido: texto branco sobre o slot cinza, ícone em outra cor, placeholder em `#434343` escuro (padrão antigo, abandonado), legenda inventada ("Slot de alta resolução…").

### 📷 3.3 Foto Real do Produto (quando a foto entrar no slot)

O placeholder `#D9D9D9` (§3.2) reserva o espaço; a foto real do franqueado entra **no mesmo lugar e na mesma forma**. **A arte publicada nunca mostra o cinza**: julgar só o placeholder esconde o peso e a cor reais da peça. Por isso a Fase 5 tira o print também com foto (`capture-art.js --foto`).

**Fotos de teste (`assets/fotos-teste/`, Unsplash License — uso livre):** escolhidas para estressar a arte, não para enfeitar.

| Arquivo | Estressa | Origem (Unsplash) |
| :--- | :--- | :--- |
| `pizza-quente.jpg` | foto em tom laranja que pode sumir no fundo da marca | `photo-1513104890138-7c749659a591` |
| `pizza-topo.jpg` | vista de cima, muito detalhe | `photo-1565299624946-b28f40a0ae38` |
| `burger-escuro.jpg` | fundo escuro, sujeito ao centro | `photo-1571091718767-18b5b1457add` |
| `salada-clara.jpg` | fundo claro, quase branco | `photo-1546069901-ba9599a7e63c` |
| `salada-recortada.webp` | produto **sem fundo** (testa o pop-out) | recorte da anterior |
| `sushi.jpg` | composição horizontal longa | `photo-1579871494447-9811cf80d66c` |
| `doce.jpg` | retrato, sobremesa | `photo-1565958011703-44f9829ba187` |
| `restaurante.jpg` | slot de **loja/evento** | `photo-1517248135467-4c7edcad34c4` |

Rode a peça com **a foto que mais combina e a que mais ameaça** (ex.: pizza laranja sobre fundo `#F85400`).
* **Mecânica:** a `<image>` entra **dentro do `<g id="foto_produto">`**, recortada pela forma do slot (`clipPath` com o mesmo `rect` e o mesmo `rx`) e com `preserveAspectRatio="xMidYMid slice"`. **Mantenha o `id`.**
* **Foto com fundo:** preenche o slot inteiro. Sobre fundo laranja, um **aro branco de 12–24px** (retângulo branco concêntrico com `rx = 56 + aro`) em volta do slot separa a foto do fundo.
* **Produto recortado (PNG sem fundo):** pode **vazar** da moldura por cima (efeito *pop-out*): **15–25% do produto** passa da borda do slot, **sem cortar o sujeito**. Uma única sombra suave embaixo (`#434343`, opacidade `0.25`, `dy=20`, `stdDeviation=24`).
* **Selo e tag nunca cobrem o sujeito:** mantenha livre o centro e o terço com o produto; o selo vai no canto, ≤ 35% da largura da foto, a ≥ 40px de qualquer texto.
* **Sem pattern atrás do produto:** o pattern vive no halo em volta do âncora (§3.1); atrás da foto ele fica escondido de qualquer forma.
* **Fotos escuras ou muito claras:** não altere a foto (sem filtro/overlay colorido). Se a foto some no fundo, troque o fundo (`#F85400` ↔ `#FF9000`) ou adicione o aro branco.

---

## 4. Estrutura de Arquivos da Skill

A skill organiza seus recursos nas seguintes pastas:

```text
.agents/skills/luma-creative/
├── SKILL.md                          <- Este manual de regras
├── assets/                           <- INVENTÁRIO EXCLUSIVO (Zero criação livre)
│   (artes-modelo: `assets/templates/refino/` na raiz do repo — o SVG publicado, a fonte legível em `fontes/` e o print em `prints/`)
│   ├── logos/                        <- Logos oficiais DM (branca, laranja, símbolo), SEM margem transparente: width = largura da marca. PNG de 298px: até ~300px fica nítido
│   ├── fotos-teste/                  <- Fotos de produto/loja para o print com foto (§3.3, Fase 5)
│   ├── placeholders/                 <- SVGs PADRÃO do slot de foto/logo (cinza #D9D9D9) — reaproveitar, §3.2
│   ├── molduras/                     <- Moldura retangular de foto com aba de ícone, já no cinza #D9D9D9
│   ├── cards-preco/                  <- Card branco flutuante e tickets de cupom
│   ├── selos/                        <- Badges oficiais de campanha ("Mais Vendidos", parceiros)
│   ├── grafismos/                    <- Sorrisos oficiais DM (pattern.ai original + pattern-dm-oficial.svg) + pattern-ancorado.svg (técnica padrão da §3.1)
│   └── fontes/                       <- Realce Black (otf + woff2) e Roboto em woff2 recortado (~14 KB): Light 300, Light Itálica 300i, Regular 400, Medium 500, Black 900. Os .ttf 400/300 são legado
└── referencias/                      <- REPERTÓRIO VISUAL (Inspeção visual multimodal)
    ├── paleta-oficial-dm.png         <- Amostra visual exata das 5 cores oficiais da marca
    ├── grade-variacoes-templates.png <- Grade com 6 composições reais de referência
    ├── referencia-clean-ryan.png     <- Referência autoral com foco clean
    ├── referencia-cupom-feed.png     <- Referência com voucher de cupom e selo amarelo
    ├── referencia-cupom-foto-arco.png<- Referência de PATTERN ancorado (cupom à esquerda). Atenção: o slot em arco dela está PROIBIDO hoje (§3.2)
    ├── template-clean-feed.svg       <- SVG paramétrico oficial montado
    └── antirreferencias/             <- Prints REPROVADOS, com o erro no nome do arquivo. Olhe na Fase 1: é o que não fazer
```

**Ativos previstos (ainda não estão no repo — NÃO invente nem desenhe equivalentes; use só depois de subirem):** mockup de celular com o app, moto/entregador, chapéu de chef (símbolo), ícones de app e setas, raio, sticker "mais vendidos" com foto, mais selos de campanha, **logo DM vetorial** (o PNG atual tem 298px) e fotos reais de franqueado. Enquanto faltarem: peça sem eles; se o briefing exige o ativo, **avise o usuário**.
⚠️ `cards-preco/ticket-cupom.svg` usa cores fora da paleta (`#FF7A00`, `#FF4D00`, sombra `#802000`): **não copie**. O ticket certo (aba `#F62900`, borda `#FF9000`, sombra do preset) está em `assets/templates/refino/fontes/refino_02_cupom_story.svg`.

Utilitários de suporte na raiz do repositório:
* `scripts/pattern-ancorado.js`: posiciona o pattern oficial escolhendo **sorrisos inteiros fora do texto** (§3.1, passo 3). Sem saída = arte clean.
* `scripts/lint-art.js`: **linter obrigatório da Fase 5** — mede o SVG no navegador e confere paleta, fontes, tamanhos, margens, colisões, vãos, contraste por fundo, botões/tags, selos, foto, pattern nítido e em massa, centavos sobrescritos, sobreposição intencional, faixa vazia, logo, receitas tipográficas, raios e alinhamento. Sai com código 1 se houver ERRO.
* `scripts/medir-texto.js`: mede o hero em Realce de verdade e recomenda quebra e `font-size` (Fase 4).
* `scripts/capture-art.js`: Renderizador headless (Edge/Chromium via CDP, zero-dep) que converte o SVG em PNG nas proporções exatas (1080×1350 ou 1080×1920). **`--foto <arquivo>`** troca o placeholder (`<g id="foto_produto…">`) pela foto, recortada no mesmo retângulo e raio. Acha sozinho o Chromium do container (`/opt/pw-browsers`); fora dele, `CHROMIUM_PATH=…`.
* `scripts/embutir-arte.js`: fecha a arte — troca cada `asset:<caminho>` pelo arquivo em base64 (§1).

---

## 5. Pipeline Obrigatório de Composição (6 Fases)

Ao receber um pedido de nova arte ou template, a IA executa este fluxo em sequência obrigatória:

### FASE 1: Inspeção Visual das Referências & Paleta (Visão Multimodal Inicial)
Antes de escrever uma única linha de código, a IA **DEVE abrir e inspecionar visualmente os PNGs em `referencias/`**:
* **Sensibilidade Estética e Respiro:** Olhe os PNGs para absorver como o Ryan distribui o peso visual, o contraste entre espaços cheios e vazados, e a hierarquia entre foto, selo e tipografia.
* **Paleta Oficial em `referencias/paleta-oficial-dm.png`:** Fixe as 5 cores oficiais na mente. Proibido subtons intermediários.
* **Antirreferências em `referencias/antirreferencias/`:** abra também. O nome de cada arquivo diz o erro (pattern farelo, blocos soltos, preço plano). Se a sua peça lembrar uma delas, recomece a composição.
* **Escolha a receita tipográfica (§2.4)** junto com o ponto focal: a peça é de conversa (A), de benefício em 2 palavras (B), de valor (C) ou de produto (D/escala padrão)?
* **Liberdade Composicional Guiada:** **Não engesse o design em topologias fixas ou caixas fechadas.** A IA deve se inspirar organicamente no repertório das imagens para criar composições novas, equilibradas e naturais, variando o arranjo dos blocos conforme o objetivo do briefing.
* **Análise da Intenção:** Identifique se a nova peça pede foco em foto grande, destaque de preço, cupom agressivo, evento municipal ou mensagem institucional, e componha a cena inspirada no feeling das referências.
* **Briefing em 3 linhas (escreva antes de desenhar):** (1) **Uma única mensagem** da peça; (2) **o ponto focal** — o que o olho vê primeiro (hero, preço, cupom ou foto; só **um**); (3) **a ação** (pedir pelo app, usar cupom, conhecer parceiro). Se faltar algo, pergunte; dúvida de negócio não se inventa.
* **Escala das referências (calibre a mão):** nas artes reais da DM o hero e o preço são **enormes** (o "R$22,90" ocupa ~1/4 da largura; "entrega GRÁTIS" ocupa metade da altura útil), a logo é legível (~200–260px de largura) e há **poucos** elementos grandes, não muitos pequenos. Arte com muitos itens miúdos está errada.
* **Pontos focais por objetivo (referência, não receita):**
  | Objetivo | Ponto focal | Apoio |
  | :--- | :--- | :--- |
  | Oferta de produto | Preço (`POR R$ 22,90`, com `DE` riscado) | Foto + hero com nome |
  | Cupom | Código/voucher grande | Hero "% OFF", app |
  | Evento / institucional | Hero + selo | Foto da cidade |
  | Parceiro novo | Logo/selo do parceiro | Foto + chamada |
  | Frete/benefício | Hero ("entrega GRÁTIS") | Selo + app |

### FASE 2: Grade, Zonas Seguras & Respiro Relacional Dinâmico (Zero Fórmula Fixa)

> ⚠️ **LIBERDADE COMPOSICIONAL TOTAL:**  
> **NUNCA engesse a arte numa receita de bolo repetitiva** (tipo *"título sempre em cima, foto sempre no meio, rodapé sempre embaixo"*). A IA deve explorar composições visuais variadas e dinâmicas inspiradas no repertório de `referencias/`:
> * Às vezes a foto do produto/loja fica no topo (em retângulo, sangrando ou não) e o título + preço ficam na base.
> * Às vezes o voucher/cupom é o protagonista central com foto de apoio.
> * Às vezes a foto domina o centro com cards satélites e tags flutuantes.
> * Às vezes a logo Delivery Much entra no topo e a oferta fecha a base.

* **A Regra de Ouro do Respiro Relacional (Whitespace Calculado):**
  A regra de respiro é **relacional e dinâmica, nunca posicional**. Não importa onde os blocos estejam dispostos na tela:
  1. **Distância Calculada entre Vizinhos:** Qualquer bloco de informação (Hero tipográfico, Foto, Card de Preço, Voucher, Selo de Campanha ou Rodapé) **DEVE ter uma distância calculada de respiro** em relação aos blocos vizinhos (mínimo de `60px` a `120px` de ar livre).
  2. **Proporção do Bloco Principal:** O bloco protagonista (seja a foto, o produto ou o voucher) nunca pode ser superdimensionado a ponto de sufocar, encostar ou disputar espaço com os blocos ao redor.
  3. **Zero Colisão:** O card de preço ou data **nunca** cola na moldura da foto; a chamada de apoio **nunca** encosta no título ou no rodapé.
  4. **Números de corte (a auditoria da Fase 5 reprova abaixo disso):** vão mínimo de **60px** entre quaisquer dois blocos independentes; **40px** entre hero e sua linha de apoio; selo sobreposto pode invadir a foto, mas **não** pode cobrir o sujeito do produto nem passar de **35%** da largura da foto; nenhum texto a menos de **100px** da borda lateral nem **70px** da borda de topo/base.
  5. **Foto é protagonista, mas não ocupa tudo:** foto de **largura cheia**: no máximo **~55%** da altura útil no feed e **~50%** no story; foto **lateral** (menos de 60% da largura): no máximo **50% da área** do canvas. O resto é hero, preço e respiro. Slot de foto gigante com título miúdo é erro.
  6. **Canvas sem cantos arredondados:** a arte final é **retângulo cheio** 1080×1350 / 1080×1920. ❌ Nunca `clipPath` com `rx` no canvas (gera cantos vazios/transparentes no PNG publicado). Arredondado vale só para blocos internos.
  7. **Story — aproveite a faixa útil:** as zonas proibidas (250px topo/base) ficam **só com fundo/grafismo**; todo texto e selo dentro de `y = 260…1660`. Não deixe o conteúdo "boiando" no meio com 400px de laranja vazio no topo: distribua os blocos pela faixa inteira.
* **Margens Globais de Segurança (Safe Zones):**
  * **Feed (1080×1350 - Proporção 4:5):**
    * Margem lateral mínima: `100px` a `120px` (o layout nunca vaza nas bordas).
    * Margens externas de topo e base: `70px` a `120px` de respiro limpo.
  * **Story (1080×1920 - Proporção 9:16):**
    * Zona proibida de topo: primeiros `250px` (reservado para header do Instagram).
    * Zona proibida de base: últimos `250px` (reservado para barra de resposta/compartilhar).
    * Conteúdo útil concentrado na faixa central (`y = 260` até `y = 1660`), mantendo o mesmo respiro calculado entre blocos.

* **Repertório de topologias aprovadas** (modelos prontos em `assets/templates/refino/`; ponto de partida para variar, não para copiar; **todos com foto em retângulo**).
  * **Padrão 1.3 — copie a topologia E o acabamento** (fonte legível em `refino/fontes/`, revisados lado a lado com as referências): oferta com card de preço preso à foto e selo na quina (`refino_01`, feed); **cupom** com frase mista, lockup de valor e ticket (`refino_02`, story); **evento** com foto sangrando no topo e selo de data (`refino_03`, feed); **entrega grátis** com minúscula + vazado (`refino_04`, story); hero de 2 tamanhos + card preso + arcos em massa na base (`refino_08`, story); **lista de ofertas** com rótulo de produto e CTA (`refino_10`, story).
  * **Pré-1.3 — copie só a topologia**, o acabamento é antigo (preço com centavos grandes, logo pequeno, pattern em escala de farelo): foto sangrando à direita + preço-herói (`refino_09`), etiqueta de preço inclinada (`refino_11`), foto larga + pílulas + preço em linha (`refino_12`), split diagonal em dois tons (`refino_13`), foto cheia no topo (`refino_05`), parceiro novo com logo da loja (`refino_06`), foto lateral sangrando (`refino_07`).
  * Escolha a topologia pelo **objetivo** (Fase 1) e **varie as proporções do retângulo** (largo, alto, quadrado, faixa) em vez de repetir a última.

### FASE 3: Orquestração de Blocos do Inventário
Puxe os elementos diretamente de `assets/`. **Isto é o inventário disponível, não uma ordem fixa** — use só o que a mensagem da peça pede (a ordem e a presença de cada bloco seguem a Fase 2):
* **Fundo:** cor sólida `#F85400` ou `#FF9000`. Pattern oficial **só se o procedimento da §3.1 mandar** (opcional, ancorado, nunca folha inteira); caso contrário, fundo liso.
* **Slot de foto/logo:** `assets/placeholders/` (§3.2), cinza `#D9D9D9`. Moldura/aba decorativa de `assets/molduras/` ao redor, quando houver.
* **Card de preço / voucher:** `assets/cards-preco/` em `#FFFFFF` (ou `#FFB900` no voucher).
* **Selo de campanha:** `assets/selos/`.
* **Logo:** `assets/logos/` — branca sobre laranja/grafite, laranja sobre branco; largura **240–300px** (o PNG não tem margem: `width` = largura real da marca; a altura é `width ÷ 4,97`), sempre com ≥ 40px de ar ao redor. Nunca esticar, recolorir ou colocar sobre foto sem fundo sólido.
* **Fonte faltando:** use só os pesos que existem em `assets/fontes/` (§2). Se a peça pedir um que não existe, **não finja**: avise o usuário — nunca `font-weight` sintetizado pelo navegador nem `Bold`.

### FASE 4: Teste de Estresse de Texto & Caixa Alta Consciente
Certifique-se de que o layout suporta preenchimento real do franqueado:
* Variável `{{produto}}` curta (*"PIZZA"*) ou longa (*"FESTIVAL GASTRONÔMICO"*). **Teste de verdade:** cheque o layout com `PIZZA`, `PIZZA CALABRESA TRADICIONAL` e um nome de 40 caracteres; os três têm de caber sem baixar do piso de 80px e sem tocar selo/card.
* Preço: `R$ 9,90`, `R$ 22,90` e `R$ 1.249,90` — o card não pode estourar nem encolher o número abaixo de 96px.
* **Hero:** rode `node scripts/medir-texto.js` com os 3 textos de teste (curto, médio, longo) e use a quebra/tamanho recomendados; o layout tem de funcionar com os três.
* Prefira **menos texto**: hero ≤ 4 palavras, apoio ≤ 1 frase, legal ≤ 2 linhas. Se a copy não cabe, corte a copy, não o tamanho da fonte.
* A tipografia display deve ter quebra de linha inteligente ou espaçamento reservado para não colidir com o selo ou o card de preço.
* **Reflexão de Caixa Alta:** Somente manchete hero e vouchers em uppercase; descrições, chamadas de app e rodapés em caixa normal.
* Tags obrigatórias quando aplicável: `{{produto}}`, `{{detalhes}}`, `{{preco}}` e slot `foto_produto`.

### FASE 5: Captura de Print & Auditoria Visual Multimodal (Respiro, Margens e Harmonia)
Gerar o código não encerra a tarefa. A IA **DEVE tirar o print da arte e olhar com os próprios olhos**:
0. **Fechar a arte:** `node scripts/embutir-arte.js fontes/arte.svg arte.svg` (o lint dá ERRO se sobrar `asset:`).
1. **Renderizar DOIS prints** — o placeholder e a peça como vai ao ar:
   ```bash
   node scripts/capture-art.js arte.svg arte.png
   node scripts/capture-art.js arte.svg arte-foto.png --foto .agents/skills/luma-creative/assets/fotos-teste/pizza-quente.jpg
   ```
   Peça com várias miniaturas: os ids `foto_produto_1`, `_2`… recebem todos a foto. Junte os dois lado a lado para olhar de uma vez.
2. **Olhar a Imagem:** Abra os PNGs com a ferramenta de leitura de imagem (`Read`). **O print com foto decide**: é nele que se vê se a foto some no fundo, se o selo cobre o sujeito e se o card sobreposto pesa.
   **Teste do celular:** imagine o PNG em ~360px de largura. O hero, o preço e o ponto focal ainda se leem de relance? Se não, aumente.
3. **Linter automático (rode ANTES de olhar o print; ERRO bloqueia a entrega):**
   ```bash
   node scripts/lint-art.js arte.svg            # --story / --feed se o formato não for detectável
   ```
   Ele mede o SVG no navegador (caixas reais) e confere: paleta, fontes, `font-size` ≥ 22, margens e zona útil do story, colisões e vãos, estouro de texto no card, contraste por fundo, botão/tag amarelo, selo perto de texto (≥ 40px) e selo solto longe do preço (> 200px), foto (área e `#D9D9D9`), pattern desfocado ou em escala de farelo, centavos sobrescritos, sobreposição `data-sobrepoe` (≤ 25% da foto, fora do miolo), faixa vazia > 200px, largura do logo, receitas tipográficas (itálico só Light, vazado ≥ 140px), tokens de raio e eixo de alinhamento. **Erros: corrija e rode de novo até zerar. Avisos: corrija, ou justifique em uma linha** (ex.: "sangria intencional").
4. **Auditar os Pilares Visuais:**
   * **Cores Oficiais & Subtons:** As cores usadas são estritamente as 5 oficiais? Zero subtons inventados?
   * **Contraste Correto:** Sobre `#F85400` é branco? Sobre branco está `#F85400` (e nunca `#FF9000`)?
   * **Caixa Alta:** O texto tem hierarquia legível sem parecer que está tudo gritando em caixa alta?
   * **Respiro (Whitespace & Aeramento):** Os blocos têm ar para respirar? Elementos flutuantes estão colidindo com títulos ou sufocando o slot de foto? O rodapé tem folga confortável antes da borda inferior?
   * **Margens & Sangria:** As margens de segurança laterais (100–120px) foram mantidas limpas? Nenhuma letra ou badge está prensado contra o limite do canvas?
   * **Pattern (§3.1):** ele cobre só uma zona em volta do âncora, a copy está sobre cor lisa e nenhum sorriso passa atrás de texto, preço, cupom ou CTA? Há pattern onde o layout não tinha âncora nem ar (nesse caso, remova: clean é melhor)?
   * **Harmonia & Peso Visual:** O centro de gravidade da arte está equilibrado? O olhar do usuário percorre a peça naturalmente: Título de impacto (Hero) → Detalhe/Card → Foto/Atração → Rodapé com logo e app?
5. **Refinamento Iterativo Obrigatório:** Se a IA identificar qualquer aperto, colisão, texto truncado, contraste errado ou desequilíbrio na inspeção do print, deve ajustar as coordenadas no código SVG e rodar o print novamente até alcançar harmonia cirúrgica. **Mínimo de 2 rodadas de print** em peça nova (a 1ª quase nunca está boa); registre o que mudou entre elas.
6. **Revisão comparativa (peça nova):** o autor tende a aprovar a própria arte, e **nota sem régua aprova o mediano**. Depois do lint e das 2 rodadas, chame um **subagente revisor** (ferramenta `Agent`) dando **o PNG com foto + as referências de `referencias/`**, sem a sua opinião:
   > *"Você é diretor de arte sênior da Delivery Much. Abra [PNG] e as referências [grade-variacoes-templates.png, referencia-cupom-feed.png, …]. Contexto fixo que não se critica: [paleta fechada, slot retangular, Realce, piso de 24px do legal, zonas vazias do story]. Para a arte: (1) notas 0–5 para ponto focal, hierarquia, respiro, contraste, marca/paleta, acabamento; (2) **o que a referência tem que esta não tem?** — até 3 itens com coordenada e correção; (3) o que some a ~360px de largura. Termine com APROVADA (todas ≥ 4) ou REFAZER. Seja exigente."*
   * Dê o "contexto fixo" sempre: sem ele, o revisor gasta os 3 itens criticando regra da marca.
   * **Verifique cada achado na fonte antes de corrigir** (achado plausível ≠ real) e confira a conta de todo desconto. **Qualquer nota < 4 → corrija e revise de novo**, com um revisor novo (o antigo ancora no próprio parecer). Não use para ajuste pequeno.
7. **Auditar a fonte:** o texto no PNG está em Realce/Roboto de verdade, ou caiu em Arial/Times? Hero com aparência "larga e genérica" = fallback → a fonte não foi embutida.

### FASE 6: Auto-Revisão Pré-Entrega (Checklist Final)
Antes de finalizar a arte:
1. [ ] **Paleta Fechada:** Somente as 5 cores oficiais (`#434343`, `#F62900`, `#FFB900`, `#F85400`, `#FF9000`) + `#FFFFFF`, e `#D9D9D9` **apenas** no slot de foto/logo? Zero subtons?
2. [ ] **Contraste de Marca:** Em cima do `#F85400` está branco? Em cima do branco está `#F85400` (nunca `#FF9000`)? Em cima de `#FF9000` está branco e `#F85400`? Pattern (se houver) invertido em relação ao fundo (ou branco 0,40–0,50), **sorrisos inteiros e nítidos (sem desfoque), escolhidos pelo `scripts/pattern-ancorado.js` fora do texto** (§3.1)? Sem pattern também vale.
3. [ ] **Caixa Alta Consciente:** Manchete em uppercase, mas corpo/apoio/disclaimer em caixa normal?
4. [ ] **Tipografia Estrita:** Manchete em `Realce Black` (900)? Subtítulo/apoio em `Roboto Medium` (500) ou Regular? Corpo em `Roboto Regular` (400)? Legal em `Roboto Light` (300)? Roboto Black e Light Itálica **só dentro de uma receita da §2.4** (no máximo uma expressiva por peça)? (**Zero** `Bold` 700.)
4b. [ ] **Preço-assinatura:** `R$`, vírgula e centavos a 55% e suspensos? `POR` preso ao valor? `%` do selo bate com DE → POR?
4c. [ ] **Coesão:** o card ou o selo prende na borda da foto (§2.2) em vez de flutuar? Uma camada por vez?
5. [ ] **Fidelidade:** 100% dos blocos vieram do inventário `assets/`?
6. [ ] **Autonomia do SVG:** Logo e fontes embutidas em base64 no `<style>`?
7. [ ] **Print Aprovado:** A arte passou pela auditoria multimodal da FASE 5 sem colisões e com respiro impecável?
8. [ ] **Legibilidade:** nenhum `font-size` < 22px, hero ≥ 80px (≥ 110px sobre `#FF9000`), preço ≥ 96px, hero ≥ 2,5× o apoio, tamanho do hero vindo de `medir-texto.js`? **`lint-art.js` sem ERROS** (e avisos resolvidos ou justificados)?
9. [ ] **Um só ponto focal:** dá para dizer em uma frase qual é a mensagem e o que o olho vê primeiro?
10. [ ] **Canvas cheio:** retângulo sem cantos arredondados; sem `@import`; foto ≤ ~55% da altura útil?
11. [ ] **Copy PT-BR:** acentuação correta, hero ≤ 4 palavras, sem texto de instrução ("Slot de alta resolução…") vazando para a arte final — só o slot `foto_produto` fica.
12. [ ] **Tokens:** vãos em `24/40/60/80/120`, raios `56/36/pílula`, um eixo de alinhamento, no máximo uma inclinação, sombra do preset?
13. [ ] **Revisão comparativa (peça nova):** nenhuma nota < 4 do subagente revisor, com o print **com foto** ao lado das referências?

---

## 6. Erros Recorrentes (aprenda com os prints anteriores)

| Erro visto | Correção |
| :--- | :--- |
| Roboto caindo em Arial por causa de `@import` | Embutir `@font-face` base64 de cada peso usado |
| Textos de 10–18px em selos/badges | Piso de 22px; reduza a copy ou aumente o selo |
| Hero de ~74px no story, pequeno diante da foto | Hero 110–170px; foto menor |
| Preço pequeno dentro de card | Preço ≥ 96px, é o 2º maior elemento |
| Slot de foto escuro (`#434343`) com texto branco, ou placeholder redesenhado a cada peça | Copiar o SVG de `assets/placeholders/` (cinza `#D9D9D9`, texto `#434343`) |
| Sombra `#000000`/`#802000`, divisória `#E0E0E0` | Sombra `#434343` com opacidade; divisória `#434343` com opacidade |
| Canvas com `clipPath rx=64` | Retângulo cheio |
| Topo do story vazio e conteúdo concentrado embaixo | Distribuir blocos pela faixa `y=260…1660` |
| Foto-slot gigante + tudo mais miúdo | Foto ≤ 55%; sobra área para hero/preço |
| Selo com texto longo | Máx. 2 linhas curtas; texto ≥ 22px |
| Pattern como folha cobrindo a arte inteira / branco atrás de texto branco | Pattern opcional, com sorrisos inteiros e nítidos escolhidos por `scripts/pattern-ancorado.js`; na dúvida, arte clean (§3.1) |
| Botão/tag amarelo com texto preto sobre `#FF9000`; pattern desfocado/esmaecido | Botão `#F85400` + texto branco (ou branco + `#F85400` sobre `#F85400`); pattern nítido, só com opacidade (§3 item 5 e §3.1) |
| `DE R$` pequeno/fino e selo de desconto flutuando longe do preço (apontado pela revisão fria) | `DE` ≥ 40px branco 100% com risco de 4px; selo preso ao preço/hero (≤ 200px) |
| Hero com tamanho "no olho" (sobra ou falta largura) | `node scripts/medir-texto.js` e usar a quebra recomendada |
| Mistura de alinhamento (centro + esquerda) / valores de espaço e raio soltos | Um eixo por peça; tokens da §2.2; o `lint-art.js` avisa |
| Slot de foto em arco/cúpula/círculo | **Só retângulo** (`rx=56`, qualquer proporção); logo da loja é a única exceção circular (§3.2) |
| Selo a menos de 40px do texto de apoio | Mover o selo ou o texto até ter ≥ 40px |
| Preço `R$ 22,90` com tudo do mesmo tamanho; `POR` solto na linha de base | Lockup-assinatura: `R$`/`,90` a 55% suspensos, `POR` preso ao `R$` (§2.1) |
| Pattern em escala 1.4–1.8: lascas de arco espalhadas, toco no vão entre título e foto | Escala 2.4–3.2, em massa na faixa inferior do story ou num canto; senão, clean (§3.1) |
| Card de preço, foto e selo soltos a 60px uns dos outros ("template de sistema") | Card preso à borda da foto com `data-sobrepoe`, selo na quina (§2.2) |
| Selo em cima da foto **e** do card (três camadas) | Selo só sobre a foto ou só no card |
| Selo "25% OFF" com DE 28,00 → POR 22,90 (é 18%) | Conferir a conta de todo desconto |
| Logo DM com `width=230` e 17% de margem transparente (marca real ~190px) | PNG recortado; `width` 240–300 |
| Todo hero em Realce maiúsculo, peças iguais | Uma receita da §2.4 por peça (frase mista, minúscula + vazado, lockup de valor) |
| Ticket de `cards-preco/ticket-cupom.svg` (cores fora da paleta) | Ticket do `refino_02` (aba `#F62900`, borda `#FF9000`) |
| CTA branco do mesmo peso do card de preço, disputando o olhar | CTA em contorno branco (`fill="none" stroke="#FFFFFF"`) quando o preço é o ponto focal |
| Julgar a arte só com o cinza do placeholder | Print com `--foto` (Fase 5) |

---

Ao seguir rigorosamente este manual com a etapa de print e auditoria visual, todo template gerado possui consistência matemática, visual impecável e prontidão total para publicação no catálogo do Luma.

