# Brainstorm — Local Fit e Encurtar (10/10/2026)

> Rascunho de trabalho. Fonte: código (`js/core/local-fit.js`, `js/core/copy-fit.js`,
> `js/franqueado/live-preview.js`, `chat-input.js`, `chat.js`), `docs/LOCAL-FIT-ROADMAP.md` e
> **produção** (`analytics.fct_eventos`, 45 dias, lida em 10/10). Nada aqui foi implementado.

## 0. O que a produção diz (primeira vez que se lê o banco para isto)

| Fato | Número | Leitura |
|---|---|---|
| Encurtar com IA (`copyfit_ia`) | **19 chamadas, 0 versões aprovadas** (18 responderam, todas reprovadas) | A IA no fluxo de encurtar está **100% inútil** hoje. Custo de espera sem nada no fim. |
| Balão do Copy Fit (`copyfit_balao_exibido`) | **0** em 45 dias | O motor determinístico **nunca** achou versão que cabe em produção. |
| `texto_nao_cabe` | 31, **todos `tem_versao:false`** | Idem. Campos: `precoDe` 15, `produto_2` 9, `produto` 6, `detalhes` 2. |
| `falta_n` quando medido | 1, 3, 5, 6×6, 9×2, 16, 20, 59×2 | Metade falta ≤6 letras — **perto**, mas o Copy Fit não resgata. |
| Template campeão | "Copa do Mundo — Oferta com preço" (`d68bc9bb…`), 21 dos 31 | Um template concentra 2/3 dos bloqueios. `precoDe`: caixa 386×46 a 35px, maxLen 32. |
| Telemetria `layout_resolvido.campo` | sempre `null` em export/preview | Fase 0.2 do roadmap **segue aberta**. |
| Volume | 5 usuários; 3 franqueados reais; ~1.770 dos 2.100 eventos são da `gestao` (teste) | Amostra pequena: decidir por mecanismo, não por estatística. |

**Reprodução do 0/18** (rodado agora em Node contra `gCopyFitConfere`): versões que qualquer humano
aceitaria são reprovadas por **adjetivo descritivo** que saiu:

- "Hambúrguer artesanal com cheddar cremoso e bacon crocante" → "Burger artesanal c/ cheddar e bacon" — `sumiu: cremoso, crocante`
- "Combo 2 lanches + batata frita grande + refri 2L" → "… batata G …" — `sumiu: frita`
- "Açaí na tigela com granola…" → "Açaí c/ granola…" — `sumiu: tigela`

A conferência exige que **toda palavra de conteúdo** sobreviva. Só podem sair ligação, enfeite da
lista fechada (11 palavras) e "apenas/somente". Em texto de produto real, o que dá para cortar é
justamente o adjetivo descritivo — e é exatamente o que a regra proíbe. Ou seja: **a garantia
"nenhum item some" foi implementada como "nenhuma palavra some"**.

## 1. Ideias — Encurtar (Copy Fit + IA)

### E1. Conferência por ITEM, não por palavra ⭐ maior alavanca
Separar o que é **produto/sabor/quantidade** (núcleo: substantivos de item, números, tamanhos,
nomes próprios, `{{campo}}`) do que é **descrição** (adjetivo pós-posto: cremoso, crocante,
acebolada, recheada, frita, na tigela). A IA pode tirar descrição; não pode tirar núcleo.
- Mudança em `gCopyFitConfere` (`copy-fit.js:368`): palavra que sai é aceita se for adjetivo
  **depois** de um substantivo que ficou ("cheddar cremoso" → "cheddar"). Heurística barata em
  PT-BR: palavra que sai, não é item (`G_CF_ITENS`), vem logo após palavra que permaneceu e termina em
  `-oso/-osa/-ado/-ada/-ido/-ida/-ante/-ente/-ito/-ita` ou está numa lista curta de descritores.
- Mostrar o que saiu no "Sai: cremoso, crocante" — já existe (`removidas`), a pessoa decide.
- Risco: "Pizza Calabresa **Acebolada**" é nome do sabor. Mitigação: só aceita se a pessoa vê o
  "Sai:" e toca — já é o fluxo. Copy Fit nunca troca sozinho.

### E2. Degrau determinístico "descrição pós-posta" no motor
Mesmo critério do E1, mas como degrau do `gCopyFitCandidatos` (peso 6, acima do enfeite). Resgataria
os casos de produção sem IA nenhuma (latência 0, custo 0). Hoje o balão saiu **0 vezes**.

### E3. Dizer à IA o que vai ser cobrado (prompt alinhado à régua)
O prompt (`ai-registry.js:60`) diz "pode tirar artigos… enfeites antes do produto" — e a IA tira
adjetivo descritivo mesmo assim (é o óbvio). Ou alinhar o prompt à regra nova (E1) ou, se E1 não
passar, dizer explicitamente "não tire adjetivos depois do produto". Hoje prompt e conferência
discordam, e o resultado é 0%.

### E4. Logar o MOTIVO da reprovação
`copyfit_ia` grava só `reprovadas_n`. Gravar `motivos` (o `conf.motivo`, curto, sem o texto) — sem
isso, o 0/18 só foi descoberto agora por reprodução. Uma linha em `chat-input.js:915`.

### E5. Pedir à IA o NÚMERO de letras, não "no máximo N"
A IA erra contagem. Pedir 5 opções (não 3), filtrar por régua em pixel e mostrar a melhor. Custo
igual (uma chamada). Já há `_fFitRegua`.

### E6. "Quase cabe" assistido
Quando falta ≤6 letras (metade dos casos de produção), oferecer o corte da **última palavra
dispensável** com destaque ("tire 'crocante' e cabe"). Usa `gLocalFitMaiorPrefixo` por palavra
(não por prefixo): testar remover cada palavra não-núcleo e ver qual faz caber. ~N medições.

## 2. Ideias — Local Fit (motor e régua)

### L1. Preço de/por que não cabe: o problema é o template, não o motor ⭐
`precoDe` é 15/31 dos bloqueios. Caixa 386×46 a 35px para "De R$ 59,90" — campo de valor nunca é
encurtado (decisão de 29/09, correta). Saídas:
- **Fase 1.1 do roadmap** (limite publicado nasce da medida) evitaria isso na origem: o designer
  publica maxLen 32 numa caixa onde cabe ~12.
- Para preço, o certo é **piso mais baixo só para preço riscado** (`precoDe` é secundário por
  natureza; encolher não fere a regra "preço não encolhe por causa de outro campo", pois encolhe
  por causa de si mesmo). Decisão D3 do roadmap — precisa do Ryan.
- Ou o checklist do Estúdio avisar "preço R$ 999,99 não cabe neste campo" (teste de tensão com o
  pior valor do teto R$ 400,00 → "R$ 400,00").

### L2. Teste de tensão na publicação com o pior caso real
Teto de preço é R$ 400,00 (c038d63). Na publicação, rodar `gLocalFitArte` com "De R$ 399,99" /
"R$ 399,99" e com texto de 32 chars nos campos de texto. Se bloqueia, avisa o designer com o número.
É o roadmap 1.2, agora com a fixture concreta.

### L3. Telemetria 0.2 (campo, eixo, falta_px)
Continua aberta. Sem `campo` no `layout_resolvido`, o painel Dados não diz qual template estoura.
`gLocalFitCulpado(b, dados) || b.campos[0]` em `auto-layout.js:528`.

### L4. Alargar antes de quebrar para texto curto de ponto
Hoje: corpo → quebra → encolhe → (só no bloqueio) alarga. Para preço/título de 1 linha, alargar
para o vazio ao lado é menos agressivo que encolher. Mudar a ordem **só para texto de ponto com
1 linha autorada**. Risco: muda a arte de quem hoje cabe encolhido — catraca do corpus decide.

### L5. Cache do balão por chave já existe; mover para pausa de digitação (roadmap 3.1)
20–50 ms por tecla com arte bloqueada. Só importa quando a arte bloqueia, que é raro. Baixa prioridade.

## 3. Priorização proposta

| # | Ideia | Impacto | Custo | Depende de decisão? |
|---|---|---|---|---|
| 1 | E4 logar motivo | habilita medir | 1 linha | não |
| 2 | E1+E3 conferência por item + prompt alinhado | IA sai de 0% | ~40 linhas + casos em `tests/copy-fit.html` | **sim** — aceitar tirar adjetivo descritivo? |
| 3 | E2 degrau "descrição" | balão sai de 0 | ~30 linhas + casos | mesma decisão |
| 4 | L3 telemetria campo | painel útil | 2 linhas | não |
| 5 | L2/L1 teste de tensão com R$ 399,99 | evita template que nasce bloqueado | médio (`publish.js`/`linter.js`) | D1 (avisa ou trava) |
| 6 | E6 "tire X e cabe" | resgata os ≤6 letras | médio | não |
| 7 | L1 piso do preço riscado | 15/31 bloqueios | pequeno no motor | **D3** |
| 8 | L4, L5 | marginal | — | — |

---

## 4. QA do brainstorm (10/10)

Revisão em duas mãos: a **Lupa** (Gemini 3.8 Flash, só leitura) e eu conferindo no código e em
Node. O que a Lupa disse e não se sustentou foi descartado e está marcado.

### Confirmado
- **0/18 da IA é real e o mecanismo é o descrito.** `gCopyFitConfere` (`copy-fit.js:399`) põe
  em `falta` toda palavra de conteúdo que sai, exceto ligação, enfeite anteposto e
  "apenas/somente". A reprodução em Node bate com o que a produção mostra.
- **Balão 0 em produção:** o motor não gera **nenhum** candidato para texto de produto sem
  palavras da lista (`"Pizza Calabresa Acebolada + refri 2L"` → `[]`). Logo, o E2 é o único caminho
  sem IA para esses casos.
- **E4:** `chat-input.js:909-915` descarta `conf.motivo`. Risco zero.
- **L3:** o `campo` sai `null` porque `png-generator.js:636` chama a telemetria **antes** do
  diagnóstico (`:646`). A correção é na ordem das chamadas ou em passar o culpado no `meta`, e não
  só em `auto-layout.js:528`, como o brainstorm dizia. **Correção aceita** (veio da Lupa e foi
  conferida).
- **L5:** não mexer: 20–50 ms em bloqueio raro.

### Riscos que o brainstorm subestimou
- **E1 e E2: sufixo pega nome de sabor.** `-ito/-ado/-ante` casa com "palmito", "empanado",
  "picante" e "quente", que são sabor ou produto. Sufixo **não** serve como regra. Substituir por
  **lista fechada de descritores** (cremoso, crocante, acebolad[oa], recheada, suculento, quentinho,
  fresquinho, artesanal?…), no mesmo padrão de `G_CF_ENFEITES`, que já é lista fechada de propósito.
  "Tigela" (na tigela) e "frita" (batata frita) ficam de fora: "frita" é parte do item em
  `G_CF_TEM_TAMANHO`.
- **E1 não bate com nenhum `nao(...)` da suíte** (conferido: `copy-fit-cases.js:686-697`). Os casos
  "borda", "combo" e "gourmet" continuam reprovados se a lista não incluir essas palavras. A Lupa
  disse que "quebra :695": **descartado**, a linha 695 é "Brigadeiro Gourmet", e gourmet não entra na
  lista de descritores.
- **E1 e decisão de negócio:** "Calabresa **Acebolada**" é nome de sabor no cardápio. Mesmo com a
  lista fechada, tirar o descritor muda o que se vende em parte dos casos. A garantia de hoje
  ("nenhum item some") foi uma escolha do Ryan. **Pergunta para ele (D6):** o Encurtar pode tirar
  descritor pós-posto, mostrando "Sai: acebolada" e com a troca sempre dependendo do toque?
- **E2 dobra as combinações (64 → 128).** Custo real (`copy-fit.js:462`): cada combinação extra
  vira mais uma medição em pixel no `cabe`. Alternativa mais barata da Lupa, **aceita**: aplicar o
  degrau só sobre o candidato **mais curto** (fora do laço de máscaras), como último recurso.
- **E6:** a busca por remoção de palavra pode deixar conectivo órfão ("cheddar e" + nada). Passar
  cada tentativa pelo `_gCfLimpa` e pelo `gCopyFitConfere` resolve. Sem custo novo de régua.

### Descartado / rebaixado
- **L1, piso mais baixo para `precoDe`:** a Lupa levantou risco legal (CDC, preço riscado
  legível). É plausível e é decisão de negócio (D3). **Rebaixado.** A alternativa dela de "travar o
  maxLen do preço em 12–14" **não resolve**: o maxLen não é o problema (o preço tem máscara, e o
  valor é curto). O problema é a caixa de 386×46 a 35px no template da Copa. O conserto é no
  template (designer) + L2.
- **L2: a sugestão da Lupa de gravar a capacidade medida em `permissoes[id].maxLen` na publicação**
  é o roadmap 1.1. Mesma ideia; fica.
- **L4:** a Lupa concorda que é arriscado. **Fora.**
- **E5 (pedir 5 opções):** com E1 a reprovação deixa de ser por tamanho. Medir de novo com E4 no ar
  antes de mexer. **Adiado.**

### Ordem final

| # | Item | Precisa do Ryan? |
|---|---|---|
| 1 | **E4**: gravar `motivo` no `copyfit_ia` (1 linha) | não |
| 2 | **L3**: `campo` na telemetria (`png-generator.js:636`) | não |
| 3 | **Template da Copa**: avisar o designer que `precoDe` não cabe (dado, não código) | não |
| 4 | **E1 + E3 + E2 (só no mais curto)** com **lista fechada** de descritores + casos novos em `tests/copy-fit-cases.js` | **sim, D6** |
| 5 | **E6**: "tire X e cabe" passando pelo confere | não, mas depois do 4 |
| 6 | **L2/1.1**: medida real no modal de publicação | D1 (já recomendado: só avisar) |
