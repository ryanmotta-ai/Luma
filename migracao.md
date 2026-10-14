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

### 2.0 Testado por fora em 14/10, 15h30 (sem login) — ✅ Eu

Entrei no novo como a **sua** conta (sessão emitida pela API administrativa, sem senha) e passou tudo:
login válido, perfil lido com RLS (`gestao`), `is_designer()` responde, policies do Storage funcionam
(capas e assets listam; o anexo privado do suporte aparece para a equipe), uma capa pública serve do
Storage novo com os mesmos bytes do antigo e já com cache de 1 ano. As opções públicas de Auth dos dois
projetos são idênticas. **Único bloqueio para o app:** no novo, o schema `luma` ainda **não está exposto**
na Data API (`PGRST106`). Entra no item 2.1.

### 2.1 Acesso ao projeto novo — ⬜ Você (é o que trava tudo agora)

✅ `supabase login` feito em 14/10 com `pedro.moraes@deliverymuch.com.br`. **Mas essa conta só enxerga a
sua org pessoal** ("pedro.moraes@deliverymuch.com.br's Org", onde vive o projeto antigo "LUMA MVP"). O
projeto novo não aparece na lista e qualquer comando nele devolve `403 Your account does not have the
necessary privileges`. Ou seja: a conta não é membro da org "DM - Inovação e IA".

Resolve de um destes dois jeitos:

- ⬜ Se **outra pessoa** criou o projeto novo (TI, gestor): ela entra no Dashboard → org "DM - Inovação e
  IA" → **Team → Invite** e convida `pedro.moraes@deliverymuch.com.br` como **Owner** ou **Admin**
  (Developer não mexe em Auth nem na Data API). Você aceita o convite pelo e-mail. Não precisa logar de novo.
- ⬜ Se **você** criou o projeto com **outro e-mail**: no PowerShell, `supabase logout` e depois
  `supabase login` com esse e-mail.

Depois disso, **um token de acesso pessoal** me deixa fazer o resto pela API de gerenciamento (ler os
secrets do antigo com valor e gravar no novo sem que os valores passem por mim, subir as functions, expor o
`luma`, copiar a configuração de Auth, pegar a chave pública):

1. ⬜ **Você** — https://supabase.com/dashboard/account/tokens, com a conta que agora vê **as duas orgs**.
   Generate new token, nome `migracao-luma`.
2. ⬜ **Você** — cole no `.env`, numa linha nova: `SUPABASE_ACCESS_TOKEN=sbp_...`. Me avise: **"token no env"**.
   O token é pessoal e poderoso: fica só no `.env` (ignorado pelo git) e você o apaga na página de tokens
   quando a migração acabar.

Secrets que existem no antigo (conferido pela CLI, só os nomes): `GEMINI_API_KEY`, `NVIDIA_API_KEY`,
`NVIDIA2_API_KEY`, `OLLAMA_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_API_KEY`. Não há
`CLOUDFLARE_ACCOUNT_ID` (o `ai` descobre sozinho). Os `SUPABASE_*` a plataforma injeta.

Se preferir não criar o token, o caminho antigo continua valendo: `supabase login` no PowerShell (conta da
org nova) para as functions, e os itens abaixo você faz no Dashboard do novo, comparando com o antigo:
Data API → Exposed schemas (`public, graphql_public, luma`); Authentication → URL Configuration (Site URL e
Redirect URLs iguais, inclusive a da Vercel `luma-deliverymuch.vercel.app` se estiver lá); Authentication →
Providers → Email (Confirm email, senha mínima); Authentication → Emails (SMTP e templates); Storage →
Settings (limite global ≥ 15 MB); Edge Functions → Secrets (`GEMINI_API_KEY` obrigatório + reservas
`NVIDIA_API_KEY`, `NVIDIA2_API_KEY`, `OLLAMA_API_KEY`, `CLOUDFLARE_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`,
`OPENROUTER_API_KEY`, cujos valores o Dashboard do antigo **não** mostra); Project Settings → API Keys
(me mandar a Publishable key `sb_publishable_...`).

### 2.2 Com o token na mão — ⬜ Eu

1. ⬜ Copio os secrets das functions do antigo para o novo (os que existirem lá; `SUPABASE_*` a plataforma injeta).
2. ⬜ Subo `ai` e `invite-user` no novo (`verify_jwt` ligado, igual ao antigo). Só essas duas rodam no
   antigo. O `ai` do repositório está à frente do que roda lá (tarefas do Luma Creative que o Ryan
   commitou hoje) e é o que sobe.
3. ⬜ Exponho o schema `luma` na Data API do novo (igual ao antigo: `public, graphql_public, luma`).
4. ⬜ Copio a configuração de Auth do antigo (Site URL, Redirect URLs, senha mínima, confirmação de
   e-mail, SMTP, templates) e o limite global do Storage.
5. ⬜ Pego a Publishable key do novo e preparo o `supabase-config.js` para o teste local (item 2.5).
6. ⬜ Te mostro, item a item, o que ficou igual e o que não dá para copiar pela API.

### 2.3 Decisão que é só sua — ⬜ Você

- ⬜ **Organização "DM - Inovação e IA" → Billing → Spend cap:** ligado, bloqueia quando passar da cota do
  Pro; desligado, cobra o excedente. É dinheiro; eu não mexo.

### 2.4 Limpeza antes de tirar a foto final — ⬜ Você

- ⬜ **Você** — no Estúdio do Luma **no ar** (projeto antigo), exclua as duas pastas de demo que subiram por
  engano em 14/10: **"Hamburguer Fest"** e **"Ofertas Favoritas"** (2 materiais publicados cada). Tem que
  ser pelo Estúdio, não pelo banco: se eu apagar no banco, o seu navegador sobe de novo. Fazendo isso
  antes da virada, elas nem viajam para o novo.

### 2.5 Teste local, sem commit — ⬜ Eu, depois ⬜ Você

1. ⬜ **Eu** — com a Publishable key do novo, aponto `js/core/supabase-config.js` para o novo (só na sua
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
