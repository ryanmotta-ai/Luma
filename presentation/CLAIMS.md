# Afirmações, números e fontes

> Regra do deck: todo número vem do código, de um teste, de um commit ou de uma fonte de negócio
> validada. Se não tem linha aqui, não entra na tela nem na fala. Contagens de 27/09/2026, commit `0549b67`.

## Números da tela

| Onde | Afirmação | Fonte (como conferir) |
|---|---|---|
| 11 · E | **844** verificações automáticas em **22** suítes, num navegador de verdade | `node scripts/run-browser-tests.js` (execução local de 27/09/2026): 22 suítes, 838/844 |
| 11 · E | **300** artes geradas e conferidas pelo motor real, em 5 baterias de 60 | suítes `artes-composicao-grafica`, `artes-fluxo-interativo`, `artes-gastronomia`, `artes-multiformatos`, `artes-tipografia-fit` (60 cada) |
| 11 · E | **60** artes pelo fluxo completo do franqueado no app real | suíte `artes-fluxo-interativo` (60/60) |
| 11 · E | **31** cenários de estresse: fluxo, tela de iPhone, maratona de fuzz | `stress-franqueado-fluxo` 9 + `stress-franqueado-ios` 9 + `stress-fuzz-maratona` 13 |
| 11 · C · E | **73** casos de regressão no importador de PSD | suíte `psd-import` (73/73), `tests/psd-import.html` |
| 11 · E | O CI roda **a cada push**: leis da arquitetura, regra das Novidades e as suítes | `.github/workflows/tests.yml` (paths `js/`, `tests/`, `index.html`; passos `scripts/arquitetura.js`, `scripts/novidades.js --checar`, `scripts/run-browser-tests.js`) |
| 11 · B | **32 de 32** tabelas com RLS, **3** papéis, **69** políticas | contagem em `supabase/migrations/` em 27/09/2026; papéis em `luma-brain/01_BUSINESS.md` §2 |
| 11 · H | **41** recursos que a gestão liga e desliga sem deploy | entradas de `G_FEATURE_REGISTRY` em `js/core/feature-flags.js` (`grep -c "{ key:'"` = 41) |
| E | Estado de 27/09: **838 verdes**, 5 casos vermelhos no Copy Fit, 1 no corpus | mesma execução: `copy-fit` 34/37, `copy-fit-ui` 34/36, `corpus` 29/30 |
| E | CI **vermelho** no portão de arquitetura: catraca de localStorage de 56 para 59 | `node scripts/arquitetura.js` e as execuções do workflow `tests.yml` no GitHub |
| E | Totais por grupo (240, 60, 186, 114, 87, 73, 53, 31) | soma das suítes da mesma execução (ex.: 186 = `local-fit` 75 + `corpus` 30 + `fuzz` 63 + `auto-layout` 14 + `local-fit-studio` 4) |
| 05 | **13** camadas, **5** campos preparados, **3** pontos de atenção, fidelidade visual **90%**, fonte "Gotham-Black" ausente | tela real do importador (`captures/estudio-psd-revisao.webp`), rodando sobre o PSD de demonstração |
| 04 | Template com **5** campos | tela real do Estúdio (`captures/estudio-campos.webp`, "5 campos configurados") |
| 06 | Publicação em **3** etapas: qualidade, configuração, revisão; erro crítico não publica | `js/designer/publish.js` (etapas e checklist), `js/designer/linter.js`; telas `captures/estudio-publicar-*.webp` |
| 07 | **5** perguntas; cada quadro vem do motor de render | roteiro do template de demonstração; quadros gerados por `fRenderCanvasHelper` (`assets/artes/chat-passo-1…5.webp`) |
| 08 | O Encurtar é determinístico, **<1 ms**, sem rede e sem IA; números nunca somem | cabeçalho de `js/core/copy-fit.js` (garantias cobradas por `tests/copy-fit.html`) |
| 09 | **15** artes · **4** campanhas · **2** formatos; **6** ofertas viram um ZIP | `assets/artes/lote-00…14.webp`, geradas pelo Luma Sheets; tela `captures/franqueado-sheets.webp` |
| 10 | No máximo **1** edição de Novidades por semana | regras editoriais no cabeçalho de `js/widgets/novidades.js`, cobradas por `scripts/novidades.js --checar` |
| A | **3** Edge Functions: IA, convite e Telegram | `supabase/functions/`: `ai`, `invite-user`, `suporte-telegram` |
| B | Conta desativada perde o poder no banco desde **23/09** | `docs/LUMA-BACKEND-CHANGELOG.md`, entrada "2026-09-23 — Ataque simulado pela API + conta desativada perde o poder no banco" |
| B | Um gatilho impede autopromoção | `docs/LUMA-BACKEND-CHANGELOG.md` (guard anti-auto-promoção, testado via API) |
| G | Fila de saída varrida **a cada minuto**, com nova tentativa quando falha | `supabase/migrations/20260926130000_luma_suporte_telegram.sql` (`cron.schedule(... '* * * * *' ...)`, coluna `tentativas`) |
| G | Construído em **26/09**, com aprovação do jurídico; chave nasceu desligada | `docs/SUPORTE-TELEGRAM.md` ("Decidido e construído"); `global.help.suporte.telegram` com `defaultEnabled:false` |
| G | `/disponivel` põe a pessoa online por **8 horas** | `docs/SUPORTE-TELEGRAM.md` |
| H | A mensagem da cascata: *Indisponível porque "Suporte ao vivo" está desativado* | `gFeatureReason()` em `js/core/feature-flags.js`; pais reais de cada chave no registro |

## Afirmações sem número

| Onde | Afirmação | Fonte |
|---|---|---|
| 03 | "O designer continua decidindo o que é design. O franqueado informa apenas o que é local." | tese do produto (brief de 27/09) |
| 04 · A | Um motor por responsabilidade; o que o designer vê é o que o franqueado baixa | `luma-brain/MAPA.md` (motores únicos), `luma-brain/02_ARCHITECTURE.md` |
| 07 | A legenda sugerida sai do motor de legendas, local, sem IA | `js/franqueado/png-generator.js` ("Gera 3 legendas LOCALMENTE (zero rede, zero IA…)") |
| 10 | O convite de beta dentro das Novidades e o "Quero participar" | `js/widgets/novidades.js` (campo `beta`, evento `beta_interesse`), commit `0549b67` |
| 14 · K | Hoje o Luma atende uma rede só (sem multi-tenant) | `luma-brain/02_ARCHITECTURE.md` §12 |
| J | Calendário e Academia construídos, fora da V1; CRM Visual a estudar | `luma-brain/07_ROADMAP.md` §4–§7; Academia com `defaultEnabled:false` |

## O que é demonstração (e está dito nas notas)

- **Onde as telas foram tiradas:** uma cópia local do app (`scripts/versao.js HEAD`), com o Supabase
  desligado e sessão de demonstração. Nenhum dado de produção, token ou ID real aparece.
- **Templates:** montados importando, pelo importador de verdade, PSDs feitos a partir das capas de campanha
  que já estão no repositório (`assets/covers/`). As correções de designer (arredondar a pílula, a regra
  de esconder o "de") foram feitas no próprio Estúdio.
- **Fotos de produto:** quatro fotos do Unsplash (licença Unsplash), baixadas com autorização para a demo.
- **Persona:** "Carla", franqueada de demonstração.
- **Convite de beta (slide 10):** o recurso é real; o texto da captura foi escrito para a demonstração.
- **Calendário:** desligado na captura, porque não é V1.

## Retirado do deck antigo

Tudo abaixo estava em `Luma Apresentação do Produto (standalone).html` e ficou de fora de propósito.

| O que dizia | Por que saiu |
|---|---|
| "Import do Photoshop 1:1", "Camadas preservadas 1:1", "Importa 1:1" | Promete fidelidade total. O importador mede e mostra onde aproxima (slide 05, apêndice C). |
| "Tecnologia rara de converter PSD no navegador (3ª no mundo)" | Sem fonte verificável. |
| Assinatura de R$ 39,90/mês, "meta inicial 75% da base (64 de 96)", "+R$ 39.305/ano", cenário de R$ 89,90 | Cobrança do franqueado não é assunto deste deck, e os números não foram validados. |
| "Corte do Deskfy: + R$ 11,9 mil/ano", "só o corte do Deskfy paga a iniciativa" | Número financeiro não validado nesta revisão; e o deck não compara fornecedor. |
| Slide "Tração (Deskfy)", "96 franquias num único mês", "70 no Deskfy" | Métrica de outra ferramenta, sem fonte no Luma. |
| "Feito por duas pessoas, fora do orçamento" | Não é argumento de produto. |
| "Se os criadores se afastarem, estagiários assumem a frente sem drama" | Promessa sobre pessoas, não sobre o sistema. A manutenção é tratada pelas leis de arquitetura e pelo CI (apêndices A e E). |

Também ficaram de fora, por regra do brief (não apareciam no deck antigo): "zero bugs", "código perfeito",
"100% de fidelidade" e Calendário, Academia ou CRM apresentados como V1. Os três aparecem só no apêndice J,
com o estado real de cada um.
