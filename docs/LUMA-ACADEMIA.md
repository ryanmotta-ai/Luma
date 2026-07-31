# LUMA — Academia Delivery Much

> Módulo de **formação e implementação do franqueado**: a jornada que acompanha o franqueado do contrato ao primeiro mês de operação, com aulas em vídeo, materiais, anotações, tutor de IA, conclusão e certificado.
> Criado em 2026-07-31. Backend registrado em [LUMA-BACKEND-CHANGELOG.md](LUMA-BACKEND-CHANGELOG.md).

---

## 1. Nomes (e por que estes)

| Termo | O que é |
|---|---|
| **Academia** (Academia Delivery Much) | O módulo — a aba na topbar, o lugar. Serve antes e depois de a pessoa se formar. |
| **Formação do Franqueado** | A jornada/curso dentro da Academia. É o que o certificado nomeia. |
| **Módulo** (da formação) | Etapa ordenada da jornada. ⚠ Não confundir com "módulo do Luma" (Franqueado/Estúdio/Academia). |
| **Aula** | Unidade de conteúdo: vídeo + objetivo + resumo + materiais + transcrição + atividade. |

⛔ **Não chamar o módulo de "Implementação".** Esse nome **já existe** no produto: é a categoria do catálogo do franqueado (`CAMPS_IMPLEMENTACAO` em `js/00-config.js`, `fRenderImplementacao` em `js/franqueado/catalog.js`) com os materiais de lançamento de cidade nova. Dois "Implementação" na mesma navegação confundiriam o franqueado.

---

## 2. Onde mora

```
js/academia/academia.js    estado (acState), camada de dados, roteamento, HOME DA JORNADA
js/academia/aula.js        ambiente de aula: 3 regiões, player, abas, progresso, conclusão
js/academia/agente.js      painel do tutor de IA (monta o CONTEXTO; o prompt é do servidor)
js/academia/gestao.js      área da equipe_dm: curso/módulos/aulas, upload MP4, preview, publicação
js/academia/certificado.js conclusão, emissão via RPC, certificado em canvas → PDF
css/modules/academia.css   estilo do módulo (tema claro/escuro num único bloco de vars locais)
index.html                 #view-academia + #ac-root + aba de modo "Academia"
js/main.js                 setMode('academia') → acInit() lazy
supabase/migrations/20260731120000_luma_academia.sql
supabase/functions/ai/index.ts   task 'aula' (prompt pedagógico no servidor)
```

**Prefixo `ac*`.** `f*`, `d*`, `g*`, `tut*` e `pv*` seguem intocados.

---

## 3. Navegação

Terceira **aba de modo** na topbar (`setMode('academia')`), visível para as 3 roles.
Rotas internas em `acState.rota`, trocadas por `acGo(rota, arg)`:

| Rota | Tela | Quem |
|---|---|---|
| `home` | Jornada: cabeçalho contextual, progresso, mapa de módulos, continuar, retomar, certificado | todos |
| `aula` | Ambiente de aula (3 regiões) | todos |
| `gestao` | Gestão de conteúdo | `equipe_dm` / `gestao` |
| `certificado` | Conclusão + certificado | todos |

⚠ **Por que um modo novo e não uma tela dentro do Franqueado:** o ambiente de aula precisa de três colunas próprias; encaixá-lo em `#fran-main` brigaria com o layout de chat + prévia e arriscaria regressão em `f*`.

---

## 4. Modelo de dados (schema `luma`)

| Tabela | Guarda | RLS |
|---|---|---|
| `cursos` | a formação: versão, carga horária, `criterios`, `certificado`, publicado | franqueado vê publicado; escrita `is_designer()` |
| `curso_modulos` | etapas ordenadas + `prereq_modulo_id` | idem |
| `curso_aulas` | aulas ordenadas; `transcricao`/`materiais`/`atividade` em JSONB; `conteudo_versao` | idem |
| `matriculas` | curso iniciado/concluído, último acesso, última aula | dono escreve; equipe lê |
| `aula_progresso` | `posicao_seg`, `pct_assistido`, `concluida`, `salva`, `tentativas` | dono escreve; equipe lê |
| `aula_notas` | anotações pessoais | **só o dono** (equipe não lê) |
| `aula_mensagens` | conversa com o tutor | **só o dono** (equipe não lê) |
| `certificados` | emissão registrada em dados | leitura dono+equipe; **sem policy de escrita** |

**Por que 8 e não 17 tabelas:** transcrição, materiais, atividade e tentativas viajam sempre com a aula/progresso — ninguém consulta uma alternativa de pergunta isolada, então são JSONB. "Aula salva" é coluna, não tabela. Versão do curso é coluna + snapshot no certificado.

**Trigger de integridade:** `luma.ac_guard_aula_curso` força `curso_aulas.curso_id` a ser o curso do módulo da aula.

---

## 5. Progresso e conclusão

**O que conta como assistido.** O player soma o tempo **realmente** assistido: `timeupdate` acumula apenas deltas `< 2s`; salto na barra é descartado. Arrastar a barrinha até o fim **não** conclui a aula.

**Gravação:** local primeiro (síncrono), banco depois. Sobe a cada 10 s tocando, na pausa, ao trocar de aula, no `pagehide` e no `visibilitychange`.

**Retomada:** volta ao ponto salvo, exceto se estiver dentro da margem final (10 % da duração, teto 10 s) — aí recomeça, que é o que a pessoa espera.

**Conclusão de aula:**
- Aula **com** vídeo: conclui sozinha ao atingir `cursos.criterios.pct_min` (padrão 85 %). O botão manual fica desabilitado antes disso, com a dica "assista mais X %" atualizada ao vivo. Isso mantém UI e servidor de acordo — a RPC do certificado exige o mesmo percentual.
- Aula **sem** vídeo: botão livre.
- Atividade é **formativa**: registra tentativa, mostra explicação, **não** trava a conclusão.

**Marcos:** toast por aula; overlay discreto (dispensável, Esc fecha) só ao fechar um módulo ou a formação.

**Conteúdo atualizado depois da formação:** a equipe marca "atualização relevante" e `curso_aulas.conteudo_versao` sobe. Quem já concluiu **mantém** a conclusão e o certificado; a aula só ganha o selo "Novo" (comparação com `aula_progresso.visto_conteudo_versao`). Mudança grande de verdade = subir `cursos.versao`, e o próximo certificado sai na versão nova sem invalidar os antigos.

---

## 6. Certificado

Emissão **só** por `luma.ac_emitir_certificado(p_curso uuid)` — `SECURITY DEFINER`, revalida no servidor todas as aulas obrigatórias publicadas (com o `pct_min`) antes de gravar. `luma.certificados` **não tem policy de INSERT/UPDATE/DELETE**, então o cliente não forja nem apaga. Idempotente: chamar de novo devolve o mesmo código.

Documento: desenhado em **Canvas 2D** (cores lidas dos tokens de `00-tokens.css`) e convertido em PDF pelo **pdf-lib vendorizado** — o mesmo caminho de `fGenPDF`. Não guardamos arquivo: a linha do banco reconstitui o PDF a qualquer momento. Código de validação `LUMA-XXXX-XXXX` (sem 0/O/1/I, legível ao telefone).

---

## 7. Tutor (agente educacional)

Reutiliza o motor único `gAskAI` (`js/core/ai.js`) com a task **`aula`**.

**O prompt vive no servidor** (`supabase/functions/ai/index.ts`, constante `AULA_SISTEMA`, versionada em `AULA_PROMPT_V`). O front manda só `{prompt: pergunta, contexto: {...}}`. É a **única** task assim: as outras montam prompt no front porque existe modo de transição com chave local e duplicar o builder seria pior — a task `aula` nasce sem esse legado, então método socrático e limites ficam fora do alcance do DevTools.

**Contexto enviado:** curso, módulo, aula, objetivo, resumo, descrição, transcrição com `[mm:ss]`, títulos dos materiais, **só os enunciados** da atividade, progresso resumido e as últimas 8 mensagens. **Não** vai: nome, e-mail, telefone, dado de outro franqueado, anotação privada, **gabarito** da atividade.

**Disponibilidade:** o painel usa `gAiEdgeReady()` (não `gAiReady()`) — sem Edge Function publicada + sessão, o tutor aparece como indisponível em vez de aceitar pergunta que sempre falharia.

**Timestamps:** só viram botão de navegação quando a aula tem vídeo. Sem transcrição, o prompt instrui a não citar minutagem.

---

## 8. Gestão de conteúdo (equipe_dm / gestao)

Três abas: **Módulos e aulas** (árvore + editor), **Configuração da formação**, **Acompanhamento**.

- Reordenar módulo/aula grava a ordem de todos os irmãos (não deixa buracos).
- Editor de aula: título, objetivo, resumo, descrição, vídeo, thumbnail, duração, materiais, transcrição, atividade, obrigatória, publicada, "atualização relevante".
- Transcrição e atividade são editadas como **texto simples** e convertidas para JSON (`mm:ss texto` por linha; `Pergunta | opções ; separadas | índice da correta | explicação`).
- **Preview** como franqueado com faixa fixa amarela — impossível confundir com a experiência real.
- Sem formação no banco: banner com **Criar formação** ou **Começar da demonstração** (semeia os 6 módulos/9 aulas de exemplo em rascunho, a partir da mesma constante `AC_CURSO_DEMO` que o front usa em modo local — uma fonte só para o conteúdo de exemplo). Em demonstração a árvore é somente leitura, porque não há linha no banco para editar.
- **Acompanhamento** lê `matriculas` + `aula_progresso` agregados. Nunca lê anotações nem conversas.

### Upload de MP4

`acUploadArquivo` usa **XHR** contra a Storage REST API (`/storage/v1/object/luma-aulas/<path>`) em vez de `sb.storage.upload()`. Motivo: o supabase-js não expõe progresso nem cancelamento, e vídeo de aula tem centenas de MB. Mesmo endpoint, mesmas policies, JWT do usuário.

Validação: extensão **e** MIME **e** assinatura do arquivo (bytes 4–7 = `ftyp`) — só extensão é fácil de falsificar. Teto de 500 MB. Substituir grava no mesmo path (`x-upsert`), sem deixar lixo. Remover apaga do bucket com confirmação.

### Storage

Bucket **`luma-aulas`**, **privado** (500 MB/arquivo). Vídeo de formação é conteúdo interno da rede — não vira link público como as artes. O front resolve com `createSignedUrl` (2 h para vídeo, 1 h para material), cacheado por path na sessão. Leitura: qualquer autenticado. Escrita: `is_designer()`.

Aula aceita **dois** caminhos de vídeo: `video_path` (arquivo no bucket) ou `video_url` (MP4 já hospedado em outro lugar). Guardar o path — não a URL — é o que permite trocar de assinatura/CDN depois sem reescrever linha.

---

## 9. Estados da interface

Loading (skeleton no formato da home), primeiro acesso, nenhuma formação, curso em rascunho, aula bloqueada por pré-requisito, aula sem vídeo, vídeo carregando, vídeo indisponível, material indisponível, tutor indisponível, tutor com erro (+ tentar de novo), upload em andamento/falha, conteúdo atualizado, certificado bloqueado/disponível, erro de conexão (cai no cache e avisa), acesso negado.

Todo estado vazio orienta a próxima ação. Feedback sempre por `gToast`; diálogos por `gConfirm` (nunca `confirm()` nativo).

---

## 10. Responsividade

| Faixa | Layout |
|---|---|
| ≥ 1181px | 3 regiões no grid: estrutura · aula · tutor |
| ≤ 1180px | tutor vira painel deslizante (botão "Tirar dúvida") |
| ≤ 1024px | estrutura também vira drawer (botão "Aulas"); home em coluna única |
| ≤ 768px | player com teto de `56vh` (título, abas e progresso continuam visíveis), navegação empilhada, inputs em 16px (sem zoom no iOS) |
| ≤ 480px | breadcrumb só com o módulo, tipografia reduzida |

Os drawers são `position:absolute` dentro de `.ac-aula`, **não** `fixed`: `#view-academia` guarda o `transform` final do `viewEntrance`, e um filho `fixed` ancoraria na view em vez do viewport (bug real, corrigido).

---

## 11. Eventos (analytics)

Via `gTrackEvent` (reusa `analytics.fct_eventos`): `jornada_aberta`, `formacao_iniciada`, `aula_aberta`, `video_iniciado`, `video_retomado`, `aula_concluida`, `modulo_concluido`, `formacao_concluida`, `aula_revisitada`, `material_acessado`, `nota_criada`, `atividade_respondida`, `agente_pergunta`, `certificado_emitido`, `certificado_baixado`.

⛔ **O texto das conversas com o tutor nunca é telemetria** — `agente_pergunta` leva só `aula_id`/`curso_id`. Conteúdo educacional pessoal fica em `luma.aula_mensagens`, protegido por RLS.

---

## 12. Como colocar em produção

1. Aplicar `supabase/migrations/20260731120000_luma_academia.sql`.
2. Conferir que o schema `luma` segue exposto em Settings › API › Exposed schemas (já estava).
3. Publicar a Edge Function `ai` atualizada (`supabase functions deploy ai`) — sem ela o tutor fica indisponível; o resto do módulo funciona.
4. Entrar na Academia como `equipe_dm`/`gestao` → **Gerenciar conteúdo** → *Criar formação* ou *Começar da demonstração*.
5. Publicar módulos e aulas, e depois a formação. Rascunho é invisível ao franqueado (RLS).

---

## 13. Limitações conhecidas

- **Progresso é escrito pelo cliente.** Um franqueado com DevTools consegue marcar as próprias aulas como concluídas e satisfazer a RPC. O que ele **não** consegue: forjar certificado sem esse rastro, nem emitir para outra pessoa. Fechar isso exigiria progresso só por RPC com heurística de tempo real assistido — decisão de produto.
- **Sem streaming adaptativo.** MP4 progressivo (`<video>` nativo). O modelo já separa `video_path` de `video_url`, então trocar por HLS depois não mexe no schema.
- **Sem rota pública de validação de certificado.** O código existe e é conferível por quem tem acesso ao banco/app; página pública exigiria endpoint anônimo, que a arquitetura atual não tem.
- **Sem versionamento de conteúdo por linha.** `conteudo_versao` marca "mudou", não guarda o que era antes.
- **Quiz sem banco de questões nem sorteio.** Itens fixos por aula.
- **Progresso do vídeo é por aula, não por trecho.** Não há mapa de calor de quais partes foram vistas.

---

## Ver também

- `luma-brain/02_ARCHITECTURE.md` — onde o módulo se encaixa.
- `docs/LUMA.md` §21 — resumo técnico na doc oficial.
- `docs/LUMA-BACKEND-CHANGELOG.md` — a entrada de backend deste módulo.
