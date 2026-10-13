---
name: luma-creative
description: "Diretriz definitiva para geração e composição de templates de arte da Delivery Much no Luma. Use SEMPRE que for solicitado para criar, diagramar, sugerir ou compor novas artes, templates de feed (1080x1350), stories (1080x1920) ou variações criativas para o catálogo. Aplica o princípio de Design Atômico Estrito: NUNCA desenha vetores do zero, apenas orquestra ativos e blocos oficiais das bibliotecas sob regras rígidas de grid, contraste WCAG, hierarquia de 4 níveis de tipografia, tamanhos mínimos legíveis no celular e auditoria visual obrigatória do print. Responda e escreva a copy sempre em PT-BR."
---

# Luma Creative (ponteiro)

A skill mora em **`.agents/skills/luma-creative/`** — fonte única, compartilhada com os outros agentes (Codex, Antigravity). Este arquivo só a registra no Claude Code; não copie o conteúdo para cá (cópia desatualiza, como já aconteceu com a `luma`).

**Antes de qualquer coisa, leia `.agents/skills/luma-creative/SKILL.md` inteiro e siga-o.** Todo caminho relativo citado lá (`assets/`, `referencias/`) parte de `.agents/skills/luma-creative/`; os `scripts/` ficam na raiz do repositório.

No container Linux, o `capture-art.js` e o `lint-art.js` não acham o Chromium sozinhos: rode com `CHROMIUM_PATH=/opt/pw-browsers/chromium`.
