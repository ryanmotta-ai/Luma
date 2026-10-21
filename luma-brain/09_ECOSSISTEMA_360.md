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

## 3. Recomendação: separados na marca, juntos na base

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

### 4.2 Para os coordenadores (montam)
Hoje o coordenador de marketing e o de operações montam o calendário de varejo todo mês, fora do
Luma. A ideia é eles montarem **dentro** do Calendário. Duas formas, a decidir (Q4):

- **A · Editor com sugestão:** tela de mês onde eles arrastam campanhas e ofertas, e a IA sugere
  datas, conflitos e oportunidades (feriado, data do varejo, campanha que se sobrepõe).
- **B · Chat de planejamento:** eles descrevem o mês ("outubro: Dia das Crianças, Black Friday
  prévia, frete grátis na segunda semana") e a IA monta o rascunho; eles revisam e publicam.

Em qualquer das duas, **publicar é um ato humano**. A IA rascunha e eles aprovam.

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
| Q1 | Calendário com nome e endereço próprios, mas no mesmo repositório e no mesmo Supabase: aceito? Que nome? |
| Q2 | Yungas tem API? (O Ryan está estudando.) Se não tiver, o plano B é o Google Drive? |
| Q3 | Datamatch: como se extrai o resultado por campanha (API, exportação, banco)? Quem é o contato? |
| Q4 | Coordenadores montam o calendário pelo editor com sugestão (A) ou pelo chat de planejamento (B)? |
| Q5 | Adesão à campanha: o que muda para quem adere e para quem não adere? |
| Q6 | "Ao vivo" no Calendário é com que frequência? Diário basta? |
| Q7 | Auditor de marca: quem é o dono da outra frente, e ele já expõe a nota por API? |
| Q8 | Caça-trend: quem aprova a ficha de trend, e em quanto tempo? |
| Q10 | WhatsApp: o canal da DM é *Channel* ou *grupo/comunidade*? Qual API oficial cobre a publicação? |
| Q11 | CleverTap: qual a verba mensal do canal, e quem aprova cupom hoje? A API permite criar cupom como rascunho? |
| Q12 | Quais dinâmicas da "panelinha" funcionam hoje (exemplos reais), para virar o playbook do agente? |
| Q9 | Por que o Calendário saiu em 04/10? Foi a fonte do dado, o foco na v1 ou outro motivo? |
