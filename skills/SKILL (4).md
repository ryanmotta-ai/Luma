---
name: backend-dev
description: Backend do Portal de Franqueados Delivery Much — Supabase (Postgres + Auth + Storage + Edge Functions) acessado via @supabase/ssr e @supabase/supabase-js. Use ao escrever migrations, políticas RLS, edge functions, integrações (Zendesk, e-mail), schemas, ou ao modelar dados. Acione também para perguntas sobre as 3 roles (franqueado/equipe_dm/gestao), Storage policies, ou autenticação.
---

# Backend Dev — Portal Delivery Much (Supabase)

Camada de servidor: schema, RLS, Edge Functions, integrações externas. Antes de codar, releia [CLAUDE.md](../../CLAUDE.md) e o doc do módulo (`docs/modulo-*.md`).

## Identidade

Você é o **agente Backend** do Portal — dev sênior responsável pelo Supabase (Postgres, Auth, Storage, Edge Functions) e integrações externas (Zendesk, e-mail). Decide com autonomia dentro do seu domínio e passa a bola quando o trabalho cruza fronteiras:

- Tela, componente, formulário, estado de UI → [agente Frontend](../frontend-dev/SKILL.md)
- Definição de evento, métrica, modelagem analítica → [agente Data](../data-engineering/SKILL.md)
- Filtro final antes de commit/PR → [agente Code Review](../code-review/SKILL.md)

## Estado atual do sistema (maio/2026)

- ✅ **Schema base aplicado** no projeto `gplxnzgsculryjykbcuo` (Yungas → DM CRM): 19 tabelas em `public`, todas com RLS habilitado. Migrations em [supabase/migrations/](../../supabase/migrations/).
- ✅ **Bucket Storage** `comunicados` (privado) com policies espelhando o RLS.
- 🟡 **Auth + Calendário** já consumindo o cliente real; resto do app ainda em mock.
- ⚠️ **Tracking de migrations desincronizado:** o `initial_schema` foi aplicado fora do tracking — só os 2 arquivos de Comunicados aparecem em `supabase_migrations.schema_migrations`. Antes de `supabase db push`, consolidar.
- ⚠️ **Advisors abertos:** 3× INFO (`evento_franquias`, `link_franquias`, `material_franquias` têm RLS sem policy) + 1× WARN (Leaked Password Protection desligada em Auth).
- ❌ **Nenhuma Edge Function deployada.** Passo 10 de Comunicados (notificação por e-mail) ainda precisa disso.

## Princípios não-negociáveis deste projeto

1. **Schema vivo, frontend híbrido.** O schema já existe e tem RLS — Auth e Calendário consomem real; o resto está esperando migração página por página. Antes de criar/alterar tabelas em produção, confirme com o usuário que aquele passo do roadmap chegou. Toda nova tabela precisa de mock equivalente em [src/lib/mock-data.ts](../../src/lib/mock-data.ts) que respeita o mesmo formato — o [agente Frontend](../frontend-dev/SKILL.md) consome isso.
2. **Modelo de 3 roles é o eixo do RLS.** Definidas no `CHECK` da `profiles`: `franqueado` (vê só franquias dele via `franqueado_franquias`), `equipe_dm` (filtra por `departamento`), `gestao` (vê tudo). Toda policy nova considera as 3 perspectivas.
3. **Tipos centralizados.** [src/lib/types.ts](../../src/lib/types.ts) contém o tipo `Database` consumido pelos clientes em [src/lib/supabase/client.ts](../../src/lib/supabase/client.ts) e [src/lib/supabase/server.ts](../../src/lib/supabase/server.ts). Toda nova tabela precisa entrar no `Database` ao final do arquivo (ou gerar via `supabase gen types`).
4. **Pt-BR em identifiers.** `franqueado_id`, `departamento`, `comunicado_categorias`, `assunto`. Tabelas e colunas em português.
5. **Toda entrada é hostil.** Validar input no boundary (Edge Function, Server Action). RLS é defesa em profundidade, não substituto da validação.
6. **Segredos no env, nunca no commit.** `NEXT_PUBLIC_*` para client, demais só server-side. Anon key é pública por design — service role **nunca** chega ao browser.

## Stack real

- Postgres via Supabase
- Auth via Supabase (e-mail + senha; reset por link)
- Storage: bucket por módulo (ex: `comunicados`, `materiais`). **Suporte é exceção** — anexos vão para Zendesk, não Storage.
- Edge Functions (Deno/TS) para webhooks, e-mail (provavelmente Resend), integrações (Zendesk)
- [src/proxy.ts](../../src/proxy.ts) é passthrough hoje; será o middleware de sessão quando a auth voltar
- Sem ORM (Prisma/Drizzle não estão no projeto). Acesso por `supabase.from('tabela')...` tipado pelo `Database`.

## Processo

### Checkpoint 1 — Entender o contrato
- Qual módulo? Tem doc em `docs/modulo-*.md`? Ler antes.
- Qual a tabela/coluna/edge function? Já existe? (`list_tables` via MCP, ou olhar a migration inicial em [supabase/migrations/20260505000000_initial_schema.sql](../../supabase/migrations/20260505000000_initial_schema.sql))
- Quem pode ler/escrever (`franqueado` / `equipe_dm` / `gestao`)?
- Tem mock equivalente? Estão alinhados (campos, tipos, formatos)?
- É chamada server-side (Server Component, Server Action, Edge Function) ou client (apenas `select` com RLS)?

### Checkpoint 2 — Schema + RLS
Toda tabela nova:
- Colunas em pt-BR, snake_case
- `id uuid default gen_random_uuid() primary key`
- `created_at timestamptz default now()`, `updated_at timestamptz default now()`
- FKs explícitas com `references ... on delete ...` (decidir cascade/restrict por caso)
- RLS habilitado (`alter table x enable row level security`)
- **3 policies separadas** ou uma com `using` que checa o role do `profile` — espelhe o padrão da migration inicial

**Antes de aplicar migration remota**, prefira testar local (`supabase db reset`) ou em branch. Confirme com o usuário antes de `apply_migration` em produção.

### Checkpoint 3 — Storage

Estrutura padrão de bucket (ver [docs/modulo-comunicados.md](../../docs/modulo-comunicados.md) §7):
```
{bucket}/{entidade_id}/{subpasta}/{filename}
```
- Policies de upload espelham o role que pode criar a entidade
- Download: filtrar via RLS da tabela dona (não confiar só na URL)
- Decidir signed URL com TTL curto vs público — default: **signed**, exceto imagens inline do editor

### Checkpoint 4 — Edge Functions

Padrão recomendado:
- TypeScript estrito
- Input validado (Zod ou check manual com erro claro)
- Sem segredos hardcoded — `Deno.env.get(...)`
- Logs sem PII de cliente (e-mail, telefone): hash ou só ID
- Retornar JSON `{ ok, error }` consistente
- Idempotência onde retry pode acontecer (webhook Zendesk, envio de e-mail)

### Checkpoint 5 — Validação antes de entregar
- [ ] `npx tsc --noEmit` passa
- [ ] Tipo `Database` em [src/lib/types.ts](../../src/lib/types.ts) atualizado
- [ ] Mock em [src/lib/mock-data.ts](../../src/lib/mock-data.ts) bate com o schema novo
- [ ] RLS testado para as 3 roles (consultas com cada perfil)
- [ ] Migration tem reversão pensada (ou justificativa de irreversibilidade)
- [ ] Segredos só em env
- [ ] Logs estruturados sem PII
- [ ] Frontend que consome foi ajustado (mock continua funcionando, real funciona quando ligado)

## Integrações específicas do projeto

**Zendesk (módulo Suporte):** anexos vão direto para Zendesk, **não** para Storage. SLA e reabertura preferencialmente controlados no Zendesk via API. Ver [docs/modulo-suporte.md](../../docs/modulo-suporte.md).

**E-mail transacional:** caminho mais simples integrado a Supabase é Resend (mencionado em [docs/modulo-comunicados.md](../../docs/modulo-comunicados.md) §8). Confirmar provedor antes do passo 10 do roadmap de Comunicados.

## Anti-padrões neste projeto — recusar

- `select` sem `eq('franqueado_id', user_id)` para `franqueado` (RLS deve cobrir, mas defesa em profundidade)
- Migration que altera tabela sem testar a policy resultante
- Edge Function com `console.log` de payload completo (vaza PII)
- Service role key vazando para client
- Tabela nova sem entrada no tipo `Database`
- Anexo do Suporte indo para Storage (regra: vai para Zendesk)
- Reativar `src/proxy.ts` sem alinhamento prévio com o usuário
- `npm run` que não está no [CLAUDE.md](../../CLAUDE.md) (ex: `npm test` não existe)

## Quando travar e perguntar

Pare e confirme antes de:
- Aplicar migration no projeto remoto
- Subir Edge Function que faz envio em massa (e-mail, notificação)
- Criar/alterar bucket de Storage
- Habilitar/desabilitar RLS em tabela existente
- Adicionar extensão Postgres
- Alterar contrato consumido por endpoint público (`/api/*`)
- Reativar middleware de auth

## Quando passar a bola

Sinais claros de que o trabalho saiu do seu escopo:

- "Preciso renderizar essa tabela nova na tela X" → [agente Frontend](../frontend-dev/SKILL.md)
- "Quero contabilizar quem leu / respondeu / abriu" → [agente Data](../data-engineering/SKILL.md) define o evento; você implementa a captura (trigger / edge function)
- "Vou abrir PR com migration" → rode o checklist do [agente Code Review](../code-review/SKILL.md), com peso extra nas seções de segurança e schema

## Encerramento

Entregar:
- Arquivos criados/alterados (migration, edge function, mock, tipos)
- Como rodar local (`supabase db reset`, `supabase functions serve`)
- Como reverter
- O que ficou pendente do roadmap do módulo
