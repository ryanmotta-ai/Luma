# LUMA VÍDEO V1 — Copiloto de conteúdo do franqueado

> **Estudo de arquitetura de produto.** Nasceu do reposicionamento do Ryan (2026-08-28):
> o Luma Vídeo V1 **não é um editor de vídeo com IA** — é um **copiloto de conteúdo** para o
> franqueado da Delivery Much. A frase-norte:
>
> > *O Luma Vídeo V1 existe para transformar uma referência em um conteúdo local pronto para
> > publicar, sem exigir que o franqueado aprenda edição.*
>
> Ordem de autoridade deste documento: **palavra do Ryan > código real > luma-brain > genérico.**
> Onde o plano do Ryan encosta em algo que o Luma não tem, o §3 diz exatamente onde e propõe a
> troca. Onde ele já está certo, este documento só mostra como executar.
>
> Leia junto: [`LUMA-VIDEO.md`](LUMA-VIDEO.md) (o editor que já existe, fases 0–4 e 6) ·
> [`luma-brain/02_ARCHITECTURE.md`](../luma-brain/02_ARCHITECTURE.md) §12 (o que NÃO existe) ·
> [`luma-brain/01_BUSINESS.md`](../luma-brain/01_BUSINESS.md) §1 (a franquia é a cidade).

---

## 1. O que o reposicionamento muda de verdade

A mudança parece de discurso e é de arquitetura. Em uma linha: **a timeline deixa de ser a
entrada e passa a ser a última instância.**

| | Editor de vídeo (o que construímos até aqui) | Copiloto de conteúdo (a V1) |
|---|---|---|
| Primeira tela | timeline vazia + "traga um vídeo" | **"O que você quer publicar hoje?"** |
| Entidade central | EDL (lista de trechos) | **Projeto** (referência → roteiro → gravação → Reel) |
| Papel da IA | cortar o que já existe | **decidir o que gravar**, depois cortar |
| Vida do trabalho | morre ao fechar a aba | **sobrevive entre sessões** |
| Sucesso | "exportou" | **"exportou em menos de 10 minutos"** |
| Dor resolvida | "como eu edito isso?" | **"o que eu posto?" + "como eu edito isso?"** |

**A boa notícia técnica:** o motor de edição está pronto e testado (63 casos no CI, 27 na
bancada). O reposicionamento **não pede um motor novo** — pede uma **entrada nova** (a fase 1)
e uma **entidade com memória** (o projeto). O trabalho está na frente do funil, não no fundo.

**A má notícia honesta:** o parecer do CPO ("o Analisador de Referência é o diferencial, não a
timeline") é exatamente o que ainda **não existe**. Zero linhas escritas. Todo o resto da V1 já
tem alicerce.

---

## 2. Fatos do terreno (medidos, não supostos)

### 2.1. O que já existe e a V1 reusa sem escrever nada

| Peça | Onde | Por que importa para a V1 |
|---|---|---|
| **EDL + validador de plano de IA** | `js/video/projeto.js` | O contrato onde toda decisão de IA aterrissa. 63 casos verdes. |
| **Compositor** (prévia e exportação num caminho só) | `js/video/compositor.js` | Corte provado em pixel. Formato 9:16/1:1/16:9 com foco. |
| **Folhas de contato** (os olhos do modelo) | `js/video/ingest.js` | Grade 4×4, tempo queimado em cada célula. 6s de material = 1 folha de **35KB**. |
| **Medição de áudio** | `js/video/ingest.js` | Devolve `{silencios, limiar, piso, fala, dur, wav}`. Pausa real achada a 2,00–3,95s na bancada. |
| **Motor de render da casa** | `gFitTextLayer` + `fRenderOneLayer` | A legenda herda a tipografia da marca. Desenho a **0,09ms** por frame. |
| **IndexedDB vanilla, tolerante a falha** | `js/core/img-store.js` | **É o motor de persistência da V1.** Já existe, já degrada sozinho. |
| **Feature flags com lazy init** | `js/core/feature-flags.js:70` | `module.video` nasce desligado. A V1 entra sem risco para o franqueado. |
| **Edge Function `ai` com allowlist** | `supabase/functions/ai/index.ts:37` | O lugar certo do prompt de marca. |
| **Runner de regressão em navegador real** | `scripts/run-browser-tests.js` | Zero dependência. É o portão de cada fatia. |

### 2.2. Os tetos reais da chamada de IA (lidos no código, não estimados)

`supabase/functions/ai/index.ts:42-47`:

```
MAX_PROMPT        12 000 caracteres
MAX_PARTS         8 anexos por chamada
MAX_INLINE_BYTES  6 MB de base64 somados
rate limit        20 chamadas/min por usuário (por isolate)
```

Três consequências que mudam decisão de produto:

1. **O teto de 6 folhas de contato não foi chute** — 6 folhas + 1 WAV = 7 anexos, e o teto é 8.
   Sobra exatamente uma vaga. Quem quiser mandar mais precisa tirar outra coisa.
2. **O WAV de 3 minutos quase enche o payload sozinho.** 16kHz mono ≈ 32KB/s → 180s ≈ **5,7MB**
   dos 6MB. Conserto sem drama: transcrever **só os trechos mantidos** (o EDL já sabe quais são),
   ou cair para 8kHz (fala inteligível, metade do peso). Decidir antes de prometer legenda em
   vídeo longo.
3. **O fluxo inteiro da V1 gasta 4–5 chamadas por projeto.** O limite de 20/min não encosta —
   mas um chat solto encostaria. É mais um argumento para as ações rápidas serem locais.

### 2.3. O que NÃO existe (e por isso não pode aparecer no plano)

- **Servidor de aplicação, fila, worker.** `02_ARCHITECTURE.md` §12.
- **FFmpeg, Remotion, npm, build, ES Modules.** A 1ª lei.
- **As tasks de vídeo na allowlist da function.** `TASKS` tem
  `["legenda","encurtar","ajuda","cardapio","casar-fotos","cli","aula","mapear-psd"]` — **nem
  `transcrever-audio`, nem `video-plano`**. Hoje o vídeo só fala com o modelo pelo caminho de
  transição (chave no front). É a única mudança de backend que a V1 exige.
- **As 6 marcas.** `Muti Mais`, `Você Pede`, `Benefícios Locais`, `Muti Carro`, DM B2B: **não
  aparecem em nenhum arquivo do repositório** (nem em `00-config.js`, nem no `01_BUSINESS.md`).
  Existem no mundo, não no Luma. Ver §7.
- **Persistência de vídeo.** O `File` do usuário morre com a aba, por escolha registrada em
  `js/video/video.js:15`. A V1 muda essa escolha — ver §10.

---

## 3. As três correções obrigatórias no plano

Nenhuma delas invalida o produto. Todas trocam um meio impossível por um meio que existe.

### 3.1. "Engine do editor (FFmpeg/WebCodecs/remotion)" → **o motor já é outro, e já está pronto**

FFmpeg e Remotion pressupõem Node, build e servidor. No Luma isso não é "difícil": é **outro
produto**. O motor que existe e está medido é `MediaRecorder` + `canvas.captureStream` +
WebAudio, com **WebCodecs como escotilha de escape** para quando a exportação em tempo real
doer.

A separação que o Ryan propôs — **"Gemini decide, o editor executa"** — está *certa* e já é o
que o código faz: o modelo devolve um `EditPlan`, `vdValidarPlano` julga, `vdAplicarPlano`
executa. Só o nome do executor muda.

> **O que preservar da ideia original:** a fronteira. Nada de operação determinística
> (corte, tempo, silêncio, render) sair da máquina do usuário para um modelo.

### 3.2. "Link do Instagram" → **gravação de tela é o caminho do Instagram**

O navegador **não consegue** baixar o vídeo de um link do Instagram: CORS bloqueia, o conteúdo
exige sessão autenticada e raspar viola os termos. Sem servidor, não há de onde buscar.

A troca custa um clique e resolve 100% dos casos: **`getDisplayMedia`**. O campo de link não
desaparece — ele muda de função:

```
Cole o link do Reel  →  [Abrir e gravar a tela]
                        ↳ o Luma abre a aba, você dá play, ele grava 20s
```

Isso mantém a promessa ("comecei de uma referência do Instagram"), não depende de API nenhuma e
usa o mesmo pipeline do upload. É desktop-only — o que já é a decisão do módulo.

### 3.3. "Gemini 3.7 Flash com thinking high" → **a escolha do modelo já é uma linha, e deve continuar sendo**

Não consigo confirmar que existe um modelo com esse nome — e **chutar não é engenharia**. O que
importa é que o Luma **já resolveu esse problema**: `gAiModel()` (`js/core/ai.js:58`) devolve
`localStorage.luma_gemini_model` se houver, senão `window.LUMA_GEMINI_MODEL`, senão
`gemini-flash-latest`. O time troca o modelo no console (`modelo <id>`), sem deploy.

**A arquitetura correta é não apostar em nome de modelo.** O produto pede três capacidades —
multimodal (imagem + áudio), JSON confiável, latência de conversa — e o alias
`gemini-flash-latest` entrega isso hoje. Quando o time medir um id específico melhor no material
real, é uma linha. Fixar o nome num documento de arquitetura só cria dívida de papel.

**O que a V1 deve travar não é o modelo — é o contrato.** Um modelo pior devolvendo JSON válido
degrada o resultado; um contrato frouxo derruba o produto.

---

## 4. A entidade central: o Projeto

Hoje `vdProj` é um EDL. A V1 precisa de uma entidade que **atravesse a jornada** e **sobreviva à
aba fechada**. A escolha barata e certa é **estender**, não embrulhar: o EDL continua sendo o
coração da edição, e o projeto ganha as camadas de antes e depois.

```
vdProj {
  id, criado_em, atualizado_em,
  estado: 'rascunho'|'com_roteiro'|'aguardando_video'|'editando'|'exportado',

  ── FASE 1 ─────────────────────────────────────────────────
  marca:     'dm_b2c'|'dm_b2b'|'muti_mais'|'beneficios'|'muti_carro'|'voce_pede',
  objetivo:  'engajamento'|'conversao'|'trend',
  briefing:  'promoção de pizza terça-feira',      // texto do franqueado
  referencia:{ origem:'upload'|'tela', dur, poster_idb, dna:{…} },
  roteiros:  [ { id, objetivo, titulo, blocos:[…], cta_usado, escolhido } ],

  ── FASE 2 ─────────────────────────────────────────────────
  gravacao:  { idb_key, dur, w, h, checklist:{…} },
  segmentos: [ … ],        // ← o EDL de hoje, intocado
  formato, alvo_seg, legendas, iaLog,

  ── SEMPRE ─────────────────────────────────────────────────
  eventos:   [ {tipo, ts} ]   // as métricas do §13
}
```

**Três invariantes que essa forma garante:**

1. **Um projeto, um histórico.** `vdRegistrar` já serializa o `vdProj` inteiro — o roteiro e o
   DNA entram no undo de graça. E `vdReRegistrar` (criado para o log da IA) já resolve o caso
   "escrevi estado que não é edição".
2. **O DNA é do projeto, não da chamada.** Analisar a referência é a operação mais caras da
   fase 1; ela acontece **uma vez** e alimenta o roteiro *e* a edição. Duas "análises paralelas"
   como o plano descreve seriam **uma chamada com duas entradas** — dois calls dobram custo e
   latência para produzir a mesma comparação.
3. **`estado` é derivável, e é guardado de propósito.** É o que o card da lista mostra
   ("Aguardando vídeo · 80%") sem abrir o projeto e sem recalcular nada.

---

## 5. O cérebro: o DNA da referência

O diferencial do produto, na palavra do CPO. Vale escrever a regra que o torna confiável:

> **O DNA não é prosa. É um objeto fechado, versionado e validado.**

Prosa ("o vídeo tem energia alta e cortes rápidos") não é acionável e não é testável. Objeto é.

```
dna {
  v: 1,
  duracao: 21.4,
  gancho:    { de:0, ate:2.8, tipo:'pergunta'|'afirmacao'|'visual', texto },
  estrutura: [ {de, ate, papel:'gancho'|'contexto'|'prova'|'oferta'|'cta', resumo} ],
  ritmo:     { cortes_estimados, cortes_por_min, classe:'lento'|'medio'|'rapido' },
  cta:       { de, ate, tipo:'comentario'|'link'|'salvar'|'visita', texto },
  legenda:   { presente, caixa_alta, palavras_por_cartao },
  energia:   'baixa'|'media'|'alta',
  confianca: 0..1
}
```

### 5.1. A divisão que mantém o custo baixo e a precisão alta

É a mesma doutrina da F6, aplicada um nível acima:

| Medido no navegador (exato, instantâneo, grátis) | Lido pelo modelo (semântico) |
|---|---|
| duração | qual é o gancho, e de que tipo |
| envelope de áudio → **energia** e onde há fala | o **papel** de cada trecho |
| **densidade de corte** (diferença de histograma entre células vizinhas da folha) | onde está o **CTA** e qual é o pedido |
| presença e posição de legenda queimada (área de texto no frame) | o **tom** |

**Limite honesto da densidade de corte:** as folhas amostram **1 quadro por segundo**. Isso
classifica ritmo (lento / médio / rápido) com segurança e **não** conta cortes exatos num Reel
que corta a cada 400ms. Contagem exata exigiria uma passada com `requestVideoFrameCallback` —
~25s de reprodução para uma referência de 25s. **A V1 usa a classe, não o número.** Trocar
depois é barato; prometer precisão que não temos é caro.

### 5.2. O validador do DNA

`vdValidarDna` no espírito de `vdValidarPlano` (`projeto.js:235`): **nunca lança**, devolve o que
sobrou e o que caiu, com motivo legível.

- tempo fora de `[0, duracao]` → descarta o bloco
- `papel` fora da lista fechada → descarta o bloco
- estrutura sobreposta → mantém o primeiro
- `confianca` ausente ou < 0,4 → **degrada**: o DNA vira só o que foi medido (ritmo + energia),
  e o roteiro é gerado sem a estrutura narrativa

> **Por que degradar em vez de falhar:** um DNA meio-certo que gera 3 roteiros medianos é
> produto. Um erro na cara do franqueado, no primeiro clique, é abandono.

---

## 6. A ponte: DNA + marca + briefing → 3 roteiros

Uma chamada, `json:true`, forma fechada:

```
roteiro {
  id, objetivo:'engajamento'|'conversao'|'trend',
  titulo,                        // 4-6 palavras, é o que o franqueado escolhe
  duracao_alvo: 15|30|60,        // já é o VD_ALVOS do editor
  blocos: [ { papel, segundos:[de,ate], fala, acao } ],
  cta_usado: 'cta_003',          // ← ID de um CTA aprovado, não texto livre
  espelha: 'gancho'|'ritmo'|'estrutura'   // o que herdou da referência
}
```

**O mecanismo anti-alucinação não é o prompt. É o vocabulário fechado.**

O modelo não *escreve* um CTA — ele **escolhe** um `cta_usado` da lista aprovada da marca, por
id. Se devolver um id que não existe, aquela opção de roteiro é **descartada** e o franqueado vê
2 opções em vez de 3. Nunca vê uma promoção inventada.

O mesmo vale para o texto: um **linter determinístico** (`vdLintCopy`) varre cada `fala` contra
a lista de palavras proibidas da marca. Reprovou, cai. O Estúdio já tem esse precedente
(`js/designer/linter.js`) — é conceito da casa, não invenção.

> **Três opções e não cinco** é decisão de carga cognitiva, e agora também de custo: menos
> tokens de saída, menos chance de uma opção ruim passar.

---

## 7. Marca estruturada: o que falta não é código

As 6 marcas **não existem no repositório**. Para a V1 elas viram um artefato versionado —
`js/video/marcas.js`, no idioma da casa (objeto literal, prefixo `vd*`):

```
VD_MARCAS = {
  dm_b2c: {
    nome:'Delivery Much',
    tom:'…',                          // 2-3 linhas, não um ensaio
    ctas:[ {id:'cta_001', texto:'Baixe o app e peça agora', tipo:'link'} ],
    proibido:['grátis pra sempre','o melhor da cidade', …],
    exemplos_bons:[…]                 // 2 exemplos ancoram melhor que 10 regras
  }, …
}
```

**Duas decisões que precisam de gente, não de sprint:**

1. **Quem preenche isso é o marketing da DM**, não a engenharia. Tom, CTAs aprovados e palavras
   proibidas são regra de negócio; inventar aqui seria exatamente a alucinação que queremos
   evitar — só com um humano no meio.
2. **O tom de voz deve morar no servidor**, como o prompt do tutor da Academia
   (`supabase/functions/ai/index.ts:68`, "regra pedagógica e limites do tutor não podem morar no
   cliente"). Mesmo motivo: regra de marca no cliente é regra editável por qualquer um com
   DevTools. **A lista de CTAs e proibições pode ficar no front** (o linter precisa dela para
   reprovar sem round-trip) — o que sobe é o *prompt de voz*.

---

## 8. Fase 2 — o checklist e a edição guiada

### 8.1. O checklist: 3 dos 4 itens são matemática grátis

| Item | Como se mede | Custo |
|---|---|---|
| **Vertical?** | `videoHeight > videoWidth` | zero, instantâneo |
| **Áudio aceitável?** | `20·log10(fala/piso)` — a medição já devolve os dois | zero (a decodificação já acontece) |
| **Iluminação?** | luma média + % de pixels estourados em 5 quadros amostrados | ~200ms |
| **Enquadramento?** | *semântico* — "o produto/pessoa está cortado?" | **1 folha de contato na chamada que já vai acontecer** |

Ou seja: **o checklist não custa uma chamada de IA nova.** Três respostas saem antes do
franqueado piscar; a quarta pega carona no auto edit.

> **O que o checklist NÃO faz:** bloquear. Ele avisa e sugere regravar. Barrar um vídeo por
> iluminação num franqueado que gravou na cozinha às 22h é perder o conteúdo, não melhorá-lo.

### 8.2. O auto edit guiado pela referência

Uma chamada, e ela já existe (`vdAutoEdit`, `js/video/ia.js`). O que muda é **o contexto**:

```
vdMontarContexto()  já leva: material, alvo, pausas MEDIDAS, transcrição, assets
V1 acrescenta:      o DNA da referência + o roteiro escolhido
```

E a saída continua sendo o **mesmo EditPlan** (`segmentos` + `reframe`), pelo **mesmo
validador**. É por isso que o reposicionamento é barato: o fundo do funil não muda.

---

## 9. Interação: o que nunca deve chamar o modelo

O plano acerta em pôr botões antes do chat. Vale ir mais longe e dizer **quais botões são
locais** — porque isso é a diferença entre "instantâneo e de graça" e "espera 8s e gasta cota":

| Ação rápida | Como resolve | Chama o modelo? |
|---|---|---|
| **Mais rápido** | reaplica a regra de silêncio com limiar mais agressivo | **não** |
| **Legenda maior** | um número no template `dm_cap_01` | **não** |
| **Mais comercial** / **mais engraçado** | reescreve as falas da legenda | sim (texto só) |
| **Igual à referência** | novo plano com o DNA pesando mais | sim |

**Duas das cinco ações são aritmética.** São também as duas mais pedidas. Isso é vantagem de
produto (resposta em 100ms) e de custo.

O chat entra como **uma task só** (`video-comando`) que devolve um **delta** de EditPlan — nunca
um agente solto. "Corta esse começo" vira `{tipo:'segmentos', manter:[…], motivo:'…'}` e passa
pelo validador como qualquer outro plano. Um comando que o validador rejeita responde *"não
consegui fazer isso"* — não quebra a edição.

---

## 10. Persistência: reusar o motor que já existe

O requisito do Ryan ("o projeto precisa sobreviver entre sessões") é o que transforma o card
*"Reel da Pizza · 80% · aguardando vídeo"* de mockup em produto.

**Não se escreve motor novo.** `js/core/img-store.js` já é IndexedDB vanilla, com degradação
silenciosa quando o navegador não tem (`'no-idb'` → no-op e fallback). A V1 acrescenta um store
para blobs e reusa o resto.

| O que | Onde | Por quê |
|---|---|---|
| Projeto (JSON: roteiro, DNA, EDL, eventos) | **localStorage** | poucos KB, leitura no boot, é o que a lista de cards precisa |
| Poster da referência e da gravação | **IndexedDB** | um JPEG por projeto; localStorage estouraria (o precedente é exatamente este) |
| **A gravação (o vídeo)** | **IndexedDB** | é a decisão nova: sem ela, "volte de onde parou" é mentira |
| Referência (o vídeo da trend) | **descartar após o DNA** | o DNA é o que importa; guardar 50MB de um vídeo de terceiro não paga |

**A decisão que muda `js/video/video.js:15`:** hoje o comentário diz "guardar 150MB em IndexedDB
seria possível e ainda não vale — a sessão de edição é curta". **O reposicionamento inverte
isso.** A sessão deixou de ser curta: ela agora atravessa "gravar o vídeo no celular e voltar
depois". Guardar a gravação passa a ser requisito.

**Teto e higiene, para não virar bomba:** um projeto por vez com vídeo guardado, teto de ~200MB,
e limpeza do blob quando o projeto é exportado ou tem mais de 7 dias. Sem isso o IndexedDB do
franqueado cresce para sempre e o navegador começa a recusar escrita — falha silenciosa, a pior
espécie.

**O que só o Supabase resolve:** gravar no celular e editar no computador. Cross-device é
migration + Storage, e está fora desta V1 por decisão do Ryan.

---

## 11. Onde o modelo roda: uma mudança de backend, e ela é pequena

As tasks que a V1 usa:

| Task | O que faz | Prompt mora onde |
|---|---|---|
| `video-dna` | assiste à referência, devolve o DNA | **servidor** (é regra de leitura de conteúdo) |
| `video-roteiro` | DNA + marca + briefing → 3 roteiros | **servidor** (carrega o tom de voz da marca) |
| `video-plano` | gravação + DNA + roteiro → EditPlan | cliente (é instrução técnica, não regra de marca) |
| `video-comando` | comando em texto → delta de EditPlan | cliente |
| `transcrever-audio` | WAV → texto com tempo | cliente |

**A mudança:** essas 5 strings entram em `TASKS`
(`supabase/functions/ai/index.ts:37`) e duas delas ganham builder de prompt no servidor, no
mesmo padrão da task `aula`. Nenhuma migration, nenhuma tabela nova, nenhum endpoint novo.

Enquanto isso não sobe, o caminho de transição (chave no front) mantém tudo funcionando — é o
que já acontece hoje com `transcrever-audio` e `video-plano`.

---

## 12. O orçamento de 10 minutos

> Somado, não estimado: os oito trechos abaixo dão **450 segundos**. O deck desenha essa mesma
> barra em escala — uma unidade por segundo — porque um quadro que soma errado é pior que
> nenhum quadro.

A métrica-mãe é "menos de 10 minutos até exportar". Vale somar com números medidos, não com
esperança. Referência de 25s, gravação de 60s, Reel de 30s:

| Etapa | Tempo | De onde vem o número |
|---|---|---|
| Gravar a tela da referência (25s) | **~30s** | o Reel toca em tempo real |
| DNA: folhas + medição + chamada | **~25s** | 25 buscas ≈ 6s (medido) + 1 chamada |
| 3 roteiros (texto só) | **~10s** | uma chamada sem anexo |
| **Franqueado grava com o celular** | **~4min** | é o humano, e é o maior pedaço |
| Subir a gravação + checklist | **~10s** | 3 medições locais |
| Auto edit: áudio + folhas + chamada | **~40s** | folhas de 60s ≈ 15s (medido) + chamada |
| Revisar e usar 2 ações rápidas | **~60s** | 2 delas são instantâneas |
| **Exportar (tempo real)** | **~35s** | 1,1× a duração final, medido na bancada |
| | **450s = 7min30** | |

**Duas leituras deste quadro:**

1. **O orçamento fecha** — e sobram **2min30** de margem contra a promessa de 10 minutos. A IA
   **não** é o gargalo: soma **1min15** dos 7min30 (25s + 10s + 40s). O gargalo é o humano
   gravando, que é exatamente onde ele deveria estar.
2. **O pior momento da experiência é a exportação.** 35s olhando uma barra, e ela cresce
   linearmente com a duração: um Reel de 60s custa 60s de espera. **É o único lugar onde
   WebCodecs se paga** (codificar mais rápido que o tempo real). Mas só depois de medir num
   Chrome de verdade — hoje nem sabemos se sai mp4/H.264.

---

## 13. Métricas: o que registrar desde o primeiro dia

As métricas do Ryan exigem eventos. Sem eles, "80% escolhem um roteiro" é opinião.

```
evento { tipo, ts, projeto_id, dado? }

projeto_criado · referencia_analisada {origem, dur, confianca_dna}
roteiros_vistos {n} · roteiro_escolhido {id, objetivo} · roteiros_recusados
gravacao_subida {dur, checklist_reprovados}
auto_edit {acoes, descartes} · acao_rapida {qual, local:true|false}
comando_chat {aceito|rejeitado} · ajuste_manual {qual}
exportado {dur_final, segundos_desde_projeto_criado}
```

Duas notas de arquitetura:

- **`ajuste_manual` é a métrica-mãe do §15 do plano do editor** ("número de ajustes manuais
  depois do auto-edit"). 12 → 7 → 3 é progresso; "ficou bonito" não é métrica.
- **Sem tabela, o dado morre com a aba.** É a única coisa desta V1 que eu levaria ao Supabase
  cedo: uma tabela `luma.video_eventos` com RLS "cada um vê o seu" e insert do próprio usuário.
  Duas colunas de conteúdo e um índice. O resto pode esperar; **isto**, não — porque a decisão da
  V2 depende de ter o histórico.

---

## 14. As fatias de entrega (cada uma verificável no navegador)

A V1 do documento, entregue de uma vez, é grande demais para verificar. Fatiada, cada pedaço
já é produto:

### V1-a — O cérebro (o diferencial, primeiro)
`js/video/dna.js` + `js/video/marcas.js` + validador + 3 roteiros.
**Sem gravação, sem timeline.** A tela é "o que você quer publicar hoje?".
**Portão:** grave a tela de um Reel real → receba 3 roteiros que passam no linter da marca, com
CTA escolhido de uma lista aprovada. *Isso já resolve "o que eu posto?" — a metade do valor.*

### V1-b — A memória
Projeto persistente (localStorage + IndexedDB reusando `img-store`), lista de cards com estado.
**Portão:** feche a aba no meio, volte, o roteiro e a referência estão lá; o card mostra
"Aguardando vídeo".

### V1-c — A ponte
Checklist da gravação + auto edit com o DNA no contexto + as 4 ações rápidas.
**Portão:** referência → roteiro → gravação → Reel exportado, **cronometrado abaixo de 10min**
com material real de franqueado.

### V1-d — A voz
`video-comando` com delta validado, e o registro aceito/rejeitado/modificado.
**Portão:** "corta esse começo" funciona; um comando impossível responde que não consegue, sem
estragar a edição.

**Por que nesta ordem:** é a ordem do parecer do CPO. Se a fatia (a) não convencer, nada depois
dela importa — e ela é a única que ainda não tem uma linha escrita.

---

## 15. O que eu não construiria

| Não fazer | Por quê |
|---|---|
| Buscar o vídeo de um link do Instagram | Impossível do navegador. Gravação de tela resolve com 1 clique. |
| FFmpeg / Remotion / worker de render | Outro produto. O motor existe e está medido. |
| Duas chamadas "paralelas" para comparar referência e gravação | O DNA já está guardado. Uma chamada, duas entradas. |
| Chat como interação principal | 2 das 5 ações mais pedidas são aritmética local. |
| Contagem exata de cortes na referência | 1 quadro/s não dá isso. A classe (lento/médio/rápido) dá, e basta. |
| Guardar o vídeo da referência | O DNA é o produto da análise. O arquivo de terceiro não. |
| Música automática, color grading, efeitos | O corte de escopo do Ryan está certo. Não reabrir. |
| Storyboard, instruções de câmera | Já cortado no plano. Correto: o franqueado quer algo gravável. |

---

## 16. Riscos que continuam de pé

| Risco | Tamanho | O que reduz |
|---|---|---|
| **Exportação em tempo real** é o pior momento do fluxo | alto | medir no Chrome real; WebCodecs só depois |
| **Sai mp4/H.264?** Ninguém sabe ainda | alto | rodar a bancada numa máquina de verdade (§F0) |
| **O DNA errar a estrutura** e envenenar os 3 roteiros | médio | `confianca` + degradação para "só o medido" |
| **As 6 marcas sem conteúdo aprovado** | médio | depende do marketing da DM, não de sprint |
| **IndexedDB crescer sem fim** | médio | teto de 200MB + limpeza em 7 dias |
| **WAV de 3 min encostar nos 6MB** | baixo | transcrever só os trechos mantidos, ou 8kHz |
| **O franqueado gravar mal** | médio | checklist que avisa e não bloqueia |
| **Desktop-only** exclui quem só tem celular | alto (de produto) | é decisão tomada; rever quando a F0 medir iOS |

---

## 17. Decisões que precisam do Ryan

1. **Guardar a gravação em IndexedDB** (até ~200MB, limpeza em 7 dias) — é o que faz o "volte de
   onde parou" existir. *Recomendo sim*, com o teto.
2. **A tabela `luma.video_eventos`** — a única migration que eu faria cedo. Sem ela não há como
   provar as métricas da V1. *Recomendo sim.*
3. **Quem preenche as 6 marcas** (tom, CTAs aprovados, palavras proibidas) e **quando**. Sem
   isso, a fatia V1-a fica sem a metade que evita alucinação.
4. **Franqueado ou equipe primeiro?** O módulo é desktop-only e hoje só equipe (`gIsAdmin`). O
   reposicionamento é sobre o franqueado — mas ele grava no celular. *Recomendo:* equipe usa
   primeiro com material de franqueado real, e o franqueado entra quando a F0 medir o celular.
5. **A referência é descartada depois do DNA?** *Recomendo sim* (peso e direito de terceiro).

---

## Ver também

- [`LUMA-VIDEO.md`](LUMA-VIDEO.md) — o editor que existe: fases 0–4 e 6, o que a bancada mediu.
- [`luma-brain/01_BUSINESS.md`](../luma-brain/01_BUSINESS.md) — §1 a franquia é a cidade; §13 os invariantes.
- [`luma-brain/02_ARCHITECTURE.md`](../luma-brain/02_ARCHITECTURE.md) — §12 o que não existe.
- [`LUMA-ACADEMIA.md`](LUMA-ACADEMIA.md) — o precedente de módulo novo e de prompt no servidor.
