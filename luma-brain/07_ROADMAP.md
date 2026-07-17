# 07 — ROADMAP · O caminho até a v1

> O plano oficial do Luma até uma **v1 sólida**. Nasceu de uma auditoria completa do código
> (jul/2026): três varreduras — franqueado, designer+core, dados/backend — com bugs confirmados
> em `arquivo:linha`, cruzadas com o `luma-brain/` e o `docs/LUMA.md`.
> **Critério de corte:** só entra o que serve à missão (arte em <1min, zero peça fora da marca,
> autonomia da ponta). Nada de inventar por inventar.
> Última revisão: 2026-07-16. Dono: Ryan. Atualize os checkboxes conforme avança.
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

---

## 3. Fase 0 — Estancar riscos (agora, antes de qualquer feature)

*Risco de perder trabalho ou embaraçar o projeto. Horas, não dias.*

- [x] **Commitar as ~850 linhas pendentes** — feito (commit `672c401` + refinos `82951f5`); `js/franqueado/prefs.js` já está versionado.
- [x] **Corrigir o 404 de todo boot** — link para `css/components/layers-panel.css` removido do `index.html` (commit `1a27177`).
- [x] **Remover `AUTH_USERS`** — array morto removido do `js/core/auth.js` (commit `5d6de18`).
- [ ] Conferir se o backup diário (GitHub Actions) segue verde. *(depende do painel do GitHub — Ryan)*
- [ ] 🔴 **Pedro aplicar o SQL das colunas `w/h/bg`** (`luma.templates`) — **sync de templates parado desde 11/07** (incidente 2026-07-16; SQL pronto no `docs/LUMA-BACKEND-CHANGELOG.md`). Depois: Ryan recarrega o Estúdio, clica no badge "não sincronizado" e confirma com o snippet de diagnóstico. **Lição de processo: migration só está pronta quando APLICADA e conferida com um select — versionar no repo não muda o banco.**

## 4. Fase 1 — Confiança no dado (o designer não pode perder trabalho)

*A promessa "um template, muitas cidades" morre se o template evapora. ~1–2 semanas.*

**Sync do designer (`js/designer/layers.js`) — P0:**
- [x] `_dUuid` fallback não gerava UUID válido → upsert falhava pra sempre fora de contexto seguro. Novo `gUuid()` em `00-config.js` (commit `21a0959`).
- [x] Indicador "Salvo na nuvem" mentia em modo local → "Salvo neste aparelho" (commit `18f5eed`).
- [ ] `_dPushFoldersNow` early-return sem backend/admin **não marca `_syncPending`** (`layers.js:2817`) → edição offline é descartada pelo pull do boot. ⚠ **navegador+backend**
- [ ] Exceção no meio do push cai em catch silencioso e os templates não visitados ficam sem `_syncPending` (`layers.js:2860`). *Parcial: erros de upsert/pull agora saem no `console.warn` (2026-07-16, pós-incidente) — falta marcar `_syncPending` nos não visitados.* ⚠ **navegador+backend**
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
- [ ] `gLoadProfile` engole erro e rebaixa gestor a `franqueado` em silêncio (`auth.js:44-52`). *Nota: falha para MENOS privilégio (a RLS ainda governa o dado), então é seguro — o problema é ser silencioso. Distinguir "sem rede" de "deslogado" precisa de teste com sessão real → deixado p/ verificação no navegador.*
- [ ] `ativo:false` não é lido no front (`gLoadProfile` não busca a coluna) — bloquear login de usuário desativado muda o fluxo de login e precisa de conta desativada real p/ testar → verificação no navegador.

> ⚠️ **As frentes de Sync e Histórico acima seguem abertas de propósito.** Elas mexem na
> camada que perde dados e só se validam com navegador + backend + (no sync) dois devices/abas.
> Corrigir "no escuro" arrisca introduzir a própria perda que se quer evitar. Fazer em par com
> o Ryan, uma de cada vez, verificando cada uma no navegador antes de seguir.

## 5. Fase 2 — Catálogo 100% real (autonomia do designer)

*O maior gap estrutural de produto. ~2 semanas.*

- [ ] **Campanhas saem do hardcode** (headline, arquitetural): hoje `CAMPS_ATIVAS/OUTRAS/IMPLEMENTACAO` (`js/00-config.js:14-145`) são a fonte da lista e `dFolders` só fornece capa/templates (`catalog.js:460-463`). Migrar a fonte para `luma.pastas` (colunas badge, popular, agendamento, cor, perguntas, previews já existem). Criar/arquivar campanha vira ação da UI do designer. `CAMPS_*` vira só seed de primeira instalação. ⚠ **precisa de backend + navegador + UI de criar campanha + decisões (ver plano na §5.1)**
- [x] **Matar a re-injeção de mocks**: agora só ocorre em modo demo (sem backend); com Supabase real, pasta vazia mostra "em breve" (commit `11399b9`). A migração acima remove o mock de vez.
- [x] **Perfil — alterar senha real**: ligado ao `gResetPassword` (commit `362d3d5`); era `setTimeout` fake. *(Destino de telefone/foto — hoje localStorage-only, `profiles.avatar_url` existe e é ociosa — fica p/ a fase de perfil cross-device; precisa de navegador.)*
- [ ] Grupos de visibilidade e `agendamento`/`grupos` de pasta: ou aplicar de verdade (franqueado já respeita agendamento; falta o resto) ou remover da UI. ⚠ **decisão + navegador**
- [x] Validade com fuso: corrigido — reusa o `v` local com `T23:59:59` (commit `ba2b12e`).

### 5.1. Plano da migração de campanhas (a executar em par, com o navegador)

*Por que faseado: é um flip de fonte de verdade tocada por ~20 pontos; feito no escuro, arrisca deixar o catálogo do franqueado vazio ou quebrado. Um passo por vez, verificando no navegador.*

1. **Costurar o seam (refactor sem mudar comportamento).** Rotear TODA leitura de `CAMPS_*` no franqueado (catalog/materials/chat/live-preview) por `fGetCampaigns()`/`fResolveCamp()`, que hoje já existem mas são ignorados. `fGetCampaigns` segue devolvendo as constantes. *Verificar: catálogo/home/chat idênticos ao de hoje.*
2. **Garantir que `luma.pastas` carrega todos os campos** que a UI lê (perguntas, badge, popular, previews, cor, expira_dias). O upsert já grava — confirmar que o pull (`_dRowToFolder`) devolve tudo e preencher o que faltar.
3. **UI de campanha no designer.** Criar/editar/arquivar pasta com esses campos (nome, cor, badge, perguntas, validade, agendamento, grupos). Boa parte do modal de pasta já existe — estender.
4. **Flip da fonte.** `fGetCampaigns()` passa a montar a lista a partir de `dFolders` (com `ativa`/arquivada), caindo em `CAMPS_*` só como seed na primeira instalação. *Verificar nas 2 personas: designer cria campanha → franqueado vê; designer arquiva → some.*
5. **Aposentar `CAMPS_*`** para seed-only e remover `dBuildMockLayersForCamp`/mocks. *Verificar: sem campanha fantasma, sem material fake.*

## 6. Fase 3 — Nenhum clique morre em silêncio (confiabilidade da ponta)

*Bugs que sabotam o "franqueado sem suporte". ~1 semana.*

- [x] `fDownloadHist` e `fConfirmDuplicate`: `await fGenPNG` sem catch — falha de render = nada acontece, sem toast (`catalog.js:121-144,276-299`). Tratado como o `fBaixar` (commit anterior à atualização do roadmap).
- [x] `fOutroFormato` muta `fState.fmt` antes de gerar e não restaura no erro (`chat.js:963-1034`). Restaurado no `catch` (commit `ad51493`).
- [x] "Pular" campo opcional grava `''` e a prévia acusa "Falta preencher" pra sempre (`chat-input.js:316` + `live-preview.js:816`) — marcador interno distingue "pulado" de "esquecido" (commit `f827894`).
- [x] Sheets: linhas com erro são excluídas do ZIP sem aviso (`png-generator.js:1782-1786`) — pré-voo, `erros.txt` e resumo final informam o que foi gerado ou pulado (commit anterior à atualização do roadmap).
- [x] Kit da campanha: dedup de nome no ZIP (dois materiais com mesmo nome se sobrescrevem, `materials.js:62` — mesma correção que o bulk já tem em `png-generator.js:1829`) + barra de progresso (commits `6931c90` e este pacote).
- [x] Live preview: chamada com assinatura errada de `fRenderCanvasHelper` deixa um branch morto (`live-preview.js:214-217`); hit-testing ignora reflow em template legado (`live-preview.js:631`); `fIsImageVar` testa `varName` em vez de `imgVar` (`png-generator.js:2448`). Corrigidos no commit `c362ba3`.
- [x] Loading ao trocar material/editar do histórico (`fEnsureMaterialLayers` é fetch de rede sem spinner). Card e botão mostram spinner e bloqueiam novo clique durante o fetch (este pacote).
- [ ] Editor: Ctrl+Z sequestrado dentro de inputs (`publish.js:660-674`); mover com setas e trocar foto de moldura fora do undo (`publish.js:914`, `canvas.js:1075`); `dToggleLock`/`dSwapColors` duplicadas se sobrescrevendo (`library.js:451`, `tools.js:185`); `dAlign` de grupo grava `NaN` (`layers.js:526-534`).
- [ ] Trocar os ~10 `confirm()` nativos restantes por `gConfirm` (`canvas.js:25`, `fonts.js:163`, `layers.js:2538`, `templates.js:411,444,947,1516,1527,1772,3032`) — cada um vira async e precisa da mesma análise de ordem de histórico do caso `dDeleteLayer` (auditoria do editor, 2026-07-15). Emoji-em-toast: varredura na trilha de UI (`docs/ROADMAP-UI-1.0.md` P1.1).
  > ⚠️ Falsos positivos já descartados na auditoria do editor — **não "corrigir"**: clique único NÃO cria duas camadas (o `dSetTool('select')` na criação é compensação intencional); colar camada NÃO perde vínculo `{{campo}}`; undo/redo restaura grupos corretamente.
- [ ] Upload de imagem de moldura/biblioteca sem limite de tamanho (`canvas.js:1071`, `library.js:134`) — validar como fontes/PSD já validam.

## 7. Fase 4 — Operação honesta e corte da v1

*Fechar o que a gestão precisa e assumir o que não vai. ~1 semana.*

- [x] **RETIRAR o módulo Dados** (decisão 2026-07-15): removidos `js/dados/`, `css/modules/dados.css`, `#view-dados`, scripts, pill e gates do modo. Docs atualizados. O que **fica**: `analytics.fct_eventos`, `gTrackEvent` e as views `vw_*` — analytics segue por extração SQL (gestão/BI), sem front.
- [x] **Analytics utilizável (backend, independe do módulo retirado)**: eventos do funil emitidos (`template_publicado`, `campanha_aberta`, `material_aberto` — commit `21ea6c8`); views consultam-se via SQL Editor/service_role (documentado no changelog).
- [ ] Linter unificado: `dPublishRender` reimplementa as regras em vez de reusar `dRunLinter` (`publish.js:149-184`); regra 5 morta (`l.url` → `l.imgUrl`, `linter.js:115`).
- [ ] Limpeza: ~~`rich-tooltips.js` sem `<script>` (morto)~~ (removido), no-ops de multi-prancheta (`dRenameAB` removido), `fDrawDMLogo`/`fLoadLogoBranca` mortos, `__luma_session` órfão.
- [ ] Docs em dia: `LUMA.md` (63 scripts, config versionado de propósito), changelog, e este roadmap com os checks.
- [ ] **Verificação final no navegador nas 3 roles** (franqueado, equipe_dm, gestao) — o checklist do `LUMA.md` §18.

## 8. Decisões abertas (negócio — precisam do Ryan/Pedro, com recomendação)

| # | Decisão | Recomendação |
|---|---|---|
| ~~1~~ | ~~Módulo Dados na v1~~ | ✅ **Decidido (2026-07-15): módulo será RETIRADO do Luma** (tarefa na Fase 4). Analytics segue por extração SQL |
| 2 | **Fotos do franqueado em bucket público** (`luma-user-uploads`): aceitar (viram arte pública) ou URLs assinadas? | Aceitar na v1, documentado — o PNG final é público por natureza |
| 3 | **Criar usuário pelo app** (Edge Function com service_role) ou seguir no Dashboard? | Dashboard na v1 (decisão de 2026-06-19 mantida); Edge Function na v1.1 |
| 4 | **Presets de permissões compartilhados** (tabela) ou localStorage por designer? | localStorage na v1 (1 designer ativo); tabela quando houver 2+ designers |
| 5 | **Legendas "IA"**: manter motor local (bom) ou plugar API? | Motor local na v1 — o stub `fFetchAICaptionSuggestions` fica pronto pra plugar depois |

## 9. Import PSD — melhorias mapeadas (backlog priorizado)

*Mapeamento de 2026-07 lendo `js/designer/psd-import.js` (1958 linhas). **Correção de rota:** a lista de "limitações" da `docs/LUMA.md` estava desatualizada — **multi-estilo de texto** (`_dPsdRichRuns`:462 → `it.runs`:898) e **gradiente linear/radial** (`_dPsdGradient`:445 → `it.gradient`:899,931) já funcionam ponta a ponta (parse + render em `png-generator.js`); smart object / rotação / warp já **rasterizam 1:1** (`_dPsdNeedsRaster`:789). O que sobra de real, por valor:*

**P1 — alto valor**

- [x] **Z-order confiável.** A heurística `_dPsdShouldInvert` (`psd-import.js:1208`) retornava `false` no caso "sem sinal claro", deixando pilhas sem fundo nomeado/grande com z-order TROCADO. Comprovado por round-trip do ag-psd (`writePsd`/`readPsd`): ag devolve base-primeiro, o parse faz `out.reverse` (:1069) → itens topo-primeiro, e o caso NORMAL precisa inverter de volta. O default virou `true` (inverter), preservando a exceção `firstIsBg` (PSD atípico) e o toggle manual. Verificado nos 4 casos: flat sem-sinal, fundo grande, grupo aninhado e a exceção atípica — todos com fundo em `dLayers[0]`.
- [ ] **Camadas de ajuste aplicadas (ou aviso honesto).** Levels/Curves/Hue afetam as camadas de baixo, mas o Luma não tem pipeline de ajuste → são dropadas (`_dPsdNeedsRaster`:792, contador `_dPsdAdjustCount`:811) e as cores divergem do PSD. Opção barata: usar o **composite** que o ag-psd já entrega pra rasterizar fiel a região afetada. Opção mínima: aviso na revisão dizendo **quais** camadas mudam de cor (hoje é só uma contagem). *Verificar: PSD com Curves sobre foto → cor final bate com o Photoshop, ou avisa claro.*

**P2 — valor médio**

- [ ] **Path vetorial complexo sem rasterizar.** Só rect/elipse viram shape editável e recolorável (`_dPsdVectorShapeKind`:243); path arbitrário cai em raster (`vectorMaskFailed`:849) e perde nitidez/recolor ao escalar. Importar como shape de path se o modelo do editor suportar; senão, subir a resolução do raster do vetor. *Verificar: logo vetorial importado continua nítido em 2×.*
- [ ] **Teto de raster adaptativo.** `_dPsdRasterURL` (`psd-import.js:283-296`) faz downscale default a 1600px; herói de PSD 4K perde detalhe (já há exceção p/ warp/smart em :280-282). Escalar o teto ao tamanho da prancheta alvo (Story 1080 ≠ PSD 4000). Peso extra absorvido pelo IndexedDB (`idb://`). *Verificar: foto grande não sai borrada no PNG final 2×.*

**P3 — polimento**

- [ ] **Pattern fill / patternOverlay** rasterizam (`_dPsdNeedsRaster`:793-795) — perdem tiling/recolor. Baixa prioridade (pouco comum em peça de promo).
- [ ] **Badges de revisão** já cobrem máscara/recorte simplificado (`vecWarn`/`clipWarn`:1334-1335); estender pro ajuste dropado com a lista de camadas afetadas.
- [x] **Doc desatualizada** (`docs/LUMA.md:367,517`): "1 estilo por camada / gradientes ignorados" era mentira — corrigido neste pacote.

## 9. Pós-v1 (estacionamento justificado — não encher a v1)

- **v1.1** — Edge Function de usuários; lojas salvas/favoritos cross-device (tabela de prefs); presets compartilhados.
- **v1.5** — import de cardápio real no Sheets (hoje é demo honesto); notificação de material novo cross-device; formulário de campos combinados no Kit da campanha.
- **v2** — **CRM Visual** (inapp/push → CleverTap; pré-requisito declarado: mapear formatos aceitos); legendas por IA real; catálogo por cidade (multi-tenant — decisão de arquitetura, não feature).
- **Contínuo** — fatiar `designer.css` (2.665 linhas) e reduzir os 604 `style=""` inline gerados por JS; testes de fumaça manuais documentados por release.

---

## Ver também

- `00_PRODUCT.md` §9 (o que o Luma NÃO faz) — o guarda-costas deste roadmap.
- `06_OPERATING_SYSTEM.md` — como trabalhar cada item (ler → planejar → patch cirúrgico → navegador).
- Relatórios completos da auditoria: nos transcripts da sessão de 2026-07-15 (bugs com `arquivo:linha` acima são o resumo acionável).
