# ux-principles.md — Princípios de UX do Luma

> **Propósito:** Definir os padrões científicos e de boas práticas de Experiência do Usuário (UX) aplicados ao ecossistema do Luma.

---

## 1. Leis de UX Aplicadas

### ⏱️ Lei de Hick
*O tempo necessário para tomar uma decisão aumenta com o número e a complexidade das opções disponíveis.*
* **Como o Luma aplica:** O franqueado não edita a arte livremente nem manipula dezenas de ferramentas ao mesmo tempo. Ele interage com um **chat guiado de preenchimento passo a passo**. Cada prompt pede uma única informação (ex.: "Insira o preço do combo", "Suba a foto do hambúrguer"). Menos opções por tela = maior velocidade e menor taxa de erro.

### 🎯 Lei de Fitts
*O tempo para atingir um alvo é uma função do tamanho do alvo e da distância até ele.*
* **Como o Luma aplica:** No mobile e desktop, todos os alvos interativos importantes (botão de download, botões de modo, CTAs de chat) têm áreas de toque confortáveis (mínimo de `44px` de altura/largura). Botões de exclusão ou ações irreversíveis são mantidos distantes das ações primárias de salvamento/download para evitar cliques acidentais.

### 🧠 Princípios de Gestalt
*A mente humana tende a organizar e agrupar elementos visuais de forma natural com base na proximidade, similaridade e continuidade.*
* **Como o Luma aplica:**
  * **Proximidade:** Propriedades da mesma camada no Estúdio (ex.: cor, tamanho e fonte de um texto) ficam agrupadas fisicamente dentro do mesmo card colapsável.
  * **Similaridade:** Todos os chips de campos interativos (`{{variavel}}`) compartilham a mesma cor de fundo `--var-bg` e comportamento, permitindo que o designer os identifique imediatamente em qualquer seção da tela.

---

## 2. Padrões de Interação e Sistema

### 💬 Feedback Imediato
Nenhuma ação do usuário no Luma deve parecer muda ou travada:
* Clicar em um botão gera animação elástica instantânea (`--ease-spring`).
* Alterar um campo no formulário reflete na prévia da arte em tempo real.
* Processos em segundo plano geram Toasts de feedback claros.

### 🔄 Consistência
* O comportamento de navegação é sempre uniforme. A topbar superior mantém os mesmos seletores e identidade visual, seja na tela de vitrine ou no editor profundo. Os mesmos tokens de cores transmitem os mesmos estados de foco e erro em todos os módulos.

### 🔍 Disclosure Progressivo (Divulgação Progressiva)
* **A regra:** Mostre informações detalhadas e opções avançadas apenas quando o usuário precisar delas.
* **Como o Luma aplica:** No painel lateral do Estúdio, as propriedades avançadas de transformações ou filtros de uma camada permanecem ocultas dentro de um acordeão. O designer clica para expandir apenas se precisar realizar ajustes de precisão, mantendo a interface limpa e focada no padrão.

### 📭 Estados Vazios (Empty States)
* Telas sem dados (ex.: busca sem resultados, histórico de artes vazio, estúdio sem templates criados) nunca devem ser becos sem saída cegas.
* Devem conter:
  1. Uma ilustração ou ícone simples e centralizado.
  2. Um texto explicativo curto indicando o que falta (ex.: "Nenhuma campanha encontrada com este termo").
  3. Uma ação clara de escape ou CTA (ex.: "Limpar filtros" ou "Criar novo template").

### ⏳ Estados de Loading
* **Não bloqueie a tela inteira:** Evite overlays cinzas pesados ou spinners que impedem qualquer interação, exceto em renderizações críticas (como download de PDFs pesados).
* **Skeletons ativos:** Para listagens e cards de templates em carregamento, use skeletons que imitam a forma dos cards finais com uma animação horizontal de shimmer sutil.

### ⚠️ Tratamento de Erros

> ⛔ **Regra vigente (2026-08-12, decisão do dono do produto): o Luma NÃO ALARMA.**
> **Nada vermelho, nenhum aviso de erro na tela — mesmo quando algo falha.** O que
> valia antes (mensagem humana em toast/bolha vermelha, borda vermelha no campo) foi
> **revogado**; o texto abaixo fica só como registro do que era.

O que isso significa na prática, hoje:

* **Toast de erro não existe.** `gToast(msg,'error')` não pinta nada — o corte é dentro do
  `gToast` (`js/core/toast.js`), então as ~106 chamadas espalhadas pelo app seguem no
  código sem efeito visual. Continue usando `gToast(...,'error')` em caminho de falha: é
  o registro no console, e o dia em que a decisão mudar, tudo volta de um ponto só.
* **Sem bolha de erro no chat.** `fShowFieldError` só sacode a barra de entrada (o tremor
  não é vermelho nem texto) e escreve o motivo no console. Sem ele, um valor recusado
  viraria beco sem saída silencioso.
* **Badges/painéis sem vermelho.** Status de lote, resumo do linter de publish, estado de
  render da simulação e KPI de expirados continuam informando — em tom neutro.
* **O que segue vermelho de propósito:** o vermelho da MARCA (badge de campanha, urgência
  de validade) e o botão de confirmação de ação destrutiva ("Apagar as 12"). Não são
  avisos: um é identidade, o outro é o safe guard que a pessoa pediu.
* **Diagnóstico mora no console.** Todo erro suprimido sai como `console.warn('[Luma] …')`.
  ⚠ O custo aceito: falha de rede fica **muda** na tela — a pessoa clica e nada acontece.

**Registro do que valia antes:** mensagens humanas em PT-BR, curtas e acionáveis, com o
erro marcado no input exato (borda vermelha + texto auxiliar) em vez de alerta global.

### ♿ Acessibilidade (a11y)
* **Navegação por teclado:** Foco visível (`:focus-visible`) obrigatório com outline laranja para links, botões e inputs.
* **Contraste Rígido:** Nenhum texto pequeno deve violar a razão de contraste mínima WCAG sobre qualquer fundo.
* **Tags Semânticas:** Uso correto de HTML5 (`<main>`, `<nav>`, `<aside>`, `<header>`, `<footer>`, `<button>`).
