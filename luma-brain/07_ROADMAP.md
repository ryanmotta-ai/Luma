# 07 — ROADMAP · O caminho até a v1

> O plano oficial do Luma até uma **v1 sólida**. Nasceu de uma auditoria completa do código
> (jul/2026): três varreduras — franqueado, designer+core, dados/backend — com bugs confirmados
> em `arquivo:linha`, cruzadas com o `luma-brain/` e o `docs/LUMA.md`.
> **Critério de corte:** só entra o que serve à missão (arte em <1min, zero peça fora da marca,
> autonomia da ponta). Nada de inventar por inventar.
> Última revisão: 2026-07-31. Dono: Ryan. Atualize os checkboxes conforme avança.
> Trilha de UI (tela a tela, notas e fases P0–P3): `docs/ROADMAP-UI-1.0.md` — corre em paralelo; o gate final da 1.0 soma as duas.

---

## 1. O que é a v1 (definição de pronto)

A v1 existe quando estas 5 frases forem verdade **sem asterisco**:

1. **Um franqueado real usa o Luma na rotina sem suporte** — abre, gera, baixa, posta. Erros têm mensagem; nenhum clique "morre" em silêncio.
2. **O designer opera o catálogo inteiro sem tocar em código** — criar campanha, publicar, expirar, agendar: tudo pela UI, nada exige deploy.
3. **Nenhum trabalho se perde** — nem do designer (sync), nem do franqueado (histórico), nem por falta de commit.
4. **Nada no app mente** — o que é demo está rotulado ou removido; "Salvo na nuvem" só aparece quando salvou na nuvem.
5. **Zero XSS conhecido, RLS validada nas 3 roles**, backup rodando.

O que **não** é v1 (fronteiras conscientes, ver `00_PRODUCT.md` §9): CRM Visual/CleverTap, multi-tenant por cidade, agendador de posts, legendas por IA de verdade. **O dashboard de analytics foi retirado do app** (decisão executada em 2026-07-15) — analytics é por extração SQL, como a arquitetura já definia.

---

## 2. Estado atual (resumo honesto da auditoria)

| Área | Estado | Veredito |
|---|---|---|
| Franqueado (fluxo gerar arte) | Completo e robusto no caminho feliz | Motor único de render confirmado em todos os previews; error-handling falha nas bordas |
| Luma Sheets (lote) | Completo | Pequenas desonestidades de UX (linhas com erro somem do ZIP sem aviso) |
| Designer/Estúdio | Completo e profundo | **Sync tem buracos reais de perda de dados** (P0) |
| Publicação/permissões | Completo | Presets só em localStorage; linter duplicado e com regra morta |
| Backend/RLS | Endurecido, 0 ERROR no advisor | Views de analytics inutilizáveis p/ designer (conflito RLS); eventos previstos não emitidos |
| Módulo Dados | 100% mock | **Decisão (2026-07-15): será RETIRADO do Luma** — analytics segue só por extração SQL |
| Catálogo de campanhas | **Hardcoded** (`CAMPS_*` em `00-config.js`) | Criar campanha exige deploy — fere a autonomia do designer |
| Perfil/equipe | Parcial | "Alterar senha" e "Salvar dados" são simulações com `setTimeout` |
| Docs/luma-brain | Fortes | Pequenas defasagens (nº de scripts, config "gitignored" que é versionado) |
| **Academia (formação do franqueado)** | **Novo em 2026-07-31** — jornada, ambiente de aula, tutor de IA, gestão de conteúdo, certificado, sistema de motion e experiência de conclusão (splash + vídeo dos CEOs) | Funcional e verificado no navegador. Pendências reais: aplicar as 2 migrations, deploy da function `ai` (task `aula`), a equipe publicar o conteúdo oficial e **gravar o vídeo dos CEOs** (nasce desligado, sem fala inventada). Ver `docs/LUMA-ACADEMIA.md` §15 |

---

## 3. Fase 0 — Estancar riscos (agora, antes de qualquer feature)

*Risco de perder trabalho ou embaraçar o projeto. Horas, não dias.*

- [x] **Commitar as ~850 linhas pendentes** — feito (commit `672c401` + refinos `82951f5`); `js/franqueado/prefs.js` já está versionado.
- [x] **Corrigir o 404 de todo boot** — link para `css/components/layers-panel.css` removido do `index.html` (commit `1a27177`).
- [x] **Remover `AUTH_USERS`** — array morto removido do `js/core/auth.js` (commit `5d6de18`).
- [x] **Backup diário: retry no Storage (2026-08-07).** Conferido: 7 verdes e 1 vermelho nos últimos 8 dias. O vermelho (06/08) NÃO foi erro de banco — o job do banco passou; o de Storage baixou 968 de 969 e morreu num `fetch failed` em `luma-template-assets/…/mask_l-psd-3-720.png`. O relógio do log entrega a causa: o bucket começou 08:39:53 e o erro só saiu 08:57:02, **dezessete minutos pendurado num download só** — soluço de rede, e o backup do dia seguinte passou limpo. O problema era o script: zero tentativas extras, zero teto de tempo, e qualquer erro pintava o run inteiro. **Backup vermelho por soluço vira ruído, e ruído ninguém olha** — quando falhar de verdade, ninguém nota. Agora são 3 tentativas com espera crescente (2s, 6s) e teto de 60s por arquivo; a lista do que não veio entra no `manifest.json`, para quem restaurar não ter que garimpar log. O motor de tentativa é exportado e testado sem credencial (mesmo padrão do `scripts/versao.js`): 8 asserções cobrindo soluço, falha persistente, propagação do erro original e o corte do download pendurado.
- [ ] 🔴 **Pedro aplicar o SQL das colunas `w/h/bg`** (`luma.templates`) — **sync de templates parado desde 11/07** (incidente 2026-07-16; SQL pronto no `docs/LUMA-BACKEND-CHANGELOG.md`). Depois: Ryan recarrega o Estúdio, clica no badge "não sincronizado" e confirma com o snippet de diagnóstico. **Lição de processo: migration só está pronta quando APLICADA e conferida com um select — versionar no repo não muda o banco.**

## 4. Fase 1 — Confiança no dado (o designer não pode perder trabalho)

*A promessa "um template, muitas cidades" morre se o template evapora. ~1–2 semanas.*

**Sync do designer (`js/designer/layers.js`) — P0:**
- [x] `_dUuid` fallback não gerava UUID válido → upsert falhava pra sempre fora de contexto seguro. Novo `gUuid()` em `00-config.js` (commit `21a0959`).
- [x] Indicador "Salvo na nuvem" mentia em modo local → "Salvo neste aparelho" (commit `18f5eed`).
- [~] `_dPushFoldersNow` early-return sem backend/admin **não marca `_syncPending`** (`layers.js:~2845`). **Reconferido 2026-07-18:** a perda de TEMPLATE está mitigada por outra via — `dSave` marca `t._syncPending=true` na escrita (`layers.js:2738`) e o pull do boot preserva pendentes (`:3040`). **Resíduo real:** edição só-de-PASTA (rename/cor/ordem) não recebe `_syncPending` no save (o flag de pasta só aparece em `:2887`), então uma alteração só de metadados de pasta com push pulado ainda seria descartada no pull. ⚠ **navegador+backend**
- [~] Exceção no meio do push e templates não visitados sem `_syncPending` (`layers.js:~2932`). **Reconferido 2026-07-18:** o catch faz `console.warn` e **os templates seguem protegidos pelo flag posto no save** (só o upsert com sucesso limpa `_syncPending`, `:2916`) — o próprio comentário do catch confirma. Na prática o dado não se perde; falta só a marcação explícita no catch como cinto-e-suspensório. ⚠ **navegador+backend**
- [x] Debounce de 1,2s + `dDirty` zerado na hora (`publish.js:532`) = fechar a aba logo após salvar perde o push. Flush no `pagehide` (`layers.js:2791`).
- [x] Push concorrente sem lock (`layers.js:2881`) e upsert last-write-wins sem versão — lock + `updated_at` com aviso de conflito. Lock (commit anterior) + aviso via snapshot `_remoteUpdatedAt` vs carimbo do banco (2026-07-16; falta exercer com 2 devices no navegador). ⚠ **navegador+backend, 2 abas**
- [x] Boot race: pull substitui `dFolders` e o template aberto com id local fica órfão — o pull agora preserva o template aberto e os `_syncPending` (ver comentário em `dSyncFoldersFromBackend`).
- [x] Deleções fire-and-forget que "ressuscitam" itens se falharem — fila de deleção pendente + filtro anti-ressurreição no pull (commit `f0e6e2f`).

**Histórico do franqueado (`js/franqueado/history.js`) — P0:**
- [x] `fSaveHist` disparava push sem `.catch()` → agora tratado (commit `b7f4013`).
- [x] `_sig` guardava base64 de fotos (MB por entrada) → agora só o comprimento (commit `b7f4013`).
- [x] `fPushArtesToBackend` regrava o localStorage com snapshot velho após `await`s — lock no push + releitura antes de regravar (commit `5301afe`).
- [x] Sync grava `template_id: null` e devolve `materialId: null` — resolvedor `_fTemplateUuidFor` no push (com guarda de FK) e `materialId` de volta no pull (commit `6cb2bd2`; a coluna já existia no banco). *Falta exercer cross-device no navegador.*

**Segurança (XSS residual) — P0 — ✅ FEITO (commits `81c0f0f`, `0cde200`):**
- [x] Linter do designer: `layerName`/`desc` escapados com `_dEsc` (`linter.js:157-160`).
- [x] Hero da home (`cover`/`color`, `catalog.js`), `campColor` do histórico, `label` em `fEditFromHist`, nome+cor em `publish.js:245-249`, `cover`/`color` em `templates.js:624`. Padrão `%27` no `'` que fecharia `url('…')`.

**Auth (robustez) — parcial:**
- [x] `gDoLogin` travava o botão em "Autenticando…" numa falha de rede — `gLogin` agora captura a rejeição e sempre devolve resultado (commit `67ac2b7`).
- [~] `gLoadProfile` rebaixa gestor a `franqueado` em erro de perfil (`auth.js:44-52`). **Reconferido 2026-07-18:** já **não é silencioso** — em `profErr` faz `console.warn` + `gToast('⚠ Não consegui carregar seu perfil…')`. Segue fail-closed pra role mínima (seguro, RLS governa). **Resíduo:** ainda não distingue "sem rede" de "deslogado" → verificação no navegador com sessão real.
- [x] `ativo:false` não é lido no front. **FEITO (reconferido 2026-07-18):** `auth.js:38` faz `.select('role, nome, departamento, telefone, ativo')` e `auth.js:51-56` bloqueia login de conta desativada (`signOut` + toast + `gAuthState={user:null}`). *(Falta só exercer com conta desativada real no navegador.)*

> ⚠️ **As frentes de Sync e Histórico acima seguem abertas de propósito.** Elas mexem na
> camada que perde dados e só se validam com navegador + backend + (no sync) dois devices/abas.
> Corrigir "no escuro" arrisca introduzir a própria perda que se quer evitar. Fazer em par com
> o Ryan, uma de cada vez, verificando cada uma no navegador antes de seguir.

## 5. Fase 2 — Catálogo 100% real (autonomia do designer)

*O maior gap estrutural de produto. ~2 semanas.*

- [ ] **Campanhas saem do hardcode** (headline, arquitetural): hoje `CAMPS_ATIVAS/OUTRAS/IMPLEMENTACAO` (`js/00-config.js:14-145`) são a fonte da lista e `dFolders` só fornece capa/templates (`catalog.js:460-463`). Migrar a fonte para `luma.pastas` (colunas badge, popular, agendamento, cor, perguntas, previews já existem). Criar/arquivar campanha vira ação da UI do designer. `CAMPS_*` vira só seed de primeira instalação. ⚠ **precisa de backend + navegador + UI de criar campanha + decisões (ver plano na §5.1)**
- [x] **Matar a re-injeção de mocks**: agora só ocorre em modo demo (sem backend); com Supabase real, pasta vazia mostra "em breve" (commit `11399b9`). A migração acima remove o mock de vez.
- [x] **Perfil — alterar senha real**: ligado ao `gResetPassword` (commit `362d3d5`); era `setTimeout` fake. *(Destino de telefone/foto — hoje localStorage-only, `profiles.avatar_url` existe e é ociosa — fica p/ a fase de perfil cross-device; precisa de navegador.)*
- [~] Grupos de visibilidade e `agendamento`/`grupos` de pasta. **Reconferido 2026-07-18:** ✅ **agendamento é respeitado** — `_fCampAgendadaFuturo` (`catalog.js:628`) filtra pastas com go-live futuro. **Resíduo aberto:** **grupos são órfãos** — gravados na UI (`templates.js:1478`, `dFolderRenderGroups:1366`) mas NENHUM ponto do franqueado lê/filtra por grupos. Decidir: aplicar de verdade ou remover da UI. ⚠ **decisão + navegador**
- [x] Validade com fuso: corrigido — reusa o `v` local com `T23:59:59` (commit `ba2b12e`).

### 5.1. Plano da migração de campanhas (a executar em par, com o navegador)

*Por que faseado: é um flip de fonte de verdade tocada por ~20 pontos; feito no escuro, arrisca deixar o catálogo do franqueado vazio ou quebrado. Um passo por vez, verificando no navegador.*

> **Reconferido 2026-07-18 contra o código.** Passos 1 e 2 ✅ feitos. Passo 3 parcial (modal edita nome/cor/campId/grupos/agendamento/capa — falta ARQUIVAR e os campos badge/perguntas). Passos 4 e 5 abertos: `fGetCampaigns()` ainda parte de `CAMPS_ATIVAS` (`catalog.js:512`) e só complementa com `dFolders`; `dBuildMockLayersForCamp` (`templates.js:32`) e `CAMPS_*` seguem como fonte.

1. [x] **Costurar o seam (refactor sem mudar comportamento).** Leituras roteadas por `fGetCampaigns()`/`fAllCampaigns()`/`fResolveCamp()`. *(Feito nesta sessão.)*
2. [x] **`luma.pastas` carrega os campos** que a UI lê (`_dRowToFolder` cobre ativa/ordem/agendamento etc.). *(Feito nesta sessão.)*
3. [~] **UI de campanha no designer.** ✅ modal edita nome, cor, campId, grupos, agendamento e capa (`templates.js:1436-1494`). **Falta:** botão de **ARQUIVAR** (hoje só Editar/Renomear/Esvaziar/Excluir; sem flag `ativa`/arquivada) e tornar **badge** e **perguntas** editáveis (hoje só herdados de `CAMPS_*`).
4. [ ] **Flip da fonte.** `fGetCampaigns()` passa a montar a lista a partir de `dFolders` (com `ativa`/arquivada), caindo em `CAMPS_*` só como seed. *Verificar nas 2 personas.* **Ainda aberto** (`catalog.js:512`).
5. [ ] **Aposentar `CAMPS_*`** para seed-only e remover `dBuildMockLayersForCamp`/mocks. **Ainda aberto** (`templates.js:32,98,105`).

## 6. Fase 3 — Nenhum clique morre em silêncio (confiabilidade da ponta)

*Bugs que sabotam o "franqueado sem suporte". ~1 semana.*

- [x] `fDownloadHist` e `fConfirmDuplicate`: `await fGenPNG` sem catch — falha de render = nada acontece, sem toast (`catalog.js:121-144,276-299`). Tratado como o `fBaixar` (commit anterior à atualização do roadmap).
- [x] `fOutroFormato` muta `fState.fmt` antes de gerar e não restaura no erro (`chat.js:963-1034`). Restaurado no `catch` (commit `ad51493`).
- [x] "Pular" campo opcional grava `''` e a prévia acusa "Falta preencher" pra sempre (`chat-input.js:316` + `live-preview.js:816`) — marcador interno distingue "pulado" de "esquecido" (commit `f827894`).
- [x] Sheets: linhas com erro são excluídas do ZIP sem aviso (`png-generator.js:1782-1786`) — pré-voo, `erros.txt` e resumo final informam o que foi gerado ou pulado (commit anterior à atualização do roadmap).
- [x] Kit da campanha: dedup de nome no ZIP (dois materiais com mesmo nome se sobrescrevem, `materials.js:62` — mesma correção que o bulk já tem em `png-generator.js:1829`) + barra de progresso (commits `6931c90` e este pacote).
- [x] Live preview: chamada com assinatura errada de `fRenderCanvasHelper` deixa um branch morto (`live-preview.js:214-217`); hit-testing ignora reflow em template legado (`live-preview.js:631`); `fIsImageVar` testa `varName` em vez de `imgVar` (`png-generator.js:2448`). Corrigidos no commit `c362ba3`.
- [x] Loading ao trocar material/editar do histórico (`fEnsureMaterialLayers` é fetch de rede sem spinner). Card e botão mostram spinner e bloqueiam novo clique durante o fetch (este pacote).
- [~] Editor — bugs de undo/duplicata. **Reconferido 2026-07-18:** ✅ Ctrl+Z em inputs corrigido (`publish.js:1067`, guarda `!inField`); ✅ mover com setas entrou no undo (`publish.js:1329`) e aplicar asset da biblioteca também (`library.js:190`); ✅ `dToggleLock`/`dSwapColors` desduplicadas (só em `layers.js:1004` e `tools.js:199`). **Resíduo aberto:** (a) trocar/limpar **foto direto na moldura** ainda fora do undo (`canvas.js:1170` e `:1182` — `imgUrl=` sem `dHistoryPush`); (b) `dAlign` de **grupo** grava `NaN` — grupos não têm x/y/w/h e `dAlign` (`layers.js:515-548`) não tem branch `l.type==='group'`.
- [x] **Quatro itens do roadmap fechados na revisão pró-1.0 (2026-08-07).** (a) **Regra 5 do checklist estava morta** — `linter.js:291` testava `l.url`, camadas image/frame guardam em `imgUrl`; nunca disparou desde sempre. (b) **Foto na moldura fora do undo** — `canvas.js` mutava `lReal.imgUrl` sem `dHistoryPush`, tanto ao aplicar quanto ao limpar. (c) **`dAlign` com grupo gravava `x=NaN`** (comprovado no navegador): grupo não tem x/y/w/h e não havia branch. Agora há `dLayerBox`/`dLayerMove` — o grupo entra pela caixa envolvente dos filhos e o alinhamento move o bloco inteiro, preservando a forma; `dDistribute` usa a mesma régua. (d) **Upload de imagem sem teto** no Estúdio — moldura e biblioteca não validavam nada (fonte tem 3MB, PSD 500MB); agora `_DIMG_MAX_MB=8`, e importa porque a imagem vira base64 DENTRO do template e vai inteira para o sync.
- [x] 🔴 **XSS COMPROVADO E FECHADO no rich text do PSD (2026-08-07).** `canvas.js` montava o `<span style="…">` de `l.runs` com os valores de estilo CRUS dentro do atributo. `l.runs` vem do import de PSD — arquivo de fora — e uma cor como `red" onmouseover="…` fechava o atributo e pendurava um handler. **Reproduzido no navegador antes de corrigir** (o `onmouseover` aparecia nos atributos do span) e re-testado depois com 4 payloads (cor, tamanho, fonte, tracking) + injeção de CSS por `url()`. Corrigido por SANITIZAÇÃO, não só escape: número vira número, cor e família passam por allowlist. Rich text legítimo verificado intacto. **Portão 5 da v1 ("zero XSS conhecido") volta a valer.**
- [ ] ⚠ **`layoutRole` é lido e nunca escrito** — 6 leituras (`00-config.js`, `core/layout.js`) e ZERO escritas: nenhuma UI ou importador marca uma camada como `protected`/`background`. A proteção do auto-layout e as `protectedAreas` do solver dependem dele e estão inertes; quem protege de fato é `locked`/`lockPosition`. Decidir: implementar a marcação na UI ou remover o conceito. Docs já corrigidas para não prometer o que não existe.
- [x] 🟠 **Code review completo do repositório (2026-08-13) — 4 defeitos de integração das features recentes, todos corrigidos e verificados no Chromium.** As três features que entraram entre 05/08 e 13/08 (layout vivo, auto-layout, grupos do PSD) não fecharam o ciclo entre os dois motores de render:
  > **(a) Livelock da entrelinha** (`00-config.js`). O degrau "apertar entrelinha" calculava o alvo e aplicava `Math.max(1.05, Math.min(entrelinhaAtual, alvo))` — quando o alvo vinha ACIMA da atual (texto que virou culpado por COLISÃO sem ter crescido, com caixa folgada), o clamp preservava o valor, nada mudava e o `continue` repetia o mesmo estado até esgotar as 32 voltas: re-medida e reposicionamento inteiros por volta, **sem nunca chegar ao degrau de encolher a fonte** — a colisão saía não resolvida. Agora só entra quem a conta realmente aperta.
  > **(b) Grupo composto no PNG, ignorado no Estúdio** (`canvas.js` × `png-generator.js`). Antes de `312d53a` a opacidade do grupo descia multiplicada nas folhas (`accOp`) e a máscara ia junto — os dois motores concordavam. O commit trocou isso por composição no marcador `type:'group'`, que só o PNG entende; o canvas filtra grupos fora em dois pontos. PSD com grupo a 60% ou com máscara aparecia inteiro no Estúdio e recortado no PNG do franqueado — **prévia mentindo sobre o arquivo final**. `_dGrupoHeranca`/`_dAplicaHerancaGrupo` carimbam a herança em cada filho (o DOM desenha em coordenadas absolutas por causa do drag, então grupo não vira wrapper).
  > **(c) `parentId` desligou o layout vivo** (`00-config.js:_gCorrenteMovivel`) — detalhe acima, em `docs/LUMA.md`. **Provado por A/B no navegador:** mesmo caso, regra antiga → nenhuma corrente inferida e o bloco de baixo parado em y=110; regra nova → corrente inferida e o bloco desce para y=170.
  > **(d) 171 mensagens mudas** (`toast.js`). A decisão "o Luma não alarma" foi implementada como `return`, o que cortou a MENSAGEM junto com a cor — inclusive instruções ("converta o vídeo para MP4", "sua sessão expirou"): a pessoa clicava, nada acontecia, sem caminho de saída. Agora `type:'error'` perde cor/`role=alert`/CTA e **mostra o texto** como toast neutro. Efeito colateral bom: `gWarnImagesNotPersisted` voltou a existir (era código morto garantido).
  > **Junto:** `_dPsdItemId` (a fórmula do id da camada de PSD estava escrita duas vezes — se divergissem, o clipping editável quebraria em silêncio); `_dEsc`/`_dSvgEsc` passaram a delegar em `gEsc` (três réguas de escape, duas sem a aspa simples); pré-carga paralela agora inclui `clipOwnMask`; 8 acessos a `localStorage` sem `try/catch` (o pior em `help-widget.js:15`, no corpo do objeto — em modo privado derrubava o arquivo inteiro); `_gDialog` saiu de `style=` inline com hex cru para `.g-dialog*` com tokens; `package.json` → `devDependencies` (npm nunca foi runtime aqui).
  > ⛔ **Descartados na verificação — não "corrigir":** XSS em `layers.js:3204`, `canvas.js:1291/1359` e `chat.js:452` (nome de campo é constrangido a `[a-zA-Z0-9_]` em **todos** os caminhos de criação: `gValidVarName`, o grupo de captura de `gVarRegex` e o regex do autocomplete); `user-profile.js:225` "sem try/catch" (tem); colisão de id `g-psd-N` entre importações (a importação cria prancheta nova e `publish.js:940` remapeia `parentId`); policy de UPDATE sem `WITH CHECK` (as 8 têm).
  > **Ficou de fora, de propósito:** invalidação incremental da detecção de colisão (`_colisoesInternas` roda inteira por volta, O(textos × obstáculos)). Com o item (a) corrigido o número de voltas despenca, e reescrever geometria sutil sem teste automatizado por um ganho já capturado é troca ruim. Fica registrado como dívida.
- [x] **`confirm()` nativo e emoji-em-toast fechados (2026-08-13, code review).** Os 11 `confirm()` restantes viraram `gConfirm` (`canvas.js`, `fonts.js`, `layers.js` ×2, `templates.js` ×7) — cada função virou `async` e, onde havia índice/referência viva (`dRemoveVar`, `dFontRemove`, `dDeletePageInTray`), o alvo passou a ser **re-resolvido por nome/ID depois do `await`**: `i` é posição num array que sync/undo reescrevem, e o splice no índice velho apagaria o item errado. O fallback `typeof gConfirm==='function' ? … : confirm(…)` de `layers.js` saiu junto — dois caminhos para a mesma pergunta era o próprio desvio. **Emoji-em-toast:** 169 prefixos (⚠ 111, ✓ 50, 🔒/📸/🪣/✅) removidos da copy em 24 arquivos por varredura mecânica sobre `gToast(`. Verificado no navegador (Chromium): as 21 funções seguem registradas no `window` — nenhuma quebra de `onclick`.
  > ⚠️ Falsos positivos já descartados na auditoria do editor — **não "corrigir"**: clique único NÃO cria duas camadas (o `dSetTool('select')` na criação é compensação intencional); colar camada NÃO perde vínculo `{{campo}}`; undo/redo restaura grupos corretamente.
- [ ] Upload de imagem de moldura/biblioteca sem limite de tamanho (`canvas.js:1071`, `library.js:134`) — validar como fontes/PSD já validam.

## 7. Fase 4 — Operação honesta e corte da v1

*Fechar o que a gestão precisa e assumir o que não vai. ~1 semana.*

- [x] **RETIRAR o módulo Dados** (decisão 2026-07-15): removidos `js/dados/`, `css/modules/dados.css`, `#view-dados`, scripts, pill e gates do modo. Docs atualizados. O que **fica**: `analytics.fct_eventos`, `gTrackEvent` e as views `vw_*` — analytics segue por extração SQL (gestão/BI), sem front.
- [x] **Analytics utilizável (backend, independe do módulo retirado)**: eventos do funil emitidos (`template_publicado`, `campanha_aberta`, `material_aberto` — commit `21ea6c8`); views consultam-se via SQL Editor/service_role (documentado no changelog).
- [~] Linter unificado. **Reconferido 2026-07-18:** ✅ `dPublishRender` já **reusa** `dRunLinter` (`publish.js:488`) — não reimplementa mais. **Resíduo aberto:** regra 5 morta — `linter.js:115` testa `l.url`, mas camadas image/frame guardam em `l.imgUrl` (`layers.js:382,390,408`); a regra nunca dispara. Trocar `l.url` → `l.imgUrl`.
- [~] Limpeza. **Reconferido 2026-07-18:** ✅ `rich-tooltips.js` e `dRenameAB` removidos. **Resíduo aberto:** `fLoadLogoBranca` (`png-generator.js:12`) morto (0 chamadas) e `__luma_session` (`user-profile.js:218,224`) órfão (nunca gravado, bloco inerte). ⚠️ **Correção do roadmap:** `fDrawDMLogo` **NÃO é morto** — está EM USO (`chat.js:968`, `png-generator.js:47,127,857`); não remover.
- [ ] Docs em dia: `LUMA.md` (63 scripts, config versionado de propósito), changelog, e este roadmap com os checks.
- [ ] **Verificação final no navegador nas 3 roles** (franqueado, equipe_dm, gestao) — o checklist do `LUMA.md` §18.
- [ ] **Refinar as ferramentas de design UMA A UMA** (auditoria de código + refino) — registrado 2026-07-18. Começar pela **caixa de seleção/transform** (a "moldura amarela" com handles em volta do objeto — a **edição de caixa de texto** é o ponto mais delicado e complicado hoje). Depois varrer forma/moldura/pincel/etc. na mesma régua. Vive em `js/designer/canvas.js` (marquee, transform, handles). É stream de qualidade do Estúdio, feito com navegador.
- [ ] **Integrar o documento "Luma Code Review"** (registrado 2026-07-18) — ~1.100 linhas de bugs, auditoria do código inteiro feita ao longo de ~6 dias por **Gemini 3.6 Flash + Opus 4.8 + Claude 5**. **NÃO está no repo ainda** — Ryan traz o arquivo; então a gente **tria os achados reais** (achado plausível ≠ real — verificar cada um contra o código, como manda a skill), remove falsos-positivos e **funde os confirmados neste roadmap**. É a espinha do refino final de código pró-1.0.
- [ ] **One-pager / slide "o que falta pro 1.0"** (registrado 2026-07-18) — versão apresentável deste roadmap pra diretoria, em blocos feito / parcial / falta. Posso gerar como artifact/slide a partir do estado reconciliado quando o Ryan pedir.

## 8. Decisões abertas (negócio — precisam do Ryan/Pedro, com recomendação)

| # | Decisão | Recomendação |
|---|---|---|
| ~~1~~ | ~~Módulo Dados na v1~~ | ✅ **Decidido (2026-07-15): módulo será RETIRADO do Luma** (tarefa na Fase 4). Analytics segue por extração SQL |
| 2 | **Fotos do franqueado em bucket público** (`luma-user-uploads`): aceitar (viram arte pública) ou URLs assinadas? | Aceitar na v1, documentado — o PNG final é público por natureza |
| 3 | **Criar usuário pelo app** (Edge Function com service_role) ou seguir no Dashboard? | Dashboard na v1 (decisão de 2026-06-19 mantida); Edge Function na v1.1 |
| 4 | **Presets de permissões compartilhados** (tabela) ou localStorage por designer? | localStorage na v1 (1 designer ativo); tabela quando houver 2+ designers |
| ~~5~~ | ~~**Legendas "IA"**: manter motor local ou plugar API?~~ | ✅ **Resolvido (2026-07-30): os dois.** A API está plugada via `core/ai.js` e o motor local (`fBuildCopy`) é o fallback — o selo do painel diz a origem real de cada legenda |

## 9. Import PSD — melhorias mapeadas (backlog priorizado)

*Mapeamento de 2026-07 lendo `js/designer/psd-import.js` (1958 linhas). **Correção de rota:** a lista de "limitações" da `docs/LUMA.md` estava desatualizada — **multi-estilo de texto** (`_dPsdRichRuns`:462 → `it.runs`:898) e **gradiente linear/radial** (`_dPsdGradient`:445 → `it.gradient`:899,931) já funcionam ponta a ponta (parse + render em `png-generator.js`); smart object / rotação / warp já **rasterizam 1:1** (`_dPsdNeedsRaster`:789). O que sobra de real, por valor:*

**P1 — alto valor**

- [x] **Z-order confiável.** A heurística `_dPsdShouldInvert` (`psd-import.js:1208`) retornava `false` no caso "sem sinal claro", deixando pilhas sem fundo nomeado/grande com z-order TROCADO. Comprovado por round-trip do ag-psd (`writePsd`/`readPsd`): ag devolve base-primeiro, o parse faz `out.reverse` (:1069) → itens topo-primeiro, e o caso NORMAL precisa inverter de volta. O default virou `true` (inverter), preservando a exceção `firstIsBg` (PSD atípico) e o toggle manual. Verificado nos 4 casos: flat sem-sinal, fundo grande, grupo aninhado e a exceção atípica — todos com fundo em `dLayers[0]`.
- [x] **Mapeamento camada → campo por arrastar (2026-08-05).** O motor de sugestão já existia enterrado (`_dPsdSuggestVar` consultando o `dVars` real + memória em `localStorage`); o vínculo na tela era um **input de texto livre** onde o designer digitava o nome do campo no escuro — sem ver o catálogo, sem saber se o campo existia, e sem descobrir quais campos ficaram órfãos antes de importar. Agora: trilha de campos arrastáveis com contador e "N campos sem camada"; soltura na linha **e na arte** (hit-test único `_dPsdHitLayer`, que passou a respeitar "Inverter ordem" — antes o hover pegava a camada de baixo em área sobreposta); guarda de tipo com realce vermelho antes do drop; caminho por clique (pegar → clicar) e por teclado (`<select>` de campos compatíveis + "Criar campo…"); sugestão não-automática virou botão "Sugerido: X" + "Aplicar N sugestões". Persistência de graça (o `_dPsdMemSave` já gravava `mode`/`varName`). Verificado no navegador: 32 asserções dos gestos + 4 do resultado do import (`{{campo}}`, moldura com `imgVar`, campo novo entrando no catálogo), claro e escuro, sem erro no console. *`psd-import.js` + `index.html` + `designer.css`; o parse não foi tocado.*
- [x] **Layout vivo: a arte reacomoda com o texto do franqueado (2026-08-05).** O pedido: digitar no chat e ver o template se adaptar — bateu no respiro, quebra linha; o de baixo desce; conforme o caso, encolhe. **Fases 0 e 4 entregues.** A cascata (`gApplyRelativeAnchors`) já existia e já rodava no render do franqueado — estava sendo alimentada com altura errada, porque medir e desenhar eram caminhos separados (detalhe em `docs/LUMA.md`). Agora há `gFitTextLayer`, a única resposta para "como este texto ocupa esta caixa", usada pelos dois lados; refactor **pixel-idêntico** em 16 casos. O interruptor tem dois níveis em série (flag da rede + `publishMeta.layoutVivo`, com toggle no publicar), padrão desligado. Custo medido: 12ms/render com 30 camadas. **Fase 3 entregue (2026-08-05):** as correntes são inferidas do próprio desenho — bloco alinhado logo abaixo de outro e a menos de duas linhas de distância vira filho dele; fundo, protegida, travada e filha de grupo ficam fora; âncora manual vence. A régua do gap é a CAIXA desenhada e a corrente só empurra: cabe na caixa → arte idêntica à publicada; passa → desce o excedente. *(A alternativa — medir um estado de referência com os valores de exemplo — foi descartada: dependeria do `dVars`, que pode estar vazio na sessão do franqueado, e referência diferente entre Estúdio e franqueado é a divergência de sempre.)* **Fases 1 e 2 entregues (2026-08-06):** a escada é **quebrar → empurrar → encolher**, nessa ordem, com dois pisos. O piso da hierarquia (`gStampPisosHierarquia`) impede que "diminuir" inverta a arte: uma camada nunca desce abaixo do degrau tipográfico imediatamente menor (título de 92 com preço de 64 para em 64), e o piso antigo de 50% continua valendo quando é mais restritivo. O laço fechou dentro da cascata: posiciona → se a tinta escapou da prancheta, reduz o teto de quem cresceu além da própria caixa (8% por passo, máx. 12) e reposiciona. Quando todo mundo chega ao piso e ainda não cabe, a prioridade inverte uma vez — arte com o preço cortado é inútil, arte com hierarquia achatada é feia mas serve — e desce até o piso absoluto. Custo: ~6ms. Três divergências medida × desenho foram achadas medindo, não lendo: **(a)** com teto imposto, `gSmartWrapText` ainda quebrava no tamanho DESENHADO — 7 linhas onde cabiam 3, encolhendo e crescendo em altura ao mesmo tempo; **(b)** sem `vAlign:'top'` o render CENTRALIZA na caixa, então o texto que passa dela transborda metade para cima — a cascata só media para baixo e o título comia a margem do topo; **(c)** o encadeamento era caixa-a-caixa e passou a ser tinta-a-tinta (`_gInkDy`), a mesma régua para âncora manual e inferida. A regra que resolveu (b): **texto não sobe** — centralizado enquanto cabe na caixa, ancorado no topo quando passa dela (`_vTopAuto`), crescendo só para baixo, que é o que a corrente sabe absorver. **Fase 6 entregue (2026-08-06):** o Estúdio avisa antes de publicar. `gStressValues` monta o pior caso PERMITIDO pelo `maxLen` — o texto mais longo que o franqueado pode digitar, nunca um a mais (testar além seria alarme falso, aquém seria não testar). O checklist ganhou "O pior caso não cabe", que monta a arte com esse texto pelo mesmo caminho do render e diz o número que o designer controla: *"com 32 caracteres em «Produto», «Título» invade «Preço»"* — e só acusa par que não se sobrepõe já no exemplo, senão o selo desenhado atrás do texto viraria alarme. De quebra: o cenário "Limite" do Simular dados reais tinha frases cravadas que ignoravam o `maxLen`, e o selo "Revisar encaixe" por campo estava no HTML sem nunca acender (faltava ligar o `_fOverflowSink` que o render já expunha). **Botão Auto-layout (2026-08-06):** a pedido do Ryan, a chave virou um botão ao lado do Auto-zoom na barra da prévia ao vivo — o franqueado pode preferir a composição original mesmo com o texto apertado, e gosto é dele. De quebra, achado ao medir: **a barra da prévia já transbordava 101px** num painel de 380px — o botão "Mockups" ficava fora da tela, sem scroll e sem pista de que existia; a barra agora quebra em duas linhas. E `[hidden]` não escondia nada nesses botões, porque o `display:inline-flex` da classe vence o do navegador. **Ajuste do Ryan no mesmo dia:** o designer não decide — **todo template nasce com o layout vivo ligado** e o interruptor por template saiu do publicar (`publishMeta.layoutVivo` removido do default, do modal e do render). Sobraram DOIS interruptores: a flag da rede (gestão) e o botão da prévia (franqueado). E o efeito ficou **só do lado do franqueado**: Estúdio, prévia do designer e Simular dados reais voltaram à geometria desenhada — camada escorregando sob o cursor de quem posiciona é o oposto de uma ferramenta de autoria, e o simulador serve para ver o problema, não o conserto. O checklist audita pela mesma régua (o franqueado pode desligar o Auto-layout, então a arte desenhada é a pior situação real). **Eixo X e refinos (2026-08-06):** mapeei o motor com sondas e ataquei o que apareceu. A cascata nasceu vertical, e isso deixava três buracos: **point text corria para fora da arte** (2385px de tinta numa prancheta de 1080 — ele não quebra nem encolhe, por regra do render), **não havia corrente lateral** (o "De R$ 149,90 por" cobria o preço em 211px) e a tinta horizontal era ignorada (`_gInkDx`, o irmão do `_gInkDy`). Junto: **prioridade de encolhimento por ORDEM** — o menor degrau com folga cede sozinho até parar de estourar, e só então a escada sobe; antes o título ia ao piso enquanto o regulamento jurídico parava um degrau antes (era −50%/−39%, virou −14%/−22%). **O vão do campo vazio fecha** (`anchor.colapso`, a única exceção ao "só empurra", limitada à altura exata da faixa que sumiu). **`_foraDaArte`** carimba o que a escada não conseguiu salvar. **Custo:** `_posicionar` era O(n²) e virou ordem topológica, uma passada — arte real 2,6ms, caso patológico de 40 textos 64ms contra 116ms. O checklist passou a acusar fuga nos quatro lados, com conserto específico para point text. ⛔ **Uma suspeita foi descartada medindo:** o piso da hierarquia parecia degenerar com assinatura miúda no rodapé, mas `degraus.find` devolve o maior degrau abaixo — em quatro hierarquias reais nenhuma camada pôde descer abaixo de outro texto. Código intacto. **Placa, entrelinha e barra (2026-08-07):** sondei o motor de novo e vieram três coisas. **A placa atrás do texto cresce junto** — o padrão "card" transbordava 62px e a cor saía debaixo da letra; inferida do desenho com regras apertadas (só retângulo, atrás no z-order, envolvendo o texto, ≤6× a área, um texto só), e cresce nos dois eixos — em largura só por point text, seguindo a direção da tinta. **A entrelinha virou o degrau antes de encolher a fonte** — designer fecha o espaçamento antes de diminuir a letra, e o aperto é calculado (`altura / fonte × linhas`), não tateado. **O checklist ganhou dois níveis** consumindo o `_foraDaArte`: alerta quando o Auto-layout conserta, erro quando nem ele salva. **A barra da prévia foi reorganizada:** os controles somavam ~510px num painel de 380px, então as duas linhas deixaram de ser acidente e viraram estrutura (linha 1 = ver, linha 2 = automáticos + ação), e os dois interruptores viraram um grupo "AUTO · Zoom · Layout", que economiza o prefixo repetido. De quebra, **a barra era branca no tema escuro** — o painel tinha versão escura desde sempre e a barra tinha sido esquecida. ⛔ **Duas suspeitas descartadas medindo:** a ordem da caixa-alta (hoje entrega 3 linhas contra 4 e cabe — mexer só mudaria arte publicada) e formatos divergindo (o `gReflowLayers` escala proporcional, os quatro formatos deram idêntico). **Layout vivo concluído.** **Fora de escopo por decisão do Ryan:** aviso visual na prévia do franqueado — o ajuste acontece calado.
- [x] **Refino do sistema de campos (2026-08-05).** Cinco itens saídos da revisão do próprio trabalho: **(1)** a guarda de tipo estava duplicada entre importador e prancheta — virou `gFieldFitCheck` em `00-config.js`, regra única com a mensagem única; **(2)** o botão "Usar" piscava a cada campo ligado (o passe do props-panel voltava só no MutationObserver, assíncrono) — `dFieldsRender` agora repõe no mesmo tique, para todos os chamadores; **(3)** *soltar na lista de camadas ficou de fora, é impossível*: `dActivatePanel('dados')` faz `layersSection.style.display='none'` (`layers.js:2135`), os dois painéis nunca estão na tela juntos; **(4)** auto-scroll no arrasto (laço de quadro alimentado pela última posição, porque `dragover` só dispara em movimento) — camada fora da vista deixou de exigir soltar/pan/pegar de novo; **(5)** o check novo do checklist, abaixo. De quebra, `dRunLinter` estourava em `l.name.toLowerCase()` numa camada sem nome e derrubava o checklist inteiro — guardado.
- [x] **Checklist: "Texto Fixo que Deveria Ser Campo" (2026-08-05).** O espelho do painel Campos — a única lacuna que evitava erro chegar na arte publicada. Acusa a camada de texto cravada na mão que vai sair com o valor velho na próxima promoção, e oferece **Corrigir** (liga no campo via `dLayerBindField`). Calibrado para precisão: 13 asserções, das quais **8 são falsos-positivos que ele tem que deixar passar** (disclaimer longo, texto corrido citando R$, rótulo "Preço:", legenda igual ao nome do campo, assinatura da marca, chamada fixa, camada já ligada, camada não-texto). Consequência aceita: perde casos sutis (um "Combo da casa" numa camada chamada "Título" não é acusado) — checklist que grita demais ninguém lê.
- [x] **Painel Campos: arrastar o campo até a arte (2026-08-05).** Fora do importador, ligar um campo custava 4 ações em dois painéis (selecionar camada na aba Camadas → trocar de aba → abrir o cartão → "Inserir no texto"), e o `dFieldUse` terminava com `dActivatePanel('camadas')` — aplicar um campo **expulsava** o designer do painel. Agora o cartão é arrastável: soltar numa camada liga (via `dLayerBindField`), soltar no **vazio da prancheta cria a camada já ligada** no ponto (não existia), e campo de imagem numa forma converte em moldura. Guarda de tipo no `dragover` (vermelho antes de soltar), hover no cartão contorna as camadas do campo, um Ctrl+Z desfaz o gesto. **Correção de rota no meio do trabalho:** metade do "redesign" que eu tinha proposto já estava resolvida por `props-panel.js` (`dPropEnhanceDataRows` reescreve os cartões, põe o botão "Usar", troca o ⋯ por SVG) e o rodapé de inventário já era `display:none` — então o clique-para-pegar e o chevron que eu havia adicionado foram **removidos** por serem conflito e redundância. Dois bugs achados medindo: `dSelLayerState` reintroduzia a expulsão do painel na criação, e o contorno fantasma do arrasto (`body.d-fielddrag`) vencia o realce do alvo por especificidade — laranja e vermelho ficavam **iguais durante o arrasto**. Verificado no navegador: 27 asserções + 19 medidas de usabilidade (custo do gesto, alvos ≥44px, erro recuperável, teclado, narração). *`layers.js` + `canvas.js` + `layers-panel.css` + `designer.css` + markup.*
- [x] **Mapear com IA na revisão (2026-08-05).** O mapeamento por nome (acima) só decide quando o designer nomeou a camada — e o `_dPsdMemIsGeneric` proíbe usar "Camada 5"/"Retângulo 2", que é metade de um PSD real. O botão manda a **imagem da arte** + as camadas (tipo, conteúdo, caixa) + o catálogo pro Gemini via `gAskAI` (task nova `mapear-psd`) e recebe camada→campo com o motivo. **A IA propõe, não decide:** entra como sugestão pendente marcada "IA sugere: X", o designer aceita ou recusa, e camada já ligada por ele não é tocada. Resposta toda validada no cliente (índice, campo, tipo, repetição) e **fundo→moldura barrado por código** — pedido no prompt não é guarda, e essa proibição existe no parse por bug real. Verificado no navegador com `gAskAI` dublado: 30 asserções (imagem montada, prompt dentro do teto da function, cada tipo de lixo descartado, falha/timeout/JSON inválido sem travar a UI, aceitar → `{{campo}}`+moldura no import). ⚠ **Falta `supabase functions deploy ai`** (a task nova) e a chamada real ao Gemini nunca rodou daqui — sem sessão nem chave no sandbox. *`psd-import.js` + `index.html` + `designer.css` + 1 linha na Edge Function.*
- [ ] **Camadas de ajuste aplicadas (ou aviso honesto).** Levels/Curves/Hue afetam as camadas de baixo, mas o Luma não tem pipeline de ajuste → são dropadas (`_dPsdNeedsRaster`:792, contador `_dPsdAdjustCount`:811) e as cores divergem do PSD. Opção barata: usar o **composite** que o ag-psd já entrega pra rasterizar fiel a região afetada. Opção mínima: aviso na revisão dizendo **quais** camadas mudam de cor (hoje é só uma contagem). *Verificar: PSD com Curves sobre foto → cor final bate com o Photoshop, ou avisa claro.*

**P2 — valor médio**

- [ ] **Path vetorial complexo sem rasterizar.** Só rect/elipse viram shape editável e recolorável (`_dPsdVectorShapeKind`:243); path arbitrário cai em raster (`vectorMaskFailed`:849) e perde nitidez/recolor ao escalar. Importar como shape de path se o modelo do editor suportar; senão, subir a resolução do raster do vetor. *Verificar: logo vetorial importado continua nítido em 2×.*
- [x] **Teto de raster adaptativo.** `_dPsdRasterURL` fazia downscale fixo a 1600px, borrando herói de PSD grande no export 2×. O parse agora computa `_rasterCap = min(3200, max(1600, 2×maxDimPrancheta))` (o PNG final é 2× a prancheta), e os chamadores passam `width/height` ao parse. Piso 1600 (sem regressão em prancheta pequena), teto 3200 (protege o IndexedDB). Verificado no round-trip: Story mantém foto 3000 (era 1600), Wide→2400, imagens menores que o teto ficam intactas.

**P3 — polimento**

- [ ] **Pattern fill / patternOverlay** rasterizam (`_dPsdNeedsRaster`:793-795) — perdem tiling/recolor. Baixa prioridade (pouco comum em peça de promo).
- [ ] **Badges de revisão** já cobrem máscara/recorte simplificado (`vecWarn`/`clipWarn`:1334-1335); estender pro ajuste dropado com a lista de camadas afetadas.
- [x] **Doc desatualizada** (`docs/LUMA.md:367,517`): "1 estilo por camada / gradientes ignorados" era mentira — corrigido neste pacote.

## 9. Pós-v1 (estacionamento justificado — não encher a v1)

- **v1.1** — Edge Function de usuários; lojas salvas/favoritos cross-device (tabela de prefs); presets compartilhados.
- **v1.5** — import de cardápio real no Sheets (hoje é demo honesto); notificação de material novo cross-device; formulário de campos combinados no Kit da campanha.
- **v2** — **CRM Visual** (inapp/push → CleverTap; pré-requisito declarado: mapear formatos aceitos); legendas por IA real; catálogo por cidade (multi-tenant — decisão de arquitetura, não feature).
- **Contínuo** — fatiar `designer.css` (2.665 linhas) e reduzir os 604 `style=""` inline gerados por JS; testes de fumaça manuais documentados por release.

### Brainstorm de 2026-07-18 (Ryan + Claude, lendo junto)

*Sessão de ideação puxada pelas alavancas de negócio (§`00_PRODUCT` e `01_BUSINESS`): GMV das promos locais, substituir ferramenta paga, acelerar lançamento de cidade, zero peça fora da marca. Cada ideia passou pelo crivo do Ryan (dono do domínio). Ordem de autoridade: palavra dele > tudo.*

**Aprovadas — backlog priorizável (ainda sem data):**

- **Calendário nacional que empurra a campanha** *(a grande — "é o módulo que a gente vai fazer")* — a DM central agenda a campanha no calendário e, no dia certo, ela aparece sozinha no catálogo de todas as cidades + **nudge contextual** na home do franqueado (cartão que só aparece quando tem algo do dia, some quando não tem — sem painel permanente). Funde o "lembrete por data" com a alavanca "um template, muitas cidades". Fundação já parcialmente lá: o campo `agendamento` já existe na pasta (§5, Fase 2). Franqueado que clica pode ir pro link fixo da Yungas + ver as artes recomendadas do dia dentro do Luma. Esforço médio-alto (tabela/tela de calendário + fluxo de preenchimento do designer).
- **Par vinculado feed↔story (↔ status WhatsApp)** — NÃO é auto-resize (rejeitado: feed e story são dois layouts feitos à mão, auto-redimensionar sairia ruim). O designer publica os layouts artesanais como um **par ligado**; o franqueado preenche **uma vez** e cada peça sai no seu layout próprio, só com os mesmos dados. Extensível a um 3º formato **status do WhatsApp** (mesma lógica do story). ⚠️ **Invariante confirmada (Ryan, 2026-07-18):** o Luma **não envia mensagem** (postar é manual, como no Instagram) — **mas pode enviar notificações** (ex.: avisar o franqueado de material novo). Gerar peça em formato WhatsApp ≠ enviar pelo WhatsApp. Esforço médio.
- **Backbone de eventos (destrava DUAS features de uma vez)** — hoje só existe `material_aberto`; falta o **evento de download** + uma **view de leitura**. Depende do Pedro (backend/RLS). Uma vez pronto, acende junto:
  - **"Mais usados da rede esta semana"** (franqueado) — prova social / efeito manada ("todo mundo está vendendo isso"). Mora numa **faixa horizontal única** na home, discreta — sem painel.
  - **Sinal de demanda pro designer** (equipe/gestão) — o que a rede buscou/abriu e não tinha material, e onde desistiu → worklist priorizada pro time ("22 cidades quiseram X e não tinha"). Fecha o loop demanda → criação.
- **Repostar o que funcionou** (franqueado) — do histórico, "gerar de novo" com um toque, sem refazer o chat. **Condição do Ryan:** mora **dentro do histórico ("Minhas Artes")** — botão por arte — pra **não entulhar a tela** nem "pular a home". Esforço baixo.
- **Painel "Mídias" / Módulo "Marca"** (inspiração: painel de mídias do Dashquify) — **NÃO é módulo novo**: a Biblioteca do Studio (`biblioteca_assets`, `js/designer/library.js`, drawer "Recursos") já tem nome/categoria/tipo e sync com Supabase. **Escopo decidido: só reorganizar o que já existe** — reagrupar em abas **Marca** (logos/imagens oficiais) × **Minhas mídias**. Fora de escopo por ora: captura automática de uploads descartados (PSDs, fotos de moldura `canvas.js:1170`). Esforço baixo (`library.js` + markup do drawer).
- **Tema por campanha — 1º caso: Much+** *(agrado estético pra diretoria — ideia de futuro)* — o **Much+ é o serviço de assinatura/clube da Delivery Much**. A ideia: ao abrir uma campanha do Much+ (ex.: "Mais Benefícios"), o Luma **se transforma num "ambiente Much+"** — paleta, logo, tipografia e acento do Much+ substituem os do Luma, com uma **transição de entrada** ("nossa, entrei em outro mundo"), revertendo ao sair pra home. É o tipo de detalhe que encanta a diretoria e reforça imersão de marca quando o franqueado promove o clube.
  - **Como fazer (altitude — generalizar, não cravar "Much+"):** modelar como **`tema` na campanha/pasta** (ex.: `tema:'muchplus'`), não um `if muchplus` solto — assim qualquer campanha futura pode carregar tema próprio. Mecânica: uma classe no `body` (ex.: `body.theme-muchplus`) que **sobrescreve os tokens de marca** (`--dm-orange`, acento, `--logo-h-*`) — a fundação já existe (`dTheme` + tokens de `00-tokens.css`). Gatilho em `fSelectCamp` (aplica) e `fGoHome` (remove); transição via tokens de motion.
  - **Depende de:** assets de marca do Much+ (logo SVG/PNG + paleta) que o Ryan fornece — como as capas da Copa; e a campanha "Mais Benefícios" **ainda não existe** no `js/00-config.js`. Esforço baixo-médio se escopado a troca-de-tokens + logo + transição.
- **Refazer a tela de login** (`#g-login-screen`, `index.html:167-234`) — visual mais premium, aguardando referências do Ryan. Preservar intacto o contrato do `auth.js`: `gDoLogin`/`gDoForgot`/`gShowLoginView`/`gShowForgotView`/`gTogglePass` + IDs `gl-email`/`gl-pass`/`gl-error`/`gl-btn-login` (+ `gf-*`). Oportunidade: migrar os `style=""` inline com hex cravado (`#FF9000`, `#e53e3e`, `#38a169`) pra tokens + classe CSS. Esforço médio (só front).

### Brainstorm de 2026-07-30 (IA pra matar tarefa repetitiva) — **implementado**

*Pergunta do Ryan: onde a IA tira trabalho repetitivo do Luma (Sheets e outros processos). Crivo aplicado: só toil real, IA **auxiliar** (`00_PRODUCT` §9), zero dependência nova, e nada de reciclar o que foi descartado em 18/07.*

**Feito (commits `fc36ae4`, `13279fe`, `28a93e2`):**

- **0. Tubulação** — Edge Function `supabase/functions/ai` (chave fora do front, rate-limit, allowlist de tarefa) + `js/core/ai.js` como motor único. Detalhe e **passos pendentes do Pedro** (secret + deploy + rotação da chave) no `docs/LUMA-BACKEND-CHANGELOG.md` (2026-07-30). ⚠ Enquanto não subir, roda pelo caminho de transição com a chave do front — **não é estado final**.
- **1. Encaixar no limite** (`maxLen`) — a tarefa repetitiva mais frequente do fluxo: o input corta o texto e o franqueado abrevia na mão. Guarda a tentativa completa antes do corte e oferece 3 versões que cabem, validadas no código.
- **2. Ajuda aterrada** — `gHelpKnowledge` (em `core/help.js`) achata a Central + FAQ do Sheets e manda só o que casa; sem material, o widget **não chama** o modelo.
- **3. Ler cardápio** (foto/PDF/texto) no Sheets — mata o "digitar 30 linhas do cardápio que o lojista mandou no WhatsApp" e aposenta o paliativo "copie este prompt no ChatGPT". Linha entra com chip IA e revisão obrigatória (preço errado é dano real).
- **4. Legenda séria** — prompt com fato-que-existe, ângulo por opção, story x feed; emoji removido no código; selo de origem passou a dizer a verdade (dizia "Gerado por IA" sempre).
- **5. Casar fotos com as linhas** — nome de arquivo primeiro (local), visão só nas sobras, em uma chamada.

- **6. Luma CLI** *(pedido do Ryan na mesma sessão)* — console do time (`Ctrl+\``, só `gIsAdmin()`): `diag`, `sync`, `pastas`, `cache` + conversa com a IA no próprio terminal, com banner em pixel art e os dois temas. Nasceu pra matar o "snippet colado no DevTools" do diagnóstico de sync. Detalhe no `docs/LUMA.md` §12.2. **Descartado no caminho:** terminal de shell de verdade — a casca desktop é burra de propósito (`contextIsolation`, carrega a URL de produção) e dar shell a ela troca um .exe inofensivo por superfície de ataque.

**Fora, com motivo:**
- **Sinal de demanda destilado** (IA agrupando o que a rede buscou e não tinha) — depende do **backbone de eventos**, que não existe ainda. Entra junto dele.
- **Gerar arte/imagem por IA** — fere "zero peça fora da marca"; o valor do Luma é o trilho. ⚠ Não confundir com o **"Mapear com IA"** do importador (2026-08-05): lá a IA **lê** a arte que o designer fez (entrada de imagem do Gemini) pra sugerir camada→campo, e só sugere. Ler a arte é permitido; **gerar** arte continua fora.
- **IA que publica** — invariante: o Luma não envia (postar é manual).
- ~~**Triagem de PSD** (sugerir camada→`{{campo}}`) — roça no "copiloto de template" descartado em 18/07. Só se o Ryan reabrir.~~ → **Reaberto e feito pelo Ryan (2026-08-05)**, sem IA nenhuma: o motor de sugestão já existia no parse, faltava a tela. Ver §9 (P1).

**Precisa de estudo antes de comprometer:**

- **CRM Visual (módulo 3)** — inapp/push dos mesmos templates → CleverTap, com Brand Guardian antes de subir (hoje montado à mão no ChatGPT + CleverTap). É o maior salto de valor e já está na Visão (§`00_PRODUCT` §4). **Decisão do Ryan (2026-07-18): desenhar o módulo e estimar retorno vs. dificuldade ANTES de comprometer** — é o mais caro de todos. Pré-requisito inegociável: mapear os formatos que o CleverTap aceita.
- **Indicadores por material** (dentro da pasta, gestão/designer) — downloads + variação % no período. Depende do mesmo backbone de eventos acima e **esbarra na decisão de 2026-07-15** de tirar analytics do app — exceção pontual a reabrir. Fica junto do backbone.

**Descartadas nesta sessão (com motivo, pra não voltar):**

- **Kit "Novo Parceiro"** — cadastro de restaurante vive na plataforma da DM, não no Luma. Premissa furada.
- **Vitrine "Top da cidade" / rota gastronômica** — o Luma Sheets já cobre volume; a experiência da ferramenta antiga mostra que franqueado não usa geração em lote rica.
- **Baixar em todos os formatos num clique (auto-resize)** — feed e story são layouts feitos à mão separados; auto-redimensionar sairia ruim. (Salvou-se só o "par vinculado" acima, que mantém os layouts artesanais.)
- **Realce automático de foto do produto** (remove fundo/ajuste) — Ryan: não é necessário agora.
- **Copiloto de template pro designer (IA que scaffolda camadas/campos)** — Ryan: não é necessário agora.
- **Brand Guardian leve** — morre no multi-KV: campanhas com key-visuals diferentes fariam o guardião apontar "erro" onde é proposital.
- **Última milha da legenda** (copiar legenda + baixar arte num gesto) — só depois de o **motor de copy estar sólido**; hoje ainda não está no ponto pra construir em cima.

---

## 10. Priorização e dificuldade (visão rápida — Claude, 2026-07-18)

*Minha recomendação de ordem de ataque rumo ao "1.0 sólido" (§1). Prioridade = quanto trava a definição-de-pronto; Dificuldade = esforço/risco de código. Dep.: **[P]** Pedro/backend · **[N]** navegador · **[S]** solo (código só). O Ryan bate o martelo final.*

| # | Item | Prioridade | Dificuldade | Dep. |
|---|------|:---:|:---:|:---:|
| A1 | Aplicar SQL `w/h/bg` (sync de templates parado desde 11/07) | 🔴 Crítica | Fácil | [P] |
| C1–C3 | Catálogo fora do hardcode: UI de campanha (criar/arquivar/badge/perguntas) + flip da fonte + aposentar `CAMPS_*` | 🔴 Alta | Difícil | [P][N] |
| B1–B3 | Sync: resíduos de `_syncPending` (edição só-de-pasta) + distinguir sem-rede/deslogado | 🔴 Alta | Médio | [P][N] |
| CR | Integrar o documento **Luma Code Review** (~1.100 linhas) — triar real vs falso-positivo | 🔴 Alta | Médio | Ryan traz |
| E4/G3 | Verificação final nas 3 roles + gate visual da UI 1.0 | 🔴 Alta | Médio | [N] |
| TOOLS | Refinar ferramentas de design uma a uma (moldura de seleção + caixa de texto primeiro) | 🟠 Média-Alta | Difícil | [N] |
| D1 | Editor: foto de moldura no undo + `dAlign` de grupo (NaN) | 🟠 Média | Fácil | [S] |
| D2 | ~10 `confirm()` nativos → `gConfirm` | 🟠 Média | Médio | [S] |
| D3 | Limite de tamanho no upload de imagem | 🟠 Média | Fácil | [S] |
| G1 | Varredura de emoji→SVG + tokenização de cor + auditor `ui-audit.html` | 🟠 Média | Médio | [S] |
| G2 | Redesigns de tela (Perfil, Ajuda, **Login+Splash**, Sheets, empty-states) | 🟠 Média | Difícil | [N] |
| F1 | PSD: camadas de ajuste (cor diverge) — aplicar ou avisar | 🟠 Média | Médio | [S][N] |
| C4 | Grupos de visibilidade: aplicar ou remover da UI | 🟡 Baixa | Fácil | decisão |
| E1 | Linter: regra 5 morta (`l.url`→`l.imgUrl`) | 🟡 Baixa | Fácil | [S] |
| E2 | Limpar `fLoadLogoBranca` morto + `__luma_session` órfão | 🟡 Baixa | Fácil | [S] |
| E3 | Docs em dia (`LUMA.md`, changelog, roadmap) | 🟡 Baixa | Fácil | [S] |
| F2/F3 | PSD: path vetorial + pattern/badges | 🟡 Baixa | Médio | [S] |
| SLIDE | One-pager/slide "o que falta pro 1.0" pra diretoria | 🟡 Baixa | Fácil | [S] |

**Pós-1.0 (features, não entram no corte):** Calendário nacional que empurra campanha · par vinculado feed↔story↔WhatsApp · backbone de eventos (→ "mais usados da rede" + "sinal de demanda") · repostar do histórico · painel Mídias/Marca · **tema por campanha (Much+)** · *(estudar antes)* CRM Visual, indicadores por material.

**Ganhos rápidos "solo" (posso fechar sem navegador nem Pedro):** E1, E2, D1, D3 — depois D2 e G1.

---

## Controle do produto (feature flags) — entregue 2026-08-01

Área exclusiva da `gestao` no painel da conta: liga e desliga **32 recursos reais** sem editar código e sem deploy. Motor em `js/core/feature-flags.js`, tela em `js/core/product-control.js`. Detalhe e matriz de cobertura em `docs/LUMA.md` §22; backend no changelog.

Isto move a agulha do **item 2 da definição de v1** ("o designer opera o catálogo inteiro sem tocar em código"): a gestão passa a operar a *disponibilidade* do produto inteiro pela UI.

- [x] Migration `20260731190000_luma_feature_flags.sql` (2 tabelas, trigger de auditoria, RLS, seed de 32 chaves)
- [x] Motor: registro, cache offline-first, sync, cascata pai/filho, overrides por role, evento global, fallback fail-open
- [x] Tela: busca, filtros, árvore hierárquica, confirmação com impacto e motivo, histórico, a11y, 2 temas, responsivo
- [x] Integração: gate de módulo + fallback de navegação · guard central em `dSetTool` · funis de criação, import, publicação, exportação, ajuda e tutoriais
- [x] **Texto vertical desligável** — criação bloqueada por todos os caminhos; render/preview/export/edição de conteúdo existente verificados idênticos no navegador
- [ ] 🔴 **Aplicar a migration** — o SQL está versionado e **não foi aplicado** (sem acesso ao Supabase na entrega). Conferir com o `SELECT` do rodapé do arquivo. *(Mesma lição do incidente 2026-07-16: migration só está pronta quando APLICADA.)*
- [ ] Testar as 3 roles contra o banco real depois de aplicar (o front foi verificado com role simulada)

**Fase posterior (declarado, não abandonado):** granularidade por ferramenta individual dentro dos grupos Formas/Pintura/Preenchimento/Efeitos/Medição · flags por curso/aula da Academia · guard programático em `dSvgImport`/`dImportPSD` além do funil.

---

## 10. Performance & tráfego de dados (backlog técnico — não bloqueia v1)

> Contexto: o app roda no navegador (inclusive web mobile) falando direto com o Supabase.
> O gargalo histórico era **egress** (base64 gigante no catálogo). Resolvido em jul/2026
> com o "catálogo leve" (layers sob demanda) + push que não grava base64. O que resta
> aqui é otimização de margem, não incêndio.

**Anotado em 2026-07-16 (upload de imagem — decidido NÃO mexer agora):**
- [ ] **Teto de upload alto demais p/ o público**: chat aceita até 20 MB (`js/franqueado/chat.js:422`). A foto é redimensionada p/ 1500px + JPEG 0.88 (pica) ANTES de trafegar — o resultado é leve (~200–500 KB), mas os 20 MB brutos viram ~27 MB de base64 em memória no meio do caminho: risco de travar aba de celular modesto no 4G. Baixar p/ ~12 MB (1 caractere) cobre qualquer foto de celular.
- [ ] **Uploads do Luma Sheets escapam do resize**: `png-generator.js:2659` (perfil) e `fBulkHandleLocalImage` validam 20 MB mas NÃO passam por `fResizeImageIfNeeded`. Num lote de 30 produtos, 30 imagens grandes vão inteiras. Rotear pelo mesmo resize de 1500px.
- [ ] **WebP no encode** (era o item "compressão/WebP"): trocar `toDataURL('image/jpeg',0.88)` por WebP (~30% menor na mesma qualidade) com fallback JPEG p/ navegador antigo. Corta storage e egress de uma vez.
- [ ] **Limpeza de uploads órfãos** em `luma-user-uploads`: foto de arte que saiu do histórico (cap 50) fica no bucket p/ sempre — job de limpeza.
- [ ] **Delta-sync por `updated_at` no designer**: hoje o boot do designer re-baixa metadados do catálogo inteiro (leve, mas O(catálogo)). Evoluir p/ baixar só o que mudou.

**Nota de capacidade (70+ franqueados simultâneos — avaliado em 2026-07-16):** o Supabase Pro
aguenta com folga. Ver a análise no `docs/LUMA.md` (seção de capacidade) ou o resumo: o uso é
espasmódico (não streaming), o CDN serve as imagens fora do Postgres, e o pico realista de
70 pessoas gerando arte fica em dezenas de requests concorrentes — muito abaixo do limite da
instância. Só reavaliar em 300+ franqueados ativos (aí: paginação de catálogo + connection pooling).

---

## Ver também

- `00_PRODUCT.md` §9 (o que o Luma NÃO faz) — o guarda-costas deste roadmap.
- `06_OPERATING_SYSTEM.md` — como trabalhar cada item (ler → planejar → patch cirúrgico → navegador).
- Relatórios completos da auditoria: nos transcripts da sessão de 2026-07-15 (bugs com `arquivo:linha` acima são o resumo acionável).
