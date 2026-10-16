# Migração do Supabase — o que falta, passo a passo

> Checklist do Pedro. Atualizado em **16/10/2026, manhã** (status: falta só o que está em ⬜ nas seções 2.3, 2.5 e 3). Projeto antigo `uqrqzjafhigjuvtjqzid`
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

### 2.0 Testado por fora em 14/10, 15h30 (sem login) — ✅ Eu

Entrei no novo como a **sua** conta (sessão emitida pela API administrativa, sem senha) e passou tudo:
login válido, perfil lido com RLS (`gestao`), `is_designer()` responde, policies do Storage funcionam
(capas e assets listam; o anexo privado do suporte aparece para a equipe), uma capa pública serve do
Storage novo com os mesmos bytes do antigo e já com cache de 1 ano. As opções públicas de Auth dos dois
projetos são idênticas. **Único bloqueio para o app:** no novo, o schema `luma` ainda **não está exposto**
na Data API (`PGRST106`). Entra no item 2.1.

### 2.1 Acesso ao projeto novo — ✅ resolvido em 14/10, 16h

Você tem **duas contas** no Supabase: `pedro.moraes@deliverymuch.com.br` (org pessoal, onde vive o projeto
**antigo** "LUMA MVP") e a conta que criou o projeto **novo** (org "DM - Inovação e IA"). A CLI está logada
na segunda. Com isso já subiu o que dependia dela (2.2). Uma conta não enxerga o projeto da outra, e é isso
que ainda segura os secrets (2.2.1).

### 2.2 Feito com a conta nova — ✅ Eu

1. ✅ `ai` e `invite-user` no ar no novo, versão 1, `verify_jwt` ligado (igual ao antigo).
2. ✅ Chave pública do novo pega pela CLI (`sb_publishable_t0xB…`, pública por design). Já está na cópia
   `migracao/supabase-config-novo.js`, fora do git, que o servidor de teste usa (2.5).
3. ✅ Secrets do novo: só os `SUPABASE_*` que a plataforma injeta. **Falta os seis do `ai`** (abaixo).

### 2.3 Três coisas suas, sem ordem — ⬜ Você

1. ✅ **Schema `luma` exposto** no novo (14/10, 16h15; conferido pela API como o seu usuário).
2. ✅ **Dois tokens de acesso pessoal** no `.env` (16/10): `ANTIGO_ACCESS_TOKEN` (conta da DM, vê o antigo) e
   `NOVO_ACCESS_TOKEN` (conta que criou o novo). Apague os dois em https://supabase.com/dashboard/account/tokens
   quando a migração acabar.
   - ✅ Com eles, copiado do antigo para o novo em 16/10: **Data API** (`public, graphql_public, luma, analytics`
     e `max_rows` 100.000 — o antigo expõe `analytics` também) e **Auth** (dos 243 campos só o Site URL
     diferia: agora `luma-deliverymuch.vercel.app`, igual ao antigo; sem lista de redirecionamento, senha
     mínima 6, sem SMTP próprio, templates padrão nos dois). Storage igual (limite 50 MB).
   - ⛔ **Os seis secrets do `ai` NÃO têm como ser copiados**: o Supabase guarda só a assinatura SHA-256 e a
     API devolve só ela (foi isso que você colou em 14/10; já tirei do novo). Os valores reais estão com quem
     os criou (Ryan, em 23/09) ou se geram de novo em cada provedor. Ver 2.3.3.
3. ⬜ **Valores reais dos secrets do `ai`** — peça ao Ryan, ou gere chave nova:
   - `GEMINI_API_KEY` — **obrigatório** (sem ele a IA responde 503). Google AI Studio, https://aistudio.google.com/apikey,
     na conta Google que o Ryan usou (a chave aparece lá) ou uma nova na conta da DM.
   - Opcionais (reserva do `ai`; sem elas o provedor é pulado): `NVIDIA_API_KEY` e `NVIDIA2_API_KEY`
     (https://build.nvidia.com), `OLLAMA_API_KEY` (https://ollama.com), `OPENROUTER_API_KEY`
     (https://openrouter.ai), `CLOUDFLARE_API_KEY` (Cloudflare → API Tokens, Workers AI).
   - Cole no arquivo `migracao\secrets.env` (já está lá, vazio, com os seis nomes) e me avise "secrets no
     arquivo". Eu gravo no novo pela CLI, testo a IA e apago o arquivo.
   - ⚠ **Rotacionar o JWT secret do novo** antes da virada: em 16/10 a API devolveu esse segredo numa leitura
     minha e ele ficou impresso no chat. Dashboard do novo → Project Settings → JWT Keys (ou API → JWT
     Settings) → Rotate / Generate new secret. Nada quebra: as chaves `sb_publishable_`/`sb_secret_` e as
     functions não dependem dele.

Se preferir não criar o token, o caminho antigo continua valendo: `supabase login` no PowerShell (conta da
org nova) para as functions, e os itens abaixo você faz no Dashboard do novo, comparando com o antigo:
Data API → Exposed schemas (`public, graphql_public, luma`); Authentication → URL Configuration (Site URL e
Redirect URLs iguais, inclusive a da Vercel `luma-deliverymuch.vercel.app` se estiver lá); Authentication →
Providers → Email (Confirm email, senha mínima); Authentication → Emails (SMTP e templates); Storage →
Settings (limite global ≥ 15 MB); Edge Functions → Secrets (`GEMINI_API_KEY` obrigatório + reservas
`NVIDIA_API_KEY`, `NVIDIA2_API_KEY`, `OLLAMA_API_KEY`, `CLOUDFLARE_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`,
`OPENROUTER_API_KEY`, cujos valores o Dashboard do antigo **não** mostra); Project Settings → API Keys
(me mandar a Publishable key `sb_publishable_...`).

### 2.4 Feito com os tokens — ✅ Eu (16/10)

1. ✅ Data API, Auth e Storage do novo iguais ao antigo (detalhe em 2.3.2).
2. ⬜ Gravar os secrets reais do `ai` no novo e testar a IA — assim que o 2.3.3 chegar.

### 2.3b Decisão que é só sua — ⬜ Você

- ⬜ **Organização "DM - Inovação e IA" → Billing → Spend cap:** ligado, bloqueia quando passar da cota do
  Pro; desligado, cobra o excedente. É dinheiro; eu não mexo.

### 2.4 Limpeza antes de tirar a foto final — ⬜ Você

- ⬜ **Você** — no Estúdio do Luma **no ar** (projeto antigo), exclua as duas pastas de demo que subiram por
  engano em 14/10: **"Hamburguer Fest"** e **"Ofertas Favoritas"** (2 materiais publicados cada). Tem que
  ser pelo Estúdio, não pelo banco: se eu apagar no banco, o seu navegador sobe de novo. Fazendo isso
  antes da virada, elas nem viajam para o novo.

### 2.5 Teste local, sem commit — ⬜ Eu, depois ⬜ Você

1. ✅ **Eu** — servidor local no ar: **http://localhost:8080** (`node migracao/servir.js`). Ele serve o
   repositório e, só nessa porta, troca o `supabase-config.js` pela cópia que aponta para o novo. O arquivo
   versionado não muda. Caiu? Me avise que eu subo de novo.
2. ✅ **Você** — 14/10, 16h28: login com a senha de sempre, catálogo, **2 artes geradas com foto** (2 uploads
   em `luma-user-uploads`) e **1 feedback de campanha**, tudo gravado no projeto **novo** e nada no antigo.
   Conferido no banco dos dois.
   ⬜ Falta passar por: **Estúdio** (publicar um material de teste e excluir) e **suporte** (abrir a
   conversa). A IA (legenda, encurtar) só depois dos secrets.
3. O que você publicar de teste no novo some sozinho na virada (o banco do novo é zerado e refeito).

---

## 3. A virada (marcar uma janela de ~30 min; de preferência fora do horário de pico)

Por que refazer: o antigo continua vivo e as pessoas seguem gerando artes. O restore é cópia bruta, então
não dá para "atualizar por cima"; no dia, o banco do novo é zerado e refeito com a foto fresca.

1. ⬜ **Você** — avisa a equipe (Ryan, designers, franqueados ativos): **"durante 30 min ninguém publica,
   gera arte nem convida usuário; depois todo mundo faz login de novo"**. Me diz "pode ir".
2. ⬜ **Eu** — zero o novo (`00_limpar_novo.sql`: só banco e usuários; Storage e policies ficam), repito
   dump → restore → 01 → 02 → 03, repito a cópia do Storage (só sobe o que entrou de novo), **subo de
   novo as duas functions** (o `ai` mudou em 15/10 com o Creative) e comparo com o antigo. Uns 15 min.
3. ⬜ **Eu** — o commit da virada na `talpaipai`: `js/core/supabase-config.js` (URL + Publishable key do
   novo), `.mcp.json`, `.codex/config.toml`, `.env.example`, docs (`supabase/README.md`,
   `supabase/MIGRATIONS.md`, `luma-brain/02_ARCHITECTURE.md`, `docs/LUMA.md`, cabeçalhos dos scripts,
   comentários dos workflows, `docs/SUPORTE-TELEGRAM.md`, `presentation/CLAIMS.md`), entrada no
   `docs/LUMA-BACKEND-CHANGELOG.md`, `?v=` subido. Push. O GitHub Pages (e a Vercel, se estiver ligada ao
   repositório) publica sozinho.
4. ⬜ **Eu** — **secrets do GitHub** do repositório `ryanmotta-ai/Luma` com os valores do novo
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, os mesmos do `.env`). O `gh` da sua
   máquina está logado como `pedromoraes-DM` e consegue gravar secrets (testei com um secret de mentira,
   criado e apagado). Depois disparo o workflow **Backup** à mão e confiro que ficou verde.
   (O `SUPABASE_DB_URL` foi atualizado hoje às 14h06, então o backup do antigo segue funcionando até lá.)
5. ⬜ **Você** — avisa a equipe: **"pode voltar; faça login de novo"**. A senha é a mesma; só a sessão cai,
   porque o token é por projeto. Quem estiver com a página aberta precisa recarregar.
6. ⬜ **Você + Eu** — fumaça em produção: login, catálogo, gerar uma arte, IA (uma legenda), Estúdio abre.
7. ⬜ **Você** — no Claude Code, `/mcp` → o servidor `supabase` agora aponta para o novo; autentique de
   novo se pedir.

**Se der ruim:** `git revert` do commit da virada e push. O Luma volta para o antigo, que não foi tocado.

---

## 4. Depois da virada

- ⬜ **Você** — apagar o token `migracao-luma` em https://supabase.com/dashboard/account/tokens e tirar a
  linha `SUPABASE_ACCESS_TOKEN` do `.env`.
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
