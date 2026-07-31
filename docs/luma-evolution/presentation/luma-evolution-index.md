# Índice de evidências

Cada slide, o que o sustenta e o quanto se pode confiar. Níveis usados:

- **Alto** — captura real de uma execução (do commit ou do arquivo original), sem alteração no código da interface.
- **Médio** — captura real que exigiu restauração técnica. *Nenhum slide desta apresentação está neste nível.*
- **Baixo** — reconstrução visual a partir do código. *Nenhum slide desta apresentação está neste nível.*

| # | Slide | Tipo de evidência | Imagens | Confiança | Observação |
|---|---|---|---|---|---|
| 1 | Luma de piloto a produto | Capa | — | Alto | Sem captura. |
| 2 | Quatro perguntas, respondidas com evidência | Texto | — | Alto | Sem captura. |
| 3 | Nem se chamava Luma | Captura real (arquivo original) | `02_home_2026-07-15_origem_1440x1000.png` | Alto | HTML do piloto servido offline, sem alteração de código. |
| 4 | O git não guarda o começo — por isso o piloto importa | Números do git | — | Alto | git rev-list --max-parents=0 --all; git cat-file -s <sha>:index.html |
| 5 | A linha do tempo | Divisor | — | Alto | — |
| 6 | Linha do tempo | Linha do tempo | — | Alto | Datas e hashes de commit-map/milestones.json. |
| 7 | Piloto Yungas — Módulo de Artes | Captura real (arquivo original) | `02_home_2026-07-15_origem_1440x1000.png`<br>`03_catalogo_2026-07-15_origem_1440x1000.png`<br>`04_chat_2026-07-15_origem_1440x1000.png` | Alto | Commit —. Cena "home". |
| 8 | O que o git preserva como ponto de partida | Captura real do commit | `02_home_2026-07-16_0aed746_1440x1000.png`<br>`03_catalogo_2026-07-16_0aed746_1440x1000.png`<br>`04_chat_2026-07-16_0aed746_1440x1000.png` | Alto | Commit 0aed7461a7a761808fbf5a1c0cf63eae0d4576f2. Cena "home". |
| 9 | Prévia viva no celular | Captura real do commit | `02_home_2026-07-16_963d2a0_1440x1000.png`<br>`03_catalogo_2026-07-16_963d2a0_1440x1000.png`<br>`04_chat_2026-07-16_963d2a0_1440x1000.png` | Alto | Commit 963d2a0. Cena "home". |
| 10 | A vitrine passa a ser gerida pelo banco | Captura real do commit | `02_home_2026-07-16_247bcd4_1440x1000.png`<br>`03_catalogo_2026-07-16_247bcd4_1440x1000.png`<br>`04_chat_2026-07-16_247bcd4_1440x1000.png` | Alto | Commit 247bcd4. Cena "home". |
| 11 | Endurecimento: segurança, sync e PSD | Captura real do commit | `02_home_2026-07-20_4be6c33_1440x1000.png`<br>`03_catalogo_2026-07-20_4be6c33_1440x1000.png`<br>`04_chat_2026-07-20_4be6c33_1440x1000.png` | Alto | Commit 4be6c33. Cena "home". |
| 12 | 1.0 declarada | Captura real do commit | `02_home_2026-07-29_b29dbd8_1440x1000.png`<br>`03_catalogo_2026-07-29_b29dbd8_1440x1000.png`<br>`04_chat_2026-07-29_b29dbd8_1440x1000.png` | Alto | Commit b29dbd8. Cena "home". |
| 13 | A camada de IA | Captura real do commit | `02_home_2026-07-30_249fd02_1440x1000.png`<br>`03_catalogo_2026-07-30_249fd02_1440x1000.png`<br>`04_chat_2026-07-30_249fd02_1440x1000.png` | Alto | Commit 249fd02. Cena "home". |
| 14 | Luma CLI — o console do time | Captura real do commit | `02_home_2026-07-30_e48b7ff_1440x1000.png`<br>`03_catalogo_2026-07-30_e48b7ff_1440x1000.png`<br>`04_chat_2026-07-30_e48b7ff_1440x1000.png` | Alto | Commit e48b7ff. Cena "home". |
| 15 | Estado atual | Captura real do commit | `02_home_2026-07-30_atual_1440x1000.png`<br>`03_catalogo_2026-07-30_atual_1440x1000.png`<br>`04_chat_2026-07-30_atual_1440x1000.png` | Alto | Commit HEAD. Cena "home". |
| 16 | Como cada área mudou | Divisor | — | Alto | — |
| 17 | De cair no meio do trabalho a escolher por onde começar | Comparação de duas execuções reais | `02_home_2026-07-15_origem_1440x1000.png`<br>`02_home_2026-07-30_atual_1440x1000.png` | Alto | 2026-07-15 (arquivo original) → 2026-07-31 (branch atual). Cena "home". |
| 18 | O chat continua no centro — mas deixou de ser a porta | Comparação de duas execuções reais | `04_chat_2026-07-15_origem_1440x1000.png`<br>`04_chat_2026-07-30_atual_1440x1000.png` | Alto | 2026-07-15 (arquivo original) → 2026-07-31 (branch atual). Cena "chat". |
| 19 | O editor ganhou uma casa | Comparação de duas execuções reais | `06_designer_2026-07-15_origem_1440x1000.png`<br>`06_designer_2026-07-30_atual_1440x1000.png` | Alto | 2026-07-15 (arquivo original) → 2026-07-31 (branch atual). Cena "designer". |
| 20 | De adaptado a pensado pra tela pequena | Comparação de duas execuções reais | `12_home-mobile_2026-07-15_origem_390x844.png`<br>`12_home-mobile_2026-07-30_atual_390x844.png` | Alto | 2026-07-15 (arquivo original) → 2026-07-31 (branch atual). Cena "home-mobile". |
| 21 | Uma superfície pra quem mantém o Luma | Captura real do commit | `11_cli_2026-07-30_atual_1440x1000.png` | Alto | Sem versão anterior: a tela nasceu em 2026-07-30. |
| 22 | Onde as coisas estão | Divisor | — | Alto | — |
| 23 | Captura real + contorno medido | Captura real + contorno medido | `atlas_vitrine_1440x1000.png` | Alto | Caixas medidas com getBoundingClientRect na versão HEAD, viewport 1440×1000. |
| 24 | Captura real + contorno medido | Captura real + contorno medido | `atlas_campanha_1440x1000.png` | Alto | Caixas medidas com getBoundingClientRect na versão HEAD, viewport 1440×1000. |
| 25 | Captura real + contorno medido | Captura real + contorno medido | `atlas_estudio_1440x1000.png` | Alto | Caixas medidas com getBoundingClientRect na versão HEAD, viewport 1440×1000. |
| 26 | Captura real + contorno medido | Captura real + contorno medido | `atlas_cli_1440x1000.png` | Alto | Caixas medidas com getBoundingClientRect na versão HEAD, viewport 1440×1000. |
| 27 | O que cresceu além da aparência | Métricas do repositório | — | Alto | Contagens: wc -l em js/ e css/; grep de "function <prefixo>"; ls supabase/migrations; ls supabase/functions. |
| 28 | De arquivo solto a plataforma | Síntese do histórico | — | Alto | Baseado em commit-map/luma-timeline.md e docs/LUMA.md. |
| 29 | O produto hoje, tela por tela | Capturas reais da branch atual | `02_home_2026-07-30_atual_1440x1000.png`<br>`03_catalogo_2026-07-30_atual_1440x1000.png`<br>`04_chat_2026-07-30_atual_1440x1000.png`<br>`06_designer_2026-07-30_atual_1440x1000.png`<br>`09_exportar_2026-07-30_atual_1440x1000.png`<br>`11_cli_2026-07-30_atual_1440x1000.png` | Alto | Todas do mesmo commit. |
| 30 | O que sustenta esta apresentação | Auditoria | — | Alto | Números preenchidos na montagem a partir dos arquivos gerados. |
| 31 | Não é um conjunto de telas. É um produto. | Encerramento | — | Alto | — |

## Como conferir uma imagem

Cada PNG tem um JSON irmão em `screenshots/metadata/<marco>/` com a tela, o estado, o commit, a data, a viewport e o tipo de captura.
Pra reabrir a versão que gerou a imagem: `node scripts/versao.js <hash>`.