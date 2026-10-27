# Discovery — Luma para lojistas locais

> **Status: hipótese em avaliação. Não é decisão, não é roadmap.** Escrito em 27/10/2026 a
> partir da conversa com o Ryan. **Dono: Ryan.** Serve para amanhã levantar a hipótese com o
> Pedro e, depois, decidir com dado — não para começar a construir.

---

## 1. A pergunta de decisão

**Faz sentido o lojista local (restaurante parceiro do app) usar o Luma com conta própria — e
sob qual modelo?**

Três perguntas vêm grudadas nela e precisam de resposta antes de qualquer linha de código:

1. **Quem opera?** O franqueado (dono da cidade e do relacionamento) ou a DM direto?
2. **Quem paga?** O lojista (assinatura), o franqueado (assento) ou ninguém (vira retenção)?
3. **Quem responde pela marca** quando o lojista erra a peça e ela vai para o Instagram dele?

⛔ **Isto contraria uma decisão escrita.** `00_PRODUCT` §9: o Luma "não é multi-marca / SaaS
externo — é ferramenta interna da Delivery Much, não vendida a terceiros". Abrir para lojista é
mudança de escopo, não feature. Só vale se o retorno justificar a virada.

---

## 2. De onde a gente parte (não é do zero)

- O lojista **já é parceiro** do app: ~10 mil restaurantes, +100 cidades, comissão de ~12%
  dividida entre franqueado e franqueadora (`00_PRODUCT` §1). Não é um estranho: é o cliente do
  franqueado.
- O franqueado **já faz marketing por ele** — em parceria com os estabelecimentos é atribuição
  explícita dele (`00_PRODUCT` §1). Hoje isso sai no Canva/WhatsApp.
- **A metade da distribuição já está desenhada:** `09_ECOSSISTEMA_360` §I3 — arte *co-branded*
  para o lojista parceiro postar no Instagram dele, com o **franqueado aprovando antes**. O
  lojista é destinatário da peça, não usuário do Luma.
- **O motor existe e é reaproveitável:** Luma Creative (IA), catálogo de composições, campos com
  trilho de permissão, encaixe de texto, biblioteca de fotos por franquia (bucket privado por
  unidade, 27/10/2026), cota de gerações.
- **O que NÃO existe:** papel/tenant de lojista, catálogo por segmento, onboarding self-serve,
  cobrança, revisão de marca em escala e suporte para milhares de contas.

---

## 3. Segmento e job

**Segmento do teste:** restaurante **parceiro do app**, em cidade de franquia ativa. Não "qualquer
loja local" — o vínculo comercial já existe e é o que dá acesso, contexto e canal.

**Job to be done:** *"Quero postar a promoção de hoje no meu Instagram sem designer, sem sair do
padrão da Delivery Much e sem depender de alguém."*

Dores observáveis hoje: monta no Canva ou pede no ChatGPT; manda foto ruim no WhatsApp do
franqueado; espera; às vezes publica fora da marca; promoção boa não sai porque "não deu tempo de
fazer a arte".

---

## 4. Hipóteses (o que o discovery precisa derrubar ou confirmar)

| # | Hipótese | Sinal que confirma | Sinal que derruba |
|---|---|---|---|
| H1 | O lojista quer **fazer sozinho**, não só receber pronto | ≥50% usariam 2×/mês; preferem self-serve a pedir | Preferem continuar pedindo ao franqueado |
| H2 | O franqueado vê como **receita/retenção**, não ameaça | ≥3 de 4 topam operar e vender | "Isso é meu trabalho, não quero dividir" |
| H3 | A marca **aguenta** sem revisor humano | Erro de marca <5% no teste concierge | Peça fora do padrão em 1 de cada 5 |
| H4 | **Alguém paga** | ≥3 de 6 aceitam ≥R$49/mês **ou** franqueado paga por assento | Ninguém paga; só usariam de graça |

---

## 5. Riscos (em ordem de gravidade)

1. **Conflito de canal.** DM vendendo direto ao lojista atropela a exclusividade territorial, que
   é a base da franquia. É a razão nº 1 para o piloto ser operado pelo franqueado.
2. **Marca sob terceiro.** Hoje o franqueado é o filtro humano. Com milhares de lojistas, a peça
   sai sem revisor — e o erro vira print no Instagram da cidade.
3. **Quem autora os templates do lojista.** O catálogo é da rede; lojista precisa de peças por
   segmento (pizza, açaí, japonês) e por objetivo (combo, taxa grátis). É trabalho de design novo
   e contínuo.
4. **Multi-tenant de verdade.** Isolamento por loja, papéis novos, cota por loja, onboarding sem
   suporte humano. É a maior obra técnica do caminho — e a mais fácil de começar cedo demais.
5. **Suporte e cobrança.** O suporte é a equipe DM, ao vivo. Milhares de lojistas não cabem nisso;
   e não há billing no produto.

---

## 6. Modelos possíveis

| Modelo | Como funciona | Prós | Contras |
|---|---|---|---|
| **A. Franqueado opera** | Lojista usa "pelo" franqueado; DM cobra do franqueado ou divide receita | Respeita o território, usa o relacionamento, franqueado ganha retenção e receita | Escala no ritmo do franqueado; exige playbook |
| **B. DM vende direto** | Assinatura do lojista com a DM | Escala e margem direta | Conflito com a franquia; suporte e marca caem na DM |
| **C. White-label** | Franqueado vira a "agência de marketing da cidade" com a marca dele | Mais defensável no longo prazo | O mais caro; exige produto e operação próprios |

**Recomendação:** piloto no **modelo A**. O franqueado é vendedor, operador e revisor de marca.
Se funcionar, **C** é a evolução natural.

---

## 7. Plano de validação (2–3 semanas, sem construir produto)

**a) Entrevistas — 12 pessoas.** 6 lojistas de 2 cidades (3 que já pedem arte ao franqueado, 3 que
nunca pediram), 4 franqueados, 2 da DM. Roteiro de job, não de feature: *"como saiu a última
promoção que você postou? quanto tempo levou? quem fez? o que deu errado?"*

**b) Teste concierge.** Com 2–3 lojistas, a equipe produz **3 artes para cada** no Luma atual,
usando um template genérico e as fotos da biblioteca da franquia. Mede: tempo até a arte,
retrabalho, reação do lojista.

**c) Disposição a pagar.** Três faixas (R$ 29, R$ 49, R$ 99/mês) apresentadas como "o franqueado
oferece". O que vale não é o "sim" da conversa — é quem aceita entrar no piloto pagando.

**Métricas a registrar:** tempo até a arte, artes por lojista/mês, retrabalho, erro de marca,
aceite de preço, e a leitura do franqueado (receita × ameaça).

---

## 8. Critérios de go/no-go (antes de escrever multitenancy)

- ≥ 50% dos lojistas entrevistados usariam **2× ou mais por mês**;
- ≥ 3 de 6 aceitam pagar **≥ R$ 49/mês** (ou o franqueado aceita pagar por assento);
- ≥ 3 de 4 franqueados veem como **receita/retenção**, não ameaça;
- erro de marca sem revisor **< 5%** no teste concierge;
- suporte estimado **< 1 chamado por lojista/mês**.

**Se dois falharem, não constrói.** O produto, então, é só "o franqueado gera a peça com o nome e
o logo do parceiro" — que já dá para fazer hoje com campos, foto e a arte co-branded do I3.

---

## 9. O que não fazer agora

- Cadastro self-serve de lojista.
- Billing/assinatura.
- Papel `lojista` no banco e catálogo por segmento.
- Multitenancy por loja.

A tentação é começar pelo multitenancy porque é a parte "de engenharia" — e é exatamente a que
fica cara se a demanda não existir.

---

## 10. Decisões em aberto (para a conversa de amanhã)

1. **Segmento:** só parceiro do app ou qualquer loja local?
2. **Quem vende:** franqueado (A) ou DM (B)?
3. **Objetivo:** nova receita ou retenção de lojista/GMV? Muda a métrica de sucesso.
4. **Cidades do piloto:** quais 2, e com qual franqueado?
5. **Marca do lojista:** ele pode usar a marca DM no perfil dele? Com que regra de co-branding?

---

## 11. Referências internas

- `luma-brain/00_PRODUCT.md` §1 (rede, números), §9 (o que o Luma não é — inclui "não é SaaS").
- `luma-brain/01_BUSINESS.md` §1 (franquias, exclusividade), §10 (o Luma não envia mensagem).
- `luma-brain/09_ECOSSISTEMA_360.md` §I3 (arte co-branded para o lojista, aprovada pelo franqueado).
- `luma-brain/07_ROADMAP.md` (o que já está comprometido).
- Reaproveitável no código: `js/creative/*` (Creative/IA), catálogo e biblioteca de fotos por
  franquia (`js/franqueado/fotos.js`), campos e encaixe de texto (`js/core/local-fit.js`).
