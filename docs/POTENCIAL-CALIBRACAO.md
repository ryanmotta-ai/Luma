# Potencial — calibração do modelo com o GMV real da rede

> 30/10/2026 · base: planilha de operações "Base Ops" (fev, mar, jun, ago e set/2026) + "Aladim Calculadora DM 2026 COMERCIAL".
> Código: `js/potencial/motor.js` (`potRedeEstatisticas`, `potCalibraModelo`) · dados: `luma.potencial_rede` (migration `20261030120000`).

## A pergunta

A calculadora da planilha projeta UMA curva por cidade. Ela nunca foi comparada com o que as cidades que a DM já opera realmente vendem. A Base Ops traz isso: GMV real de **99 cidades** (69 em Operação Ongoing, 11 em Implementação, 15 em Operação Própria) em cinco datas de 2026, e, para junho, pedidos, ticket, clientes ativos e frequência.

## O que os dados dizem (69 cidades Ongoing)

| | Real (rede) | O que a planilha/slide assume |
|---|---|---|
| **Ticket médio** | **R$ 69,40** ponderado por pedidos (mediana por cidade R$ 66,30; P25 R$ 60, P75 R$ 77) | R$ 70 (aba Calculadora) · R$ 45 (aba Cenários e slide antigo) |
| **Clientes ativos / população** | mediana **4,1%** · P75 6,3% · P90 9,5% · **máximo 14,9%** | cenários de **2% / 20% / 35%** |
| **Frequência** | 2,26 pedidos por cliente no mês | 1 pedido por usuário (GMV = usuários × ticket) |
| **GMV por habitante / mês** | mediana **R$ 6,5–6,7** · P25 R$ 1,2–1,5 · P75 R$ 9,6–10,5 · P90 R$ 16 | ruim R$ 1,4 · **real R$ 14** · top R$ 24,5 (ticket R$ 70) |
| **Evolução** | GMV de set/fev: mediana 1,00; **49% das cidades caíram** | GMV total só cresce, todo mês |

Conclusões:

1. **O ticket de R$ 70 está certo.** O R$ 45 não aparece em nenhuma faixa da rede.
2. **Os cenários de 2% / 20% / 35% estão acima da realidade.** O "real e esperado" (R$ 14/hab) cai em torno do **P73–P87** das cidades parecidas, e o "top" no **P93–P100**. O "ruim" (R$ 1,4/hab) é o único que a rede confirma (P20–P33). A mediana real equivale a ~**10% da população** a 1 pedido/mês (não 20%).
3. **O modelo de 24 meses termina, no mês 24, entre o P73 e o P100 das cidades parecidas** (nos três exemplos abaixo). Frente ao GMV real de setembro, o modelo no mês 12 fica abaixo da cidade mediana (real/modelo = 1,32) e no mês 24 acima (0,57; 77% das cidades vendem menos que o modelo). Cidades pequenas (< 15 mil hab.) e grandes (> 100 mil) são superestimadas; de 15 a 100 mil o real fica entre o mês 12 e o mês 24 do modelo.
4. **Número de concorrentes não ordena o GMV por habitante** na rede (a relação não é monotônica), e o GMV por habitante não depende da população (correlação de log ≈ −0,03). O modelo é uma curva só e a rede tem uma dispersão enorme: curva A da Base Ops ≈ R$ 9,5/hab, B ≈ R$ 7,0, C ≈ R$ 1,2.

## O que o Luma passou a fazer

- **Referência da rede** (na tela de Calcular): para a cidade escolhida, as 15 cidades Ongoing de população mais parecida (a própria fica de fora) dão P10/P25/P50/P75/P90 de GMV por habitante. A tela mostra onde caem o cenário ruim/real/top e o modelo (mês 12 e 24), a lista das cidades parecidas e o "% da população equivalente" a cada percentil.
- **Projeção calibrada**: o mesmo modelo da planilha, com os dois deltas de marketing multiplicados por um fator achado por bisseção até o GMV do mês 24 igualar `população × GMV/hab` do percentil (P25, P50 ou P75). Exemplo (ticket R$ 70; concorrentes como na base):

| Cidade | Planilha | Rede P25 | Rede P50 | Rede P75 |
|---|---|---|---|---|
| Ariquemes (109 mil) | payback mês 12 · R$ 305 mil em 24 m | > 24 m · −R$ 27 mil | mês 20 · R$ 33 mil | mês 12 · R$ 277 mil |
| Tupã (64 mil) | mês 12 · R$ 207 mil | mês 22 · R$ 15 mil | mês 13 · R$ 150 mil | mês 11 · R$ 244 mil |
| Aruanã (8,7 mil) | mês 12 · R$ 53 mil | > 24 m · −R$ 6 mil | mês 17 · R$ 15 mil | mês 14 · R$ 33 mil |

Sanidade: Tupã, que a DM opera, vende hoje R$ 458 mil/mês; a referência P50 para a população dela é R$ 476 mil.

## Decisões que cabem ao comercial (e ao jurídico)

O slide e o card de potencial são **material de venda de franquia**: prometer em apresentação um resultado que só ~15% das cidades alcançam tem implicação na Circular de Oferta de Franquia. Por isso o Luma **não mudou** os cenários do slide: mostra a evidência e deixa a escolha.

1. Os cenários do slide continuam **2% / 20% / 35%** ou passam a ser os da rede (aprox. ruim 1,5–3% · real 3–10% · top 11–18%, conforme a cidade)? O parâmetro `cenarios` em Tarifas aceita a mudança sem deploy.
2. O payback do slide continua o simples (investimento ÷ lucro mensal do cenário) ou passa a ser o do caixa da projeção (a tela já mostra os dois)?

## Limites (leia antes de confiar demais)

- **É uma foto, não uma curva.** Não há data de lançamento por cidade: a referência compara níveis de 2026 e não separa cidade nova de madura. Com a data de lançamento (ou a série mensal desde o início), dá para calibrar a rampa de verdade.
- **Cidades Ongoing incluem as que não deram certo** (P10 ≈ R$ 0,10/hab). É a realidade da rede, mas puxa a mediana para baixo; o P75 é a leitura "bem executada".
- Só **15 vizinhas por população** formam a amostra; em cidades muito pequenas ou muito grandes a amostra é mais heterogênea.
- O GMV real é o GMV total da cidade (todas as verticais) e vem de uma única planilha de operações; população do IBGE 2025.
- A calibração escala os dois deltas na mesma proporção; ela não descobre quanto o franqueado realmente investiu em marketing em cada cidade (não está na base).
