---
name: luma-creative
description: "Diretriz definitiva para geração e composição de templates de arte da Delivery Much no Luma. Use SEMPRE que for solicitado para criar, diagramar, sugerir ou compor novas artes, templates de feed (1080x1350), stories (1080x1920) ou variações criativas para o catálogo. Aplica o princípio de Design Atômico Estrito: NUNCA desenha vetores do zero, apenas orquestra ativos e blocos oficiais das bibliotecas sob regras rígidas de grid, contraste WCAG e hierarquia de 4 níveis de tipografia."
metadata:
  author: luma-design-team
  version: "1.0.0"
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

> ⚠️ **Embutimento Obrigatório:** Todo SVG gerado deve conter a fonte `Realce Black` (`realce-black.woff2`) embutida em base64 no `<style>` via `@font-face` para não sofrer fallback para fontes genéricas do sistema.

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

---

## 4. Estrutura de Arquivos da Skill

A skill organiza seus recursos nas seguintes pastas:

```text
.agents/skills/luma-creative/
├── SKILL.md                          <- Este manual de regras
├── assets/                           <- INVENTÁRIO EXCLUSIVO (Zero criação livre)
│   ├── logos/                        <- Logos oficiais DM (branca, laranja, símbolo)
│   ├── molduras/                     <- Molduras de foto (com aba de ícone ou domo)
│   ├── cards-preco/                  <- Card branco flutuante e tickets de cupom
│   ├── selos/                        <- Badges oficiais de campanha ("Mais Vendidos", parceiros)
│   ├── grafismos/                    <- Arcos concêntricos de fundo
│   └── fontes/                       <- Arquivos de fonte da marca (Realce Black, Roboto)
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

### FASE 2: Grade & Zonas Seguras (Safe Zones)
* **Feed (1080×1350 - Proporção 4:5):**
  * Margem lateral mínima: `100px` a `120px` (o layout nunca vaza nas bordas).
  * Margem superior/inferior: `70px` a `90px` (rodapé aerado com a logo DM e textos legais).
* **Story (1080×1920 - Proporção 9:16):**
  * Zona proibida de topo: primeiros `250px` (reservado para header do Instagram).
  * Zona proibida de base: últimos `250px` (reservado para barra de resposta/compartilhar).
  * Conteúdo útil concentrado na faixa central (`y = 260` até `y = 1660`).

### FASE 3: Orquestração de Blocos do Inventário
Puxe os elementos diretamente de `assets/`:
1. Fundo com arcos geométricos ou cor sólida usando as cores oficiais `#F85400` ou `#FF9000`.
2. Moldura com aba superior ou arco de `assets/molduras/` usando `#434343`.
3. Card flutuante de preço em `#FFFFFF` ou voucher de cupom em `#FFFFFF` / `#FFB900`.
4. Selo de campanha sobreposto de `assets/selos/`.
5. Logo oficial horizontal branca no rodapé de `assets/logos/`.

### FASE 4: Teste de Estresse de Texto & Caixa Alta Consciente
Certifique-se de que o layout suporta preenchimento real do franqueado:
* Variável `{{produto}}` curta (*"PIZZA"*) ou longa (*"FESTIVAL GASTRONÔMICO"*).
* A tipografia display deve ter quebra de linha inteligente ou espaçamento reservado para não colidir com o selo ou o card de preço.
* **Reflexão de Caixa Alta:** Somente manchete hero e vouchers em uppercase; descrições, chamadas de app e rodapés em caixa normal.
* Tags obrigatórias quando aplicável: `{{produto}}`, `{{detalhes}}`, `{{preco}}` e slot `foto_produto`.

### FASE 5: Captura de Print & Auditoria Visual Multimodal (Respiro, Margens e Harmonia)
Gerar o código não encerra a tarefa. A IA **DEVE tirar o print da arte e olhar com os próprios olhos**:
1. **Renderizar o PNG:** Execute `node scripts/capture-art.js <arquivo.svg> <saida.png>`.
2. **Olhar a Imagem:** Abra o PNG resultante com a ferramenta de visão multimodal (`view_file`).
3. **Auditar os Pilares Visuais:**
   * **Cores Oficiais & Subtons:** As cores usadas são estritamente as 5 oficiais? Zero subtons inventados?
   * **Contraste Correto:** Sobre `#F85400` é branco? Sobre branco está `#F85400` (e nunca `#FF9000`)?
   * **Caixa Alta:** O texto tem hierarquia legível sem parecer que está tudo gritando em caixa alta?
   * **Respiro (Whitespace & Aeramento):** Os blocos têm ar para respirar? Elementos flutuantes estão colidindo com títulos ou sufocando o slot de foto? O rodapé tem folga confortável antes da borda inferior?
   * **Margens & Sangria:** As margens de segurança laterais (100–120px) foram mantidas limpas? Nenhuma letra ou badge está prensado contra o limite do canvas?
   * **Harmonia & Peso Visual:** O centro de gravidade da arte está equilibrado? O olhar do usuário percorre a peça naturalmente: Título de impacto (Hero) → Detalhe/Card → Foto/Atração → Rodapé com logo e app?
4. **Refinamento Iterativo Obrigatório:** Se a IA identificar qualquer aperto, colisão, texto truncado, contraste errado ou desequilíbrio na inspeção do print, deve ajustar as coordenadas no código SVG e rodar o print novamente até alcançar harmonia cirúrgica.

### FASE 6: Auto-Revisão Pré-Entrega (Checklist Final)
Antes de finalizar a arte:
1. [ ] **Paleta Fechada:** Somente as 5 cores oficiais (`#434343`, `#F62900`, `#FFB900`, `#F85400`, `#FF9000`) + `#FFFFFF`? Zero subtons?
2. [ ] **Contraste de Marca:** Em cima do `#F85400` está branco? Em cima do branco está `#F85400` (nunca `#FF9000`)? Em cima de `#FF9000` está branco e `#F85400`?
3. [ ] **Caixa Alta Consciente:** Manchete em uppercase, mas corpo/apoio/disclaimer em caixa normal?
4. [ ] **Tipografia Estrita:** Manchete em `Realce Black` (900)? Subtítulo/apoio em `Roboto Medium` (500)? Corpo em `Roboto Regular` (400)? Legal em `Roboto Light` (300)? (**Zero** `Bold` 700).
5. [ ] **Fidelidade:** 100% dos blocos vieram do inventário `assets/`?
6. [ ] **Autonomia do SVG:** Logo e fontes embutidas em base64 no `<style>`?
7. [ ] **Print Aprovado:** A arte passou pela auditoria multimodal da FASE 5 sem colisões e com respiro impecável?

---

Ao seguir rigorosamente este manual com a etapa de print e auditoria visual, todo template gerado possui consistência matemática, visual impecável e prontidão total para publicação no catálogo do Luma.

