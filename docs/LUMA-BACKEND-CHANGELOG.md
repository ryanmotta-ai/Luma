# LUMA — Changelog do Backend (Fase 5.1)

> Registro de TODAS as alterações da integração com o Supabase. Atualizado a cada mudança.
> Projeto Supabase: **`uqrqzjafhigjuvtjqzid`** (banco próprio do LUMA, separado do DM CRM).
> Arquitetura: front Vanilla JS falando direto com Supabase via `supabase-js` (anon key pública) → **RLS é a única fronteira de segurança**. Schema desenhado pra **fundir no DM CRM** depois.

---

## 2026-09-05 — RLS: `WITH CHECK` no Storage e conta desativada barrada no banco

> ⚠️ **Precisa aplicar a migration** `20260905120000_luma_rls_with_check_e_conta_ativa.sql`. Até aplicar, as duas falhas abaixo seguem abertas em produção. Nenhuma Edge Function mudou.

**§1 — policy de UPDATE sem `WITH CHECK` (falha real, corrigida).** As policies de UPDATE de `storage.objects` criadas em `20260618094000_storage_buckets.sql` definiam só o `USING`. `USING` valida a linha ANTES da alteração; sem `WITH CHECK` nada valida a linha DEPOIS. Na prática: o dono de `<uid>/foto.png` podia fazer `UPDATE storage.objects SET name = '<uid-de-outro>/foto.png'` e mover/sobrescrever arquivo alheio com uma requisição PostgREST — o mesmo valendo para trocar o `bucket_id`. As duas policies (`dono atualiza seus uploads luma privados` e `designer atualiza em buckets luma públicos`) foram recriadas com `WITH CHECK` espelhando o `USING`.

**§2 — conta desativada continuava lendo (backlog que estava anotado em `js/core/auth.js:50`).** `ativo = false` derrubava a sessão no front, mas o JWT já emitido seguia válido até expirar e as policies de leitura pediam apenas `auth.uid() IS NOT NULL`. Com o token na mão, o desativado continuava lendo `luma.variaveis`, `luma.fontes` e a vitrine de `luma.pastas`. Nova função `public.is_ativo()` (`STABLE SECURITY DEFINER`, `EXECUTE` revogado de `anon`/`authenticated` como as demais) passa a ser o gate dessas três policies.

A formulação é **"autenticado E NÃO explicitamente desativado"**, não `ativo = TRUE`: no primeiro login o trigger `handle_new_user` pode ainda não ter gravado o profile, e `= TRUE` daria deny-all a um usuário legítimo numa corrida de milissegundos. Fail-open em linha ausente, fail-closed em linha que diz `ativo = false`.

**Fora do escopo, de propósito:** `luma.templates`. A policy dele já não usa `auth.uid() IS NOT NULL` (é `publicado = TRUE AND validade >= hoje`) e template publicado é conteúdo da rede, não dado pessoal — trancá-lo por `ativo` é decisão de produto, não correção de falha.

**Verificado e NÃO alterado:** a suspeita de auto-reativação (`UPDATE profiles SET ativo = true WHERE id = auth.uid()`) **não existe**. O trigger `guard_profile_role()` foi estendido em `20260618095000_luma_hardening.sql` §11.1 para bloquear `role`, `departamento` **e** `ativo` para quem não é `gestao`. Quem leu só a migration 1 não vê a versão 6, que a sobrescreve.

**Ações necessárias:** aplicar a migration. Testar as 3 roles: (a) franqueado ativo continua abrindo catálogo, prevendo e gerando arte; (b) franqueado desativado não lê `variaveis`/`fontes`/`pastas` nem com token válido; (c) designer segue publicando e trocando capa (o `WITH CHECK` novo não pode barrar upload legítimo em `luma-covers`).

---

## 2026-08-29 — Edge Function `ai`: task nova `girias`

> ⚠️ **Precisa de deploy da function** (`supabase functions deploy ai`). Sem ele a task cai no caminho de transição (chave do front) e continua funcionando; quando a chave for rotacionada, sem o deploy o recurso simplesmente não roda — e a legenda sai sem o tempero, como sempre saiu.

**O que mudou no servidor:** uma linha — `"girias"` entra na allowlist `TASKS`. Nada de prompt novo no servidor (a decisão de 2026-07-30 segue valendo: prompt mora no front, menos `aula`), nada de tabela, nada de policy, nada de migration. O banco **não é tocado**.

**O que a task faz:** levanta as expressões realmente usadas na cidade do franqueado, **uma vez por cidade**. O resultado mora no `localStorage` do próprio franqueado (`dm_girias_v1`), nunca no banco — é preferência de conteúdo, não dado da rede. Entra no prompt da legenda como tempero opcional (no máximo uma expressão por legenda). Detalhe e guardas em `docs/LUMA.md` §9.

**Custo:** uma chamada a mais ao modelo **por cidade, por aparelho** — não por legenda. Lista vazia também é guardada, senão cidade que o modelo não conhece viraria uma chamada por legenda para sempre.

**Achado no caminho (não corrigido aqui):** `transcrever-audio` (usado em `png-generator.js:2329`) **não está em `TASKS`** — hoje a function recusa com 400 e o recurso vive do caminho de transição. Quando a chave do front for rotacionada, ele para. Vale entrar na mesma leva do próximo deploy, junto com uma conferida no teto de bytes para áudio.

---

## 2026-08-12 — Relatório semanal por e-mail (novos materiais)

> ⚠️ **NADA APLICADO AINDA.** O banco **não é tocado** (sem migration, sem tabela, sem policy) — o script só **lê** pelo PostgREST com a service_role. Falta cadastrar os secrets no GitHub Actions. Ver "Ações necessárias".

**Contexto.** Não havia canal para avisar a rede quando o marketing publica material novo — o franqueado só descobria abrindo o Luma. Agora, **toda segunda-feira às 09:00 BRT**, sai um relatório com tudo que foi publicado nos últimos 7 dias.

**Onde mora:** `scripts/digest-semanal.py` (Python 3, **só stdlib** — sem pip, sem provedor de e-mail novo) + `.github/workflows/digest-semanal.yml` (cron). Encaixa na infra que já existia para o backup diário; **não** cria camada nova no Supabase (sem Edge Function, sem `pg_cron`, sem `pg_net`).

**Regras de negócio embutidas:**
- **Nunca e-mail individual.** Um envio por grupo, destinatários em **BCC** (`to_addrs`, sem header) — a lista da rede não vaza e ninguém recebe aviso por material.
- **Nunca um e-mail por material.** Os materiais da janela são agrupados por campanha dentro de um único e-mail.
- **Segmentação por papel.** Dois envios: `franqueado` recebe **só a seção de artes**; `equipe_dm`+`gestao` recebem o mesmo hoje e serão os únicos a receber a **seção de RH** quando ela existir. A regra vive na tabela `SECOES` do script (`roles` por seção) — adicionar RH é uma linha, sem `if` espalhado.
- **Semana sem material novo = nenhum e-mail.**
- Só entra material **publicado, dentro da validade e em campanha ativa** — o mesmo filtro que a RLS aplica ao franqueado. Anunciar o que não está no catálogo seria pior que não anunciar.

**Leituras (service_role, só SELECT):** `luma.templates` (`publicado`, `publicado_em`, `validade`, `pasta_id`), `luma.pastas` (`nome`, `ativa`), `public.profiles` (`email`, `role`, `ativo`).

**Ações necessárias:**
1. Cadastrar os secrets em *Settings > Secrets and variables > Actions*: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (**senha de app**, nunca a pessoal), opcionais `EMAIL_FROM` e `EMAIL_CC`. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem (backup).
2. Rodar o workflow no braço com **`dry_run` marcado** e conferir os `preview_email-*.html` no artifact antes do primeiro envio real.
3. Conferir as 3 roles: `franqueado` só na lista da seção de artes; `equipe_dm` e `gestao` no mesmo envio; ninguém inativo (`profiles.ativo = false`) recebe.

---

## 2026-08-05 — Edge Function `ai`: task nova `mapear-psd`

> ⚠️ **FUNCTION AINDA NÃO REPUBLICADA.** A mudança está versionada; o deploy não rodou (sem acesso ao Supabase nesta entrega). **Nada quebra sem ele:** a task desconhecida faz a function responder 400, `gAskAI` devolve `null` e cai no caminho de transição (chave do front), que não valida task nenhuma — o recurso funciona, só sem a proteção de cota do servidor. Ver "Ações necessárias".

**Contexto.** O importador de PSD ganhou o botão **"Mapear com IA"** (`js/designer/psd-import.js` → `dPsdMapWithAI`): manda a **imagem da arte** + a lista de camadas (tipo, conteúdo, caixa) + o catálogo de campos, e recebe `camada → campo`. A imagem é o ponto: o motor de sugestão por nome não tem o que fazer quando metade das camadas se chama "Camada 5" — o papel de cada elemento está na arte, não no nome.

**Mudança (uma linha):** `mapear-psd` entra na allowlist `TASKS` de `supabase/functions/ai/index.ts`. Sem entrada nova, sem migration, sem policy, sem tabela — **o banco não é tocado**.

- Prompt montado no **front**, como todas as tasks menos `aula` (a decisão de 2026-07-30 segue valendo: prompt no servidor viraria prompt duplicado).
- Anexo: **1 imagem JPEG** da arte, lado maior ≤900px a q0.82 — ~25KB de base64 medidos, muito abaixo do teto de ~6MB. O mime já está na allowlist de anexos.
- Prompt medido: ~1.7k chars num PSD de 5 camadas (teto `MAX_PROMPT` é 12.000). PSD com centenas de camadas pode encostar no teto — nesse caso a function responde 400 e o front avisa; se virar caso real, cortar a lista de camadas por relevância antes de montar o prompt.
- Cota: o rate-limit existente (20/min por usuário) já cobre. Uma revisão de PSD dispara 1 chamada por clique.

**Ações necessárias:**
1. `supabase functions deploy ai` — só isso.
2. Conferir as **3 roles**: qualquer role autenticada pode chamar (é o mesmo critério das outras tasks — o que se protege é cota, não dado). Na prática só `equipe_dm`/`gestao` alcançam o botão, porque ele vive no Estúdio; confirmar que `franqueado` não vê o importador de PSD e que a chamada, se forçada, é aceita sem vazar nada (a resposta é só `camada → campo` do catálogo que o próprio chamador mandou).

---

## 2026-08-01 — Controle do produto: feature flags governadas pela Gestão

> ⚠️ **SQL AINDA NÃO APLICADO.** A migration está versionada; o banco não foi tocado (não havia acesso ao Supabase na entrega). O front funciona sem ela — cai nos defaults do registro. Ver "Ações necessárias" no fim desta seção.

**Contexto.** Desligar uma ferramenta do Luma exigia editar HTML, comentar função e fazer deploy. Não havia caminho para a gestão dizer "o texto vertical sai do ar enquanto passa por melhorias". O **Controle do produto** (5ª aba do painel da conta, exclusiva de `gestao`) passa a governar a disponibilidade de 32 recursos reais sem deploy.

**Migration:** `supabase/migrations/20260731190000_luma_feature_flags.sql`

**2 tabelas no schema `luma`:**
- `luma.feature_flags` — `feature_key` (PK, a chave do registro do front), `enabled`, `disabled_behavior` (CHECK `hide|disabled|readonly|maintenance`), `role_overrides` (JSONB), `motivo`, `atualizado_por`, `updated_at`.
- `luma.feature_flag_history` — trilha append-only: chave, operação, `valor_anterior`/`valor_novo` (linha inteira em JSONB), autor, motivo, data.

**O que NÃO foi para o banco, e por quê.** Rótulo, descrição, categoria, hierarquia pai/filho e comportamentos válidos ficam em `G_FEATURE_REGISTRY` (`js/core/feature-flags.js`), versionados com o código. Duplicar no banco criaria duas fontes de verdade que saem de sincronia no primeiro rename. O banco guarda **estado operacional**, não metadado de interface.

**`role_overrides` validado no banco sem função nova:**
```sql
CHECK (role_overrides - 'franqueado' - 'equipe_dm' - 'gestao' = '{}'::jsonb)
```
Subquery é proibida em CHECK; o operador `jsonb - text` resolve em uma linha. Impede que uma chave inventada (`cidade_x`, `departamento`) vire regra fantasma. ⚠ **Teto assumido:** o *tipo* do valor não é validado (exigiria função IMMUTABLE). O front só escreve booleano e a resolução compara com `=== true/false`, então valor não-booleano é tratado como "herdar".

**Trigger `luma.ff_auditar()`** — `AFTER INSERT/UPDATE/DELETE`, `SECURITY DEFINER`, `SET search_path = ''`, `EXECUTE` revogado de `PUBLIC`/`anon`/`authenticated` (padrão de `20260622150000`). O DEFINER é **necessário**, não conveniência: `authenticated` não tem INSERT em `feature_flag_history` — é isso que torna a auditoria imutável. Sem DEFINER, o trigger rodaria como o usuário e a gravação seria negada justamente quando importa. Auditar no banco (e não no front) garante rastro mesmo para escrita feita pelo SQL Editor ou por PostgREST na mão.

**RLS:**

| Tabela | `anon` | `authenticated` | `gestao` |
|---|---|---|---|
| `feature_flags` | nenhum | `SELECT` (precisa, pra montar a experiência) | INSERT/UPDATE/DELETE |
| `feature_flag_history` | nenhum | nenhum | `SELECT` |

O UPDATE tem `USING` **e** `WITH CHECK` com `(select public.get_user_role()) = 'gestao'`. `feature_flag_history` tem RLS habilitada e **nenhuma** policy de escrita — deny-all para cliente, só o trigger grava.

**Seed:** 32 chaves reais, todas `enabled = true`. Aplicar a migration **não muda o comportamento do Luma** — só passa a permitir mudá-lo. Nenhum switch decorativo: cada chave está ligada a um fluxo real do código (matriz de cobertura em `docs/LUMA.md`).

**⛔ Isto NÃO é segurança.** Feature flag governa **experiência**; a RLS continua sendo a única fronteira dos dados. Um usuário com DevTools consegue forçar `enabled` no cache local e reabrir um botão escondido — e não consegue ler nem escrever nada que a RLS já não permitisse. Por isso o fallback do front é **fail-open**: sem backend e sem cache, o Luma funciona como funcionava antes. Uma flag indisponível não pode derrubar o produto.

**`apply_all.sql` não foi alterado** — ele é bootstrap de projeto limpo e, como o próprio README diz, não inclui as migrations posteriores ao schema base.

**Ações necessárias:**
1. Aplicar `20260731190000_luma_feature_flags.sql` no SQL Editor.
2. Conferir com um `SELECT` (lição do incidente 2026-07-16 — migration versionada e não aplicada quebrou o sync por 5 dias):
   ```sql
   SELECT feature_key, enabled, disabled_behavior FROM luma.feature_flags ORDER BY 1;  -- 32 linhas, todas true
   SELECT count(*) FROM luma.feature_flag_history;                                      -- 32 (o seed é o 1º registro)
   ```
3. Testar as 3 roles: `gestao` vê e altera; `equipe_dm` e `franqueado` não veem a aba e recebem erro de permissão se tentarem escrever pela API; `anon` não lê nada.

---

## 2026-07-31 — Academia: experiência de conclusão (splash + vídeo dos CEOs)

**Contexto.** Concluir a formação era um overlay igual ao de fechar um módulo. A conclusão é uma **mudança de fase** do franqueado na rede — splash, mensagem institucional e vídeo dos CEOs. Nada disso pode ser hardcoded: a equipe troca texto e vídeo sem deploy.

**Migration:** `supabase/migrations/20260731180000_luma_academia_conclusao.sql`

**Sem tabela nova, sem bucket novo** — e o porquê importa:
- A **configuração** é uma por curso → coluna `luma.cursos.conclusao` (JSONB: `splash` + `video`). Tabela separada seria um JOIN 1:1 garantido pra sempre.
- O **estado** é um por (usuário, curso) → colunas em `luma.matriculas`, que já tem exatamente essa cardinalidade e a policy de dono correta: `splash_vista_em`, `splash_versao`, `video_visto_em`, `video_ignorado_em`, `video_visto_versao`, `video_posicao_seg`.
- O vídeo institucional entra em `luma-aulas` sob `conclusao/<curso>/`, com as policies que já existem (leitura autenticada, escrita `is_designer()`).

**Nenhuma policy nova.** As colunas entram numa tabela cujas policies já são "dono lê/escreve o próprio; designer lê todos" com `WITH CHECK` no UPDATE. Marcar a própria splash como vista não é decisão de segurança — o pior caso é a pessoa rever ou pular a própria celebração.

**Versionamento em dois níveis, de propósito:**
- `cursos.versao` sobe → a conclusão vale como **nova** e a splash volta.
- `conclusao.video.versao` sobe → a splash **não** volta; o vídeo novo aparece marcado como "Nova mensagem da liderança" na jornada. Quem já se formou não é obrigado a rever, e o histórico da formação anterior não é sobrescrito.

**Semente de texto (idempotente, `WHERE conclusao = '{}'`).** Texto de partida editável para a splash. ⚠ **Nenhuma fala de CEO foi inventada:** o vídeo nasce `ativo: false`, sem URL, com a introdução marcada como conteúdo a ser gravado pela equipe.

**Correção de regra de progresso incluída neste pacote (front).** O handler de `ended` do player chamava `acVideoTick(aula, true)`, que forçava `pct_assistido = 1` e concluía a aula. Isso **furava** o próprio design de "seek não conta": arrastar a barra até o fim disparava `ended` e a aula era concluída com 0% assistido — medido no navegador (`{pct:0}` → `{pct:1, concluida:true}`). O fim do vídeo agora só grava o que foi de fato assistido e apresenta a próxima ação. Quem assistiu de verdade já cruzou o critério no `timeupdate` antes de chegar lá.

**Ações necessárias:** aplicar a migration. A Edge Function `ai` **não** mudou neste pacote. Conferir as 3 roles: o franqueado escreve o próprio estado de splash/vídeo; a equipe continua lendo matrícula agregada e segue **sem** acesso a anotações e conversas.

---

## 2026-07-31 — Academia Delivery Much: schema da formação do franqueado

**Contexto.** A implementação de um franqueado novo acontecia fora do Luma (planilha + reunião + PDF solto). O módulo **Academia** traz a jornada pra dentro do produto: aulas em vídeo, materiais, anotações, tutor de IA, conclusão e certificado. Doc do módulo: [LUMA-ACADEMIA.md](LUMA-ACADEMIA.md).

**Migration:** `supabase/migrations/20260731120000_luma_academia.sql`

**8 tabelas no schema `luma`** (nomes em PT-BR, como o resto do schema):
- Conteúdo — `cursos`, `curso_modulos`, `curso_aulas`. Escrita só `is_designer()`; franqueado lê apenas o publicado (módulo publicado **e** curso publicado, checado por `EXISTS` na policy da aula). Transcrição, materiais, atividade e objetivos são **JSONB na aula** — não valem tabela própria porque nunca são consultados fora do contexto da aula.
- Progresso — `matriculas`, `aula_progresso`. Dono escreve (`WITH CHECK user_id = auth.uid()` em todo INSERT/UPDATE); equipe **lê** para acompanhar a rede.
- Privado — `aula_notas`, `aula_mensagens`. Policy `FOR ALL` só do dono; **`is_designer()` não entra**. Anotação de estudo e dúvida crua são material de aprendizado, não de gestão.
- Prova — `certificados`. Leitura dono + equipe. **Sem policy de INSERT/UPDATE/DELETE** (RLS sem policy = deny-all) → cliente não forja nem apaga.

**Função `luma.ac_emitir_certificado(p_curso uuid)`** — `SECURITY DEFINER`, `SET search_path = ''`, `EXECUTE` revogado de `PUBLIC`/`anon` e concedido só a `authenticated` (padrão de `20260619100000_harden_definer_functions`). É a **única** porta de escrita do certificado: revalida no servidor todas as aulas obrigatórias publicadas (com o `criterios.pct_min` do curso), grava `matriculas.concluido_em`, gera o código `LUMA-XXXX-XXXX` e devolve a linha. Idempotente por `(user_id, curso_id, curso_versao)`. Levanta exceção com mensagem em PT-BR (a UI mostra a mensagem crua da função).

**Trigger `luma.ac_guard_aula_curso`** (BEFORE INSERT/UPDATE em `curso_aulas`) — força `curso_id` a ser o curso do módulo da aula. Sem isso um UPDATE errado na gestão faria a aula aparecer numa formação e na sidebar de outra. `EXECUTE` revogado de todos (dispara pelo trigger).

**Bucket novo `luma-aulas`** — **PRIVADO**, 500 MB/arquivo, mime restrito (`video/mp4`, PDF, imagem, VTT, CSV, DOCX, XLSX). É o primeiro bucket de conteúdo privado: os outros são públicos porque a arte final é pública, e vídeo de treinamento da rede não é. Leitura: qualquer autenticado (o franqueado precisa assistir). Escrita/UPDATE/DELETE: `is_designer()`. O front usa `createSignedUrl` (2 h vídeo, 1 h material).

**Perf:** policies com `(select auth.uid())` / `(select public.is_designer())` — o padrão initplan desta base (`20260622130000`). Índices: `(curso_id, ordem)` nos módulos, `(modulo_id, ordem)` e `(curso_id, publicado)` nas aulas, `(user_id, curso_id)` e `(curso_id, concluida)` no progresso, `(user_id, aula_id, created_at)` em notas e mensagens.

**Edge Function `ai`** — task nova **`aula`** (tutor da Academia). É a **primeira task cujo prompt é montado no servidor**: o front manda `{prompt: pergunta, contexto: {...}}` e a function compõe o prompt pedagógico (`AULA_SISTEMA`, versionado em `AULA_PROMPT_V`). A decisão de 2026-07-30 (function repassa prompt do front) **continua valendo para as tasks antigas** — elas têm modo de transição com chave local e mover o builder criaria prompt duplicado. A task `aula` nasce sem esse legado, então método socrático, proibição de entregar gabarito e exigência de confirmação humana ficam fora do alcance do DevTools. Tetos próprios: pergunta ≤ 1.500 chars, contexto montado ≤ 24.000 chars, histórico ≤ 8 trocas. Responde em texto (não JSON).

**Front (`js/core/ai.js`)** — `gAskAI` ganhou `opts.contexto` (repassado íntegro à function) e `gAiEdgeReady()`, que diz se o caminho SERVIDOR está disponível. Recurso cujo prompt vive na function tem de perguntar por este, não por `gAiReady()`: com a chave de transição no front, `gAiReady()` dizia "disponível" e toda pergunta do tutor falhava.

**Ações necessárias:**
1. Aplicar a migration.
2. `supabase functions deploy ai` (a task `aula` só existe na versão nova). Sem isso, o tutor aparece como indisponível e o resto do módulo funciona normalmente.
3. Conferir as **3 roles**: `franqueado` (vê só publicado, não abre a gestão, não lê progresso de outro), `equipe_dm` (edita conteúdo, lê progresso agregado, **não** lê anotação/conversa), `gestao` (igual `equipe_dm` + o que já tinha).

---

## 2026-07-30 — Edge Function `ai`: a chave do Gemini sai do front

**Contexto (incidente latente).** A chave da API do Gemini estava **hardcoded em `js/00-config.js`** (`LUMA_GEMINI_API_KEY`) e era servida a todo browser de franqueado — qualquer DevTools lia e gastava a cota da DM, sem freio e sem rastro. Fere o guardrail "nenhum segredo no código" (`luma-brain/06_OPERATING_SYSTEM.md` §7). A chave já tinha sido trocada uma vez por quebra (commit `9422d0a`), o que confirma o padrão.

**Arquivo novo:** `supabase/functions/ai/index.ts` — proxy único de IA.
- **Autorização:** exige JWT válido (`auth.getUser()` com o client anon + header, mesmo padrão do `invite-user`). Qualquer role autenticada usa — as 3 personas têm recurso de IA. O que se protege aqui é a **cota**, não dado.
- **Chave:** `Deno.env.get('GEMINI_API_KEY')` — secret do projeto. Sem o secret, responde 503 e o front cai no motor local.
- **Freio:** rate-limit de 20 chamadas/minuto por usuário, em memória do isolate. ⚠ **Teto assumido:** é por instância, não global — serve contra loop/abuso acidental. Se precisar de contabilidade exata, virar tabela `luma.ai_uso` + RPC.
- **Tetos por chamada:** prompt ≤ 12.000 chars, ≤ 8 anexos, ≤ ~6 MB de base64 somados, mime de anexo só `image/png|jpeg|webp|gif` ou `application/pdf`.
- **Tarefas aceitas** (allowlist, pra recusar uso genérico do proxy): `legenda`, `encurtar`, `ajuda`, `cardapio`, `casar-fotos`, `cli` (console interno do time — `js/core/console.js`, gated por `gIsAdmin()` no front).
- **Decisão de arquitetura registrada:** a function **repassa** o prompt montado pelo front em vez de montar prompt aqui. Motivo: sem build/ESM, prompt no servidor viraria prompt **duplicado** (o front precisa dele no modo transição) — e duplicar motor é a proibição nº 1 desta base. Consequência aceita: um usuário logado da DM consegue gastar tokens com prompt próprio, limitado pelo rate-limit. Se algum dia precisar de controle rígido, os builders migram pra cá task por task.

**Front:** `js/core/ai.js` (motor único — `gAskAI`/`gAiReady`/`gAiParseJson`/`gAiFileToPart`). Tenta a function; se ela não estiver publicada (404), cai no **caminho de transição** (chave do front, comportamento atual) e loga o aviso. Nenhum outro arquivo do front toca a API do Gemini — `gGetGeminiApiKey`/`gGetGeminiModel` foram removidos.

**Ações necessárias (Pedro + Ryan), nesta ordem:**
1. `supabase secrets set GEMINI_API_KEY=<chave NOVA>` — gerar uma chave nova, a atual já circulou em browser.
2. `supabase functions deploy ai`.
3. Revogar a chave antiga no Google Cloud e **apagar** `geminiApiKey`/`LUMA_GEMINI_API_KEY` de `js/00-config.js` (o front passa a usar só a function).
4. Conferir no console do navegador que não aparece mais `[ai] Edge Function 'ai' não publicada`.

**Enquanto os passos acima não rodarem:** a IA continua funcionando pelo caminho de transição — nada quebra, e a exposição da chave permanece. Não é estado final.

---

## 2026-06-22 — Hardening pós-incidente: views SECURITY INVOKER + revoke de funções de trigger

**Contexto:** ao mexer em **Settings › API › Exposed schemas**, o schema `analytics` foi exposto pela Data API. Isso disparou **6 ERROR** de segurança (`security_definer_view` — view `SECURITY DEFINER` exposta fura RLS) + WARN de funções `SECURITY DEFINER` chamáveis via `/rest/v1/rpc/`. **Os dados não vazaram:** as views já estavam sem grant de `SELECT` pra `anon`/`authenticated`.

**Correções no banco:**
- `20260622140000_luma_analytics_views_security_invoker`: as 6 views `analytics.vw_*` viraram `security_invoker = on` → respeitam a permissão de quem consulta (remediação oficial do lint 0010). Extração admin (SQL Editor / service_role) segue intacta. **6 ERROR zerados.**
- `20260622150000_luma_sec_revoke_trigger_funcs`: `REVOKE EXECUTE` de `PUBLIC`/`anon`/`authenticated` nas 4 funções de **trigger** (`handle_new_user`, `guard_profile_role`, `rls_auto_enable`, `evt_forca_identidade`). Trigger dispara independente desse grant → não quebra nada. **8 WARN zerados.**
- **NÃO mexido:** `get_user_role`/`is_designer` mantêm `EXECUTE` — são usadas nas RLS policies; revogar quebraria o RLS (lição da Fase 5.1). Os 4 WARN delas são inerentes ao modelo e inofensivos (retornam só dado do próprio usuário logado).

**Ação no Dashboard (Pedro):** Exposed schemas = só `public`, `graphql_public`, `luma`. Tirar `analytics` (extração não vai pela API) e qualquer schema interno (`auth`/`storage`/`vault`/…).

**Estado de segurança:** 0 ERROR. WARN restantes e aceitos: `get_user_role`/`is_designer` (necessárias ao RLS) + Leaked Password Protection (toggle do Dashboard).

---

## 2026-06-22 — Rotina de backup (GitHub Actions, diário)

Backup automatizado, **fora** do Supabase (o free tier tem retenção curta e PITR é pago). Doc completa: [docs/LUMA-BACKUP.md](LUMA-BACKUP.md).

**Arquivos novos:**
- `.github/workflows/backup.yml` — workflow diário (`cron 0 6 * * *` = 03:00 BRT) + `workflow_dispatch`. Dois jobs independentes (um não derruba o outro):
  - **db-backup**: Supabase CLI (`supabase db dump`) → `schema.sql.gz` + `data.sql.gz` dos schemas `public,luma,analytics`. CLI escolhida em vez de `pg_dump` cru porque casa sozinha com o Postgres **17.6** do projeto.
  - **storage-backup**: `node scripts/backup-storage.js` baixa todos os objetos dos 5 buckets `luma-*` (inclusive o privado `luma-renders`) — o `pg_dump` só guarda as URLs, não os arquivos.
  - Saída como **artifacts** (retenção 90 dias).
- `scripts/backup-storage.js` — varre buckets recursivamente (paginado), baixa objetos, gera `manifest.json` (com visibilidade de cada bucket). Falha parcial não aborta (exit 2). CommonJS, usa `@supabase/supabase-js` (já no `package.json`).
- `scripts/restore-storage.js` — caminho de volta: cria buckets que faltarem (visibilidade do manifest) e faz upsert dos arquivos. Backup sem restore testado não é backup.
- `docs/LUMA-BACKUP.md` — o que entra/não entra, setup dos 3 secrets (com onde achar no dashboard), restore (3 cenários: mesmo projeto, projeto novo, Storage), backup local no Windows, notas (3-2-1, `auth.users`).

**Secrets a configurar no GitHub** (Pedro faz, não passam por mim): `SUPABASE_DB_URL` (Session pooler — IPv4; a Direct é IPv6-only e não conecta do Actions), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**`.gitignore`:** adicionados `backup/`, `storage-backup/`, `*.sql.gz`.

**Validado end-to-end (2026-06-25):** os 2 jobs rodaram **verdes** via `workflow_dispatch`, gerando os artifacts. Ajustes que apareceram no primeiro run real:
1. **Node 22** no runner — `supabase-js` recente exige WebSocket nativo, ausente no Node 20 (`Node.js 20 detected without native WebSocket support`).
2. **`SUPABASE_DB_URL` = Session pooler** (IPv4, host `…pooler.supabase.com:5432`). A *Direct connection* (`db.<ref>.supabase.co`) é **IPv6** e o GitHub Actions não tem IPv6 (`Network is unreachable`).
3. Scripts de Storage normalizam a URL (trim + prefixo `https://`) pra tolerar secret colado sem esquema.

---

## 2026-06-22 — Performance: índice de FK + RLS initplan (guiado pelo advisor)

Rodada de performance baseada no **advisor do Supabase** (`get_advisors performance`). Só banco — front intocado.

**1) Índice na FK `artes.template_id`** (migration `20260622120000_luma_perf_indexes`): `artes` é a única tabela que cresce de verdade; sem índice na FK, remover um template antigo causaria seq scan na tabela inteira. Criado `idx_artes_template`.

**2) RLS `initplan`** (migration `20260622130000_luma_perf_rls_initplan`): as policies chamavam `auth.uid()` / `is_designer()` / `get_user_role()` **reavaliando por linha**. Envolvidas em `(select …)` → avaliadas **uma vez por query** (recomendação oficial do Supabase). Semântica idêntica; aplicado via `ALTER POLICY` (atômico, sem janela de exposição). Cobre `luma.artes` (4 policies), `pastas`, `templates`, `fontes`, `variaveis`, `biblioteca_assets`, `snippets`, `public.profiles` (2) e `analytics.fct_eventos` (2). **Resultado: os 9 WARN de `auth_rls_initplan` foram zerados.**

**Decisões conscientes (NÃO feito, com motivo):**
- **Sem índices em `criado_por`** (6 tabelas): nenhuma query filtra por essa coluna e profile quase nunca é apagado → nasceriam como `unused_index`. Índice morto só custa escrita.
- **`multiple_permissive_policies`** (WARN, em `fontes`/`pastas`/`templates`/`variaveis`): cada SELECT avalia 2 policies permissivas (a de leitura + a `FOR ALL` de designer). Resolver exige fatiar o `FOR ALL` em 3 policies (INSERT/UPDATE/DELETE) por tabela. Ganho desprezível na escala atual (tabelas de dezenas de linhas) e mexer em RLS com o sistema em uso tem risco desproporcional → **deixado como dívida**; revisitar na fusão com o CRM ou se as tabelas crescerem.

**Validado:** `pg_policies` confirma `(SELECT auth.uid())` nas expressões (lógica preservada); advisor sem nenhum lint de `initplan`; `idx_artes_template` presente.

---

## 2026-06-22 — Analytics por extração: views SQL (schema `analytics`)

Decisão: o analytics **não vira dashboard no app** — os estudos saem por **extração** (SQL Editor / BI), em cima dos dados transacionais (`luma.artes`, `luma.templates`, `luma.pastas`, `public.profiles`). Sem event-sourcing, sem peso no front.

**Migration:** `supabase/migrations/20260619120000_luma_analytics_views.sql` (aplicada no banco). **6 views** no schema `analytics`:
- `vw_artes_por_dia` — artes/baixadas/franqueados por dia.
- `vw_uso_por_campanha` — uso agregado por campanha (`camp_id`/`camp_name`).
- `vw_uso_por_formato` — uso por formato (`fmt_id`/`fmt_name`).
- `vw_taxa_download` — total de artes, baixadas e **% de download**.
- `vw_franqueados_ativos` — por franqueado: nº de artes, baixadas e última atividade.
- `vw_templates_publicados` — por pasta: nº de templates, publicados e última publicação.

**Segurança validada:** as views **não têm grant** pra `anon`/`authenticated` (query em `role_table_grants` voltou vazia) → **não expostas via PostgREST/REST**. Acesso só com credencial admin (SQL Editor / service_role). São de **extração**, não da aplicação.

**Estado dos dados:** `vw_templates_publicados` já retorna 15 pastas; as views de artes estão zeradas porque nenhum franqueado gerou arte real ainda — vão popular sozinhas conforme o uso.

---

## 2026-06-19 — Gestão de usuários real no Supabase (Fase 1)

A tela de **Equipe** (modal de perfil) deixou de usar o mock (`AUTH_USERS`) e passou a usar o Supabase via RLS.
- `auth.js`: `gGetAllUsers` (SELECT `public.profiles` — gestão lê todos), `gSetUserRole` (UPDATE `role` — só gestão; guard garante), **nova** `gSetUserAtivo` (ativar/desativar). `gAddManagedUser` orienta o Dashboard (criar usuário precisa Edge Function — Fase 2). `gRemoveManagedUser` = desativar (`ativo=false`). Removidas as funções mock (`luma_role_overrides`/`luma_managed_users`).
- `user-profile.js`: `gProfileRenderEquipe`/`gProfilePickRole`/`gProfileSetUserRole`/`gProfileRemoveUser` viraram **async**; `_EQUIPE_ROLE_CFG` e os seletores de role alinhados aos roles reais (`franqueado`/`equipe_dm`/`gestao`).
- **Validado:** gestão lista todos os profiles via RLS. Escrita (role/ativo) não testada mutativamente (pra não mexer na conta real do Ryan); garantida pela policy (gestao atualiza todos) + guard (bloqueia não-gestão).

**Falta (Fase 2):** criar/convidar/excluir usuário pelo app via Edge Function (`service_role`).

---

## 2026-06-19 — Persistência: fontes, snippets, biblioteca (B) + histórico de artes (C1)

Mesmo padrão offline-first (localStorage cache + push background só designer + sync no boot).

**B — designer:**
- **Fontes** (`fonts.js` → `luma.fontes` + bucket `luma-fontes`): o arquivo da fonte sobe pro Storage e o FontFace carrega da URL. Colunas `nome`/`weight` adicionadas (migration `luma_fontes_extra_cols`). Remoção explícita (`dDeleteFontFromBackend`).
- **Snippets** (`library.js` → `luma.snippets`): blocos reutilizáveis. Remoção explícita.
- **Biblioteca de assets** (`library.js` → `luma.biblioteca_assets` + bucket `luma-template-assets`): **antes nem persistia** (só memória) — agora sobe imagens e cataloga. Remoção explícita.

**C1 — franqueado:**
- **Histórico de artes** (`history.js` → `luma.artes`, **escopo por usuário**): push das artes novas (upsert), sync no boot (merge cross-device), propagação rascunho→baixada (`fMarkBaixadaBackend`). Fotos do `dados` ainda inline (C2 sobe pro Storage).

`main.js`: o boot agora dispara **6 syncs** (variaveis, folders, fontes, snippets, biblioteca, artes). Shapes todos validados via MCP. **Teste no navegador pendente.**

**C2 (feito):** fotos **enviadas** (base64) no `dados` sobem pro bucket `luma-user-uploads` (tornado **PÚBLICO** — viram arte pública) → URL pública no histórico. `_fUploadUserImg` em `history.js`. URLs externas (ex.: coladas de um site) ficam como estão.

**Teste no navegador (2026-06-19):** template "Hambug" publicado com imagem por **URL externa** (gstatic) → foi pro banco. Upload de **arquivo** pro Storage (base64 → bucket) ainda não exercido no browser (só via API).

---

## 2026-06-19 — Persistência: Pastas + Templates (LEITURA) — ciclo fechado

**Arquivos:** `js/designer/layers.js` + `js/main.js`.
- **novas:** `dSyncFoldersFromBackend()` (2 queries: `SELECT luma.pastas` + `luma.templates`, monta `dFolders` com **merge** que preserva pastas locais não sincronizadas, por `remoteId`/`campId`); `_dRowToFolder`/`_dRowToTemplate` (banco→objeto, publishMeta remontado).
- `main.js`: `gOnLoginSuccess` chama `dSyncFoldersFromBackend()` no boot (junto com as variáveis). Re-hidrata `idb://` (cache local) depois.

**Validado via API (REST autenticado, RLS designer):** ciclo **escrita→leitura OK** (insert pasta+template → 201; leitura traz ambos com defaults).

**✅ Escrita validada no NAVEGADOR (2026-06-19):** o Pedro publicou um template no designer → gravou em `luma.templates` ("Prancheta 1", Copa do Mundo, feed, publicado) + as 16 pastas do catálogo sincronizadas. Falta exercer: upload de **imagem real** pro Storage (templates testados não tinham foto) e confirmar a **leitura cross-device** (outro device/localStorage limpo).

**Decisão de arquitetura:** backend = **Supabase é a fonte** (cross-device). O **IndexedDB (`img-store` do Ryan) fica como cache local complementar** — não passamos por cima: já está integrado (no push, imagens `idb://`/`data:` são resolvidas e sobem pro Storage; o banco guarda a URL).

---

## 2026-06-19 — Persistência: Pastas + Templates + Storage (ESCRITA)

**Arquivo:** `js/designer/layers.js`.
- `dPersistFolders()` dispara `dPushFoldersToBackend()` (debounce 1.2s) em background.
- **novas:** `_dPushFoldersNow()` (upsert `luma.pastas` + `luma.templates`; cada pasta/template ganha `remoteId` UUID = PK no banco, **sem mexer no `id` interno** nem nas referências); `_dUploadDataUrl()` (sobe `data:`URL pro Storage → URL pública); `_dUploadLayerImages()` (sobe imagens base64 dos layers).
- **Storage:** capa → bucket `luma-covers`; imagens de layer → `luma-template-assets`. base64 vira URL no JSON → resolve "imagens somem" **e** alivia o localStorage.
- `publishMeta` aberto nas colunas (`publicado`/`publicado_em`/`validade`/`instrucoes`/`permissoes`).

**Falta (LEITURA):** `dPreloadFolders` puxar o catálogo do banco no boot (próximo sub-passo).

**⚠ Teste no navegador PENDENTE:** o shape do insert foi validado via MCP (pasta+template+cascade OK), mas o fluxo completo (criar template com imagem no designer → grava em `luma.*` + sobe pro Storage) **ainda não foi exercido no browser**. Validar antes de confiar.

---

## 2026-06-19 — MCP conectado + hardening de funções SECURITY DEFINER

- **MCP do Supabase conectado** nesta sessão (execute_sql, apply_migration, get_advisors, etc.).
- **Advisor 0028/0029** (funções SECURITY DEFINER chamáveis via `/rest/v1/rpc`): revogado EXECUTE de `guard_profile_role`, `handle_new_user`, `analytics.evt_forca_identidade` e `rls_auto_enable` (trigger/event — seguras). Migration `harden_revoke_execute_definer_functions` + arquivo `20260619100000_harden_definer_functions.sql`.
- **⚠ Tentativa que falhou e foi revertida:** revogar `get_user_role`/`is_designer` **quebrou a RLS** (`permission denied for function`) — elas são usadas dentro das policies, avaliadas no contexto do usuário. Revertido na hora (`fix_grant_execute_policy_helpers`: GRANT de volta). Lição: helpers de policy **precisam** de EXECUTE pelo role.
- **Sobra (aceito):** WARN nessas 2 funções (risco baixo) + Leaked Password Protection (toggle no dashboard). Eliminar o 1º exigiria schema privado (refactor futuro).

---

## 2026-06-19 — Persistência: Variáveis (dVars → luma.variaveis)

**Estratégia: offline-first.** localStorage continua como cache (boot rápido, síncrono); o Supabase é a fonte compartilhada.

**Arquivos tocados:**
- `js/designer/layers.js`:
  - `dPersistVars()` (segue síncrono) agora também dispara `dPushVarsToBackend()` em background.
  - **novas**: `_dVarToRow`/`_dRowToVar` (mapeamento dVars↔coluna), `dPushVarsToBackend()` (upsert por `name` + remove as que sumiram; só designer), `dSyncVarsFromBackend()` (carrega do banco no boot, com **merge** que preserva e sobe vars locais ainda não sincronizadas).
- `js/main.js`: `gOnLoginSuccess()` chama `dSyncVarsFromBackend()` após o login.

**RLS:** SELECT pra autenticado; write só designer (`is_designer`). Validado via API (gestao faz upsert/delete → HTTP 201/204).

**Comportamento:** designer cria/edita variável → vai pro banco; no boot, o catálogo vem do banco (cross-device). Sem backend configurado, cai no localStorage (inalterado).

**Validado no navegador (2026-06-19):** criar campo no designer → apareceu em `luma.variaveis` com UUID gerado.

**✓ Sync não-destrutivo (2026-06-19):** `dPushVarsToBackend` agora **só faz upsert** (nunca apaga em massa). A remoção do banco é explícita via `dDeleteVarFromBackend(name)`, chamada por `dRemoveVar` (apaga a var removida) e `dRenameVar` (apaga o nome antigo). Elimina o risco de um designer apagar variáveis criadas por outro.

---

## 2026-06-19 — Auth real (login via Supabase)

**Arquivos tocados:**
- `js/core/auth.js` — núcleo de autenticação migrado do mock pro Supabase:
  - `gLogin` → `sb.auth.signInWithPassword`
  - `gLogout` → `sb.auth.signOut` (corrige o "logout falso" — antes só dava reload)
  - `gForgotPassword` → `sb.auth.resetPasswordForEmail`
  - `gResetPassword(newPassword)` → `sb.auth.updateUser` (assinatura mudou: era `(token, newPassword)`)
  - **nova** `gLoadProfile()` — carrega `sb.auth.getUser()` + `SELECT role,nome,departamento FROM profiles` e popula `gAuthState`
  - `ROLE_HIERARCHY` agora `{franqueado:1, equipe_dm:2, gestao:3}` (era admin/superadmin)
  - `gIsAdmin()` = role ∈ (`equipe_dm`,`gestao`); `gIsSuperAdmin()` = `gestao`
  - `gUpdateUserTopbar()` — cores/labels do badge adaptados pros novos roles
  - **Mantido (mock, dívida):** `AUTH_USERS` + gestão de usuários (`gGetAllUsers`/`gSetUserRole`/…)
- `js/main.js` — boot (`DOMContentLoaded`) virou `async`: `await gLoadProfile()` checa a sessão real antes de decidir login vs app.

**Validação:** login real testado via API (`pedro.moraes@deliverymuch.com.br`); ataque de auto-promoção a `gestao` **bloqueado** pelo guard trigger (HTTP 400).

**Pendência:** `js/core/user-profile.js` ainda tem badges/seletores com roles antigos (`admin`/`superadmin`) — **cosmético**, não quebra; reconciliar depois.

---

## 2026-06-19 — Fundação do client Supabase

**Arquivos tocados:**
- `assets/vendor/supabase.js` — SDK `supabase-js` v2 (UMD) vendorizado (expõe `window.supabase`).
- `js/core/supabase-config.js` — credenciais (URL + anon key). **Gitignored** (não vai pro repo).
- `js/core/supabase-config.example.js` — modelo versionado com placeholders.
- `js/core/supabase.js` — cria `window.sb` (defensivo: sem credenciais, app segue em modo local). Helpers `gSupabase()` / `gHasBackend()`.
- `index.html` — 3 `<script>` (vendor + config + client) carregados **antes** de `js/core/auth.js`.

---

## 2026-06-19 — Schema do banco (migrations)

**Arquivos:** `supabase/migrations/` (6 migrations) + `supabase/seed.sql` + `supabase/apply_all.sql` (concatenado p/ SQL Editor) + `supabase/README.md` + `supabase/config.toml`.

**O que criou** (no projeto `uqrqzjafhigjuvtjqzid`, aplicado via SQL Editor):
- `public.profiles` + helpers (`get_user_role`, `is_designer`) + trigger de signup + guard de role.
- Schema **`luma.*`**: `pastas`, `templates`, `variaveis`, `fontes`, `snippets`, `biblioteca_assets`, `artes`.
- Schema **`analytics`**: `fct_eventos` (Módulo 3).
- **RLS** em todas as tabelas (anon sem acesso; designer vs franqueado por `is_designer()`).
- **Storage**: buckets `luma-*` (públicos p/ assets de marca; privados p/ uploads do franqueado).
- **Hardening** (migration 6): guard anti-auto-promoção, anti-spoofing de eventos, teto de payload.

**Config no dashboard:** schemas `luma` e `analytics` expostos em Settings → API → Exposed schemas. Automatic RLS habilitado.

**Mapa localStorage → Postgres:** ver `supabase/README.md`.

**Segurança:** auditado contra os achados do DM CRM (`docs/LUMA-REGRAS_BACKEND.md` — removido em 2026-07-16; lições em `docs/LUMA.md` §14.9). Testes anônimos confirmam que nada vaza. Detalhes no README.

---

## 2026-06-19 — Versionamento

- Repo git inicializado e conectado ao remoto oficial **`github.com/ryanmotta-ai/Luma`** (privado).
- Commit `dced413` ("Backend Supabase Fase 5.1") aplicado **em cima** do histórico existente (`f1a5356 "0.6"`), sem perdas.
- Commit `6835b79` ("Auth real + persistência de variáveis via Supabase") — auth real, reconciliação de roles, sync de variáveis offline-first/não-destrutivo + este changelog.
- `.gitignore` limpo (credenciais removidas; `supabase-config.js` ignorado).

---

## 2026-07-16 — INCIDENTE 2: Storage recusa TODO upload do designer (falta SELECT p/ upsert)

**Sintoma:** capa de pasta editada no Estúdio "não salvava" (vitrine seguia com a imagem antiga) e, pior, o push gravava `cover_url=NULL` e **apagava a capa antiga** da pasta no banco. Diagnóstico nos buckets: `luma-covers`, `luma-template-assets` e `luma-fontes` com **0 objetos desde sempre**; `luma-user-uploads` (franqueado) com 44 — designer nunca conseguiu subir nada.

**Causa-raiz:** todo upload do app usa `{upsert:true}`, e o upsert do Storage exige **INSERT + SELECT + UPDATE** em `storage.objects`. Os 3 buckets públicos só tinham INSERT/UPDATE/DELETE (`is_designer()`) — sem policy de SELECT o Storage recusa o upsert. "Bucket público" cobre só a leitura via URL/CDN, não a API autenticada. Efeito colateral histórico: sem upload, as imagens dos templates nunca externalizavam → **base64 gigante em `luma.templates` (a raiz do problema de tráfego/egress)**.

**Correções:**
1. Migration `20260716150000_luma_storage_select_buckets_publicos.sql` — policy de SELECT (authenticated) nos 3 buckets. **Aplicar no SQL Editor.**
2. Front (`js/designer/layers.js`): upload falho agora loga `console.warn` (era silencioso) e o upsert de pastas **omite `cover_url`** quando a capa está pendente/local — preserva a capa que já está no banco em vez de gravar NULL.

**Lição:** upsert de Storage precisa das 3 policies; bucket "público" não dispensa SELECT para a API. Conferir upload com `select count(*) from storage.objects where bucket_id='...'` após configurar bucket novo.

---

## 2026-07-16 — INCIDENTE: sync de templates quebrado desde 11/07 (migration não aplicada)

**Sintoma:** diagnóstico no console (sessão real do designer) mostrou 30 pastas no banco e **0 templates** — os 2 templates locais presos em `_syncPending`. Franqueados sem catálogo de materiais novos.

**Causa-raiz:** a migration `20260711120000_luma_templates_size_cols.sql` (colunas `w/h/bg` em `luma.templates`) foi versionada no repo mas **nunca aplicada no banco**. O push do designer grava essas colunas em todo upsert → PostgREST rejeita a linha inteira (`column templates.w does not exist`, HTTP 400). O pull do boot pede as mesmas colunas no `select` → também falha. Pastas não usam as colunas → sobem normal (por isso o problema passou despercebido: metade do sync funcionava).

**Por que ficou mudo 5 dias:** os erros de upsert/pull eram engolidos (só viravam `_syncPending`/catch silencioso). O badge "não sincronizado" acendeu, mas sem o motivo. Correção de visibilidade: `console.warn` nos erros de push/pull do sync (`js/designer/layers.js`, esta data).

**Correção de banco:** SQL na pendência 🔴 abaixo (Pedro). **Lição de processo:** migration só está "pronta" quando aplicada — versionar no repo não muda o banco; conferir com um `select` na coluna nova após aplicar.

## 2026-07-16 — Aviso de conflito cross-device no sync do designer

**Arquivo tocado:** `js/designer/layers.js` (só front — `updated_at` + trigger já existiam no banco desde o schema inicial). Fecha o item P0 do roadmap "upsert last-write-wins sem versão — lock + `updated_at` com aviso de conflito" (o lock já existia).

- **Pull** (`dSyncFoldersFromBackend`/`_dRowToTemplate`): baixa `updated_at` e guarda como snapshot `_remoteUpdatedAt` no template local.
- **Push** (`_dPushFoldersNow`): antes de gravar, uma consulta em lote compara o carimbo atual do banco com o snapshot. Carimbo mais novo = outro device gravou nesse meio-tempo → o push segue (LWW continua sendo a regra), mas `gToast` avisa quais templates foram sobrescritos — a perda deixa de ser silenciosa.
- Depois de cada upsert o snapshot é renovado com o carimbo que o próprio write gerou (senão o push seguinte acusaria conflito com a própria gravação).
- Sem rede na consulta do carimbo → só perde o aviso; o push não muda.

## 2026-07-16 — Histórico de artes ligado ao template de origem (`template_id`)

**Arquivo tocado:** `js/franqueado/history.js` (só front — a coluna `luma.artes.template_id` já existia desde o schema inicial).

- **Push** (`fPushArtesToBackend`): grava `template_id` de verdade via `_fTemplateUuidFor(h)` — resolve o `materialId` local pro UUID remoto do template (via `dFolders`, com fallback regex pra device onde o id local já é o UUID). Materiais-demo e templates nunca sincronizados → `null`, como antes.
- **Guarda de FK:** se o template foi apagado no banco antes da arte sincronizar, o upsert re-tenta uma vez com `template_id:null` — o vínculo nunca segura a arte fora do histórico cross-device.
- **Pull** (`_fRowToArte`): `materialId` volta do banco (`r.template_id`) em vez de `null` — **"Editar" uma arte sincronizada em outro device volta a achar o material de origem** (num device recém-sincronizado o id local do template É o UUID do banco).

## Pendências / próximos passos

- [x] **Login real testado no navegador** — funciona (login + promoção a `gestao` OK, 2026-06-19).
- [x] `js/core/user-profile.js`: badges + tela de *Gestão de Equipe* migrados pro Supabase (lista profiles reais via RLS; Fase 1).
- [x] **Persistência do designer**: ✅ variáveis, ✅ pastas + templates + Storage, ✅ fontes, ✅ snippets, ✅ biblioteca de assets (todas via API; falta exercer no navegador).
- [x] **Persistência do franqueado**: ✅ histórico de artes (`luma.artes`) + ✅ fotos do chat → bucket `luma-user-uploads` (tornado público).
- [x] **Analytics**: eventos emitidos nos pontos-chave — `sessao_iniciada`, `arte_gerada`, `arte_baixada`, e (2026-07-16) `template_publicado`, `campanha_aberta`, `material_aberto` (funil completo campanha → material → arte). As views `vw_*` consultam-se via SQL Editor/service_role.
- [x] 🔴 ~~URGENTE~~ **RESOLVIDO (Pedro, 2026-07-16)** — **templates não sincronizam desde 11/07** (incidente confirmado em 2026-07-16, ver entrada acima): a migration `20260711120000_luma_templates_size_cols.sql` nunca tinha sido aplicada. **Aplicada em 2026-07-16 via SQL Editor junto com a `20260716120000` (índice) e a `20260716130000` (no-op)** — verificação pós-aplicação: `size_cols=3`, `idx_artes_template_id=1`, triggers `touch_*` intactos e sem duplicatas. Falta o passo do Ryan (recarregar o Estúdio + clicar no badge) pra `luma.templates` sair de 0. SQL aplicado:
  ```sql
  ALTER TABLE luma.templates ADD COLUMN IF NOT EXISTS w  INT;
  ALTER TABLE luma.templates ADD COLUMN IF NOT EXISTS h  INT;
  ALTER TABLE luma.templates ADD COLUMN IF NOT EXISTS bg TEXT;
  -- aproveitando: índice da migration 20260716120000
  CREATE INDEX IF NOT EXISTS idx_artes_template_id ON luma.artes(template_id);
  ```
  Depois de aplicar, avisar o Ryan: recarregar o Estúdio e clicar no badge "não sincronizado" — os templates presos sobem sozinhos.
- [x] **APLICADAS (Pedro, 2026-07-16, junto com a urgente acima)** — 2 migrations escritas em 2026-07-16, versionadas em `supabase/migrations/`:
  - `20260716120000_luma_artes_template_id.sql` — coluna `template_id` em `luma.artes` (FK SET NULL + índice). **Nota (2026-07-16): a coluna já existe no schema inicial aplicado (`20260618092000`)** — o que esta migration adiciona de fato é o índice. O front **já foi ligado** (ver entrada abaixo); a migration segue valendo aplicar pelo índice.
  - `20260716130000_luma_updated_at.sql` — **virou NO-OP (2026-07-16)**: coluna e trigger já existiam desde o schema inicial (`touch_*_updated`). O arquivo foi reescrito pra só desfazer a duplicata caso a versão original tenha sido aplicada. **Resumo pro Pedro: só a `20260716120000` vale aplicar (e só pelo índice).**
- [ ] **XSS (H.1)**: `gEsc()` global antes de produção (achado §11.3 do CRM).
- [x] Gestão de usuários: ✅ Fase 1 (listar/role/ativo via RLS). ✅ **Fase 2 (2026-07-16): convite pelo app via Edge Function `invite-user`** (deployada, v1) — valida caller `gestao`, envia e-mail de convite (`auth.admin.inviteUserByEmail`), e ajusta role/nome/telefone no profile (o trigger `handle_new_user` segue criando como `franqueado`; o UPDATE autorizado define o role real). Front: botão Convidar da aba Equipe + campo telefone opcional. ⚠ Requer aplicar `20260716160000_luma_profiles_telefone.sql` (coluna `telefone`). Exclusão definitiva de auth.users continua manual (Dashboard).
