# Apresentação da evolução do Luma — V2

Resumo do que foi entregue, com o que sustenta cada parte.

```
docs/luma-evolution/presentation/
├── luma-evolution-v2.pptx              24 slides, 16:9, notas em todos
├── luma-evolution-v2.pdf               mesmo conteúdo, 1920×1080 por página
├── luma-evolution-v2-speaker-notes.md  notas curtas (média 39 palavras, teto 72)
├── luma-evolution-v2-index.md          índice de evidências, slide a slide
├── luma-evolution-v2.html              fonte do visual (opcional na apresentação)
└── luma-evolution-v2-png/              um PNG por slide
```

---

## O que mudou da V1 para a V2

| | V1 | V2 |
|---|---|---|
| Enfoque | auditoria do repositório | case de produto |
| Marcos | 9 | **5**, escolhidos por diferença visual clara |
| Slides | 26 | **24** |
| Atlas de funcionalidades | não tinha | **16 recursos em 5 telas**, medidos no DOM |
| Capturas anotadas | não tinha | **5**, em `screenshots/annotated/` |
| Much+ | mencionado | **slide próprio**, com as duas execuções lado a lado |
| Padrões de slide | vários | **4**, repetidos de ponta a ponta |

Nenhuma versão histórica foi reexecutada para a V2: as 65 capturas já estavam em disco. O que foi capturado de novo é só o estado atual — atlas, anotações e a campanha Much+.

---

## Estrutura dos 24 slides

| # | Bloco | Conteúdo |
|---|---|---|
| 1–2 | Abertura | Capa e o que veremos |
| 3 | Ponto de partida | A primeira versão conhecida, executada |
| 4 | Linha do tempo | Os 5 marcos |
| 5–7 | Evolução geral | Entrada, fluxo de criação e Estúdio em três momentos cada |
| 8 | Divisor | Área por área |
| 9–13 | Evolução por área | Biblioteca, Minhas artes, Exportação, Celular e o CLI |
| 14 | Divisor | Atlas |
| 15–19 | Atlas | Criar · Editar · Organizar · Publicar · Manter |
| 20 | Much+ | O tema por campanha, duas execuções da mesma versão |
| 21 | Além da aparência | Cinco frentes de maturidade |
| 22 | O Luma atual | Oito telas de hoje |
| 23 | A dimensão | Números contados no repositório |
| 24 | Fechamento | De ferramenta a produto |

---

## Os 5 marcos

| Marco | Data | Commit | O que caracteriza |
|---|---|---|---|
| Piloto Yungas | anterior a 16/07 | — (arquivo preservado) | Arquivo único, identidade vermelha, sem tela de entrada |
| Base preservada | 16/07/2026 | `89ca896` | O git já começa com 285 arquivos e o produto pronto |
| Catálogo vivo | 16/07/2026 | `247bcd4` | A vitrine passa a vir do banco: campanha vira pasta |
| Ferramenta interna | 30/07/2026 | `e48b7ff` | O Luma ganha console próprio para quem o mantém |
| Estado atual | 30/07/2026 | branch atual | Much+ contido, CLI revisado, máquina do tempo |

M2, M4, M5 e M6 foram capturados e ficam no repositório, mas saíram da narrativa: a tela que cada um muda já está representada por um vizinho, e dois commits quase idênticos não contam história.

---

## O atlas

16 funcionalidades localizadas em 5 telas, agrupadas por fluxo:

| Fluxo | Tela | Recursos |
|---|---|---|
| Criar | Vitrine | 4 |
| Editar | Campanha aberta | 4 |
| Organizar | Estúdio | 4 |
| Publicar e exportar | Modal de exportação | 2 |
| Manter e diagnosticar | Luma CLI | 2 |

Cada contorno vem de `getBoundingClientRect` na versão atual, em porcentagem da viewport — nenhum foi desenhado no olho. Uma funcionalidade cujo elemento não é encontrado **não entra**: é melhor um atlas menor e correto do que um número apontando para o vazio. Só uma ficou de fora nessa regra (exportar em lote).

---

## Números da entrega

| | |
|---|---|
| Capturas reais em disco | 65 |
| Marcos capturados | 9 (5 na narrativa) |
| Funcionalidades mapeadas | 16 |
| Commits analisados | 72, de 3 autores |
| Período coberto | anterior a 16/07/2026 → 30/07/2026 |
| Imagens reconstruídas ou ilustradas | 0 |
| Linhas do produto alteradas para os prints | 0 |

Conferência visual automática antes de exportar: **0 elementos fora da página, 0 textos cortados, 0 contrastes abaixo de 4,5:1** (menor medido 8,26:1). Detalhe em `reports/luma-evolution-v2-conferencia.md`.

---

## Um defeito encontrado e corrigido no caminho

Sete capturas históricas — todas as telas de entrada de M1 a M7 — tinham fotografado o **splash de boot** em vez da vitrine. A espera de montagem verificava que a home existia no DOM, mas não que ela estava visível: o splash é um overlay laranja que continua por cima depois da home montar.

A correção usa `elementFromPoint` para confirmar quem está de fato na frente antes de disparar o print. As sete capturas foram refeitas e um detector de tela chapada confirmou que nenhuma sobrou. O mesmo defeito existia na V1, e foi corrigido junto.

Isso vale como lembrete: "a captura existe" não é o mesmo que "a captura mostra o que deveria".

---

## Limites declarados

- **A data do piloto não é verificável.** O arquivo não a declara e está fora do git, por isso a apresentação diz "anterior a 16/07/2026" e o identifica como *primeira versão conhecida e preservada*, nunca como primeiro commit.
- **As capturas rodam offline, sem banco.** O conteúdo é o exemplo de cada commit, não dado de produção — nenhuma captura toca o Supabase real.
- **Não há métrica de uso.** Adoção, tempo de criação e impacto financeiro não existem no repositório e por isso não aparecem em nenhum slide.
- **Três telas não foram alcançadas offline:** o canvas do Estúdio com template aberto e o fluxo de publicar (dependem de dado no banco) e a Central de Ajuda em versões antigas (o gatilho do widget mudou de nome). Estão declaradas em `reports/limitacoes.md`, não escondidas.

---

## Como regenerar

```bash
node docs/luma-evolution/scripts/publicar.js slides-v2.js luma-evolution-v2   # ~1 min
python3 docs/luma-evolution/scripts/montar-pptx.py luma-evolution-v2
```

Para mexer no texto ou na ordem dos slides: `scripts/slides-v2.js`. Para a identidade visual: `scripts/estilo.css`. A captura histórica só precisa rodar de novo se um marco novo entrar em `commit-map/milestones.json`.
