# 07 — ROADMAP · o caminho até a v1

> O plano oficial do Luma. **Reescrito em 2026-09-02 por decisão do Ryan**: o roadmap anterior
> tinha 379 linhas de auditoria acumulada e virou arquivo morto de tanto detalhe. O histórico
> completo (bugs com `arquivo:linha`, code reviews, decisões antigas) **continua no git** — é a
> versão deste arquivo no commit anterior a esta reescrita. Nada foi perdido; foi tirado da frente.
>
> **A v1 agora tem duas frentes e nada mais:** refinar o que existe e entregar um módulo de
> calendário simples. Feature nova fora dessas duas só entra depois do lançamento.
>
> Dono: Ryan. Atualize os checks conforme avança.

---

## 1. O que a v1 é (definição de pronto)

O Luma lança quando estas três frases forem verdade **sem asterisco**:

1. **O franqueado abre, gera e baixa sem suporte** — nenhum clique morre em silêncio, nenhuma tela mente sobre o que fez.
2. **O calendário diz o que tem hoje** — a data traz a campanha, e a campanha traz as artes prontas.
3. **O lançamento cabe em duas abas** — Franqueado e Calendário. Todo o resto está atrás de permissão ou fora.

---

## 2. As abas do lançamento

| Aba | Quem vê | Estado |
|---|---|---|
| **Franqueado** | todo mundo | ✅ existe, em refino |
| **Calendário** | todo mundo | 🔨 a construir (Frente 2) |
| **Estúdio** | só a equipe (`equipe_dm`/`gestao`, via `gIsAdmin`) | ✅ existe, já escondido do franqueado |
| **Academia** | atrás da flag `module.academia` | ⏸ decisão aberta #2 |

**Como o gate já funciona** (`js/main.js:23-32`): cada modo tem uma flag (`G_MODE_FEATURE`) e
`gModeAllowed` só abre se **a role permite E a flag permite**. O Estúdio já é bloqueado por role
— não é preciso inventar nada para "só o Ryan ver". O calendário entra no mesmo trilho: mais um
modo, mais uma aba, mais uma flag.

---

## 3. Frente 1 — Refino (o foco de agora)

*O que falta lapidar no que já existe. Sem feature nova aqui.*

### Fechado nesta rodada (setembro/2026)

- [x] **Sheets no celular** — a folha de edição inteira: arte fixa que encolhe com o teclado, campos em ordem de cabeça, foto com miniatura, fila de ofertas ("próxima pendente"), duplicar/apagar, criar oferta, miniaturas sob demanda.
- [x] **Foto em todas as ofertas** — a raiz era `fValidate` tratando dataURL como texto e marcando toda linha com foto como "muito longa" (linha com erro é pulada na geração).
- [x] **"Mudar tudo de uma vez"** — de seis botões para uma barra que conhece o tipo do campo (texto, data com chips, logo de loja, foto) e três atalhos.
- [x] **Instagram e WhatsApp** — abriam no vazio no celular; agora a folha nativa vem primeiro e o app abre por deep link quando ela é recusada.
- [x] **Teste de fogo (02/09)** — dois botões que chamavam funções inexistentes, a arte esperando a legenda por IA (13,5s → 0,9s) e texto gigante estourando a lista (37.790px → 360px).
- [x] **Chat do franqueado (02/09)** — hierarquia: avatar sólido só na pergunta ativa, selo "EU" fora, "Passo X de Y" como legenda (não chip na frente da pergunta), a conversa apoiada no rodapé (eram 470px de vazio) e a arte da conversa em palco no celular. Achado no caminho: no tema escuro o campo de resposta tinha texto a **1,04:1** — invisível.
- [x] **Tela de login (02/09)** — o baralho de artes agora **se rende ao vivo**: mão sorteada por visita entre as 13 capas reais da pasta e uma carta trocando a cada 4,5s em rodízio (18s por carta), com fila para não repetir capa, pré-carregamento para não piscar, e parada quando a aba está oculta, depois do login ou com movimento reduzido. Mais varredura de marca ao baralho assentar, relevo das cartas ao ponteiro, floração do anel de foco e luz no CTA.
  - **Geometria do baralho virou contrato**: sorteando, o que se perde no corte é imprevisível. A carta 3 escondia **21% da área** sob a carta 2; agora a pior sobreposição é 13% (só em 1280) e 7–10% no resto. Medido em 1100/1280/1440/1680/1920/2560 — mexer nas larguras exige refazer a medição.
  - **Gradiente: fora por decisão do Ryan.** A passagem teve aurora deslizante, véu escuro sob o texto e calor no lado do formulário; nada disso ficou. Registrado no `login.css`: era o véu que segurava o branco em 2,36–2,60:1, e sem ele o contraste volta a **2,27:1** — o valor que o `04_DESIGN_SYSTEM` já documenta para display branco sobre #FF9000, medido no ponto. Quem reintroduzir luz ali precisa medir o fundo sob os glifos (a 1ª tentativa derrubou para 1,89:1 sem nada denunciar na tela).

### Fechado nesta rodada (setembro/2026)

- [x] **Peso do boot e cache (02/09)** — o buraco era grave: **59 dos 95 assets sem `?v=` nenhum** (entre eles `core/auth.js`, `core/supabase.js`, `core/feature-flags.js`, `modules/franqueado.css`), ou seja correção nesses arquivos não chegava em quem já tinha aberto o Luma. Agora é **um número só para todos** (`?v=N`, `sed` num comando — convenção no `03_ENGINEERING` §6.1). Junto: pdf-lib saiu do boot (513 KB sob demanda) e papaparse morto foi deletado → **4.738 KB → 4.207 KB (−11%)**.

- [x] **Rodada de usabilidade V1 (08/09) — teste com gente do time criando uma arte de ponta a ponta.** Dez achados, todos de fricção, nenhum de feature faltando. O que mudou:
  - **P0 — chat e prévia disputavam a autoria.** As duas passaram a ser interfaces da MESMA `fState.dados`, e **valor só muda por ação explícita**. Quatro caminhos reescreviam em silêncio: `fGoBack` apagava TODAS as respostas dali pra frente (inclusive as escritas na prévia), `fPickLoja` passava o perfil salvo por cima do que a pessoa digitou, `fApplyRecoverDraft` fazia `dados = draft.dados` (um `=` que descartava o que estava em cena) e o chip **"Pular"** aparecia sobre campo já preenchido — clicar gravava `''`. Passo já respondido agora oferece **"Manter «valor»"**. Travado em `tests/franqueado-fluxo.html` (15 casos).
  - **Perguntas em ordem de OFERTA e copy de venda.** Havia DUAS montagens de pergunta (`fSelectMaterial` e o reabrir arte do `catalog.js`, esta mais pobre): a mesma arte perguntava diferente conforme a porta de entrada. Virou `fBuildPerguntas`. Preço "de"/"por" virou um **par** — a segunda pergunta cita o valor já respondido ("E qual será o preço promocional? O preço original é R$ 49,90"); preço único não finge promoção. "Qual é o produto que você quer usar?" → **"Qual produto você quer anunciar?"**.
  - **Nome de variável nunca mais aparece.** Eram **6 fallbacks `|| v`** independentes (`materials.js`, `catalog.js` ×2, `chat.js` no fEditCampo, `live-preview.js` no _fLpLabel, `chat-input.js` no fGetFieldType) — e um 7º no diagnóstico do Auto-layout, que punha `precoPor` numa frase que o próprio comentário jurava ser só de rótulos. Virou `gFieldLabel` (designer > catálogo > humanização segura > genérico). 10 casos em `franqueado-honestidade`.
  - **Editabilidade ficou óbvia.** A bolha da arte lista os campos com **lápis fixo** de alvo 32px (`aria-label`, `title`, funciona no toque) — e não dezenas de lápis desenhados sobre a peça. A pista da prévia deixou de depender de hover.
  - **Reposicionar foto virou descobrível**: ação **"Ajustar"** no próprio passo de foto (`fAjustarFoto` → `fLpFrameVar`, acha a camada pelo vínculo e não por coordenada de clique). E o modo ganhou **Cancelar** (restaura o snapshot de quando abriu — só o enquadramento, não o upload nem a arte) e **Aplicar**; **Esc cancela** (antes Esc fazia o mesmo que Concluir: gravava).
  - **Auto-zoom saiu inteiro** — botão, estado, preferência e o `scale(1.8)` no campo ativo, que mexia na arte sozinho enquanto a pessoa digitava. O "caber na tela" (`fLpRefit`) e o zoom/pan manuais ficam.
  - **Auto-layout deixou de ser painel de controle do franqueado**: ORIGINAL FIRST incondicional no render, controle fora da UI, e no máximo uma linha discreta ("Layout ajustado para o conteúdo caber"). Detalhe em `docs/LUMA.md` §Layout vivo.
  - **Catálogo sai de cena durante a criação** também no desktop (era só 681–1080px). Medido em Chromium: 328px → **0px** com cliques desligados; volta a 328px pelo "← Campanhas", sem perder rascunho nem arte. O dock de 3 colunas sobrevive (`:not(.panel-dock-active)` no `#fran-right`).
  - **Asset com preview antes de avançar**: o passo de imagem parava de pular sozinho depois de 600ms — quem subia o arquivo errado só descobria três passos adiante. Agora mostra e **espera** confirmação.
  - **Logo com validação determinística** (nada de IA classificando imagem): resolução mínima e proporção absurda, com teto folgado de 12:1 para **não reprovar logo horizontal legítimo**; informa, nunca bloqueia ("Trocar arquivo" / "Usar mesmo assim"). Dois bugs achados no caminho: o resize convertia para **JPEG** (que não tem canal alfa) e devolvia logo transparente com **fundo preto**; e a moldura desenhava logo em `cover`, **cortando a marca** — agora `contain` quando o campo é semanticamente logo e o designer não escolheu.
  - **Achado que só o navegador pega:** `_ICO_CHECK` já existia em `core/user-profile.js` e o segundo `const` derrubava `chat.js` inteiro (`Identifier has already been declared`). O `node --check` por arquivo passa — a colisão só existe quando os dois carregam juntos. Nota nova no `MAPA.md` §Verificação.
  - **Não verificado nesta rodada:** nada de Supabase foi tocado (sem acesso nesta sessão) — sem migration, sem RLS, sem deploy, e **persistência remota não foi validada**. Sheets, Histórico, Busca e Feedback seguem verdes na suíte, mas o fluxo com login real e RLS continua na lista de "verificação final nas 3 roles".

- [x] **Rodada de controle e confiança (08/09) — "me arrependi, e agora?".** Onze frentes, todas de saída para o arrependimento. O que mudou:
  - **Refazer tinha TRÊS caminhos com comportamentos diferentes** — o do card (`fRefazer`) destruía sem perguntar, o do cabeçalho (`fResetFlow`) confirmava por chips, e o `fEditarTudo` era um terceiro reset sem confirmação **e sem nenhum chamador** (morto desde que o card de revisão saiu). Era isso o "às vezes não avisa". Virou uma porta (`fAskRestartArt`, confirma) e um motor (`fRestartArt`, executa); os nomes antigos viraram alias fino. O que o reset fazia e ninguém sabia: **não** limpava o rascunho do localStorage (ficava um fantasma) e **não** trocava material nem formato. Agora limpa o rascunho.
  - **Refazer virou desfazível.** Snapshot completo antes do reset — respostas, passo, conclusão, material, formato, cores extraídas, fotos, enquadramentos **e a conversa** (sem ela o chat volta vazio com a prévia cheia, as duas metades divergindo). Toast "Arte reiniciada · Desfazer" com 7s, mais o botão do cabeçalho enquanto houver o que desfazer.
  - **Desfazer existia mas ninguém achava — e não existia motor nenhum.** O levantamento não encontrou undo do lado do franqueado: só o `dUndo`/`dRedo` do Estúdio, que não se mistura. Em vez de um segundo histórico, um **slot único** de última-ação-desfazível (`_fUndoRegistra`), alimentado por três lugares: refazer arte, aplicar enquadramento e editar pela prévia. Descoberta por três vias: toast com ação, botão no cabeçalho (com o rótulo dizendo O QUE volta) e Ctrl/Cmd+Z — este só no modo franqueado e fora de campo de texto, senão roubaria o atalho do Estúdio e o do navegador.
  - **Entrega final enxuta.** Havia quatro CTAs disputando, com Instagram e WhatsApp em destaque **laranja** e o Baixar PNG rebaixado a secundário — a ação que a pessoa veio fazer, em terceiro lugar visual. Agora: Baixar PNG primário, Refazer secundário. Instagram, WhatsApp e a faixa de lote saíram da superfície; **os motores continuam vivos** e chamados de outros pontos.
  - **Botão de áudio.** O único controle de áudio do franqueado era o microfone de ditado ("Falar"), entre o campo de resposta e o Enviar. Saiu da barra; `fStartSpeech` continua no código (hoje sem chamador na UI) e o feedback sonoro interno não foi tocado.
  - **Feedback deixou de ser mobília da entrega.** Nascia dentro do `.art-wrap` na GERAÇÃO — toda arte, toda vez, antes de a pessoa ter baixado qualquer coisa. Virou convite pós-download, num modal pequeno, com carência **100% local**: 1 convite a cada 7 dias por dispositivo, 30 dias por campanha, nunca duas vezes na mesma sessão. Esc e X fecham sem cobrar explicação. ⚠ As duas janelas nasceram iguais (7/7) e o teste mostrou que a regra da campanha nunca mordia — expirava junto com a global. Por isso 30.
  - **"Mockup" saiu, e o contexto passou a respeitar o formato.** O seletor oferecia Stories | Feed | WhatsApp para qualquer arte: um post wide dentro do chassi de Stories vira uma tarja num degradê laranja, e uma arte de Story no feed perde metade da composição. `fPostedContextForFormat` decide pela **geometria** (não pelo nome do arquivo nem pelo rótulo): ≤0,72 → Stories; até 2,20 → Feed; fora disso → `null`, e a ação **some**. Story nunca é oferecido como Feed nem o contrário.
  - **Olho da senha: o defeito era o ícone nunca mudar.** O SVG do `index.html` é um olho aberto fixo — metade do tempo ele contradizia o campo. Havia ainda dois donos do estado (esta função virava o `type`; um `onclick` de 4 comandos calculava o aria por fora, do valor lido ANTES da troca) e um terceiro caminho: revelar a senha, ir para "esqueci minha senha" e voltar deixava o campo em `text` — **senha à mostra**. Agora `gTogglePass` muda e `gSyncPassToggle` PINTA a partir do `input.type` real. Verificado no navegador nos 10 cenários do pedido, incluindo 6 cliques rápidos, erro de login, autofill externo e a volta do reset; foco e posição do cursor preservados.
  - **Dark mode virou cinza azulado** (matiz ~218°, saturação baixíssima). É temperatura, não segunda cor de marca. Contraste **medido**, com a nota preservada nos 13 pares: texto/fundo 16,57 → 15,29 (AAA), secundário/superfície 6,08 → **7,39** (AA→AAA), terciário/superfície 4,61 → 5,35 (AA), laranja/superfície 7,00 → 7,11 (AAA). A queda no texto principal é o fundo clareando de propósito. ⛔ As marcas de terceiros nas prévias (verde do WhatsApp, branco do feed, chassi do iPhone) continuam hex cru — tokenizar aquilo seria mentir sobre o que sai publicado.
  - **Achado no meio do caminho:** o chip "Manter" da rodada anterior fazia a caixa de digitar levar o texto de um passo para o seguinte. Corrigido antes desta rodada (`801d067`).
  - **Sem Supabase**, como pedido: nenhuma migration, nenhuma RLS, nenhum deploy. A carência do feedback é local por decisão, não por limitação.

### Aberto

- [x] **Hex soltos: encerrado, e era premissa errada minha (02/09).** Reportei "115 hex soltos em CSS que o franqueado vê". Classificando os 140 hex dos 5 arquivos: **45 são `var(--token, #fallback)`** (padrão defensivo, correto), **43 são paleta de MARCA ALHEIA** (a simulação de WhatsApp e o chassi do iPhone no `#f-posted-modal` — tokenizar seria mentir sobre o que o franqueado vai ver) e ~9 estão dentro de comentários citando medições. Dos ~37 restantes, os que dão para medir **passam nos dois temas** (`.lp-empty-title` 16,3:1 escuro / 18,7:1 claro; `.lp-empty-sub` 5,4:1 / 5,1:1 — `#F0EDE9`/`#8F8880` são variantes quentes afinadas a olho, e medem bem). O resto é `color:#fff` em botão de marca, idêntico em qualquer tema.
  - **O que foi feito de verdade:** a magenta do Much+ (`#F8006E`) estava cravada em 2 arquivos tendo token no `:root` → virou `var(--muchplus-magenta)` nos 4 usos, conferido pixel a pixel (`rgb(248,0,110)` antes e depois).
  - **Não fazer:** troca em massa de `color:#fff` por `var(--white)`. É churn sem ganho medido e contra a lei do patch cirúrgico. *E não repetir a varredura estática de hex: sem separar fallback de `var()`, marca alheia e comentário, ela infla o número em ~3×.*
- [ ] 🟠 **A bandeja de "pendências da arte" foi desativada sem decisão — o Ryan precisa dizer se volta.** `fLpUpdateWarnings()` só fazia `box.innerHTML=''`, desativada de carona no commit `ef07faf` ("feat(historico)"). Removi o peso morto (CSS dos 4 chips, a função no-op, a `<div aria-live>` vazia que anunciava "Pendências da arte" sem nunca ter conteúdo). Medido antes de remover, para quem for ressuscitar: no escuro os chips nunca tiveram regra e herdavam o par do tema claro — `.lp-warn-low` ficava em ~1,7:1 (invisível), `.lp-warn-over` ~2,9:1, `.lp-warn-more` ~3,5:1. Ou seja, não voltaria como estava. Hoje a validação vive em dois lugares que funcionam: erro por campo no chat (`fShowFieldError`/`fValidate`) e o `tem-erro` da folha do Sheets — eram três dizendo a mesma coisa.
  - **Sem cobertura:** o histórico. `fRenderHist()` não mexeu no DOM no harness (precisa de dado real e do container montado) — não está aprovado, está não medido.
  - **Descartado com prova:** `localStorage` sem guarda. Com o storage **totalmente bloqueado** no navegador (Safari privado), o fluxo do franqueado passa inteiro — home, catálogo, categorias, histórico, lojas, tema e o chat com rascunho. Dos 17 acessos no boot, 16 estão guardados; o único vazamento é dentro do `assets/vendor/supabase.js` e não quebra nada. *Não repetir a varredura estática: o idioma da casa é `try{...}catch(e){}` na mesma linha e três scanners deram três números diferentes, todos errados. O instrumento certo é bloquear o storage no navegador.*
- [ ] **~896 KB de Estúdio no boot do franqueado** (`layers.js` 239 + `designer.css` 237 + `templates.js` 170 + `canvas.js` 139 + `psd-parse.js` 111) — 19% do boot, para um módulo que o franqueado não pode abrir (gate por role). **Não é polimento, é arquitetura:** a prévia ao vivo chama para dentro do Estúdio (`live-preview.js:1730` → `dPreloadFolders`), então não há corte limpo. Precisa de investigação própria antes de virar tarefa.
- [x] **Import de PSD (03/09)** — o import **parou de adivinhar** qual campo é cada camada, por decisão do Ryan. `_dPsdSuggestVar` tinha cinco camadas de palpite e só uma não era chute (`{{campo}}` escrito no nome da camada, que é instrução explícita); as outras quatro — mapa fixo, lista de conhecidos, casamento com o catálogo pelo nome, heurística de conteúdo ("tem R$, logo é preço") — decidiam pelo designer e erravam calado. O motor **continua existindo** e é usado onde é pedido: linter, dica do painel de propriedades e o botão "Mapear com IA" (que só roda quando ele aperta). A memória de mapeamento também parou de converter texto→variável sozinha (é o caminho que reescreve o conteúdo).
  - Junto, acabamento na tela: filete na linha já mapeada (progresso varrível), o seletor de campo com corpo e o de modo silencioso (eram gêmeos), cascata de entrada com teto de 12 linhas, pulso de confirmação ao ligar, e a sombra de rolagem na trilha de campos (698px de chips em 670px de caixa — o último ficava cortado no meio da palavra).
  - **Duas copies que viraram mentira foram corrigidas:** "Sugestões aplicadas automaticamente" → "Você escolhe o campo de cada camada", e o sobretítulo "Importador inteligente" → "Importar do Photoshop".
  - Bug de arestas: `${it.fontSize}px` sem guarda imprimia literalmente **"undefinedpx"** na linha quando o tamanho não era derivável do PSD.
- [ ] **Ferramentas do Estúdio, uma a uma** — começar pela caixa de seleção/transform (a moldura com handles; a edição de caixa de texto é o ponto mais delicado). Vive em `js/designer/canvas.js`.
- [ ] **Upload de imagem sem teto** em moldura e biblioteca (`canvas.js:1071`, `library.js:134`) — validar como fontes e PSD já validam.
- [ ] **Verificação final nas 3 roles** no navegador (franqueado, equipe_dm, gestao) — checklist do `docs/LUMA.md` §18. É o que este ambiente não alcança: tudo que exige login real, RLS e sync.
- [ ] **Docs em dia** ao fim da frente: `LUMA.md`, changelog e este arquivo.

---

## 4. Frente 2 — Módulo Calendário (o que falta para lançar)

### O que é

A aba onde o franqueado vê **o que a rede vai comunicar e quando**. O calendário oficial de
varejo da DM — o mesmo que operações libera hoje — aparece dentro do Luma e se atualiza sozinho.
Tocar numa data leva direto **às artes daquela campanha**, que já existem no catálogo.

Em uma frase: *o calendário responde "o que eu posto essa semana?" e entrega a arte no mesmo toque.*

### O que NÃO é (fronteiras, para não inchar)

- **Não agenda post nem publica** — o Luma não envia (`00_PRODUCT` §9). O calendário informa; postar segue manual.
- **Não é um editor de calendário** — o franqueado só lê. Quem define a data é operações, na fonte oficial.
- **Não tem lembrete, nem planner pessoal, nem "minha agenda"** na v1. Depois se vê.

### O que já existe de fundação

*O módulo foi construído em setembro/2026 (`js/calendario/*`, `css/modules/calendario.css`).
Falta só ligar a fonte oficial — passos 1 e 2 abaixo. Duas decisões tomadas na construção,
para não se perderem: **quem edita é só a equipe DM** (`gIsAdmin`; o franqueado lê, filtra e
clica), e **as recorrentes ficam fora da grade** — elas cobrem o mês inteiro e, como barras,
empurravam a campanha-mãe para dentro do "+3 eventos", que era o defeito do calendário antigo.
Elas aparecem uma vez, na tira "sempre no ar".*

| Peça | Onde | Serve para |
|---|---|---|
| Sistema de modos e abas | `js/main.js:23-115` | a aba nova entra no mesmo trilho, com flag e role |
| `agendamento` na pasta | `luma.pastas`, editável no modal do Estúdio (`templates.js:1436`) | a data de go-live da campanha já é um campo real |
| Filtro por data | `_fCampAgendadaFuturo` (`catalog.js:628`) | o catálogo já esconde campanha com go-live futuro |
| Abrir campanha por id | `fSelectCamp`/`fResolveCamp` (`catalog.js`) | o clique no dia só precisa chamar o que já existe |

Ou seja: **o vínculo data → campanha → artes já é possível hoje**. O que falta é a fonte
oficial das datas e a tela.

### Os passos

1. [ ] **Decidir a fonte do dado** (decisão aberta #1 — é o que trava tudo).
2. [ ] **Trazer o calendário para uma tabela** (`luma.calendario`: data, título, campanha, descrição curta, status). Atualização automática pela fonte escolhida; nada de digitar à mão. *O front já está pronto para receber: `calFetch()` (`js/calendario/calendario.js`) é o único ponto de troca — nenhuma vista lê o seed direto.*
3. [x] **A aba** — modo `calendario` + `#view-calendario` + flag `module.calendario`, no mesmo padrão dos outros três modos (setembro/2026).
4. [x] **A tela** — quatro vistas: Visão geral, Mês, Semana e Dia. No celular a grade vira bússola (número + pontos) e a lista do dia manda, como o passo previa.
5. [x] **O clique** — evento → campanha → catálogo daquela campanha, via `calAbrirArtes` → `fSelectCamp`.
6. [x] **Estado honesto** — dia sem campanha não inventa nada; o rodapé mostra a fonte e a data da última carga, e diz com todas as letras quando o calendário é o de demonstração.

### O que fica para depois (mesmo sendo tentador)

Nudge na home ("tem campanha hoje"), notificação, plano da semana do franqueado, e o
calendário nacional empurrando material novo. Tudo isso nasce **em cima** deste módulo — só
depois que ele estiver de pé e em uso.

---

## 5. Pendências que continuam de pé

*Não são refino nem calendário, mas bloqueiam o lançamento.*

- [ ] 🔴 **Pedro aplicar o SQL das colunas `w/h/bg`** em `luma.templates` — **o sync de templates está parado desde 11/07**. SQL pronto no `docs/LUMA-BACKEND-CHANGELOG.md`. *Lição registrada: migration só está pronta quando aplicada e conferida com um select.*
- [ ] **Campanhas ainda saem do hardcode** (`js/00-config.js`) — criar campanha exige deploy. O flip da fonte para `luma.pastas` estava na metade (passos 4 e 5 do plano antigo, no git). **Isso agora importa mais**, porque o calendário aponta para campanhas: se criar campanha exige deploy, o calendário fica preso ao mesmo gargalo.
- [ ] **Grupos de visibilidade são órfãos** — gravados na UI do designer, ninguém lê no franqueado. Decidir: aplicar de verdade ou remover da UI.
- [ ] **Academia** — funcional, mas depende de a equipe publicar o conteúdo oficial e gravar o vídeo dos CEOs. Ver `docs/LUMA-ACADEMIA.md` §15.

---

## 6. Decisões abertas

| # | Decisão | Por que trava | Recomendação |
|---|---|---|---|
| **1** | **De onde vem o calendário oficial de varejo?** Planilha do Google que operações mantém? Yungas? Uma tabela que a própria DM alimenta? Um arquivo que alguém sobe? | Sem isso não dá para escrever o passo 2 — e "atualiza automaticamente" significa coisas muito diferentes em cada caso | **Planilha publicada em CSV + leitura periódica** se operações já mantém uma. É o caminho sem backend novo e sem depender de API de terceiro. Se a fonte for a Yungas, precisa saber se ela expõe algo além da tela |
| **2** | **A Academia entra no lançamento?** | É um módulo inteiro pronto; a aba muda de duas para três | **Fica atrás da flag, desligada no lançamento.** Liga quando o conteúdo oficial estiver publicado — não faz sentido lançar formação sem aula |
| 3 | **Fotos do franqueado em bucket público** — aceitar ou URLs assinadas? | — | Aceitar na v1, documentado: o PNG final é público por natureza |
| 4 | **Criar usuário pelo app** (Edge Function) ou seguir no Dashboard? | — | Dashboard na v1; Edge Function depois |

---

## 7. Depois da v1

*Estacionado com motivo. Não encher a v1.*

- **Em cima do calendário:** nudge na home, notificação de campanha nova, plano da semana.
- **Aprovadas e adiadas:** par vinculado feed↔story, backbone de eventos (destrava "mais usados da rede" e o sinal de demanda para o designer), repostar do histórico, tema por campanha (Much+), refazer a tela de login.
- **Precisa de estudo antes de comprometer:** CRM Visual (inapp/push → CleverTap) — o maior salto de valor e o mais caro; pré-requisito é mapear os formatos que o CleverTap aceita.
- **Ideias novas de 02/09** (detalhe na conversa): ler o WhatsApp do lojista no chat, formato impresso (cartaz/flyer), guarda-preço, story com movimento via WebCodecs, funcionar sem sinal.
- **Descartadas com motivo** (não voltar sem fato novo): gerar arte por IA, IA que publica, auto-resize entre formatos, Brand Guardian leve, kit "novo parceiro", vitrine "top da cidade", editor livre para o franqueado, analytics dentro do app.

---

## Ver também

- `00_PRODUCT.md` — o que o Luma é e o que ele não faz.
- `01_BUSINESS.md` — as regras do domínio.
- `docs/LUMA.md` — o técnico detalhado. `docs/LUMA-BACKEND-CHANGELOG.md` — o backend.
- **O roadmap antigo, com toda a auditoria linha a linha:** `git show <commit anterior>:luma-brain/07_ROADMAP.md`.
