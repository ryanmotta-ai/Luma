# LOCAL FIT — ROADMAP

> **25/09/2026.** Roadmap do encaixe de texto (Local Fit + Copy Fit + a UI do bloqueio), montado
> a partir de medição, não de palpite. O contrato do motor continua em `docs/LOCAL-FIT-CONTRACT.md`;
> o roadmap geral da v1, em `luma-brain/07_ROADMAP.md`. Ao concluir um item, marque aqui.

---

## 1. Diagnóstico em uma página

**O motor não é o gargalo.** Na bancada (48 campos reais, `_local-fit-bancada`), o Local Fit
resolve **87,5%** sozinho: original 50% · wrap 20,8% · shrink 16,7% · bloqueio 12,5%. No corpus por
arte, 86,4%. O Copy Fit resgata **27,2%** do que bloqueia (59/217 na amostra em pixel). Custa
~1 ms por arte com o cache quente. Bloqueio seguro é resultado válido: 100% seria a meta errada.

**O que está ruim fica em volta do motor:**

1. **Estamos cegos.** A telemetria grava `campo` e `limite_seguro` **sempre nulos** desde que o
   Local Fit virou runtime (lê `result.diagnostico.campo`, mas o bloqueio tem `fieldId`,
   `local-fit.js:784` × `auto-layout.js:528`). O "nao_coube" do painel agrupa tudo num campo nulo.
   Produção: só 24 exportações registradas em 90 dias (23/09) — nenhuma base para decidir.
   E o **CI está vermelho** em toda a `talpaipai`: primeiro na catraca de arquitetura, depois em dois
   testes (ver Fase 0).
2. **Duas réguas.** O designer publica com um limite de caracteres digitado à mão (padrão **32**,
   `publish.js:731`) e ele **passa por cima** da medida real da caixa (`chat-input.js:156`). O
   checklist de publicação mede com `gFitTextLayer` (`linter.js:95`), não com o Local Fit, e não trava.
   Resultado: template que bloqueia dentro do limite que o próprio designer liberou.
3. **No celular, o franqueado descobre no "Baixar".** A prévia fica fechada, "Sua arte está pronta"
   aparece mesmo bloqueada (`chat.js:2675`) e a miniatura mostra o texto estourando.
4. **Uma volta por campo.** Aviso, diálogo e diagnóstico nomeiam só `bloqueios[0]`.
5. **Uma heurística de espaço vertical por dia** (22/09 respiro e ponto que quebra; 23/09 pilha
   inferida e cadeia; 24/09 limite de descida). Cada uma ajudou a bancada, e nenhuma foi decidida
   com dado de produção.

**Leitura:** primeiro enxergar (Fase 0), depois unificar a régua (1) e tirar o bloqueio do
"Baixar" (2). O motor (3) e o Copy Fit (4) só avançam com o dado que a Fase 0 começa a juntar.

---

## 2. Restrições (valem para todas as fases)

- ⛔ **Não recompor a arte.** O Automatic Designer saiu por decisão de produto (18/09). Nada volta
  a mover elementos fora da cadeia declarada, do par inferido e da placa (contrato, topo).
- ⛔ **Preço não encolhe por causa de outro campo** (`01_BUSINESS.md`, 19/08).
- ⛔ **Nunca baixar arte com texto estourado.** O bloqueio da exportação fica.
- ⛔ **Copy Fit só oferece, nunca troca sozinho**, e não muda número nem tira item.
- Toda mudança de motor passa pela bancada e pelo corpus como catraca, antes e depois.

---

## 3. Fase 0 — Enxergar *(técnico, sem decisão pendente — primeiro)*

| # | Item | Onde | Evidência |
|---|---|---|---|
| - [ ] 0.1 | **CI verde de novo.** (a) Catraca de arquitetura: `localStorage` em try/catch subiu 56 → 57 — resolver a ocorrência nova ou subir a catraca com motivo. (b) `copy-fit` caso 30 **nunca passou** desde d72901c: a geometria é impossível (363px não comporta o texto nem a 48px); o cenário vai para `w:440`, verde com as asserções originais. (c) `corpus` promo-preco-circulo·longo: a invariante 3 ainda cobra "só placa muda" — aceitar `c.placaDe \|\| c.pilhaDe` e regravar o golden (`?record=1`); o CTA descer 69px é legítimo pelo contrato vigente (5c06975). (d) Apertar a catraca do Copy Fit: 46/187 → 59/217. | `scripts/arquitetura.js`, `tests/copy-fit-cases.js:426`, `tests/corpus-cases.js:148`, `tests/corpus-golden.js:100`, `tests/copy-fit-corpus.js` | run 202+ vermelho no passo Arquitetura; worktrees nos commits |
| - [ ] 0.2 | **Consertar e ampliar `layout_resolvido`.** Corrigir `campo` (`gLocalFitCulpado(b, dados) \|\| b.campos[0]`) e `limite_seguro` (no export o diagnóstico é calculado depois da telemetria, `png-generator.js:503` × `:512`). Acrescentar: `eixo` (x/y/linhas), `falta_px` (e `falta_pct` gravando `alturaDisponivel` no bloqueio), `reducao` (menor corpo final ÷ autorado), `no_piso`, `mecanismo` (conteúdo / cadeia / grupo / âncora inválida) e se a pilha ou a placa atuaram. | `js/core/auto-layout.js` (`gLayoutTelemetry`), `js/core/local-fit.js:784` | expressões na nota abaixo da tabela |
| - [ ] 0.3 | **RPC e painel leem os campos novos** (`luma.dados_localfit` v3: `por_eixo`, faixa de redução, `falta_pct` mediano por template). Separar miniaturas (bolha, lote, popover) de prévia real — hoje entram todas como `preview`. | migration nova + `js/core/dados.js` | dedupe `_G_LAYOUT_TELE_VISTOS` conta estados, não frequência |
| - [ ] 0.4 | **Linha de base.** Autorizar o conector do Supabase, rodar ~2 semanas com 0.2 no ar e ler: % de exportações bloqueadas, sessões bloqueadas que baixaram depois, top templates × campo, eixo dominante. | — | hoje: 24 exportações em 90 dias |
| - [ ] 0.5 | **Doc que mente.** Contrato §10 (a tabela diz 83,3% e wrap 6,3%; hoje 87,5% e 20,8%) e §11 (o p95 **não** vem do carimbo dos pisos: medido ≈3% do custo — vem da medida fria de texto novo). | `docs/LOCAL-FIT-CONTRACT.md` | bancada 25/09 |

*Nota 0.2 — expressões, com `b = result.bloqueios[0]`:* `eixo = (b.overflowX>1?'x':'')+(b.overflowY>1?'y':'') || 'linhas'` ·
`falta_px = Math.max(b.overflowX, b.overflowY)` · `reducao = min(c.fontSize / c.fontSizeAutorado)` sobre `result.campos` ·
`no_piso = result.campos.some(c => c.status==='fits' && c.fontSize <= c.piso)` · `pilha = result.changes.some(c => c.pilhaDe != null)` ·
`placa = result.changes.some(c => c.placaDe != null)`. O nº de bloqueios já vai: é `camadas_invalidas`.

**Saída da fase:** CI verde, o painel mostra campo × template × eixo com números, e existe uma linha de base.

---

## 4. Fase 1 — Uma régua só, do designer ao franqueado *(maior impacto por arquivo)*

O bloqueio mais barato é o que não é publicado.

| # | Item | Onde |
|---|---|---|
| - [ ] 1.1 | **O limite publicado nasce da medida.** No modal de publicação, o campo de caracteres vem pré-preenchido com o que cabe de verdade (`gLocalFitMaiorPrefixo` sobre o exemplo do campo) em vez de 32, com aviso quando o designer digitar acima do medido. | `js/designer/publish.js` |
| - [ ] 1.2 | **Checklist e teste de tensão usam o runtime** (`gLocalFitArte`), com a permissão publicada. Hoje o linter usa `gFitTextLayer` (sem respiro, pilha nem piso) e a tensão usa `dVars.maxLen`. | `js/designer/linter.js:95`, `canvas.js:2185` |
| - [ ] 1.3 | **O designer vê "cabem ~N caracteres"** por campo, onde já edita o campo (Dado / publicação). | `layers.js` ou `publish.js` |
| - [ ] 1.4 | Linter da pilha manual discorda do runtime (`linter.js:351` usa o `_gLfTetoPilha` antigo; o runtime usa o resolver da cadeia). | `linter.js` |

**Decisão do Ryan (D1):** campo que bloqueia **dentro** do limite liberado trava a publicação ou só avisa?
*Recomendação:* só avisar, com o número, e pré-preencher o limite com a medida (1.1). Travar empurra
o designer a baixar o limite no chute.

---

## 5. Fase 2 — O franqueado nunca descobre no "Baixar"

| # | Item | Onde |
|---|---|---|
| - [ ] 2.1 | **Celular:** linha curta sob o campo quando o texto não cabe; "Sua arte está pronta" condicional (ou com o aviso junto); a miniatura não mostra o texto estourando sem aviso. | `chat.js:2675`, `:2762`, `chat-input.js` |
| - [ ] 2.2 | **Todos os campos bloqueados de uma vez**, não só `bloqueios[0]` (barra, diálogo, diagnóstico). | `live-preview.js:1379`, `chat.js:1878`, `local-fit.js:953` |
| - [ ] 2.3 | **Saída sem IA:** contador com o alvo medido **antes** do bloqueio; mostrar o `maisPerto` do Copy Fit ("falta pouco: tire X") — produzido e nunca consumido (`copy-fit.js:503`). Sem IA e sem versão, o "Encurtar" nunca aparece (`chat-input.js:638`). | `chat-input.js`, `live-preview.js` |
| - [ ] 2.4 | **O corte por `maxLen` não quebra palavra** ("2 litros" → "2 litro", mudo na digitação). | `chat-input.js:503`, `:364` |
| - [ ] 2.5 | Toast com Desfazer cobre o campo no celular; botões do diálogo empilham (conferir no navegador). | `toolbar.css:850`, `:878` |
| - [ ] 2.6 | **Lote (Sheets):** estado "não cabe" por linha **antes** de gerar, com o Copy Fit — hoje a pessoa descobre no `erros.txt` depois do ZIP. | `png-generator.js:2655`, `:3634` |

As propostas de UX de 2.1, 2.4 e 2.5 já estavam listadas no §16 do contrato. Continuam todas abertas no código.

---

## 6. Fase 3 — Motor *(guiado pelo dado da Fase 0)*

| # | Item | Por quê |
|---|---|---|
| - [ ] 3.1 | **Tecla com arte bloqueada:** 20–50 ms no desktop (Copy Fit mede até 12 candidatos + busca do prefixo; com cadeia/`fitFontGroup` cada medida é um `gLocalFitArte` inteiro). Calcular o balão só na pausa da digitação e memorizar valor → resultado dentro da mesma chave. | é o único caminho quente caro; celular multiplica |
| - [ ] 3.2 | **Cadeia inválida bloqueia a arte inteira** (ramificação, rotação, sem `vAlign` top → todos os membros viram overflow, mesmo cabendo; `local-fit.js:575`, `:632`). Degradar para o encaixe isolado. | bloqueio falso é o pior tipo |
| - [ ] 3.3 | **Deriva de fonte:** a tinta autorada (`ref.ink`, medida no navegador do designer) é o piso da caixa sem correção; `gLayoutFontDrift` não tem consumidor. `ctx.letterSpacing` sem teste de suporte (Safari). Exercitar em iOS/Android reais. | veredito pode mudar de aparelho para aparelho |
| - [ ] 3.4 | **Consolidar sem mudar comportamento:** placa que segue a tinta (duas cópias), y da cadeia (duas), respiro `max(8, 0.25·fs)` repetido 3×, `out.find` em laço. Bancada e corpus como catraca byte a byte. | cinco heurísticas em quatro dias deixaram costura |
| - [ ] 3.5 | **Teto de linhas e piso** — só se 0.4 mostrar que o bloqueio real é de altura/teto, como na bancada (os bloqueios de hoje: `promo-preco-circulo` Título teto 1, `de-por-lateral` Produto teto 2 com piso 84/96). | decisões D2 e D3 |

**Decisões do Ryan:**
- **D2 — teto de linhas:** texto com espaço livre abaixo pode ganhar +1 linha além do teto do papel?
- **D3 — piso:** preço/produto podem encolher mais que o piso de hoje, ou liga-se o piso que
  preserva a hierarquia (medido em 22/09: bloqueio do corpus 17,4% → 26,1%)?
- **D4 — "R$ / 129,90":** num selo de texto de ponto, o motor hoje prefere quebrar o preço em duas
  linhas a 56px a encolher para 46px numa linha (desde ff44ce7). Separar "R$" em cima do valor é
  aceitável no selo? Se não, a quebra que separa uma unidade conta como "partiu" e o corpo desce.

---

## 7. Fase 4 — Copy Fit

- [ ] 4.1 **D5 — abreviações da marca** (decisão aberta #6 do `07_ROADMAP`): "com" → "c/" (+27),
  Combo/pçs/acomp. (+9), emoji separador (+5), "R$ 25,00" → "R$ 25" (+4), "40 reais" → "R$ 40" (+4),
  tamanho longe do item (+4), "frete grátis" (+3), enfeite de chamada (+2), "11h às 15h" (+2).
  Juntas: 172 → 232 de 784 bloqueios. Tom de voz, não técnica.
- [ ] 4.2 Medir no painel, com `copyfit_*` (já emitidos): % de balões aceitos e desfeitos, e se a
  sessão bloqueada baixou depois. `copyfit_aplicado` do chat vai sem `template_id` (`chat-input.js:820`) — completar.

---

## 8. Como saber que deu certo

| Métrica | Fonte | Hoje | Alvo |
|---|---|---|---|
| Exportações que saem sem bloqueio | `resumo.export_*` | 24/24 (amostra irrisória) | medir primeiro (0.4) |
| Sessões bloqueadas que baixaram depois | `recuperacao.sessoes_baixaram` | não medido | subir após Fases 1–2 |
| Bloqueio descoberto só no export (sem aviso antes) | `layout_resolvido` export × `texto_nao_cabe` na sessão | não medido | → 0 no celular |
| Templates publicados que bloqueiam no limite liberado | teste de tensão na publicação | não medido | → 0 |
| Tecla com arte bloqueada, p95 | bancada | 20–50 ms desktop | < 8 ms |
| Resolve sozinho (bancada, por campo) | `_local-fit-bancada` | 87,5% | não cair |

---

## 9. O que **não** fazer

- Não voltar a recompor a arte, nem "só um pouquinho" (corredor, empurrão, escala de componente).
- Não criar mais uma heurística de espaço vertical sem que o dado de produção aponte o caso.
- Não perseguir 100% de encaixe: overflow seguro com saída clara é o resultado certo para texto que não cabe.
- Não cortar o texto da pessoa pelo limite **estimado** (o corte continua só no `maxLen`).

---

*Fontes deste roadmap (25/09/2026): `_local-fit-bancada`, `corpus` e `copy-fit` rodados no
Chromium do CI (fingerprint de fonte `1317.2/1317.2/1214.6`, igual ao golden); bisect dos dois
testes vermelhos em worktree; perfil instrumentado do `gLocalFitArte`; leitura do fluxo do
franqueado e do Estúdio no código, com arquivo:linha. A produção (Supabase) não foi lida: o
conector não estava autorizado na sessão.*
