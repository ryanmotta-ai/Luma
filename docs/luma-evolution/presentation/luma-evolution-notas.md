# Notas do apresentador — Luma, de piloto a produto

26 slides. Somando as durações das notas dá cerca de 15 minutos falando; dá pra cortar os slides de era e ficar em 10.

> Tudo aqui tem lastro no repositório. Onde a motivação não está registrada, a nota diz "aparenta" em vez de afirmar.

## Slide 01

Abertura. O título entrega a tese: isto não é changelog, é a passagem de um piloto para um produto.
Diga de saída que **nada aqui é mockup** — toda imagem é uma execução real de uma versão que voltou a rodar.
~40s.

## Slide 02

Contrato com a plateia. O terceiro item é o mais importante: a apresentação separa fato de leitura.
Se alguém perguntar "de onde saiu esse número", a resposta está no índice de evidências.
~40s.

## Slide 03

Este slide ancora tudo. O piloto **roda** — não é screenshot de arquivo morto, é o HTML executado agora.
Dois detalhes que valem falar: a fonte 'Realce Black' já vinha embutida em base64 dentro do próprio HTML, e a convenção de prefixos do código de hoje nasceu aqui — 148 funções `d*`, 78 `f*` e 4 `g*`, contra 697/234/140 na versão atual. O mesmo idioma, vinte vezes maior.
Repare que não há tela de entrada: o app abre com o assistente já perguntando.
~1min.

## Slide 04

Slide de integridade. Se a plateia lê "71 commits" como o tamanho do projeto, corrija: é o tamanho do **histórico versionado**, não do trabalho.
As duas raízes órfãs (74d31b5 e df0c056) indicam que o repositório foi montado a partir de trabalho que já existia.
~40s.

## Slide 05

Divisor. Diga a regra de escolha: o commit entrou porque mudou o que se vê ou o que se pode fazer — não porque é recente.
~12s.

## Slide 06

Percorra da esquerda pra direita sem se demorar — cada marco tem slide próprio depois.
O que importa aqui é a forma: um piloto, um dia de fundação enorme (16/07 concentra metade dos commits), duas semanas de refino e um salto de capacidade no último dia.
~50s.

## Slide 07

Antes do git — Piloto Yungas — Módulo de Artes.
Por que entrou: É a única evidência do produto ANTES do git. As duas raízes do repositório já contêm o app inteiro, então sem este arquivo a pergunta "como o Luma começou?" não teria resposta com evidência.
· Chamava-se "Yungas · Módulo de Artes · Delivery Much" — o nome Luma ainda não existia
· 1 arquivo HTML, 565.693 bytes, 9.316 linhas
~40s.

## Slide 08

Base preservada — O que o git preserva como ponto de partida.
Por que entrou: Commit mais antigo por data-hora do repositório (16/07, 10:33). Já traz 285 arquivos e um index.html de 234.737 bytes — o git começa com o produto pronto, não com o começo dele.
· 285 arquivos versionados já no commit mais antigo
· index.html com 234.737 bytes; 47 arquivos em js/ e 22 em css/
~40s.

## Slide 09

O franqueado no celular — A arte dentro do celular.
Por que entrou: Fecha a sequência de mockup do dia. O franqueado deixa de ver um arquivo e passa a ver como a arte fica publicada — que é a pergunta que ele realmente tem.
· Precedido por "Mockup: prévia da arte no celular (Stories, Feed, WhatsApp)"
· E por "Mockup: silhueta do iPhone 17 Pro Max (padrão premium)"
~40s.

## Slide 10

Catálogo vivo — A vitrine passa a ser gerida pelo banco.
Por que entrou: Mudança estrutural de produto: a vitrine deixa de ser lista fixa em código e passa a refletir o que o time cria no Estúdio, sem deploy.
· No mesmo lote: convite de membro real por Edge Function e perfil persistido no banco
· A "Fase 2" do seam de campanhas continua em 18/07 com 40b2587 e 8826c9e
~40s.

## Slide 11

Endurecimento — Endurecimento: segurança, sync e PSD.
Por que entrou: Último commit do bloco 17–20/07, que é inteiro de robustez: z-order do PSD, raster adaptativo, gate de conta desativada, XSS residuais e fim dos "sucessos falsos".
· 882cda0 — gate de conta desativada, XSS residuais e fim dos sucessos falsos
· 26e8215 — franqueado deixa de gravar base64 no banco
~40s.

## Slide 12

A 1.0 — 1.0 declarada.
Por que entrou: É o único marco declarado pelo próprio dono do produto, não inferido por nós. Fecha o ciclo de 22/07, que foi só planejamento no luma-brain.
· 22/07 tem 6 commits, todos em luma-brain/ — planejamento, nenhuma tela alterada
· 5067bd2 e f1984dc registram o tema Much+ ANTES de ele existir em código
~40s.

## Slide 13

Recursos inteligentes — A camada de IA.
Por que entrou: Fecha a manhã de 30/07 (10:50 às 11:05), em que a IA entra como camada de produto e não como truque isolado: um motor único com Edge Function, atendendo vários recursos.
· fc36ae4 (10:50) — tubulação única de IA + encaixar texto no limite
· 13279fe (10:55) — ajuda responde aterrada na Central de Ajuda e cala quando não sabe
~40s.

## Slide 14

Ferramenta interna — Luma CLI — o console do time.
Por que entrou: Primeira superfície do produto voltada pra quem MANTÉM o Luma, não pra quem usa. Nasceu de um incidente real de sync que era diagnosticado colando snippet no DevTools.
· c9790e8 (11:27) — o console nasce com IA, banner em pixel art e os dois temas
· e48b7ff (11:41) — chega ao celular, com entrada escondida no painel de perfil
~40s.

## Slide 15

Acabamento — Estado atual.
Por que entrou: Ponta da branch. Os últimos commits do dia são de acabamento: mascote do CLI, revisão de UI/UX com contraste medido, tema Much+ contido e o script que torna esta apresentação reproduzível.
· 9c1a83b — revisão de UI/UX do CLI com contraste medido no Chromium
· 7f0c1ea e da629be — tema Much+ deixa de inundar o card e vira acento
~40s.

## Slide 16

Divisor. Avise que daqui pra frente a leitura é sempre a mesma: esquerda é antes, direita é hoje, e a frase embaixo diz o que o usuário ganhou.
~12s.

## Slide 17

A mudança mais visível de todas. No piloto não existe "início": o app abre com o assistente já na pergunta 1 de 4.
Repare também na paleta — o piloto é vermelho; hoje é o laranja da marca sobre papel claro.
Se perguntarem por que mudou: a tela de entrada é o que permite ter destaque, busca e histórico. Sem ela, nenhum desses recursos teria onde morar.
~1min20.

## Slide 18

Slide que dá crédito ao piloto. O chat guiado não foi invenção posterior: já estava lá, com sugestões clicáveis e contador de passos.
A evolução foi de contexto, não de mecânica.
~50s.

## Slide 19

Cuidado pra não vender demais: a diferença aqui é organizacional, não de capacidade de desenho.
~40s.

## Slide 20

Se houver franqueado na sala, este slide fala com ele: o uso real acontece no celular.
~40s.

## Slide 21

Slide sem "antes", e isso é o ponto: o produto passou a ter ferramenta interna própria.
A origem é concreta — o incidente de "pastas no banco e nenhum template aparecendo", diagnosticado colando snippet no DevTools. O CLI transformou aquele conhecimento em comando nomeado.
Ressalte a última linha se houver alguém de segurança na sala.
~1min.

## Slide 22

O slide dos números. Todos foram contados no repositório na hora em que a apresentação foi gerada — nenhum é estimativa.
O contraste mais forte é o do backend: o piloto rodava inteiro no navegador, sem banco. Hoje há Postgres com RLS, Storage e Edge Functions.
O último card é o que mais surpreende engenheiro: cresceu tudo isso **sem** adotar framework nem build.
Se perguntarem sobre adoção ou uso, seja direto: **esses números não existem aqui**. O repositório mede código, não usuários.
~1min20.

## Slide 23

O slide que responde "o produto amadureceu em quê, exatamente".
Cada item tem lastro no histórico — vale citar o incidente do sync (item 2) e a rotação da chave do Gemini pra Edge Function (item 4).
O item 5 é meta: a ferramenta que reabre versões antigas é a mesma que gerou esta apresentação.
~1min20.

## Slide 24

Panorama. Não descreva tela por tela — deixe a imagem falar e diga só que tudo aqui saiu da mesma versão, no mesmo dia.
~30s.

## Slide 25

O slide de auditoria. Os dois últimos números são os que importam: zero reconstruções e zero alterações no código do produto.
Se alguém quiser conferir qualquer imagem, o índice de evidências dá commit, data, cena e viewport de cada uma — e cada PNG tem um JSON irmão com esses metadados.
~40s.

## Slide 26

Fechamento. A frase tem lastro: o chat guiado do piloto continua sendo o centro do produto — o que mudou foi tudo em volta.
Termine convidando: a apresentação se regenera com um comando, então ela acompanha o produto em vez de envelhecer.
~40s.
