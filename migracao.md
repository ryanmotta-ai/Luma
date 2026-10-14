# Migração do Supabase — o que falta, passo a passo

> Checklist do Pedro. Atualizado em **14/10/2026, 15h**. Projeto antigo `uqrqzjafhigjuvtjqzid`
> (Ryan, Free) → novo `xqsazcazsjxajmtmirzd` (org "DM - Inovação e IA", Pro).
> Regra: **no antigo ninguém mexe** (só leitura). O Luma no ar continua no antigo até a virada.
> O roteiro técnico, com todos os comandos, é o `docs/MIGRACAO-PROJETO.md`; este arquivo é só a lista
> do que cada um faz, na ordem.
>
> Legenda: ✅ feito · ⬜ a fazer · **Você** = Pedro · **Eu** = Claude (rodo daqui quando você avisar).

---

## 1. O que já está feito

- ✅ **Você** — criou o projeto novo na org "DM - Inovação e IA" (Pro, região São Paulo).
- ✅ **Você** — `.mcp.json` com o servidor `supabase-novo` (não carregou nesta sessão; não faz falta).
- ✅ **Você** — `.env` com as 4 variáveis: `NOVO_SUPABASE_URL`, `NOVO_SUPABASE_SERVICE_ROLE_KEY`,
  `ANTIGO_DB_URL` e `NOVO_DB_URL` (Session pooler, senha real). Confirmado: as duas conexões funcionam.
- ✅ **Você** — Docker Desktop aberto (o `psql` roda em container).
- ✅ **Eu** — revisão do kit de migração (3 SQLs + script do Storage + roteiro), tudo commitado na `talpaipai`.
- ✅ **Eu** — linha de base do antigo (`migracao/verificar-antigo.txt`): 19 usuários, 18 tabelas, 34 funções, 1.660 arquivos.
- ✅ **Eu** — **Storage copiado** para o novo: 6 buckets, 887 arquivos, 0 falhas. 776 arquivos de 70 pastas de
  templates apagados ficaram para trás de propósito (lista em `orfaos-2026-10-14.json`).
- ✅ **Eu** — **Banco ensaiado no novo**: dump do antigo, restore em transação única, histórico de migrations,
  SQL 01 (policies do Storage/Realtime + gatilho do Auth), SQL 02 (469 URLs reescritas, conferência zero),
  SQL 03 (bate com o antigo linha a linha). O novo é, neste momento, uma cópia fiel do antigo das 14h37 de hoje.

---

## 2. O que falta ANTES da virada (pode ser hoje, sem pressa)

### 2.1 Edge Functions — ⬜ Você, depois ⬜ Eu

Só duas funções rodam no antigo: `ai` e `invite-user`. Para eu subir as duas no novo, preciso que a
CLI do Supabase esteja logada com uma conta que esteja na org nova. O token que está salvo na sua
máquina hoje é inválido.

1. ⬜ **Você** — abra o PowerShell na pasta do projeto e cole:
   ```powershell
   supabase login
   ```
   Abre o navegador; entre com a conta que tem acesso à org "DM - Inovação e IA"; volte ao terminal
   e confirme que apareceu "Finished supabase login". Me avise: **"login feito"**.
   - Alternativa sem terminal: no Claude Code, digite `/mcp`, escolha `supabase-novo`, habilite e
     autentique; depois reinicie a sessão. Aí eu subo pelas ferramentas do MCP.
2. ⬜ **Eu** — subo `ai` e `invite-user` no novo (as duas com `verify_jwt` ligado, igual ao antigo).
   Aviso: o `ai` do repositório está à frente do que roda no antigo (tem as tarefas do Luma Creative
   que o Ryan commitou hoje); o novo sobe com a versão do repositório, que é a fonte.

### 2.2 Secrets das Edge Functions — ⬜ Você

No Dashboard do **novo**: **Edge Functions → Secrets** (ou "Manage secrets") → Add new secret.

- ⬜ `GEMINI_API_KEY` — **obrigatório**. Sem ele a IA (legenda, encurtar, ajuda, PSD) devolve erro 503.
- ⬜ Opcionais, só se você tiver os valores (são as reservas do `ai`; sem elas o provedor é pulado):
  `NVIDIA_API_KEY`, `NVIDIA2_API_KEY`, `OLLAMA_API_KEY`, `CLOUDFLARE_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `OPENROUTER_API_KEY`.
- Onde pegar os valores: o Dashboard do **antigo** (Edge Functions → Secrets) mostra só os **nomes**, não
  os valores. Quem os criou (Ryan) tem; ou pega de novo no painel de cada provedor (Google AI Studio,
  NVIDIA, Ollama, Cloudflare, OpenRouter).
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` **não** precisa criar: a plataforma injeta.

### 2.3 Configurações do Dashboard do novo — ⬜ Você

Nada disto tem SQL; é clique. Abra o antigo e o novo lado a lado e deixe igual.

1. ⬜ **Project Settings → Data API (ou "API") → Exposed schemas:** tem que ter `public`, `graphql_public`
   e **`luma`**. Sem `luma` o Luma inteiro quebra. Não adicione `analytics`, `auth`, `storage` nem `vault`.
2. ⬜ **Authentication → URL Configuration:** Site URL e a lista de Redirect URLs **iguais às do antigo**
   (copie a lista inteira: GitHub Pages `https://ryanmotta-ai.github.io/Luma/` e, se estiver lá, a URL da
   Vercel `luma-deliverymuch.vercel.app`).
3. ⬜ **Authentication → Sign In / Providers → Email:** compare com o antigo "Confirm email", "Secure email
   change", "Minimum password length" e deixe igual.
4. ⬜ **Authentication → Emails:** se o antigo tiver SMTP próprio ("Custom SMTP") e templates editados
   (convite, redefinição de senha), copie. Sem SMTP próprio, o remetente padrão do Supabase tem limite
   baixo de e-mails por hora.
5. ⬜ **Storage → Settings → Global file size limit:** 15 MB ou mais (o maior limite por bucket é o
   `luma-renders`, 15 MB). O padrão de 50 MB serve.
6. ⬜ **Organização → Billing → Spend cap:** decidir. Ligado, bloqueia quando passar da cota do Pro;
   desligado, cobra o excedente.
7. ⬜ **Project Settings → API Keys:** copie a **Publishable key** (`sb_publishable_...`) e me mande. É a
   chave pública que vai no front (é pública por design; a `sb_secret`/service_role **nunca** sai do `.env`).

### 2.4 Limpeza antes de tirar a foto final — ⬜ Você

- ⬜ **Você** — no Estúdio do Luma **no ar** (projeto antigo), exclua as duas pastas de demo que subiram por
  engano em 14/10: **"Hamburguer Fest"** e **"Ofertas Favoritas"** (2 materiais publicados cada). Tem que
  ser pelo Estúdio, não pelo banco: se eu apagar no banco, o seu navegador sobe de novo. Fazendo isso
  antes da virada, elas nem viajam para o novo.

### 2.5 Teste local, sem commit — ⬜ Eu, depois ⬜ Você

1. ⬜ **Eu** — com a Publishable key do item 2.3.7, aponto `js/core/supabase-config.js` para o novo (só na sua
   máquina, sem commit) e subo um servidor local; te passo o link `http://localhost:8080`.
2. ⬜ **Você** — abre o link e passa por: login com o seu usuário (mesma senha de sempre) · catálogo abre ·
   gera e baixa uma arte · Estúdio publica um material de teste e exclui · suporte abre. Me diz o que
   falhou, se falhar.
3. ⬜ **Eu** — desfaço a troca do `supabase-config.js` (`git checkout`). O que você publicou de teste no novo
   some sozinho na virada (o banco do novo é zerado e refeito).

---

## 3. A virada (marcar uma janela de ~30 min; de preferência fora do horário de pico)

Por que refazer: o antigo continua vivo e as pessoas seguem gerando artes. O restore é cópia bruta, então
não dá para "atualizar por cima"; no dia, o banco do novo é zerado e refeito com a foto fresca.

1. ⬜ **Você** — avisa a equipe (Ryan, designers, franqueados ativos): **"durante 30 min ninguém publica,
   gera arte nem convida usuário; depois todo mundo faz login de novo"**. Me diz "pode ir".
2. ⬜ **Eu** — zero o novo (`00_limpar_novo.sql`: só banco e usuários; Storage e policies ficam), repito
   dump → restore → 01 → 02 → 03, repito a cópia do Storage (só sobe o que entrou de novo) e comparo
   com o antigo. Uns 15 min.
3. ⬜ **Eu** — o commit da virada na `talpaipai`: `js/core/supabase-config.js` (URL + Publishable key do
   novo), `.mcp.json`, `.codex/config.toml`, `.env.example`, docs (`supabase/README.md`,
   `supabase/MIGRATIONS.md`, `luma-brain/02_ARCHITECTURE.md`, `docs/LUMA.md`, cabeçalhos dos scripts,
   comentários dos workflows, `docs/SUPORTE-TELEGRAM.md`, `presentation/CLAIMS.md`), entrada no
   `docs/LUMA-BACKEND-CHANGELOG.md`, `?v=` subido. Push. O GitHub Pages (e a Vercel, se estiver ligada ao
   repositório) publica sozinho.
4. ⬜ **Você** — **secrets do GitHub** (repositório `ryanmotta-ai/Luma` → Settings → Secrets and variables →
   Actions), com os valores do **novo**: `SUPABASE_URL` (`https://xqsazcazsjxajmtmirzd.supabase.co`),
   `SUPABASE_SERVICE_ROLE_KEY` (a `sb_secret` do novo, a mesma do `.env`) e `SUPABASE_DB_URL` (a string
   Session pooler do novo, a mesma do `.env`). Depois: Actions → workflow **Backup** → "Run workflow" e
   conferir que ficou verde.
5. ⬜ **Você** — avisa a equipe: **"pode voltar; faça login de novo"**. A senha é a mesma; só a sessão cai,
   porque o token é por projeto. Quem estiver com a página aberta precisa recarregar.
6. ⬜ **Você + Eu** — fumaça em produção: login, catálogo, gerar uma arte, IA (uma legenda), Estúdio abre.
7. ⬜ **Você** — no Claude Code, `/mcp` → o servidor `supabase` agora aponta para o novo; autentique de
   novo se pedir.

**Se der ruim:** `git revert` do commit da virada e push. O Luma volta para o antigo, que não foi tocado.

---

## 4. Depois da virada

- ⬜ **Você** — se você **resetou a senha do banco antigo** hoje para preencher o `.env`, o backup diário do
  antigo falhou desde então. Depois da virada ele passa a mirar o novo (item 3.4), então não precisa
  consertar nada; só saiba.
- ⬜ **Você** — deixar o antigo vivo por **30 dias**; depois **pausar** (Dashboard do antigo → Project Settings →
  General → Pause project). **Não apagar.**
- ⬜ **Eu** — patch do thumb do catálogo (miniatura gerada no publicar; `templates.thumb_url` já existe).
  Estava desenhado, não aplicado; entra depois da migração, em commit separado.
- ⬜ **Eu** — a `service_role` não tem acesso ao schema `luma` (nem no antigo, nem no novo, porque o novo é
  cópia). Isso derruba o `limpar-assets-orfaos.js` e provavelmente o `digest-semanal.py` do GitHub
  Actions. É um `grant usage on schema luma to service_role` + grants nas tabelas; fora da migração, vejo
  com você depois.
- ⬜ Telegram: a ponte (`suporte-telegram`) **nunca esteve no ar**; nada a fazer agora. Se um dia for ligar,
  a migration dela tem a URL do projeto antigo fixa (`20260926130000_luma_suporte_telegram.sql`) e
  precisa de `pg_net` e `pg_cron` ligados no novo.
