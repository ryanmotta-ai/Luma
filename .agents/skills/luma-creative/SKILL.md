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
| **4. Legal & Respiro** | **`Roboto Light` (300)** | Discrição e elegância máxima | Disclaimers em rodapé (*"*Promoção por tempo limitado"*, *"Consulte as lojas participantes"*), regras de cupom. |

> ⚠️ **Embutimento Obrigatório:** Todo SVG gerado deve conter a fonte `Realce Black` (`realce-black.woff2`) embutida em base64 no `<style>` via `@font-face` para não sofrer fallback para fontes genéricas do sistema.

---

## 3. Paleta e Tokens de Marca

Toda cor deve seguir rigorosamente os tokens da Delivery Much (`css/00-tokens.css`):

* **Laranja Principal (`--dm-orange` / `--gradient-orange`):** `#FF4D00` a `#FF9000` (Fundo primário de alto impacto).
* **Arcos e Grafismos Tone-on-Tone:** `#E63E00` (Traço de 115px sobre o fundo laranja para profundidade sutil).
* **Laranja Ação (`--dm-orange-d`):** `#F85400` (Preço de destaque dentro do card branco).
* **Superfícies Claras:** `#FFFFFF` (Card de preço e selos) e `#FFF8ED` (Creme institucional).
* **Amarelo Ouro (`--dm-yellow`):** `#FFB900` (Destaque em selos de desconto e cupons).
* **Vermelho Oferta (`--dm-red`):** `#C81818` (Alertas e badges de gestão).
* **Cinza Container:** `#5A5D61` (Fundo neutro da moldura de foto).
* **Preto Profundo (`--on-orange` / `--text`):** `#0A0A0A` ou `#000000` (Legal disclaimer e preço tachado).

### ⛔ Leis Inegociáveis de Contraste (WCAG)
* **Texto branco sobre Laranja puro `#FF9000` é PROIBIDO:** Reprova no teste WCAG (apenas 2.27:1).
* **Solução:** Texto branco só entra sobre `#FF4D00` escuro/vivo em display grande (900), ou sobre `#0A0A0A`, ou o conteúdo de preço vai dentro do **Card Branco Flutuante**.
* **Logo Branca (`dm-h-branca.png`)** é obrigatória sobre fundos laranjas ou escuros.

---

## 4. Estrutura de Arquivos da Skill

A skill organiza seus recursos nas seguintes pastas:

```text
.agents/skills/luma-creative/
├── SKILL.md                          <- Este manual de regras
├── assets/                           <- INVENTÁRIO EXCLUSIVO (Zero criação livre)
│   ├── logos/                        <- Logos oficiais DM (branca, laranja, símbolo)
│   ├── molduras/                     <- Moldura com aba de ícone embutida
│   ├── cards-preco/                  <- Card branco flutuante (top-right ou bottom)
│   ├── selos/                        <- Badges oficiais de campanha ("Mais Vendidos", etc.)
│   ├── grafismos/                    <- Arcos concêntricos tone-on-tone de fundo
│   └── fontes/                       <- Arquivos de fonte da marca (Realce Black, Roboto)
└── referencias/                      <- REPERTÓRIO VISUAL (Few-shot learning)
    ├── template-clean-feed.svg       <- O padrão ouro de feed minimalista
    └── [exemplos de aprovação...]    <- SVGs e composições de referência
```

---

## 5. Pipeline Obrigatório de Composição (5 Fases)

Ao receber um pedido de nova arte ou template, a IA executa este fluxo em sequência:

### FASE 1: Análise do Briefing & Arquétipo
Identifique o **Herói** da composição antes de posicionar elementos:
* **Foco no Preço / Oferta:** O Card Branco de Preço ganha escala prioritária no topo ou lateral.
* **Foco no Produto / Apetite Appeal:** A moldura central de foto ocupa 60%+ da área útil.
* **Foco Institucional:** Título e mensagem local dominam o campo visual; preço é rodapé ou cupom.

### FASE 2: Grade & Zonas Seguras (Safe Zones)
* **Feed (1080×1350 - Proporção 4:5):**
  * Margem lateral mínima: `100px` a `120px` (o layout nunca vaza nas bordas).
  * Margem superior/inferior: `70px` a `90px`.
* **Story (1080×1920 - Proporção 9:16):**
  * Zona proibida de topo: primeiros `250px` (reservado para header do Instagram).
  * Zona proibida de base: últimos `250px` (reservado para barra de resposta/compartilhar).
  * Conteúdo útil concentrado na faixa central (`y = 260` até `y = 1660`).

### FASE 3: Orquestração de Blocos do Inventário
Puxe os elementos diretamente de `assets/`:
1. Fundo com arcos geométricos *tone-on-tone* de `assets/grafismos/`.
2. Moldura com aba superior integrada de `assets/molduras/`.
3. Card flutuante de preço de `assets/cards-preco/`.
4. Selo de campanha sobreposto de `assets/selos/`.
5. Logo oficial horizontal branca no rodapé de `assets/logos/`.

### FASE 4: Teste de Estresse de Texto (Contrato do Luma)
Certifique-se de que o layout suporta preenchimento real do franqueado:
* Variável `{{produto}}` curta (*"PIZZA"*) ou longa (*"COMBO BURGER ARTESANAL"*).
* A tipografia display deve ter quebra de linha inteligente ou espaçamento reservado para não colidir com o selo ou o card de preço.
* Tags obrigatórias: `{{produto}}`, `{{detalhes}}`, `{{preco}}` e slot `foto_produto`.

### FASE 5: Auto-Revisão Pré-Entrega (Checklist de Qualidade)
Antes de emitir o SVG final, confira os 5 pontos:
1. [ ] **Alinhamento:** Os títulos e a logo compartilham a mesma âncora esquerda (`x="120"`)?
2. [ ] **Tipografia:** Manchete está em `Realce Black`? Subtítulo em `Roboto Medium`? Disclaimer em `Roboto Light`? (Zero `Bold`).
3. [ ] **Fidelidade:** 100% dos blocos vieram do inventário `assets/`?
4. [ ] **Base64:** A logo e a fonte `Realce Black` estão embutidas no código para abrir em qualquer software?
5. [ ] **Whitespace:** A arte respira com elegância, sem elementos colados nas extremidades?

---

Ao seguir rigorosamente este manual, todo template gerado possui consistência matemática, visual impecável e prontidão total para publicação no catálogo do Luma.
