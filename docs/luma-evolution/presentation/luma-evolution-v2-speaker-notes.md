# Notas do apresentador — Luma, de piloto a produto

35 slides. Somando as durações das notas dá cerca de 15 minutos falando; dá pra cortar os slides de era e ficar em 10.

> Tudo aqui tem lastro no repositório. Onde a motivação não está registrada, a nota diz "aparenta" em vez de afirmar.

## Slide 01

Abertura. Diga a tese: não é changelog, é a passagem de uma necessidade interna para um produto.
E diga de saída que nada aqui é mockup — toda imagem é uma execução real de uma versão que voltou a rodar.
~40s.

## Slide 02

Contrato com a plateia. Os itens 4 e 5 são os que interessam a quem vai usar o Luma amanhã.
~35s.

## Slide 03

O slide que ancora tudo. O arquivo **roda** — é o HTML original executado agora, não um print de arquivo morto.
Seja honesto na origem: é a primeira versão **conhecida e preservada**, entregue fora do repositório. Não é o primeiro commit — o git não guarda o começo.
Dois detalhes fortes: a fonte da marca já vinha embutida em base64, e a convenção de prefixos do código de hoje nasceu aqui.
~1min.

## Slide 04

Cinco marcos escolhidos por diferença visual clara — não por serem recentes.
O histórico versionado é curto: 15 dias, 73 commits, e metade deles no primeiro dia. A forma que importa é: um piloto, uma fundação enorme, duas semanas de refino e um salto de capacidade no fim.
~50s.

## Slide 05

A leitura mais direta da apresentação: três execuções reais, mesma tela, três épocas.
Repare na paleta — vermelho na origem, laranja da marca hoje.
~50s.

## Slide 06

Slide que dá crédito à ideia original. O chat guiado não foi invenção posterior.
A evolução foi de contexto, não de mecânica.
~45s.

## Slide 07

Cuidado para não vender demais: a diferença aqui é organizacional, não de capacidade de desenho.
~40s.

## Slide 08

Divisor. Avise que a leitura daqui pra frente é sempre igual — isso deixa a plateia processar a imagem, não o layout.
~10s.

## Slide 09

Slide de impacto operacional. Antes, cada campanha nova era um commit; hoje é uma pasta.
O marco dessa virada é 247bcd4, de 16/07.
~45s.

## Slide 10

Aqui vale citar os commits de sync de 16/07: lock no push, releitura antes de regravar e fila de deleções.
~40s.

## Slide 11

A comparação aqui começa em 16/07 porque o piloto não tinha esse modal — o que já é a informação.
Em 17/07 entram o z-order confiável do PSD e o raster adaptativo, que é o que torna o export 2× nítido.
~40s.

## Slide 12

Se houver franqueado na sala, este slide fala com ele: o uso real acontece no celular.
~35s.

## Slide 13

Slide sem "antes", e é esse o ponto: o produto passou a ter ferramenta interna própria.
O conhecimento que morava na cabeça de quem debugava virou comando nomeado.
Ressalte a última linha se houver alguém de segurança na sala.
~50s.

## Slide 14

Divisor do bloco mais denso. Avise que agora vem volume: são oito ou nove versões reais por tela.
Não descreva quadro a quadro — deixe a plateia varrer a linha e aponte só o quadro destacado.
~15s.

## Slide 15

A linha inteira num slide. Aponte o primeiro quadro (vermelho, sem vitrine) e o último, e diga que tudo no meio é o mesmo produto amadurecendo.
O quadro de 16/07 é onde a vitrine nasce; o de 30/07 é o estado atual.
~1min.

## Slide 16

Slide para o time de operação: cada capa nesta linha foi publicada sem tocar em código.
~50s.

## Slide 17

Use este slide para dar crédito à ideia original: o formato estava certo desde o primeiro dia.
O quadro de 30/07 marca a entrada da IA — encaixar texto no limite sem cortar sentido.
~50s.

## Slide 18

Os commits de sync de 16/07 estão por trás desta linha: lock no push, releitura antes de regravar e fila de deleções.
~45s.

## Slide 19

Não há captura do Estúdio em 29/07 — a cena não foi alcançada offline naquele commit, e isso está declarado no índice.
~45s.

## Slide 20

Slide técnico. Se houver designer na sala, o ponto é o raster adaptativo: o export 2× deixou de borrar.
~40s.

## Slide 21

Compare o primeiro e o último quadro: mesma informação, densidade completamente diferente.
~40s.

## Slide 22

Slide de design system, e o achado aqui é o contrário do esperado: as duas últimas faixas são quase idênticas.
Isso é a mensagem. A identidade se resolveu cedo e não precisou de retoque, enquanto o resto do produto quadruplicou de tamanho.
Se alguém perguntar por que não mostrar mais versões: porque não há diferença para mostrar.
~45s.

## Slide 23

Este é o recorte que melhor mostra intenção de produto: o texto "Qual arte vamos criar hoje?" não é enfeite, é o que transforma uma tela de lista numa tela de decisão.
O placeholder da busca traz exemplo real (Sushi, Almoço) em vez de "digite aqui".
~45s.

## Slide 24

O slide-resumo do bloco. Cada item tem commit e data, então nenhum é impressão.
Se precisar cortar tempo, este slide substitui os sete de tira — mas perde a evidência visual.
~1min10.

## Slide 25

Divisor do bloco mais útil para quem vai usar o Luma amanhã: é literalmente um mapa.
~10s.

## Slide 26

Criar — Vitrine — por onde se começa.
1. Campanha em destaque — Vitrine → primeiro bloco
2. Busca de campanha — Vitrine → campo de busca
3. Minhas artes — Vitrine → cabeçalho
4. Alternador Franqueado / Designer — Topbar
Os contornos não foram desenhados no olho: cada caixa foi medida com getBoundingClientRect na versão atual.
~50s.

## Slide 27

Editar — Campanha aberta — o chat que monta a arte.
1. Chat de preenchimento — Campanha → material → Personalizar
2. Prévia ao vivo — Coluna da direita
3. Campo de resposta — Rodapé do chat
4. Contexto da campanha — Topo do chat
Os contornos não foram desenhados no olho: cada caixa foi medida com getBoundingClientRect na versão atual.
~50s.

## Slide 28

Organizar — Estúdio — a casa do designer.
1. Começar do zero ou de um arquivo — Estúdio → Criar material · Photoshop · Illustrator
2. Biblioteca de materiais — Estúdio → Todos os materiais
3. Busca e filtros — Estúdio → topo da biblioteca
4. Pasta de destino — Estúdio → cabeçalho
Os contornos não foram desenhados no olho: cada caixa foi medida com getBoundingClientRect na versão atual.
~50s.

## Slide 29

Publicar e exportar — Exportar e publicar.
1. Formato de saída — Exportar → Formato
2. Escala de exportação — Exportar → Escala
Os contornos não foram desenhados no olho: cada caixa foi medida com getBoundingClientRect na versão atual.
~50s.

## Slide 30

Manter e diagnosticar — Console do time.
1. Luma CLI — Ctrl+` no desktop · painel de perfil no celular
2. Conversa com a IA — CLI → qualquer frase que não seja comando
Os contornos não foram desenhados no olho: cada caixa foi medida com getBoundingClientRect na versão atual.
~50s.

## Slide 31

Slide de design system. As duas imagens são do MESMO commit, no mesmo dia — a diferença é só a campanha aberta.
Isso prova que a troca de tema é por token, não por código duplicado. É o que permite receber uma marca parceira sem fork.
O tema foi concebido no luma-brain em 22/07, antes de existir em código.
~50s.

## Slide 32

O slide que responde "amadureceu em quê, exatamente".
O item 4 é o mais subestimado: um aviso de sucesso que mente custa mais caro que um erro visível.
O item 5 é meta — a ferramenta que reabre versões antigas é a que gerou esta apresentação.
~1min10.

## Slide 33

Panorama. Não descreva tela por tela — deixe a imagem falar e diga que tudo saiu da mesma versão, no mesmo dia.
~30s.

## Slide 34

Todos contados no repositório na hora em que a apresentação foi gerada — nenhum é estimativa.
O último card costuma surpreender engenheiro: cresceu tudo isso **sem** adotar framework nem build.
Se perguntarem sobre adoção ou uso: esses números não existem aqui. O repositório mede código, não usuários.
~1min.

## Slide 35

Fechamento. A última oração da frase tem lastro: o produto cresceu vinte vezes e continua sem build, sem framework e sem dependência de runtime.
Termine convidando: a apresentação se regenera com um comando, então acompanha o produto em vez de envelhecer.
~40s.
