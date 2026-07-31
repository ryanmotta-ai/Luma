# Notas do apresentador — Luma, de piloto a produto

31 slides. Tempo somado das notas: cerca de 20 minutos falando; dá pra cortar os slides de era e ficar em 12.

> Tudo que está nas notas tem lastro no repositório. Onde a motivação não está registrada, a nota diz "aparenta" em vez de afirmar.

## Slide 01

Abertura. O título já entrega a tese: isto não é changelog, é a passagem de um piloto para um produto.
Diga de saída que **nada aqui é mockup** — toda imagem é uma execução real, capturada de uma versão que voltou a rodar.
Duração: 40s.

## Slide 02

Contrato com a plateia. O quarto item é o mais importante: a apresentação distingue o que é fato do que é inferência.
Se alguém perguntar "de onde saiu esse número", a resposta está no índice de evidências.
Duração: 50s.

## Slide 03

Este é o slide que ancora tudo. O piloto **roda** — não é screenshot de arquivo morto, é o HTML executado.
Dois detalhes que valem falar: a fonte da marca estava embutida em base64 dentro do próprio HTML, e os prefixos `d-*` do Estúdio já existiam ali. A convenção de nomes do código de hoje nasceu neste arquivo.
Duração: 1min.

## Slide 04

Slide de integridade. Se a plateia acha que "81 commits" é o tamanho do projeto, corrija: 81 commits é o tamanho do **histórico versionado**, não do trabalho.
As duas raízes órfãs indicam que o repositório foi montado a partir de trabalho que já existia.
Duração: 45s.

## Slide 05

Divisor. Diga a regra de escolha: commit entrou porque mudou o que se vê ou o que se pode fazer — não porque é recente.
Duração: 15s.

## Slide 06

Percorra da esquerda pra direita sem se demorar — cada marco tem slide próprio depois.
O que importa aqui é a forma: um piloto, um dia de fundação enorme, duas semanas de refino e um salto de capacidade no último dia.
Duração: 1min.

## Slide 07

Era 0 · Antes do git — Piloto Yungas — Módulo de Artes.
Por que entrou: É a única evidência do produto ANTES do git. As duas raízes do repositório já contêm o app inteiro, então sem este arquivo a pergunta 'como o Luma começou?' não teria resposta com evidência.
· Nome do produto: 'Yungas · Módulo de Artes · Delivery Much' — ainda não se chamava Luma
· 1 arquivo, 565.693 bytes, 9.316 linhas
Duração: 45s.

## Slide 08

Era 1 · Base preservada — O que o git preserva como ponto de partida.
Por que entrou: Commit mais antigo POR DATA-HORA no repositório. Já traz 284 arquivos e o index.html com 234.737 bytes — ou seja, o git começa com o produto pronto, não com o começo dele.
· 284 arquivos versionados já no commit mais antigo
· index.html com 234.737 bytes; 47 arquivos em js/ e 22 em css/
Duração: 45s.

## Slide 09

Era 2 · O franqueado no celular — Prévia viva no celular.
Por que entrou: Fecha a sequência de mobile do dia (refinos rodada 1, varredura rodada 2, prévia viva). É o ponto em que o celular deixa de ser adaptação e vira gesto próprio.
· Antecedido por 'Mobile (franqueado): refinos de UI/UX' e 'varredura completa de telas — rodada 2'
· PWA instalável e casca desktop (.exe/DMG) entram no mesmo dia
Duração: 45s.

## Slide 10

Era 3 · Catálogo vivo — A vitrine passa a ser gerida pelo banco.
Por que entrou: Mudança estrutural de produto: a vitrine deixa de ser lista fixa em código e passa a refletir o que o time cria no Estúdio, sem deploy.
· No mesmo lote: convite de membro real por Edge Function e persistência de perfil no banco
· A 'Fase 2' do seam de campanhas continua em 18/07 com 40b2587 e 8826c9e
Duração: 45s.

## Slide 11

Era 4 · Endurecimento — Endurecimento: segurança, sync e PSD.
Por que entrou: Último commit do bloco 17–20/07, que é inteiro de robustez: z-order do PSD, raster adaptativo, gate de conta desativada, XSS residuais, fim dos 'sucessos falsos' e franqueado que gravava base64 no banco.
· 882cda0 — 'gate de conta desativada, XSS residuais e fim dos sucessos falsos'
· 26e8215 — franqueado deixa de gravar base64 no banco
Duração: 45s.

## Slide 12

Era 5 · A 1.0 — 1.0 declarada.
Por que entrou: É o único marco declarado pelo próprio dono do produto, não inferido por nós. Fecha o ciclo de 22/07, que foi só planejamento no luma-brain (roadmap, matriz de prioridade e o tema Much+ sendo concebido).
· 22/07 tem 6 commits, todos em luma-brain/ — planejamento, nenhuma tela alterada
· 5067bd2 e f1984dc registram o tema Much+ ANTES de ele existir em código
Duração: 45s.

## Slide 13

Era 6 · Recursos inteligentes — A camada de IA.
Por que entrou: Fecha a manhã de 30/07, em que a IA entra como camada de produto e não como truque isolado: um motor único (js/core/ai.js) com Edge Function, atendendo cinco recursos.
· fc36ae4 — tubulação única de IA + encaixar texto no limite + legenda melhor
· 13279fe — ajuda responde aterrada na Central de Ajuda e cala quando não sabe
Duração: 45s.

## Slide 14

Era 7 · Ferramenta interna — Luma CLI — o console do time.
Por que entrou: Primeira superfície do produto voltada pra quem MANTÉM o Luma, não pra quem usa. Nasceu de um incidente real de sync que era diagnosticado colando snippet no DevTools.
· Gate por role é de UX; a fronteira de segurança continua sendo a RLS
· Comandos: ajuda, diag, sync, pastas, cache, ia, modelo, limpar, sair
Duração: 45s.

## Slide 15

Era 8 · Acabamento — Estado atual.
Por que entrou: Ponta da branch padrão. Últimos 6 commits do dia são de acabamento: mascote do CLI, revisão de UI/UX com contraste medido, tema Much+ contido e o script que torna esta apresentação reproduzível.
· 9c1a83b — revisão de UI/UX do CLI com contraste medido no Chromium
· 7f0c1ea e da629be — tema Much+ deixa de inundar o card e vira acento
Duração: 45s.

## Slide 16

Divisor. Avise que daqui pra frente é sempre a mesma leitura: esquerda é antes, direita é hoje, e a frase embaixo diz o que o usuário ganhou.
Duração: 15s.

## Slide 17

A mudança mais visível de todas. No piloto não existe "início": o app abre com o assistente já perguntando.
Repare também na paleta — o piloto é vermelho/laranja escuro; hoje é o laranja da marca sobre papel claro.
Se perguntarem por que mudou: uma tela de entrada é o que permite ter destaque, busca e histórico. Sem ela, cada um desses recursos não teria onde morar.
Duração: 1min20.

## Slide 18

Slide importante pra dar crédito ao piloto. O chat guiado não foi invenção posterior: já estava lá, com sugestões clicáveis e contador de passos.
A evolução foi de contexto, não de mecânica.
Duração: 1min.

## Slide 19

Cuidado pra não vender demais: o canvas do piloto já era completo. A diferença é organizacional, não de capacidade de desenho.
Duração: 50s.

## Slide 20

Se houver franqueado na sala, este é o slide que fala com ele: o uso real acontece no celular.
Os três commits: 'Mobile (franqueado): refinos de UI/UX', 'varredura completa de telas — rodada 2' e 'prévia viva — miniatura PiP, pinça pra zoom e swipe pra fechar'.
Duração: 50s.

## Slide 21

Slide sem "antes", e isso é o ponto: o produto passou a ter ferramenta interna própria.
A origem é concreta — o incidente de "30 pastas no banco e 0 templates", diagnosticado colando snippet no DevTools. O CLI transformou aquele conhecimento em comando nomeado.
Ressalte a última linha se houver alguém de segurança na sala.
Duração: 1min.

## Slide 22

Divisor. Este bloco é o mais útil pra quem vai usar o Luma amanhã: é literalmente um mapa.
Duração: 12s.

## Slide 23

Atlas de Vitrine do franqueado.
1. Campanha em destaque — Entrar → primeira coisa na tela. O franqueado não precisa escolher entre 17 campanhas pra começar.
2. Busca de campanha — Vitrine → campo de busca. Encurta o caminho quando já se sabe o que quer.
3. Minhas artes — Vitrine → cabeçalho → Minhas artes. Trabalho começado não se perde entre sessões.
4. Alternador Franqueado / Designer — Topbar → Designer. Um app só atende os dois papéis, sem login separado.
Os contornos não foram desenhados no olho: a posição de cada caixa foi medida no DOM da versão atual.
Duração: 1min.

## Slide 24

Atlas de Campanha aberta.
1. Materiais da campanha — Vitrine → campanha. Mostra o que existe antes de pedir qualquer coisa.
2. Prévia ao vivo — Campanha → coluna da direita. Erro é visto na hora, não depois do download.
3. Rail de campanhas — Sempre visível à esquerda dentro da campanha. Trocar de campanha não custa uma volta ao início.
Os contornos não foram desenhados no olho: a posição de cada caixa foi medida no DOM da versão atual.
Duração: 1min.

## Slide 25

Atlas de Estúdio do designer.
1. Biblioteca de templates — Topbar → Designer. O designer retoma o trabalho sem procurar arquivo.
Os contornos não foram desenhados no olho: a posição de cada caixa foi medida no DOM da versão atual.
Duração: 1min.

## Slide 26

Atlas de Luma CLI.
1. Console do time — Ctrl+` no desktop · painel de perfil no celular. O que era snippet colado no DevTools virou comando repetível.
2. Conversa com a IA no terminal — CLI → qualquer frase que não seja comando. Investigar deixa de exigir decorar comando.
Os contornos não foram desenhados no olho: a posição de cada caixa foi medida no DOM da versão atual.
Duração: 1min.

## Slide 27

Este é o slide dos números. Todos foram contados no repositório — nenhum é estimativa.
O contraste mais forte é o do backend: o piloto rodava inteiro no navegador, sem banco. Hoje há Postgres com RLS, Storage e Edge Functions.
Se perguntarem sobre adoção ou uso, seja direto: **esses números não existem aqui**. O repositório mede código, não usuários.
Duração: 1min20.

## Slide 28

O slide que responde "o produto amadureceu em quê, exatamente".
Cada item tem lastro no histórico — vale citar o incidente do sync (item 2) e a rotação da chave do Gemini pra Edge Function (item 4).
Duração: 1min30.

## Slide 29

Panorama. Não descreva tela por tela — deixe a imagem falar e diga só que tudo aqui foi capturado da mesma versão, no mesmo dia.
Duração: 40s.

## Slide 30

O slide de auditoria. O número que mais importa é o último: zero reconstruções. Tudo que está na apresentação é execução real.
Se alguém quiser conferir qualquer imagem, o índice de evidências dá commit, data, cena e viewport de cada uma.
Duração: 50s.

## Slide 31

Fechamento. A frase de efeito tem lastro: o chat guiado do piloto continua sendo o centro do produto — o que mudou foi tudo em volta.
Termine convidando: a apresentação se regenera com um comando, então ela acompanha o produto em vez de envelhecer.
Duração: 45s.
