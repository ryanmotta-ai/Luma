# 09 — ECOSSISTEMA 360 de marketing local

> A visão de conjunto: como o Luma Franqueado, o Ateliê, o Calendário e o Auditor de marca
> resolvem juntos **uma demanda só, o marketing local do franqueado**. Escrito em 21/10/2026, a
> partir da conversa com o Ryan. **Dono: Ryan.** Detalhe do Ateliê em `08_ATELIE.md`.
> Este arquivo é **visão e mapa de decisão**, não autorização para construir: cada produto entra
> no roadmap quando o Ryan disser.

---

## 1. A tese

O franqueado do interior não sabe Photoshop, não pode pagar agência e não sabe o que postar.
Hoje o marketing local é a pedra no sapato da rede. A meta é tirar essa pedra **sem gerar
milhões de MV**, e fazer da Delivery Much uma **franquia AI-first**.

Cada produto responde a uma pergunta do franqueado:

| Produto | Pergunta que responde | Quem usa |
|---|---|---|
| **Calendário** | "O que eu devo comunicar agora?" | Franqueado lê; coordenadores de marketing e de operações montam. |
| **Luma Franqueado** | "Me dá a arte de oferta e varejo pronta." | Franqueado. **Existe.** |
| **Luma Ateliê** | "Faz a arte (ou o roteiro, o slide, o impresso) que não tem template." | Franqueado. **Em testes, só a gestão.** |
| **Auditor de marca** | "Como está o meu Instagram, de 0 a 100, pelo critério da marca?" | Franqueado e rede. **Projeto de outra frente da empresa.** |

O ciclo fecha: o **Calendário** diz o que fazer → o **Franqueado** e o **Ateliê** produzem → o
franqueado posta → o **Auditor** mede a qualidade e o **Datamatch** mede o resultado → os dois
números voltam para o **Calendário**, que mostra como a franquia e a rede estão indo.

---

## 2. Como os produtos conversam

```
                         ┌───────────────────────────┐
  Coord. marketing ────► │        CALENDÁRIO         │ ◄──── Datamatch (resultados por campanha)
  Coord. operações       │ campanhas · ofertas varejo│ ◄──── Auditor (nota do Instagram)
                         │ prazos de adesão · trends │
                         └─────┬──────────────┬──────┘
                    link direto│              │link direto
                               ▼              ▼
                      LUMA FRANQUEADO     LUMA ATELIÊ ◄──── Caça-trend (respostas pré-prontas)
                      (template)          (IA, sem template)
                               │              │
                               └──────┬───────┘
                                      ▼
                       peça postada pelo franqueado ──► Auditor mede
```

**A entidade que une tudo é a CAMPANHA.** Ela nasce no Calendário (data, vigência, ofertas,
prazo de adesão). As artes de template dela moram no Franqueado. Os assets e o playbook dela
moram no Ateliê (`08_ATELIE.md` §4.3, escopo `campanha:<id>`). O resultado dela vem do
Datamatch. Por isso todos os produtos precisam enxergar **o mesmo id de campanha**, numa tabela
só. Hoje ela já existe: `luma.pastas` (`fGetCampaigns`).

---

## 3. Separados na marca, juntos na base — decidido 21/10/2026

**Decisão do Ryan:** o Calendário tem **nome próprio e a mesma base** do Luma. O nome ainda está
em aberto (Q1).

O Ryan prefere o Calendário **fora** do Luma, com nome próprio, para ser realmente "o
calendário" que a rede vê. Concordo, com uma condição:

- **Separado na marca e na experiência:** nome próprio, endereço próprio, instalável como app
  (PWA), abre direto no calendário. O franqueado não precisa saber que é o Luma por trás.
- **Junto na base:** o mesmo Supabase, o mesmo login, a mesma RLS, a mesma tabela de campanhas.
  O link direto do Calendário para o Ateliê vira só "abrir com a campanha X ativa", e não uma
  integração entre dois sistemas.

Um produto separado de verdade (outro login, outro banco) dobra a manutenção e a superfície de
segurança, e o franqueado teria duas senhas. Isso vai contra a tese de tirar atrito.

Por que dá para fazer: o código do Calendário já existe neste repositório (`js/calendario/`,
3.449 linhas, prefixo `cal*`) e já abre a campanha e leva às artes dela. Ele pode ganhar uma
página de entrada própria reaproveitando o mesmo núcleo (`js/core/`), sem build e sem
dependência nova. Isso é uma decisão técnica a validar antes de começar (Q1).

O **Auditor** é de outra frente. Aqui ele entra só por contrato: a nota de 0 a 100 e os
critérios chegam por API ou n8n, e o Calendário e o Ateliê só leem.

---

## 4. O Calendário que a gente quer

### 4.1 Para o franqueado (lê)
- Clica na campanha e vê **os materiais de redes sociais dela**, já disponíveis automaticamente.
- **Link direto** para fazer a arte no Luma (template) ou no Ateliê (com a campanha ativa).
- **Prazo de adesão:** "registre sua participação até tal dia".
- **Inteligência ao vivo:** como a franquia dele está indo nesta campanha, comparada ao agregado
  da rede. Pela RLS, ele vê só os números dele e o agregado, nunca os de outra franquia.
- **Ofertas de varejo da franqueadora**, ilustradas no próprio dia.
- **Notificação por e-mail** quando sai campanha ou material novo.

### 4.2 Para os coordenadores (montam) — decidido 21/10/2026

Hoje o coordenador de marketing e o de operações montam o calendário de varejo todo mês, fora do
Luma. Eles passam a montar **dentro** do Calendário, pelas **duas portas**, sobre os mesmos dados:

- **Editor:** tela de mês onde eles criam, arrastam e ajustam campanhas e ofertas.
- **Chat de planejamento com IA:** eles descrevem o mês e a IA monta o rascunho. O chat tem
  fluxos que puxam dados, para planejar com embasamento:
  - **Passado:** calendários antigos da Delivery Much ("no ano passado, nesta data, rodou X").
  - **Resultado:** o que vendeu bem em cada data e campanha (Datamatch, §4.4). Por exemplo:
    "frete grátis na segunda semana de outubro vendeu 18% acima da média".
  - **Futuro:** feriados, datas do varejo, campanhas já marcadas e conflitos entre elas.
- O rascunho do chat abre no editor, para ajuste fino. **Publicar é um ato humano**: a IA
  rascunha e os coordenadores aprovam.
- **Pré-requisito:** o histórico precisa existir num lugar só. Os calendários antigos (planilhas
  e arquivos de cada mês) entram numa tabela, com a data e a campanha, e o resultado do Datamatch
  é ligado a eles pelo id da campanha. Hoje só agosto e setembro de 2026 estão portados
  (`js/calendario/conteudo.js`). Levantar até onde vai o histórico é a Q13.

### 4.3 De onde vem o material (Yungas)
- **Plano A:** API da Yungas, se existir (o Ryan está estudando; há relatos de que tem).
- **Plano B:** uma pasta do Google Drive organizada por campanha, lida automaticamente por um
  fluxo n8n que joga os arquivos no bucket do Supabase com o id da campanha.
- O Calendário só lê do Supabase. Trocar o plano A pelo B (ou o contrário) não muda a tela:
  `calFetch()` já é o único ponto de troca da fonte.

### 4.4 De onde vem o resultado (Datamatch)
- Os resultados por campanha já existem no Datamatch. Falta entender os fluxos e a forma de
  extrair.
- Um fluxo n8n extrai periodicamente e grava no Supabase, numa tabela por franquia e campanha.
  O Calendário lê dela. A frequência ("ao vivo" = diário? de hora em hora?) define o custo (Q6).

---

## 5. Caça-trend

- Um fluxo (n8n, agendado) varre trends e memes que estão saindo e gera uma **ficha de trend**:
  o que é, por que está em alta, se combina com a marca e uma proposta de peça.
- **Curadoria humana antes de chegar à rede:** trend e meme envelhecem rápido e podem ser
  arriscados para a marca. Quem aprova a ficha é o Ryan ou o marketing.
- Ficha aprovada vira uma **skill de trend no Ateliê**, com vigência curta. Se o franqueado pede
  algo nessa linha, a resposta já sai pré-pronta. O Calendário pode mostrar "trend da semana".

## 5b. Comunidade (WhatsApp) automatizada

Hoje o canal de comunidade da Delivery Much no WhatsApp depende de um administrador em tempo
integral. A meta é automatizar **por etapas**, autônomo mas **sempre com aprovação humana**.

**O que o canal faz e precisa continuar fazendo**
- Dinâmicas com cupom (a "panelinha"): o canal é comunidade, **não disparo em massa de ofertas**.
- Avisar campanhas que estão rolando (vem do Calendário).
- Criar e soltar cupom no **CleverTap**, dentro da verba de mídia dedicada ao canal.
- Arte de cada post feita pelo **Ateliê** (formato próprio para WhatsApp).

**O fluxo alvo**
```
Calendário (campanha) ─┐
Caça-trend ────────────┼─► AGENTE DA COMUNIDADE (n8n + IA) ─► rascunho do post:
Verba do canal ────────┘     texto + dinâmica + cupom proposto + arte (Ateliê)
                                          │
                               APROVAÇÃO HUMANA (1 clique: aprova / ajusta / recusa)
                                          │
                     cria o cupom no CleverTap ─► publica no WhatsApp ─► mede o resgate
```

**Etapas de autonomia** (cada uma só começa quando a anterior estiver estável):

| Etapa | O agente faz | O humano faz |
|---|---|---|
| 1 · Copiloto | Propõe o post da semana: texto, dinâmica, cupom sugerido e arte. | Cria o cupom, posta e responde. |
| 2 · Cupom assistido | Prepara o cupom no CleverTap como rascunho, dentro da verba. | Aprova o cupom e posta. |
| 3 · Publicação aprovada | Agenda e publica depois do "aprovo". | Aprova em um clique. |
| 4 · Autonomia parcial | Publica sozinho os tipos de baixo risco (aviso de campanha já aprovada). | Aprova só o que envolve cupom e dinâmica nova. |

**Regras que o código garante (não a IA)**
- **Teto de verba:** o agente nunca propõe cupom acima do saldo da verba do canal no período. O
  teto é número no código ou no banco, não instrução no prompt.
- **Mistura de conteúdo:** proporção máxima de posts de oferta por semana, para o canal não virar
  disparo em massa.
- **Frequência máxima** de posts por dia.
- **Nada sai sem aprovação** nas etapas 1 a 3.
- **Credenciais** do CleverTap e do WhatsApp ficam no servidor (n8n ou Edge Function), nunca no
  navegador.

**Riscos específicos**
- **API do WhatsApp:** *canal* (Channels) e *grupo/comunidade* são coisas diferentes para a Meta.
  Até onde sei, não há API oficial para publicar em Channels, e a de grupos é recente e limitada.
  Precisa ser verificado antes de qualquer etapa além da 2 (Q10). Automação não oficial arrisca
  o banimento do número.
- **Cupom vazado ou abusado:** limite de uso por cliente e validade curta no CleverTap.
- **Tom:** comunidade é relação. O agente precisa de um playbook de voz próprio do canal (skill),
  além do branding geral.

## 5c. Um dia no 360 (cenários = critério de pronto)

Como o ecossistema funciona no dia a dia, quando estiver pronto. Cidades e números são
ilustrativos. Cada cenário é também o **teste de aceitação** do que ele cita: o épico só está
pronto quando o cenário roda de ponta a ponta.

| # | Quando | Cenário | Produtos e épicos |
|---|---|---|---|
| 1 | Segunda, manhã | O franqueado de Erechim recebe o e-mail "saiu a campanha Frete Grátis de Outubro, adesão até quarta". No Calendário, abre a campanha, vê os 6 materiais vindos da Yungas e o aviso "na campanha parecida de julho, sua franquia vendeu 12% acima da média". Clica em "Fazer minha arte", gera no template e baixa em um minuto. Registra a adesão ali mesmo. | Calendário v1 e v2 · Franqueado · Datamatch |
| 2 | Terça | "Preciso de uma arte para anunciar que a pizzaria Bella Massa entrou no app", com a foto anexada. O concierge ativa a skill de arte, o diretor de arte usa só assets institucionais e saem 3 opções diferentes das da semana anterior. "Troca o fundo para laranja": a IA aplica o patch sem mexer no resto e guarda uma versão. | Ateliê E1, E2, E4, E5 |
| 3 | Quarta | O franqueado manda o print de um post de uma hamburgueria famosa: "nessa pegada para o burger do Zé". O Ateliê traduz a linguagem para o universo DM. O print fica só na sessão dele. | Ateliê E3.3, E4.4 |
| 4 | Quinta | "Tem material de rede social para essa semana?" → lista e baixa. "Quais wind banners a gente tem?" → 4 mockups, escolhe um e baixa o arquivo de impressão já fechado. | Ateliê E7, E8 |
| 5 | Sexta | "Preciso de uma apresentação para convencer a padaria Pão Quente a entrar no app" → deck de 5 slides no template de 2026. "Agora me faz um roteiro de 30 segundos" → o modo copy entrega. | Ateliê E9, E10 |
| 6 | Todo dia | O agente da comunidade cruza o Calendário, a verba do canal (R$ 1.200 restantes) e o caça-trend. Monta a dinâmica "o primeiro que comentar o pedido de sexta ganha o cupom", com cupom de R$ 10 para 50 usos e arte do Ateliê. O administrador aprova em um clique, o cupom nasce no CleverTap e o post sai. À noite: 41 de 50 resgatados. | Comunidade §5b · Ateliê · Caça-trend |
| 7 | Fim do mês | O coordenador de marketing pede no chat de planejamento: "monta novembro: Black Friday, prévia de Natal e a campanha de pizzaria". A IA responde com dados do passado ("a Black Friday concentrou 70% das vendas na sexta e no sábado; a campanha de pizzaria colide na semana 4, a semana 2 vendeu 15% acima da média em 2025"). O rascunho abre no editor, o coordenador de operações ajusta duas datas e os dois publicam. A rede recebe o e-mail. | Calendário v2 §4.2 · Datamatch |
| 8 | Lançamento sazonal | O designer da campanha de Natal sobe os assets (vigência de 1 a 31/12), as regras e o playbook, que vira uma skill do Ateliê. Em 1º/12, todo pedido genérico já sai com a cara de Natal; em 1º/1, os assets somem sozinhos. | Ateliê E2.3, E6 |
| 9 | Toda semana | O Auditor dá a nota do Instagram de cada franquia. A de Erechim subiu de 54 para 78 em dois meses. O franqueado vê a nota no Calendário junto dos resultados; a rede vê quem está abaixo de 50 e oferece ajuda. | Auditor · Calendário |
| 10 | 7h, por fora | O n8n lê no Datamatch o aniversariante do dia. O Ateliê preenche o template e o RH recebe o e-mail com a arte pronta. | RH (`08_ATELIE.md` E11) |

**O fio que liga tudo:** o franqueado nunca começa do zero. O Calendário diz o quê, o Franqueado
e o Ateliê fazem, a comunidade amplifica, e o Datamatch e o Auditor dizem se funcionou. Isso volta
para o planejamento do mês seguinte.

## 5d. Ideias registradas (21/10/2026)

Ideias aprovadas pelo Ryan para o roadmap. As três primeiras são as prioritárias.

### Prioritárias

**I1 · Cupom único por arte: medir o que cada peça vendeu.**
Hoje dá para saber o resultado de uma campanha, mas não de uma *arte*. Cada peça gerada no Luma ou
no Ateliê leva um código de cupom próprio, criado no CleverTap, e assim se sabe qual arte vendeu.
Isso fecha o ciclo:
- o Ateliê aprende quais direções de arte **vendem** mais, e não só quais ficam bonitas;
- o franqueado vê "sua arte de sexta trouxe 23 pedidos";
- a curadoria ganha um dado objetivo, além do gosto do Ryan.

É a ideia de maior impacto: transforma o 360 de "produzir arte" em "produzir resultado".
Depende da integração com o CleverTap (Q11) e de ligar o resgate do cupom à arte (Datamatch).

**I2 · "Sua semana pronta": o Ateliê trabalha antes de o franqueado pedir.**
Toda segunda, o Ateliê gera 3 a 5 peças para cada franqueado, com os dados dele (lojas parceiras,
campanha ativa, trend aprovada). Ele recebe o aviso "sua semana está pronta, revise e baixe". O
esforço cai de "pedir" para "aprovar". Para quem não tem tempo nem ideia, é a diferença entre usar
e não usar. Roda agendado (n8n) e conta na cota de IA (decidir como, Q2 do `08_ATELIE.md`).

**I3 · Arte co-branded para o lojista parceiro.**
O restaurante parceiro quer postar que está no app, mas não tem arte. O franqueado gera uma peça
co-branded (marca do lojista com a DM) e manda para ele postar no próprio Instagram. Multiplica o
alcance sem mídia paga, e o lojista vira divulgador. **O franqueado aprova antes**, para a marca DM
não sair sem controle. Pede regra de co-branding (proporção e posição das duas marcas) no
playbook. **Em avaliação (27/10/2026):** transformar o lojista em **usuário** do Luma (conta
própria, catálogo, fotos) — hipótese, riscos e critérios em
`docs/DISCOVERY-LOJISTAS-2026-10-27.md`. Não é decisão.

### Para guardar no roadmap

- **I4 · Foto do lojista tratada pela IA:** a foto ruim do produto costuma ser o ponto fraco da
  arte. Recortar, melhorar a luz e o fundo antes de entrar na composição eleva todas as peças. O
  slot `foto_produto` já existe.
- **I5 · Ateliê pelo WhatsApp:** o franqueado pede a arte direto pelo WhatsApp, sem abrir o app.
  Enorme potencial de adoção; depende da mesma questão de API da comunidade (Q10).
- **I6 · Kit de lançamento de franquia nova:** no primeiro acesso, o Ateliê gera o pacote
  "chegamos na cidade" (posts, stories, impressos, mensagem para os lojistas). O primeiro mês é o
  mais difícil para o franqueado.
- **I7 · Relatório mensal automático:** PDF ou e-mail "seu mês no marketing", com o que postou, a
  nota do Auditor, os resultados e as sugestões para o mês seguinte. O franqueado sente o valor, e
  a rede tem o que mostrar.
- **I8 · Voz regional:** a copy se adapta à região (expressões do Sul são diferentes das do
  Nordeste), sem fugir do branding. Uma camada do playbook de voz.
- **I9 · Memória do franqueado:** o Ateliê lembra das lojas parceiras dele, do estilo que ele
  prefere e do que já postou, sem ele repetir a cada sessão. Hoje a sessão fica só no aparelho;
  isso pede guardar no Supabase o que é dele (com RLS), sem a referência externa (D3 do
  `08_ATELIE.md`).

## 5e. Automações registradas (21/10/2026)

Formato: **gatilho → ação → quem aprova**. Quase todas rodam no **n8n**, lendo do Supabase e
chamando o Ateliê. **Nenhuma publica nada sem humano**, exceto avisos e lembretes.

### Para o franqueado

| ID | Gatilho | Ação | Aprova |
|---|---|---|---|
| A1 | Franqueado sem gerar arte há 10 dias. | E-mail ou WhatsApp com "sua semana pronta" (I2) e uma peça da campanha ativa já feita. | Ninguém (é aviso). |
| A2 | Loja parceira nova cadastrada no app. | O Ateliê gera a arte "chegou no app" e a versão co-branded (I3). | O franqueado, que manda para o lojista. |
| A3 | Preço ou cardápio da loja mudou no app. | As artes ativas com aquele produto ficam marcadas "desatualizadas", com o botão "refazer com o preço novo". | O franqueado refaz. |
| A4 | Data local chegando (aniversário da cidade, feira, jogo do time da região), 2 semanas antes. | Sugestão de arte no Calendário dele. Pede tabela de datas por cidade, que os franqueados podem alimentar. | O franqueado. |
| A5 | Previsão de chuva ou frio no fim de semana. | Sugestão "dia de chuva é dia de delivery" com arte pronta. | O franqueado. |

### Para a rede (franqueadora)

| ID | Gatilho | Ação | Aprova |
|---|---|---|---|
| A6 | Nota do Auditor cai, ou franquia 2 semanas sem postar. | Alerta para o consultor de campo, com o contexto ("parou de postar desde o dia 3, nota caiu de 72 para 51"). | Ninguém (é alerta interno). |
| A7 | Fim do mês. | Ranking: quem mais postou, mais vendeu por arte (I1) ou mais subiu de nota → post de destaque na comunidade de franqueados. | O marketing. |
| A8 | Prazo de adesão acaba em 2 dias e a franquia não aderiu. | Lembrete automático. Depois do prazo, relatório de adesão para a coordenação. | Ninguém (é lembrete). |
| A9 | Campanha publicada no Calendário. | O n8n monta o e-mail de lançamento para a rede (o que é, prazo, materiais, link para o Ateliê) e o post para a comunidade de franqueados. | O coordenador. |

### Para o time interno

| ID | Gatilho | Ação | Aprova |
|---|---|---|---|
| A10 | Toda noite. | A bancada roda sobre os pedidos do dia (sem dados pessoais) e registra a nota média e as reprovadas → relatório semanal para o Ryan com os 5 piores casos. É o painel de curadoria. | — |
| A11 | Asset de campanha vence em 7 dias. | Aviso para o designer da campanha: renovar ou deixar expirar. | O designer. |
| A12 | O concierge não acha skill para o pedido, ou o franqueado desiste no meio. | O pedido entra na fila de "demanda não atendida". É o termômetro do que construir a seguir. | — |
| A13 | Gasto diário de IA passa do teto. | Alerta e, se preciso, o Ateliê troca para um modo econômico. Com o Flash high em tudo, esse controle é obrigatório. | O Ryan. |

### As 3 primeiras

- **A12 · Demanda não atendida:** custa quase nada e diz, com dado real, o que o roadmap deve
  priorizar.
- **A3 · Preço desatualizado:** previne o erro mais caro do marketing de delivery, o cliente pedir
  e o preço ser outro.
- **A5 · Clima:** gatilho simples, gera arte e venda no momento certo, e é fácil de medir com o
  cupom por arte (I1).

---

## 6. Ordem sugerida (para não se perder)

A regra é **uma frente por vez**, e cada uma tem que entregar valor sozinha:

1. **Ateliê, Fase 1** (`08_ATELIE.md` §5): concierge e bibliotecas. É a base de todo o resto, e o
   Calendário depende dos assets por campanha.
2. **Calendário v1 só de leitura:** campanhas do mês, materiais da campanha (Yungas ou Drive) e
   link direto para o Luma e o Ateliê. Sem inteligência ainda.
3. **Calendário v2, montado pelos coordenadores:** editor ou chat de planejamento (Q4) e
   notificações por e-mail.
4. **Dados:** resultados do Datamatch e nota do Auditor no Calendário.
5. **Caça-trend.**
6. **Comunidade WhatsApp**, etapa por etapa (§5b). A etapa 1 (copiloto) pode começar assim que o
   Ateliê tiver o formato de WhatsApp, porque não depende de API nenhuma.

O RH (`08_ATELIE.md` E11) corre por fora, porque é outro público e não depende dessa fila.

---

## 7. Riscos

| # | Risco | O que fazer |
|---|---|---|
| R1 | **Escopo enorme**, com quatro produtos e muitas integrações. | A ordem do §6, uma frente por vez, cada uma com pronto medível. |
| R2 | **Calendário errado é pior que nenhum.** Foi o que travou a primeira versão (fonte do dado). | Não lançar sem fonte automática (Yungas ou Drive) e sem estado honesto (o rodapé com a fonte já existe). |
| R3 | **Dados de desempenho por franquia** são sensíveis entre franqueados. | RLS: cada franquia vê só os dados dela e o agregado da rede. |
| R4 | **Trend e meme** podem ferir a marca ou envelhecer em dias. | Curadoria humana e vigência curta. |
| R5 | **Dependência de outras frentes** (Auditor, Datamatch, Yungas). | Integração só por contrato (API ou n8n gravando no Supabase), para que nenhum produto quebre quando o outro mudar. |
| R6 | **E-mail em massa** para a rede. | Opt-out, frequência máxima e só quando há novidade real. |

---

## 8. Perguntas em aberto

| # | Pergunta |
|---|---|
| Q1 | ~~Nome próprio e mesma base?~~ **Sim (Ryan, 21/10).** Falta: qual é o nome? |
| Q2 | Yungas tem API? (O Ryan está estudando.) Se não tiver, o plano B é o Google Drive? |
| Q3 | Datamatch: como se extrai o resultado por campanha (API, exportação, banco)? Quem é o contato? |
| Q4 | ~~Editor ou chat?~~ **Os dois (Ryan, 21/10)**, com o chat puxando passado, resultados e futuro (§4.2). |
| Q5 | Adesão à campanha: o que muda para quem adere e para quem não adere? |
| Q6 | "Ao vivo" no Calendário é com que frequência? Diário basta? |
| Q7 | Auditor de marca: quem é o dono da outra frente, e ele já expõe a nota por API? |
| Q8 | Caça-trend: quem aprova a ficha de trend, e em quanto tempo? |
| Q10 | WhatsApp: o canal da DM é *Channel* ou *grupo/comunidade*? Qual API oficial cobre a publicação? |
| Q11 | CleverTap: qual a verba mensal do canal, e quem aprova cupom hoje? A API permite criar cupom como rascunho? |
| Q12 | Quais dinâmicas da "panelinha" funcionam hoje (exemplos reais), para virar o playbook do agente? |
| Q9 | ~~Por que o Calendário saiu em 04/10?~~ **Foco na v1 (Ryan, 21/10).** Não foi problema do módulo; a fonte do dado continua sendo o risco R2. |
| Q14 | Métrica norte do 360 (proposta: "% de franquias que postam ≥ 3 vezes por semana com material da marca"). Cada ideia entra na fila pelo quanto move essa métrica. Aceita? |
| Q15 | Fontes de dado das automações: o cadastro de loja nova e a mudança de preço (A2, A3) saem de qual sistema, e o n8n consegue ler? Qual API de clima (A5)? |
| Q13 | Até onde vai o histórico de calendários da DM, e em que formato está (planilha, Drive, e-mail)? |
