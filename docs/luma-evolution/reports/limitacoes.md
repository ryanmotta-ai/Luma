# Limitações desta apresentação

O que não foi possível recuperar, e por quê. Escrito para que nenhuma lacuna vire preenchimento inventado.

---

## 1. O git não guarda o começo do Luma

**O fato.** O repositório tem **duas raízes órfãs**, `74d31b5` e `df0c056`, ambas de 2026-07-16. O commit mais antigo por data-hora (`89ca896`, 10:33 de 16/07) já traz **285 arquivos** e um `index.html` de **234.737 bytes**, com 47 arquivos em `js/` e 22 em `css/`.

**O que isso significa.** Quando o versionamento começou, o produto já estava construído. As perguntas "como o Luma começou?" e "como eram as primeiras telas?" **não têm resposta dentro do repositório**.

**Como foi contornado.** O arquivo do piloto — `Yungas · Módulo de Artes · Delivery Much`, 565.693 bytes em um único HTML — foi entregue fora do git, está preservado em `research/origem/` e foi **executado**, não descrito. É a evidência do "antes" da apresentação inteira.

**O que continua sem evidência.** A data exata do piloto. O arquivo não a declara e não está sob versionamento, então a apresentação diz "anterior a 16/07/2026" em vez de cravar um dia.

---

## 2. O histórico versionado cobre 15 dias

72 commits entre 2026-07-16 e 2026-07-30, de 3 autores (Claude, ryanmotta-ai, Pedro Moraes). Sem tags, sem releases, sem branches de release. Metade dos commits é do primeiro dia.

**Consequência para a narrativa.** Não existem eras de meses ou anos. Os marcos foram agrupados pelo que mudou, não por período longo — e a apresentação diz isso num slide próprio, para que ninguém leia "72 commits" como o tamanho do trabalho.

---

## 3. As capturas rodam offline, sem banco

Toda versão é executada com as credenciais do Supabase **zeradas**. É decisão deliberada: um front de duas semanas atrás falando com o banco de hoje poderia escrever dado em formato antigo, e o estrago seria silencioso.

**Consequência.** As telas mostram o **conteúdo de exemplo de cada commit**, não dados reais de produção. Para comparar layout, tipografia, cor, densidade e navegação — que é o objetivo — isso não atrapalha. Para ver uma campanha específica como ela estava num dia, não serve.

---

## 4. Telas não alcançadas em cada versão

Uma cena que não é capturada **não é falha de captura**: na maioria dos casos é a prova de que a tela não existia ainda. Os casos, por natureza:

| Situação | Por que acontece | Como aparece na apresentação |
|---|---|---|
| A tela não existia naquele commit | Ex.: o Luma CLI só existe a partir de 30/07 | Slide sem "antes", com etiqueta **novo** |
| A tela exige um template salvo no banco | O canvas do Estúdio e o fluxo de publicar dependem de conteúdo que, offline, não existe | Fica de fora; a home do Estúdio entra no lugar |
| O widget mudou de gatilho entre versões | A Central de Ajuda hoje é `#luma-widget-modal`; era `#fhw` | Fica de fora |

O detalhe por marco está em `reports/runtime-<marco>.md`, com a lista exata do que capturou e do que não capturou, e o motivo de cada caso.

**A Central de Ajuda é o caso não resolvido.** O widget existe e abre quando chamado à mão numa sondagem, mas não abre pela cena automatizada — três tentativas, com `gFraHelpOpen`, `gOpenHelp` e clique no FAB. Como a apresentação não depende dessa tela, ela ficou de fora em vez de consumir mais tempo. A cena continua em `cenas.js`: se alguém descobrir o gatilho, é uma linha.

**A tela de login deixou de ser uma lacuna.** Ela era invisível à captura porque o `versao.js` injeta uma sessão de demonstração que a substitui antes de qualquer print. O servidor do capturador passou a aceitar `?semdemo=1`, que devolve o HTML sem essa injeção — o arquivo em disco não é tocado. Hoje o login está capturado nos três pontos de comparação.

**Cenas ainda fora do conjunto:** o canvas do Estúdio com template aberto e o fluxo de publicar — as duas dependem de conteúdo salvo no banco, que offline não existe.

---

## 5. Motivações: o que é fato e o que é leitura

O repositório registra **o que** mudou e, nas mensagens de commit e no `luma-brain/`, boa parte do **porquê**. Onde a motivação está escrita, a apresentação afirma. Onde não está, ela usa "aparenta" ou simplesmente não diz.

Dois exemplos de motivação **documentada**, usados como fato:

- O Luma CLI nasceu de um incidente real de sync, registrado em `docs/LUMA-BACKEND-CHANGELOG.md`.
- O tema Much+ foi concebido em 22/07 no `luma-brain` **antes** de existir em código (commits `5067bd2` e `f1984dc`).

---

## 6. O que esta apresentação não pode afirmar

Nada disso existe no repositório, então nada disso aparece nos slides:

- Número de usuários, franquias atendidas ou artes geradas.
- Tempo real de criação de uma arte por um franqueado.
- Adoção, retenção, satisfação ou qualquer métrica de uso.
- Impacto financeiro ou economia de horas.
- Decisões de produto que não deixaram rastro escrito.

O repositório mede **código**, não **uso**. Se a apresentação precisar de números de negócio, eles têm que vir de outra fonte — e devem ser marcados como tal.

---

## 7. Sobre as ferramentas

Playwright (captura) e `python-pptx` (empacotamento) foram instalados no ambiente de autoria. **Nenhum dos dois entra no produto**: o front do Luma continua vanilla JS, sem build e sem dependência de runtime. A regra de "nenhuma dependência nova" é sobre o que o franqueado carrega no navegador, e ela segue intacta.

A única alteração em código do produto foi em `scripts/versao.js`: cinco linhas que exportam as funções já existentes, para que o capturador reutilize o mesmo motor em vez de clonar a lógica de preparar uma versão. A interface do Luma não foi tocada.
