# Refino em 15 rodadas

> Padrão para toda arte nova ou refeita. O Ryan pode pedir outro número ("faz 10 rodadas", "só 3") — a palavra dele manda; sem número, são **15**.
> Uma rodada **não é** "olhar o código e achar que está bom". É: **render real → olhar a imagem → nota → defeitos → correção → render de novo.**

## Regras do jogo

1. **Render real a cada rodada** (`ferramentas/render.js`). Veja o PNG com a ferramenta de leitura de imagem. Sem olhar, a rodada não conta.
2. **Uma preocupação por rodada.** Misturar tudo esconde regressão. (Se duas correções são do mesmo tema, junte.)
3. **Nota por rodada** na rubrica abaixo (0–10 por critério). A média é a do `luma-brain/design-review.md`: **< 9,5 = reprovada**, segue refinando. Seja duro: nota 10 é "não consigo apontar um defeito".
4. **Registre** (no seu raciocínio e no resumo final): defeito achado → o que mudou. Se uma rodada não achar nada, diga "sem defeito" e siga — não invente mudança para parecer trabalho.
5. **Não regrida.** Antes de fechar a rodada compare com a anterior (lado a lado quando mexer em muita coisa). Corrigir o preço e quebrar o alinhamento do título é regressão.
6. **Pode antecipar o fim** só se as rodadas 11 (estresse) e 15 (auditoria) passaram e a média ≥ 9,5 por duas rodadas seguidas — e **avise** o Ryan que parou antes e por quê.
7. **Mostre o caminho no final**, em uma tabela curta (rodada → o que avaliei/mudei), como foi feito no Açaí aqui. Sem narrar cada passo no meio.

## A rubrica (12 critérios — a mesma do `design-review.md`, aplicada a arte)

| Critério | Pergunta para a arte |
|---|---|
| Hierarquia | O herói é óbvio em 1 s (preço? produto? campanha)? O resto é claramente secundário? |
| Espaçamento | Margens e respiros seguem a grade (múltiplos de 8)? Nada colado, nada solto? |
| Tipografia | Escala coerente (poucos tamanhos), peso contrasta (Realce vs Roboto), entrelinha ok? |
| Contraste | Todo texto lido ≥ 4,5:1 (grande ≥ 3:1)? Teste com `lib.contraste()`. |
| Alinhamento | Bordas esquerda/direita da **tinta** batem na margem? Centros alinhados onde devem? |
| Consistência | Raio, sombra, aro e cor repetem a mesma regra em todo elemento? |
| Marca | Logo DM, banner, paleta e fontes corretos? Nada genérico? |
| Robustez | Aguenta título longo, campo vazio, preço de 1 e 3 dígitos? (rodada 11) |
| Escaneabilidade | Em 3 s, em miniatura de celular, dá para ler produto e preço? |
| Criatividade | Tem uma ideia, ou é um template de planilha? Algum detalhe memorável (sem poluir)? |
| Formato | Feed e story respeitam as proporções e a zona segura? |
| Acabamento | Sem arestas: cantos, sombras, cortes de imagem, serrilhado, texto cortado? |

## As 15 rodadas

| # | Foco | O que olhar / fazer | Pergunta de saída |
|---|---|---|---|
| 1 | **Briefing e inventário** | Essenciais, assets, campos, regras de negócio; o que está fora do pedido. Primeiro render (baseline) **mesmo feio**. | Tenho um render e sei o que NÃO mexer? |
| 2 | **Estrutura e grade** | Margem lateral (72), coluna útil, blocos grandes na ordem certa de leitura. Alinhar tudo às mesmas bordas. | As bordas esquerda/direita são as mesmas em todos os blocos? |
| 3 | **Ritmo vertical** | Distâncias entre blocos em múltiplos de 8 (40 entre blocos, 24 entre bloco e rótulo). Margens superior/inferior coerentes. | Os "respiros" têm uma lógica, ou são tentativa? |
| 4 | **Hierarquia** | Definir o herói; reduzir o que concorre. Tamanho, peso e posição dizem a ordem de leitura. | Fecho os olhos, abro: para onde vão? |
| 5 | **Tipografia** | Escala (ex.: 80/48/26), pesos, entrelinha, caixa-alta. Evitar tamanhos "soltos". | Há no máximo 4–5 tamanhos? Corpo ≥ 24 px no feed? |
| 6 | **Cor e contraste** | Paleta fechada (2 cores de marca + neutros + 1 acento). Medir contrastes. Texto sobre foto precisa de apoio (faixa/cartão). | Todo par texto/fundo ≥ 4,5:1 (grande ≥ 3)? |
| 7 | **Elemento-herói** | Dar peso ao que vende: preço (selo, etiqueta, escala), banner, foto. Testar 2 variantes e escolher. | O herói pesa o dobro do segundo elemento? |
| 8 | **Alinhamento óptico** | Medir a tinta (`medir.js bordas`), compensar o recuo da fonte, alinhar centros (banner × logo da loja, etc.). | Diferença de borda ≤ 2 px? |
| 9 | **Profundidade e raio** | UMA sombra de elevação, UM raio por família (ex.: 40), aro e contorno consistentes. | Algum elemento "de outro sistema"? |
| 10 | **Criatividade controlada** | UM detalhe que dá vida (rotação leve, selo serrilhado, brilhos, corte assimétrico). Sem poluir. | Se tirar o detalhe, a arte perde personalidade? |
| 11 | **Estresse** | Rodar `ESTRESSE` inteiro (título longo, sem detalhes, sem "de", preço 1 dígito, "de" com 3 dígitos, sem preço). Corrigir o que invadir/estourar. | Nenhum caso invade, corta ou bloqueia sem querer? |
| 12 | **Story** | Derivar do feed: zona segura, foto mais alta, blocos redistribuídos. Rodar estresse no story. | Topo e base livres do que importa? Mesma identidade? |
| 13 | **Miniatura e leitura** | Reduzir para ~360 px de largura e olhar. Cortar o que vira ruído; engrossar o que some. | Produto e preço legíveis no celular em 3 s? |
| 14 | **Auditoria de marca e regras** | `luma-brain/04_DESIGN_SYSTEM.md` e `design-review.md`: proibições (sombra pesada, cinza demais, raio inconsistente, tipografia < 12, emoji). Banner com traçado/sombra; DM correto; campos e permissões batem com o resto da pasta. | Alguma regra do Luma foi quebrada? |
| 15 | **Fechamento** | Auditoria numérica (bordas, gaps, contrastes), render final feed+story, checklist de publicação (`BANCO.md`), conferir ids/regras/campos, changelog. | Posso defender cada decisão? Tem reversão? |

### Notas de uso
- **Ordem flexível:** se na rodada 4 aparecer problema de espaçamento, resolva e anote; as rodadas existem para cobrir todos os temas, não para impedir de corrigir cedo.
- **Rodada 7 é onde a promoção ganha peso.** Para artes de preço, teste pelo menos: (a) etiqueta retangular, (b) selo serrilhado girado, (c) preço tipográfico gigante sem caixa. O Ryan já escolheu o selo serrilhado laranja com selo amarelo atrás, ligeiramente sobreposto à foto — referência de "dinâmico + peso", não obrigação.
- **Rodada 11 sempre com o motor real.** Texto que quebra em 2 linhas muda tudo; o motor não reflui os blocos de baixo (ver `MOTOR.md`).
- **Rodada 13:** `node -e` com `sharp` não existe aqui; reduza com o próprio `render.js` (formato menor) ou com a ferramenta de leitura de imagem em tamanho pequeno. Olhe de verdade, não confie em número.
- **Rodada 14 inclui "sem mexer no que não é meu":** não alterar templates de outras pastas.

## Modelo do resumo final (cole e preencha)

```
| Rodada | O que avaliei e mudei |
|---|---|
| 1 | … |
…
Notas finais: hierarquia 9,6 · espaçamento 9,7 · … → média 9,6
```
