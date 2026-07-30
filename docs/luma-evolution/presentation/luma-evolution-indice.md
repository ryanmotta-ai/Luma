# Índice de evidências

Cada slide, o que o sustenta e o quanto se pode confiar.

- **Alto** — captura real de uma execução (do commit ou do arquivo original), sem alteração no código da interface.
- **Médio** — captura real que exigiu restauração técnica. *Nenhum slide desta apresentação está neste nível.*
- **Baixo** — reconstrução visual a partir do código. *Nenhum slide desta apresentação está neste nível.*

| # | Slide | Evidência | Imagens | Confiança | Observação |
|---|---|---|---|---|---|
| 1 | Luma de piloto a produto | Capa | — | Alto | — |
| 2 | Três perguntas, respondidas com evidência | Texto | — | Alto | — |
| 3 | Nem se chamava Luma | Captura real (arquivo original) | `01_home_2026-07-15_origem_1440x1000.png` | Alto | HTML do piloto servido offline, sem alteração de código. Contagens: wc -c/-l e grep no próprio arquivo. |
| 4 | O git não guarda o começo — por isso o piloto importa | Números do git | — | Alto | git rev-list --max-parents=0 --all; git cat-file -s 89ca896:index.html; git log --all \| wc -l |
| 5 | A linha do tempo | Divisor | — | Alto | — |
| 6 | Linha do tempo | Linha do tempo | — | Alto | Datas e hashes de commit-map/milestones.json, conferidos com git log. |
| 7 | Piloto Yungas — Módulo de Artes | Captura real (arquivo original) | `01_home_2026-07-15_origem_1440x1000.png`<br>`02_catalogo_2026-07-15_origem_1440x1000.png`<br>`03_chat_2026-07-15_origem_1440x1000.png` | Alto | Commit — (arquivo). Cena "home". |
| 8 | O que o git preserva como ponto de partida | Captura real do commit | `01_home_2026-07-16_89ca896_1440x1000.png`<br>`02_catalogo_2026-07-16_89ca896_1440x1000.png`<br>`03_chat_2026-07-16_89ca896_1440x1000.png` | Alto | Commit 89ca896. Cena "home". |
| 9 | A arte dentro do celular | Captura real do commit | `01_home_2026-07-16_57cbe74_1440x1000.png`<br>`02_catalogo_2026-07-16_57cbe74_1440x1000.png`<br>`03_chat_2026-07-16_57cbe74_1440x1000.png` | Alto | Commit 57cbe74. Cena "home". |
| 10 | A vitrine passa a ser gerida pelo banco | Captura real do commit | `01_home_2026-07-16_247bcd4_1440x1000.png`<br>`02_catalogo_2026-07-16_247bcd4_1440x1000.png`<br>`03_chat_2026-07-16_247bcd4_1440x1000.png` | Alto | Commit 247bcd4. Cena "home". |
| 11 | Endurecimento: segurança, sync e PSD | Captura real do commit | `01_home_2026-07-20_bcc61e8_1440x1000.png`<br>`02_catalogo_2026-07-20_bcc61e8_1440x1000.png`<br>`03_chat_2026-07-20_bcc61e8_1440x1000.png` | Alto | Commit bcc61e8. Cena "home". |
| 12 | 1.0 declarada | Captura real do commit | `01_home_2026-07-29_b29dbd8_1440x1000.png`<br>`02_catalogo_2026-07-29_b29dbd8_1440x1000.png`<br>`03_chat_2026-07-29_b29dbd8_1440x1000.png` | Alto | Commit b29dbd8. Cena "home". |
| 13 | A camada de IA | Captura real do commit | `01_home_2026-07-30_28a93e2_1440x1000.png`<br>`02_catalogo_2026-07-30_28a93e2_1440x1000.png`<br>`03_chat_2026-07-30_28a93e2_1440x1000.png` | Alto | Commit 28a93e2. Cena "home". |
| 14 | Luma CLI — o console do time | Captura real do commit | `01_home_2026-07-30_e48b7ff_1440x1000.png`<br>`02_catalogo_2026-07-30_e48b7ff_1440x1000.png`<br>`03_chat_2026-07-30_e48b7ff_1440x1000.png` | Alto | Commit e48b7ff. Cena "home". |
| 15 | Estado atual | Captura real do commit | `01_home_2026-07-30_atual_1440x1000.png`<br>`02_catalogo_2026-07-30_atual_1440x1000.png`<br>`03_chat_2026-07-30_atual_1440x1000.png` | Alto | Commit HEAD. Cena "home". |
| 16 | Como cada área mudou | Divisor | — | Alto | — |
| 17 | De cair no meio do trabalho a escolher por onde começar | Comparação de duas execuções reais | `01_home_2026-07-15_origem_1440x1000.png`<br>`01_home_2026-07-30_atual_1440x1000.png` | Alto | anterior a 16/07 (arquivo original) → 2026-07-30 (branch atual). Cena "home". |
| 18 | O chat continua no centro — mas deixou de ser a porta | Comparação de duas execuções reais | `03_chat_2026-07-15_origem_1440x1000.png`<br>`03_chat_2026-07-30_atual_1440x1000.png` | Alto | anterior a 16/07 (arquivo original) → 2026-07-30 (branch atual). Cena "chat". |
| 19 | O editor ganhou uma casa | Comparação de duas execuções reais | `05_designer_2026-07-15_origem_1440x1000.png`<br>`05_designer_2026-07-30_atual_1440x1000.png` | Alto | anterior a 16/07 (arquivo original) → 2026-07-30 (branch atual). Cena "designer". |
| 20 | De adaptado a pensado pra tela pequena | Comparação de duas execuções reais | `09_home-mobile_2026-07-15_origem_390x844.png`<br>`09_home-mobile_2026-07-30_atual_390x844.png` | Alto | anterior a 16/07 (arquivo original) → 2026-07-30 (branch atual). Cena "home-mobile". |
| 21 | Uma superfície pra quem mantém o Luma | Captura real do commit | `08_cli_2026-07-30_atual_1440x1000.png` | Alto | Sem versão anterior: a tela nasceu em 2026-07-30 (c9790e8 e e48b7ff). |
| 22 | O que cresceu além da aparência | Métricas do repositório | — | Alto | Contado na montagem: wc -l em js/ e css/; grep "^function <prefixo>"; ls supabase/migrations; ls supabase/functions. |
| 23 | De arquivo solto a plataforma | Síntese do histórico | — | Alto | Baseado em commit-map/luma-timeline.md, docs/LUMA.md e docs/LUMA-BACKEND-CHANGELOG.md. |
| 24 | O produto hoje, tela por tela | Capturas reais da branch atual | `01_home_2026-07-30_atual_1440x1000.png`<br>`02_catalogo_2026-07-30_atual_1440x1000.png`<br>`03_chat_2026-07-30_atual_1440x1000.png`<br>`05_designer_2026-07-30_atual_1440x1000.png`<br>`06_exportar_2026-07-30_atual_1440x1000.png`<br>`08_cli_2026-07-30_atual_1440x1000.png` | Alto | Todas do mesmo commit (HEAD). |
| 25 | Auditoria | Auditoria | — | Alto | Números apurados na montagem a partir dos arquivos em disco. |
| 26 | Não é um conjunto de telas. É um produto. | Encerramento | — | Alto | — |

## Como conferir uma imagem

Cada PNG tem um JSON irmão em `screenshots/metadata/<marco>/` com a tela, o estado, o commit, a data, a viewport e o tipo de captura.
Para reabrir a versão que gerou a imagem: `node scripts/versao.js <hash>`.