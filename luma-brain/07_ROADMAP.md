# 07 — ROADMAP · O caminho até a v1

> O plano oficial do Luma até uma **v1 sólida**. Nasceu de uma auditoria completa do código
> (jul/2026): três varreduras — franqueado, designer+core, dados/backend — com bugs confirmados
> em `arquivo:linha`, cruzadas com o `luma-brain/` e o `docs/LUMA.md`.
> **Critério de corte:** só entra o que serve à missão (arte em <1min, zero peça fora da marca,
> autonomia da ponta). Nada de inventar por inventar.
> Última revisão: 2026-07-15. Dono: Ryan. Atualize os checkboxes conforme avança.

---

## 1. O que é a v1 (definição de pronto)

A v1 existe quando estas 5 frases forem verdade **sem asterisco**:

1. **Um franqueado real usa o Luma na rotina sem suporte** — abre, gera, baixa, posta. Erros têm mensagem; nenhum clique "morre" em silêncio.
2. **O designer opera o catálogo inteiro sem tocar em código** — criar campanha, publicar, expirar, agendar: tudo pela UI, nada exige deploy.
3. **Nenhum trabalho se perde** — nem do designer (sync), nem do franqueado (histórico), nem por falta de commit.
4. **Nada no app mente** — o que é demo está rotulado ou removido; "Salvo na nuvem" só aparece quando salvou na nuvem.
5. **Zero XSS conhecido, RLS validada nas 3 roles**, backup rodando.

O que **não** é v1 (fronteiras conscientes, ver `00_PRODUCT.md` §9): CRM Visual/CleverTap, multi-tenant por cidade, agendador de posts, legendas por IA de verdade. **Dashboard de analytics no app deixou de ser roadmap: o módulo Dados será retirado** (decisão 2026-07-15) — analytics é por extração SQL, como a arquitetura já definia.

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

## 4. Fase 1 — Confiança no dado (o designer não pode perder trabalho)

*A promessa "um template, muitas cidades" morre se o template evapora. ~1–2 semanas.*

**Sync do designer (`js/designer/layers.js`) — P0:**
- [ ] `_dPushFoldersNow` early-return sem backend/admin **não marca `_syncPending`** (`layers.js:2817`) → edição offline é descartada pelo pull do boot ("banco manda", `layers.js:2955`). Marcar pendência sempre que o push não rodar.
- [ ] Exceção no meio do push cai em catch silencioso e os templates não visitados ficam sem `_syncPending` (`layers.js:2860`).
- [ ] Debounce de 1,2s + `dDirty` zerado na hora (`publish.js:532`) = fechar a aba logo após salvar perde o push sem acionar o `beforeunload`. Flush do push pendente no `beforeunload`.
- [ ] Push concorrente sem lock (badge chama `_dPushFoldersNow()` direto, `layers.js:2881`) e upsert last-write-wins sem versão — mínimo p/ v1: lock simples + `updated_at` com aviso de conflito.
- [ ] Boot race: pull substitui `dFolders` e o template aberto com id local fica órfão — `dSave` grava em lugar nenhum (`layers.js:2717`).
- [ ] Deleções fire-and-forget que "ressuscitam" itens se falharem (`templates.js:736-744`, `layers.js:2038`, `fonts.js:82`, `library.js:233,491`) — fila de deleção pendente.
- [ ] `_dUuid` fallback não gera UUID válido (`layers.js:2814`) → upsert falha pra sempre em silêncio.
- [ ] Indicador "Salvo na nuvem" mente em modo local (`publish.js:531`) — só mostrar quando o push confirmou.

**Histórico do franqueado (`js/franqueado/history.js`) — P0:**
- [ ] `fPushArtesToBackend` regrava o localStorage com snapshot velho após `await`s — arte criada durante o push é perdida (`history.js:40-70`). Reler antes de gravar + lock.
- [ ] `fSaveHist` dispara push sem `.catch()` (`history.js:19`).
- [ ] Sync grava `template_id: null` e devolve `materialId: null` (`history.js:61,83`) — "Editar" em outro device perde o vínculo com o material. Persistir o template_id.
- [ ] `_sig` guarda `JSON.stringify(dados)` com base64 de fotos dentro (`history.js:112`) — acelera estouro de quota.

**Segurança (XSS residual) — P0:**
- [ ] Linter do designer: `layerName`/`desc` em `innerHTML` sem escape (`js/designer/linter.js:157-160`) — nome de camada vindo de PSD/banco executa script ao abrir o painel ou o checklist de publicação.
- [ ] Hero da home: `cover` interpolado cru em `style` (`catalog.js:696-698`); `campColor` no histórico (`catalog.js:99`); `label` de campo sem `gEsc` em `fEditFromHist` (`catalog.js:192,228`); escape parcial em `publish.js:249`; `cover`/`color` crus em `templates.js:624-625`.
- [ ] Auth: `gLoadProfile` engole erro e rebaixa gestor a `franqueado` em silêncio (`auth.js:56-64`); `ativo:false` não é lido no front; `gDoLogin` sem try/catch trava o botão em "Autenticando…" (`auth.js:179`).

## 5. Fase 2 — Catálogo 100% real (autonomia do designer)

*O maior gap estrutural de produto. ~2 semanas.*

- [ ] **Campanhas saem do hardcode**: hoje `CAMPS_ATIVAS/OUTRAS/IMPLEMENTACAO` (`js/00-config.js:14-145`) são a fonte da lista e `dFolders` só fornece capa/templates (`catalog.js:460-463`). Migrar a fonte para `luma.pastas` (as colunas — badge, popular, agendamento, cor — já existem no banco). Criar/arquivar campanha vira ação da UI do designer. `CAMPS_*` vira só seed de primeira instalação.
- [ ] **Matar a re-injeção de mocks**: `dPreloadFolders` re-injeta templates fake em pasta vazia cujo nome/campId coincida (`templates.js:211-242`) — pasta real esvaziada de propósito ganha material inventado de volta. Isso viola diretamente "zero peça fora da marca".
- [ ] **Perfil real**: conectar "Alterar senha" ao `gResetPassword` que já existe (`auth.js:109`); hoje é `setTimeout` fake (`user-profile.js:193-236,325-336`). Decidir destino de telefone/foto (localStorage-only hoje; `profiles.avatar_url` existe no banco e nunca foi usada).
- [ ] Grupos de visibilidade e `agendamento`/`grupos` de pasta: ou aplicar de verdade (franqueado já respeita agendamento; falta o resto) ou remover da UI.
- [ ] Validade com fuso: `new Date('YYYY-MM-DD')` exibe um dia a menos (`materials.js:169`; a linha 166 já faz certo com `T23:59:59`).

## 6. Fase 3 — Nenhum clique morre em silêncio (confiabilidade da ponta)

*Bugs que sabotam o "franqueado sem suporte". ~1 semana.*

- [ ] `fDownloadHist` e `fConfirmDuplicate`: `await fGenPNG` sem catch — falha de render = nada acontece, sem toast (`catalog.js:121-144,276-299`). Tratar como o `fBaixar` já trata (`chat.js:1078`).
- [ ] `fOutroFormato` muta `fState.fmt` antes de gerar e não restaura no erro (`chat.js:963-1034`).
- [ ] "Pular" campo opcional grava `''` e a prévia acusa "Falta preencher" pra sempre (`chat-input.js:316` + `live-preview.js:816`) — distinguir "pulado" de "esquecido".
- [ ] Sheets: linhas com erro são excluídas do ZIP sem aviso (`png-generator.js:1782-1786`) — reportar "N geradas, M puladas".
- [ ] Kit da campanha: dedup de nome no ZIP (dois materiais com mesmo nome se sobrescrevem, `materials.js:62` — mesma correção que o bulk já tem em `png-generator.js:1829`) + barra de progresso.
- [ ] Live preview: chamada com assinatura errada de `fRenderCanvasHelper` deixa um branch morto (`live-preview.js:214-217`); hit-testing ignora reflow em template legado (`live-preview.js:631`); `fIsImageVar` testa `varName` em vez de `imgVar` (`png-generator.js:2448`).
- [ ] Loading ao trocar material/editar do histórico (`fEnsureMaterialLayers` é fetch de rede sem spinner).
- [ ] Editor: Ctrl+Z sequestrado dentro de inputs (`publish.js:660-674`); mover com setas e trocar foto de moldura fora do undo (`publish.js:914`, `canvas.js:1075`); `dToggleLock`/`dSwapColors` duplicadas se sobrescrevendo (`library.js:451`, `tools.js:185`); `dAlign` de grupo grava `NaN` (`layers.js:526-534`).
- [ ] Trocar `confirm()`/emoji-em-toast pelos padrões da casa (`gConfirm` já existe; ícone = SVG): `templates.js:1140`, `publish.js:418`, toasts do Sheets. (Os emojis do módulo Dados morrem junto com a retirada dele — Fase 4.)
- [ ] Upload de imagem de moldura/biblioteca sem limite de tamanho (`canvas.js:1071`, `library.js:134`) — validar como fontes/PSD já validam.

## 7. Fase 4 — Operação honesta e corte da v1

*Fechar o que a gestão precisa e assumir o que não vai. ~1 semana.*

- [ ] **RETIRAR o módulo Dados** (decisão 2026-07-15): remover `js/dados/` (10 arquivos, ~2.500 linhas), `css/modules/dados.css` (1.862 linhas), `#view-dados` e os `<script>` de `dados/*` do `index.html`, a pill "Dados" do seletor de modos e o `pInit`/gates em `main.js` + `auth.js`. Atualizar `LUMA.md` §11 e `02_ARCHITECTURE.md` (módulo 3 deixa de existir no front). ⚠ O que **fica**: `analytics.fct_eventos`, `gTrackEvent` e as views `vw_*` — analytics segue por extração SQL (gestão/BI), sem front.
- [ ] **Analytics utilizável (backend, independe do módulo retirado)**: emitir os eventos que faltam (`template_publicado`, `campanha_aberta`, `material_aberto` — previstos na migration, nunca emitidos) e documentar que as views se consultam via SQL Editor/service_role (com RLS dono-only em `luma.artes`, designer autenticado vê ~nada — comportamento esperado, não bug).
- [ ] Linter unificado: `dPublishRender` reimplementa as regras em vez de reusar `dRunLinter` (`publish.js:149-184`); regra 5 morta (`l.url` → `l.imgUrl`, `linter.js:115`).
- [ ] Limpeza: `rich-tooltips.js` sem `<script>` (morto), no-ops de multi-prancheta, `fDrawDMLogo`/`fLoadLogoBranca` mortos, `__luma_session` órfão.
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
