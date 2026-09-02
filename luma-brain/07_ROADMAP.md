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

### Aberto

- [ ] **Varrer o Franqueado tela a tela na régua do Sheets** — catálogo, chat, resultado, histórico. O Sheets mobile passou por refino de layout, movimento e acessibilidade; as outras telas ainda não.
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
2. [ ] **Trazer o calendário para uma tabela** (`luma.calendario`: data, título, campanha, descrição curta, status). Atualização automática pela fonte escolhida; nada de digitar à mão.
3. [ ] **A aba** — modo `calendario` + `#view-calendario` + flag `module.calendario`, no mesmo padrão dos outros três modos.
4. [ ] **A tela** — mês corrente com os dias marcados, e a lista "próximos" embaixo (no celular, a lista manda; o grid é bônus de tela grande).
5. [ ] **O clique** — dia → campanha → catálogo daquela campanha, reusando `fSelectCamp`.
6. [ ] **Estado honesto** — dia sem campanha não inventa nada; falha de sincronismo mostra a data da última atualização em vez de fingir que está em dia.

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
