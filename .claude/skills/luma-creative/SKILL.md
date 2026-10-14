---
name: luma-creative
description: "Diretriz definitiva para geração e composição de artes e templates da Delivery Much (e da sub-marca much+) no Luma. Use SEMPRE que for solicitado para criar, diagramar, sugerir ou compor artes: feed (1080x1350), story (1080x1920), inapp (1080x1920), banner do app (764x204), cabeçalho e rodapé de email (1080x300 / 1080x121), carrossel (3 lâminas), slides 16:9 (Template de Apresentações 2026), capas de materiais/Deskfy (750x400) ou variações para o catálogo. A IA compõe como designer gráfico (respiro, assimetria, escala dramática) mas NUNCA desenha vetores nem cria assets: orquestra o inventário oficial sob regras de grid, contraste, tipografia em 4 níveis, tamanhos mínimos e auditoria visual obrigatória do print. Sem foto, deixa o espaço da foto (placeholder) para o franqueado. Copy sempre em PT-BR."
---

# Luma Creative (ponteiro)

A skill mora em **`.agents/skills/luma-creative/`** — fonte única, compartilhada com os outros agentes (Codex, Antigravity). Este arquivo só a registra no Claude Code; não copie o conteúdo para cá (cópia desatualiza, como já aconteceu com a `luma`).

**Antes de qualquer coisa, leia `.agents/skills/luma-creative/SKILL.md` inteiro e siga-o.** Todo caminho relativo citado lá (`assets/`, `referencias/`) parte de `.agents/skills/luma-creative/`; os `scripts/` ficam na raiz do repositório.

O `capture-art.js` e o `lint-art.js` acham sozinhos o Chromium do container (`/opt/pw-browsers`); em outra máquina, `CHROMIUM_PATH=<caminho do navegador>`.
