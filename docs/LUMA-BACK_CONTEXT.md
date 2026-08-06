# Backend Export — Portal de Franqueados (para reutilização)

Pacote completo do backend do Portal de Franqueados Delivery Much, pronto para ser copiado para um novo projeto. **Self-contained** — todo o SQL e código TypeScript necessário está aqui.

> Origem: `portal-fresh` (branch `feat/integra-editor-artes-yungas`, commit `8d24777`).
> Geração: 2026-06-18.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Stack e dependências](#2-stack-e-dependências)
3. [Setup do projeto Supabase novo](#3-setup-do-projeto-supabase-novo)
4. [Variáveis de ambiente](#4-variáveis-de-ambiente)
5. [Migrations SQL (na ordem de execução)](#5-migrations-sql-na-ordem-de-execução)
6. [Cliente Supabase no Next.js](#6-cliente-supabase-no-nextjs)
7. [Tipos TypeScript do Database](#7-tipos-typescript-do-database)
8. [Auth guard (proxy / middleware)](#8-auth-guard-proxy--middleware)
9. [Padrão de analytics (event tracking)](#9-padrão-de-analytics-event-tracking)
10. [Aplicar tudo no projeto novo — passo a passo](#10-aplicar-tudo-no-projeto-novo--passo-a-passo)
11. [O que NÃO foi incluído](#11-o-que-não-foi-incluído)

---

## 1. Visão geral

O backend é **Supabase** (Postgres + Auth + Storage). Não há Edge Functions deployadas — toda a lógica está em SQL (tabelas, RLS, triggers, funções) e em Server Actions do Next.js.

**Modelo de 3 roles** é o eixo de toda RLS:

- `franqueado` — vê só as próprias franquias (vínculo via `franqueado_franquias`)
- `equipe_dm` — vê tudo no seu departamento (coluna em `profiles`)
- `gestao` — visão consolidada da rede

**Schemas:**
- `public.*` — dados transacionais (profiles, franquias, comunicados, materiais, etc.)
- `analytics.*` — captura bruta de eventos de uso

**Storage:**
- Bucket `comunicados` (privado, RLS por `comunicado_id` no path)

---

## 2. Stack e dependências

### `package.json` — dependências relevantes

```jsonc
{
  "dependencies": {
    "@supabase/ssr": "^0.5.1",
    "@supabase/supabase-js": "^2.45.4",
    "next": "^16.2.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

### CLI

```bash
npm install -g supabase    # ou: npx supabase ...
```

---

## 3. Setup do projeto Supabase novo

1. Cria um novo projeto em [supabase.com](https://supabase.com/dashboard)
2. Anota o **Project Reference** (string `xxxxxxxx` na URL)
3. Em **Project Settings → API**:
   - Copia a **URL** do projeto (`https://<ref>.supabase.co`)
   - Copia a **anon/publishable key**
4. Em **Project Settings → API → Exposed schemas**, adiciona `analytics` à lista (deve ficar `public, graphql_public, analytics`)
5. Em **Authentication → Settings**:
   - **Ativa "Leaked Password Protection"** (boa prática)
   - Configura provedores (Email + Password é o default)

---

## 4. Variáveis de ambiente

### `.env.local.example` (template versionado, sem segredos)

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

### `.env.local` (gitignored, preencha com valores reais)

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref-do-novo-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-do-novo-projeto>
```

### `.gitignore` deve conter

```
.env*.local
.env
```

---

## 5. Migrations SQL (na ordem de execução)

Coloque cada arquivo em `supabase/migrations/<timestamp>_<nome>.sql`. Os timestamps abaixo são os originais — você pode renumerar se quiser, mas mantenha a ordem.

### 5.1. `20260505000000_initial_schema.sql` — Schema base + RLS

Cria todas as tabelas principais, funções auxiliares (`get_user_role`, `get_user_franquia_ids`), trigger de criação automática de profile, RLS habilitado em todas as tabelas, e policies por role.

```sql
-- ============================================================
-- Portal de Franqueados — Delivery Much
-- Fase 1: Schema inicial + RLS policies
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELAS PRINCIPAIS
-- ============================================================

-- Perfis de usuário (estende auth.users)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('franqueado', 'equipe_dm', 'gestao')),
  departamento TEXT, -- usado por equipe_dm (ex: marketing, financeiro, tecnologia)
  avatar_url  TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Franquias (unidades)
CREATE TABLE public.franquias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL,
  cnpj        TEXT UNIQUE,
  cidade      TEXT NOT NULL,
  estado      CHAR(2) NOT NULL,
  regiao      TEXT,
  ativa       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Relacionamento usuário ↔ franquias (franqueado pode ter múltiplas)
CREATE TABLE public.franqueado_franquias (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  franquia_id UUID NOT NULL REFERENCES public.franquias(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, franquia_id)
);

-- Comunicados (Informe Geral)
CREATE TABLE public.comunicados (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo        TEXT NOT NULL,
  conteudo      TEXT NOT NULL,
  categoria     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicado', 'arquivado')),
  visibilidade  TEXT NOT NULL DEFAULT 'todos' CHECK (visibilidade IN ('todos', 'especifico')),
  criado_por    UUID NOT NULL REFERENCES auth.users(id),
  publicado_em  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.comunicado_franquias (
  comunicado_id UUID NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  franquia_id   UUID NOT NULL REFERENCES public.franquias(id) ON DELETE CASCADE,
  PRIMARY KEY (comunicado_id, franquia_id)
);

-- Pastas de materiais
CREATE TABLE public.materiais_pastas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL,
  parent_id   UUID REFERENCES public.materiais_pastas(id) ON DELETE CASCADE,
  categoria   TEXT,
  criado_por  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Materiais (arquivos)
CREATE TABLE public.materiais (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pasta_id      UUID REFERENCES public.materiais_pastas(id) ON DELETE SET NULL,
  nome          TEXT NOT NULL,
  descricao     TEXT,
  url_arquivo   TEXT NOT NULL,
  tipo_arquivo  TEXT,
  tamanho_bytes BIGINT,
  visibilidade  TEXT NOT NULL DEFAULT 'todos' CHECK (visibilidade IN ('todos', 'especifico')),
  criado_por    UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.material_franquias (
  material_id UUID NOT NULL REFERENCES public.materiais(id) ON DELETE CASCADE,
  franquia_id UUID NOT NULL REFERENCES public.franquias(id) ON DELETE CASCADE,
  PRIMARY KEY (material_id, franquia_id)
);

-- Eventos do calendário
CREATE TABLE public.calendario_eventos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo        TEXT NOT NULL,
  descricao     TEXT,
  data_inicio   TIMESTAMPTZ NOT NULL,
  data_fim      TIMESTAMPTZ,
  dia_inteiro   BOOLEAN NOT NULL DEFAULT FALSE,
  categoria     TEXT,
  cor           TEXT DEFAULT '#F26522',
  visibilidade  TEXT NOT NULL DEFAULT 'todos' CHECK (visibilidade IN ('todos', 'especifico')),
  criado_por    UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.evento_franquias (
  evento_id   UUID NOT NULL REFERENCES public.calendario_eventos(id) ON DELETE CASCADE,
  franquia_id UUID NOT NULL REFERENCES public.franquias(id) ON DELETE CASCADE,
  PRIMARY KEY (evento_id, franquia_id)
);

-- FAQ
CREATE TABLE public.faq_categorias (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome       TEXT NOT NULL,
  icone      TEXT,
  ordem      INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.faq_perguntas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  categoria_id UUID NOT NULL REFERENCES public.faq_categorias(id) ON DELETE CASCADE,
  pergunta     TEXT NOT NULL,
  resposta     TEXT NOT NULL,
  ordem        INT NOT NULL DEFAULT 0,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por   UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Links e atalhos externos
CREATE TABLE public.links_atalhos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome         TEXT NOT NULL,
  url          TEXT NOT NULL,
  descricao    TEXT,
  icone        TEXT,
  categoria    TEXT,
  cor          TEXT DEFAULT '#F26522',
  ordem        INT NOT NULL DEFAULT 0,
  visibilidade TEXT NOT NULL DEFAULT 'todos' CHECK (visibilidade IN ('todos', 'especifico')),
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.link_franquias (
  link_id     UUID NOT NULL REFERENCES public.links_atalhos(id) ON DELETE CASCADE,
  franquia_id UUID NOT NULL REFERENCES public.franquias(id) ON DELETE CASCADE,
  PRIMARY KEY (link_id, franquia_id)
);

-- ============================================================
-- FUNÇÕES AUXILIARES (usadas pelas RLS policies)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_franquia_ids()
RETURNS UUID[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(franquia_id), '{}')
  FROM public.franqueado_franquias
  WHERE user_id = auth.uid();
$$;

-- ============================================================
-- TRIGGER: cria profile automaticamente ao cadastrar usuário
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'franqueado')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS — habilitar em todas
-- ============================================================

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franquias             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franqueado_franquias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicados           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicado_franquias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais_pastas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_franquias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_eventos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_franquias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_categorias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_perguntas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_atalhos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_franquias        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES — profiles
-- ============================================================
CREATE POLICY "usuario lê próprio perfil ou gestao/equipe_dm lê todos"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR get_user_role() IN ('gestao', 'equipe_dm'));

CREATE POLICY "usuario atualiza próprio perfil"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- ============================================================
-- POLICIES — franquias
-- ============================================================
CREATE POLICY "franqueado vê suas franquias; gestao/equipe_dm vê todas"
  ON public.franquias FOR SELECT
  USING (
    get_user_role() IN ('gestao', 'equipe_dm')
    OR id = ANY(get_user_franquia_ids())
  );

CREATE POLICY "somente gestao cria franquias"
  ON public.franquias FOR INSERT
  WITH CHECK (get_user_role() = 'gestao');

CREATE POLICY "somente gestao edita franquias"
  ON public.franquias FOR UPDATE
  USING (get_user_role() = 'gestao');

-- ============================================================
-- POLICIES — franqueado_franquias
-- ============================================================
CREATE POLICY "franqueado vê próprios vínculos; gestao/equipe_dm vê todos"
  ON public.franqueado_franquias FOR SELECT
  USING (user_id = auth.uid() OR get_user_role() IN ('gestao', 'equipe_dm'));

CREATE POLICY "somente gestao gerencia vínculos"
  ON public.franqueado_franquias FOR ALL
  USING (get_user_role() = 'gestao');

-- ============================================================
-- POLICIES — comunicados
-- ============================================================
CREATE POLICY "franqueado vê comunicados publicados para ele"
  ON public.comunicados FOR SELECT
  USING (
    get_user_role() IN ('gestao', 'equipe_dm')
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
  WITH CHECK (get_user_role() IN ('gestao', 'equipe_dm'));

CREATE POLICY "gestao e equipe_dm editam comunicados"
  ON public.comunicados FOR UPDATE
  USING (get_user_role() IN ('gestao', 'equipe_dm'));

CREATE POLICY "somente gestao remove comunicados"
  ON public.comunicados FOR DELETE
  USING (get_user_role() = 'gestao');

-- ============================================================
-- POLICIES — materiais_pastas e materiais
-- ============================================================
CREATE POLICY "todos autenticados veem pastas"
  ON public.materiais_pastas FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "gestao e equipe_dm gerenciam pastas"
  ON public.materiais_pastas FOR ALL
  USING (get_user_role() IN ('gestao', 'equipe_dm'));

CREATE POLICY "franqueado vê materiais disponíveis para ele"
  ON public.materiais FOR SELECT
  USING (
    get_user_role() IN ('gestao', 'equipe_dm')
    OR (
      visibilidade = 'todos'
      OR id IN (
        SELECT material_id FROM public.material_franquias
        WHERE franquia_id = ANY(get_user_franquia_ids())
      )
    )
  );

CREATE POLICY "gestao e equipe_dm gerenciam materiais"
  ON public.materiais FOR ALL
  USING (get_user_role() IN ('gestao', 'equipe_dm'));

-- ============================================================
-- POLICIES — calendario_eventos
-- ============================================================
CREATE POLICY "franqueado vê eventos para ele"
  ON public.calendario_eventos FOR SELECT
  USING (
    get_user_role() IN ('gestao', 'equipe_dm')
    OR (
      visibilidade = 'todos'
      OR id IN (
        SELECT evento_id FROM public.evento_franquias
        WHERE franquia_id = ANY(get_user_franquia_ids())
      )
    )
  );

CREATE POLICY "gestao e equipe_dm gerenciam eventos"
  ON public.calendario_eventos FOR ALL
  USING (get_user_role() IN ('gestao', 'equipe_dm'));

-- ============================================================
-- POLICIES — faq
-- ============================================================
CREATE POLICY "todos autenticados veem categorias faq"
  ON public.faq_categorias FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "gestao e equipe_dm gerenciam categorias faq"
  ON public.faq_categorias FOR ALL
  USING (get_user_role() IN ('gestao', 'equipe_dm'));

CREATE POLICY "todos autenticados veem perguntas ativas"
  ON public.faq_perguntas FOR SELECT
  USING (auth.uid() IS NOT NULL AND (ativo = TRUE OR get_user_role() IN ('gestao', 'equipe_dm')));

CREATE POLICY "gestao e equipe_dm gerenciam perguntas faq"
  ON public.faq_perguntas FOR ALL
  USING (get_user_role() IN ('gestao', 'equipe_dm'));

-- ============================================================
-- POLICIES — links_atalhos
-- ============================================================
CREATE POLICY "franqueado vê links ativos disponíveis para ele"
  ON public.links_atalhos FOR SELECT
  USING (
    ativo = TRUE
    AND (
      get_user_role() IN ('gestao', 'equipe_dm')
      OR visibilidade = 'todos'
      OR id IN (
        SELECT link_id FROM public.link_franquias
        WHERE franquia_id = ANY(get_user_franquia_ids())
      )
    )
  );

CREATE POLICY "gestao e equipe_dm gerenciam links"
  ON public.links_atalhos FOR ALL
  USING (get_user_role() IN ('gestao', 'equipe_dm'));

-- ============================================================
-- DADOS INICIAIS — seed mínimo de FAQ e Links
-- (opcional — remova se for popular manualmente)
-- ============================================================

INSERT INTO public.faq_categorias (nome, icone, ordem) VALUES
  ('Tecnologia', 'monitor', 1),
  ('Marketing', 'megaphone', 2),
  ('Financeiro', 'dollar-sign', 3),
  ('Jurídico', 'scale', 4),
  ('Operacional', 'settings', 5);
```

> **Nota:** o initial schema do projeto original também tinha 3 tabelas pivot (`evento_franquias`, `link_franquias`, `material_franquias`) com RLS habilitado **sem policy** — efetivamente bloqueadas. Se você precisa que franqueados leiam essas tabelas pivot, adicione policies espelhando as de `comunicado_franquias` (ver `20260514000000_comunicados_expansao.sql` §8.5).

### 5.2. `20260514000000_comunicados_expansao.sql` — Expansão de Comunicados

Renomeia `conteudo` → `conteudo_html`, adiciona `descricao`/`banner_destaque`/`agendado_para`/`notificar_email`, transforma `categoria` (texto) em M:N via `comunicado_categorias` + `comunicado_categoria_rel`, cria anexos/leituras/reações, **bucket Storage `comunicados`** com policies espelhando RLS, e corrige policies faltantes em `comunicado_franquias`.

```sql
-- (mesmo conteúdo de supabase/migrations/20260514000000_comunicados_expansao.sql)
-- Cola aqui o conteúdo completo do arquivo original. É longo — ~360 linhas.
-- Se quiser, dá pra dividir em partes menores.
```

> **Importante:** este SQL está omitido aqui por tamanho. Copie o arquivo direto:
> `supabase/migrations/20260514000000_comunicados_expansao.sql`

### 5.3. `20260514000100_comunicados_search_path_fix.sql` — Hotfix de função

Pequena correção: `comunicado_id_de_path` precisa de `SET search_path = ''` para passar no advisor `function_search_path_mutable`.

```sql
CREATE OR REPLACE FUNCTION public.comunicado_id_de_path(p_name TEXT)
RETURNS UUID
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    THEN split_part(p_name, '/', 1)::uuid
    ELSE NULL
  END;
$$;
```

### 5.4. `20260525000000_analytics_schema.sql` — Schema de analytics

Schema separado `analytics`, tabela `fct_eventos` (event sourcing leve), índices, RLS (insert para autenticados, select restrito a `gestao`).

```sql
-- ============================================================
-- Analytics: schema + tabela de eventos de uso
-- ============================================================

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE analytics.fct_eventos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento      TEXT NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role        TEXT,
  payload     JSONB,
  ocorreu_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fct_eventos_evento      ON analytics.fct_eventos(evento);
CREATE INDEX idx_fct_eventos_user        ON analytics.fct_eventos(user_id);
CREATE INDEX idx_fct_eventos_ocorreu     ON analytics.fct_eventos(ocorreu_em);
CREATE INDEX idx_fct_eventos_payload_gin ON analytics.fct_eventos USING GIN(payload);

COMMENT ON TABLE analytics.fct_eventos IS
  'Captura bruta de eventos de uso. Event sourcing leve. PII: user_id.';

ALTER TABLE analytics.fct_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario autenticado grava evento em nome próprio"
  ON analytics.fct_eventos FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "somente gestao lê eventos"
  ON analytics.fct_eventos FOR SELECT
  USING (public.get_user_role() = 'gestao');

GRANT USAGE ON SCHEMA analytics TO authenticated;
GRANT INSERT, SELECT ON analytics.fct_eventos TO authenticated;
```

> **Lembre-se:** após criar o schema `analytics`, vá em **Project Settings → API → Exposed schemas** e adicione `analytics` à lista.

---

## 6. Cliente Supabase no Next.js

### `src/lib/supabase/client.ts` (browser)

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### `src/lib/supabase/server.ts` (Server Components / Server Actions)

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado de Server Component — cookies serão atualizados pelo middleware
          }
        },
      },
    }
  );
}
```

---

## 7. Tipos TypeScript do Database

### `src/lib/types.ts` (mínimo essencial)

Cole isto e ajuste conforme criar/remover tabelas. O tipo `Database` é consumido pelo cliente Supabase (`createBrowserClient<Database>` / `createServerClient<Database>`).

```ts
export type UserRole = "franqueado" | "equipe_dm" | "gestao";

export type Profile = {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  departamento: string | null;
  avatar_url: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type Franquia = {
  id: string;
  nome: string;
  cnpj: string | null;
  cidade: string;
  estado: string;
  regiao: string | null;
  ativa: boolean;
  created_at: string;
  updated_at: string;
};

export type FctEvento = {
  id: string;
  evento: string;
  user_id: string | null;
  role: UserRole | null;
  payload: Record<string, unknown> | null;
  ocorreu_em: string;
};

// Adicione os demais tipos conforme as tabelas do schema.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Profile>;
      };
      franquias: {
        Row: Franquia;
        Insert: Omit<Franquia, "id" | "created_at" | "updated_at">;
        Update: Partial<Franquia>;
      };
      // ... outras tabelas
    };
    Functions: {
      get_user_role: { Returns: UserRole };
      get_user_franquia_ids: { Returns: string[] };
    };
  };
  analytics: {
    Tables: {
      fct_eventos: {
        Row: FctEvento;
        Insert: Omit<FctEvento, "id" | "ocorreu_em"> & { id?: string; ocorreu_em?: string };
        Update: Partial<FctEvento>;
      };
    };
  };
};
```

> **Dica:** quando o schema estiver estável, dá pra gerar os tipos automaticamente:
> ```bash
> npx supabase gen types typescript --project-id <ref> > src/lib/types-generated.ts
> ```

---

## 8. Auth guard (proxy / middleware)

### `src/proxy.ts` (atualmente desativado no Portal — mantenha passthrough enquanto desenvolve)

```ts
import { NextResponse, type NextRequest } from "next/server";

// Auth guard desativado durante desenvolvimento frontend-first.
// Reativar com Supabase quando o backend for conectado.
export async function proxy(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### Versão real (quando ativar): renomeie para `src/middleware.ts` e substitua o conteúdo:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Rotas públicas
  const rotasPublicas = ["/login", "/esqueci-senha", "/redefinir-senha"];
  const isPublica = rotasPublicas.some((rota) => request.nextUrl.pathname.startsWith(rota));

  // Não autenticado em rota privada → manda pro login
  if (!user && !isPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Autenticado em rota pública → manda pro dashboard
  if (user && isPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

---

## 9. Padrão de analytics (event tracking)

Captura eventos de uso server-side (mais confiável que client). Falha silenciosa para não quebrar o fluxo do usuário.

### `src/lib/analytics/track.ts` (Server Action)

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export async function rastrear(
  evento: string,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profileRow as { role: UserRole | null } | null)?.role ?? null;

    await supabase
      .schema("analytics")
      .from("fct_eventos")
      .insert({
        evento,
        user_id: user.id,
        role,
        payload: payload ?? null,
      });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics] falha ao rastrear", evento, err);
    }
  }
}
```

### `src/components/analytics/PageViewTracker.tsx` (Client Component)

Auto-rastreia abertura de qualquer rota. Monte no layout para cobrir tudo:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { rastrear } from "@/lib/analytics/track";

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    rastrear("pagina_aberta", { rota: pathname });
  }, [pathname]);

  return null;
}
```

### Uso em qualquer Client Component

```tsx
"use client";
import { rastrear } from "@/lib/analytics/track";

<button onClick={() => rastrear("acao_qualquer", { propriedade: "valor" })}>
  Clica aqui
</button>
```

### Convenções de evento

- Nome: `objeto_acao_passada` (snake_case), ex: `comunicado_lido`, `material_baixado`
- Propriedades: snake_case, descrevem estado **no momento do evento**
- Nunca redefina propriedade existente — crie nome novo
- Anote PII no catálogo (`docs/analytics-eventos.md`)

### Queries de validação típicas

```sql
-- Volume por evento
SELECT evento, COUNT(*) FROM analytics.fct_eventos
WHERE ocorreu_em >= NOW() - INTERVAL '30 days'
GROUP BY evento ORDER BY 2 DESC;

-- Páginas mais visitadas
SELECT payload->>'rota' AS rota, COUNT(*)
FROM analytics.fct_eventos
WHERE evento = 'pagina_aberta'
  AND ocorreu_em >= NOW() - INTERVAL '30 days'
GROUP BY rota ORDER BY 2 DESC;

-- DAU
SELECT DATE_TRUNC('day', ocorreu_em)::date AS dia,
       COUNT(DISTINCT user_id) AS dau
FROM analytics.fct_eventos
WHERE ocorreu_em >= NOW() - INTERVAL '30 days'
GROUP BY dia ORDER BY dia DESC;
```

---

## 10. Aplicar tudo no projeto novo — passo a passo

### A. Criar projeto Supabase novo

1. Criar projeto em supabase.com — anotar **Project Ref**
2. Em Settings → API → Exposed schemas: adicionar `analytics`
3. Em Authentication → Settings: ativar **Leaked Password Protection**

### B. Bootstrap do projeto Next.js

```bash
npx create-next-app@latest meu-projeto --typescript --tailwind --app
cd meu-projeto
npm install @supabase/ssr @supabase/supabase-js
```

### C. Configurar env

```bash
cp .env.local.example .env.local
# Edita .env.local com URL e anon key do novo projeto
```

### D. Criar os arquivos de código

Crie os arquivos exatamente como mostrado nas seções 6, 7, 8 e 9.

### E. Aplicar as migrations

```bash
npx supabase login
npx supabase link --project-ref <ref-do-novo-projeto>

# Coloque os arquivos SQL em supabase/migrations/ (renumere timestamps se preferir)
npx supabase db push
```

### F. Smoke test

```bash
npm run dev
```

1. Crie um usuário em Dashboard → Authentication → Users → Add user (com "Auto Confirm")
2. Vá em `/login` no app e logue
3. Navegue por algumas páginas
4. No SQL Editor do Supabase:
   ```sql
   SELECT * FROM analytics.fct_eventos ORDER BY ocorreu_em DESC LIMIT 20;
   ```
5. Se vier 0 linhas: confira (a) usuário existe, (b) você logou de fato (sem login a Server Action `rastrear()` retorna silenciosa), (c) schema `analytics` está exposto na API.

---

## 11. O que NÃO foi incluído

Decisões conscientes — peças do Portal de Franqueados que não fazem sentido portar genericamente:

- **Mock data** (`src/lib/mock-data.ts`) — específico do domínio DM
- **Componentes de UI** (Sidebar, layouts, páginas) — design system do Portal
- **Tabelas de Suporte/Tickets** (helpdesk, departamentos) — Fase 1 ainda em mock
- **Editor de Artes** (Yungas iframe) — feature específica do Portal
- **Tokens de design (`tailwind.config.ts`)** — visual da marca DM
- **CLAUDE.md / skills** — documentação operacional deste repo

Se for usar partes específicas (ex: schema de Suporte quando virar produção), portá-las depois conforme precisar.

---

**Arquivos de referência no repo original:**
- [supabase/migrations/](../supabase/migrations/)
- [src/lib/supabase/](../src/lib/supabase/)
- [src/lib/analytics/](../src/lib/analytics/)
- [src/components/analytics/PageViewTracker.tsx](../src/components/analytics/PageViewTracker.tsx)
- [src/proxy.ts](../src/proxy.ts)
- [docs/analytics-eventos.md](analytics-eventos.md) — catálogo completo de eventos
- [docs/modulo-comunicados.md](modulo-comunicados.md) — spec do módulo (referência de design de schema)
