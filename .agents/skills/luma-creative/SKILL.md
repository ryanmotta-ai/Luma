---
name: luma-creative
description: "Diretriz definitiva para geração e composição de templates de arte da Delivery Much no Luma. Use SEMPRE que for solicitado para criar, diagramar, sugerir ou compor novas artes, templates de feed (1080x1350), stories (1080x1920) ou variações criativas para o catálogo. Aplica o princípio de Design Atômico Estrito: NUNCA desenha vetores do zero, apenas orquestra ativos e blocos oficiais das bibliotecas sob regras rígidas de grid, contraste WCAG, hierarquia de 4 níveis de tipografia, tamanhos mínimos legíveis no celular e auditoria visual obrigatória do print. Responda e escreva a copy sempre em PT-BR."
metadata:
  author: luma-design-team
  version: "1.2.0"
---

# Luma Creative — Diretriz de Composição de Artes e Templates

> **Regra Suprema de Geração:** A IA **NUNCA desenha vetores livres nem inventa ilustrações do zero**.  
> Sua função é atuar como um **Diretor de Arte / Diagramador Sênior**: você seleciona blocos e ativos oficiais do inventário (`assets/`), define a hierarquia visual, respeita as zonas seguras (safe zones) e compõe a cena em SVG puro paramétrico.

---

## 1. O Princípio da Geração sob Restrição (Constrained Design)

A consistência de marca da Delivery Much em mais de 100 cidades depende de **previsibilidade absoluta**:
1. **Ativos Fechados:** Logos, selos, molduras e grafismos vêm **exclusivamente** da biblioteca oficial da skill.
2. **SVG Autônomo e Paramétrico:** Todo SVG gerado deve embutir a fonte oficial e os logos em base64, garantindo renderização idêntica em qualquer sistema, além de conter as tags do Luma (`{{produto}}`, `{{preco}}`, `foto_produto`).
3. **Consistência acima de Invenção:** Menos é mais. O design da DM é limpo, assertivo, solar e funcional (Retail Moderno).

---

## 2. Escala Tipográfica Oficial (4 Níveis Estritos)

O Luma utiliza uma escala disciplinada de 4 níveis. O peso `Bold (700)` foi **eliminado** para evitar degraus intermediários confusos e garantir contraste dinâmico máximo.

| Nível | Família & Peso | Função no Design | Exemplos Obrigatórios |
| :--- | :--- | :--- | :--- |
| **1. Impacto / Hero** | **`Realce Black` (900)** | A voz expressiva e proprietária da Delivery Much | Título principal (`{{produto}}`), Preço promocional (`R$ 22,90`), Destaques centrais de selos (*"VENDIDOS"*, *"25% OFF"*). |
| **2. Apoio & Âncoras** | **`Roboto Medium` (500)** | Leitura técnica, limpa e sofisticada | Subtítulos (`DETALHES`), Preço anterior riscado (*R$ 28,00*), código de cupom (`NIVERDM`), labels com tracking expandido (`letter-spacing: 1px`). |
| **3. Corpo & Instrução** | **`Roboto Regular` (400)** | Clareza e funcionalidade | Descrição do produto, texto guia do slot (*"Use aqui sua foto do produto"*). |
| **4. Legal & Respiro** | **`Roboto Light` (300)** | Discrição e elegância máxima | Disclaimers em rodapé (*"Consulte os restaurantes participantes"*, regras de cupom). |

> ⚠️ **Embutimento Obrigatório:** Todo SVG gerado deve conter a fonte `Realce Black` (`realce-black.woff2`) **e cada peso de Roboto realmente usado** (300 / 400 / 500) embutidos em base64 no `<style>` via `@font-face`. **Proibido `@import` de Google Fonts**: dentro de SVG renderizado como imagem ou offline ele não carrega e o texto cai em Arial (já aconteceu nos prints dos templates 01–10). Arquivos em `assets/fontes/`.

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
* **Preço (lockup fixo):** `DE R$ 28,00` riscado (apoio, ≥32px) → `POR` (apoio) → **`R$ 22,90` em Realce ≥96px** (o "R$" e os centavos no mesmo tamanho do número). O preço é o 2º maior elemento da peça.

### 📐 2.2 Sistema de Proporções (tokens: nada de valor solto)
| Token | Valores permitidos |
| :--- | :--- |
| **Espaçamento** (vãos entre blocos, margens internas) | `24` · `40` · `60` · `80` · `120` px. Hero→apoio = `40`; entre blocos independentes = `60`/`80`/`120`; dentro de card = `24`–`40`. |
| **Raio** | Foto/slot `56` · card/ticket `36` · botão/tag = **pílula** (`rx = altura/2`) · selo = círculo · canvas `0` |
| **Sombra** (único preset) | Card/ticket: `feDropShadow dy=12 stdDeviation=16 flood-color=#434343 flood-opacity=0.25`. Selo/badge: `dy=6 stdDeviation=10 opacity=0.2`. Nenhuma outra. |
| **Linha/divisória** | `stroke #434343` com `opacity 0.25`, `stroke-width 3` |

* **Um eixo de alinhamento por peça:** todos os textos soltos à **esquerda (x=100)** ou todos **centralizados (x=540)**. Misturar os dois é o erro mais comum de "arte amadora". Textos dentro de um card seguem o eixo do card.
* **Uma inclinação por peça (opcional):** no máximo **um** elemento (selo, ticket de cupom ou tag) com `rotate` entre **-6° e -10°** para dar energia. Nunca o hero, o preço, texto corrido ou a foto.
* **Ritmo:** repita os mesmos vãos entre blocos equivalentes (se hero→foto é 80, foto→card também é 80).

### ✍️ 2.3 Copy (tom Delivery Much)
* Para texto institucional, de lançamento ou de campanha, **use a skill `branding-delivery-much`** (tom de voz, personas Paulo/Lucas).
* **Fórmulas que funcionam:** `[Ocasião] com [produto]!` ("Sextou com burger!"), `Peça pelo app`, `Entrega grátis`, `[N]% OFF`, `Novo parceiro`, `Use o cupom [CÓDIGO]`.
* **Hero ≤ 4 palavras**, apoio ≤ 1 frase (~38 caracteres/linha), legal ≤ 2 linhas.
* **CTA em imperativo curto**: `PEDIR`, `PEDIR AGORA`, `APROVEITAR`. Sem emoji. Valores sempre `R$ 22,90` (vírgula).
* **Não invente preço, regra, prazo ou condição** do franqueado: se a peça precisa e o briefing não deu, **pergunte** (negócio não se assume). Texto de exemplo nas artes-modelo usa valores fictícios claros.


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
   * ⚠️ **Branco sobre `#FF9000` tem contraste baixo (~2,3:1):** compense com **tamanho**. Hero e preço **≥ 110px** (feed) / **≥ 120px** (story); apoio **≥ 36px** e só em Regular (400) — nunca Light (300) abaixo de 30px. **Prefira fundo `#F85400`** quando a peça tiver 3+ blocos de texto ou texto pequeno; reserve `#FF9000` para peças **limpas**: poucas palavras, hero grande.
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
3. Sobra **ar ao redor do âncora**: o script do passo 3 encontra **pelo menos 3 sorrisos inteiros** fora de qualquer texto.
4. A peça **não é dominada por texto** (hero 2+ linhas + preço + card + muito apoio) nem tem foto cobrindo mais de ~60% do canvas.

Qualquer condição falsa → **arte clean: fundo liso `#F85400` ou `#FF9000`, sem pattern, sem arcos.** É uma composição completa e correta, não uma peça "faltando coisa". Composição clean é a escolha **padrão** quando o layout já está cheio.

**PASSO 2 — Defina a zona e as caixas de texto**
* **Âncora** = o maior bloco gráfico. A **zona** é a região onde os sorrisos podem ficar: **elipse** (`ellipse:cx,cy,rx,ry`) para âncora redondo/arco, **retângulo** (`rect:x,y,w,h`) para âncora retangular, ticket ou foto lateral. Faça a zona **generosa e do lado oposto ao texto**; pode passar das bordas do canvas (o pattern pode sangrar).
* **Caixas de texto** (`x,y,w,h`): uma para **cada** hero, apoio, preço, CTA, logo DM e legal. O script mantém **30px** de distância delas.

**PASSO 3 — Rode o script (decide a posição; a IA não deliberar)**
```bash
node scripts/pattern-ancorado.js --canvas 1080x1350 \
  --zone ellipse:540,365,600,400 --anchor 240,90,600,550 \
  --text 185,742,710,235 --text 180,1020,720,40 --text 410,1112,260,77 \
  --scale 1.4 --color "#FFFFFF" --opacity 0.4
```
* O script escolhe **só sorrisos inteiros** do arquivo oficial cujo centro está na zona e que **não encostam em nenhum texto**, testa o deslocamento (`translate`) e imprime o `<g>` pronto. Cole-o **logo depois do fundo liso**, antes do conteúdo.
* **Saiu "SEM PATTERN"** (menos de 3 sorrisos): faça **arte clean**. Não force: não amplie a zona por cima do texto nem reduza as caixas de texto.
* Âncora opaco cobre sorrisos; `--anchor` evita contar os que ficariam escondidos.
* `--scale`: feed `1.4`, story `1.8` (aceitável `1.4`–`1.8`). Menor que `1.2` vira papel de parede.
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
* **Exemplos aprovados:** `referencias/referencia-cupom-foto-arco.png` (pattern só atrás do cupom, à esquerda; copy à direita limpa) e o Festival Gastronômico do refino (pattern em volta da moldura em arco; texto de baixo limpo).

### 🖼️ 3.2 Placeholder de Foto e Logo — SVG Padrão (reaproveitar, nunca recriar)

Onde a foto do produto, da loja ou o logo do parceiro vai entrar, a arte mostra **sempre o mesmo placeholder**: um bloco em **cinza claro `#D9D9D9`** com **ícone e texto em cima em `#434343`**. É o padrão das artes oficiais (`referencias/referencia-cupom-foto-arco.png`, `grade-variacoes-templates.png`).

* **`#D9D9D9` é a única exceção à paleta fechada** e **só vale para o slot** (foto/logo). Nunca como fundo decorativo, card, divisória ou texto. O slot é substituído pela foto real no Luma; o cinza não aparece na arte publicada.
* **SVGs padrão em `assets/placeholders/`** — copie o `<g id="foto_produto">` (ou `id="logo_loja"`) do arquivo e altere **apenas posição e dimensão**. **Não redesenhe, não troque a cor, o raio, o ícone ou o texto**. O que pode variar por forma:
  * **Retângulo:** largura e altura livres; `rx` fixo em `56`.
  * **Arco:** largura livre (raio do topo = largura ÷ 2) e altura livre.
  * **Círculo e logo da loja:** só o diâmetro.
  * **Ícone e texto nunca escalam** (ficam no tamanho do arquivo, sempre centralizados no slot) — assim a legenda continua legível.
  * **Foto sangrando nas bordas** (encostando no canvas, com curva só em um lado): pode recortar a forma do slot, mantendo **o mesmo cinza, ícone e texto**.

  | Arquivo | Uso | Texto fixo |
  | :--- | :--- | :--- |
  | `slot-foto-produto-retangulo.svg` (880×560, `rx=56`) | foto do produto/prato/fachada em bloco | "Use aqui sua foto do produto" |
  | `slot-foto-produto-arco.svg` (600×760, topo em arco) | foto em arco/cúpula | idem |
  | `slot-foto-produto-circulo.svg` (560×560) | foto circular | idem |
  | `slot-logo-loja.svg` (220×220, círculo) | logo/foto da loja ou do parceiro | "Logo da loja" |

* **Texto do slot:** `Roboto Regular 400`, **≥ 28px** (≥ 24px no logo da loja), `#434343`, centralizado abaixo do ícone. Só os textos fixos da tabela. Para foto de loja/evento use "Use aqui sua foto da loja" / "Use aqui a foto do evento" **trocando só a frase**, mantendo o mesmo SVG.
* **Mantenha o `id`** (`foto_produto` / `logo_loja`): é o gancho que o Luma usa para trocar pela imagem real.
* **Variações de forma** (retângulo, arco, círculo) valem; **variações de cor não**. Moldura/aba ao redor do slot continua com as regras de paleta (`#434343`, branco ou `#FFB900`).
* **Tamanho mínimo:** logo da loja ≥ **220px**; foto ≥ **35%** da largura do canvas (senão não dá para ler a legenda).
* Proibido: texto branco sobre o slot cinza, ícone em outra cor, placeholder em `#434343` escuro (padrão antigo, abandonado), legenda inventada ("Slot de alta resolução…").

### 📷 3.3 Foto Real do Produto (quando a foto entrar no slot)

O placeholder `#D9D9D9` (§3.2) reserva o espaço; a foto real do franqueado entra **no mesmo lugar e na mesma forma**. *(Regras abaixo ainda a validar com fotos reais: testar com ~6 fotos, recortadas e com fundo.)*
* **Mecânica:** a `<image>` entra **dentro do `<g id="foto_produto">`**, recortada pela forma do slot (`clipPath` com o mesmo `path`/`rect`/`circle`) e com `preserveAspectRatio="xMidYMid slice"`. **Mantenha o `id`.**
* **Foto com fundo:** preenche o slot inteiro. Sobre fundo laranja, um **aro branco de 12–24px** em volta do slot (como nos círculos das artes 04 e 06) separa a foto do fundo.
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
│   (templates prontos já gerados: `assets/templates/` na raiz do repo; geradores em `scripts/generate-10-templates.js`)
│   ├── logos/                        <- Logos oficiais DM (branca, laranja, símbolo)
│   ├── placeholders/                 <- SVGs PADRÃO do slot de foto/logo (cinza #D9D9D9) — reaproveitar, §3.2
│   ├── molduras/                     <- Molduras de foto (com aba de ícone ou domo), já no cinza #D9D9D9
│   ├── cards-preco/                  <- Card branco flutuante e tickets de cupom
│   ├── selos/                        <- Badges oficiais de campanha ("Mais Vendidos", parceiros)
│   ├── grafismos/                    <- Sorrisos oficiais DM (pattern.ai original + pattern-dm-oficial.svg) + pattern-ancorado.svg (técnica padrão da §3.1)
│   └── fontes/                       <- Realce Black (otf + woff2), Roboto Regular 400 e Light 300. (Roboto Medium 500 ainda NÃO está no repo — ver Fase 3)
└── referencias/                      <- REPERTÓRIO VISUAL (Inspeção visual multimodal)
    ├── paleta-oficial-dm.png         <- Amostra visual exata das 5 cores oficiais da marca
    ├── grade-variacoes-templates.png <- Grade com 6 composições reais de referência
    ├── referencia-clean-ryan.png     <- Referência autoral com foco clean
    ├── referencia-cupom-feed.png     <- Referência com voucher de cupom e selo amarelo
    ├── referencia-cupom-foto-arco.png<- Referência com foto em arco e selo circular
    └── template-clean-feed.svg       <- SVG paramétrico oficial montado
```

**Ativos previstos (ainda não estão no repo — NÃO invente nem desenhe equivalentes; use só depois de subirem):** mockup de celular com o app, moto/entregador, chapéu de chef (símbolo), ícones de app e setas, mais selos de campanha, `Roboto-Medium.ttf` (500) e fotos de produto de teste (recortadas e com fundo). Enquanto faltarem: peça sem eles; se o briefing exige o ativo, **avise o usuário**.

Utilitários de suporte na raiz do repositório:
* `scripts/pattern-ancorado.js`: posiciona o pattern oficial escolhendo **sorrisos inteiros fora do texto** (§3.1, passo 3). Sem saída = arte clean.
* `scripts/lint-art.js`: **linter obrigatório da Fase 5** — mede o SVG no navegador e confere paleta, fontes, tamanhos, margens, colisões, vãos, contraste por fundo, botões/tags, selos, foto, pattern nítido, raios e alinhamento. Sai com código 1 se houver ERRO.
* `scripts/medir-texto.js`: mede o hero em Realce de verdade e recomenda quebra e `font-size` (Fase 4).
* `scripts/capture-art.js`: Renderizador headless (Edge/CDP zero-dep) que converte o SVG gerado em PNG de alta resolução nas proporções exatas (1080×1350 ou 1080×1920) para inspeção visual da IA.

---

## 5. Pipeline Obrigatório de Composição (6 Fases)

Ao receber um pedido de nova arte ou template, a IA executa este fluxo em sequência obrigatória:

### FASE 1: Inspeção Visual das Referências & Paleta (Visão Multimodal Inicial)
Antes de escrever uma única linha de código, a IA **DEVE abrir e inspecionar visualmente os PNGs em `referencias/`**:
* **Sensibilidade Estética e Respiro:** Olhe os PNGs para absorver como o Ryan distribui o peso visual, o contraste entre espaços cheios e vazados, e a hierarquia entre foto, selo e tipografia.
* **Paleta Oficial em `referencias/paleta-oficial-dm.png`:** Fixe as 5 cores oficiais na mente. Proibido subtons intermediários.
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
> * Às vezes a foto do produto/loja fica no topo (em arco/domo) e o título + preço ficam na base.
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

### FASE 3: Orquestração de Blocos do Inventário
Puxe os elementos diretamente de `assets/`. **Isto é o inventário disponível, não uma ordem fixa** — use só o que a mensagem da peça pede (a ordem e a presença de cada bloco seguem a Fase 2):
* **Fundo:** cor sólida `#F85400` ou `#FF9000`. Pattern oficial **só se o procedimento da §3.1 mandar** (opcional, ancorado, nunca folha inteira); caso contrário, fundo liso.
* **Slot de foto/logo:** `assets/placeholders/` (§3.2), cinza `#D9D9D9`. Moldura/aba decorativa de `assets/molduras/` ao redor, quando houver.
* **Card de preço / voucher:** `assets/cards-preco/` em `#FFFFFF` (ou `#FFB900` no voucher).
* **Selo de campanha:** `assets/selos/`.
* **Logo:** `assets/logos/` — branca sobre laranja/grafite, laranja sobre branco; largura **mín. 200px**, sempre com ≥ 40px de ar ao redor. Nunca esticar, recolorir ou colocar sobre foto sem fundo sólido.
* **Fonte faltando:** se a peça precisa de Roboto Medium (500) e o arquivo não existe em `assets/fontes/`, **não finja**: avise o usuário e use Regular (400) com `letter-spacing` maior — nunca `font-weight: 500` sintetizado nem `Bold`.

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
1. **Renderizar o PNG:** Execute `node scripts/capture-art.js <arquivo.svg> <saida.png>`.
2. **Olhar a Imagem:** Abra o PNG resultante com a ferramenta de leitura de imagem (`Read` no caminho do PNG).
   **Teste do celular:** imagine o PNG em ~360px de largura. O hero, o preço e o ponto focal ainda se leem de relance? Se não, aumente.
3. **Linter automático (rode ANTES de olhar o print; ERRO bloqueia a entrega):**
   ```bash
   node scripts/lint-art.js arte.svg            # --story / --feed se o formato não for detectável
   ```
   Ele mede o SVG no navegador (caixas reais) e confere: paleta, fontes, `font-size` ≥ 22, margens e zona útil do story, colisões e vãos, estouro de texto no card, contraste por fundo, botão/tag amarelo, selo perto de texto (≥ 40px), foto (área e `#D9D9D9`), pattern desfocado, tokens de raio e eixo de alinhamento. **Erros: corrija e rode de novo até zerar. Avisos: corrija, ou justifique em uma linha** (ex.: "sangria intencional").
4. **Auditar os Pilares Visuais:**
   * **Cores Oficiais & Subtons:** As cores usadas são estritamente as 5 oficiais? Zero subtons inventados?
   * **Contraste Correto:** Sobre `#F85400` é branco? Sobre branco está `#F85400` (e nunca `#FF9000`)?
   * **Caixa Alta:** O texto tem hierarquia legível sem parecer que está tudo gritando em caixa alta?
   * **Respiro (Whitespace & Aeramento):** Os blocos têm ar para respirar? Elementos flutuantes estão colidindo com títulos ou sufocando o slot de foto? O rodapé tem folga confortável antes da borda inferior?
   * **Margens & Sangria:** As margens de segurança laterais (100–120px) foram mantidas limpas? Nenhuma letra ou badge está prensado contra o limite do canvas?
   * **Pattern (§3.1):** ele cobre só uma zona em volta do âncora, a copy está sobre cor lisa e nenhum sorriso passa atrás de texto, preço, cupom ou CTA? Há pattern onde o layout não tinha âncora nem ar (nesse caso, remova: clean é melhor)?
   * **Harmonia & Peso Visual:** O centro de gravidade da arte está equilibrado? O olhar do usuário percorre a peça naturalmente: Título de impacto (Hero) → Detalhe/Card → Foto/Atração → Rodapé com logo e app?
5. **Refinamento Iterativo Obrigatório:** Se a IA identificar qualquer aperto, colisão, texto truncado, contraste errado ou desequilíbrio na inspeção do print, deve ajustar as coordenadas no código SVG e rodar o print novamente até alcançar harmonia cirúrgica. **Mínimo de 2 rodadas de print** em peça nova (a 1ª quase nunca está boa); registre o que mudou entre elas.
6. **Revisão por outro olhar (peça nova):** o autor tende a aprovar a própria arte. Depois do lint e das 2 rodadas, chame um **subagente revisor** (ferramenta `Agent`) dando **só o caminho do PNG e a lista de pilares**, sem a sua opinião: *"Revise este PNG de arte da Delivery Much (1080 de largura). Dê nota 0–5 para: ponto focal, hierarquia, respiro, contraste, marca/paleta, acabamento; liste os 3 piores problemas com coordenadas aproximadas."* **Qualquer nota < 4 → corrija e revise de novo.** Não use para ajuste pequeno.
7. **Auditar a fonte:** o texto no PNG está em Realce/Roboto de verdade, ou caiu em Arial/Times? Hero com aparência "larga e genérica" = fallback → a fonte não foi embutida.

### FASE 6: Auto-Revisão Pré-Entrega (Checklist Final)
Antes de finalizar a arte:
1. [ ] **Paleta Fechada:** Somente as 5 cores oficiais (`#434343`, `#F62900`, `#FFB900`, `#F85400`, `#FF9000`) + `#FFFFFF`, e `#D9D9D9` **apenas** no slot de foto/logo? Zero subtons?
2. [ ] **Contraste de Marca:** Em cima do `#F85400` está branco? Em cima do branco está `#F85400` (nunca `#FF9000`)? Em cima de `#FF9000` está branco e `#F85400`? Pattern (se houver) invertido em relação ao fundo (ou branco 0,40–0,50), **sorrisos inteiros e nítidos (sem desfoque), escolhidos pelo `scripts/pattern-ancorado.js` fora do texto** (§3.1)? Sem pattern também vale.
3. [ ] **Caixa Alta Consciente:** Manchete em uppercase, mas corpo/apoio/disclaimer em caixa normal?
4. [ ] **Tipografia Estrita:** Manchete em `Realce Black` (900)? Subtítulo/apoio em `Roboto Medium` (500)? Corpo em `Roboto Regular` (400)? Legal em `Roboto Light` (300)? (**Zero** `Bold` 700).
5. [ ] **Fidelidade:** 100% dos blocos vieram do inventário `assets/`?
6. [ ] **Autonomia do SVG:** Logo e fontes embutidas em base64 no `<style>`?
7. [ ] **Print Aprovado:** A arte passou pela auditoria multimodal da FASE 5 sem colisões e com respiro impecável?
8. [ ] **Legibilidade:** nenhum `font-size` < 22px, hero ≥ 80px (≥ 110px sobre `#FF9000`), preço ≥ 96px, hero ≥ 2,5× o apoio, tamanho do hero vindo de `medir-texto.js`? **`lint-art.js` sem ERROS** (e avisos resolvidos ou justificados)?
9. [ ] **Um só ponto focal:** dá para dizer em uma frase qual é a mensagem e o que o olho vê primeiro?
10. [ ] **Canvas cheio:** retângulo sem cantos arredondados; sem `@import`; foto ≤ ~55% da altura útil?
11. [ ] **Copy PT-BR:** acentuação correta, hero ≤ 4 palavras, sem texto de instrução ("Slot de alta resolução…") vazando para a arte final — só o slot `foto_produto` fica.
12. [ ] **Tokens:** vãos em `24/40/60/80/120`, raios `56/36/pílula`, um eixo de alinhamento, no máximo uma inclinação, sombra do preset?
13. [ ] **Revisão fria (peça nova):** nenhuma nota < 4 do subagente revisor?

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
| Hero com tamanho "no olho" (sobra ou falta largura) | `node scripts/medir-texto.js` e usar a quebra recomendada |
| Mistura de alinhamento (centro + esquerda) / valores de espaço e raio soltos | Um eixo por peça; tokens da §2.2; o `lint-art.js` avisa |
| Selo a menos de 40px do texto de apoio | Mover o selo ou o texto até ter ≥ 40px |

---

Ao seguir rigorosamente este manual com a etapa de print e auditoria visual, todo template gerado possui consistência matemática, visual impecável e prontidão total para publicação no catálogo do Luma.

