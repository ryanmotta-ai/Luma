# 08 — ATELIÊ · visão, arquitetura e roadmap

> O plano do **Luma Ateliê** (ex-"Luma Creative": nome trocado na tela em 21/10/2026; no código
> continuam `js/creative/`, prefixo `cr*`, modo `creative` e a flag `module.creative`).
> Escrito em 21/10/2026, a partir da conversa com o Ryan. **Dono: Ryan.** Cada etapa daqui vira
> um ticket no Jira (projeto LUMA). A ordem é a sugerida, sem pressa: uma de cada vez.
> Ao concluir uma etapa, marque o `[x]` e anote a data.

---

## 1. A visão em uma frase

**O Ateliê é o diretor de arte e a agência que o franqueado não tem.** O franqueado do interior
não sabe Photoshop e não pode pagar uma agência. Ele conversa com o Ateliê, e o Ateliê entrega
a peça pronta (arte, roteiro, slide, impresso, material da semana) **sempre dentro do universo
visual da Delivery Much**, sem nunca repetir a mesma arte sem graça.

Três promessas que guiam toda decisão:

1. **Autonomia:** o franqueado pede em linguagem natural, e o Ateliê entende a intenção e entrega.
2. **Nunca a mesma arte:** variedade real, com direção de arte, não um template trocando texto.
3. **Nunca fora da marca:** liberdade criativa só dentro dos nossos assets, regras e referências.

---

## 2. Decisões já tomadas (Ryan, 21/10/2026)

| # | Decisão |
|---|---|
| D1 | **A curadoria das referências é do Ryan.** O gosto do Ateliê é o gosto de quem cura. Ninguém mais sobe referência para o banco. |
| D2 | **Biblioteca de assets e de referências no Supabase**, com segmentação forte, para que um asset nunca "brigue" com outro e não saiam artes feias. |
| D3 | **Referência externa do franqueado fica só na sessão dele.** Nunca sobe para o banco. (Hoje a sessão já mora no IndexedDB do aparelho, então isso já vale. Ver §6, risco R5.) |
| D4 | **Referências organizadas por tipo de peça** (flyer, story, feed, wind banner, slide…), não só por objetivo. |
| D5 | **A primeira chamada de toda conversa é uma IA** (o "concierge") que lê a sessão inteira e decide a intenção, como um harness (Claude Code, Antigravity). |
| D6 | **Modelo: Gemini 3.8 Flash, no nível high, para tudo.** Sem modelo mais forte em etapa nenhuma. |
| D7 | **Slides para o lojista** entram no escopo. |
| D8 | **Impressos (wind banner, outdoor…)** vêm da Yungas para cá: o franqueado vê os mockups, escolhe e baixa o arquivo de impressão. Gerar impresso do zero fica para o futuro. |
| D9 | **Campanha sazonal** entra no Ateliê com os assets, as regras e o playbook passados pelo designer que fez a campanha. |
| D10 | **RH** (pacote de artes, aniversário automático por e-mail) fica no roadmap, para depois. |
| D11 | **Edição:** o editor manual não vira um mini-Canva. O investimento vai para a IA que modifica a arte sem estragar, pelo fluxo principal ou por um chat focado na arte. |
| D12 | **n8n** pode ajudar nos fluxos. Ele entra onde o navegador sofre (§4.8), não como pré-requisito. |

---

## 3. O que já existe (base para não refazer)

| Peça | Onde | Estado |
|---|---|---|
| Roteador do chat (`nova`, `modificar`, `copy`, `conversa`, `perguntar`) | `js/creative/harness.js` | Funciona. É IA quando há provedor e regra fixa quando não há. É a semente do concierge (E1). |
| IA designer: vê a régua e a referência e devolve blocos e grafismos | `crDesenhos`, `crPromptDesenho` em `js/creative/creative.js` | Funciona. **A IA não escreve SVG**: aponta, e o código desenha (`crDesenhar`). |
| Conferência geométrica e nota de design | `creative.js`, `tests/creative-banco.js` | Funciona, coberta por teste. É a garantia de "nunca fora da marca". |
| 50 composições à mão (7 grupos) | `js/creative/composicoes.js`, `docs/CATALOGO-COMPOSICOES.md` | Funciona. |
| Inventário de grafismos (`CR_DECOR`, com `marca` e `tipo`) | `creative.js`, `assets/creative/inv/` | **Fixo no código.** Vai para o Supabase (E2). |
| Régua de referências (`CR_REGUA`, 6 imagens por objetivo) | `creative.js`, `assets/creative/regua/` | **Fixo no código e por objetivo.** Vai por tipo de peça (E3). |
| Modo COPY (legenda, roteiro, WhatsApp) | `js/creative/copy.js` | Funciona. |
| Formato `slide` 1920×1080 | `CR_FORMATOS` | Uma página só. Falta apresentação (E9). |
| Editor manual (seleção, arrastar, texto inline, zoom, desfazer) | `crEditar` | Funciona. Fica como ajuste fino (D11). |
| Curadoria por votos → pesos | `js/creative/curadoria.js` | Funciona, só a gestão. Base para medir o gosto (E4). |
| Sessões salvas | IndexedDB do aparelho (`crSessSalva`) | Funciona. Não sincroniza entre aparelhos. |
| Cota: 20 artes por dia por franqueado | `01_BUSINESS.md` | Decidida. |
| Bancada de qualidade | `tests/_bancada-creative.html`, `tests/_galeria-composicoes.html` | Ferramenta, não portão. É o medidor de cada etapa. |

---

## 4. A arquitetura alvo

### 4.1 Visão geral

```
Franqueado ──► CONCIERGE (Gemini 3.8 Flash high)
                 lê: estado da sessão (.md) + mensagem nova + catálogo de skills
                 decide: intenção → ativa UMA skill
                         │
   ┌───────────┬─────────┼──────────┬──────────┬────────────┬───────────┐
   ▼           ▼         ▼          ▼          ▼            ▼           ▼
 ARTE      MODIFICAR   COPY/     SLIDES    MATERIAL     IMPRESSOS    (futuro)
 (diretor  (patch na   ROTEIRO   (deck)    DA SEMANA    (Yungas:     RH
  de arte)  arte atual)                    (catálogo)   mockup→PDF)
   │           │                   │
   └─────┬─────┘                   │
         ▼                         ▼
   MOTOR DO LUMA: desenha com os assets filtrados → confere geometria → nota
         ▲
   BIBLIOTECAS (Supabase, RLS): assets segmentados · referências por tipo · playbooks de campanha
```

A regra de ouro: **a IA decide o quê e o código executa o como.** A IA nunca entrega SVG livre
para o franqueado. Ela devolve uma direção de arte no nosso vocabulário, e o motor desenha com os
assets e as regras. É isso que deixa a arte criativa sem sair da marca.

### 4.2 Concierge (a porta de entrada)

- **Toda mensagem passa primeiro por ele.** Ele lê o **estado da sessão** em forma de documento
  (`.md` gerado do `crState`): o que foi pedido, o que foi entregue, as referências da sessão,
  a campanha ativa, os ajustes já feitos. É o mesmo princípio de um harness: a memória da
  conversa é um arquivo que a IA relê.
- **Compactação:** a sessão cresce. Acima de um teto, as rodadas antigas viram resumo e só as
  últimas ficam por inteiro. Sem isso, o custo e a latência de cada mensagem sobem sem parar.
- **Skills = playbooks em `.md`.** Cada intenção tem a sua (arte, modificar, copy, slides,
  material, impressos, campanha X). O concierge vê só o catálogo (nome e quando usar) e carrega
  a skill inteira apenas quando ativa. Uma campanha nova vira uma skill nova, sem mudar código.
- **Pergunta quando falta:** se a intenção é clara mas falta dado (preço, data, loja), ele
  pergunta uma vez, em frase completa, antes de gastar uma geração.
- Evolui o roteador que já existe (`harness.js`). Não é um sistema novo.

### 4.3 Biblioteca de assets (Supabase)

Cada asset é uma linha com etiquetas. A segmentação é o que impede arte feia:

| Campo | Exemplo | Para quê |
|---|---|---|
| `escopo` | `institucional` · `campanha:natal-2026` · `rh` | Separa os mundos. |
| `marca` | `dm` · `much` · `todas` | Já existe em `CR_DECOR`. |
| `tipo` | `grafismo` · `acento` · `selo` · `fundo` · `textura` · `foto` · `ícone` · `ilustração` | Onde o asset pode entrar na composição. |
| `papel` | `fundo` · `atrás-do-preço` · `canto` · `perto-do-foco` | Onde pode ficar (hoje está em texto livre no `desc`). |
| `formatos` | `feed, story` | Onde cabe com nitidez. |
| `max_px` | `979` | Maior tamanho nítido (já existe). |
| `vigencia` | `2026-12-01 → 2026-12-31` | Campanha some sozinha fora da data. |
| `combina_com` / `nunca_com` | — | Regra explícita de convivência. |
| `desc` | texto curto | O que a IA lê para escolher. |

**Regras de convivência, validadas por código (não pela IA):**

1. **Uma campanha por peça.** Asset de duas campanhas nunca se misturam.
2. **Institucional combina com tudo**, a menos que a campanha diga o contrário.
3. **Marca não mistura:** asset `much` só em peça `much`, e o mesmo para `dm`.
4. **Fora da vigência, o asset não existe** para a IA.
5. `nunca_com` é absoluto.

O filtro roda **antes** de a IA ver o inventário. Ela só enxerga o que pode usar, então não tem
como errar a combinação.

### 4.4 Biblioteca de referências (Supabase, curada pelo Ryan)

- **Organizada por tipo de peça** (flyer, post feed, story, carrossel, banner in-app, e-mail,
  slide, wind banner, outdoor…), com etiquetas de objetivo, marca e campanha.
- **Pode ter referência de fora da DM**, marcada como `estilo`: ela ensina linguagem
  (hierarquia, ritmo, composição), e a IA traduz para o nosso universo. Uma referência de estilo
  nunca vira asset.
- **Só o Ryan sobe** (RLS: escrita restrita, leitura para quem gera).
- A régua que a IA designer vê passa a ser escolhida pelo **tipo de peça pedido**, não só pelo
  objetivo.

### 4.5 Diretor de arte (variedade sem perder a marca)

Três camadas, da mais segura para a mais livre:

1. **Eixos contínuos dentro de cada composição:** fundo, escala do título, posição e recorte da
   foto, alinhamento, respiro, posição do preço. Cada composição vira uma família, não um
   desenho fixo.
2. **Recombinação de blocos:** cabeçalho, foto, oferta, selo e rodapé recombinados pela busca,
   com a conferência geométrica barrando colisão.
3. **A IA escolhe a direção:** lê o pedido, a régua do tipo de peça e a referência da sessão, e
   decide a linguagem ("editorial, foto grande, título curto, fundo escuro"). O motor executa.

**Anti-repetição:** guardar as últimas plantas usadas pelo franqueado e penalizar as parecidas
na busca. Duas artes seguidas dele nunca se parecem.

**Sobre replicar a referência:** a IA traduz a referência para o nosso vocabulário. Uma
referência muito fora dele (ilustração 3D, colagem complexa) sai *inspirada em*, não replicada.
O vocabulário cresce quando a biblioteca de assets cresce. Isso é intencional: é o que garante a
marca.

### 4.6 Modificar sem estragar

- A IA devolve um **patch estruturado** (trocar texto, cor, tema, formato, mover ou trocar um
  asset), nunca uma arte nova.
- O patch passa pelo mesmo validador da criação. Se reprovar, a IA corrige uma vez. Se reprovar
  de novo, o Ateliê explica e não aplica.
- **Toda modificação vira uma versão**, com volta em um clique.
- **Duas portas, um motor:** pelo chat principal ("troca o preço para 19,90") ou com a arte
  aberta. O editor manual fica para ajuste fino.

### 4.7 Impressos (Yungas → Ateliê)

- **Fase A (agora, D8):** trazer a biblioteca da Yungas. O franqueado pergunta "quais wind
  banners a gente tem?", o Ateliê mostra os mockups, ele escolhe e baixa o arquivo de impressão
  **já fechado**. O Luma não gera nada aqui, só organiza e entrega.
- **Fase B (futuro):** o Ateliê fecha o arquivo sozinho, com uma skill de fechamento e preflight
  (sangria, área de segurança, resolução mínima, CMYK, fontes em curva, perfil de cor) e uma
  simulação do arquivo fechado antes de liberar.
  ⚠️ **Limite técnico:** gerar PDF de impressão em CMYK confiável no navegador, em vanilla JS e
  sem dependência, não é viável. A fase B pede um serviço no servidor (Edge Function ou n8n com
  ferramenta de PDF). É uma decisão de arquitetura antes de começar (§7, Q4).

### 4.8 Onde o n8n entra

- **Fluxos longos ou agendados:** aniversário do RH (gerar a arte e mandar e-mail), campanha
  que dispara para a rede inteira, material da semana montado toda segunda.
- **Fechamento de impresso (fase B)**, se for nele o serviço de PDF.
- **Integrações externas:** Yungas, e-mail, planilhas.
- **Não entra** no ciclo interativo do chat no começo: o chat precisa responder rápido, e hoje a
  IA já passa pela Edge Function `ai`.
- Segurança: o n8n chama o Luma e o Supabase com credencial de serviço própria e nunca recebe
  chave de franqueado. A RLS continua sendo a única fronteira.

---

## 5. Roadmap (épicos → etapas)

Cada etapa é um ticket. "Pronto" = o critério escrito, verificado na bancada ou no navegador.

### Fase 1 — Fundação

**E0 · Casa arrumada**
- [ ] E0.1 Atualizar o nome "Luma Ateliê" nos docs (`luma-brain/`, `docs/`) e no prompt do
  roteador. Pronto: nenhuma menção visível a "Creative" fora de código.
- [x] E0.2 Linha de base de qualidade: rodar a bancada e registrar nota média, ≥ 80, tempo e
  repetição. Pronto: os números estão neste arquivo, para comparar cada etapa.

  **Linha de base — 30/10/2026** (`tests/_bancada-creative.html`, banco inteiro, commit `3d73f52`).
  1.152 casos. Busca: p50 56 ms, p95 129 ms, máx. 324 ms. Erro de marca pelo DOM: 0.
  ⚠ Rodou no painel do navegador escondido (aba em segundo plano): o tempo é teto, não piso —
  compare tempo só com rodada feita do mesmo jeito.

  | recorte | casos | média das 3 | melhor das 3 | ≥ 80 | sem opção | assinatura repetida |
  |---|---|---|---|---|---|---|
  | **total** | 1152 | **87,6** | 91,5 | **86%** | 6 | **187** |
  | feed | 392 | 90,2 | 93,7 | 95% | 2 | 27 |
  | story | 424 | 89,8 | 93,8 | 93% | 0 | 58 |
  | inapp | 96 | 87,4 | 91,5 | 89% | 0 | 28 |
  | capa | 56 | 90,0 | 94,4 | 83% | 0 | 55 |
  | carrossel | 40 | 79,2 | 81,6 | 51% | 0 | 5 |
  | emailTopo | 48 | 77,6 | 83,7 | 52% | 0 | 4 |
  | banner | 96 | 74,9 | 78,9 | 33% | 4 | 10 |
  | grupo A | 184 | 86,4 | 90,0 | 86% | 0 | 10 |
  | grupo B | 128 | 91,1 | 93,8 | 94% | 0 | 2 |
  | grupo C | 336 | 86,9 | 91,4 | 86% | 2 | 146 |
  | grupo D | 88 | 84,5 | 88,8 | 87% | 4 | 5 |
  | grupo E | 208 | 88,8 | 92,4 | 87% | 0 | 20 |
  | grupo F | 88 | 85,8 | 91,0 | 77% | 0 | 2 |
  | grupo G | 120 | 89,5 | 92,7 | 87% | 0 | 2 |

  O que a linha de base já diz: os formatos largos (**banner**, **emailTopo**, **carrossel**)
  são o buraco de nota — um terço a metade das opções abaixo de 80. A **repetição** se concentra
  em **capa** (55 de 56 casos com assinatura igual entre as 3 opções) e no **grupo C**: é o alvo
  natural da E4.2. Os 6 casos sem opção são `c03/feed/extremo/foto` (+ `/much`) e
  `d03/banner/{curto,medio,longo,extremo}` sem foto.

  **Rodada 2 — 30/10/2026: herói dos formatos deitados.** O teto fixo do herói (`heroiMax`) deixava
  título curto do tamanho de um longo — card vazio, escala ~0,7. `_crHeroiDeitado` (creative.js) usa o
  `crLockup` com a altura do card/faixa: 1 ou 2 linhas, crescendo até onde cabe. Vale em `bannerSplit`,
  `bannerSelo`, `bannerFoto`, `emailFaixa` e `emailMarca` sem foto. Régua do banner: +5 peças reais
  (almoço, brindes, açaí, descontaço, Xanxerê) em `assets/creative/regua/`, e o par mostrado à IA
  passa a variar por pedido.

  | recorte | média das 3 | ≥ 80 | assinatura repetida |
  |---|---|---|---|
  | **total** | 87,6 → **88,2** | 86% → **89%** | 187 → 179 |
  | banner | 74,9 → **80,5** | 33% → **70%** | 10 → 2 |
  | emailTopo | 77,6 → **78,9** | 52% → **70%** | 4 → 4 |
  | feed, story, inapp, capa | iguais | iguais | iguais |

  Falta: `bannerTexto` e `appBanner` (composicoes.js) seguem com o teto antigo; o **carrossel**
  (79,2, 51%) não foi tocado — a fraca é a `carrosselTres` (média 75).

**E1 · Concierge**
- [ ] E1.1 Estado da sessão como `.md`, gerado do `crState`, com compactação acima de um teto.
  Pronto: uma sessão de 20 rodadas cabe no teto, sem perder pedido nem entrega.
- [ ] E1.2 Catálogo de skills (nome, quando usar) e carga sob demanda. Pronto: o concierge ativa
  a skill certa nos pedidos do banco de intenções (`tests/`), com taxa de acerto registrada.
- [ ] E1.3 Novas intenções no roteador: `slides`, `material`, `impressos`. Pronto: casos novos
  na suíte do fluxo do chat.
- [ ] E1.4 Pergunta única quando falta dado. Pronto: pedido sem preço gera uma pergunta, não uma
  arte com preço inventado (a trava de dado já existe, estender).

**E2 · Biblioteca de assets**
- [ ] E2.1 Tabela e bucket no Supabase com os campos do §4.3 e RLS (escrita: gestão; leitura:
  quem gera). Pronto: migration aplicada e advisors limpos.
- [ ] E2.2 Migrar o `CR_DECOR` e o `assets/creative/inv/` para a tabela. Pronto: o motor lê do
  banco e a bancada dá a mesma nota de antes.
- [ ] E2.3 Filtro de convivência (as 5 regras do §4.3) antes de a IA ver o inventário. Pronto:
  teste com asset de campanha vencida e de duas campanhas, ambos barrados.
- [ ] E2.4 Tela de curadoria de assets no Estúdio (subir, etiquetar, vigência). Pronto: o Ryan
  sobe um asset e ele aparece numa arte sem commit.

**E3 · Biblioteca de referências**
- [ ] E3.1 Tabela de referências por tipo de peça, escrita só do Ryan. Pronto: RLS testada com
  usuário franqueado (não escreve).
- [ ] E3.2 Migrar o `CR_REGUA` e passar a escolher a régua pelo tipo de peça. Pronto: um pedido
  de story recebe régua de story.
- [ ] E3.3 Etiqueta `estilo` para referência de fora da DM. Pronto: uma referência externa muda a
  direção, e nenhum elemento dela aparece na arte.
- [ ] E3.4 Tela de curadoria de referências. Pronto: o Ryan sobe e etiqueta sem commit.

### Fase 2 — Criatividade e edição

**E4 · Diretor de arte**
- [ ] E4.1 Eixos contínuos em cada composição (fundo, escala do título, foto, alinhamento,
  respiro). Pronto: toda variação passa na nota (teste de propriedade com semente fixa).
- [ ] E4.2 Anti-repetição por franqueado. Pronto: 10 pedidos iguais seguidos dão 10 plantas
  diferentes acima do limite de distância.
- [ ] E4.3 A IA escolhe a direção de arte com a régua e o inventário filtrado. Pronto: a bancada
  mostra a nota ≥ linha de base e a repetição menor.
- [ ] E4.4 Referência da sessão traduzida para o vocabulário DM. Pronto: 10 referências de teste,
  julgadas pelo Ryan na curadoria.

**E5 · Modificar sem estragar**
- [ ] E5.1 Patch estruturado ampliado (mover, trocar asset, trocar cor da paleta) além das chaves
  de hoje. Pronto: casos novos na suíte do chat.
- [ ] E5.2 Versões da arte com volta em um clique. Pronto: 5 modificações seguidas e volta à 2ª.
- [ ] E5.3 Validação do patch: reprova, corrige uma vez e, se reprovar de novo, explica e não
  aplica. Pronto: caso de teste com patch que colide.
- [ ] E5.4 Modificar com a arte aberta, usando o mesmo motor do chat. Pronto: o mesmo pedido dá o
  mesmo resultado nas duas portas.

### Fase 3 — Cobrir as necessidades do franqueado

**E6 · Campanhas**
- [ ] E6.1 Playbook de campanha como skill (`.md`) mais assets com escopo e vigência. Pronto:
  uma campanha de teste entra sem mudar código.
- [ ] E6.2 Ritual de lançamento: conversa com o designer da campanha → assets, regras e playbook
  no Ateliê. Pronto: checklist escrito e usado em uma campanha real.
- [ ] E6.3 Campanha ativa sugerida pelo concierge na época certa. Pronto: dentro da vigência, o
  pedido genérico sai na campanha.

**E7 · Material pronto**
- [ ] E7.1 Intenção `material`: "tem material para essa semana?" busca no catálogo que já existe.
  Pronto: o Ateliê mostra as peças da semana e baixa.

**E8 · Impressos — fase A**
- [ ] E8.1 Levantar a biblioteca da Yungas (formatos, arquivos, mockups, direitos de uso).
- [ ] E8.2 Trazer para o Supabase (mockup, arquivo fechado, tipo, medidas). Pronto: tabela com
  RLS e arquivos no bucket.
- [ ] E8.3 Intenção `impressos`: listar mockups, escolher, baixar o arquivo. Pronto: "quais wind
  banners a gente tem?" funciona ponta a ponta.

**E9 · Slides**
- [ ] E9.1 Apresentação com várias páginas (capa, conteúdo, fechamento) sobre o template de 2026
  (`assets/creative/slides/`). Pronto: deck de 5 páginas gerado de um pedido.
- [ ] E9.2 Exportar PDF do deck. Pronto: o lojista abre no celular.

**E10 · Copy e roteiro**
- [ ] E10.1 Ligar o modo COPY ao concierge como skill. Pronto: roteiro e legenda pelo mesmo chat.

### Fase 4 — Futuro (registrado, sem data)

**E11 · RH**
- [ ] E11.1 Converter as artes do RH em SVG para templates do Ateliê, só preenchendo campos.
- [ ] E11.2 Pacote de artes do RH (aniversário, boas-vindas, tempo de casa…).
- [ ] E11.3 Fluxo n8n de **captação**: puxar os aniversariantes do Datamatch (dash de Pessoas)
  todo dia. Dado pessoal: não vira tabela aberta no Luma; se precisar guardar, tabela própria com
  RLS só do RH.
- [ ] E11.4 Fluxo n8n de **entrega**: aniversariante do dia → o Luma gera a arte do template →
  e-mail do RH com a arte pronta.

**E12 · Impressos — fase B**
- [ ] E12.1 Decidir o serviço de PDF de impressão (Edge Function ou n8n) — §7, Q4.
- [ ] E12.2 Skill de fechamento com preflight (sangria, segurança, resolução, CMYK, fontes em
  curva) e simulação antes de liberar.
- [ ] E12.3 Ateliê gera impresso do zero, a partir do mesmo motor das artes.

---

## 6. Riscos e reflexões

| # | Risco | O que fazer |
|---|---|---|
| R1 | **Flash high em toda mensagem** custa e demora: o concierge soma uma chamada a cada mensagem, além da geração. | Estado da sessão compacto (E1.1), cache das skills e medir o custo por arte na E0.2. A cota de 20 artes por dia não conta as mensagens do concierge; decidir se deve (Q2). |
| R2 | **SVG livre de IA** sai fora da marca. | A regra de ouro (§4.1): a IA aponta, o código desenha. Não abrir exceção. |
| R3 | **Assets sem segmentação** geram arte feia. | Filtro por código antes da IA (E2.3). Asset sem etiqueta completa não entra. |
| R4 | **Gosto não se mede sozinho.** | A curadoria do Ryan (votos) mais a bancada viram o portão de cada etapa de criatividade. |
| R5 | **Referência externa:** ela não sobe para o banco (D3), mas **é enviada ao provedor de IA** para ser lida. | Deixar claro na interface. Instruir a IA a se inspirar, nunca copiar logo, texto ou foto de terceiro. |
| R6 | **Impressão** não perdoa erro (cor, sangria, resolução). | Fase A entrega só arquivo já fechado. Fase B só com preflight e simulação. |
| R7 | **Sessão só no aparelho:** o franqueado troca de celular e perde o histórico. | Aceitável hoje. Sincronizar exige decidir onde a referência externa fica (D3). |
| R8 | **Teste com aleatoriedade:** variedade quebra a regressão. | Semente fixa nos testes e teste de propriedade ("toda variação passa na nota"). |
| R9 | **Escopo enorme.** | Uma etapa por vez, cada uma com pronto medível. A Fase 1 sozinha já melhora o produto. |

---

## 7. Perguntas em aberto

| # | Pergunta | Bloqueia |
|---|---|---|
| Q1 | O Ateliê abre para o franqueado quando? Hoje é só a gestão, em testes. | Lançamento |
| Q2 | As mensagens do concierge contam na cota de 20 artes por dia, ou há uma cota de mensagens separada? | E1 |
| Q3 | Quais tipos de peça entram primeiro na biblioteca de referências? | E3 |
| Q4 | Fechamento de impresso: Edge Function ou n8n? Onde roda o n8n (instância própria ou da DM)? | E12, E11.3 |
| Q5 | Yungas: temos os arquivos fechados e os direitos de uso de todos os impressos? Quem é o contato? | E8 |
| Q6 | Material da semana: quem define o que é "da semana"? O catálogo atual tem data ou campanha? | E7 |
| Q7 | Asset de campanha vencida some de vez ou fica arquivado para consulta? | E2.3 |
| Q9 | Datamatch: tem API ou exportação que o n8n consiga ler? Quais campos (nome, data, área, e-mail, foto)? Quem autoriza o uso? | E11.3 |
| Q8 | O franqueado vê de qual referência a IA se inspirou ("nessa pegada da referência X")? | E4 |
