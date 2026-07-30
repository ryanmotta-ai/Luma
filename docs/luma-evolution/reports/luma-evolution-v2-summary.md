# Apresentação da evolução do Luma — V2

Resumo do que foi entregue, com o que sustenta cada parte.

```
docs/luma-evolution/presentation/
├── luma-evolution-v2.pptx              44 slides, 16:9, notas em todos
├── luma-evolution-v2.pdf               mesmo conteúdo, 1920×1080 por página
├── luma-evolution-v2-speaker-notes.md  notas curtas (média 37 palavras, teto 72)
├── luma-evolution-v2-index.md          índice de evidências, slide a slide
├── luma-evolution-v2.html              fonte do visual (opcional na apresentação)
└── luma-evolution-v2-png/              um PNG por slide
```

---

## O que mudou da V1 para a V2

| | V1 | V2 |
|---|---|---|
| Enfoque | auditoria do repositório | case de produto |
| Slides | 26 | **44** |
| Prints por slide | até 8 | **no máximo 3**, sem exceção |
| Telas comparadas | 6 | **16** |
| Comparações de versão | 5 | **14** (9 de três versões + 5 recortes ampliados) |
| Imagens nos slides | 32 | **82** |
| Atlas de funcionalidades | não tinha | **16 recursos em 5 telas**, medidos no DOM |
| Capturas anotadas | não tinha | **5**, em `screenshots/annotated/` |
| Much+ | mencionado | **slide próprio**, com as duas execuções lado a lado |
| Padrões de slide | vários | **7**, repetidos de ponta a ponta |

### Os sete padrões

1. **Comparação** — antes → hoje, lado a lado.
2. **Três momentos** — origem → expansão → atual.
3. **Três versões** — primeiro commit → véspera da 1.0 → hoje, com as diferenças numeradas em cada coluna.
4. **Detalhe** — a mesma faixa da tela, ampliada, nas três versões.
5. **Atlas** — captura com os contornos medidos no DOM.
6. **Ganhos** — o que foi aprimorado, em grade.
7. **Editorial** — título com lista ou números.

Nenhuma versão histórica foi reexecutada para a V2: as 65 capturas já estavam em disco. O que foi capturado de novo é só o estado atual — atlas, anotações e a campanha Much+.

---

## Estrutura dos 44 slides

| # | Bloco | Conteúdo |
|---|---|---|
| 1–2 | Abertura | Capa e o que veremos |
| 3 | Ponto de partida | A primeira versão conhecida, executada |
| 4 | Linha do tempo | Os 5 marcos do arco principal |
| 5–7 | Evolução geral | Entrada, fluxo de criação e Estúdio em três momentos cada |
| 8 | Divisor | Área por área |
| 9–13 | Evolução por área | Biblioteca, Minhas artes, Exportação, Celular e o CLI |
| 14 | Divisor | Evolução em detalhe |
| **15–23** | **Três versões** | **Nove telas comparadas: vitrine, campanha, chat, Estúdio, exportação, histórico, entrada, conta e chat no celular — cada uma no primeiro commit, na véspera da 1.0 e hoje, com as diferenças numeradas** |
| **24–28** | **Recortes** | **Barra superior, topo da vitrine, cabeçalho do chat, barra de resposta e chamada do Estúdio — ampliados** |
| **29** | **Ganhos** | **Oito melhorias, cada uma com commit e data** |
| 30 | Divisor | Atlas |
| 31–35 | Atlas | Criar · Editar · Organizar · Publicar · Manter |
| 36 | Much+ | O tema por campanha, duas execuções da mesma versão |
| 37 | Além da aparência | Cinco frentes de maturidade |
| 38–42 | O Luma atual | Quinze telas de hoje, três por slide |
| 43 | A dimensão | Números contados no repositório |
| 44 | Fechamento | De ferramenta a produto |

**O bloco 15–29 é o que responde "o que foi mudando e aprimorado".** Os três pontos de comparação são fixos em todos os slides:

| Ponto | Commit | Data | Por quê |
|---|---|---|---|
| Primeiro commit | `89ca896` | 16/07 10:33 | O mais antigo do repositório por data-hora |
| Véspera da 1.0 | `bcc61e8` | 20/07 09:48 | Último commit que mexe em tela antes de `b29dbd8` ("toma 1.0") |
| Hoje | branch atual | 30/07 | Ponta da branch |

A coluna do meio é a que mais informa: em quase toda tela ela é **igual à do primeiro commit**. Isso mostra que as duas semanas anteriores à 1.0 foram gastas em sync, segurança e import de PSD — o salto visual veio depois.

---

## Os 5 marcos

| Marco | Data | Commit | O que caracteriza |
|---|---|---|---|
| Piloto Yungas | anterior a 16/07 | — (arquivo preservado) | Arquivo único, identidade vermelha, sem tela de entrada |
| Base preservada | 16/07/2026 | `89ca896` | O git já começa com 285 arquivos e o produto pronto |
| Catálogo vivo | 16/07/2026 | `247bcd4` | A vitrine passa a vir do banco: campanha vira pasta |
| Ferramenta interna | 30/07/2026 | `e48b7ff` | O Luma ganha console próprio para quem o mantém |
| Estado atual | 30/07/2026 | branch atual | Much+ contido, CLI revisado, máquina do tempo |

M2, M4, M5 e M6 não têm slide próprio no arco principal — a tela que cada um muda já está representada por um vizinho. O bloco de comparação detalhada (slides 15 a 26) usa três pontos fixos — primeiro commit, véspera da 1.0 e hoje — porque três prints por slide é o teto que mantém cada quadro grande o bastante para sustentar a legenda.

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
| Capturas reais em disco | 86 |
| Imagens nos slides | 82, no máximo 3 por slide |
| Marcos capturados | 9 (5 na narrativa, 3 nas comparações detalhadas) |
| Telas do produto comparadas | 16 |
| Funcionalidades mapeadas no atlas | 16 |
| Commits analisados | 72, de 3 autores |
| Período coberto | anterior a 16/07/2026 → 30/07/2026 |
| Imagens reconstruídas ou ilustradas | 0 |
| Linhas do produto alteradas para os prints | 0 |

Conferência visual automática antes de exportar: **0 elementos fora da página, 0 textos cortados, 0 contrastes abaixo de 4,5:1** (menor medido 8,26:1). Detalhe em `reports/luma-evolution-v2-conferencia.md`.

---

## As 16 telas comparadas

Entrada (login) · Vitrine · Campanha aberta · Chat · Minhas artes · Estúdio · Criar material · Importar PSD · Exportar · Atalhos do Estúdio · Conta e gestão · Console do time · Tema Much+ · Vitrine no celular · Campanha no celular · Chat no celular.

Nove delas têm slide de comparação nos três pontos do git. As demais aparecem no atlas, no bloco Much+ ou na galeria do estado atual.

---

## Dois defeitos encontrados e corrigidos no caminho

Sete capturas históricas — todas as telas de entrada de M1 a M7 — tinham fotografado o **splash de boot** em vez da vitrine. A espera de montagem verificava que a home existia no DOM, mas não que ela estava visível: o splash é um overlay laranja que continua por cima depois da home montar.

A correção usa `elementFromPoint` para confirmar quem está de fato na frente antes de disparar o print. As sete capturas foram refeitas e um detector de tela chapada confirmou que nenhuma sobrou. O mesmo defeito existia na V1, e foi corrigido junto.

Isso vale como lembrete: "a captura existe" não é o mesmo que "a captura mostra o que deveria".

**O segundo foi na função que decide se uma tela apareceu.** Ela usava `querySelector` com uma lista de alternativas, e o navegador devolve quem vem primeiro no DOM — não quem está visível. Um contêiner de 0×0 nessa posição mascarava o elemento visível logo abaixo, e a campanha no celular reportava "não existe" tendo renderizado. Agora testa todos os candidatos.

Um terceiro passou pela conferência automática e só apareceu na revisão visual: a faixa de conclusão é `position:absolute` e cobria a última linha de uma lista, sem contar como "fora da página". A conferência aprendeu a checar essa colisão — o defeito não volta em silêncio.

---

## Limites declarados

- **A data do piloto não é verificável.** O arquivo não a declara e está fora do git, por isso a apresentação diz "anterior a 16/07/2026" e o identifica como *primeira versão conhecida e preservada*, nunca como primeiro commit.
- **As capturas rodam offline, sem banco.** O conteúdo é o exemplo de cada commit, não dado de produção — nenhuma captura toca o Supabase real.
- **Não há métrica de uso.** Adoção, tempo de criação e impacto financeiro não existem no repositório e por isso não aparecem em nenhum slide.
- **Três telas não foram alcançadas offline:** o canvas do Estúdio com template aberto e o fluxo de publicar (dependem de dado no banco), e a Central de Ajuda — o widget existe e responde à sondagem, mas não abre pela cena automatizada. Três tentativas, o limite acordado; fica declarada em `reports/limitacoes.md`, não escondida.

---

## Como regenerar

```bash
node docs/luma-evolution/scripts/publicar.js slides-v2.js luma-evolution-v2   # ~1 min
python3 docs/luma-evolution/scripts/montar-pptx.py luma-evolution-v2
```

Para mexer no texto ou na ordem dos slides: `scripts/slides-v2.js`. Para a identidade visual: `scripts/estilo.css`. A captura histórica só precisa rodar de novo se um marco novo entrar em `commit-map/milestones.json`.
