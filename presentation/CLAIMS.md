# Afirmações, números e fontes

> Regra do deck: todo número vem do código, de um teste, de um commit ou de uma fonte de negócio
> validada. Se não tem linha aqui, não entra na tela nem na fala. Contagens de 27/09/2026, commit `0549b67`.

## Números da tela

| Onde | Afirmação | Fonte (como conferir) |
|---|---|---|
| 11 · E | **844** verificações automáticas em **22** suítes, num navegador de verdade | `node scripts/run-browser-tests.js` (execução local de 27/09/2026): 22 suítes, 838/844 |
| 11 · E | **300** artes geradas e conferidas pelo motor real, em 5 baterias de 60 | suítes `artes-composicao-grafica`, `artes-fluxo-interativo`, `artes-gastronomia`, `artes-multiformatos`, `artes-tipografia-fit` (60 cada) |
| E | **60** artes pelo fluxo completo do franqueado no app real | suíte `artes-fluxo-interativo` (60/60) |
| E | **31** cenários de estresse: fluxo, tela de iPhone, maratona de fuzz | `stress-franqueado-fluxo` 9 + `stress-franqueado-ios` 9 + `stress-fuzz-maratona` 13 |
| C · E | **73** casos de regressão no importador de PSD | suíte `psd-import` (73/73), `tests/psd-import.html` |
| 11 · E | O CI roda **a cada push**: leis da arquitetura, regra das Novidades e as suítes | `.github/workflows/tests.yml` (paths `js/`, `tests/`, `index.html`; passos `scripts/arquitetura.js`, `scripts/novidades.js --checar`, `scripts/run-browser-tests.js`) |
| 11 · B | **32 de 32** tabelas com RLS (no slide: **100%** das tabelas), **3** papéis, **69** políticas | contagem em `supabase/migrations/` em 27/09/2026; papéis em `luma-brain/01_BUSINESS.md` §2 |
| 11 · H | **41** recursos que a gestão liga e desliga sem deploy | entradas de `G_FEATURE_REGISTRY` em `js/core/feature-flags.js` (`grep -c "{ key:'"` = 41) |
| 15 · 16 | **3.297** redes de franquia, **202.444** unidades, **R$ 301,7 bi** faturados em 2025 | ABF, Pesquisa de Desempenho do Franchising 2025, divulgada em mar/2026 (abf.com.br/numeros-do-franchising; noticiada por PEGN, Exame e UOL) |
| 15 · 16 | Deskfy: **mais de R$ 10 mi** de receita recorrente anual, **200+** empresas | Jornal do Comércio, 17/07/2025: "Com faturamento de R$ 10 milhões, startup gaúcha agrega IA em plataforma de marketing para grandes empresas" (fala do fundador) |
| 15 · 16 | Creative automation: **US$ 2,18 bi** em 2025 (no slide, US$ 2,2 bi), **17%** ao ano até 2031 | Mordor Intelligence, "Creative Automation Software Market" (2026). Outras consultorias vão de US$ 2 a 7 bi; usado o menor |
| 16 | Cerca de **R$ 25 mi** por ano no franchising brasileiro, ao preço que a DM paga | conta nossa: R$ 11.903 ÷ 96 franqueados ≈ R$ 124 por unidade/ano × 202.444 unidades ≈ R$ 25,1 mi. Ordem de grandeza, não previsão |
| E | Estado de 27/09: **838 verdes**, 5 casos vermelhos no Copy Fit, 1 no corpus | mesma execução: `copy-fit` 34/37, `copy-fit-ui` 34/36, `corpus` 29/30 |
| E | CI **vermelho** no portão de arquitetura: catraca de localStorage de 56 para 59 | `node scripts/arquitetura.js` e as execuções do workflow `tests.yml` no GitHub |
| E | Totais por grupo (240, 60, 186, 114, 87, 73, 53, 31) | soma das suítes da mesma execução (ex.: 186 = `local-fit` 75 + `corpus` 30 + `fuzz` 63 + `auto-layout` 14 + `local-fit-studio` 4) |
| 05 | **13** camadas, **5** campos preparados (nas notas), **3** pontos de atenção, fidelidade visual **90%**, fonte "Gotham-Black" ausente | tela real do importador (`captures/estudio-psd-revisao.webp`), rodando sobre o PSD de demonstração |
| 04 | Template com **5** campos | tela real do Estúdio (`captures/estudio-campos.webp`, "5 campos configurados") |
| 06 | Publicação em **3** etapas: qualidade, configuração, revisão; erro crítico não publica | `js/designer/publish.js` (etapas e checklist), `js/designer/linter.js`; telas `captures/estudio-publicar-*.webp` |
| 07 | **5** perguntas; cada quadro vem do motor de render | roteiro do template de demonstração; quadros gerados por `fRenderCanvasHelper` (`assets/artes/chat-passo-1…5.webp`) |
| 08 | **107** ganchos (15 universais, 80 em **15** tipos de cardápio, 12 perguntas), **66** moldes de corpo (41 + 25 curtos), **25** chamadas, **76** hashtags | contagem dos arrays de `_COPY_BLOCKS` em `js/franqueado/png-generator.js` |
| 08 | **2.430** legendas diferentes na opção Promo para o Smash Bacon Duplo em promoção, sem contar as hashtags | a mesma escolha do `_fAssembleCopy`: 22 ganchos (lanches + universais) × 13 corpos "com desconto" = 286 pares, dos quais 243 cabem em 120 caracteres; × 10 chamadas de pedido |
| 08 | As quatro legendas da demonstração | saídas do `fBuildCopy` com sorteio fixo (`_fCopySetRandom`, semente 42), rodando o arquivo real fora do navegador: as 3 opções de uma arte e a Promo da arte seguinte |
| 09 | O Encurtar é determinístico, **<1 ms**, sem rede e sem IA (no card: "< 1 ms · sem IA"); números nunca somem | cabeçalho de `js/core/copy-fit.js` (garantias cobradas por `tests/copy-fit.html`) |
| 10 | **15** artes · **4** campanhas · **2** formatos; **6** ofertas viram um ZIP | `assets/artes/lote-00…14.webp`, geradas pelo Luma Sheets; tela `captures/franqueado-sheets.webp` |
| 13 | **R$ 0** por mês de infraestrutura | `luma-brain/02_ARCHITECTURE.md` (Supabase `uqrqzjafhigjuvtjqzid`, plano Free); front estático no GitHub Pages da `talpaipai`; Ryan, 27/09/2026. A IA (Gemini, cobrada por uso) fica fora da conta de infraestrutura |
| 13 | **94** franqueados | Ryan, 27/09/2026 ("hoje temos 94 franqueados") |
| 13 | Capacidade estimada de **1.500** conexões simultâneas no plano gratuito; **15×** a rede inteira | análise de capacidade de 22/09/2026 (limite de ~200 req/s do PostgREST no plano Free, estimativa de 1.500 a 3.000 usuários simultâneos; usado o piso). 1.500 ÷ 94 ≈ 16, arredondado para baixo. É estimativa, não teste de carga |
| 13b | **R$ 0** por mês de IA | Ryan, 30/09/2026: os modelos do Google rodam na cota gratuita de várias contas Google; as 5 reservas estão no plano gratuito (`supabase/functions/ai/index.ts`, `RESERVAS`). Obs.: a tabela de preço do painel Dados (`G_DADOS_IA_PRECO`) calcula como se fosse pago |
| 13b | **157** respostas de IA na semana de testes | `analytics.fct_eventos` (evento `ia_chamada`, `ok=true`, 23/09 a 30/09/2026): 122 Flash-Lite, 23 no 3.6 Flash, 5 NVIDIA, 7 outros |
| 13b | **5** reservas gratuitas, que entram juntas após **8 s** | `supabase/functions/ai/index.ts` (`RESERVAS`, `HEDGE_MS = 8_000`), função `ai` v23 |
| 13 | **R$ 11,9 mil** por ano de economia com o fim do Deskfy | Ryan, 27/09/2026: valor do deck anterior (slide "A demanda": "R$ 11,9 mil é o que sai todo ano pro Deskfy"; na conta do ano, R$ 11.903) |
| 13 | Supabase Pro a **cerca de R$ 140** por mês se abrir para milhares de lojistas | preço do plano Pro (US$ 25/mês), convertido; análise de 22/09/2026 |
| 12 | Suporte ao vivo no ar desde **23/09**; atendimento com estado e responsável desde 26/09 | `luma-brain/01_BUSINESS.md` §10; `js/core/suporte.js`; chave `global.help.suporte` ligada por padrão; migration `20260926120000` |
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
| 07 | A legenda do quadro final é a da tela real, palavra por palavra | `captures/franqueado-arte-pronta.webp` |
| 08 | Três leis: não inventa, não repete, não soa artificial | cabeçalho "MOTOR DE COPY COMBINATÓRIO v3 — Tom de Voz Delivery Much" em `js/franqueado/png-generator.js` |
| 08 | "Alimentado por anos de copy da Delivery Much" | Ryan, 27/09/2026 (o código registra "Tom de Voz Delivery Much" e "bancos curados") |
| 08 | No chat, a IA pode reescrever por cima; em lote e sem rede, quem escreve é o motor | `js/franqueado/chat.js`: a legenda do motor entra na hora e `fFetchAICaptionSuggestions` + `_fAplicarLegendaIA` trocam pela da IA quando ela responde; `AI_FEATURES.caption: true` em `js/00-config.js` (ligado em 23/09); o Luma Sheets chama `fBuildCopy` direto |
| 13 | A arte é desenhada no aparelho do franqueado; o servidor não gera pixel | `luma-brain/02_ARCHITECTURE.md` (render no navegador: `fRenderCanvasHelper`, `js/franqueado/png-generator.js`) |
| 12 | A Lu (assistente) responde com a Central de Ajuda e o estado da tela; passa para a equipe quando não sabe, quando é contrato/dinheiro/conta/erro sem solução, quando pedem gente ou após 2 "não ajudou". Pedido de gente não passa pela IA | função `ai` task `ajuda` (v23, `AJUDA_SISTEMA`); `gLuOferecerEquipe`/`gLuPedeHumano` em `js/core/suporte.js`; commits `7b1a23f`, `337564e` |
| 12 | Quem assume aparece com nome e cargo; a conversa reabre se o franqueado escrever de novo | `luma-brain/01_BUSINESS.md` §10; gatilho `suporte_msg_estado` |
| 15 · K | Hoje o Luma atende uma rede só (sem multi-tenant) | `luma-brain/02_ARCHITECTURE.md` §12 |
| J | Calendário e Academia construídos, fora da V1; CRM Visual a estudar | `luma-brain/07_ROADMAP.md` §4–§7; Academia com `defaultEnabled:false` |

## O que é demonstração (e está dito nas notas)

- **Onde as telas foram tiradas:** uma cópia local do app (`scripts/versao.js HEAD`), com o Supabase
  desligado e sessão de demonstração. Nenhum dado de produção, token ou ID real aparece.
- **Templates:** montados importando, pelo importador de verdade, PSDs feitos a partir das capas de campanha
  que já estão no repositório (`assets/covers/`). As correções de designer (arredondar a pílula, a regra
  de esconder o "de") foram feitas no próprio Estúdio.
- **Fotos de produto:** quatro fotos do Unsplash (licença Unsplash), baixadas com autorização para a demo.
- **Persona:** "Carla", franqueada de demonstração.
- **Conversa do suporte (slide 12):** a interface é a do widget de Ajuda, capturada na cópia local; a conversa entre
  a Carla e a atendente Ana Costa (as duas fictícias) foi montada para a demonstração.
- **Calendário:** desligado na captura, porque não é V1.

## Retirado do deck antigo

Tudo abaixo estava em `Luma Apresentação do Produto (standalone).html` e ficou de fora de propósito.

| O que dizia | Por que saiu |
|---|---|
| "Import do Photoshop 1:1", "Camadas preservadas 1:1", "Importa 1:1" | Promete fidelidade total. O importador mede e mostra onde aproxima (slide 05, apêndice C). |
| "Tecnologia rara de converter PSD no navegador (3ª no mundo)" | Sem fonte verificável. |
| Assinatura de R$ 39,90/mês, "meta inicial 75% da base (64 de 96)", "+R$ 39.305/ano", cenário de R$ 89,90 | Cobrança do franqueado não é assunto deste deck, e os números não foram validados. |
| "Só o corte do Deskfy paga a iniciativa" | Comparação que não entra. O valor em si (R$ 11,9 mil/ano) voltou no slide 13 por decisão do Ryan em 27/09. |
| Slide "Tração (Deskfy)", "96 franquias num único mês", "70 no Deskfy" | Métrica de outra ferramenta, sem fonte no Luma. |
| "Feito por duas pessoas, fora do orçamento" | Não é argumento de produto. |
| "Se os criadores se afastarem, estagiários assumem a frente sem drama" | Promessa sobre pessoas, não sobre o sistema. A manutenção é tratada pelas leis de arquitetura e pelo CI (apêndices A e E). |

Também ficaram de fora, por regra do brief (não apareciam no deck antigo): "zero bugs", "código perfeito",
"100% de fidelidade" e Calendário, Academia ou CRM apresentados como V1. Os três aparecem só no apêndice J,
com o estado real de cada um.
