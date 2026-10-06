# Suporte fora do Luma — estudo da ponte com o Telegram

> Estudo de 26/09/2026, feito antes de qualquer código. Pergunta: **dá para a equipe DM receber e
> responder o suporte ao vivo sem estar com o painel do Luma aberto?** E o Telegram é o canal certo?
> Fatos técnicos conferidos em fonte primária (links em cada seção). O que não foi confirmado está
> marcado como **não confirmado**.
>
> Pré-requisito já entregue: atendimento com dono, estado e histórico
> (`supabase/migrations/20260926120000_luma_suporte_atendimento.sql`). Sem isso, uma ponte externa
> só multiplicaria o problema de dois atendentes respondendo a mesma conversa.

## Decidido e construído (26/09/2026)

**Decisões do Ryan** (respondendo o §10 abaixo):

1. **Telegram.** A equipe vive no WhatsApp, mas o custo da Cloud API pesou.
2. **Os prints vão** para o Telegram.
3. **O jurídico aprovou** a conversa do franqueado no Telegram.
4. **Quem atende pelo Telegram aparece online** para o franqueado.

Com isso as duas etapas do §9 saíram juntas:

- **Banco:** `supabase/migrations/20260926130000_luma_suporte_telegram.sql`.
- **Edge Function:** `supabase/functions/suporte-telegram/index.ts`, com `verify_jwt = false` no
  `config.toml`.
- **Front:** `js/core/suporte.js` + widget de ajuda (vincular a conta, "pelo Telegram" nas
  respostas).
- **Chave** `global.help.suporte.telegram` no Controle do produto, **nascida desligada**.

**Como fica:**

- **Um tópico por franqueado** no supergrupo da equipe. O bot posta a mensagem do franqueado (com o
  print), as respostas dadas no Luma ("Ana (pelo Luma): …") e o histórico do atendimento.
- **Responder no tópico chega ao franqueado** como mensagem da pessoa, e passa pela mesma trava de
  responsável.
- **Comandos no tópico:** `/assumir`, `/resolver`, `/repassar <nome>`.
- **Disponibilidade:** `/disponivel` põe a pessoa online para o franqueado por 8 horas (um turno);
  `/ausente` encerra antes.
- **Visto:** responder pelo Telegram marca as mensagens do franqueado como vistas.

O passo a passo para ligar está em **"Como ligar"**, no fim deste arquivo.

---

## Resposta curta (do estudo, antes das decisões)

**É viável, e o Telegram é a melhor opção entre as avaliadas, desde que o jurídico aprove o
destino dos dados.** Recomendo fazer em duas etapas:

1. **Aviso de mão única** (Luma → Telegram). O franqueado escreve e o bot avisa num grupo privado
   da equipe, com um link para abrir a conversa no Luma. Resolve "receber sem o painel aberto".
   Não precisa vincular contas nem receber mensagens do Telegram.
2. **Resposta pelo Telegram** (mão dupla). Só depois de o jurídico aprovar e de cada atendente
   vincular a própria conta. A resposta passa pela **mesma trava de responsável** do banco.

O que decide se vale a pena não é técnico:

- **LGPD.** A mensagem do franqueado sai do Supabase e passa a ficar guardada nos servidores do
  Telegram, sem criptografia ponta a ponta.
- **Hábito da equipe.** Se a equipe já vive no Slack ou no WhatsApp, o canal certo é outro (§9).

---

## 1. Arquitetura

O Luma não tem servidor de aplicação. O único código de servidor possível é **Supabase Edge
Function** (já usamos `ai` e `invite-user`), mais gatilhos no Postgres. A ponte cabe nisso:

```
 Franqueado (Luma)
      │ INSERT luma.suporte_mensagens
      ▼
 Postgres ── gatilho ──► luma.suporte_saida (fila: o que falta mandar ao Telegram)
      │                          │ pg_cron a cada 1 min (ou Database Webhook + reprocesso)
      │                          ▼
      │                 Edge Function `suporte-telegram` ──► Bot API: sendMessage no tópico
      │                                                     do franqueado, no supergrupo da equipe
      │
      ◄── RPC luma.suporte_responder_externo ◄── Edge Function ◄── webhook do Telegram
          (só service_role; aplica a trava        (confere o X-Telegram-Bot-Api-Secret-Token
           de responsável e grava como o           e se o remetente tem conta vinculada)
           atendente vinculado)
```

- **Por que uma fila (`suporte_saida`) e não só o Database Webhook.** O Database Webhook usa
  `pg_net`, que manda a requisição depois do commit, mas **não tenta de novo** quando ela falha.
  A fila de requisições fica em tabela UNLOGGED (some num crash), e a própria doc marca o `pg_net`
  como beta. Uma tabela de saída com `tentativas`/`enviado_em`, varrida por `pg_cron`, garante que
  nenhuma mensagem fica sem aviso.
  <https://supabase.com/docs/guides/database/webhooks> · <https://supabase.com/docs/guides/database/extensions/pg_net>
- **Limites da Edge Function:** 2 s de CPU por requisição, 150 s de timeout ocioso, 256 MB. Com
  folga para repassar texto e um print de 5 MB.
  <https://supabase.com/docs/guides/functions/limits>
- **Uma mudança obrigatória no banco para a mão dupla.** O gatilho `suporte_msg_carimbo` grava o
  autor a partir do `auth.uid()`. A Edge Function roda com service role e não tem `auth.uid()`.
  Por isso a resposta vinda do Telegram entra por uma RPC nova
  (`luma.suporte_responder_externo(p_autor, p_franqueado, p_texto, p_anexo)`, executável **só** por
  `service_role`). Ela carimba o autor vinculado e passa pela mesma regra do
  `suporte_msg_estado`: com outro responsável, recusa.

## 2. Segurança

| Risco | Tratamento |
|---|---|
| Alguém chamar a URL do webhook fingindo ser o Telegram | `setWebhook` com `secret_token` (1–256 caracteres `A-Za-z0-9_-`). O Telegram manda esse valor no cabeçalho `X-Telegram-Bot-Api-Secret-Token` em toda chamada; sem ele, 401. <https://core.telegram.org/bots/api#setwebhook> |
| A função precisa aceitar chamada sem JWT do Supabase | `verify_jwt = false` **só** nessa função, com a verificação do segredo feita dentro dela (é o padrão documentado para webhooks externos). O exemplo oficial Supabase+Telegram confere o segredo por `?secret=` na URL; o cabeçalho é melhor porque a URL vai para logs. <https://supabase.com/docs/guides/functions/function-configuration> · <https://supabase.com/docs/guides/functions/auth> |
| Token do bot vazar | Fica em `supabase secrets` (lido por `Deno.env.get`), nunca no front nem no repositório. <https://supabase.com/docs/guides/functions/secrets> |
| O link de arquivo do Telegram **contém o token do bot** (`api.telegram.org/file/bot<token>/…`) | O arquivo é baixado **só dentro da função** e regravado no bucket `luma-suporte`. O link nunca vai para o banco nem para o navegador. <https://core.telegram.org/bots/api#getfile> |
| Pessoa de fora no grupo, ou ex-funcionário que continua nele | Grupo privado, sem link de convite público. O desligamento passa a incluir `banChatMember` + desvincular a conta. O que a pessoa já viu ou baixou continua com ela. <https://core.telegram.org/bots/api#banchatmember> |
| Mensagem no grupo de alguém sem conta vinculada | A função ignora a mensagem e o bot responde no tópico pedindo o vínculo. Nada entra no Luma. |
| Replay do mesmo update | Guardar o `update_id` processado e descartar repetidos (o Telegram reenvia quando a resposta não é 2XX). <https://core.telegram.org/bots/api#getting-updates> |

## 3. Autenticação (quem no Telegram é quem no Luma)

- **Vínculo por deep link.** Em "Minha conta", a pessoa da equipe clica em "Vincular Telegram". O
  Luma gera um código de uso único, guardado como hash e válido por 10 minutos, e abre
  `t.me/<bot>?start=<código>` (até 64 caracteres, `A-Z a-z 0-9 _ -`). O bot recebe `/start <código>`
  no chat privado, e a função grava `telegram_user_id ↔ profile_id` em
  `luma.suporte_telegram_contas`. A doc do Telegram cita exatamente esse uso.
  <https://core.telegram.org/bots/features#deep-linking>
- Guardar o `User.id` como `bigint` (até 52 bits). O `username` é opcional e muda, então **não**
  serve de chave. <https://core.telegram.org/bots/api#user>
- Só `equipe_dm`/`gestao` **ativos** podem vincular. Desativar a pessoa no Luma
  (`profiles.ativo = false`) precisa derrubar o vínculo: a RPC confere `ativo` a cada resposta.
- Alternativa descartada: Telegram Login (OIDC). Serve para entrar num site com o Telegram, e o
  Luma já tem login. O deep link resolve o vínculo com menos peças.
  <https://core.telegram.org/widgets/login>

## 4. Threading (uma conversa = um tópico)

- **Recomendado: supergrupo privado da equipe com fórum ligado**, um tópico por franqueado.
  `createForumTopic` cria o tópico (nome de 1–128 caracteres; o bot precisa ser admin com
  `can_manage_topics`). As mensagens vão com `message_thread_id`, e `editForumTopic` renomeia o
  tópico com o estado ("Novo · Carla · Chapecó", "Com Ana · …"). O mapeamento fica em
  `luma.suporte_telegram_topicos (franqueado_id, chat_id, thread_id)`.
  <https://core.telegram.org/bots/api#createforumtopic>
- **Por que grupo e não o chat privado de cada atendente.** Desde a Bot API 9.3/9.4 (dez/2025–fev/2026)
  existem tópicos em chat privado com bot. Mas a conversa ficaria espalhada por N chats, e perderíamos
  o que o grupo dá de graça: todos veem quem assumiu. <https://core.telegram.org/bots/api-changelog>
- **Comandos no tópico:** `/assumir`, `/resolver`, `/repassar`. Eles chamam as mesmas RPCs
  `suporte_*` com o autor vinculado. Responder sem ser o responsável recebe do bot a mesma recusa do
  Luma ("Ana está atendendo; use /assumir").
- Bot API atual: **10.3, de 24/08/2026**. <https://core.telegram.org/bots/api#recent-changes>

## 5. Anexos

- Prints do Luma (PNG/JPG/WEBP, até 5 MB) cabem nos dois sentidos. Upload multipart: foto até
  10 MB, documento até 50 MB. Download pelo bot (`getFile`): até 20 MB, e o link vale "pelo menos
  1 hora". <https://core.telegram.org/bots/api#sending-files> · <https://core.telegram.org/bots/api#getfile>
- ~~Recomendação para a etapa 1: não mandar o print.~~ **Decidido: o print vai** (26/09). Ele sai
  do bucket privado pela função e é postado com `protect_content`.
- Foto enviada no tópico é baixada pela função, conferida (tipo e tamanho, as mesmas regras do
  bucket) e regravada em `luma-suporte/<franqueado_id>/`. Arquivo que não for imagem é recusado com
  aviso do bot.

## 6. Privacidade (o ponto que decide)

- **Não há criptografia ponta a ponta.** Ela só existe em Chats Secretos e chamadas. Grupos e
  chats com bot são "cloud chats": criptografados entre o aparelho e o servidor, e **armazenados nos
  servidores do Telegram**. <https://telegram.org/privacy> (§3.3, §4.2) · <https://telegram.org/faq>
- **Onde ficam os dados.** Quem se cadastrou no Reino Unido ou no EEE fica nos Países Baixos. Os
  demais ficam em data centers de várias jurisdições. O Telegram tem encarregado LGPD para o Brasil
  (política atualizada em 21/08/2026). <https://telegram.org/privacy>
- **O desenvolvedor do bot (a DM) é terceiro independente do Telegram** (§6.4). Um bot admin
  **recebe todas as mensagens do grupo**: o privacy mode não vale para admin.
  <https://core.telegram.org/bots/faq> · <https://core.telegram.org/bots/features#privacy-mode>
- **Quem recebe pode repassar**, e o Telegram diz que não tem como impedir (§8.1). Mitigação
  parcial: `protect_content` nas mensagens do bot bloqueia encaminhar e salvar. **Não confirmado:**
  se bloqueia print de tela e exportação pelo Telegram Desktop.

**O que isso significa para o Luma.** Hoje a conversa do franqueado fica só no nosso Supabase, com
RLS. Com a ponte, uma cópia passa a morar num serviço de terceiro, fora da RLS, legível por todo
mundo do grupo e sem prazo de retenção nosso. Antes da etapa 1:

- aprovação do jurídico/DPO da DM;
- aviso ao franqueado na tela do suporte ("a equipe pode receber sua mensagem pelo Telegram");
- mensagem **mínima** no aviso: primeiro nome, cidade, o texto, **sem print** e sem o contexto
  completo (campanha/material ficam no Luma).

## 7. Sincronização bidirecional

| Sentido / evento | Vai? | Como |
|---|---|---|
| Franqueado escreve no Luma | Sim | Fila → bot posta no tópico |
| Equipe responde **no Luma** | Sim | Espelhada no tópico ("Ana, pelo Luma: …"), para o tópico ter a conversa inteira |
| Equipe responde **no Telegram** | Etapa 2 | Webhook → RPC externa → entra no Luma como mensagem do atendente vinculado. O franqueado não vê diferença |
| Assumir / repassar / resolver | Sim, nos dois sentidos | No Luma: vira linha no tópico + nome do tópico. No Telegram: comandos chamam as mesmas RPCs |
| Mensagem **editada** no Telegram | Não | O bot recebe `edited_message`, mas a mensagem do Luma é imutável (grant de UPDATE só em `lida_em`). O bot avisa: "edição não chega ao franqueado, mande de novo" |
| Mensagem **apagada** no Telegram | Não | **Não existe** update de mensagem apagada em grupo (só para contas Business). <https://core.telegram.org/bots/api#update> |
| "Visto" | Parcial | Não dá para saber quem leu no Telegram. Proposta: responder marca como lidas as mensagens do franqueado |
| Presença ("online agora") | Sim (decidido em 26/09) | `/disponivel` no Telegram grava `disponivel_ate` (8 h). O franqueado vê a pessoa online, e a pergunta dele vai direto para a equipe, sem passar pela IA. `/ausente` encerra antes |

**Limites de taxa.** Grupo aceita 20 mensagens/min do bot; o mesmo chat, cerca de 1/s; o erro 429
traz `retry_after`. Com um aviso por mensagem de franqueado, sobra folga no volume atual. A fila
respeita o `retry_after`. **Não confirmado:** se cada tópico conta separado dentro do limite do
grupo. <https://core.telegram.org/bots/faq>

## 8. Por que Telegram (e não outro)

| Canal | Recebe fora do Luma | Responde fora do Luma | Bloqueio principal |
|---|---|---|---|
| **Telegram** | Sim | Sim | LGPD (§6). Tecnicamente cabe inteiro em Edge Function + fila |
| WhatsApp Cloud API | Sim | Sim | Mensagem livre só na janela de 24 h aberta pelo usuário. Fora dela, template pago por mensagem, conta Meta Business e número dedicado. Avisar um atendente que não escreveu nas últimas 24 h já cai no template. <https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing> |
| Slack (Events API) | Sim | Sim | Só serve se a equipe já usa Slack. Exige resposta 2xx em 3 s (senão, 3 tentativas), o que pede processar em segundo plano. <https://docs.slack.dev/apis/events-api/> |
| Web Push (PWA) | Sim (só aviso) | Não | Não resolve "responder". No iPhone só funciona com o Luma instalado na Tela de Início. Complementa, não substitui. <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/> |

## 9. Plano (histórico — as duas etapas foram feitas juntas em 26/09; ver "Como ligar")

**Etapa 1 — aviso de mão única** (depois do aval do jurídico):

1. Criar o bot (BotFather) e o supergrupo privado com fórum; o bot entra como admin só com
   `can_manage_topics` e `can_post_messages`.
2. Migration: `suporte_saida` (fila), `suporte_telegram_topicos`, gatilho que enfileira a
   mensagem do franqueado e os eventos de atendimento, `pg_cron` que chama a função.
3. Edge Function `suporte-telegram` (Deno): lê a fila, cria o tópico se faltar, `sendMessage`
   com `protect_content`, grava `enviado_em` ou `tentativas` + erro.
4. Copy no widget avisando o franqueado.

**Etapa 2 — resposta pelo Telegram:**

5. `suporte_telegram_contas` + vínculo por deep link em "Minha conta" (equipe).
6. Webhook na mesma função (`verify_jwt = false`, segredo no cabeçalho, deduplicação por
   `update_id`), RPC `suporte_responder_externo` só para `service_role`, comandos `/assumir`,
   `/resolver`, `/repassar`.
7. Casos novos no `supabase/tests/rls.sql`: franqueado e anon não chamam a RPC externa; resposta
   de conta desvinculada ou desativada é recusada; a trava de responsável vale para o Telegram.

## 10. Decisões que eram do Ryan (respondidas em 26/09/2026)

1. **O jurídico/DPO aprova** conversa de franqueado em servidor do Telegram? → **Aprova.**
2. **A equipe já usa Telegram?** → Usa o WhatsApp, mas **vai de Telegram** para não ter custo.
3. **Print vai para o Telegram?** → **Vai.**
4. **Quem atende pelo Telegram conta como "online"** para o franqueado? → **Conta** (`/disponivel`).

---

## Como ligar

A ordem importa: o segredo no Vault é o **último** passo. Sem ele nada entra na fila. Com ele e sem
a função no ar, os itens falhariam até serem descartados.

1. **Banco.** No SQL Editor, aplicar em ordem `20260926120000_luma_suporte_atendimento.sql` e
   `20260926130000_luma_suporte_telegram.sql`. Rodar `supabase/tests/rls.sql`: casos
   "atendimento:" e "telegram:", todos `ok = true`.
2. **Bot.** No Telegram, falar com o @BotFather: `/newbot` e guardar o token. Opcional:
   `/setcommands` com `disponivel`, `ausente`, `assumir`, `resolver`, `repassar`.
3. **Grupo.** Criar um supergrupo **privado** (ex.: "Suporte Luma"). Em Configurações, ligar
   **Tópicos**. Adicionar o bot como **administrador** com permissão de gerenciar tópicos, e
   adicionar a equipe.
4. **ID do grupo.** Mandar uma mensagem qualquer no grupo e abrir
   `https://api.telegram.org/bot<TOKEN>/getUpdates`. O `chat.id` começa com `-100`. Faça isso
   **antes** do passo 7: com webhook ligado, o `getUpdates` não responde.
5. **Segredos da função.** Gerar um segredo só com letras, números, `_` e `-` (ex.:
   `openssl rand -hex 32`), e gravar os três:
   `supabase secrets set TELEGRAM_BOT_TOKEN=<token> TELEGRAM_CHAT_ID=<-100…> TELEGRAM_WEBHOOK_SECRET=<segredo>`
6. **Função.** `supabase functions deploy suporte-telegram --no-verify-jwt`
7. **Webhook.** Configurar com o mesmo segredo:
   `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://uqrqzjafhigjuvtjqzid.supabase.co/functions/v1/suporte-telegram" -d "secret_token=<segredo>" -d 'allowed_updates=["message","edited_message"]'`
   Conferir com `getWebhookInfo` (sem `last_error_message`).
8. **Vault.** No SQL Editor: `select vault.create_secret('<segredo>', 'luma_suporte_telegram_segredo');`
   A partir daqui, mensagem nova no Luma vai para o Telegram. O histórico anterior não vai.
9. **Tela.** Ligar "Suporte pelo Telegram" no Controle do produto (painel da conta → Controle do produto).
10. **Cada atendente:** mandar `/start` no privado do bot, colar o código em Ajuda › Mensagens →
    "Vincular o Telegram", e usar `/disponivel` quando for atender por lá.

**Onde olhar se algo não chegar:**

- `select id, tentativas, erro from luma.suporte_telegram_saida where enviado_em is null order by id;`
  mostra a fila.
- Os logs da função `suporte-telegram` ficam no painel do Supabase.
- `getWebhookInfo` mostra o lado do Telegram.

**Desligar:** apagar o segredo do Vault (a fila para de encher) e `deleteWebhook` no bot. A chave do
Controle do produto só esconde a tela de vínculo.

**Desligamento de alguém da equipe:** desativar no Luma já corta as respostas pelo Telegram, porque
a RPC confere `ativo`. Também remover a pessoa do grupo (`banChatMember`, ou pelo próprio app).
