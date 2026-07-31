# Limitações desta apresentação

O que não foi possível recuperar, e por quê. Escrito para que nenhuma lacuna vire preenchimento inventado.

---

## 1. O que o git guarda — e o que ele não guarda

**O fato.** O repositório tem **uma raiz só**: `f9252a7`, "Initial commit", de 2026-06-16 às 11:06, com um `README.md` e nada mais. Doze minutos depois, `936c6d3` traz o produto inteiro — 85 arquivos, 42 em `js/`, 17 em `css/`, e um `index.html` de 82.099 bytes cujo título já diz **"Luma · Creative Automation"**.

**O que isso significa.** O git **guarda** o começo do Luma. A pergunta "como o produto entrou no repositório?" tem resposta: entrou já modular e já com o nome.

**O que o git não guarda** é o estágio anterior a esse: o piloto `Yungas · Módulo de Artes`, um arquivo único de 565.693 bytes, com outro nome e sem separação em módulos. Ele foi entregue fora do versionamento, está preservado em `research/origem/` e foi executado, não descrito.

**A data do piloto continua sem evidência.** O arquivo não a declara. A apresentação diz "anterior a 16/06/2026" — o dia em que o repositório já nasce com o nome Luma — em vez de cravar um dia.

⚠️ **Correção registrada.** Até 30/07, este documento afirmava que o repositório tinha *duas raízes órfãs* de 16/07 e que o commit mais antigo já trazia 285 arquivos. Era **falso**, e a causa foi um clone `shallow`: o ambiente clonou o repositório truncado, com 78 dos 239 commits e 2 das 6 branches. `git log --all` mostrava só o que estava em disco. Depois de `git fetch --unshallow` e do fetch de todas as branches, o histórico real apareceu. A lição vale para qualquer análise de repositório em ambiente efêmero: **verifique `git rev-parse --is-shallow-repository` antes de afirmar qualquer coisa sobre o começo de um histórico.**

---

## 2. O histórico cobre 45 dias, com um vazio no meio

240 commits entre 2026-06-16 e 2026-07-30, de 3 autores — ryanmotta-ai (119), Claude (86) e Pedro Moraes (35). O total cresce a cada commit; a apresentação o reconta a cada montagem. Sem tags de versão além de `desktop-v1.0.0`.

A distribuição é muito desigual: **15 e 16 de julho concentram 108 commits**, 45% de todo o histórico. E há um vazio de 30/06 a 06/07 — sete dias sem nenhum commit.

**Consequência para a narrativa.** Os marcos foram escolhidos por mudança visível, não por espaçamento regular no calendário. A mega linha do tempo dá a todos os dias a mesma largura e põe o volume na altura da barra — proporcional na largura, o dia de 1 commit virava um risco sem rótulo. Os dias sem commit nenhum entram como coluna tracejada, para que o vazio de sete dias apareça em vez de sumir.

---

## 2b. O que o primeiro commit ainda não tinha

Quatro telas comparadas na apresentação **não existem** em `936c6d3`. A coluna correspondente aparece vazia e rotulada, nunca omitida — print que some lê como print que não carregou.

| Tela | O que a verificação no código mostrou |
|---|---|
| Entrada (login) | Nenhum arquivo de autenticação. O `index.html` tem exatamente três telas — `view-franqueado`, `view-designer`, `view-dados` — e zero ocorrências de "entrar" ou "senha". O app abria direto. |
| Perfil / conta | Nenhuma função de perfil em `js/`. Sem login não há usuário, e sem usuário não há conta. |
| Exportar | O código de saída existe (`dExportSVGTemplate`, `dExportSVGFilled`, `dExportFilename`), mas nenhuma tela o chama — "exportar" não aparece no `index.html`. |
| Chat no celular | O chat **existe** (`js/franqueado/chat.js`) e está fotografado no desktop. A 390×844 a coluna não aparece em passo nenhum: o celular ainda não era alvo. |

⚠️ **Correção registrada.** Até esta rodada, o runtime do M1 dizia "tela não existe nesta versão" também para o **chat no desktop** — e a apresentação mostrava duas colunas onde deveria mostrar três. Era falso: a cena navegava campanha → material → chat, mas em `936c6d3` o chat **já está montado no boot**; o clique na campanha levava ao catálogo de materiais e derrubava o chat que já estava na tela. A cena passou a verificar se já chegou antes de navegar. Vale como regra: **um veredito de "não existe" que vem de uma automação precisa ser conferido contra o código do commit** — aqui bastou um `git ls-tree` para separar as três ausências reais da falsa.

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
