# 00 — PRODUTO · O que é o Luma

> Documento fundacional do `luma-brain`. Responde, em uma leitura: **qual o propósito**, **quem usa**, **qual problema resolve** e **o que o produto NÃO faz**.
> Antes de mexer no código, leia também `docs/LUMA.md` (documentação técnica oficial). Este arquivo é o "porquê"; o `LUMA.md` é o "como".
> Última revisão: 2026-07-15.

---

## Em uma frase

**Luma é a plataforma interna de _creative automation_ da Delivery Much:** o time de design cria templates de arte uma vez, e o franqueado — sem saber design — gera a peça pronta para postar (PNG/JPG/PDF) respondendo a um chat guiado em cerca de um minuto.

---

## 1. O contexto: quem é a Delivery Much

Entender o Luma exige entender quem vai usá-lo.

A **Delivery Much** (razão social _Delivery Much Tecnologia S.A._) é a **maior franquia de app de delivery do Brasil**. Foi fundada em **2011, em Santa Maria (RS)**, por Pedro Judacheski e Guilherme Kruel, e transferiu a sede administrativa para **Florianópolis (SC)** em 2017. São ~14 anos de mercado.

O posicionamento é o que importa aqui: a Delivery Much é **"o maior app de comida do interior do Brasil"**. Enquanto os grandes aplicativos "só atendem em capitais ou grandes centros", a Delivery Much leva delivery para **cidades do interior** — tipicamente municípios de **até ~150 mil habitantes** (o material comercial mais recente foca em **até 80 mil**). O diferencial declarado é o **hiperlocalismo**: _"o dono do app mora na cidade, frequenta os restaurantes que estão no aplicativo e convive diariamente com parceiros e usuários"_.

**Como funciona a franquia** (o dado central para o Luma):

- **1 franqueado por cidade**, com **exclusividade territorial**. Investimento inicial a partir de **R$ 18 mil**.
- O franqueado é **"o dono do aplicativo na sua cidade"** — responsável por **atrair usuários e lojistas parceiros**, **prospectar e cadastrar estabelecimentos**, e **fazer marketing e promoções locais**.
- Modelo de receita: comissão de ~**12%** sobre as vendas dos restaurantes, dividida ~50/50 entre franqueado e franqueadora, mais um ecossistema (supermercados, logística, cardápio digital, clube de vantagens **Much+**).
- Escala atual: **+100 cidades**, **14 estados**, **+10 mil restaurantes parceiros**, **3–4 milhões de usuários**.

**Onde entra a dor que o Luma resolve.** Marketing local é atribuição explícita do franqueado: _"em parceria com os estabelecimentos, o franqueado tem liberdade para identificar oportunidades locais e elaborar promoções para aumentar as vendas. Isso inclui ações presenciais e digitais"_ — e vai **"para além das campanhas nacionais"** da franqueadora. Na prática, isso significa um fluxo **constante e repetitivo** de peças gráficas: combos, descontos, "de/por", novos parceiros, ações do Much+, datas comemorativas — para o app, para as redes sociais da unidade e para ajudar os restaurantes parceiros a vender.

O franqueado do interior **não é designer** e não tem agência. Ou ele improvisa (Canva, ChatGPT, WhatsApp), demora e foge da marca; ou depende de um time central que vira gargalo. **É esse gap que o Luma fecha.**

---

## 2. O problema que o Luma resolve

| Antes do Luma | Com o Luma |
|---|---|
| Franqueado improvisa arte no Canva/ChatGPT — lento, fora do padrão da marca | Responde um chat guiado; a arte sai pronta e **sempre dentro da marca** |
| Time de design central atende pedido a pedido — vira gargalo | Design cria o **template uma vez**; o franqueado se serve sozinho, N vezes |
| Ferramentas pagas (Deskfy, Placid) e retrabalho manual | Ferramenta **interna**, sem custo por peça, feita para o vocabulário da DM |
| Cada franqueado gera uma "marca" diferente | Consistência garantida pelos templates + regras definidas pelo designer |

Em resumo, o Luma ataca três dores de uma vez: **velocidade** (segundos em vez de horas), **consistência de marca** (o franqueado não consegue "sair do trilho") e **escala** (um template serve centenas de cidades sem tocar no time central).

---

## 3. Missão

**Fazer qualquer franqueado da Delivery Much — mesmo sem repertório de design — produzir arte de marketing profissional e dentro da marca, em minutos, sozinho.**

Transformar a criação de peças de um trabalho de especialista em uma **conversa guiada**: o design vira uma decisão feita _uma vez_ pelo time central; a execução vira _autoatendimento_ na ponta.

---

## 4. Visão

Ser o **sistema operacional de comunicação visual da rede Delivery Much** — do primeiro post de lançamento de uma cidade nova ao inapp/push de uma campanha nacional.

O caminho:

1. **Hoje** — gerador de artes estáticas (posts/stories/feed) self-service para o franqueado, com editor de templates para o time de design.
2. **Próximo** — dados de performance criativa por extração SQL/BI e um Brand Guardian que impede peça fora da marca antes de publicar.
3. **Depois** — CRM Visual: os mesmos templates alimentando inapp, push e comunicação (hoje montados à mão no ChatGPT + CleverTap).

Objetivo de longo prazo: qualquer comunicação visual da rede — arte, inapp, push — nasce no Luma, correta por construção.

---

## 5. Objetivos

**De produto (o que perseguimos):**

- **Tempo até a arte pronta < 1 minuto**, sem conhecimento de design.
- **Zero peça fora da marca** publicada pela rede.
- **Um template, muitas cidades** — o esforço do time de design não escala com o número de franqueados.
- **Autonomia do franqueado**: reduzir a fila no time central de design a quase zero.

**De negócio (por que isso importa para a DM):**

- Substituir ferramentas pagas (Deskfy, Placid) e trabalho manual por uma stack interna.
- Acelerar o **lançamento de cidades novas** (parte do investimento inicial já é marketing).
- Aumentar a **frequência e a qualidade** das promoções locais — que puxam GMV, a base da comissão.
- Preparar terreno para decisões guiadas por dado (analytics por extração SQL/BI) e para o CRM Visual.

---

## 6. Público (quem usa)

O Luma tem **três papéis**, refletidos nos _roles_ do backend (`franqueado`, `equipe_dm`, `gestao`):

### Franqueado — o usuário final
O dono do app numa cidade do interior. **Não sabe design.** Quer uma arte de combo/desconto pronta para postar, agora, sem errar a marca. Abre uma campanha, responde um chat (produto, preço, foto) e baixa o PNG/PDF. É o público de maior volume e a razão de existir do produto.

### Designer / Estúdio — o time de design da DM
Cria e publica os **templates** que o franqueado consome. Trabalha num editor estilo Canva/Photoshop, define os **campos** que o franqueado vai preencher (`{{produto}}`, `{{preco}}`, `foto_produto`…), as permissões e a validade, e publica no catálogo. Faz o trabalho _uma vez_ para servir a rede inteira.

### Gestão — a liderança da rede
Tudo acima, mais administração de usuários e leitura de analytics por extração SQL/BI. Enxerga o uso consolidado (quem gera, o que converte) e governa a marca.

> **Ponte entre os papéis:** o **sistema de campos** (`{{variáveis}}`) e um **interpolador único** compartilhado entre a simulação do designer, a prévia ao vivo e o gerador final — o que o designer monta é exatamente o que o franqueado obtém.

---

## 7. Módulos

| # | Módulo | Para quem | O que faz | Status |
|---|--------|-----------|-----------|--------|
| 1 | **Franqueado** | Franqueado | Catálogo de campanhas → chat guiado → arte pronta (PNG/PDF), com prévia ao vivo e histórico | ✅ Em produção |
| 2 | **Designer / Estúdio** | Time de design | Editor visual de templates: camadas, campos, regras, permissões, publicação; import de PSD/SVG | ✅ Funcional, em refino |
| 3 | **CRM Visual** | Time / Gestão | Editor de inapp e push para o CleverTap, com os mesmos templates e Brand Guardian | 💡 Planejado |

Detalhes técnicos de cada módulo em `docs/LUMA.md`.

---

## 8. Diferenciais

O que torna o Luma diferente de um Canva genérico ou de uma ferramenta paga:

- **Feito para a Delivery Much, não para o mundo.** Fala o vocabulário da DM (campanhas, combos, Much+, formatos de post/story/feed) e carrega a marca por padrão.
- **Autoatendimento com trilho de marca.** O franqueado tem liberdade _dentro_ dos limites que o designer definiu — ele preenche campos, não redesenha. É impossível "sair da marca" sem querer.
- **Um interpolador único.** A simulação do designer, a prévia do franqueado e o PNG final usam o mesmo motor — o que se vê é o que se gera, sem surpresa.
- **Escala do interior.** Um template publicado serve +100 cidades ao mesmo tempo; o esforço do time central não cresce com a rede.
- **Interno e sem custo por peça.** Substitui Deskfy/Placid; os dados e as artes ficam na casa.
- **Pensado para a ponta.** O franqueado do interior, muitas vezes operando sozinho ("pelo menos 6 horas diárias"), consegue uma peça profissional sem depender de ninguém.

---

## 9. O que o Luma NÃO faz (fora de escopo)

Tão importante quanto o propósito — evita expectativa errada e _scope creep_:

- **Não é um editor de design de propósito geral.** Não compete com Canva/Figma/Photoshop. O franqueado **não** desenha do zero — ele preenche templates. Liberdade criativa total é do designer, não da ponta.
- **Não é a operação do delivery.** Não gerencia pedidos, cardápio, restaurantes, entregadores, pagamentos ou o app de delivery em si. Isso é o ecossistema da Delivery Much; o Luma cuida **só da comunicação visual**.
- **Não é o CleverTap nem uma ferramenta de disparo.** O módulo CRM Visual (planejado) _prepara_ inapp/push compatíveis; o envio segue na plataforma de CRM.
- **Não é uma rede social nem agendador de posts.** Ele **gera** a arte; publicar no Instagram/status é passo manual do franqueado (por ora).
- **Não gera texto/copy por IA como função central.** O foco é a **peça visual**; sugestões de conteúdo são auxiliares, não o produto.
- **Não é multi-marca / SaaS externo.** É uma **ferramenta interna da Delivery Much** — não é vendido a terceiros.
- **Não substitui o julgamento de marca humano.** Ele reduz o erro, mas a curadoria dos templates e das regras é do time de design.

---

## 10. Como este documento se conecta ao resto do `luma-brain`

Este é o **"porquê"** (produto, público, propósito). Para o **"como"** (arquitetura, código, backend, convenções), a fonte é `docs/LUMA.md`. Feature nova ou mudança de rumo que afete propósito, público ou escopo → atualizar **este** arquivo.

**Fontes da parte Delivery Much:** site oficial de franquias (`franquiasdeliverymuch.com.br`), blog institucional (`blog.deliverymuch.com.br/delivery-much-como-funciona`) e matéria do G1/SC sobre os 14 anos da empresa (nov/2025). Números e citações refletem o material público em jul/2026 — reconferir quando forem para peças oficiais.
