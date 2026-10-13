---
name: luma-creative
description: "Diretriz definitiva para geração e composição de templates de arte da Delivery Much no Luma. Use SEMPRE que for solicitado para criar, diagramar, sugerir ou compor novas artes, templates de feed (1080x1350), stories (1080x1920) ou variações criativas para o catálogo. Aplica o princípio de Design Atômico Estrito: NUNCA desenha vetores do zero, apenas orquestra ativos e blocos oficiais das bibliotecas sob regras rígidas de grid, contraste WCAG, hierarquia de 4 níveis de tipografia, tamanhos mínimos legíveis no celular e auditoria visual obrigatória do print. Responda e escreva a copy sempre em PT-BR."
metadata:
  author: luma-design-team
  version: "1.1.0"
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
* **Largura do hero:** estime `largura ≈ nº de caracteres × 0,46 × font-size` (Realce é condensada, caixa alta). Calcule o `font-size` para caber na largura útil (`1080 − 2×margem`) e **quebre em até 2–3 linhas** antes de reduzir abaixo do mínimo.
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

---

## 3. Paleta Oficial Fechada (Zero Subtons) & Leis de Contraste

> ⛔ **REGRA SUPREMA: PALETA FECHADA (ZERO SUBTONS)**  
> A marca Delivery Much utiliza **exclusivamente** estas 5 cores oficiais + Branco (`#FFFFFF`).  
> **Ou é essa cor ou nenhuma outra.** A IA está terminantemente proibida de inventar tons intermediários, subtons ou gradientes aleatórios.

| Hexadecimal | Nome Oficial | Papel & Aplicação |
| :--- | :--- | :--- |
| **`#434343`** | **Cinza Neutro / Grafite** | Molduras de foto, fundos de container neutros, badges e selos escuros. |
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
3. **Em cima de BRANCO (`#FFFFFF`):**
   * ✅ **SEMPRE use Laranja `#F85400`** para preços, botões e tipografia de destaque.
   * ❌ **NUNCA use `#FF9000` sobre branco**: `#FF9000` fica totalmente sem contraste no fundo branco (reprova WCAG e fica ilegível/lavado).
4. **Em cima de `#434343` (Cinza Grafite):**
   * ✅ Use **BRANCO (`#FFFFFF`)** ou **Amarelo `#FFB900`**.
5. **Em cima de `#FFB900` (Amarelo Ouro):**
   * ✅ Texto em **`#434343`** ou **`#F85400`**. ❌ Nunca branco sobre amarelo (reprova WCAG).
6. **Uso do `#F62900` (Laranja Avermelhado):** só como **acento pequeno** (tag de urgência, "ÚLTIMOS DIAS", faixa lateral de cupom) sobre branco ou `#434343`. ❌ Nunca como fundo grande, nunca ao lado de `#F85400` sem separação (as duas brigam), nunca para texto corrido.
7. **Opacidade, sombra e "cinza":**
   * Opacidade de uma cor oficial **é permitida** (`opacity`, `fill-opacity`, `flood-opacity`) — não cria hex novo.
   * **Sombras (`feDropShadow`)**: `flood-color="#434343"`, `flood-opacity` entre `0.15` e `0.28`. ❌ Nunca `#000000`, `#802000` nem marrom/preto inventado.
   * **Linhas, divisórias e tracejados**: `#434343` com opacidade (`0.15`–`0.3`) ou `#FFB900`/`#F85400`. ❌ Nunca `#E0E0E0`, `#F0F0F0` ou qualquer cinza claro avulso.
   * **Proibido** gradiente com hex fora da paleta; gradiente só entre `#F85400` ↔ `#FF9000`.
8. **Pattern / Sorriso da Delivery Much no Fundo (Grafismo de Marca) — REGRA DE INVERSÃO:**
   * **Fundo `#F85400` → pattern `#FF9000`.** Obrigatório.
   * **Fundo `#FF9000` → pattern `#F85400`.** Obrigatório (e vice-versa: o pattern nunca usa a mesma cor do fundo, nem outra cor).
   * **Opção extra: pattern em BRANCO (`#FFFFFF`)** sobre qualquer um dos dois fundos, **sempre com `opacity` entre `0.40` e `0.50`**. Nunca branco opaco nem fora dessa faixa.
   * Dose a opacidade do pattern laranja (ex.: `0.3` a `0.5`) para dar profundidade sem competir com os textos.
   * **Um pattern por peça:** escolha a versão laranja invertida **ou** a branca; não misture as duas.
   * Vale para `pattern-dm-oficial.svg`, arcos tone-on-tone e qualquer grafismo de fundo.

---

## 4. Estrutura de Arquivos da Skill

A skill organiza seus recursos nas seguintes pastas:

```text
.agents/skills/luma-creative/
├── SKILL.md                          <- Este manual de regras
├── assets/                           <- INVENTÁRIO EXCLUSIVO (Zero criação livre)
│   (templates prontos já gerados: `assets/templates/` na raiz do repo; geradores em `scripts/generate-10-templates.js`)
│   ├── logos/                        <- Logos oficiais DM (branca, laranja, símbolo)
│   ├── molduras/                     <- Molduras de foto (com aba de ícone ou domo)
│   ├── cards-preco/                  <- Card branco flutuante e tickets de cupom
│   ├── selos/                        <- Badges oficiais de campanha ("Mais Vendidos", parceiros)
│   ├── grafismos/                    <- Sorrisos oficiais DM (pattern.ai original + pattern-dm-oficial.svg)
│   └── fontes/                       <- Realce Black (otf + woff2), Roboto Regular 400 e Light 300. (Roboto Medium 500 ainda NÃO está no repo — ver Fase 3)
└── referencias/                      <- REPERTÓRIO VISUAL (Inspeção visual multimodal)
    ├── paleta-oficial-dm.png         <- Amostra visual exata das 5 cores oficiais da marca
    ├── grade-variacoes-templates.png <- Grade com 6 composições reais de referência
    ├── referencia-clean-ryan.png     <- Referência autoral com foco clean
    ├── referencia-cupom-feed.png     <- Referência com voucher de cupom e selo amarelo
    ├── referencia-cupom-foto-arco.png<- Referência com foto em arco e selo circular
    └── template-clean-feed.svg       <- SVG paramétrico oficial montado
```

Utilitários de suporte na raiz do repositório:
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
  5. **Foto é protagonista, mas não ocupa tudo:** no máximo **~55%** da altura útil no feed e **~50%** no story. O resto é hero, preço e respiro. Slot de foto gigante com título miúdo é erro.
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
* **Fundo:** cor sólida `#F85400` ou `#FF9000`, ou arcos tone-on-tone / `pattern-dm-oficial.svg` (sorriso DM com a regra de cor do item 8 da §3).
* **Moldura de foto:** aba superior ou arco de `assets/molduras/` em `#434343`.
* **Card de preço / voucher:** `assets/cards-preco/` em `#FFFFFF` (ou `#FFB900` no voucher).
* **Selo de campanha:** `assets/selos/`.
* **Logo:** `assets/logos/` — branca sobre laranja/grafite, laranja sobre branco; largura **mín. 200px**, sempre com ≥ 40px de ar ao redor. Nunca esticar, recolorir ou colocar sobre foto sem fundo sólido.
* **Fonte faltando:** se a peça precisa de Roboto Medium (500) e o arquivo não existe em `assets/fontes/`, **não finja**: avise o usuário e use Regular (400) com `letter-spacing` maior — nunca `font-weight: 500` sintetizado nem `Bold`.

### FASE 4: Teste de Estresse de Texto & Caixa Alta Consciente
Certifique-se de que o layout suporta preenchimento real do franqueado:
* Variável `{{produto}}` curta (*"PIZZA"*) ou longa (*"FESTIVAL GASTRONÔMICO"*). **Teste de verdade:** cheque o layout com `PIZZA`, `PIZZA CALABRESA TRADICIONAL` e um nome de 40 caracteres; os três têm de caber sem baixar do piso de 80px e sem tocar selo/card.
* Preço: `R$ 9,90`, `R$ 22,90` e `R$ 1.249,90` — o card não pode estourar nem encolher o número abaixo de 96px.
* Prefira **menos texto**: hero ≤ 4 palavras, apoio ≤ 1 frase, legal ≤ 2 linhas. Se a copy não cabe, corte a copy, não o tamanho da fonte.
* A tipografia display deve ter quebra de linha inteligente ou espaçamento reservado para não colidir com o selo ou o card de preço.
* **Reflexão de Caixa Alta:** Somente manchete hero e vouchers em uppercase; descrições, chamadas de app e rodapés em caixa normal.
* Tags obrigatórias quando aplicável: `{{produto}}`, `{{detalhes}}`, `{{preco}}` e slot `foto_produto`.

### FASE 5: Captura de Print & Auditoria Visual Multimodal (Respiro, Margens e Harmonia)
Gerar o código não encerra a tarefa. A IA **DEVE tirar o print da arte e olhar com os próprios olhos**:
1. **Renderizar o PNG:** Execute `node scripts/capture-art.js <arquivo.svg> <saida.png>`.
2. **Olhar a Imagem:** Abra o PNG resultante com a ferramenta de leitura de imagem (`Read` no caminho do PNG).
   **Teste do celular:** imagine o PNG em ~360px de largura. O hero, o preço e o ponto focal ainda se leem de relance? Se não, aumente.
3. **Auditoria objetiva por comando (rode antes de olhar):** pega o que o olho deixa passar.
   ```bash
   # hex fora da paleta (deve imprimir nada)
   grep -ohiE '#[0-9a-f]{6}' arte.svg | tr a-f A-F | sort -u | grep -vE '^#(434343|F62900|FFB900|F85400|FF9000|FFFFFF)$'
   # font-size abaixo de 22 (deve imprimir nada)
   grep -oE 'font-size="[0-9.]+"' arte.svg | grep -oE '[0-9.]+' | awk '$1<22'
   # @import externo, Bold 700 e canvas arredondado (deve imprimir nada)
   grep -nE '@import|font-weight[:="]+ *700|<rect width="1080"[^>]*rx=' arte.svg
   ```
4. **Auditar os Pilares Visuais:**
   * **Cores Oficiais & Subtons:** As cores usadas são estritamente as 5 oficiais? Zero subtons inventados?
   * **Contraste Correto:** Sobre `#F85400` é branco? Sobre branco está `#F85400` (e nunca `#FF9000`)?
   * **Caixa Alta:** O texto tem hierarquia legível sem parecer que está tudo gritando em caixa alta?
   * **Respiro (Whitespace & Aeramento):** Os blocos têm ar para respirar? Elementos flutuantes estão colidindo com títulos ou sufocando o slot de foto? O rodapé tem folga confortável antes da borda inferior?
   * **Margens & Sangria:** As margens de segurança laterais (100–120px) foram mantidas limpas? Nenhuma letra ou badge está prensado contra o limite do canvas?
   * **Harmonia & Peso Visual:** O centro de gravidade da arte está equilibrado? O olhar do usuário percorre a peça naturalmente: Título de impacto (Hero) → Detalhe/Card → Foto/Atração → Rodapé com logo e app?
5. **Refinamento Iterativo Obrigatório:** Se a IA identificar qualquer aperto, colisão, texto truncado, contraste errado ou desequilíbrio na inspeção do print, deve ajustar as coordenadas no código SVG e rodar o print novamente até alcançar harmonia cirúrgica. **Mínimo de 2 rodadas de print** em peça nova (a 1ª quase nunca está boa); registre o que mudou entre elas.
6. **Auditar a fonte:** o texto no PNG está em Realce/Roboto de verdade, ou caiu em Arial/Times? Hero com aparência "larga e genérica" = fallback → a fonte não foi embutida.

### FASE 6: Auto-Revisão Pré-Entrega (Checklist Final)
Antes de finalizar a arte:
1. [ ] **Paleta Fechada:** Somente as 5 cores oficiais (`#434343`, `#F62900`, `#FFB900`, `#F85400`, `#FF9000`) + `#FFFFFF`? Zero subtons?
2. [ ] **Contraste de Marca:** Em cima do `#F85400` está branco? Em cima do branco está `#F85400` (nunca `#FF9000`)? Em cima de `#FF9000` está branco e `#F85400`? Pattern invertido em relação ao fundo (ou branco com opacidade 0,40–0,50)?
3. [ ] **Caixa Alta Consciente:** Manchete em uppercase, mas corpo/apoio/disclaimer em caixa normal?
4. [ ] **Tipografia Estrita:** Manchete em `Realce Black` (900)? Subtítulo/apoio em `Roboto Medium` (500)? Corpo em `Roboto Regular` (400)? Legal em `Roboto Light` (300)? (**Zero** `Bold` 700).
5. [ ] **Fidelidade:** 100% dos blocos vieram do inventário `assets/`?
6. [ ] **Autonomia do SVG:** Logo e fontes embutidas em base64 no `<style>`?
7. [ ] **Print Aprovado:** A arte passou pela auditoria multimodal da FASE 5 sem colisões e com respiro impecável?
8. [ ] **Legibilidade:** nenhum `font-size` < 22px, hero ≥ 80px, preço ≥ 96px, hero ≥ 2,5× o apoio? Os 3 comandos de auditoria da Fase 5 saíram vazios?
9. [ ] **Um só ponto focal:** dá para dizer em uma frase qual é a mensagem e o que o olho vê primeiro?
10. [ ] **Canvas cheio:** retângulo sem cantos arredondados; sem `@import`; foto ≤ ~55% da altura útil?
11. [ ] **Copy PT-BR:** acentuação correta, hero ≤ 4 palavras, sem texto de instrução ("Slot de alta resolução…") vazando para a arte final — só o slot `foto_produto` fica.

---

## 6. Erros Recorrentes (aprenda com os prints anteriores)

| Erro visto | Correção |
| :--- | :--- |
| Roboto caindo em Arial por causa de `@import` | Embutir `@font-face` base64 de cada peso usado |
| Textos de 10–18px em selos/badges | Piso de 22px; reduza a copy ou aumente o selo |
| Hero de ~74px no story, pequeno diante da foto | Hero 110–170px; foto menor |
| Preço pequeno dentro de card | Preço ≥ 96px, é o 2º maior elemento |
| Sombra `#000000`/`#802000`, divisória `#E0E0E0` | Sombra `#434343` com opacidade; divisória `#434343` com opacidade |
| Canvas com `clipPath rx=64` | Retângulo cheio |
| Topo do story vazio e conteúdo concentrado embaixo | Distribuir blocos pela faixa `y=260…1660` |
| Foto-slot gigante + tudo mais miúdo | Foto ≤ 55%; sobra área para hero/preço |
| Selo com texto longo | Máx. 2 linhas curtas; texto ≥ 22px |

---

Ao seguir rigorosamente este manual com a etapa de print e auditoria visual, todo template gerado possui consistência matemática, visual impecável e prontidão total para publicação no catálogo do Luma.

