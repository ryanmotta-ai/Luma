# LUMA — Vídeo com IA (PLANO)

> **Fases 0 a 4 e o Auto Edit da F6 implementados** (ver §0 abaixo). O resto continua plano.
>
> **Este arquivo começou como plano.** O objetivo é responder, com o pé no chão do Luma real: *dá para fazer um editor de vídeo em que a IA corta, legenda, põe SFX e usa os assets oficiais da DM?* Resposta curta: **dá — mas não com a arquitetura do plano original (Java + Spring + FFmpeg + fila).** Aquela arquitetura pressupõe camadas que o Luma não tem e não vai ter.
> Escrito em 2026-08-19 a partir da conversa de ideação (Ryan + Claude). Ordem de autoridade: palavra do Ryan > código real > `luma-brain` > genérico.
> Leia junto: [`luma-brain/02_ARCHITECTURE.md`](../luma-brain/02_ARCHITECTURE.md) §12 (o que NÃO existe) · [`luma-brain/03_ENGINEERING.md`](../luma-brain/03_ENGINEERING.md) (as 3 leis) · [`LUMA-ACADEMIA.md`](LUMA-ACADEMIA.md) (o precedente de "módulo novo no Luma").

---

## 0. Estado atual (2026-08-27)

**Feito e verificado no navegador** — fases 0 a 4 do §9, mais o Auto Edit da F6:

| Peça | Onde | Situação |
|---|---|---|
| EDL + validador de plano de IA | `js/video/projeto.js` | 57 casos verdes em `tests/video-edl.html` (roda no CI) |
| Compositor (prévia + exportação, um caminho só) | `js/video/compositor.js` | corte medido em pixel real na bancada |
| Timeline com corte, remoção, reordenação, undo/redo | `js/video/timeline.js` | verificado no navegador |
| View, entrada de arquivo, inspetor contextual, exportação | `js/video/video.js` | idem |
| Módulo ligado ao app (aba, view, flag, lazy init) | `index.html`, `js/main.js`, `js/core/feature-flags.js`, `css/modules/video.css` | nasce **desligado** (`module.video`) |
| Motor de regras: **corte automático de silêncio** (sem IA) | `js/video/ingest.js` | pausa real achada no áudio da bancada |
| Formato de saída (9:16 · 1:1 · 16:9) + **enquadramento com foco** | `js/video/compositor.js` | lado do corte medido em pixel na bancada |
| **Legenda** queimada no vídeo, com a tipografia da casa | `js/video/legenda.js` | desenho e custo medidos na bancada; a resposta do modelo **não** foi verificada (rede bloqueada aqui) |
| **Folhas de contato** (os olhos do modelo) | `js/video/ingest.js` | célula certa provada por pixel na bancada |
| **O diretor**: prompt, contexto e Auto Edit | `js/video/ia.js` | parte pura no CI; a resposta do modelo **não** foi verificada aqui (rede bloqueada) |
| Auto Edit na interface, com o porquê de cada corte | `js/video/video.js`, `css/modules/video.css` | painel medido no navegador (6,66:1 / 6,08:1) |
| Bancada do portão F0 | `tests/_video-bancada.html` | 23/23 no Chromium de teste |

**Ainda não existe:** assets da DM (fase 5), SFX, vinheta, Command Center (fase 7), agente visual. Nenhuma mudança no Supabase — nem migration, nem deploy.

### O corte de silêncio, e por que ele não usa IA

A parte da fase 4 que não depende de nada: `vdMedirAudio` decodifica o áudio a 16kHz (basta para energia, e derruba a memória de ~70MB para ~11MB numa gravação de 3 min), mede RMS em janelas de 50ms e acha as pausas com **limiar adaptativo** — piso de ruído no percentil 10, fala no percentil 90, limiar 12dB acima do piso. Limiar fixo não serve: gravação de celular em cozinha acharia zero pausa, e gravação limpa acharia pausa demais. Há teto na metade do nível de fala, senão material sem pausa nenhuma seria marcado como silêncio inteiro.

Duas regras de edição, não de código: pausa abaixo de **0,8s não é cortada** (o ritmo da fala precisa do respiro curto) e o corte deixa **120ms de respiro** nas bordas (cortar na borda exata come a consoante inicial — "bo" em vez de "combo").

**A decisão de projeto que importa:** o motor de regras devolve um **EditPlan**, o mesmo contrato que o modelo vai devolver, e entra pelo mesmo `vdAplicarPlano` → `vdValidarPlano` → histórico. Um caminho de aplicação só. Quando a IA entrar, ela não inventa um segundo — e o validador já está exercitado por um produtor real, não por um teste.

Medido na bancada com áudio de verdade (tom, 2s de silêncio, tom): achou a pausa de **2,05s a 4,00s** e a edição caiu de 5,9s para 4,2s em 2 trechos.

**Limite honesto:** se o navegador não decodifica o áudio do arquivo (MOV com codec exótico), a análise falha com aviso e o corte manual continua. Não construí um segundo motor de análise em tempo real para esse caso antes de ele aparecer numa máquina de verdade.

**Decisões tomadas** (Ryan, 2026-08-19): desktop-only · só equipe (`gIsAdmin`) · zero mudança de backend por ora.

### O que a bancada mediu (e mudou o código)

1. **`MediaRecorder.isTypeSupported('video/mp4')` mente.** Num Chromium sem codec proprietário ele responde `true` e grava um mp4 com VP9/AV1 dentro — que a rede social recusa igual a um `.webm`. Por isso `vdMimeSaida()` só confia em mp4 com **`avc1` explícito**; o mp4 genérico ficou depois do webm na fila. Entre um mp4 de codec desconhecido e um webm que eu sei o que é, o segundo é mais honesto com quem vai postar.
2. **WebM gravado por `MediaRecorder` não traz duração no cabeçalho** — inclusive o que o próprio Luma exporta. O navegador responde `Infinity` e o editor recusava o arquivo dizendo "converta para MP4", o que era mentira. Resolvido com a sondagem de fim de arquivo (`_vdDuracaoConfiavel`).
3. **`seeked` não é garantia.** Quando o tempo pedido já é o atual, o evento nunca vem; e um seek de sondagem em voo faz o callback capturar o `seeked` errado — a prévia abria no último frame com o cursor no zero. Resolvido com cinto de 700ms no `_vdBuscar` e sondagem que espera de verdade.
4. **Custo real de exportação:** ≈1,1× a duração **quando a máquina acompanha** (medido: 4,4s para 4,0s de edição, 233KB em 1080×1920). Sob carga, a reprodução caiu a **0,35× do tempo real** e a mesma exportação levou 11s — a exportação é em tempo real, então máquina fraca custa proporcionalmente mais. Confirma o teto de 90s de saída.
5. **Corrida no fim do arquivo (bug real, corrigido).** Quando o último trecho vai até o fim do vídeo, o laço só percebe o fim se um frame chegar com `currentTime >= ate - 40ms` — e o navegador **para de entregar frames** ao acabar o arquivo. Com a máquina folgada o frame chega primeiro; sob carga (um frame a cada 130ms) o arquivo acaba antes, e a exportação ficava pendurada até o cinto cortar, entregando **vídeo truncado**. Aconteceu em 2 de 3 rodadas. Corrigido escutando `ended`; quatro rodadas seguidas estáveis depois.
6. **Cinto por falta de progresso, não por tempo total.** A primeira versão cortava em 2× a duração + 8s — e foi ela que truncou as exportações legítimas acima (16,0s exatos para 4s de vídeo é a fórmula, não o vídeo). Agora o relógio zera a cada frame novo: 6s sem avanço é travamento em qualquer duração.

**O que ainda NÃO foi medido:** Chrome e Safari **reais** (com H.264) e iPhone. O Chromium de teste não tem codec proprietário, então a pergunta "sai mp4 que o Instagram aceita?" segue aberta — é o único item do portão F0 que exige uma máquina de verdade. Rode `tests/_video-bancada.html` no navegador do time e leia a matriz.

### Legenda: o reuso é mais fundo do que o plano previa

O §4.2 dizia que cada cartão passaria por `fRenderTemplateLayers`. Lendo o motor, o caminho certo é mais fundo **e mais barato**: `gFitTextLayer` (o encaixador — quebra inteligente e encolhimento, o mesmo que decide o texto da arte estática) + `fRenderOneLayer` (desenha UMA camada num ctx). A legenda herda tipografia, quebra e contorno do motor único **sem** inventar material/campanha falsos e **sem** tocar em `png-generator.js`, que é caminho crítico do franqueado.

Também caiu a ideia de pré-renderizar bitmap por cartão: medido na bancada, com a medição em cache o desenho custa **0,11ms** por frame (orçamento de um frame a 30fps é 33ms). Guardar bitmap custaria ~1MB por cartão para economizar 0,11ms — não paga. O que fica em cache é o `_fit`, que é um objeto de dezenas de bytes.

**O cartão vive em tempo da FONTE, não da linha do tempo.** É o que faz a legenda continuar certa depois de cortar, remover e reordenar trechos: o compositor pergunta "que cartão vale no segundo X do arquivo?". Cortar não mexe nisso.

**Cor fixa de propósito** (branco com contorno quase-preto, sem ler token de tema): o vídeo exportado não pode mudar de aparência porque quem editou estava no tema claro ou escuro.

A transcrição reaproveita o **WAV que a medição de áudio já produziu** (16kHz mono, ~32KB/s): uma decodificação serve à detecção de silêncio e à legenda. Mandar o vídeo inteiro custaria dezenas de MB por chamada. Tempo fora do vídeo é descartado antes de virar legenda — alucinação de tempo colocaria texto no lugar errado.

⚠ **O que não foi verificado:** a resposta do modelo. Neste ambiente a saída de rede para `file://` está bloqueada, então a bancada prova que o áudio é preparado e que a chamada sai (`?ia=1`), não que a transcrição volta boa. Rode com `?ia=1` numa máquina com rede antes de confiar na legenda automática.

### Auto Edit: o que o modelo vê, e o que ele nunca decide

O modelo recebe **folhas de contato** — grades 4×4 de frames, célula de 320px, JPEG q0.6, teto de 6 folhas (≈96 quadros) — com **o tempo queimado em cada célula**. É isso que transforma "vi um produto" em "o produto aparece em 12,4s". Sem o tempo na imagem, o modelo devolve tempos inventados que *parecem* certos.

Amostragem de ~1 quadro por segundo, e vídeo mais longo que o teto é amostrado **mais espaçado** em vez de cortado no meio: o modelo precisa ver o FIM (é onde o CTA vive). Na bancada, 6s de material viraram 1 folha de 35KB — a chamada inteira cabe folgada.

**A divisão de trabalho é a mesma de sempre:** precisão temporal é nossa, semântica é do modelo. As pausas vão no contexto já **medidas**, com a instrução explícita de não recalcular silêncio olhando frames. O modelo escolhe *o que manter e por quê*; a aritmética do corte segue em `projeto.js`.

O `vdFolhasDeContato` usa o **mesmo `_vdBuscar`** do compositor — não há um segundo motor de seek — e devolve o cursor onde o usuário deixou (verificado na bancada).

**Duas ações e nada mais.** O prompt diz, com letras, que só existem `segmentos` e `reframe`, e que vinheta/overlay/música/SFX **não estão disponíveis nesta versão**. Não é excesso de zelo: um modelo que propõe vinheta faz o validador descartar na cara do usuário, e o usuário lê isso como bug. Quando a F5 entregar os assets, muda-se o prompt e o validador junto.

**Todo item precisa de `motivo`, e o motivo aparece na tela.** Uma edição automática sem justificativa é indistinguível de um defeito — o franqueado não tem como saber se o corte em 7,2s foi intenção. O `motivo` é obrigatório no validador (`projeto.js`), viaja **dentro de cada trecho**, e a interface mostra em dois lugares: o painel "O que a IA decidiu" (inspetor, quando nada está selecionado) e o porquê do trecho selecionado.

**O log entra no mesmo ponto do histórico que a edição** (`vdReRegistrar`). Sem isso, desfazer/refazer devolvia os cortes **sem** o motivo deles — o snapshot havia sido tirado antes de o log existir. Bug encontrado pelo próprio caso de teste.

**Durante o Auto Edit a interface trava o transporte** (`vdIaOcupado`), como já fazia na exportação: as dezenas de seeks do ingest disputariam o cursor com o usuário.

⚠ **O que NÃO foi verificado:** a qualidade da edição. Neste ambiente a saída de rede para `file://` está bloqueada, então o que está provado é o caminho — amostra, monta contexto, chama, valida, aplica, mostra o porquê — e não que o plano do modelo é bom. Rode `tests/_video-bancada.html?ia=1` numa máquina com rede. A aferição de verdade é a F9, com vídeos reais da rede.

### Enquadramento: o caso que decide o produto

O franqueado filma na horizontal e o Reels é vertical. O corte para 9:16 joga fora ~60% da largura, e **centralizar às cegas corta o produto** quando ele não está no meio do quadro. Por isso o segmento tem `foco` (0 a 1) além do `zoom`: um número só, porque o cover-crop só estoura **um** eixo — o mesmo controle serve para escolher esquerda/direita (fonte horizontal em 9:16) e topo/base (fonte vertical em 16:9). `foco` ausente ou 0,5 é exatamente o comportamento anterior, então nada regrediu.

O controle **só aparece quando o formato realmente corta** — controle sem efeito visível ensina o usuário a desconfiar da ferramenta. O rótulo é PT-BR sem jargão ("esquerda", "centro", "direita"), não "foco 0,15".

O `reframe` do EditPlan já aceita `foco` opcional: a IA vai poder pedir só o pan ("o produto está à esquerda do quadro") sem aproximar. Validado na faixa 0–1, descartado com motivo fora dela.

### Como rodar

```
node scripts/run-browser-tests.js video-edl     # o portão de lógica (CI)
tests/_video-bancada.html                       # abra no navegador e clique em "Rodar a bancada"
tests/_video-bancada.html?ia=1                  # inclui transcrição e Auto Edit de verdade (gasta cota)
```
Para ver o editor: ligue `module.video` no Controle do produto (aba Vídeo aparece para equipe/gestão, no desktop).

## 1. Veredito em uma página

**A ideia-força:** o Luma não tem servidor de aplicação, então **a estação de edição é o navegador**. O vídeo do franqueado **nunca sobe** para lugar nenhum. Sobe apenas *entendimento* (alguns frames em JPEG + o áudio comprimido + o texto), e desce apenas *decisão* (um JSON). O arquivo pesado nasce, é editado e é exportado na máquina de quem editou.

```
   VÍDEO DO FRANQUEADO (fica no navegador — File/objectURL)
            │
            ├─► amostra de frames (canvas → JPEG)  ─┐
            ├─► áudio comprimido (MediaRecorder)   ─┤
            └─► envelope de silêncio (WebAudio)  ── ┤ (leve: ~1–2 MB)
                                                    ▼
                                      Edge Function `ai` → Gemini
                                                    │
                                            EDIT PLAN (JSON)
                                                    ▼
                                       vdValidatePlan()  ← RLS + assets aprovados
                                                    ▼
                                    PROJETO DE VÍDEO (EDL, não-destrutivo)
                                                    ▼
                          COMPOSITOR (Canvas 2D + WebAudio, tempo real)
                                          │                    │
                                       PREVIEW            MediaRecorder
                                                               ▼
                                                   arquivo baixado (mp4/webm)
```

**O que isso compra:** zero infraestrutura nova, zero custo de render, zero cota de Storage queimada por vídeo, zero dependência nova (MediaRecorder, WebAudio, Canvas 2D e WebCodecs são nativos — o Luma já usa `MediaRecorder` para áudio em `js/franqueado/png-generator.js:2216`).

**O que isso custa:** a exportação é **em tempo real** (um Reels de 30 s leva ~35 s), depende do codec do navegador de quem exporta, e **precisa da aba em foco**. Esses três pontos são o risco real do projeto — não a IA.

**O diferencial não é o modelo.** É o par *assets oficiais da DM + regras de edição da DM* + a timeline como rede de segurança. O modelo é peça trocável atrás de `gAskAI`.

---

## 2. O que morre do plano original (e por quê)

| Peça do plano anterior | Aqui | Por quê |
|---|---|---|
| Java + Spring Boot como backend | ⛔ **Fora** | `02_ARCHITECTURE.md` §5/§12: não há servidor de aplicação e adicionar um refaz a arquitetura do produto inteiro. O "backend" é Postgres + RLS + 2 Edge Functions pontuais. |
| FFmpeg no servidor | ⛔ **Fora** | Não há servidor onde rodar. |
| `ffmpeg.wasm` no navegador | ⛔ **Fora (com escotilha)** | A versão multithread exige `SharedArrayBuffer`, que exige os cabeçalhos COOP/COEP — e **o GitHub Pages não deixa definir cabeçalho**. Verificado no Chromium desta máquina: `SharedArrayBuffer: undefined · crossOriginIsolated: false`. A versão single-thread funcionaria, mas são ~25 MB de dependência nova (1ª lei). Escotilha se a exportação nativa falhar: ver §13, risco 1. |
| Fila (Redis/RabbitMQ/Kafka) + workers de render | ⛔ **Fora** | Não há processo para enfileirar. Um vídeo por vez, na máquina do usuário. |
| React + TypeScript | ⛔ **Fora** | 1ª lei: sem build, sem ES Modules. Vanilla + `<script>` no `index.html`. |
| Postgres/S3 novos | ⛔ **Fora** | Já existem: schema `luma` + buckets `luma-*`. |
| GPT-5.6 Sol + Gemini + GPT-4o-transcribe (3 provedores) | 🔁 **Um só: Gemini** | O Luma tem **uma** tubulação de IA (`js/core/ai.js` → Edge Function `ai`) e **uma** chave, com allowlist de task e rate-limit. Um segundo provedor = segunda chave, segundo caminho, segundo modo de falha — é a proibição nº 1 desta base (duplicar motor). O Gemini transcreve áudio nativamente (o código já tenta isso em `png-generator.js:2228`). |
| Abstração `AIProvider` / `OpenAIProvider` / `GeminiProvider` | 🔁 **Já existe, sem hierarquia** | A costura de troca de modelo é o par `task` + `gAiModel()` dentro de `gAskAI`. Criar classes de provider com uma implementação é abstração sem uso hoje (proibido por `03_ENGINEERING.md` §2). |
| Veo / geração de vídeo por IA | ⛔ **Fora, por regra de produto** | O roadmap já decidiu: *"gerar arte/imagem por IA fere zero peça fora da marca"* (`07_ROADMAP.md`, brainstorm 2026-07-30). **Ler** material existente é permitido; **gerar** material de marca não é. Editar o vídeo que o franqueado gravou = ler. |
| Editor profissional (keyframes, máscara, chroma, mixer, color) | ⛔ **Fora** | Contraria a própria proposta (80% IA / 20% humano) e é onde o projeto morre de escopo. |

**O que sobrevive inteiro, e é o coração:** IA devolve **JSON estruturado**, não prosa. Timeline não-destrutiva como verdade. Validador entre a IA e a execução. Asset Retrieval Engine (a IA pede *características*, o sistema devolve *ids permitidos*). Hierarquia de tarefas (metadado > regra determinística > IA). Versões V1→Vn. Registro de correção humana como dataset. Agente visual (o cursor que edita na frente do usuário).

---

## 3. Os fatos do ambiente que decidem tudo

Verificados agora, não supostos.

| Fato | Consequência de projeto |
|---|---|
| SPA estática em GitHub Pages, sem build, sem cabeçalho customizável | Sem `SharedArrayBuffer`; sem worker cross-origin; script novo = `<script>` no `index.html` |
| `MediaRecorder`, `canvas.captureStream()`, `AudioContext.createMediaStreamDestination()`, `requestVideoFrameCallback`, `VideoEncoder` (WebCodecs) — **todos presentes** no Chromium testado | O caminho nativo de composição + gravação existe. É a fundação da exportação. |
| No Chromium **de teste** desta máquina: `video/webm;codecs=vp9` ✅ · `video/mp4;codecs=avc1` ❌ | Esse build não tem codec proprietário (H.264). **Não dá para concluir nada sobre o Chrome/Safari reais a partir disso** — é exatamente o que a Fase 0 vai medir no navegador de verdade. |
| Supabase plano **Free** (1 GB de Storage) | Vídeo do usuário **não sobe**. Só os assets oficiais da DM (poucos, pequenos, publicados uma vez). |
| A Academia já serve MP4 privado por URL assinada (`js/academia/aula.js:284`) e faz upload de vídeo pela equipe (`js/academia/gestao.js:604`) | O padrão de "vídeo no Luma" já existe e se reutiliza para as vinhetas. |
| Existe runner de testes em navegador sem dependência (`scripts/run-browser-tests.js` + `tests/*.html`) | Lógica pura (validador, matemática de EDL) **pode** ter suíte de asserts. ⚠ O `CLAUDE.md` ainda diz "não crie arquivos de teste" — o código venceu o doc; ajustar o `CLAUDE.md` quando isto for aprovado. |
| A Edge Function `ai` hoje aceita **só** imagem e PDF (`supabase/functions/ai/index.ts:206`), teto 6 MB, 8 anexos, e a allowlist de tasks (`:37`) **não tem** `transcrever-audio` | Bug real já existente: a gravação de voz do franqueado só funciona pelo caminho de transição (chave no front). Corrigir é pré-requisito — e é a mesma mudança que o vídeo precisa. |

---

## 4. Arquitetura proposta

### 4.1 Quatro camadas, uma tela

```
 #view-video
 ├─ PREVIEW      <canvas id="vd-stage">  ← o compositor desenha aqui (o mesmo canvas exporta)
 ├─ TIMELINE     trilhas: vídeo · legenda · overlay · sfx · música (DOM absoluto, como o Estúdio)
 ├─ COMANDO IA   um input: "faz um Reels de 30s com foco no produto"  ← o centro do produto
 └─ INSPETOR     painel CONTEXTUAL (só do que está selecionado). Não há 15 painéis fixos.
```

Mesma decisão do Estúdio: **camadas são DOM/objetos, não pixels** — por isso são selecionáveis e o projeto é não-destrutivo. Diferente do Estúdio: o alvo final é um **frame por vez**, então o compositor é um laço de `requestVideoFrameCallback` sobre um canvas único.

### 4.2 O compositor (a peça nova de verdade)

```
por frame:
  1. desenha o frame do <video> da fonte ativa, com o transform do segmento (reframe/zoom)
  2. blita os BITMAPS pré-renderizados (legenda, selo, lower-third, logo) — não re-renderiza nada
  3. avança a trilha de áudio (o <video> toca; SFX/música são AudioBufferSourceNode agendados)
```

**O ponto que mantém "um motor de render só":** legenda, selo e overlay **não** ganham um renderizador novo. Cada card de legenda é desenhado **uma vez** por `fRenderTemplateLayers` (`js/franqueado/png-generator.js:274`) num canvas fora da tela e virá um bitmap em cache; o compositor só cola. Uma legenda que muda a cada ~1,5 s num Reels de 30 s são ~20 bitmaps — barato. Assim o texto no vídeo sai com a **mesma** tipografia, os mesmos tokens e o mesmo interpolador da arte estática, e não existe um segundo motor para divergir (a proibição nº 1 de `03_ENGINEERING.md` §1).

**Cortes sem FFmpeg:** o corte é `currentTime = próximo segmento`. Durante o `seek`, `MediaRecorder.pause()`; no evento `seeked`, `resume()`. É o truque que torna corte gapless viável sem muxer. ⚠ A sincronia áudio/vídeo através de pause/resume é **item de verificação da Fase 2**, não uma certeza.

**Vinheta de abertura/encerramento:** é outra fonte de vídeo. Mesmo laço, `<video>` pré-carregado, troca com o recorder em pausa.

**Armadilha que mata a exportação:** desenhar um `<video>` de outra origem no canvas **contamina** o canvas e o `captureStream` para de funcionar. Solução obrigatória: todo asset da DM é **baixado como Blob** (`supabase.storage...download()`) e consumido por `blob:` URL — mesma origem, sem taint, e ainda fica cacheável no IndexedDB entre edições.

### 4.3 Precisão é nossa; semântica é da IA

Divisão explícita, para nunca depender do modelo no que ele é ruim:

| Trabalho | Quem faz | Por quê |
|---|---|---|
| Silêncio, volume, cortes por tempo, duração, sincronia | **Código** (WebAudio: RMS por janela de 50 ms) | Precisão temporal é matemática, não opinião. E é grátis. |
| Palavra → timestamp (legenda) | **Gemini** (transcrição do áudio) | É transcrição, tarefa resolvida. |
| "onde está o hook", "quando o produto aparece", "qual trecho vale" | **Gemini** (frames + transcrição) | Semântica. É o único trabalho que só o modelo faz. |
| "esse asset é vertical? tem 4 s? é aprovado?" | **Metadado no Postgres** (zero IA) | Perguntar isso a um LLM é queimar dinheiro para reler um `SELECT`. |
| Escolher entre 3 assets elegíveis | **Gemini** (recebe uma lista curta) | Decisão de gosto sobre um conjunto já filtrado. |

O modelo enxerga o vídeo por **amostragem de frames**: 1 frame/s, reduzido a 512 px, montado em folhas de contato 4×4 com o timestamp desenhado em cada célula. Um vídeo de 60 s = 4 folhas ≈ 1,5 MB — cabe no teto de 8 anexos / 6 MB que a function já tem. Movimento rápido se perde nessa amostragem — **por isso o modelo nunca decide corte de precisão** (item acima).

---

## 5. Os contratos (o que a IA pode dizer)

### 5.1 Projeto de vídeo (o EDL — a verdade do editor)

```js
vdProj = {
  id:'vp_001', nome:'Reels Combo', formato:'9:16', alvo_seg:30, ritmo:'dinamico',
  fonte:{ nome:'IMG_4821.MOV', dur:74.2, w:1080, h:1920, hash:'…' },   // arquivo fica local
  segmentos:[ {id:'s1', de:0.0, ate:4.8, zoom:1.0, motivo:'hook'},
              {id:'s2', de:7.2, ate:15.6, zoom:1.08, motivo:'produto na mão'} ],
  legendas:[ {id:'c1', de:0.4, ate:2.1, texto:'CHEGOU O COMBO', template:'dm_cap_02', destaque:['COMBO']} ],
  overlays:[ {id:'o1', assetId:'…', de:12.0, ate:15.0, pos:'inferior'} ],
  sfx:[ {id:'x1', assetId:'…', em:12.0, vol:0.6} ],
  vinhetas:{ inicio:null, fim:'asset_uuid' },
  musica:{ assetId:null, vol:0.15 },
  versao:3, historico:[/* snapshots V1..Vn */]
}
```

Regras da casa que valem aqui: `let` global + re-render manual; **resolver sempre por `id`, nunca por referência viva** (undo/versão trocam os objetos por clones — foi bug real nesta base); o arquivo de vídeo **não** entra no `localStorage` (só o EDL, que é texto).

### 5.2 EditPlan (o que o modelo devolve)

```json
{
  "meta": { "duracao_alvo": 30, "formato": "9:16", "ritmo": "dinamico" },
  "acoes": [
    { "tipo":"segmentos", "manter":[{"de":0.0,"ate":4.8},{"de":7.2,"ate":15.6}], "motivo":"remove 2,4s de silêncio e a gaguejada em 5,1" },
    { "tipo":"reframe",  "de":7.2, "ate":15.6, "zoom":1.08, "motivo":"aproximar o produto" },
    { "tipo":"legendas", "template":"dm_cap_02", "destaques":[{"em":1.2,"palavra":"COMBO"}], "motivo":"retenção" },
    { "tipo":"overlay",  "pedido":{"categoria":"produto","orientacao":"vertical","dur_min":2,"dur_max":4}, "em":12.0, "escolha":"asset_uuid", "motivo":"o produto é citado em 12,4" },
    { "tipo":"sfx",      "escolha":"asset_uuid", "em":12.0, "motivo":"marcar a entrada do produto" },
    { "tipo":"vinheta",  "posicao":"fim", "escolha":"asset_uuid", "motivo":"encerramento oficial DM" }
  ]
}
```

Três decisões deliberadas neste contrato:

1. **`manter`, não `remove`.** O modelo devolve o que fica. Assim um erro dele nunca apaga algo por omissão de intervalo.
2. **A legenda não vem do modelo.** O texto sai da **transcrição local**; o modelo só escolhe o template e marca palavras a destacar. Isso corta tokens e mata a alucinação de palavra que ninguém falou.
3. **Todo item tem `motivo`.** É o que o agente visual narra ("removi 1,4 s de silêncio") e o que vira dataset de aprendizado. Ação sem motivo é rejeitada pelo validador — força o modelo a justificar em vez de enfeitar.

### 5.3 Validador (`vdValidatePlan`) — nunca executar o que a IA mandou

Contrato igual ao de `gAskAI`: **nunca lança**. Devolve `{ok, proj, descartes:[{acao, porque}]}`. Rejeita: asset inexistente · asset `aprovado=false` · asset fora do `contextos` permitido · timestamp fora do vídeo · segmentos sobrepostos ou invertidos · duração final acima do alvo + tolerância · template de legenda desconhecido · ação sem `motivo` · mais de N ações (defesa contra plano delirante). O que for descartado **aparece na UI** — silêncio aqui é o que faz o usuário perder confiança.

⚠ **O validador não é segurança.** Quem garante que a IA não usa asset proibido é a **RLS**: a lista de elegíveis vem de um `SELECT` que já roda sob policy. O validador é a segunda tranca e a mensagem de erro honesta.

---

## 6. Onde mora (arquivos, prefixo, flag)

Prefixo novo: **`vd*`** — verificado livre em todo o `js/`. `f*`, `d*`, `g*`, `ac*`, `tut*`, `pv*` seguem intocados.

```
js/video/projeto.js      vdProj (o EDL), versões, undo, persistência do EDL
js/video/ingest.js       entrada do arquivo, folhas de contato, envelope de áudio, transcrição
js/video/compositor.js   o laço de frame: preview E exportação (um caminho só)
js/video/timeline.js     trilhas, seleção, cortar/dividir/mover/excluir, inspetor contextual
js/video/ia.js           monta o payload, chama gAskAI, valida o EditPlan, aplica no EDL
js/video/agente.js       o cursor virtual + narração + log de ações
css/modules/video.css    estilo do módulo (tokens; tema claro/escuro num bloco de vars locais)
index.html               #view-video + aba de modo + os 6 <script> na ordem
js/main.js               setMode('video') → vdInit() lazy (o padrão da Academia, main.js:66)
js/core/feature-flags.js + module.video e filhos, defaultEnabled:false
supabase/functions/ai    tasks novas + anexo de áudio + prompts do diretor
supabase/migrations/…    metadados de asset de vídeo (§7.3)
```

São **9 arquivos novos** — bem acima do "1–2 arquivos" da regra do patch cirúrgico, e isso é honesto: **não é uma feature, é um módulo novo**, o primeiro desde a Academia. O baliza de esforço é a própria Academia: 7 arquivos, 4.747 linhas de JS, 1 CSS, 2 migrations, 1 task de IA. Este aqui é comparável ou maior (o compositor não tem análogo no repositório).

**Nasce desligado**, como `module.academia` (`feature-flags.js:61`): `module.video` com `defaultEnabled:false`, filhos `video.autoedit`, `video.legendas`, `video.assets`, `video.sfx`, `video.export`, `video.agente`. A gestão liga quando quiser, sem deploy.

---

## 7. A tubulação de IA

### 7.1 Duas chamadas por auto-edit (não quatro)

```
1) transcrever   → task 'transcrever-audio'  · anexo: áudio opus (~200 KB)
2) planejar      → task 'video-plano'        · anexos: folhas de contato (JPEG)
                   payload: transcrição com timestamps + envelope de silêncio
                            + alvo (duração/formato/ritmo) + LISTA CURTA de assets elegíveis
                   resposta: EditPlan (JSON)
```

Análise e decisão ficam num único pedido de propósito: o modelo já recebe tudo, e uma chamada extra só para "analisar" pagaria os frames duas vezes. A costura fica no **prompt** (dois blocos versionados), não em duas viagens de rede.

### 7.2 Mudanças necessárias na Edge Function `ai`

Pequenas e cirúrgicas:

- `TASKS` (`:37`) += `"transcrever-audio"`, `"video-plano"`, `"video-comando"`. **A primeira também conserta a gravação de voz que hoje está quebrada quando a function é o único caminho.**
- Allowlist de mime (`:206`) += `audio/(webm|mp4|mpeg|ogg|wav)`. Vídeo bruto **não** entra na allowlist — de propósito: nunca vai passar vídeo por aqui.
- `MAX_PARTS` de 8 → **12** (8 folhas de contato + áudio + folga).
- Prompt do **diretor** montado **no servidor** (como o `aula`, `:79`), não no front. Motivo: as regras de edição da DM são regra de produto — no cliente qualquer DevTools as reescreve. O front manda payload estruturado; a function compõe. `VIDEO_PROMPT_V` versionado no log, para comparar respostas antes/depois sem adivinhação.
- Rate-limit atual (20/min por isolate) já serve; auto-edit são 2 chamadas.

### 7.3 Asset Intelligence — estender, não criar

A biblioteca já existe: `luma.biblioteca_assets` (`id, nome, categoria, url, tipo`) + `js/designer/library.js`. Uma migration aditiva basta:

```sql
ALTER TABLE luma.biblioteca_assets
  ADD COLUMN duracao_seg  NUMERIC,          -- vinheta/SFX/B-roll
  ADD COLUMN orientacao   TEXT,             -- vertical | horizontal | quadrado
  ADD COLUMN aprovado     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN contextos    TEXT[] DEFAULT '{}',   -- reels | story | institucional
  ADD COLUMN tags         TEXT[] DEFAULT '{}';
-- `tipo` passa a aceitar 'video' e 'audio' (hoje: 'image' | 'svg')
```

Bucket novo `luma-video-assets` (vinhetas e SFX são maiores que asset de template; separar evita misturar a biblioteca do Estúdio com a de vídeo e facilita cota/limpeza). Policy: leitura autenticada, escrita `is_designer()` — o padrão que já vale para `biblioteca_assets` (`migration 20260618091000:200`). Changelog obrigatório (`03_ENGINEERING.md` §4).

**Asset Retrieval Engine = uma função e um `SELECT`.** `vdBuscarAssets({categoria, orientacao, dur_min, dur_max, contexto})` → até 5 ids. O modelo **nunca** vê o catálogo inteiro nem escolhe fora dele: pede característica, recebe lista curta, escolhe um. Se a lista vier vazia, a ação é descartada com motivo — nunca inventada.

### 7.4 Hierarquia de custo (a IA mais barata é a que não roda)

| Pergunta | Quem responde |
|---|---|
| duração, orientação, categoria, aprovado | `SELECT` — **zero IA** |
| tem silêncio aqui? o volume caiu? | WebAudio — **zero IA** |
| o que a pessoa falou, e quando | Gemini Flash (transcrição) |
| onde está o hook, quando o produto aparece, qual trecho vale | Gemini Flash (frames + texto) |
| "deixa mais rápido" (ajuste sobre projeto existente) | Gemini Flash com o EDL, devolvendo **só o delta** |

Custo por auto-edit de 60 s, estimado: 4 folhas de contato + transcrição + lista de assets ≈ **6–9k tokens de entrada, 1–2k de saída**. Em Flash é fração de centavo por vídeo. O gargalo econômico **não** é a IA — é o tempo de máquina do usuário na exportação.

---

## 8. Os prompts (versionados, no servidor)

Vivem em `supabase/functions/ai/index.ts` com constante de versão, no padrão que o tutor da Academia já usa (`AULA_PROMPT_V`). Registro: `VIDEO_PLANO_V`, `VIDEO_COMANDO_V`.

### 8.1 `video-plano` — o diretor de edição

```
Você é o diretor de edição do Luma, o editor de vídeo da Delivery Much.
Sua função é transformar a análise de um vídeo em um PLANO DE EDIÇÃO em JSON. Você não edita, não renderiza e não escreve texto para o usuário.

O QUE VOCÊ RECEBE
- Folhas de contato: frames do vídeo em grade, cada célula com o timestamp em mm:ss.mmm no canto. Amostragem de 1 frame por segundo — movimento rápido pode não aparecer.
- Transcrição com timestamps por trecho.
- Envelope de áudio: intervalos de silêncio e de fala já medidos pelo sistema, em segundos.
- Alvo: duração, formato e ritmo pedidos.
- Assets elegíveis: a lista COMPLETA do que você pode usar. Cada item tem id, nome, categoria, duração e orientação.

LIMITES (não negociáveis)
- Use SOMENTE ids de asset da lista recebida. Nunca invente id, nome de arquivo, música, logo, template ou efeito.
- Nunca proponha gerar imagem, vídeo, voz ou elemento gráfico novo. O material da marca já existe; você escolhe, não cria.
- Toda afirmação sobre o vídeo precisa de timestamp. Se não souber quando algo acontece, não afirme.
- Não corrija tempo de silêncio "no olho": os intervalos do envelope de áudio são a verdade. Se discordar, ignore o trecho em vez de inventar outro número.
- Devolva o que MANTER, nunca o que remover.
- Toda ação precisa de `motivo` curto, em português, ancorado no que você recebeu. Ação sem motivo é descartada pelo sistema.
- Não aplique efeito só porque existe. Menos ações bem justificadas vale mais que muitas.
- Você não decide corte de precisão dentro de uma fala: corte em silêncio ou em fronteira de frase.

PRIORIDADES, nesta ordem
1. Clareza da mensagem  2. Retenção nos 3 primeiros segundos  3. Ritmo  4. O produto aparecer  5. Identidade DM (vinheta, legenda oficial)  6. CTA no fim

RESPOSTA
Somente JSON válido no schema EditPlan. Sem markdown, sem comentário, sem texto fora do JSON.
```

### 8.2 `video-comando` — o ajuste sobre o projeto existente

```
Você é o assistente de edição do Luma. O usuário está pedindo uma alteração em um projeto de vídeo que JÁ EXISTE.

Você recebe: o projeto atual (EDL em JSON), o que está selecionado (se houver), a transcrição e a lista de assets elegíveis.

REGRAS
- Devolva SOMENTE as ações que mudam. Nunca refaça o projeto inteiro quando um ajuste resolve.
- Preserve tudo que o usuário não pediu para mudar. Se ele reclamou da legenda, não toque nos cortes.
- Quando houver seleção, o pedido é sobre ela. "Tira essa parte" = o trecho selecionado, não o que você acha melhor.
- Mesmos limites do diretor: só ids da lista, nada de material novo, todo item com motivo, timestamps ancorados.
- Se o pedido for ambíguo demais para virar ação (ex.: "deixa melhor" sem contexto), devolva `{"acoes":[],"pergunta":"<uma pergunta curta>"}` em vez de adivinhar.

TRADUÇÕES ESPERADAS
"mais rápido"          → encurtar silêncios e a duração média dos segmentos; não cortar fala.
"mais foco no produto" → mais tempo e mais overlay nos trechos onde o produto é citado ou aparece.
"legenda menor"        → só propriedades da legenda.
"não gostei do começo" → repropor apenas os primeiros segmentos.

Somente JSON válido. Sem markdown.
```

### 8.3 `transcrever-audio` — já existe no front, precisa entrar na allowlist

O prompt atual (`png-generator.js:2228`) serve; para legenda queremos timestamps: *"Transcreva este áudio em português do Brasil. Devolva JSON: `{"trechos":[{"de":segundos,"ate":segundos,"texto":"…"}]}`. Não invente fala que não está no áudio. Não traduza."*

---

## 9. As fases (com portão de saída)

Cada fase termina em algo **verificável no navegador**. Nada de fase que só "prepara terreno".

### F0 — Prova de fogo (o portão que decide a forma do projeto)
Uma bancada em `tests/video-export.html` (manual, fora do CI — depende de codec e de aparelho) que: desenha um canvas 1080×1920 animado por 10 s, mistura um áudio, grava com `MediaRecorder` e baixa o arquivo.
**Portão:** o arquivo abre no celular e o Instagram aceita? Em quais navegadores sai **mp4**? Testar Chrome desktop, Safari desktop, **iPhone/Safari** e Android/Chrome.
Junto, o conserto de 3 linhas na Edge Function: `transcrever-audio` na allowlist + mime de áudio + `MAX_PARTS`.
**Se este portão falhar, o resto muda de forma** (ver §13, risco 1). Não construa a timeline antes de passar aqui.

### F1 — O EDL e o validador (lógica pura, sem UI)
`js/video/projeto.js` + `vdValidatePlan`. Suíte de asserts em `tests/video-edl.html` (o runner já existe): segmentos sobrepostos, timestamp fora do vídeo, asset não aprovado, ação sem motivo, duração acima do alvo.
**Portão:** `node scripts/run-browser-tests.js video` verde, e um EditPlan sujo escrito à mão vira projeto limpo com descartes explicados.

### F2 — Entrada + compositor mínimo + exportação
Escolher arquivo → `<video>` → canvas → um segmento, uma legenda estática (pré-renderizada por `fRenderTemplateLayers`), logo DM → exportar.
**Portão:** vídeo de 15 s entra, sai um arquivo com legenda na tipografia da marca e áudio sincronizado. Aqui se mede o custo real de exportação e se valida o pause/resume no corte.

### F3 — Timeline mínima + inspetor contextual
Trilhas, seleção, cortar, dividir, mover, excluir, duração, undo/redo. Inspetor que só mostra o que está selecionado.
**Portão:** dá para consertar na mão qualquer decisão que a IA vai tomar depois. **Esta fase vem antes da IA de propósito** — sem rede de segurança, o primeiro auto-edit ruim queima a confiança do usuário.

### F4 — Ingest + transcrição + legendas + primeiro corte automático **sem LLM**
Folhas de contato, envelope de áudio (RMS), transcrição via Gemini, legendas do transcript nos templates da DM, e o auto-corte **determinístico**: silêncio > 0,8 s vira candidato a corte, com revisão do usuário.
**Portão:** um vídeo falado de 60 s sai com legenda decente e sem os silêncios, **sem nenhuma decisão de LLM**. Muito do valor percebido está aqui — e é a parte previsível.

### F5 — Assets oficiais da DM
Migration + tela do designer (estender `library.js`, aba de vídeo/áudio, marcação de aprovado, `duracao_seg` medida no upload como a Academia já faz) + `vdBuscarAssets` + cache de Blob no IndexedDB.
**Portão:** vinheta de encerramento e um SFX entram na timeline pela biblioteca real, com policy testada nas 3 roles.

### F6 — Auto Edit (o LLM entra) — **este é o MVP** — *parcialmente feito*
`video-plano` no servidor, payload montado no front, validador, aplicação no EDL, log de decisões com os `motivo`.
**Feito** (`js/video/ia.js` + botão "Editar com IA"): folhas de contato com tempo queimado, contexto com as pausas medidas, prompt versionado, plano pelo `vdAplicarPlano` de sempre, log dos `motivo` na tela. O prompt vive **no cliente**, como todas as outras tasks do Luma hoje — a task `video-plano` na Edge Function é o estado final (§7.2).
**Falta:** o asset e a vinheta do portão (dependem da F5) e a verificação com rede de verdade.
**Portão (a definição de pronto do MVP):** *"jogue um vídeo e receba um Reels editável — cortes, legendas, um asset, vinheta de encerramento — e exporte."*

### F7 — Command Center + versões
O input de comando, `video-comando` com delta, V1→Vn com voltar, e o registro de aceito/rejeitado/modificado por ação (o dataset).
**Portão:** "deixa mais rápido" muda o ritmo sem refazer o resto; dá para voltar para a V2.

### F8 — Agente visual (o cursor)
Ver §11. Só depois de o resultado ser bom — animação em cima de edição ruim vira teatro.

### F9 — Bancada de aferição
10 vídeos reais da rede, com a edição que um humano aprovou. Métrica-mãe: **quantos ajustes manuais o usuário precisou fazer**. Só depois disso se mexe em prompt "para melhorar" — antes, é chute.

**Onde parar e reavaliar:** ao fim da F4. Ali já existe produto (corte de silêncio + legenda automática + exportação), e é o ponto natural para o Ryan decidir se o Auto Edit com LLM vale a próxima etapa.

---

## 10. Dificuldade, honesta

| Peça | Dificuldade | Observação |
|---|---|---|
| Entrada de vídeo, player, metadados | 🟢 | `<video>` + `URL.createObjectURL` |
| Folhas de contato (amostragem de frames) | 🟢 | canvas + seek; a Academia já mede duração no upload |
| Envelope de silêncio (RMS) | 🟡 | WebAudio; se `decodeAudioData` engasgar com MOV, cai no `AnalyserNode` durante o ingest |
| Transcrição | 🟡 | Gemini + 2 linhas na function |
| Corte de silêncio (feito) | 🟡 | ✅ pronto: WebAudio, limiar adaptativo, zero IA |
| Enquadramento 9:16 com foco (feito) | 🟡 | ✅ pronto: cover + zoom + foco, função pura testada |
| Legenda no template da DM | 🟡 | reuso de `fRenderTemplateLayers`; word-by-word animado sobe para 🟠 |
| EDL + validador | 🟢 | lógica pura, testável |
| Timeline (trilhas, arrastar, undo) | 🟠 | é UI de precisão; o Estúdio dá o padrão, não o código |
| Compositor de preview | 🟠 | a peça nova; sincronizar áudio e frame é o trabalho fino |
| **Exportação (MediaRecorder, corte gapless, codec)** | 🟠 **risco alto** | funciona, mas é onde o projeto pode empacar — ver F0 |
| Biblioteca de assets + retrieval | 🟡 | estender o que existe + migration |
| SFX / música | 🟡 | `AudioBufferSourceNode` agendado |
| Auto Edit (LLM → plano → timeline) | 🟡🟠 | fácil de fazer funcionar, difícil de fazer ficar bom |
| Agente visual (cursor) | 🟢🟡 | DOM + tokens de motion; é encanto barato |
| Editor profissional (keyframes, chroma, mixer) | 🔴 | **fora de escopo, por decisão** |
| Render em nuvem / vários vídeos em paralelo | 🔴 | **fora: não existe camada para isso** |

---

## 11. O agente visual (o cursor que edita na frente do usuário)

Feito do jeito certo é **barato e seguro**: nada de automação de mouse do sistema operacional (frágil a resolução, zoom e carregamento). O Luma **é** o editor, então:

```
ação da IA  ──►  vdAplicar(acao)      (a edição REAL no EDL)
            └──►  vdAgenteEncenar(acao) (o cursor, o highlight, o arraste — só visual)
```

As duas saem do mesmo objeto de ação, em paralelo. O cursor é um `div` posicionado com `transform`, movido pelos **tokens de motion** existentes (`css/00-tokens.css`, e o sistema de motion da Academia como referência — `js/academia/motion.js`). Ele mira o `getBoundingClientRect()` do elemento de verdade, então nunca "erra o botão".

Dois modos, e isso importa: **rápido** (barra de progresso, sem teatro) e **visual** (o cursor trabalhando). Vinte operações seguidas animadas cansam — quando a rajada é grande, o cursor se esconde e vira "Ajustando ritmo…". A narração usa o campo `motivo` de cada ação: *"Removi 1,4 s de silêncio para o ritmo ficar mais dinâmico"* — texto ancorado no plano, não frase inventada.

Interromper (`⏸`) para o laço entre ações, não no meio de uma; o EDL fica num estado válido em qualquer ponto porque cada ação é atômica.

---

## 12. O que fica de fora (e as invariantes que continuam valendo)

- **O Luma não posta.** Exportar = baixar arquivo. Postar segue manual, como no Instagram (invariante confirmada pelo Ryan em 2026-07-18).
- **A IA não cria material de marca.** Ela corta o vídeo que o franqueado gravou e escolhe entre assets aprovados. Nada de geração de vídeo/imagem/voz.
- **A RLS continua a única fronteira.** "A IA não tem acesso a asset proibido" é uma policy, não um prompt.
- **Zero dependência nova.** Tudo nativo. Se um dia precisar de muxer/`ffmpeg.wasm`, é decisão explícita do Ryan (§13), não um `npm install` no meio de uma fase.
- **Sem edição colaborativa, sem projeto na nuvem, sem fila, sem multi-tenant.** Nada disso existe no Luma hoje.
- **Sem chroma key, máscara animada, keyframe, correção de cor, mixer.** Vai contra 80/20.

---

## 13. Riscos — em ordem de quanto podem matar o projeto

1. **Codec de saída.** Se o Chrome/Safari reais não gravarem H.264/mp4, a saída é `.webm` — que o Instagram não aceita bem. Mitigações, em ordem: (a) usar mp4 onde houver, `webm` com aviso honesto onde não; (b) WebCodecs (`VideoEncoder` existe) + um muxer mp4 vendorizado — **quebra o "zero dependência nova"**, então é decisão do Ryan; (c) só então pensar em render fora do navegador — e isso é arquitetura nova. **Medir na F0.**
2. **iPhone.** O franqueado é mobile-first, e o suporte a `canvas.captureStream` + `MediaRecorder` no iOS Safari é historicamente irregular. Se não passar, o editor de vídeo é **desktop-first** — o que contraria o perfil do usuário e é a **decisão de produto mais importante deste plano**. Medir na F0, com iPhone na mão.
3. **Exportação em tempo real e aba em foco.** `requestAnimationFrame` é estrangulado em aba oculta: trocar de aba durante a exportação corrompe o resultado. Mitigação: laço guiado pelo relógio de áudio, aviso claro e `visibilitychange` pausando com mensagem. Não há como esconder que exportar leva o tempo do vídeo.
4. **Memória.** Vídeo de 150 MB + canvas 1080×1920 + bitmaps derruba aba de celular. Mitigação: teto de entrada (recomendo 3 min / 300 MB), aviso antes de aceitar, e liberar objectURL/bitmaps agressivamente.
5. **Qualidade da IA.** O primeiro Auto Edit vai errar corte. É por isso que a F3 (timeline) vem antes da F6 (IA) — e por isso o alvo da F6 é **previsível**, não "incrível".
6. **Cota do Supabase Free.** 1 GB de Storage. Só assets oficiais sobem; se um dia o vídeo do usuário subir, isso é decisão de plano/custo com o Pedro.
7. **Escopo.** "Só falta um mixer de áudio" é como este projeto vira eterno. O registro de recusa está no §12 — releia antes de aceitar item novo.

---

## 14. Decisões abertas (precisam do Ryan — com recomendação)

1. **Mobile ou desktop?** → *Recomendo:* MVP **desktop/Chrome** para editar e exportar; celular assiste e baixa. Confirmar com a medição da F0 antes de cravar.
2. **Se mp4 nativo não sair, aceitamos `.webm` com aviso ou vendorizamos um muxer?** → *Recomendo:* aceitar `webm` no MVP e só vendorizar muxer se a rede reclamar de verdade.
3. **Quem produz os assets oficiais de vídeo?** Sem eles não existe diferencial DM. → *Recomendo começar com o mínimo:* 1 vinheta de encerramento, 1 template de legenda, 3 SFX. É o suficiente para a F5 e F6.
4. **Onde mora o módulo?** → *Recomendo:* 4ª aba própria (`module.video`), desligada por flag, como a Academia nasceu.
5. **Quem usa?** Franqueado (gravou com o celular), equipe, ou os dois? → *Recomendo:* equipe primeiro (menos aparelhos para suportar, feedback mais rápido), franqueado quando a F0 disser que o celular aguenta.
6. **Tetos:** entrada e saída. → *Recomendo:* aceitar até 3 min, exportar até 90 s.
7. **O vídeo editado entra no histórico?** → *Recomendo:* no MVP, **não sobe** — o EDL fica local e o arquivo é do usuário. Reabrir quando houver plano pago.

---

## 15. O ciclo (mais importante que o prompt perfeito)

```
CONSTRUIR → RODAR EM VÍDEO REAL → O USUÁRIO CORRIGE → MEDIR A CORREÇÃO → REFINAR REGRA → repetir
```

Métrica-mãe: **número de ajustes manuais depois do auto-edit** (12 → 7 → 3 é progresso; "ficou bonito" não é métrica). Secundárias: % de cortes mantidos, % de assets mantidos, tempo até exportar, taxa de exportação sem erro, tempo de exportação ÷ duração.

**Refinar regra antes de pensar em treinar modelo.** Se o usuário sempre desfaz o zoom, o conserto é a regra do plano — não fine-tuning. O caminho "IA especializada" só existe depois de centenas de edições reais registradas, e o dataset só existe se a F7 registrar aceito/rejeitado/modificado desde o primeiro dia.

---

## Ver também

- [`luma-brain/02_ARCHITECTURE.md`](../luma-brain/02_ARCHITECTURE.md) — §5 (backend real), §12 (o que não existe).
- [`luma-brain/03_ENGINEERING.md`](../luma-brain/03_ENGINEERING.md) — as 3 leis; §1 (motores únicos).
- [`luma-brain/07_ROADMAP.md`](../luma-brain/07_ROADMAP.md) — brainstorm de 2026-07-30 (o que a IA pode e não pode fazer aqui).
- [`LUMA-ACADEMIA.md`](LUMA-ACADEMIA.md) — o precedente de módulo novo: tamanho, forma, upload de vídeo, prompt no servidor.
- [`LUMA.md`](LUMA.md) — §9 (motor de render e de copy), §22 (feature flags).
- [`LUMA-BACKEND-CHANGELOG.md`](LUMA-BACKEND-CHANGELOG.md) — onde as migrations e a Edge Function deste plano serão registradas.
