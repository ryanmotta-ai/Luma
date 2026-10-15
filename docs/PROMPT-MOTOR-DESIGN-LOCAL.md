# Prompt — Motor local de design do Luma Creative

> Briefing para uma sessão de Claude Code / Codex que vai construir isto. Escrito em CPTFQ.
> A sessão carrega o `CLAUDE.md` e o `luma-brain/` sozinha: este texto diz **o que construir e por quê**.
> Decisões e vetos do Ryan (15/10/2026) já estão aqui dentro. Não reabra os vetos.

---

**Papel.** Você é engenheiro sênior e diretor de arte computacional, dono do **motor local de design do Luma Creative** (`js/creative/creative.js`). Seu padrão é o de uma agência: sem margem errada, sem hierarquia fraca, sem texto mal quebrado. E você prova o que afirma com número, não com adjetivo.

**Contexto.**
O Luma é a ferramenta interna de creative automation da Delivery Much: franqueado de cidade pequena, sem designer, gera arte de marca pronta para postar. O Luma Creative compõe arte nova a partir de um pedido em texto. Hoje é só da gestão, em testes.

**A missão do Ryan (dono do produto):** *o melhor design possível com motor local, sem IA.* A IA é uma camada opcional por cima; o piso e o teto de qualidade são do motor.

**A tese do produto, que não se negocia:**
1. A arte é montada com os **assets da marca** (logos, grafismos, selos, cupons do inventário `CR_DECOR`, `assets/creative/`). Nada de asset inventado.
2. **Cada formato é uma especialidade.** Feed, story, inapp, banner, e-mail, capa, carrossel e slide têm composições próprias (`CR_LOCKUPS`, `CR_RECEITAS`). Se o motor aprendeu um formato, ele tem que ser **bom naquele formato**, não genérico.

**O que já existe (leia antes de mexer; reutilize, não duplique):**
- `CR_RECEITAS` (29 composições) e `CR_SERVE` (objetivo → receitas); `crPilha`, `CR_BLOCOS`, `CR_LOCKUPS`; `crMontar(sp, receita, fundo, p)` com parâmetros `p = {kh, kf, kt}` (escala do herói, da foto, do texto sem foto).
- `_crMede`: monta o SVG invisível, com as fontes reais, e mede a caixa de **tinta** de cada bloco `[data-bloco]`. `crAvaliar`: erros (reprovam) e avisos (tiram nota): margem, zona útil, colisão, texto mínimo, herói e preço mínimos, grafismo atrás de texto, faixa vazia.
- `crNota`: nota atual, soma de pontos soltos (herói, preço, fração da foto, vazio, avisos, preferência). **É o que vamos trocar.**
- `crCandidatos` → `crEscolher3` (3 de famílias diferentes), `crEditorial` (3 composições sem IA), `crDesenhar`.
- Tipografia: `crMede`, `crCabe`, `crQuebra`, `crTrechos`, `crPreco`, `crPrecoMede`, `crHeroiCaixa`; fontes `LC Realce` e `LC Roboto` (`crFontesProntas`).
- `crAprende` / `_crPref`: aprendizado fraco por receita (teto +10, `localStorage`).
- Testes: `node scripts/run-browser-tests.js` (454 casos; os do Creative estão em `tests/svg-import.html`). A suíte é portão de CI.
- **Material do repositório.** Assets autorizados para compor: o inventário `CR_DECOR` (`assets/creative/inv/`, 54 itens: grafismos, stickers, cupons, selos, ícones, mockup de celular), os logos (`assets/creative/logos/`, `assets/logos/`) e os elementos.
- Leia primeiro: `luma-brain/MAPA.md`, `06_OPERATING_SYSTEM.md`, `03_ENGINEERING.md`, `docs/LUMA.md` (seção Luma Creative).

**VETOS DO RYAN. Não construa e não proponha de novo:** mapa de atenção; cor/foto "inteligente" (extração de paleta, recorte, sombra); grafismo gerado proceduralmente; recomposição automática de um formato em outro; exportar story animado em vídeo; mockup com perspectiva.

**Tarefa.** Entregue as seis frentes abaixo, nesta ordem, **um commit por frente**. Antes de cada uma, escreva um plano de no máximo 15 linhas e siga. Só pare para perguntar se for dúvida de **gosto ou de negócio**.

**1. Nota de design de verdade** (substitui `crNota`)
Uma função pura e determinística que recebe a geometria dos blocos e devolve `{ total: 0–100, partes: {…}, porque: "frase curta em PT-BR" }`. Partes, cada uma de 0 a 1, com pesos declarativos por objetivo e formato (um objeto editável, não `if` espalhado):
- **Equilíbrio:** centro de massa do peso visual (área × tamanho do corpo × contraste) contra o centro da zona útil. Assimetria intencional de eixo à esquerda não é defeito.
- **Vazio e ritmo:** proporção de vazio, maior faixa contínua vazia, e proximidade (vão *dentro* de um grupo menor que vão *entre* grupos).
- **Eixos de alinhamento:** quantas bordas esquerdas, centros e direitas distintas (tolerância de 6 px). Menos é melhor; um eixo dominante em ≥ 70% dos blocos ganha bônus.
- **Escala tipográfica:** número de níveis (3 é o ideal) e razão entre herói, apoio e legal (faixa 1,5–3×); herói dominante.
- **Contraste:** WCAG entre texto e fundo sólido (respeitando as regras do `#FF9000` que já existem).
- **Respiro lateral e foto:** simetria das margens; fração e posição da foto.
Erro de `crAvaliar` continua zerando a nota. Regra da marca nunca vira "pontinho a menos".
**Requisito de arquitetura:** a nota tem que rodar **sem DOM**. Faça os blocos devolverem a geometria que a pilha e as medidas de canvas já sabem (x, y, w, h, corpo, nome). Use o `_crMede` só como verificação final e como teste: a geometria sem DOM e a medida pelo DOM não podem divergir mais que 3 px.

**2. Busca de composições** (milhares de avaliações por segundo)
Cada receita vira uma **gramática com parâmetros**: escala do herói, da foto e do texto, vãos, lado do card e do selo, variantes de ordem declaradas pela receita. O motor busca, **dentro de cada receita e de cada formato**, os melhores valores para *aquele conteúdo* (texto curto ou longo, preço de 2 ou 3 dígitos, foto alta ou larga, com ou sem foto, much+): grade grossa, depois refinamento local, com semente determinística (hash do conteúdo + número da rodada).
- Tudo respeita `crAvaliar`. A busca nunca produz arte que viola a marca.
- **Diversidade real:** as 3 finalistas diferem por *assinatura de design* (lado do peso, fração da foto, eixo, escala), não só pelo nome da receita. "Outras opções" muda a semente e exclui as assinaturas já mostradas.
- A busca roda em fatias (`requestIdleCallback` ou `setTimeout`), **nunca congela a tela**. Orçamento: ≤ 400 ms por pedido em notebook comum.
- Sem IA, sem asset novo. Receita do formato não vaza para outro formato.

**3. Tipografia de agência**
- **Título em lockup:** linhas de larguras equalizadas (corpo ajustado por linha, com variação limitada), quebra equilibrada (Knuth-Plass simplificado para até 4 linhas), sem hifenização em título.
- Nunca separar "R$" do número, "de/por", artigo de substantivo curto; sem viúva nem órfã em apoio e legal.
- **Caixa-alta com acento:** entrelinha e caixa de tinta corretas.
- **Alinhamento óptico** da margem (compensar o recuo do primeiro glifo em corpo grande; pontuação pendurada).
- **Preço bem desenhado:** "R$" pequeno alinhado à altura das maiúsculas, inteiro grande, centavos sobrescritos alinhados; algarismos estáveis.
- Ajuste fino de pares de letras que ficam feios em corpo grande, na fonte de display.

**4. Cinquenta novas composições, desenhadas por você**
Você, a IA que está executando este prompt (e não uma IA em tempo de execução), **autora 50 composições novas**, muito boas e detalhadas, para o dia a dia do franqueado. Elas viram receitas determinísticas do motor, construídas com os assets do repositório e medidas pela nota (frente 1), ajustadas pela busca (frente 2) e escritas com a tipografia (frente 3). O motor continua sem IA na hora de gerar.

*Material.* Componha só com os assets autorizados do contexto. Você pode **promover ao inventário** um asset que já exista no repositório (ex.: `assets/logos/`, `assets/grafismos/`), registrando-o como o `CR_DECOR` registra (largura, altura, `max` nítido, marca, tipo, descrição). **Nunca desenhe nem gere asset novo.**

*Cobertura: usos reais do franqueado* (≥ 3 composições por grupo, no total 50):
- **A. Prato e oferta do dia:** prato do dia, almoço executivo, combo família, 2 por 1, preço em destaque, "a partir de", lista de 3–4 ofertas.
- **B. Horário e ocasião:** happy hour, sextou, domingo doce, janta, madrugada, fim de semana, "chove, a gente leva".
- **C. Cupom e entrada:** cupom da semana, primeira compra, frete grátis, pedido mínimo, cashback e clube Much+.
- **D. Parceiros:** novo parceiro, lojista da semana, mais vendidos, inauguração, ofertas do dia de várias lojas.
- **E. Datas e cidade:** datas comemorativas (mães, pais, namorados, crianças, Natal…), festa junina, Copa e jogo do time, aniversário da cidade, Black Friday.
- **F. Operação e aviso:** horário especial e feriado, "estamos entregando", pausa temporária, aviso importante.
- **G. Prospecção e comunidade:** seja parceiro (lojista), seja entregador, baixe o app (com o `celular-app`), "peça no app", agradecimento.

*Formatos.* O franqueado vive de rede social. Distribuição sugerida: **feed 18, story 18, carrossel 6** e **8 entre inapp, banner, e-mail e capa** (≥ 1 de cada). Justifique qualquer desvio maior que ±2. Cada composição pertence a **um** formato (especialista); nada de "serve a todos" com adaptação automática.

*Cada composição sai completa ("super detalhada"):*
- Registro em `CR_RECEITAS`/`CR_LOCKUPS` com `id`, nome em PT-BR, **`uso`** (uma frase: quando o franqueado usa), objetivo, formato, `serve(sp)` (com/sem foto, com preço, com lista, tamanho do texto), pesos e fundos.
- **Gramática:** blocos e ordem, eixo, hierarquia (corpo por nível), vãos, margens, **onde entra cada asset e por quê**, e os parâmetros que a busca pode variar, com limites.
- **Variantes** declaradas, com assinaturas de design distintas quando fizer sentido.
- **Texto:** limite de caracteres por campo e o que acontece com texto longo (quebra, encolhe até o piso, ou `serve` recusa).
- `data-campo` coerentes com o contrato do importador, para a arte poder virar template.
- Uma linha no **catálogo** `docs/CATALOGO-COMPOSICOES.md`, **gerado por script** a partir do registro (nome, uso, formato, assets, miniatura), nunca escrito à mão.

*Novos objetivos.* Se um uso não cabe em oferta, cupom, evento, benefício ou aniversário (aviso, parceiro, prospecção…), acrescente-o a `CR_OBJETIVOS`, `CR_SERVE`, `crLerPedido` (palavras do pedido), `crBriefingLocal` (perguntas), `crNormaliza`, `crPromptBriefing` e à legenda, **sem quebrar o que existe e sem inventar dado** (preço, desconto, validade, nome de loja).

*Barra de qualidade.*
- Você tem que **ver** cada uma: renderize com o Chromium que já existe no ambiente (Playwright), em 4 tamanhos de texto × com e sem foto × much+, julgue com o olho de diretor de arte e **descarte e refaça** até ficar no nível das artes que o motor já gera de melhor. São **50 aprovadas**, não 50 tentadas.
- Zero erro de `crAvaliar` em **todas** as variações do banco de casos; nota nova ≥ 80 em ≥ 90% delas.
- **Sem clones:** a assinatura de design de cada composição fica a uma distância mínima das outras do mesmo formato.
- Uma **galeria** `tests/_galeria-composicoes.html` (ferramenta, fora do portão) com todas as composições × variações para o Ryan revisar, e as 50 entram como golden na regressão.
- Entregue em **lotes de ~10**, um commit por lote, cada um com a galeria e as notas atualizadas.

**5. Curadoria do Ryan e regressão**
- Um **banco de casos**: ≥ 40 pedidos reais × formatos × texto curto/médio/longo/extremo × com e sem foto × much+.
- Uma tela só da gestão: grade de artes, 👍/👎 e motivos (peso mal distribuído, tipografia, vazio, hierarquia, contraste…). Os votos ajustam os pesos da nota (otimização simples, sem IA) e podem ser exportados em JSON.
- As artes aprovadas viram **golden**: o teste reprova se a nota de uma delas cair mais de N pontos ou se aparecer qualquer erro. Os casos de motor entram numa suíte existente; se for bancada exploratória, nasce como ferramenta (`_nome`), fora do portão.

**6. Making-of com mouse simulado** (a mágica para o franqueado)
Um componente `crMakingOf(container, svgFinal, opcoes)` que mostra um cursor desenhando a arte pronta: pega cada bloco, arrasta até o lugar, solta, clica no texto e **digita** o conteúdo real, redimensiona o título com alças como no editor. Movimento de mão humana (curva de Bézier, aceleração e desaceleração, micro-tremor, semente fixa).
- 6–8 s no total, botão "Pular", **`prefers-reduced-motion` mostra a arte pronta**. Só `transform` e `opacity`.
- Botão "▶ Ver sendo feita" na entrega; toca sozinho na primeira entrega da sessão.
- **Substitui** a montagem por blocos atual (`_crMontar`). A `<img>` do arquivo continua sendo a verdade: o making-of nunca altera o que se baixa.
- Fica independente do Creative (recebe contêiner e SVG), para o Franqueado poder usar depois. Não integre ao Franqueado agora.

**Formato.** Trabalhe na `talpaipai` (só ela, nunca `git add .`, subir o `?v=N` quando tocar `js/`, `css/` ou `index.html`). Um commit por frente, mensagem em PT-BR explicando o porquê. Ao fim de cada frente, relate: o que mudou, **números antes e depois** (nota média, tempo da busca, casos reprovados), o que pode regredir e o que ficou de fora. Atualize `luma-brain/MAPA.md` (`node scripts/mapa.js`), `docs/LUMA.md` e o `luma-brain` onde mudar algo estrutural.

**Qualidade (critérios de aceite).**
- Suíte verde: `node scripts/run-browser-tests.js` (hoje 454). Verifique também no navegador, abrindo o Creative e gerando artes de verdade; "compilou" não vale.
- **50 composições novas aprovadas** (frente 4), cobrindo os 7 grupos de uso, com o catálogo gerado e a galeria revisável.
- **Nota nova vs. motor atual**, no banco de casos: média ≥ +8 pontos, nenhum caso pior que −2, **zero erro de marca** nas 3 finalistas, as 3 com assinaturas distintas, busca ≤ 400 ms.
- Geometria sem DOM e medida pelo DOM divergem ≤ 3 px.
- Vanilla JS, **sem build, sem ES Modules, sem dependência nova**. Funções globais com prefixo `cr*`, sem renomear nada existente. `gEsc` em todo dado de usuário, cor e motion por token, ícone em SVG, feedback por `gToast`. PT-BR.
- Não mude as regras de marca (`CR_PALETA`, margens, pisos, zonas úteis) nem os assets sem perguntar ao Ryan. Nunca invente preço, desconto ou validade.
- Seja honesto: se um número não bateu, diga. Não declare "verificado" sem ter medido.
