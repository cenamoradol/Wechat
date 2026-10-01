# Wechat — Plan completo de implementación

> CRM unificado para **WhatsApp + Facebook Messenger + Instagram DM**,
> auto-hospedable, multi-equipo, con IA y automatizaciones.
> Inspirado en `wacrm` pero ~5× más pequeño y multi-canal.
> Licencia: MIT.

---

## 0. Tabla de contenidos

1. Resumen ejecutivo
2. Stack tecnológico
3. Estructura del proyecto
4. Setup inicial (Fase 0)
5. Variables de entorno
6. Modelo de datos (Postgres / Supabase) — SQL completo
7. Patrones transversales (auth, RLS, cripto, realtime)
8. Integración Meta — los 3 canales
9. Páginas — especificación explícita página por página
10. Endpoints API
11. Motor de automatizaciones
12. AI Agents — diseño completo
13. Dashboard — queries y componentes
14. Roadmap de implementación (Fases 0-9)
15. Roadmap futuro (v2 y v3)
16. Patrones a rescatar de wacrm
17. Convenciones de código
18. Testing
19. Deploy
20. Lista de comprobación pre-lanzamiento

---

## 1. Resumen ejecutivo

**Wechat** es un CRM conversacional multi-canal que centraliza en una sola bandeja
los mensajes de **WhatsApp Business** (Meta Cloud API), **Facebook Messenger** y
**Instagram Direct**, con soporte para múltiples agentes por workspace,
automatizaciones no-code y un asistente de IA con knowledge base propia.

**Filosofía:** simple pero funcional. Evitar sobre-ingeniería. Cada feature tiene
un caso de uso real detrás. Lo que no se usa en 30 días, no se construye.

**Versiones:**
- **v1 (MVP):** inbox + contactos + equipos + automatizaciones + IA + dashboard + settings
- **v2:** Push notifications (OneSignal) + MCP server
- **v3:** Pipeline / Kanban + Public REST API

**Casos de uso principales:**
1. Equipo de atención al cliente respondiendo mensajes de los 3 canales desde
   una sola pantalla
2. Pequeñas empresas que necesitan un CRM sin pagar licencias por asiento
3. Equipos que usan IA para redactar respuestas o auto-responder FAQ
4. Cualquiera que quiera automatizaciones simples (palabra clave → respuesta)

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| Framework | Next.js | 15.x (App Router) | Estable, sin breaking changes de Next 16 |
| Runtime | Node.js | ≥20 | Requerido por Next 15 |
| Lenguaje | TypeScript | ≥5.4 | Tipado end-to-end |
| UI base | React | 19.x | Server components + server actions |
| Estilos | Tailwind CSS | v3.x | Estable, mejor tooling que v4 |
| Componentes | shadcn/ui | última | Copia-pega, sin opinionar diseño |
| Primitivos UI | Radix UI | última | Accesibilidad correcta |
| Iconos | lucide-react | última | Consistencia |
| Formularios | react-hook-form + zod | últimas | Validación tipada |
| Estado servidor | TanStack Query | v5 | Cache + revalidación |
| Notifs toast | sonner | última | Mínimo y bonito |
| Backend BaaS | Supabase | última | Postgres + Auth + Realtime + Storage |
| Cliente Supabase | @supabase/ssr + @supabase/supabase-js | últimas | Server + browser clients |
| Gráficos | Recharts | v2 | Buen balance peso/features |
| CSV parsing | papaparse | última | Estándar, robusto |
| Fechas | date-fns | última | Tree-shakeable |
| Utilidades | clsx + tailwind-merge | últimas | Composición de clases |
| AI SDK | openai + @anthropic-ai/sdk | últimas | BYOK, sin lock-in |
| Webhook cripto | (nativo Node) `crypto` | — | AES-256-GCM y HMAC-SHA256 |
| Validación env | zod + @t3-oss/env-nextjs | últimas | Tipar el .env |
| Tests | Vitest + @testing-library/react | últimas | Rápido, mismo ecosistema |
| Lint | ESLint + eslint-config-next + prettier + prettier-plugin-tailwindcss | últimas | Estándar Next.js |
| Deploy | Vercel | — | 1-click, gratis para hobby |

**NO usamos:**
- ❌ MCP server (v2)
- ❌ OneSignal web push (v2)
- ❌ xyflow / react-flow (no hay canvas visual)
- ❌ @dnd-kit (no hay Kanban en v1)
- ❌ opus-recorder (v1 = upload de archivos)
- ❌ web-push (v2)
- ❌ next-intl (i18n opcional futuro, empezamos solo en español)

---

## 3. Estructura del proyecto

```
wechat/
├── .env.local.example
├── .eslintrc.json
├── .gitignore
├── .prettierrc
├── components.json                  (config de shadcn)
├── docker-compose.yml               (opcional)
├── Dockerfile                       (opcional)
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── public/
│   ├── logo.svg
│   └── favicon.ico
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/
│       ├── 001_init_workspaces.sql
│       ├── 002_channels.sql
│       ├── 003_messaging.sql
│       ├── 004_contacts_extras.sql
│       ├── 005_automations.sql
│       ├── 006_ai.sql
│       ├── 007_activities.sql
│       └── 008_storage.sql
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx                  (redirect → /login o /dashboard)
    │   ├── (auth)/
    │   │   ├── layout.tsx
    │   │   ├── login/page.tsx
    │   │   ├── signup/page.tsx
    │   │   ├── forgot-password/page.tsx
    │   │   └── actions.ts
    │   ├── accept-invite/[token]/page.tsx
    │   ├── onboarding/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx              (wizard)
    │   │   └── actions.ts
    │   ├── (workspace)/
    │   │   ├── layout.tsx            (sidebar + topbar)
    │   │   ├── dashboard/page.tsx
    │   │   ├── inbox/
    │   │   │   ├── page.tsx          (lista sin conversación seleccionada)
    │   │   │   └── [conversationId]/page.tsx
    │   │   ├── contacts/
    │   │   │   ├── page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── automations/
    │   │   │   ├── page.tsx
    │   │   │   ├── new/page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── ai-agents/
    │   │   │   ├── page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── team/page.tsx
    │   │   └── settings/
    │   │       ├── page.tsx          (redirect → perfil)
    │   │       ├── profile/page.tsx
    │   │       ├── workspace/page.tsx
    │   │       ├── channels/page.tsx
    │   │       ├── ai/page.tsx
    │   │       └── notifications/page.tsx
    │   ├── api/
    │   │   ├── auth/callback/route.ts
    │   │   ├── webhooks/
    │   │   │   ├── whatsapp/route.ts
    │   │   │   ├── facebook/route.ts
    │   │   │   └── instagram/route.ts
    │   │   ├── oauth/meta/
    │   │   │   ├── start/route.ts
    │   │   │   └── callback/route.ts
    │   │   ├── conversations/
    │   │   │   ├── route.ts
    │   │   │   └── [id]/
    │   │   │       ├── route.ts
    │   │   │       ├── messages/route.ts
    │   │   │       ├── status/route.ts
    │   │   │       └── read/route.ts
    │   │   ├── contacts/
    │   │   │   ├── route.ts
    │   │   │   ├── import/route.ts
    │   │   │   └── [id]/route.ts
    │   │   ├── automations/
    │   │   │   ├── route.ts
    │   │   │   └── [id]/
    │   │   │       ├── route.ts
    │   │   │       ├── toggle/route.ts
    │   │   │       └── test/route.ts
    │   │   ├── ai/agents/
    │   │   │   ├── route.ts
    │   │   │   └── [id]/
    │   │   │       ├── route.ts
    │   │   │       └── chat/route.ts
    │   │   ├── ai/knowledge/
    │   │   │   ├── route.ts
    │   │   │   └── [id]/route.ts
    │   │   ├── ai/embed/route.ts
    │   │   ├── team/
    │   │   │   ├── members/route.ts
    │   │   │   └── invitations/route.ts
    │   │   ├── upload/route.ts
    │   │   └── cron/
    │   │       └── automation-runner/route.ts
    │   └── not-found.tsx
    ├── components/
    │   ├── ui/                       (componentes shadcn generados)
    │   ├── layout/
    │   │   ├── sidebar.tsx
    │   │   ├── topbar.tsx
    │   │   ├── command-palette.tsx
    │   │   └── notifications-bell.tsx
    │   ├── auth/
    │   │   ├── login-form.tsx
    │   │   ├── signup-form.tsx
    │   │   └── forgot-password-form.tsx
    │   ├── inbox/
    │   │   ├── conversation-list.tsx
    │   │   ├── conversation-item.tsx
    │   │   ├── conversation-header.tsx
    │   │   ├── message-thread.tsx
    │   │   ├── message-bubble.tsx
    │   │   ├── reply-box.tsx
    │   │   ├── contact-detail-panel.tsx
    │   │   ├── typing-indicator.tsx
    │   │   └── ai-suggest-button.tsx
    │   ├── contacts/
    │   │   ├── contacts-table.tsx
    │   │   ├── contact-drawer.tsx
    │   │   ├── contact-form.tsx
    │   │   └── csv-import-dialog.tsx
    │   ├── automations/
    │   │   ├── automations-table.tsx
    │   │   ├── trigger-editor.tsx
    │   │   ├── step-editor.tsx
    │   │   ├── step-types.tsx
    │   │   └── runs-log.tsx
    │   ├── ai/
    │   │   ├── agent-card.tsx
    │   │   ├── agent-form.tsx
    │   │   ├── knowledge-uploader.tsx
    │   │   └── test-chat.tsx
    │   ├── team/
    │   │   ├── members-table.tsx
    │   │   ├── invitations-table.tsx
    │   │   └── invite-dialog.tsx
    │   ├── settings/
    │   │   ├── profile-form.tsx
    │   │   ├── workspace-form.tsx
    │   │   ├── channels-manager.tsx
    │   │   ├── channel-connect-dialog.tsx
    │   │   ├── ai-keys-form.tsx
    │   │   └── notifications-form.tsx
    │   ├── dashboard/
    │   │   ├── kpi-card.tsx
    │   │   ├── messages-chart.tsx
    │   │   ├── channels-donut.tsx
    │   │   ├── recent-conversations.tsx
    │   │   └── activity-feed.tsx
    │   └── common/
    │       ├── empty-state.tsx
    │       ├── loading-skeleton.tsx
    │       ├── error-boundary.tsx
    │       └── confirm-dialog.tsx
    ├── hooks/
    │   ├── use-conversations.ts
    │   ├── use-conversation.ts
    │   ├── use-messages.ts
    │   ├── use-contacts.ts
    │   ├── use-automations.ts
    │   ├── use-ai-agents.ts
    │   ├── use-team.ts
    │   ├── use-workspace.ts
    │   └── use-realtime.ts
    ├── lib/
    │   ├── env.ts                    (validación con zod)
    │   ├── supabase/
    │   │   ├── server.ts             (server client con cookies)
    │   │   ├── browser.ts            (browser client)
    │   │   ├── middleware.ts         (refresh session)
    │   │   └── admin.ts              (service_role para server-only)
    │   ├── crypto.ts                 (AES-256-GCM helpers)
    │   ├── rls.ts                    (helpers para queries)
    │   ├── channels/
    │   │   ├── types.ts              (interfaz ChannelAdapter)
    │   │   ├── whatsapp.ts
    │   │   ├── facebook.ts
    │   │   └── instagram.ts
    │   ├── meta/
    │   │   ├── verify-signature.ts   (HMAC SHA256)
    │   │   ├── verify-webhook.ts     (GET challenge para WA)
    │   │   ├── oauth.ts              (Embedded Signup helpers)
    │   │   └── normalize.ts          (→ NormalizedMessage)
    │   ├── automations/
    │   │   ├── engine.ts             (runner principal)
    │   │   ├── triggers.ts           (evaluadores de trigger)
    │   │   ├── steps.ts              (funciones puras por step)
    │   │   └── types.ts
    │   ├── ai/
    │   │   ├── providers.ts          (clientes OpenAI/Anthropic)
    │   │   ├── chat.ts               (función principal)
    │   │   ├── knowledge.ts          (chunking + retrieval FTS)
    │   │   └── types.ts
    │   ├── utils.ts                  (cn(), formatDate, etc.)
    │   ├── rate-limit.ts             (en memoria, suficiente para v1)
    │   └── constants.ts              (roles, status, etc.)
    ├── types/
    │   ├── database.ts               (generado por supabase gen types)
    │   ├── api.ts
    │   └── domain.ts
    └── middleware.ts                 (auth check global)
```

---

## 4. Setup inicial (Fase 0)

### 4.1 Comandos a ejecutar

```bash
# Crear directorio y entrar
mkdir wechat && cd wechat
git init

# Init Next.js (sin create-next-app para tener control total)
npm init -y
npm install next@latest react@latest react-dom@latest
npm install -D typescript @types/node @types/react @types/react-dom
npm install -D eslint eslint-config-next prettier prettier-plugin-tailwindcss
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom

# Dependencias de app
npm install @supabase/ssr @supabase/supabase-js
npm install @tanstack/react-query
npm install react-hook-form @hookform/resolvers zod
npm install clsx tailwind-merge class-variance-authority
npm install lucide-react sonner
npm install recharts date-fns papaparse
npm install openai @anthropic-ai/sdk
npm install @t3-oss/env-nextjs

# Tailwind v3 + shadcn
npm install -D tailwindcss@^3 postcss autoprefixer
npx tailwindcss init -p
npx shadcn@latest init    # estilo: default, base color: slate
# Componentes shadcn que vamos a usar
npx shadcn@latest add button input label textarea select \
  dialog drawer dropdown-menu popover command \
  card badge avatar separator skeleton sonner \
  tabs switch checkbox radio-group form tooltip \
  alert progress sheet scroll-area

# Supabase CLI (para migrations y local dev)
npm install -D supabase
npx supabase init
npx supabase start
```

### 4.2 `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:types": "supabase gen types typescript --local > src/types/database.ts",
    "db:reset": "supabase db reset",
    "db:migrate": "supabase db push"
  }
}
```

### 4.3 `tsconfig.json` (Next 15 + path alias)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4.4 `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" }  // contacts avatars de Meta
    ]
  }
};

export default nextConfig;
```

---

## 5. Variables de entorno

`.env.local.example`:

```bash
# === App ===
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Wechat

# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-de-supabase>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>    # SOLO server-side, NUNCA al cliente

# === Cifrado ===
# Generar con: openssl rand -base64 32
ENCRYPTION_KEY=<base64-de-32-bytes>

# === Meta OAuth (Embedded Signup) ===
# Crear app en developers.facebook.com, tipo "Business"
META_APP_ID=<tu-app-id>
META_APP_SECRET=<tu-app-secret>
META_CONFIG_ID=<config-id-de-embedded-signup>     # WA + IG + FB a la vez
META_REDIRECT_URI=http://localhost:3000/api/oauth/meta/callback

# === Verificación de webhooks (opcional, recomendado) ===
META_WEBHOOK_VERIFY_TOKEN=<token-que-tu-elijas>  # WA lo usa en GET
# Las firmas HMAC se verifican con META_APP_SECRET

# === Cron (Vercel Cron) ===
CRON_SECRET=<token-secreto-para-proteger-endpoint>  # x-cron-secret header

# === AI (BYOK, opcionales; se pueden poner también en /settings/ai) ===
# Si están en env, se usan como fallback para todos los workspaces
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

`src/lib/env.ts`:

```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    ENCRYPTION_KEY: z.string().min(1),
    META_APP_SECRET: z.string().min(1),
    META_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional()
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_APP_NAME: z.string().default("Wechat"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    META_APP_ID: z.string().min(1),
    META_CONFIG_ID: z.string().min(1),
    META_REDIRECT_URI: z.string().url()
  },
  runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_CONFIG_ID: process.env.META_CONFIG_ID,
    META_REDIRECT_URI: process.env.META_REDIRECT_URI,
    META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
  }
});
```

---

## 6. Modelo de datos (Postgres / Supabase)

Total: **8 archivos de migración**, ~14 tablas. Todo con RLS.

### 6.1 `001_init_workspaces.sql`

```sql
-- Profiles (extiende auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Workspaces (tenant raíz)
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  default_currency text default 'USD' not null,
  onboarding_step int default 0 not null,  -- 0..3
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Memberships (muchos-a-muchos usuarios ↔ workspaces)
create type public.workspace_role as enum ('owner', 'admin', 'agent', 'viewer');

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role public.workspace_role not null default 'agent',
  created_at timestamptz default now() not null,
  unique(workspace_id, user_id)
);

-- Invitaciones pendientes
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  email text not null,
  role public.workspace_role not null default 'agent',
  token text unique not null,
  invited_by uuid references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now() not null
);

-- Trigger: crear profile al signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invitations enable row level security;

create policy "profiles_self" on public.profiles
  for all using (id = auth.uid());

create policy "workspaces_members_only" on public.workspaces
  for all using (
    exists(select 1 from public.workspace_members
           where workspace_id = workspaces.id and user_id = auth.uid())
  );

create policy "members_visible_to_members" on public.workspace_members
  for all using (
    exists(select 1 from public.workspace_members m
           where m.workspace_id = workspace_members.workspace_id
             and m.user_id = auth.uid())
  );

create policy "invitations_workspace_members" on public.invitations
  for all using (
    exists(select 1 from public.workspace_members
           where workspace_id = invitations.workspace_id and user_id = auth.uid())
  );

-- Helper: current user's workspaces
create or replace function public.user_workspace_ids()
returns setof uuid language sql stable security definer as $$
  select workspace_id from public.workspace_members where user_id = auth.uid();
$$;

-- Helper: user role in workspace
create or replace function public.user_role_in_workspace(p_workspace uuid)
returns public.workspace_role language sql stable security definer as $$
  select role from public.workspace_members
  where workspace_id = p_workspace and user_id = auth.uid();
$$;
```

### 6.2 `002_channels.sql`

```sql
create type public.channel_type as enum ('whatsapp', 'facebook', 'instagram');

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  type public.channel_type not null,
  external_id text not null,           -- phone_number_id | page_id | ig_business_account_id
  display_name text not null,
  access_token_enc bytea not null,     -- AES-256-GCM ciphertext (nonce + tag + ct)
  webhook_secret_enc bytea,            -- opcional, algunos canales lo requieren
  meta text,                            -- json libre (page name, ig username, etc.)
  status text default 'connected' not null,  -- connected | error | disconnected
  last_verified_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(workspace_id, type, external_id)
);

create index on public.channels(workspace_id);
create index on public.channels(type);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  type text not null,                  -- messages | status | oauth_callback
  processed boolean default false,
  payload jsonb not null,
  error text,
  received_at timestamptz default now() not null
);

create index on public.webhook_events(channel_id, received_at desc);
create index on public.webhook_events(received_at desc);

alter table public.channels enable row level security;
alter table public.webhook_events enable row level security;

create policy "channels_workspace_members" on public.channels
  for all using (
    exists(select 1 from public.workspace_members
           where workspace_id = channels.workspace_id and user_id = auth.uid())
  );

-- webhook_events: solo service_role (server-side)
-- No policy para usuarios normales → bloqueado por RLS
```

### 6.3 `003_messaging.sql`

```sql
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  full_name text,
  email text,
  phone_e164 text,                     -- normalizado a E.164
  avatar_url text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index on public.contacts(workspace_id);
create index on public.contacts(workspace_id, phone_e164);
create unique index on public.contacts(workspace_id, phone_e164)
  where phone_e164 is not null;

create table public.contact_channels (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade not null,
  channel_id uuid references public.channels(id) on delete cascade not null,
  external_user_id text not null,      -- psid (FB/IG) | wa_id (WA)
  profile jsonb default '{}'::jsonb not null,
  last_seen_at timestamptz,
  created_at timestamptz default now() not null,
  unique(channel_id, external_user_id)
);

create index on public.contact_channels(contact_id);

create type public.conversation_status as enum ('open', 'pending', 'closed');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  contact_channel_id uuid references public.contact_channels(id) on delete cascade not null,
  status public.conversation_status default 'open' not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz default now() not null,
  last_message_preview text,
  unread_count int default 0 not null,
  ai_agent_id uuid,                    -- FK se añade en 006_ai.sql
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(contact_channel_id)
);

create index on public.conversations(workspace_id, last_message_at desc);
create index on public.conversations(workspace_id, status);
create index on public.conversations(workspace_id, assigned_to);
create index on public.conversations(workspace_id, unread_count)
  where unread_count > 0;

create type public.message_direction as enum ('in', 'out');
create type public.message_type as enum (
  'text', 'image', 'video', 'audio', 'document',
  'template', 'interactive', 'reaction', 'story_reply', 'system'
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  external_id text,                    -- wamid | mid
  direction public.message_direction not null,
  type public.message_type default 'text' not null,
  text text,
  media_url text,
  media_mime text,
  template_id text,                    -- para WA templates
  template_vars jsonb,
  reactions jsonb default '[]'::jsonb not null,
  status text default 'sent',          -- queued | sent | delivered | read | failed
  error_code text,
  error_message text,
  raw_payload jsonb,
  sent_by uuid references public.profiles(id) on delete set null,  -- null = AI/bot
  created_at timestamptz default now() not null
);

create index on public.messages(conversation_id, created_at);
create index on public.messages(external_id) where external_id is not null;

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade not null,
  external_id text not null,           -- template name en Meta
  name text not null,
  language text not null,
  status text not null,                -- APPROVED | PENDING | REJECTED
  category text,
  components jsonb not null,
  last_synced_at timestamptz default now() not null,
  unique(channel_id, external_id, language)
);

alter table public.contacts enable row level security;
alter table public.contact_channels enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.templates enable row level security;

create policy "workspace_scoped" on public.contacts
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.contact_channels
  for all using (
    exists(select 1 from public.contacts c
           where c.id = contact_channels.contact_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );

create policy "workspace_scoped" on public.conversations
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.messages
  for all using (
    exists(select 1 from public.conversations c
           where c.id = messages.conversation_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );

create policy "workspace_scoped" on public.templates
  for all using (
    exists(select 1 from public.channels ch
           where ch.id = templates.channel_id
             and ch.workspace_id in (select public.user_workspace_ids()))
  );

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
```

### 6.4 `004_contacts_extras.sql`

```sql
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  color text default 'gray' not null,
  created_at timestamptz default now() not null,
  unique(workspace_id, name)
);

create table public.contact_tags (
  contact_id uuid references public.contacts(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (contact_id, tag_id)
);

create type public.custom_field_type as enum ('text', 'number', 'date', 'select', 'boolean');

create table public.custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  type public.custom_field_type not null,
  options text[],                       -- solo si type = 'select'
  created_at timestamptz default now() not null,
  unique(workspace_id, name)
);

create table public.custom_field_values (
  contact_id uuid references public.contacts(id) on delete cascade not null,
  field_id uuid references public.custom_field_defs(id) on delete cascade not null,
  value text not null,
  primary key (contact_id, field_id)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now() not null
);

create index on public.notes(contact_id, created_at desc);

alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.custom_field_defs enable row level security;
alter table public.custom_field_values enable row level security;
alter table public.notes enable row level security;

create policy "workspace_scoped" on public.tags
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "via_contact" on public.contact_tags
  for all using (
    exists(select 1 from public.contacts c
           where c.id = contact_tags.contact_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );

create policy "workspace_scoped" on public.custom_field_defs
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "via_contact" on public.custom_field_values
  for all using (
    exists(select 1 from public.contacts c
           where c.id = custom_field_values.contact_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );

create policy "via_contact" on public.notes
  for all using (
    exists(select 1 from public.contacts c
           where c.id = notes.contact_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );
```

### 6.5 `005_automations.sql`

```sql
create type public.automation_status as enum ('active', 'paused', 'draft');

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  description text,
  trigger jsonb not null,              -- ver sección 11
  steps jsonb not null default '[]'::jsonb,
  status public.automation_status default 'draft' not null,
  created_by uuid references public.profiles(id),
  last_run_at timestamptz,
  run_count int default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index on public.automations(workspace_id, status);

create type public.run_status as enum ('pending', 'running', 'succeeded', 'failed', 'cancelled');

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references public.automations(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  status public.run_status default 'pending' not null,
  current_step int default 0 not null,
  log jsonb default '[]'::jsonb not null,
  scheduled_at timestamptz,            -- para waits
  started_at timestamptz default now() not null,
  completed_at timestamptz
);

create index on public.automation_runs(automation_id, started_at desc);
create index on public.automation_runs(status, scheduled_at)
  where status = 'pending';

alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;

create policy "workspace_scoped" on public.automations
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.automation_runs
  for all using (workspace_id in (select public.user_workspace_ids()));
```

### 6.6 `006_ai.sql`

```sql
create extension if not exists vector with schema extensions;

create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  provider text not null check (provider in ('openai', 'anthropic')),
  model text not null,                 -- gpt-4o-mini | claude-3-5-sonnet-latest | etc
  system_prompt text not null,
  temperature numeric(3,2) default 0.7 not null,
  max_tokens int default 1024 not null,
  kb_enabled boolean default false not null,
  auto_reply_enabled boolean default false not null,
  max_replies_per_conversation int default 5 not null,
  handoff_keywords text[] default '{}'::text[] not null,
  is_default boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create unique index one_default_agent_per_workspace
  on public.ai_agents(workspace_id) where is_default;

create table public.ai_knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  agent_id uuid references public.ai_agents(id) on delete cascade not null,
  title text not null,
  source_url text,
  content text not null,
  tokens int,
  tsv tsvector generated always as (
    to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(content,''))
  ) stored,
  created_at timestamptz default now() not null
);

create index on public.ai_knowledge_docs using gin(tsv);
create index on public.ai_knowledge_docs(agent_id);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.ai_agents(id) on delete cascade not null,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tokens_in int,
  tokens_out int,
  latency_ms int,
  created_at timestamptz default now() not null
);

create index on public.ai_messages(conversation_id, created_at);

-- Ahora podemos añadir la FK pendiente
alter table public.conversations
  add constraint conversations_ai_agent_fk
  foreign key (ai_agent_id) references public.ai_agents(id) on delete set null;

-- Encrypted API keys (per-workspace)
create table public.ai_provider_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  provider text not null check (provider in ('openai', 'anthropic')),
  api_key_enc bytea not null,
  created_at timestamptz default now() not null,
  unique(workspace_id, provider)
);

alter table public.ai_agents enable row level security;
alter table public.ai_knowledge_docs enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_provider_keys enable row level security;

create policy "workspace_scoped" on public.ai_agents
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.ai_knowledge_docs
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.ai_messages
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.ai_provider_keys
  for all using (workspace_id in (select public.user_workspace_ids()));
```

### 6.7 `007_activities.sql`

```sql
create type public.activity_type as enum (
  'message_received', 'message_sent', 'conversation_assigned',
  'conversation_status_changed', 'contact_created', 'contact_updated',
  'automation_triggered', 'automation_completed', 'automation_failed',
  'agent_replied', 'agent_handoff'
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  type public.activity_type not null,
  actor_id uuid references public.profiles(id) on delete set null,
  subject_type text,                   -- contact | conversation | automation | agent
  subject_id uuid,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

create index on public.activities(workspace_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  body text,
  href text,
  metadata jsonb default '{}'::jsonb not null,
  read_at timestamptz,
  created_at timestamptz default now() not null
);

create index on public.notifications(user_id, created_at desc);
create index on public.notifications(user_id) where read_at is null;

alter table public.activities enable row level security;
alter table public.notifications enable row level security;

create policy "workspace_scoped" on public.activities
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "user_own" on public.notifications
  for all using (user_id = auth.uid());
```

### 6.8 `008_storage.sql`

```sql
-- Bucket para avatars, attachments, kb uploads
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('attachments', 'attachments', false),
  ('kb', 'kb', false);

-- Avatars: lectura pública, escritura solo authenticated
create policy "avatars_read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- Attachments y KB: solo miembros del workspace propietario del path
-- Path convention: {workspace_id}/{conversation_id}/{filename}
create policy "attachments_workspace" on storage.objects for all
  using (
    bucket_id in ('attachments', 'kb')
    and (storage.foldername(name))[1]::uuid in (select public.user_workspace_ids())
  );
```

---

## 7. Patrones transversales

### 7.1 Auth flow

```
Signup → Supabase auth.users → trigger crea profile
       → server action crea workspace + workspace_members(role=owner)
       → redirect /onboarding

Login → Supabase session en cookie (HTTP-only)
       → middleware refresca token en cada request
       → redirect a ?next=... o /dashboard
```

### 7.2 Cifrado AES-256-GCM

`src/lib/crypto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

const KEY = Buffer.from(env.ENCRYPTION_KEY, "base64");
const ALGO = "aes-256-gcm";

export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);   // 12 + 16 + N bytes
}

export function decrypt(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
```

Usado para:
- `channels.access_token_enc` (tokens de Meta)
- `ai_provider_keys.api_key_enc` (BYOK de los usuarios)
- Cualquier secreto que toquemos

### 7.3 Verificación de firma de webhooks Meta

```ts
// src/lib/meta/verify-signature.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false;
  if (!signatureHeader.startsWith("sha256=")) return false;
  const expected = signatureHeader.slice(7);
  const computed = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(computed, "hex"));
  } catch { return false; }
}
```

**WA usa** `X-Hub-Signature-256`.
**FB e IG usan** `X-Hub-Signature-256` también (mismo formato).

### 7.4 Realtime (Supabase)

```ts
// src/hooks/use-realtime.ts
import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function useConversationMessages(
  conversationId: string,
  onInsert: (msg: Message) => void
) {
  useEffect(() => {
    const supabase = createBrowserClient(/* ... */);
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages",
          filter: `conversation_id=eq.${conversationId}` },
        payload => onInsert(payload.new as Message))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);
}
```

### 7.5 Rate limiting (en memoria, suficiente para v1)

```ts
// src/lib/rate-limit.ts
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetIn: windowMs };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, resetIn: b.resetAt - now };
  }
  b.count++;
  return { ok: true, remaining: limit - b.count, resetIn: b.resetAt - now };
}
```

Aplicado en:
- Login (5/15min por IP)
- Signup (3/hora por IP)
- Webhook endpoints (no se limita, son Meta)
- AI endpoints (20/min por usuario)

### 7.6 Server actions con validación

```ts
"use server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

const Schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional()
});

export async function updateProfile(input: z.infer<typeof Schema>) {
  const data = Schema.parse(input);
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { error } = await supabase.from("profiles")
    .update({ full_name: data.name, email: data.email, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw error;
}
```

---

## 8. Integración Meta — los 3 canales

### 8.1 Interfaz común (`src/lib/channels/types.ts`)

```ts
export type NormalizedMessage = {
  channelType: "whatsapp" | "facebook" | "instagram";
  channelExternalId: string;        // phone_number_id | page_id | ig_user_id
  contactExternalId: string;       // wa_id | psid
  messageExternalId: string;
  type: "text" | "image" | "video" | "audio" | "document"
      | "template" | "interactive" | "reaction" | "story_reply";
  direction: "in";
  text?: string;
  mediaUrl?: string;
  mediaMime?: string;
  templateName?: string;
  templateVars?: Record<string, string>;
  raw: any;
  timestamp: Date;
};

export interface ChannelAdapter {
  type: "whatsapp" | "facebook" | "instagram";
  verifyWebhookGet(req: Request): Response | null;     // challenge (solo WA)
  verifyWebhookPost(rawBody: string, signature: string | null): boolean;
  parseInbound(payload: any): NormalizedMessage[];
  sendText(accessToken: string, fromExternalId: string,
           toExternalId: string, text: string): Promise<{ externalId: string }>;
  sendTemplate(accessToken: string, fromExternalId: string,
               toExternalId: string, templateName: string,
               language: string, variables: Record<string, string>): Promise<{ externalId: string }>;
  sendMedia(accessToken: string, fromExternalId: string,
             toExternalId: string, mediaUrl: string,
             mediaType: string, caption?: string): Promise<{ externalId: string }>;
  fetchContactProfile(accessToken: string,
                      externalUserId: string): Promise<{ name?: string; avatar?: string }>;
  fetchTemplates(accessToken: string,
                 externalId: string): Promise<Template[]>;
}
```

### 8.2 URLs y endpoints clave

| Acción | URL |
|---|---|
| Graph API base | `https://graph.facebook.com/v21.0/` |
| Send message (WA + FB + IG) | `POST {external_id}/messages` |
| Get user profile (FB) | `GET {user_id}?fields=first_name,last_name,profile_pic` |
| Get user profile (IG) | `GET {ig_user_id}?fields=name,profile_picture_url` |
| Get templates (WA) | `GET {waba_id}/message_templates` |
| Suscribirse a webhooks | `POST {app_id}/subscriptions?object=...` |

### 8.3 OAuth Embedded Signup flow

```
1. Usuario click "Conectar canal" en /settings/channels
2. Frontend abre ventana: https://www.facebook.com/v21.0/dialog/oauth?
     client_id=META_APP_ID&redirect_uri=...&response_type=code&config_id=META_CONFIG_ID
3. Usuario autoriza (Meta muestra UI para elegir páginas/cuentas)
4. Meta redirige a /api/oauth/meta/callback?code=XYZ
5. Backend intercambia code → access_token (Graph API)
6. Backend consulta /me/accounts y /me/instagram_accounts para listar
   los assets del usuario
7. Frontend muestra wizard para que elija cuáles conectar
8. Para cada uno: guardar channels row con access_token_enc
9. Suscribir webhook: POST {app_id}/subscriptions?
     object=instagram (cubre IG + FB) y object=whatsapp_business_account (para WA)
```

### 8.4 Webhook handler genérico

```ts
// /api/webhooks/whatsapp/route.ts (esqueleto)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(raw, signature, env.META_APP_SECRET)) {
    return new Response("Invalid signature", { status: 401 });
  }
  const payload = JSON.parse(raw);
  await processInbound("whatsapp", payload);
  return new Response("OK", { status: 200 });
}
```

`processInbound`:
1. Identifica `channel` por `payload.metadata.phone_number_id`
2. Normaliza → array de `NormalizedMessage`
3. Para cada uno: upsert `contact_channels`, upsert `contact`, upsert `conversation`, insert `messages`
4. Actualiza `conversations.last_message_at`, `last_message_preview`, `unread_count + 1`
5. Evalúa triggers de `automations` activos y crea `automation_runs` correspondientes
6. Si el agente IA por defecto tiene `auto_reply_enabled`, encola respuesta IA
7. Inserta `activities` y crea `notifications` para assigned user

---

## 9. Páginas — especificación explícita

### 9.1 `/login`

**Archivo:** `src/app/(auth)/login/page.tsx`
**Componente:** `src/components/auth/login-form.tsx`

**UI:** Card centrado (max-w-md), logo + nombre app arriba, título "Inicia sesión",
form con `email`, `password`, checkbox "Recordarme", botón "Iniciar sesión".

**Estados:**
- idle → form vacío, botón habilitado
- submitting → spinner en botón, campos disabled
- error → toast de sonner con mensaje ("Credenciales inválidas", "Demasiados intentos, espera 30s")
- success → redirect a `?next=...` o `/dashboard`

**Validación zod:**
- `email`: required, email válido
- `password`: required, min 1 char

**Rate limit:** 5 intentos / 15 min por IP (en server action).

**Server action** en `src/app/(auth)/actions.ts`:
```ts
"use server";
export async function loginAction(input: { email: string; password: string }) {
  // 1. rateLimit(ip, 5, 15*60*1000)
  // 2. supabase.auth.signInWithPassword({ email, password })
  // 3. Si OK: revalidatePath("/") y redirect(next ?? "/dashboard")
}
```

---

### 9.2 `/signup`

**Form:** `full_name`, `email`, `password`, `confirm_password`.

**Validación:**
- `full_name`: required, 2-100 chars
- `email`: required, email válido, único (lo valida Supabase)
- `password`: min 8, al menos 1 mayúscula, 1 número
- `confirm_password`: debe coincidir

**Flujo al éxito:**
1. `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
2. Trigger crea `profile` automáticamente
3. Server action adicional crea `workspaces` (nombre = "Workspace de {full_name}")
4. Crea `workspace_members(user, role=owner)`
5. Redirect `/onboarding`

---

### 9.3 `/forgot-password`

Input email + botón "Enviar enlace". Tras éxito, mensaje neutro:
"Si el email existe, te hemos enviado un enlace para restablecer tu contraseña."

---

### 9.4 `/accept-invite/[token]`

- Server component: busca invitación por token, si expiró o ya aceptada → mensaje de error
- Si el usuario ya está logueado: muestra preview + botones "Aceptar" / "Rechazar"
- Si no está logueado: muestra form de signup/login con email pre-rellenado; tras auth, automáticamente acepta la invitación

---

### 9.5 `/onboarding` (wizard)

**Paso 1** (route `?step=1`): Bienvenida
- Input nombre del workspace (default "Mi workspace")
- Upload logo (opcional)
- Zona horaria (select)
- Siguiente

**Paso 2** (route `?step=2`): Conecta un canal
- 3 cards grandes: WhatsApp · Facebook · Instagram (cada uno con icono y descripción corta)
- Click → abre `ChannelConnectDialog`
- "Saltar por ahora" link

**Paso 3** (route `?step=3`): Listo
- Card de éxito
- CTA "Ir al inbox" → `/inbox`

Estado persistido en `workspaces.onboarding_step` (0-3).

---

### 9.6 `/dashboard`

**Server component** que carga datos en paralelo:
- `getKpis(workspaceId)` → `{ openConversations, messagesToday, avgResponseMin, totalContacts, deltas }`
- `getMessagesPerDay(workspaceId, 14)` → `[{date, whatsapp, facebook, instagram}]`
- `getChannelsDistribution(workspaceId)` → `[{channel, count}]`
- `getRecentConversations(workspaceId, 5)`
- `getRecentActivity(workspaceId, 10)`

**Layout (grid):**
```
Row 1: [KPI 1] [KPI 2] [KPI 3] [KPI 4]      (4 cols desktop, 2 tablet, 1 mobile)
Row 2: [Messages line chart 14d] [Channels donut]
Row 3: [Recent conversations table] [Activity feed]
Row 4: [Quick actions row]
```

**KPI card:** título + número grande + delta vs semana anterior (▲ verde / ▼ rojo).

**Messages chart:** Recharts LineChart, eje X fechas, 3 líneas (WA verde, FB azul, IG rosa).

**Channels donut:** Recharts PieChart, leyenda interactiva.

**Recent conversations:** tabla compacta: avatar + nombre + último mensaje + canal icon + tiempo.

**Activity feed:** lista cronológica con iconos según tipo:
- 💬 "María respondió a Juan"
- 👤 "Nuevo contacto creado"
- 🤖 "IA respondió automáticamente"
- ⚙️ "Automatización 'Bienvenida' ejecutada"

---

### 9.7 `/inbox` — la pieza central ⭐

**Layout:** CSS grid `grid-cols-[320px_1fr_320px]` en desktop, oculta columnas en mobile.

**Componente top:** `src/components/layout/workspace-layout.tsx` envuelve todas las páginas privadas.

#### Columna 1 — Lista (`conversation-list.tsx`)

- **Header (sticky top):**
  - Tabs: `Todos` | `No leídos` (badge) | `Míos` | `Mención`
  - Botón filtros (popover): Canal (multi-checkbox), Estado (multi), Etiquetas (multi), Asignado
  - Search box

- **Lista virtualizada** (usar `react-window` o similar para >500 items):
  - Cada item (`conversation-item.tsx`):
    - Avatar 40px
    - Canal badge (esquina inferior derecha del avatar, según tipo)
    - Nombre + último preview (1 línea truncada)
    - Tiempo relativo
    - Badge unread (punto verde + número si >0)
    - Avatar del asignado (top right) si asignado a otro
  - Item activo: fondo gris
  - Click → router.push(`/inbox/{id}`)

- **Empty state:** ilustración + "No hay conversaciones" + "Esperando mensajes..."

#### Columna 2 — Conversación activa

- **Header:**
  - Avatar + nombre + canal icon
  - Estado (dropdown): Abierto | Pendiente | Cerrado
  - Asignado (dropdown con team members + "Sin asignar")
  - Botones derecha: panel contacto (toggle col 3), silenciar

- **Thread** (`message-thread.tsx`):
  - Separadores por día ("Hoy", "Ayer", "15 sept")
  - Auto-scroll al fondo al cargar nuevo mensaje (salvo si el usuario scrolleó arriba)
  - Agrupa mensajes consecutivos del mismo autor
  - Burbuja entrante (gris, izquierda) / saliente (color canal, derecha)
  - Renderizado por tipo (en `message-bubble.tsx`):
    - text: párrafo
    - image: thumbnail clickable → dialog lightbox
    - video: `<video controls>` con poster
    - audio: `<audio controls>` + duración
    - document: icon + filename + tamaño + download
    - template: header + body con vars resueltas
    - reaction: emoji flotante
  - Status indicators en salientes:
    - ✓ (gris): enviado
    - ✓✓ (gris): entregado
    - ✓✓ (azul): leído
    - ⚠️ (rojo): falló (hover muestra error)

- **Typing indicator:** "Escribiendo..." con animación, suscrito a broadcast channel

- **AI banner** (condicional): si `conversation.ai_agent_id` y auto-reply ON:
  ```
  ┌──────────────────────────────────────────────────┐
  │ 🤖 IA respondiendo automáticamente   [Tomar control] │
  └──────────────────────────────────────────────────┘
  ```

- **Reply box** (`reply-box.tsx`):
  - Textarea auto-resize (1-6 líneas)
  - Iconos izquierda: 📎 adjuntar (popover: imagen/video/documento) | 😀 emoji | 🎤 audio (placeholder v1 = "Próximamente")
  - Botón **Plantillas** (solo si canal = WhatsApp) → dialog con templates aprobados
  - Botón **✨ Sugerir con IA** → loading → inserta sugerencia en textarea
  - Botón **Enviar** (icono Send, deshabilitado si vacío)
  - Atajos: `Enter` envía, `Shift+Enter` nueva línea, `Cmd/Ctrl+K` command palette

- **Real-time:**
  - Nuevos mensajes (postgres_changes)
  - Cambios de status de mensajes propios (delivered/read)
  - Typing (broadcast)
  - Status de conversación (asignado, status)

#### Columna 3 — Detalle contacto (`contact-detail-panel.tsx`)

**Layout:** Card scrollable. Colapsable con botón.

- Avatar grande + nombre + email + teléfono
- **Canales vinculados:** chips con icono de cada canal (click → filtra conversaciones por ese canal-contacto)
- **Etiquetas:** chips coloreados + botón añadir
- **Campos personalizados:** lista k-v + botón añadir
- **Notas internas:** lista cronológica + textarea para nueva nota
- **Timeline:** eventos cronológicos (mensajes, cambios, automatizaciones)
- Botón "Ver perfil completo" → `/contacts/{id}`

---

### 9.8 `/contacts`

**Toolbar:**
- Search box (debounced, busca nombre/email/teléfono)
- Filtros: Canal (chips), Etiquetas (multi-select), Propietario (dropdown)
- Botones: **+ Nuevo contacto** (dialog), **Importar CSV** (dialog)

**Tabla** (`contacts-table.tsx`):
- Checkboxes para bulk actions
- Columnas: Avatar | Nombre | Canales (chips) | Email | Teléfono | Etiquetas (chips) | Último contacto | Propietario
- Click fila → drawer lateral (`contact-drawer.tsx`)
- Paginación 25/50/100
- Empty state: ilustración + CTA "Importa tus contactos o crea el primero"

**Acciones bulk:** Añadir etiqueta, Quitar etiqueta, Eliminar (confirm)

**`/contacts/[id]`** (o drawer en v1):
- Toda la info del panel 3 del inbox, editable
- Botones: Editar, Eliminar, Fusionar con otro contacto

**Modal nuevo contacto:**
- Nombre*
- Canal principal (radio: WA/FB/IG) — determina campos requeridos
- ID externo (label cambia: "Teléfono" / "PSID" / "IG user id")
- Email (opcional)
- Etiquetas (multi)
- Campos personalizados (dinámicos según custom_field_defs)
- Notas iniciales (opcional)

**CSV import dialog:**
- Paso 1: drag-drop archivo
- Paso 2: mapeo de columnas (selector por columna)
- Paso 3: preview de 5 filas
- Paso 4: confirmación + ejecutar (background, muestra progreso)

---

### 9.9 `/automations`

**Lista** (`automations-table.tsx`):
- Search + filtros: Estado (Activa/Pausada/Borrador), Disparador
- Botón **+ Nueva automatización**
- Tabla: Nombre | Disparador (legible) | Canales | Última ejecución | Estado (toggle) | Acciones
- Acciones por fila: Editar, Duplicar, Eliminar (confirm), Ver ejecuciones

**`/automations/new` y `/automations/[id]`** — editor lista-de-pasos

**Layout:** 2 columnas.

**Columna izquierda (60%):**
- Header: nombre (input) + descripción (textarea)
- Sección **Disparador** (`trigger-editor.tsx`):
  - Selector de tipo:
    - `Mensaje recibido` → canal (WA/FB/IG/todos) + match (keyword exacto | contiene | regex | cualquier) + valor
    - `Mensaje sin responder` → minutos + canal
    - `Contacto nuevo` → canal
    - `Etiqueta añadida` → tag
    - `Programado (cron)` → expresión + timezone
  - Live preview en lenguaje natural
- Sección **Pasos** (lista vertical):
  - Botón `+ Añadir paso` (al final)
  - Cada paso (`step-editor.tsx`):
    - Card colapsable con handle para arrastrar (reordenar)
    - Header: `[icon] Tipo — resumen corto`
    - Click expandir → form de configuración específico
  - Tipos de paso disponibles:
    1. `send_text`: textarea mensaje
    2. `send_template`: select template + vars por índice
    3. `send_media`: upload + caption
    4. `add_tag` / `remove_tag`: select tag
    5. `set_field`: select field + value
    6. `wait`: duration (min/h/d)
    7. `assign_to`: select user
    8. `set_status`: select status
    9. `close_conversation`: sin config
    10. `webhook`: URL + method + headers + body template (vars)
    11. `ai_reply`: select agent + optional handoff message
    12. `branch` (if/else): condición (campo operador valor) + dos ramas de sub-pasos
- Botón **Probar**: dialog → seleccionar contacto → dry-run (no envía, muestra qué haría)
- Botones footer: **Guardar borrador** | **Guardar y activar**

**Columna derecha (40%):**
- Mientras nada seleccionado: **Resumen en lenguaje natural** ("Cuando alguien envíe 'precio' por WhatsApp → enviar plantilla 'promo' → esperar 1h → añadir etiqueta 'lead caliente' → responder con IA")
- Con paso seleccionado: ayuda contextual + ejemplos + errores comunes
- Estadísticas de la automatización (si existe): ejecuciones hoy/semana/mes, tasa éxito, tiempo medio

**Tab/Modal ejecuciones:** tabla con últimas 50, expandable para ver step-by-step log.

---

### 9.10 `/ai-agents`

**Lista:**
- Grid 2 columnas de cards (`agent-card.tsx`)
- Cada card:
  - Nombre + badge modelo ("gpt-4o-mini" o "claude-3-5-sonnet")
  - Toggle Activo/Inactivo
  - "KB: X docs"
  - "Auto-reply: on/off"
  - Botón **Probar** (abre chat lateral)
- Botón **+ Nuevo agente**

**`/ai-agents/[id]`** — 4 tabs

**Tab 1 · Configuración** (`agent-form.tsx`)
- Nombre
- Proveedor (radio: OpenAI | Anthropic)
- Modelo (select dinámico según provider)
- System prompt (textarea grande, con helper mostrando placeholders disponibles: `{{contact_name}}`, `{{workspace_name}}`, `{{last_messages}}`)
- Temperatura (slider 0-1, default 0.7)
- Max tokens (input, default 1024)
- Habilitar KB (toggle)
- Auto-reply (toggle) — al activar, aparece warning sobre handoff
- Max replies por conversación (input, default 5)
- Handoff keywords (chips: "humano", "asesor", etc.)
- Es agente por defecto (toggle, único por workspace)

**Tab 2 · Knowledge Base** (`knowledge-uploader.tsx`)
- Lista de documentos (tabla): título | fuente | # palabras | fecha | acciones (eliminar)
- Botones: **+ Subir archivo** (PDF/TXT/MD), **+ Pegar texto**, **+ Añadir URL**
- Búsqueda en KB: input → muestra top 5 resultados con score
- Tras upload: chunking automático + FTS indexing + (si embedding key disponible) embeddings

**Tab 3 · Disparadores**
- Lista de canales donde el agente está activo (checkboxes)
- Si `auto_reply`: canales específicos para auto-reply
- Keyword overrides (lista: keyword → usar este agente en su lugar)
- Asignado por defecto (toggle)

**Tab 4 · Conversaciones de prueba** (`test-chat.tsx`)
- Chat mock: input + historial
- Después de cada respuesta: tokens consumidos (in/out), latencia, fuentes citadas

---

### 9.11 `/team`

**Sección 1: Miembros** (`members-table.tsx`)
- Tabla: Avatar | Nombre | Email | Rol (dropdown) | Última actividad | Acciones
- Cambiar rol: solo owner/admin pueden. Si el owner se intenta cambiar a otro rol, modal: "Promueve a otro owner primero"
- Quitar miembro: confirm dialog

**Sección 2: Invitaciones** (`invitations-table.tsx`)
- Tabla: Email | Rol | Enviada | Expira | Acciones (Reenviar, Cancelar)

**Botón:** `+ Invitar miembro` → dialog (`invite-dialog.tsx`):
- Email
- Rol
- Mensaje opcional (se incluye en el email)
- Botón "Enviar invitación" → genera token, envía email (Supabase Auth o servicio externo como Resend)

---

### 9.12 `/settings` — Tabs

#### `/settings/profile`
- Avatar (upload + crop con react-image-crop o similar)
- Nombre
- Email (read-only, con link "cambiar email" futuro)
- Sección cambiar contraseña (3 inputs)

#### `/settings/workspace`
- Nombre
- Logo
- Zona horaria
- Moneda por defecto
- Zona peligrosa: "Eliminar workspace" (input confirmación con palabra "ELIMINAR")

#### `/settings/channels` ⭐
**Server component** carga lista de canales.

- **Sección canales conectados:** cards (una por canal):
  - Icono + nombre + `external_id`
  - Status badge (Conectado/Error/Desconectado)
  - Última verificación (timestamp relativo)
  - Botón "Desconectar" (confirm)
  - Botón "Re-verificar"
- **Botón principal:** "Conectar nuevo canal" → abre `channel-connect-dialog.tsx`:
  - Tabs: WhatsApp | Facebook | Instagram
  - WA: opción A (OAuth Embedded Signup, recomendado) | opción B (manual: phone_number_id, waba_id, access_token, webhook_verify_token)
  - FB/IG: solo OAuth (UI de Meta)
  - Tras éxito: card nuevo canal aparece + opción "Probar" (envía mensaje al admin)
- **Sección debug:** últimos 50 `webhook_events` con status, payload resumido, botón "Re-procesar"

#### `/settings/ai`
- Form por proveedor (OpenAI, Anthropic):
  - Input password para API key
  - Botón "Guardar" → cifra y guarda en `ai_provider_keys`
  - Botón "Probar" → hace request dummy (`models.list()`)
  - Indicador de uso mensual estimado (suma de tokens en `ai_messages`)
- Modelo por defecto del workspace (select)
- Límite global de tokens/mes (input, soft warning)
- Toggle "Permitir a la IA ver historiales"

#### `/settings/notifications`
- Lista de eventos que generan notificación in-app:
  - Nuevo mensaje (toggle)
  - Mensaje asignado a mí (toggle, ON por defecto)
  - Automatización falló (toggle, ON)
  - IA necesita handoff (toggle, ON)
  - Nuevo contacto (toggle, OFF)
- Preview de cómo se ve la notif (card ejemplo)

---

## 10. Endpoints API — referencia completa

| Método | Path | Auth | Descripción |
|---|---|---|---|
| POST | `/api/webhooks/whatsapp` | firma Meta | Inbound WA |
| POST | `/api/webhooks/facebook` | firma Meta | Inbound FB |
| POST | `/api/webhooks/instagram` | firma Meta | Inbound IG (mismo que FB) |
| GET | `/api/webhooks/whatsapp` | — | Verification challenge WA |
| GET | `/api/oauth/meta/start` | session | Redirige a Meta OAuth |
| GET | `/api/oauth/meta/callback` | session | Recibe code, intercambia, redirige a settings |
| GET | `/api/conversations` | session | Lista paginada con filtros |
| GET | `/api/conversations/[id]` | session | Detalle |
| PATCH | `/api/conversations/[id]` | session | Update status/assigned |
| POST | `/api/conversations/[id]/messages` | session | Enviar mensaje |
| POST | `/api/conversations/[id]/read` | session | Marcar leído |
| GET | `/api/contacts` | session | Lista paginada con filtros |
| POST | `/api/contacts` | session | Crear |
| PATCH | `/api/contacts/[id]` | session | Editar |
| DELETE | `/api/contacts/[id]` | session | Eliminar (soft) |
| POST | `/api/contacts/import` | session | CSV import (background) |
| GET/POST | `/api/automations` | session | Lista/Crear |
| GET/PATCH/DELETE | `/api/automations/[id]` | session | Detalle/Editar/Borrar |
| POST | `/api/automations/[id]/toggle` | session | Pausar/Reanudar |
| POST | `/api/automations/[id]/test` | session | Dry-run |
| GET/POST | `/api/ai/agents` | session | Lista/Crear |
| GET/PATCH/DELETE | `/api/ai/agents/[id]` | session | Detalle/Editar/Borrar |
| POST | `/api/ai/agents/[id]/chat` | session | Test chat |
| POST | `/api/ai/knowledge` | session | Upload KB doc |
| DELETE | `/api/ai/knowledge/[id]` | session | Borrar doc |
| POST | `/api/ai/embed` | session | Generar embeddings de un doc |
| POST | `/api/team/invitations` | session | Crear invitación |
| DELETE | `/api/team/invitations/[id]` | session | Cancelar invitación |
| POST | `/api/team/members/[id]/role` | session | Cambiar rol |
| DELETE | `/api/team/members/[id]` | session | Quitar miembro |
| POST | `/api/upload` | session | Signed URL para storage |
| POST | `/api/cron/automation-runner` | `x-cron-secret` | Procesa runs pendientes con wait |

---

## 11. Motor de automatizaciones

### 11.1 Modelo JSON del trigger

```jsonc
// trigger.type: "message_received"
{
  "type": "message_received",
  "channel": "whatsapp",            // whatsapp | facebook | instagram | any
  "match": "keyword",               // exact | contains | regex | any
  "value": "precio",
  "caseSensitive": false
}
// trigger.type: "message_unanswered"
{ "type": "message_unanswered", "minutes": 30, "channel": "any" }
// trigger.type: "contact_created"
{ "type": "contact_created", "channel": "instagram" }
// trigger.type: "tag_added"
{ "type": "tag_added", "tagId": "uuid" }
// trigger.type: "schedule"
{ "type": "schedule", "cron": "0 9 * * *", "timezone": "Europe/Madrid" }
```

### 11.2 Modelo JSON de steps

```jsonc
[
  { "type": "send_text", "text": "Hola {{contact.name}}!" },
  { "type": "send_template", "templateId": "uuid", "vars": {"1": "{{contact.name}}"} },
  { "type": "add_tag", "tagId": "uuid" },
  { "type": "remove_tag", "tagId": "uuid" },
  { "type": "set_field", "fieldId": "uuid", "value": "VIP" },
  { "type": "wait", "duration": "1h" },                     // 5m | 30m | 1h | 1d
  { "type": "assign_to", "userId": "uuid" },
  { "type": "set_status", "status": "pending" },
  { "type": "close_conversation" },
  { "type": "webhook", "url": "https://...", "method": "POST",
    "headers": {"X-Token": "abc"}, "body": { "contact": "{{contact.id}}" } },
  { "type": "ai_reply", "agentId": "uuid", "handoffMessage": "Te paso con un humano" },
  { "type": "branch",
    "if": { "field": "tag", "operator": "has", "value": "uuid" },
    "then": [ ... ],          // sub-steps anidados
    "else": [ ... ]
  }
]
```

### 11.3 Contexto de ejecución

```ts
type RunContext = {
  run: AutomationRun;
  automation: Automation;
  workspace: Workspace;
  conversation?: Conversation;
  contact: Contact;
  contactChannel: ContactChannel;
  channel: Channel;
  triggerData: Record<string, any>;     // ej. texto del mensaje
  vars: Record<string, any>;            // acumulador entre steps
};
```

### 11.4 Engine

```ts
// src/lib/automations/engine.ts
export async function executeRun(runId: string) {
  const ctx = await loadContext(runId);
  if (ctx.run.status !== "pending") return;
  await updateRun(runId, { status: "running" });

  for (let i = ctx.run.current_step; i < ctx.automation.steps.length; i++) {
    const step = ctx.automation.steps[i];
    const stepStart = Date.now();
    try {
      const result = await runStep(step, ctx);
      await appendLog(runId, {
        step: i, type: step.type, status: "ok",
        duration_ms: Date.now() - stepStart, output: result
      });
      if (step.type === "wait") {
        // programa continuación
        await updateRun(runId, { current_step: i + 1,
          scheduled_at: addDuration(new Date(), step.duration), status: "pending" });
        return;
      }
    } catch (err) {
      await appendLog(runId, {
        step: i, type: step.type, status: "failed",
        duration_ms: Date.now() - stepStart, error: err.message
      });
      await updateRun(runId, { status: "failed", completed_at: new Date() });
      await notifyOnFailure(ctx);
      return;
    }
  }
  await updateRun(runId, { status: "succeeded", completed_at: new Date() });
  await updateAutomationStats(ctx.automation.id);
}
```

### 11.5 Trigger evaluation

Tras insert en `messages`, trigger SQL (no en v1, lo hacemos desde el webhook handler) evalúa `automations` activos y crea `automation_runs`:

```ts
async function evaluateTriggers(event: InboundEvent) {
  const active = await db.automations.findActive(event.workspace_id);
  for (const auto of active) {
    if (matches(auto.trigger, event)) {
      await db.runs.create({
        automation_id: auto.id,
        conversation_id: event.conversationId,
        status: "pending"
      });
      // ejecuta inmediatamente (no espera) salvo que el primer step sea wait
      await enqueueRun(auto.id);
    }
  }
}
```

### 11.6 Cron job

`/api/cron/automation-runner` (protegido con `x-cron-secret`):

```ts
export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== env.CRON_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  const pending = await db.runs.findPendingScheduled();    // status=pending AND scheduled_at <= now
  for (const run of pending) {
    await executeRun(run.id);
  }
  return Response.json({ processed: pending.length });
}
```

Configurar en Vercel Cron (`vercel.json`):
```json
{
  "crons": [
    { "path": "/api/cron/automation-runner", "schedule": "* * * * *" }
  ]
}
```

---

## 12. AI Agents — diseño completo

### 12.1 Chat function

```ts
// src/lib/ai/chat.ts
export async function generateAgentReply(args: {
  agent: AIAgent;
  contact: Contact;
  conversation: Conversation;
  messages: Message[];                 // últimos 20
}): Promise<{ content: string; tokens_in: number; tokens_out: number; latency_ms: number; sources: any[] }> {
  const apiKey = await getApiKey(args.agent.workspace_id, args.agent.provider);
  if (!apiKey) throw new Error("No API key for provider");

  const recentMsgs = args.messages.slice(-20).map(m => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.text || ""
  }));

  let sources: any[] = [];
  let systemPrompt = args.agent.system_prompt;

  if (args.agent.kb_enabled) {
    const lastUserMsg = recentMsgs.filter(m => m.role === "user").pop();
    if (lastUserMsg?.content) {
      const docs = await searchKnowledge(args.agent.id, lastUserMsg.content, 3);
      sources = docs;
      if (docs.length > 0) {
        systemPrompt += "\n\nKnowledge base (use only if relevant):\n" +
          docs.map(d => `- ${d.title}: ${d.content.slice(0, 500)}`).join("\n");
      }
    }
  }

  const start = Date.now();
  let reply: string;
  let tokens_in = 0, tokens_out = 0;

  if (args.agent.provider === "openai") {
    const openai = new OpenAI({ apiKey });
    const res = await openai.chat.completions.create({
      model: args.agent.model,
      temperature: args.agent.temperature,
      max_tokens: args.agent.max_tokens,
      messages: [
        { role: "system", content: substituteVars(systemPrompt, args.contact) },
        ...recentMsgs as any
      ]
    });
    reply = res.choices[0].message.content!;
    tokens_in = res.usage?.prompt_tokens ?? 0;
    tokens_out = res.usage?.completion_tokens ?? 0;
  } else {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model: args.agent.model,
      max_tokens: args.agent.max_tokens,
      system: substituteVars(systemPrompt, args.contact),
      messages: recentMsgs as any
    });
    reply = (res.content[0] as any).text;
    tokens_in = res.usage.input_tokens;
    tokens_out = res.usage.output_tokens;
  }

  return { content: reply, tokens_in, tokens_out, latency_ms: Date.now() - start, sources };
}
```

### 12.2 Handoff logic

```ts
// Antes de auto-responder
function shouldHandoff(agent: AIAgent, messages: Message[]): boolean {
  const lastUser = [...messages].reverse().find(m => m.direction === "in");
  if (!lastUser) return true;
  const text = (lastUser.text || "").toLowerCase();
  if (agent.handoff_keywords.some(k => text.includes(k.toLowerCase()))) return true;
  const aiReplies = messages.filter(m => m.direction === "out" && m.sent_by === null).length;
  if (aiReplies >= agent.max_replies_per_conversation) return true;
  return false;
}
```

### 12.3 Knowledge Base — chunking y FTS

```ts
// src/lib/ai/knowledge.ts
export function chunkDocument(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

export async function searchKnowledge(agentId: string, query: string, limit = 3) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("ai_knowledge_docs")
    .select("id, title, content")
    .eq("agent_id", agentId)
    .textSearch("tsv", query, { type: "websearch", config: "spanish" })
    .limit(limit);
  return data ?? [];
}
```

### 12.4 Flujo end-to-end de un mensaje entrante con auto-reply

```
1. Webhook llega → processInbound()
2. Insert messages + actualizar conversation
3. Evaluar triggers → encolar automation runs
4. Si la conversation tiene ai_agent_id y ese agent.auto_reply_enabled:
   a. Cargar últimos 20 mensajes
   b. shouldHandoff? → sí: marcar conversation para handoff humano, NOT stop
   c. generateAgentReply()
   d. Insert messages (direction=out, sent_by=null) con status='sent'
   e. channel.sendText() → actualizar external_id + status
   f. Insert ai_messages (tokens, latency)
   g. Insert activities + notifications
5. Realtime empuja a todos los clientes suscritos
```

---

## 13. Dashboard — queries

```ts
// src/lib/dashboard/queries.ts

export async function getKpis(workspaceId: string) {
  const supabase = createServerClient();
  const todayStart = startOfDay(new Date());
  const weekAgo = subDays(new Date(), 7);
  const prevWeek = subDays(new Date(), 14);

  const [{ count: openConv }, { count: msgsToday },
         { data: respTimes }, { count: contacts }] = await Promise.all([
    supabase.from("conversations").select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).neq("status", "closed"),
    supabase.from("messages").select("*", { count: "exact", head: true })
      .eq("direction", "in").gte("created_at", todayStart.toISOString())
      .eq("workspace_id", workspaceId),
    supabase.rpc("get_response_times", { ws: workspaceId, since: weekAgo.toISOString() }),
    supabase.from("contacts").select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
  ]);

  return { openConversations: openConv ?? 0, messagesToday: msgsToday ?? 0,
           avgResponseMin: average(respTimes), totalContacts: contacts ?? 0 };
}

export async function getMessagesPerDay(workspaceId: string, days = 14) {
  const supabase = createServerClient();
  const { data } = await supabase.rpc("messages_per_day", {
    ws: workspaceId, days
  });
  return data ?? [];
}
```

Migración SQL helper (en `007_activities.sql` o aparte):

```sql
create or replace function public.messages_per_day(ws uuid, days int)
returns table(date date, whatsapp bigint, facebook bigint, instagram bigint)
language sql stable as $$
  select
    d::date as date,
    count(*) filter (where ch.type = 'whatsapp') as whatsapp,
    count(*) filter (where ch.type = 'facebook') as facebook,
    count(*) filter (where ch.type = 'instagram') as instagram
  from generate_series(current_date - days, current_date, '1 day') d
  left join public.messages m on date_trunc('day', m.created_at) = d
    and m.direction = 'in'
    and exists(select 1 from public.conversations c
               where c.id = m.conversation_id and c.workspace_id = ws)
  left join public.conversations c on c.id = m.conversation_id
  left join public.contact_channels cc on cc.id = c.contact_channel_id
  left join public.channels ch on ch.id = cc.channel_id
  group by d order by d;
$$;
```

---

## 14. Roadmap de implementación (Fases 0-9)

### Fase 0 · Andamiaje (~2h)

**Entregables:**
- Repo `wechat/` con `git init`
- `package.json` con todas las dependencias instaladas
- `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- `src/app/layout.tsx`, `src/app/page.tsx` (redirect a /login)
- `src/app/globals.css` con vars de Tailwind + tema base
- shadcn configurado, primeros componentes (`button`, `input`)
- `supabase init` + `supabase start` funcionando
- ESLint + Prettier + Vitest configurados (test smoke pasa)
- `.env.local.example` completo
- `src/lib/env.ts` con validación zod
- `README.md` con setup y roadmap

**Verificación:** `npm run dev` arranca, `npm run typecheck` pasa, `npm run test` corre un test dummy, abrir `localhost:3000` redirige a `/login` (que aún muestra placeholder).

### Fase 1 · Auth + Workspaces (~4h)

**Migración:** `001_init_workspaces.sql`

**Tareas:**
- `(auth)/login/page.tsx` + `login-form.tsx` + `actions.ts`
- `(auth)/signup/page.tsx` + `signup-form.tsx`
- `(auth)/forgot-password/page.tsx`
- `accept-invite/[token]/page.tsx`
- `(workspace)/layout.tsx` con sidebar + topbar (placeholders)
- `middleware.ts` con auth check + redirect
- `onboarding/page.tsx` (wizard mínimo, sin OAuth aún)
- Server action: signup crea workspace + membership owner

**Verificación:** signup → onboarding → dashboard (con mensaje "bienvenido") → signout → login → dashboard.

### Fase 2 · Canales Meta (~8h)

**Migración:** `002_channels.sql`

**Tareas:**
- `settings/channels/page.tsx` (lista vacía inicialmente)
- `settings/channels/components/channel-connect-dialog.tsx` con 3 tabs
- `oauth/meta/start/route.ts` + `callback/route.ts`
- `lib/channels/types.ts` + `whatsapp.ts` + `facebook.ts` + `instagram.ts`
- `lib/meta/verify-signature.ts` + `oauth.ts` + `normalize.ts`
- `api/webhooks/whatsapp/route.ts` (GET verification + POST signed)
- `api/webhooks/facebook/route.ts` y `instagram/route.ts` (mismo handler)
- `lib/crypto.ts`
- Lógica de `processInbound` (en `lib/channels/process.ts`)
- Suscripción a webhooks desde callback OAuth

**Verificación:** conectar WA real → enviar mensaje desde tu teléfono → ver en `webhook_events` → message en DB → aparece en `/inbox`.

### Fase 3 · Inbox (~10h)

**Migración:** `003_messaging.sql`

**Tareas:**
- `(workspace)/inbox/page.tsx` + `[conversationId]/page.tsx`
- Componentes `conversation-list`, `conversation-item`, `conversation-header`, `message-thread`, `message-bubble`, `reply-box`, `contact-detail-panel`
- `api/conversations/route.ts` + `[id]/route.ts` + `[id]/messages/route.ts` + `[id]/read/route.ts`
- Hooks `use-conversations`, `use-conversation`, `use-messages`, `use-realtime`
- Indicadores de estado (delivered/read) vía webhooks de status
- Adjuntos: upload a storage + enviar a Meta

**Verificación:** enviar y recibir mensajes por los 3 canales; tiempo real funciona entre 2 pestañas; asignar conversación; cambiar estado.

### Fase 4 · Contactos (~4h)

**Migración:** `004_contacts_extras.sql`

**Tareas:**
- `contacts/page.tsx` + tabla + filtros + drawer
- `contacts/[id]/page.tsx` (versión completa con edición)
- Modal "nuevo contacto" + dialog import CSV (papaparse)
- Acciones bulk (tag, delete)
- Multi-canal: vincular/desvincular `contact_channels`

**Verificación:** crear contacto manual, importar CSV de 100 filas, asignar tags, ver conversación desde el contacto.

### Fase 5 · Equipo (~2h)

**Tareas:**
- `team/page.tsx` con tablas
- `invite-dialog.tsx` con generación de token + email (Supabase Auth: signup link)
- `accept-invite/[token]` refinado (ya creado en fase 1, ahora funcional)
- Cambio de rol + quit member

**Verificación:** invitar a un email real → aceptar → aparece como agent; cambiar a admin; quit.

### Fase 6 · Automatizaciones (~8h)

**Migración:** `005_automations.sql`

**Tareas:**
- `automations/page.tsx` + tabla
- `automations/new/page.tsx` + `[id]/page.tsx` con editor
- Componentes `trigger-editor`, `step-editor`, `step-types`, `runs-log`
- `api/automations/*` endpoints
- `lib/automations/engine.ts` + `triggers.ts` + `steps.ts`
- `api/cron/automation-runner/route.ts`
- `vercel.json` con cron config

**Verificación:** crear automatización "keyword precio → send template + add tag + wait 5m → AI reply"; probarla con mensaje real; ver logs.

### Fase 7 · AI Agents (~8h)

**Migración:** `006_ai.sql`

**Tareas:**
- `ai-agents/page.tsx` + cards
- `ai-agents/[id]/page.tsx` con 4 tabs
- `api/ai/agents/*` + `ai/knowledge/*` + `ai/embed/route.ts`
- `lib/ai/providers.ts` + `chat.ts` + `knowledge.ts`
- Integración con reply box del inbox (botón "✨ Sugerir")
- Auto-reply con handoff logic
- Settings → AI: form para API keys

**Verificación:** configurar OpenAI key → crear agente → subir KB → probar en inbox con "Sugerir" → activar auto-reply → mandar mensajes y ver respuestas IA con handoff.

### Fase 8 · Dashboard (~2h)

**Migración:** añadir `messages_per_day` SQL function

**Tareas:**
- `dashboard/page.tsx` con todas las secciones
- Componentes `kpi-card`, `messages-chart`, `channels-donut`, `recent-conversations`, `activity-feed`
- Queries en `lib/dashboard/queries.ts`

**Verificación:** tras actividad real, dashboard muestra datos coherentes.

### Fase 9 · Polish (~6h)

**Tareas:**
- Dark mode (next-themes)
- Empty states ilustrados (lottie o svg simple) en inbox/contacts/automations/agents
- Loading skeletons (shadcn)
- Onboarding wizard pulido (3 pasos reales)
- Command palette (Cmd+K) con buscador global
- Error boundaries
- Tests críticos:
  - `crypto.test.ts` (encrypt/decrypt roundtrip)
  - `verify-signature.test.ts` (firma válida/inválida)
  - `automations/engine.test.ts` (flujo lineal, wait, branch, error)
  - `ai/chat.test.ts` (mock provider)
  - `meta/normalize.test.ts` (payloads reales de Meta)
  - `rate-limit.test.ts`
- README final con instrucciones completas + screenshots
- `docker-compose.yml` opcional (Supabase local + Next.js)
- Deploy Vercel

**Verificación final:** Lighthouse score > 90 en dashboard; tests pasan; deploy a Vercel funciona con env vars reales; conexión real con Meta.

---

## 15. Roadmap futuro

### v2 — Push + MCP

**Push Notifications (OneSignal):**
- Instalar `@onesignal/onesignal-web-push` en cliente
- Service worker `/public/sw.js`
- Manifest PWA
- Trigger SQL con `pg_net` → API OneSignal
- Toggle opt-in en `/settings/notifications`
- Migración `009_push.sql`
- Variables de entorno: `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`

**MCP server (`mcp-server/`):**
- Nuevo directorio hermano, Node.js standalone
- Tools expuestos:
  - `list_contacts` (filtros: name, tag, channel)
  - `search_conversations` (full-text)
  - `get_messages` (conversation_id, limit)
  - `send_message` (conversation_id, text) — requiere scope `write`
  - `create_contact` (name, channel, external_id)
  - `update_contact` (id, fields)
  - `add_tag` / `remove_tag`
  - `get_dashboard_stats`
  - `list_automations` (read-only)
- Auth: API key con scopes (read / write)
- Documentación en README

### v3 — Pipeline + API

**Pipeline / Kanban:**
- Migración `010_pipelines.sql` con `pipelines`, `pipeline_stages`, `deals`
- Página `/pipelines` con `@dnd-kit`
- Edición de etapas (drag para reordenar)
- Modal de deal (título, valor, contacto, fecha)
- Conexión deal ↔ conversation (link desde inbox)
- Dashboard: widget "valor en pipeline"

**Public REST API (`/api/v1`):**
- Migración `011_api_keys.sql` con `api_keys(id, workspace_id, name, scopes, hash, last_used_at, expires_at)`
- Endpoints públicos:
  - `POST /api/v1/messages` — enviar
  - `GET /api/v1/contacts` — listar
  - `POST /api/v1/contacts` — crear
  - `POST /api/v1/automations/{id}/trigger` — disparar
  - `GET /api/v1/conversations` — listar
- Documentación OpenAPI auto-generada
- Rate limit por key
- UI en `/settings/api-keys` para crear/revocar

---

## 16. Patrones a rescatar de wacrm

Cuando se implemente, revisar estos archivos en `wacrm/` para ideas (no copiar literal):

| Concepto | Archivo wacrm | Adaptar en wechat |
|---|---|---|
| Cifrado AES-256-GCM | `src/lib/encryption.ts` | `src/lib/crypto.ts` (sección 7.2) |
| Verificación firma Meta | `src/lib/whatsapp/webhook.ts` | `src/lib/meta/verify-signature.ts` |
| Server actions tipadas | `src/app/(dashboard)/.../actions.ts` | patrón general |
| RLS helpers | `src/lib/supabase/rls.ts` | `src/lib/supabase/server.ts` |
| Multi-tenant query pattern | `src/lib/queries.ts` | usar `user_workspace_ids()` |
| Inbox real-time | `src/lib/inbox/realtime.ts` | `src/hooks/use-realtime.ts` |

---

## 17. Convenciones de código

- **Naming:** PascalCase para componentes, camelCase para funciones/variables, snake_case para SQL.
- **Files:** kebab-case para nombres de archivo (`conversation-list.tsx`).
- **Imports:** usar alias `@/` siempre que sea posible.
- **Server vs Client:** default server components. Solo marcar `"use client"` cuando se necesite interactivity, state o effects.
- **Forms:** siempre `react-hook-form` + zod schema, nunca uncontrolled manual.
- **Server actions:** siempre en archivos `actions.ts` separados, validados con zod, con try/catch que devuelve `{ error }` o datos.
- **Errores:** toast con `sonner` para feedback inmediato; logs con `console.error` solo para debug server-side.
- **Estilos:** utility classes de Tailwind; evitar `<style>` inline. Usar `cn()` helper para clases condicionales.
- **Comentarios:** solo para "por qué", no para "qué". Si necesitas explicar qué hace, el código debería ser más claro.

---

## 18. Testing

- **Unit tests** (Vitest): funciones puras (crypto, normalize, engine, rate-limit, signature).
- **Integration tests**: flujos completos con Supabase local (`supabase start`).
- **NO mockear Supabase** — usar test database con seed.
- **Mocks para providers externos:** OpenAI, Anthropic, Meta API.
- **Coverage target:** ≥70% en `lib/`, sin覆盖率 obligatoria en componentes UI.
- **Una assertion por concepto**, no mega-tests.

Estructura:
```
src/lib/crypto.test.ts
src/lib/meta/verify-signature.test.ts
src/lib/meta/normalize.test.ts
src/lib/automations/engine.test.ts
src/lib/ai/knowledge.test.ts
src/lib/rate-limit.test.ts
```

---

## 19. Deploy

### Opción A — Vercel (recomendado)

1. Push del repo a GitHub
2. Importar en Vercel
3. Configurar env vars (panel de Vercel)
4. Crear proyecto Supabase (cloud, no local)
5. Aplicar migraciones: `supabase db push --db-url <production-url>`
6. Configurar app Meta en developers.facebook.com:
   - Tipo "Business"
   - Producto "WhatsApp" + "Messenger" + "Instagram"
   - Configurar OAuth redirect URI
   - Crear Embedded Signup config
7. Suscribir webhooks apuntando a `https://wechat.app/api/webhooks/{channel}`
8. Verificar cada webhook con GET challenge (solo WA)
9. Listo

### Opción B — Docker propio

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env.production
  # Supabase va aparte (supabase.com cloud o self-hosted)
```

---

## 20. Lista de comprobación pre-lanzamiento

- [ ] Todas las migraciones aplicadas en producción
- [ ] Variables de entorno configuradas en Vercel
- [ ] App Meta creada con productos WA + Messenger + Instagram
- [ ] OAuth redirect URI apuntando a producción
- [ ] Embedded Signup config probado
- [ ] Webhook URL configurada y verificada para los 3 canales
- [ ] ENCRYPTION_KEY generado con `openssl rand -base64 32`
- [ ] Al menos un canal conectado de prueba
- [ ] Mensaje de prueba recibido en /inbox
- [ ] Respuesta enviada y recibida por los 3 canales
- [ ] IA configurada con API key válida y KB con al menos 1 doc
- [ ] Auto-reply probado con handoff
- [ ] Una automatización creada y probada end-to-end
- [ ] Un invitado aceptado y con rol asignado
- [ ] Dark mode funcional
- [ ] Lighthouse > 90 en dashboard y inbox
- [ ] Tests pasan en CI
- [ ] README con instrucciones de setup
- [ ] Documentación de API para auto-hospedaje
- [ ] Plan de backup de DB (Supabase tiene automático en plan Pro)

---

## 🎯 TL;DR para arrancar

```bash
mkdir wechat && cd wechat
git init
npm init -y
# ... (sección 4.1 completa)
npm run dev
# Abre localhost:3000 → /login (placeholder) → empieza Fase 1
```

**Cuando arranques Fase 0, los primeros archivos a crear son:**
1. `package.json` (con todas las deps de la sección 2)
2. `tsconfig.json` (sección 4.3)
3. `next.config.ts` (sección 4.4)
4. `.env.local.example` (sección 5)
5. `src/lib/env.ts` (sección 5)
6. `src/app/layout.tsx` + `page.tsx` + `globals.css`
7. `tailwind.config.ts` + `postcss.config.mjs`
8. `components.json` (config shadcn)
9. `supabase/config.toml` (tras `supabase init`)
10. Primer test dummy para verificar Vitest

¡Éxito con Wechat! 🚀# Wechat — Plan completo de implementación

> CRM unificado para **WhatsApp + Facebook Messenger + Instagram DM**,
> auto-hospedable, multi-equipo, con IA y automatizaciones.
> Inspirado en `wacrm` pero ~5× más pequeño y multi-canal.
> Licencia: MIT.

---

## 0. Tabla de contenidos

1. Resumen ejecutivo
2. Stack tecnológico
3. Estructura del proyecto
4. Setup inicial (Fase 0)
5. Variables de entorno
6. Modelo de datos (Postgres / Supabase) — SQL completo
7. Patrones transversales (auth, RLS, cripto, realtime)
8. Integración Meta — los 3 canales
9. Páginas — especificación explícita página por página
10. Endpoints API
11. Motor de automatizaciones
12. AI Agents — diseño completo
13. Dashboard — queries y componentes
14. Roadmap de implementación (Fases 0-9)
15. Roadmap futuro (v2 y v3)
16. Patrones a rescatar de wacrm
17. Convenciones de código
18. Testing
19. Deploy
20. Lista de comprobación pre-lanzamiento

---

## 1. Resumen ejecutivo

**Wechat** es un CRM conversacional multi-canal que centraliza en una sola bandeja
los mensajes de **WhatsApp Business** (Meta Cloud API), **Facebook Messenger** y
**Instagram Direct**, con soporte para múltiples agentes por workspace,
automatizaciones no-code y un asistente de IA con knowledge base propia.

**Filosofía:** simple pero funcional. Evitar sobre-ingeniería. Cada feature tiene
un caso de uso real detrás. Lo que no se usa en 30 días, no se construye.

**Versiones:**
- **v1 (MVP):** inbox + contactos + equipos + automatizaciones + IA + dashboard + settings
- **v2:** Push notifications (OneSignal) + MCP server
- **v3:** Pipeline / Kanban + Public REST API

**Casos de uso principales:**
1. Equipo de atención al cliente respondiendo mensajes de los 3 canales desde
   una sola pantalla
2. Pequeñas empresas que necesitan un CRM sin pagar licencias por asiento
3. Equipos que usan IA para redactar respuestas o auto-responder FAQ
4. Cualquiera que quiera automatizaciones simples (palabra clave → respuesta)

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| Framework | Next.js | 15.x (App Router) | Estable, sin breaking changes de Next 16 |
| Runtime | Node.js | ≥20 | Requerido por Next 15 |
| Lenguaje | TypeScript | ≥5.4 | Tipado end-to-end |
| UI base | React | 19.x | Server components + server actions |
| Estilos | Tailwind CSS | v3.x | Estable, mejor tooling que v4 |
| Componentes | shadcn/ui | última | Copia-pega, sin opinionar diseño |
| Primitivos UI | Radix UI | última | Accesibilidad correcta |
| Iconos | lucide-react | última | Consistencia |
| Formularios | react-hook-form + zod | últimas | Validación tipada |
| Estado servidor | TanStack Query | v5 | Cache + revalidación |
| Notifs toast | sonner | última | Mínimo y bonito |
| Backend BaaS | Supabase | última | Postgres + Auth + Realtime + Storage |
| Cliente Supabase | @supabase/ssr + @supabase/supabase-js | últimas | Server + browser clients |
| Gráficos | Recharts | v2 | Buen balance peso/features |
| CSV parsing | papaparse | última | Estándar, robusto |
| Fechas | date-fns | última | Tree-shakeable |
| Utilidades | clsx + tailwind-merge | últimas | Composición de clases |
| AI SDK | openai + @anthropic-ai/sdk | últimas | BYOK, sin lock-in |
| Webhook cripto | (nativo Node) `crypto` | — | AES-256-GCM y HMAC-SHA256 |
| Validación env | zod + @t3-oss/env-nextjs | últimas | Tipar el .env |
| Tests | Vitest + @testing-library/react | últimas | Rápido, mismo ecosistema |
| Lint | ESLint + eslint-config-next + prettier + prettier-plugin-tailwindcss | últimas | Estándar Next.js |
| Deploy | Vercel | — | 1-click, gratis para hobby |

**NO usamos:**
- ❌ MCP server (v2)
- ❌ OneSignal web push (v2)
- ❌ xyflow / react-flow (no hay canvas visual)
- ❌ @dnd-kit (no hay Kanban en v1)
- ❌ opus-recorder (v1 = upload de archivos)
- ❌ web-push (v2)
- ❌ next-intl (i18n opcional futuro, empezamos solo en español)

---

## 3. Estructura del proyecto

```
wechat/
├── .env.local.example
├── .eslintrc.json
├── .gitignore
├── .prettierrc
├── components.json                  (config de shadcn)
├── docker-compose.yml               (opcional)
├── Dockerfile                       (opcional)
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── public/
│   ├── logo.svg
│   └── favicon.ico
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/
│       ├── 001_init_workspaces.sql
│       ├── 002_channels.sql
│       ├── 003_messaging.sql
│       ├── 004_contacts_extras.sql
│       ├── 005_automations.sql
│       ├── 006_ai.sql
│       ├── 007_activities.sql
│       └── 008_storage.sql
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx                  (redirect → /login o /dashboard)
    │   ├── (auth)/
    │   │   ├── layout.tsx
    │   │   ├── login/page.tsx
    │   │   ├── signup/page.tsx
    │   │   ├── forgot-password/page.tsx
    │   │   └── actions.ts
    │   ├── accept-invite/[token]/page.tsx
    │   ├── onboarding/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx              (wizard)
    │   │   └── actions.ts
    │   ├── (workspace)/
    │   │   ├── layout.tsx            (sidebar + topbar)
    │   │   ├── dashboard/page.tsx
    │   │   ├── inbox/
    │   │   │   ├── page.tsx          (lista sin conversación seleccionada)
    │   │   │   └── [conversationId]/page.tsx
    │   │   ├── contacts/
    │   │   │   ├── page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── automations/
    │   │   │   ├── page.tsx
    │   │   │   ├── new/page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── ai-agents/
    │   │   │   ├── page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── team/page.tsx
    │   │   └── settings/
    │   │       ├── page.tsx          (redirect → perfil)
    │   │       ├── profile/page.tsx
    │   │       ├── workspace/page.tsx
    │   │       ├── channels/page.tsx
    │   │       ├── ai/page.tsx
    │   │       └── notifications/page.tsx
    │   ├── api/
    │   │   ├── auth/callback/route.ts
    │   │   ├── webhooks/
    │   │   │   ├── whatsapp/route.ts
    │   │   │   ├── facebook/route.ts
    │   │   │   └── instagram/route.ts
    │   │   ├── oauth/meta/
    │   │   │   ├── start/route.ts
    │   │   │   └── callback/route.ts
    │   │   ├── conversations/
    │   │   │   ├── route.ts
    │   │   │   └── [id]/
    │   │   │       ├── route.ts
    │   │   │       ├── messages/route.ts
    │   │   │       ├── status/route.ts
    │   │   │       └── read/route.ts
    │   │   ├── contacts/
    │   │   │   ├── route.ts
    │   │   │   ├── import/route.ts
    │   │   │   └── [id]/route.ts
    │   │   ├── automations/
    │   │   │   ├── route.ts
    │   │   │   └── [id]/
    │   │   │       ├── route.ts
    │   │   │       ├── toggle/route.ts
    │   │   │       └── test/route.ts
    │   │   ├── ai/agents/
    │   │   │   ├── route.ts
    │   │   │   └── [id]/
    │   │   │       ├── route.ts
    │   │   │       └── chat/route.ts
    │   │   ├── ai/knowledge/
    │   │   │   ├── route.ts
    │   │   │   └── [id]/route.ts
    │   │   ├── ai/embed/route.ts
    │   │   ├── team/
    │   │   │   ├── members/route.ts
    │   │   │   └── invitations/route.ts
    │   │   ├── upload/route.ts
    │   │   └── cron/
    │   │       └── automation-runner/route.ts
    │   └── not-found.tsx
    ├── components/
    │   ├── ui/                       (componentes shadcn generados)
    │   ├── layout/
    │   │   ├── sidebar.tsx
    │   │   ├── topbar.tsx
    │   │   ├── command-palette.tsx
    │   │   └── notifications-bell.tsx
    │   ├── auth/
    │   │   ├── login-form.tsx
    │   │   ├── signup-form.tsx
    │   │   └── forgot-password-form.tsx
    │   ├── inbox/
    │   │   ├── conversation-list.tsx
    │   │   ├── conversation-item.tsx
    │   │   ├── conversation-header.tsx
    │   │   ├── message-thread.tsx
    │   │   ├── message-bubble.tsx
    │   │   ├── reply-box.tsx
    │   │   ├── contact-detail-panel.tsx
    │   │   ├── typing-indicator.tsx
    │   │   └── ai-suggest-button.tsx
    │   ├── contacts/
    │   │   ├── contacts-table.tsx
    │   │   ├── contact-drawer.tsx
    │   │   ├── contact-form.tsx
    │   │   └── csv-import-dialog.tsx
    │   ├── automations/
    │   │   ├── automations-table.tsx
    │   │   ├── trigger-editor.tsx
    │   │   ├── step-editor.tsx
    │   │   ├── step-types.tsx
    │   │   └── runs-log.tsx
    │   ├── ai/
    │   │   ├── agent-card.tsx
    │   │   ├── agent-form.tsx
    │   │   ├── knowledge-uploader.tsx
    │   │   └── test-chat.tsx
    │   ├── team/
    │   │   ├── members-table.tsx
    │   │   ├── invitations-table.tsx
    │   │   └── invite-dialog.tsx
    │   ├── settings/
    │   │   ├── profile-form.tsx
    │   │   ├── workspace-form.tsx
    │   │   ├── channels-manager.tsx
    │   │   ├── channel-connect-dialog.tsx
    │   │   ├── ai-keys-form.tsx
    │   │   └── notifications-form.tsx
    │   ├── dashboard/
    │   │   ├── kpi-card.tsx
    │   │   ├── messages-chart.tsx
    │   │   ├── channels-donut.tsx
    │   │   ├── recent-conversations.tsx
    │   │   └── activity-feed.tsx
    │   └── common/
    │       ├── empty-state.tsx
    │       ├── loading-skeleton.tsx
    │       ├── error-boundary.tsx
    │       └── confirm-dialog.tsx
    ├── hooks/
    │   ├── use-conversations.ts
    │   ├── use-conversation.ts
    │   ├── use-messages.ts
    │   ├── use-contacts.ts
    │   ├── use-automations.ts
    │   ├── use-ai-agents.ts
    │   ├── use-team.ts
    │   ├── use-workspace.ts
    │   └── use-realtime.ts
    ├── lib/
    │   ├── env.ts                    (validación con zod)
    │   ├── supabase/
    │   │   ├── server.ts             (server client con cookies)
    │   │   ├── browser.ts            (browser client)
    │   │   ├── middleware.ts         (refresh session)
    │   │   └── admin.ts              (service_role para server-only)
    │   ├── crypto.ts                 (AES-256-GCM helpers)
    │   ├── rls.ts                    (helpers para queries)
    │   ├── channels/
    │   │   ├── types.ts              (interfaz ChannelAdapter)
    │   │   ├── whatsapp.ts
    │   │   ├── facebook.ts
    │   │   └── instagram.ts
    │   ├── meta/
    │   │   ├── verify-signature.ts   (HMAC SHA256)
    │   │   ├── verify-webhook.ts     (GET challenge para WA)
    │   │   ├── oauth.ts              (Embedded Signup helpers)
    │   │   └── normalize.ts          (→ NormalizedMessage)
    │   ├── automations/
    │   │   ├── engine.ts             (runner principal)
    │   │   ├── triggers.ts           (evaluadores de trigger)
    │   │   ├── steps.ts              (funciones puras por step)
    │   │   └── types.ts
    │   ├── ai/
    │   │   ├── providers.ts          (clientes OpenAI/Anthropic)
    │   │   ├── chat.ts               (función principal)
    │   │   ├── knowledge.ts          (chunking + retrieval FTS)
    │   │   └── types.ts
    │   ├── utils.ts                  (cn(), formatDate, etc.)
    │   ├── rate-limit.ts             (en memoria, suficiente para v1)
    │   └── constants.ts              (roles, status, etc.)
    ├── types/
    │   ├── database.ts               (generado por supabase gen types)
    │   ├── api.ts
    │   └── domain.ts
    └── middleware.ts                 (auth check global)
```

---

## 4. Setup inicial (Fase 0)

### 4.1 Comandos a ejecutar

```bash
# Crear directorio y entrar
mkdir wechat && cd wechat
git init

# Init Next.js (sin create-next-app para tener control total)
npm init -y
npm install next@latest react@latest react-dom@latest
npm install -D typescript @types/node @types/react @types/react-dom
npm install -D eslint eslint-config-next prettier prettier-plugin-tailwindcss
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom

# Dependencias de app
npm install @supabase/ssr @supabase/supabase-js
npm install @tanstack/react-query
npm install react-hook-form @hookform/resolvers zod
npm install clsx tailwind-merge class-variance-authority
npm install lucide-react sonner
npm install recharts date-fns papaparse
npm install openai @anthropic-ai/sdk
npm install @t3-oss/env-nextjs

# Tailwind v3 + shadcn
npm install -D tailwindcss@^3 postcss autoprefixer
npx tailwindcss init -p
npx shadcn@latest init    # estilo: default, base color: slate
# Componentes shadcn que vamos a usar
npx shadcn@latest add button input label textarea select \
  dialog drawer dropdown-menu popover command \
  card badge avatar separator skeleton sonner \
  tabs switch checkbox radio-group form tooltip \
  alert progress sheet scroll-area

# Supabase CLI (para migrations y local dev)
npm install -D supabase
npx supabase init
npx supabase start
```

### 4.2 `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:types": "supabase gen types typescript --local > src/types/database.ts",
    "db:reset": "supabase db reset",
    "db:migrate": "supabase db push"
  }
}
```

### 4.3 `tsconfig.json` (Next 15 + path alias)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4.4 `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" }  // contacts avatars de Meta
    ]
  }
};

export default nextConfig;
```

---

## 5. Variables de entorno

`.env.local.example`:

```bash
# === App ===
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Wechat

# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-de-supabase>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>    # SOLO server-side, NUNCA al cliente

# === Cifrado ===
# Generar con: openssl rand -base64 32
ENCRYPTION_KEY=<base64-de-32-bytes>

# === Meta OAuth (Embedded Signup) ===
# Crear app en developers.facebook.com, tipo "Business"
META_APP_ID=<tu-app-id>
META_APP_SECRET=<tu-app-secret>
META_CONFIG_ID=<config-id-de-embedded-signup>     # WA + IG + FB a la vez
META_REDIRECT_URI=http://localhost:3000/api/oauth/meta/callback

# === Verificación de webhooks (opcional, recomendado) ===
META_WEBHOOK_VERIFY_TOKEN=<token-que-tu-elijas>  # WA lo usa en GET
# Las firmas HMAC se verifican con META_APP_SECRET

# === Cron (Vercel Cron) ===
CRON_SECRET=<token-secreto-para-proteger-endpoint>  # x-cron-secret header

# === AI (BYOK, opcionales; se pueden poner también en /settings/ai) ===
# Si están en env, se usan como fallback para todos los workspaces
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

`src/lib/env.ts`:

```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    ENCRYPTION_KEY: z.string().min(1),
    META_APP_SECRET: z.string().min(1),
    META_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional()
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_APP_NAME: z.string().default("Wechat"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    META_APP_ID: z.string().min(1),
    META_CONFIG_ID: z.string().min(1),
    META_REDIRECT_URI: z.string().url()
  },
  runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_CONFIG_ID: process.env.META_CONFIG_ID,
    META_REDIRECT_URI: process.env.META_REDIRECT_URI,
    META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
  }
});
```

---

## 6. Modelo de datos (Postgres / Supabase)

Total: **8 archivos de migración**, ~14 tablas. Todo con RLS.

### 6.1 `001_init_workspaces.sql`

```sql
-- Profiles (extiende auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Workspaces (tenant raíz)
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  default_currency text default 'USD' not null,
  onboarding_step int default 0 not null,  -- 0..3
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Memberships (muchos-a-muchos usuarios ↔ workspaces)
create type public.workspace_role as enum ('owner', 'admin', 'agent', 'viewer');

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role public.workspace_role not null default 'agent',
  created_at timestamptz default now() not null,
  unique(workspace_id, user_id)
);

-- Invitaciones pendientes
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  email text not null,
  role public.workspace_role not null default 'agent',
  token text unique not null,
  invited_by uuid references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now() not null
);

-- Trigger: crear profile al signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invitations enable row level security;

create policy "profiles_self" on public.profiles
  for all using (id = auth.uid());

create policy "workspaces_members_only" on public.workspaces
  for all using (
    exists(select 1 from public.workspace_members
           where workspace_id = workspaces.id and user_id = auth.uid())
  );

create policy "members_visible_to_members" on public.workspace_members
  for all using (
    exists(select 1 from public.workspace_members m
           where m.workspace_id = workspace_members.workspace_id
             and m.user_id = auth.uid())
  );

create policy "invitations_workspace_members" on public.invitations
  for all using (
    exists(select 1 from public.workspace_members
           where workspace_id = invitations.workspace_id and user_id = auth.uid())
  );

-- Helper: current user's workspaces
create or replace function public.user_workspace_ids()
returns setof uuid language sql stable security definer as $$
  select workspace_id from public.workspace_members where user_id = auth.uid();
$$;

-- Helper: user role in workspace
create or replace function public.user_role_in_workspace(p_workspace uuid)
returns public.workspace_role language sql stable security definer as $$
  select role from public.workspace_members
  where workspace_id = p_workspace and user_id = auth.uid();
$$;
```

### 6.2 `002_channels.sql`

```sql
create type public.channel_type as enum ('whatsapp', 'facebook', 'instagram');

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  type public.channel_type not null,
  external_id text not null,           -- phone_number_id | page_id | ig_business_account_id
  display_name text not null,
  access_token_enc bytea not null,     -- AES-256-GCM ciphertext (nonce + tag + ct)
  webhook_secret_enc bytea,            -- opcional, algunos canales lo requieren
  meta text,                            -- json libre (page name, ig username, etc.)
  status text default 'connected' not null,  -- connected | error | disconnected
  last_verified_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(workspace_id, type, external_id)
);

create index on public.channels(workspace_id);
create index on public.channels(type);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  type text not null,                  -- messages | status | oauth_callback
  processed boolean default false,
  payload jsonb not null,
  error text,
  received_at timestamptz default now() not null
);

create index on public.webhook_events(channel_id, received_at desc);
create index on public.webhook_events(received_at desc);

alter table public.channels enable row level security;
alter table public.webhook_events enable row level security;

create policy "channels_workspace_members" on public.channels
  for all using (
    exists(select 1 from public.workspace_members
           where workspace_id = channels.workspace_id and user_id = auth.uid())
  );

-- webhook_events: solo service_role (server-side)
-- No policy para usuarios normales → bloqueado por RLS
```

### 6.3 `003_messaging.sql`

```sql
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  full_name text,
  email text,
  phone_e164 text,                     -- normalizado a E.164
  avatar_url text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index on public.contacts(workspace_id);
create index on public.contacts(workspace_id, phone_e164);
create unique index on public.contacts(workspace_id, phone_e164)
  where phone_e164 is not null;

create table public.contact_channels (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade not null,
  channel_id uuid references public.channels(id) on delete cascade not null,
  external_user_id text not null,      -- psid (FB/IG) | wa_id (WA)
  profile jsonb default '{}'::jsonb not null,
  last_seen_at timestamptz,
  created_at timestamptz default now() not null,
  unique(channel_id, external_user_id)
);

create index on public.contact_channels(contact_id);

create type public.conversation_status as enum ('open', 'pending', 'closed');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  contact_channel_id uuid references public.contact_channels(id) on delete cascade not null,
  status public.conversation_status default 'open' not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz default now() not null,
  last_message_preview text,
  unread_count int default 0 not null,
  ai_agent_id uuid,                    -- FK se añade en 006_ai.sql
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(contact_channel_id)
);

create index on public.conversations(workspace_id, last_message_at desc);
create index on public.conversations(workspace_id, status);
create index on public.conversations(workspace_id, assigned_to);
create index on public.conversations(workspace_id, unread_count)
  where unread_count > 0;

create type public.message_direction as enum ('in', 'out');
create type public.message_type as enum (
  'text', 'image', 'video', 'audio', 'document',
  'template', 'interactive', 'reaction', 'story_reply', 'system'
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  external_id text,                    -- wamid | mid
  direction public.message_direction not null,
  type public.message_type default 'text' not null,
  text text,
  media_url text,
  media_mime text,
  template_id text,                    -- para WA templates
  template_vars jsonb,
  reactions jsonb default '[]'::jsonb not null,
  status text default 'sent',          -- queued | sent | delivered | read | failed
  error_code text,
  error_message text,
  raw_payload jsonb,
  sent_by uuid references public.profiles(id) on delete set null,  -- null = AI/bot
  created_at timestamptz default now() not null
);

create index on public.messages(conversation_id, created_at);
create index on public.messages(external_id) where external_id is not null;

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade not null,
  external_id text not null,           -- template name en Meta
  name text not null,
  language text not null,
  status text not null,                -- APPROVED | PENDING | REJECTED
  category text,
  components jsonb not null,
  last_synced_at timestamptz default now() not null,
  unique(channel_id, external_id, language)
);

alter table public.contacts enable row level security;
alter table public.contact_channels enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.templates enable row level security;

create policy "workspace_scoped" on public.contacts
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.contact_channels
  for all using (
    exists(select 1 from public.contacts c
           where c.id = contact_channels.contact_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );

create policy "workspace_scoped" on public.conversations
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.messages
  for all using (
    exists(select 1 from public.conversations c
           where c.id = messages.conversation_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );

create policy "workspace_scoped" on public.templates
  for all using (
    exists(select 1 from public.channels ch
           where ch.id = templates.channel_id
             and ch.workspace_id in (select public.user_workspace_ids()))
  );

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
```

### 6.4 `004_contacts_extras.sql`

```sql
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  color text default 'gray' not null,
  created_at timestamptz default now() not null,
  unique(workspace_id, name)
);

create table public.contact_tags (
  contact_id uuid references public.contacts(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (contact_id, tag_id)
);

create type public.custom_field_type as enum ('text', 'number', 'date', 'select', 'boolean');

create table public.custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  type public.custom_field_type not null,
  options text[],                       -- solo si type = 'select'
  created_at timestamptz default now() not null,
  unique(workspace_id, name)
);

create table public.custom_field_values (
  contact_id uuid references public.contacts(id) on delete cascade not null,
  field_id uuid references public.custom_field_defs(id) on delete cascade not null,
  value text not null,
  primary key (contact_id, field_id)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now() not null
);

create index on public.notes(contact_id, created_at desc);

alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.custom_field_defs enable row level security;
alter table public.custom_field_values enable row level security;
alter table public.notes enable row level security;

create policy "workspace_scoped" on public.tags
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "via_contact" on public.contact_tags
  for all using (
    exists(select 1 from public.contacts c
           where c.id = contact_tags.contact_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );

create policy "workspace_scoped" on public.custom_field_defs
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "via_contact" on public.custom_field_values
  for all using (
    exists(select 1 from public.contacts c
           where c.id = custom_field_values.contact_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );

create policy "via_contact" on public.notes
  for all using (
    exists(select 1 from public.contacts c
           where c.id = notes.contact_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );
```

### 6.5 `005_automations.sql`

```sql
create type public.automation_status as enum ('active', 'paused', 'draft');

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  description text,
  trigger jsonb not null,              -- ver sección 11
  steps jsonb not null default '[]'::jsonb,
  status public.automation_status default 'draft' not null,
  created_by uuid references public.profiles(id),
  last_run_at timestamptz,
  run_count int default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index on public.automations(workspace_id, status);

create type public.run_status as enum ('pending', 'running', 'succeeded', 'failed', 'cancelled');

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references public.automations(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  status public.run_status default 'pending' not null,
  current_step int default 0 not null,
  log jsonb default '[]'::jsonb not null,
  scheduled_at timestamptz,            -- para waits
  started_at timestamptz default now() not null,
  completed_at timestamptz
);

create index on public.automation_runs(automation_id, started_at desc);
create index on public.automation_runs(status, scheduled_at)
  where status = 'pending';

alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;

create policy "workspace_scoped" on public.automations
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.automation_runs
  for all using (workspace_id in (select public.user_workspace_ids()));
```

### 6.6 `006_ai.sql`

```sql
create extension if not exists vector with schema extensions;

create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  provider text not null check (provider in ('openai', 'anthropic')),
  model text not null,                 -- gpt-4o-mini | claude-3-5-sonnet-latest | etc
  system_prompt text not null,
  temperature numeric(3,2) default 0.7 not null,
  max_tokens int default 1024 not null,
  kb_enabled boolean default false not null,
  auto_reply_enabled boolean default false not null,
  max_replies_per_conversation int default 5 not null,
  handoff_keywords text[] default '{}'::text[] not null,
  is_default boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create unique index one_default_agent_per_workspace
  on public.ai_agents(workspace_id) where is_default;

create table public.ai_knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  agent_id uuid references public.ai_agents(id) on delete cascade not null,
  title text not null,
  source_url text,
  content text not null,
  tokens int,
  tsv tsvector generated always as (
    to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(content,''))
  ) stored,
  created_at timestamptz default now() not null
);

create index on public.ai_knowledge_docs using gin(tsv);
create index on public.ai_knowledge_docs(agent_id);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.ai_agents(id) on delete cascade not null,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tokens_in int,
  tokens_out int,
  latency_ms int,
  created_at timestamptz default now() not null
);

create index on public.ai_messages(conversation_id, created_at);

-- Ahora podemos añadir la FK pendiente
alter table public.conversations
  add constraint conversations_ai_agent_fk
  foreign key (ai_agent_id) references public.ai_agents(id) on delete set null;

-- Encrypted API keys (per-workspace)
create table public.ai_provider_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  provider text not null check (provider in ('openai', 'anthropic')),
  api_key_enc bytea not null,
  created_at timestamptz default now() not null,
  unique(workspace_id, provider)
);

alter table public.ai_agents enable row level security;
alter table public.ai_knowledge_docs enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_provider_keys enable row level security;

create policy "workspace_scoped" on public.ai_agents
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.ai_knowledge_docs
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.ai_messages
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.ai_provider_keys
  for all using (workspace_id in (select public.user_workspace_ids()));
```

### 6.7 `007_activities.sql`

```sql
create type public.activity_type as enum (
  'message_received', 'message_sent', 'conversation_assigned',
  'conversation_status_changed', 'contact_created', 'contact_updated',
  'automation_triggered', 'automation_completed', 'automation_failed',
  'agent_replied', 'agent_handoff'
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  type public.activity_type not null,
  actor_id uuid references public.profiles(id) on delete set null,
  subject_type text,                   -- contact | conversation | automation | agent
  subject_id uuid,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

create index on public.activities(workspace_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  body text,
  href text,
  metadata jsonb default '{}'::jsonb not null,
  read_at timestamptz,
  created_at timestamptz default now() not null
);

create index on public.notifications(user_id, created_at desc);
create index on public.notifications(user_id) where read_at is null;

alter table public.activities enable row level security;
alter table public.notifications enable row level security;

create policy "workspace_scoped" on public.activities
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "user_own" on public.notifications
  for all using (user_id = auth.uid());
```

### 6.8 `008_storage.sql`

```sql
-- Bucket para avatars, attachments, kb uploads
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('attachments', 'attachments', false),
  ('kb', 'kb', false);

-- Avatars: lectura pública, escritura solo authenticated
create policy "avatars_read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- Attachments y KB: solo miembros del workspace propietario del path
-- Path convention: {workspace_id}/{conversation_id}/{filename}
create policy "attachments_workspace" on storage.objects for all
  using (
    bucket_id in ('attachments', 'kb')
    and (storage.foldername(name))[1]::uuid in (select public.user_workspace_ids())
  );
```

---

## 7. Patrones transversales

### 7.1 Auth flow

```
Signup → Supabase auth.users → trigger crea profile
       → server action crea workspace + workspace_members(role=owner)
       → redirect /onboarding

Login → Supabase session en cookie (HTTP-only)
       → middleware refresca token en cada request
       → redirect a ?next=... o /dashboard
```

### 7.2 Cifrado AES-256-GCM

`src/lib/crypto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

const KEY = Buffer.from(env.ENCRYPTION_KEY, "base64");
const ALGO = "aes-256-gcm";

export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);   // 12 + 16 + N bytes
}

export function decrypt(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
```

Usado para:
- `channels.access_token_enc` (tokens de Meta)
- `ai_provider_keys.api_key_enc` (BYOK de los usuarios)
- Cualquier secreto que toquemos

### 7.3 Verificación de firma de webhooks Meta

```ts
// src/lib/meta/verify-signature.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false;
  if (!signatureHeader.startsWith("sha256=")) return false;
  const expected = signatureHeader.slice(7);
  const computed = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(computed, "hex"));
  } catch { return false; }
}
```

**WA usa** `X-Hub-Signature-256`.
**FB e IG usan** `X-Hub-Signature-256` también (mismo formato).

### 7.4 Realtime (Supabase)

```ts
// src/hooks/use-realtime.ts
import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function useConversationMessages(
  conversationId: string,
  onInsert: (msg: Message) => void
) {
  useEffect(() => {
    const supabase = createBrowserClient(/* ... */);
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages",
          filter: `conversation_id=eq.${conversationId}` },
        payload => onInsert(payload.new as Message))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);
}
```

### 7.5 Rate limiting (en memoria, suficiente para v1)

```ts
// src/lib/rate-limit.ts
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetIn: windowMs };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, resetIn: b.resetAt - now };
  }
  b.count++;
  return { ok: true, remaining: limit - b.count, resetIn: b.resetAt - now };
}
```

Aplicado en:
- Login (5/15min por IP)
- Signup (3/hora por IP)
- Webhook endpoints (no se limita, son Meta)
- AI endpoints (20/min por usuario)

### 7.6 Server actions con validación

```ts
"use server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

const Schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional()
});

export async function updateProfile(input: z.infer<typeof Schema>) {
  const data = Schema.parse(input);
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { error } = await supabase.from("profiles")
    .update({ full_name: data.name, email: data.email, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw error;
}
```

---

## 8. Integración Meta — los 3 canales

### 8.1 Interfaz común (`src/lib/channels/types.ts`)

```ts
export type NormalizedMessage = {
  channelType: "whatsapp" | "facebook" | "instagram";
  channelExternalId: string;        // phone_number_id | page_id | ig_user_id
  contactExternalId: string;       // wa_id | psid
  messageExternalId: string;
  type: "text" | "image" | "video" | "audio" | "document"
      | "template" | "interactive" | "reaction" | "story_reply";
  direction: "in";
  text?: string;
  mediaUrl?: string;
  mediaMime?: string;
  templateName?: string;
  templateVars?: Record<string, string>;
  raw: any;
  timestamp: Date;
};

export interface ChannelAdapter {
  type: "whatsapp" | "facebook" | "instagram";
  verifyWebhookGet(req: Request): Response | null;     // challenge (solo WA)
  verifyWebhookPost(rawBody: string, signature: string | null): boolean;
  parseInbound(payload: any): NormalizedMessage[];
  sendText(accessToken: string, fromExternalId: string,
           toExternalId: string, text: string): Promise<{ externalId: string }>;
  sendTemplate(accessToken: string, fromExternalId: string,
               toExternalId: string, templateName: string,
               language: string, variables: Record<string, string>): Promise<{ externalId: string }>;
  sendMedia(accessToken: string, fromExternalId: string,
             toExternalId: string, mediaUrl: string,
             mediaType: string, caption?: string): Promise<{ externalId: string }>;
  fetchContactProfile(accessToken: string,
                      externalUserId: string): Promise<{ name?: string; avatar?: string }>;
  fetchTemplates(accessToken: string,
                 externalId: string): Promise<Template[]>;
}
```

### 8.2 URLs y endpoints clave

| Acción | URL |
|---|---|
| Graph API base | `https://graph.facebook.com/v21.0/` |
| Send message (WA + FB + IG) | `POST {external_id}/messages` |
| Get user profile (FB) | `GET {user_id}?fields=first_name,last_name,profile_pic` |
| Get user profile (IG) | `GET {ig_user_id}?fields=name,profile_picture_url` |
| Get templates (WA) | `GET {waba_id}/message_templates` |
| Suscribirse a webhooks | `POST {app_id}/subscriptions?object=...` |

### 8.3 OAuth Embedded Signup flow

```
1. Usuario click "Conectar canal" en /settings/channels
2. Frontend abre ventana: https://www.facebook.com/v21.0/dialog/oauth?
     client_id=META_APP_ID&redirect_uri=...&response_type=code&config_id=META_CONFIG_ID
3. Usuario autoriza (Meta muestra UI para elegir páginas/cuentas)
4. Meta redirige a /api/oauth/meta/callback?code=XYZ
5. Backend intercambia code → access_token (Graph API)
6. Backend consulta /me/accounts y /me/instagram_accounts para listar
   los assets del usuario
7. Frontend muestra wizard para que elija cuáles conectar
8. Para cada uno: guardar channels row con access_token_enc
9. Suscribir webhook: POST {app_id}/subscriptions?
     object=instagram (cubre IG + FB) y object=whatsapp_business_account (para WA)
```

### 8.4 Webhook handler genérico

```ts
// /api/webhooks/whatsapp/route.ts (esqueleto)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(raw, signature, env.META_APP_SECRET)) {
    return new Response("Invalid signature", { status: 401 });
  }
  const payload = JSON.parse(raw);
  await processInbound("whatsapp", payload);
  return new Response("OK", { status: 200 });
}
```

`processInbound`:
1. Identifica `channel` por `payload.metadata.phone_number_id`
2. Normaliza → array de `NormalizedMessage`
3. Para cada uno: upsert `contact_channels`, upsert `contact`, upsert `conversation`, insert `messages`
4. Actualiza `conversations.last_message_at`, `last_message_preview`, `unread_count + 1`
5. Evalúa triggers de `automations` activos y crea `automation_runs` correspondientes
6. Si el agente IA por defecto tiene `auto_reply_enabled`, encola respuesta IA
7. Inserta `activities` y crea `notifications` para assigned user

---

## 9. Páginas — especificación explícita

### 9.1 `/login`

**Archivo:** `src/app/(auth)/login/page.tsx`
**Componente:** `src/components/auth/login-form.tsx`

**UI:** Card centrado (max-w-md), logo + nombre app arriba, título "Inicia sesión",
form con `email`, `password`, checkbox "Recordarme", botón "Iniciar sesión".

**Estados:**
- idle → form vacío, botón habilitado
- submitting → spinner en botón, campos disabled
- error → toast de sonner con mensaje ("Credenciales inválidas", "Demasiados intentos, espera 30s")
- success → redirect a `?next=...` o `/dashboard`

**Validación zod:**
- `email`: required, email válido
- `password`: required, min 1 char

**Rate limit:** 5 intentos / 15 min por IP (en server action).

**Server action** en `src/app/(auth)/actions.ts`:
```ts
"use server";
export async function loginAction(input: { email: string; password: string }) {
  // 1. rateLimit(ip, 5, 15*60*1000)
  // 2. supabase.auth.signInWithPassword({ email, password })
  // 3. Si OK: revalidatePath("/") y redirect(next ?? "/dashboard")
}
```

---

### 9.2 `/signup`

**Form:** `full_name`, `email`, `password`, `confirm_password`.

**Validación:**
- `full_name`: required, 2-100 chars
- `email`: required, email válido, único (lo valida Supabase)
- `password`: min 8, al menos 1 mayúscula, 1 número
- `confirm_password`: debe coincidir

**Flujo al éxito:**
1. `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
2. Trigger crea `profile` automáticamente
3. Server action adicional crea `workspaces` (nombre = "Workspace de {full_name}")
4. Crea `workspace_members(user, role=owner)`
5. Redirect `/onboarding`

---

### 9.3 `/forgot-password`

Input email + botón "Enviar enlace". Tras éxito, mensaje neutro:
"Si el email existe, te hemos enviado un enlace para restablecer tu contraseña."

---

### 9.4 `/accept-invite/[token]`

- Server component: busca invitación por token, si expiró o ya aceptada → mensaje de error
- Si el usuario ya está logueado: muestra preview + botones "Aceptar" / "Rechazar"
- Si no está logueado: muestra form de signup/login con email pre-rellenado; tras auth, automáticamente acepta la invitación

---

### 9.5 `/onboarding` (wizard)

**Paso 1** (route `?step=1`): Bienvenida
- Input nombre del workspace (default "Mi workspace")
- Upload logo (opcional)
- Zona horaria (select)
- Siguiente

**Paso 2** (route `?step=2`): Conecta un canal
- 3 cards grandes: WhatsApp · Facebook · Instagram (cada uno con icono y descripción corta)
- Click → abre `ChannelConnectDialog`
- "Saltar por ahora" link

**Paso 3** (route `?step=3`): Listo
- Card de éxito
- CTA "Ir al inbox" → `/inbox`

Estado persistido en `workspaces.onboarding_step` (0-3).

---

### 9.6 `/dashboard`

**Server component** que carga datos en paralelo:
- `getKpis(workspaceId)` → `{ openConversations, messagesToday, avgResponseMin, totalContacts, deltas }`
- `getMessagesPerDay(workspaceId, 14)` → `[{date, whatsapp, facebook, instagram}]`
- `getChannelsDistribution(workspaceId)` → `[{channel, count}]`
- `getRecentConversations(workspaceId, 5)`
- `getRecentActivity(workspaceId, 10)`

**Layout (grid):**
```
Row 1: [KPI 1] [KPI 2] [KPI 3] [KPI 4]      (4 cols desktop, 2 tablet, 1 mobile)
Row 2: [Messages line chart 14d] [Channels donut]
Row 3: [Recent conversations table] [Activity feed]
Row 4: [Quick actions row]
```

**KPI card:** título + número grande + delta vs semana anterior (▲ verde / ▼ rojo).

**Messages chart:** Recharts LineChart, eje X fechas, 3 líneas (WA verde, FB azul, IG rosa).

**Channels donut:** Recharts PieChart, leyenda interactiva.

**Recent conversations:** tabla compacta: avatar + nombre + último mensaje + canal icon + tiempo.

**Activity feed:** lista cronológica con iconos según tipo:
- 💬 "María respondió a Juan"
- 👤 "Nuevo contacto creado"
- 🤖 "IA respondió automáticamente"
- ⚙️ "Automatización 'Bienvenida' ejecutada"

---

### 9.7 `/inbox` — la pieza central ⭐

**Layout:** CSS grid `grid-cols-[320px_1fr_320px]` en desktop, oculta columnas en mobile.

**Componente top:** `src/components/layout/workspace-layout.tsx` envuelve todas las páginas privadas.

#### Columna 1 — Lista (`conversation-list.tsx`)

- **Header (sticky top):**
  - Tabs: `Todos` | `No leídos` (badge) | `Míos` | `Mención`
  - Botón filtros (popover): Canal (multi-checkbox), Estado (multi), Etiquetas (multi), Asignado
  - Search box

- **Lista virtualizada** (usar `react-window` o similar para >500 items):
  - Cada item (`conversation-item.tsx`):
    - Avatar 40px
    - Canal badge (esquina inferior derecha del avatar, según tipo)
    - Nombre + último preview (1 línea truncada)
    - Tiempo relativo
    - Badge unread (punto verde + número si >0)
    - Avatar del asignado (top right) si asignado a otro
  - Item activo: fondo gris
  - Click → router.push(`/inbox/{id}`)

- **Empty state:** ilustración + "No hay conversaciones" + "Esperando mensajes..."

#### Columna 2 — Conversación activa

- **Header:**
  - Avatar + nombre + canal icon
  - Estado (dropdown): Abierto | Pendiente | Cerrado
  - Asignado (dropdown con team members + "Sin asignar")
  - Botones derecha: panel contacto (toggle col 3), silenciar

- **Thread** (`message-thread.tsx`):
  - Separadores por día ("Hoy", "Ayer", "15 sept")
  - Auto-scroll al fondo al cargar nuevo mensaje (salvo si el usuario scrolleó arriba)
  - Agrupa mensajes consecutivos del mismo autor
  - Burbuja entrante (gris, izquierda) / saliente (color canal, derecha)
  - Renderizado por tipo (en `message-bubble.tsx`):
    - text: párrafo
    - image: thumbnail clickable → dialog lightbox
    - video: `<video controls>` con poster
    - audio: `<audio controls>` + duración
    - document: icon + filename + tamaño + download
    - template: header + body con vars resueltas
    - reaction: emoji flotante
  - Status indicators en salientes:
    - ✓ (gris): enviado
    - ✓✓ (gris): entregado
    - ✓✓ (azul): leído
    - ⚠️ (rojo): falló (hover muestra error)

- **Typing indicator:** "Escribiendo..." con animación, suscrito a broadcast channel

- **AI banner** (condicional): si `conversation.ai_agent_id` y auto-reply ON:
  ```
  ┌──────────────────────────────────────────────────┐
  │ 🤖 IA respondiendo automáticamente   [Tomar control] │
  └──────────────────────────────────────────────────┘
  ```

- **Reply box** (`reply-box.tsx`):
  - Textarea auto-resize (1-6 líneas)
  - Iconos izquierda: 📎 adjuntar (popover: imagen/video/documento) | 😀 emoji | 🎤 audio (placeholder v1 = "Próximamente")
  - Botón **Plantillas** (solo si canal = WhatsApp) → dialog con templates aprobados
  - Botón **✨ Sugerir con IA** → loading → inserta sugerencia en textarea
  - Botón **Enviar** (icono Send, deshabilitado si vacío)
  - Atajos: `Enter` envía, `Shift+Enter` nueva línea, `Cmd/Ctrl+K` command palette

- **Real-time:**
  - Nuevos mensajes (postgres_changes)
  - Cambios de status de mensajes propios (delivered/read)
  - Typing (broadcast)
  - Status de conversación (asignado, status)

#### Columna 3 — Detalle contacto (`contact-detail-panel.tsx`)

**Layout:** Card scrollable. Colapsable con botón.

- Avatar grande + nombre + email + teléfono
- **Canales vinculados:** chips con icono de cada canal (click → filtra conversaciones por ese canal-contacto)
- **Etiquetas:** chips coloreados + botón añadir
- **Campos personalizados:** lista k-v + botón añadir
- **Notas internas:** lista cronológica + textarea para nueva nota
- **Timeline:** eventos cronológicos (mensajes, cambios, automatizaciones)
- Botón "Ver perfil completo" → `/contacts/{id}`

---

### 9.8 `/contacts`

**Toolbar:**
- Search box (debounced, busca nombre/email/teléfono)
- Filtros: Canal (chips), Etiquetas (multi-select), Propietario (dropdown)
- Botones: **+ Nuevo contacto** (dialog), **Importar CSV** (dialog)

**Tabla** (`contacts-table.tsx`):
- Checkboxes para bulk actions
- Columnas: Avatar | Nombre | Canales (chips) | Email | Teléfono | Etiquetas (chips) | Último contacto | Propietario
- Click fila → drawer lateral (`contact-drawer.tsx`)
- Paginación 25/50/100
- Empty state: ilustración + CTA "Importa tus contactos o crea el primero"

**Acciones bulk:** Añadir etiqueta, Quitar etiqueta, Eliminar (confirm)

**`/contacts/[id]`** (o drawer en v1):
- Toda la info del panel 3 del inbox, editable
- Botones: Editar, Eliminar, Fusionar con otro contacto

**Modal nuevo contacto:**
- Nombre*
- Canal principal (radio: WA/FB/IG) — determina campos requeridos
- ID externo (label cambia: "Teléfono" / "PSID" / "IG user id")
- Email (opcional)
- Etiquetas (multi)
- Campos personalizados (dinámicos según custom_field_defs)
- Notas iniciales (opcional)

**CSV import dialog:**
- Paso 1: drag-drop archivo
- Paso 2: mapeo de columnas (selector por columna)
- Paso 3: preview de 5 filas
- Paso 4: confirmación + ejecutar (background, muestra progreso)

---

### 9.9 `/automations`

**Lista** (`automations-table.tsx`):
- Search + filtros: Estado (Activa/Pausada/Borrador), Disparador
- Botón **+ Nueva automatización**
- Tabla: Nombre | Disparador (legible) | Canales | Última ejecución | Estado (toggle) | Acciones
- Acciones por fila: Editar, Duplicar, Eliminar (confirm), Ver ejecuciones

**`/automations/new` y `/automations/[id]`** — editor lista-de-pasos

**Layout:** 2 columnas.

**Columna izquierda (60%):**
- Header: nombre (input) + descripción (textarea)
- Sección **Disparador** (`trigger-editor.tsx`):
  - Selector de tipo:
    - `Mensaje recibido` → canal (WA/FB/IG/todos) + match (keyword exacto | contiene | regex | cualquier) + valor
    - `Mensaje sin responder` → minutos + canal
    - `Contacto nuevo` → canal
    - `Etiqueta añadida` → tag
    - `Programado (cron)` → expresión + timezone
  - Live preview en lenguaje natural
- Sección **Pasos** (lista vertical):
  - Botón `+ Añadir paso` (al final)
  - Cada paso (`step-editor.tsx`):
    - Card colapsable con handle para arrastrar (reordenar)
    - Header: `[icon] Tipo — resumen corto`
    - Click expandir → form de configuración específico
  - Tipos de paso disponibles:
    1. `send_text`: textarea mensaje
    2. `send_template`: select template + vars por índice
    3. `send_media`: upload + caption
    4. `add_tag` / `remove_tag`: select tag
    5. `set_field`: select field + value
    6. `wait`: duration (min/h/d)
    7. `assign_to`: select user
    8. `set_status`: select status
    9. `close_conversation`: sin config
    10. `webhook`: URL + method + headers + body template (vars)
    11. `ai_reply`: select agent + optional handoff message
    12. `branch` (if/else): condición (campo operador valor) + dos ramas de sub-pasos
- Botón **Probar**: dialog → seleccionar contacto → dry-run (no envía, muestra qué haría)
- Botones footer: **Guardar borrador** | **Guardar y activar**

**Columna derecha (40%):**
- Mientras nada seleccionado: **Resumen en lenguaje natural** ("Cuando alguien envíe 'precio' por WhatsApp → enviar plantilla 'promo' → esperar 1h → añadir etiqueta 'lead caliente' → responder con IA")
- Con paso seleccionado: ayuda contextual + ejemplos + errores comunes
- Estadísticas de la automatización (si existe): ejecuciones hoy/semana/mes, tasa éxito, tiempo medio

**Tab/Modal ejecuciones:** tabla con últimas 50, expandable para ver step-by-step log.

---

### 9.10 `/ai-agents`

**Lista:**
- Grid 2 columnas de cards (`agent-card.tsx`)
- Cada card:
  - Nombre + badge modelo ("gpt-4o-mini" o "claude-3-5-sonnet")
  - Toggle Activo/Inactivo
  - "KB: X docs"
  - "Auto-reply: on/off"
  - Botón **Probar** (abre chat lateral)
- Botón **+ Nuevo agente**

**`/ai-agents/[id]`** — 4 tabs

**Tab 1 · Configuración** (`agent-form.tsx`)
- Nombre
- Proveedor (radio: OpenAI | Anthropic)
- Modelo (select dinámico según provider)
- System prompt (textarea grande, con helper mostrando placeholders disponibles: `{{contact_name}}`, `{{workspace_name}}`, `{{last_messages}}`)
- Temperatura (slider 0-1, default 0.7)
- Max tokens (input, default 1024)
- Habilitar KB (toggle)
- Auto-reply (toggle) — al activar, aparece warning sobre handoff
- Max replies por conversación (input, default 5)
- Handoff keywords (chips: "humano", "asesor", etc.)
- Es agente por defecto (toggle, único por workspace)

**Tab 2 · Knowledge Base** (`knowledge-uploader.tsx`)
- Lista de documentos (tabla): título | fuente | # palabras | fecha | acciones (eliminar)
- Botones: **+ Subir archivo** (PDF/TXT/MD), **+ Pegar texto**, **+ Añadir URL**
- Búsqueda en KB: input → muestra top 5 resultados con score
- Tras upload: chunking automático + FTS indexing + (si embedding key disponible) embeddings

**Tab 3 · Disparadores**
- Lista de canales donde el agente está activo (checkboxes)
- Si `auto_reply`: canales específicos para auto-reply
- Keyword overrides (lista: keyword → usar este agente en su lugar)
- Asignado por defecto (toggle)

**Tab 4 · Conversaciones de prueba** (`test-chat.tsx`)
- Chat mock: input + historial
- Después de cada respuesta: tokens consumidos (in/out), latencia, fuentes citadas

---

### 9.11 `/team`

**Sección 1: Miembros** (`members-table.tsx`)
- Tabla: Avatar | Nombre | Email | Rol (dropdown) | Última actividad | Acciones
- Cambiar rol: solo owner/admin pueden. Si el owner se intenta cambiar a otro rol, modal: "Promueve a otro owner primero"
- Quitar miembro: confirm dialog

**Sección 2: Invitaciones** (`invitations-table.tsx`)
- Tabla: Email | Rol | Enviada | Expira | Acciones (Reenviar, Cancelar)

**Botón:** `+ Invitar miembro` → dialog (`invite-dialog.tsx`):
- Email
- Rol
- Mensaje opcional (se incluye en el email)
- Botón "Enviar invitación" → genera token, envía email (Supabase Auth o servicio externo como Resend)

---

### 9.12 `/settings` — Tabs

#### `/settings/profile`
- Avatar (upload + crop con react-image-crop o similar)
- Nombre
- Email (read-only, con link "cambiar email" futuro)
- Sección cambiar contraseña (3 inputs)

#### `/settings/workspace`
- Nombre
- Logo
- Zona horaria
- Moneda por defecto
- Zona peligrosa: "Eliminar workspace" (input confirmación con palabra "ELIMINAR")

#### `/settings/channels` ⭐
**Server component** carga lista de canales.

- **Sección canales conectados:** cards (una por canal):
  - Icono + nombre + `external_id`
  - Status badge (Conectado/Error/Desconectado)
  - Última verificación (timestamp relativo)
  - Botón "Desconectar" (confirm)
  - Botón "Re-verificar"
- **Botón principal:** "Conectar nuevo canal" → abre `channel-connect-dialog.tsx`:
  - Tabs: WhatsApp | Facebook | Instagram
  - WA: opción A (OAuth Embedded Signup, recomendado) | opción B (manual: phone_number_id, waba_id, access_token, webhook_verify_token)
  - FB/IG: solo OAuth (UI de Meta)
  - Tras éxito: card nuevo canal aparece + opción "Probar" (envía mensaje al admin)
- **Sección debug:** últimos 50 `webhook_events` con status, payload resumido, botón "Re-procesar"

#### `/settings/ai`
- Form por proveedor (OpenAI, Anthropic):
  - Input password para API key
  - Botón "Guardar" → cifra y guarda en `ai_provider_keys`
  - Botón "Probar" → hace request dummy (`models.list()`)
  - Indicador de uso mensual estimado (suma de tokens en `ai_messages`)
- Modelo por defecto del workspace (select)
- Límite global de tokens/mes (input, soft warning)
- Toggle "Permitir a la IA ver historiales"

#### `/settings/notifications`
- Lista de eventos que generan notificación in-app:
  - Nuevo mensaje (toggle)
  - Mensaje asignado a mí (toggle, ON por defecto)
  - Automatización falló (toggle, ON)
  - IA necesita handoff (toggle, ON)
  - Nuevo contacto (toggle, OFF)
- Preview de cómo se ve la notif (card ejemplo)

---

## 10. Endpoints API — referencia completa

| Método | Path | Auth | Descripción |
|---|---|---|---|
| POST | `/api/webhooks/whatsapp` | firma Meta | Inbound WA |
| POST | `/api/webhooks/facebook` | firma Meta | Inbound FB |
| POST | `/api/webhooks/instagram` | firma Meta | Inbound IG (mismo que FB) |
| GET | `/api/webhooks/whatsapp` | — | Verification challenge WA |
| GET | `/api/oauth/meta/start` | session | Redirige a Meta OAuth |
| GET | `/api/oauth/meta/callback` | session | Recibe code, intercambia, redirige a settings |
| GET | `/api/conversations` | session | Lista paginada con filtros |
| GET | `/api/conversations/[id]` | session | Detalle |
| PATCH | `/api/conversations/[id]` | session | Update status/assigned |
| POST | `/api/conversations/[id]/messages` | session | Enviar mensaje |
| POST | `/api/conversations/[id]/read` | session | Marcar leído |
| GET | `/api/contacts` | session | Lista paginada con filtros |
| POST | `/api/contacts` | session | Crear |
| PATCH | `/api/contacts/[id]` | session | Editar |
| DELETE | `/api/contacts/[id]` | session | Eliminar (soft) |
| POST | `/api/contacts/import` | session | CSV import (background) |
| GET/POST | `/api/automations` | session | Lista/Crear |
| GET/PATCH/DELETE | `/api/automations/[id]` | session | Detalle/Editar/Borrar |
| POST | `/api/automations/[id]/toggle` | session | Pausar/Reanudar |
| POST | `/api/automations/[id]/test` | session | Dry-run |
| GET/POST | `/api/ai/agents` | session | Lista/Crear |
| GET/PATCH/DELETE | `/api/ai/agents/[id]` | session | Detalle/Editar/Borrar |
| POST | `/api/ai/agents/[id]/chat` | session | Test chat |
| POST | `/api/ai/knowledge` | session | Upload KB doc |
| DELETE | `/api/ai/knowledge/[id]` | session | Borrar doc |
| POST | `/api/ai/embed` | session | Generar embeddings de un doc |
| POST | `/api/team/invitations` | session | Crear invitación |
| DELETE | `/api/team/invitations/[id]` | session | Cancelar invitación |
| POST | `/api/team/members/[id]/role` | session | Cambiar rol |
| DELETE | `/api/team/members/[id]` | session | Quitar miembro |
| POST | `/api/upload` | session | Signed URL para storage |
| POST | `/api/cron/automation-runner` | `x-cron-secret` | Procesa runs pendientes con wait |

---

## 11. Motor de automatizaciones

### 11.1 Modelo JSON del trigger

```jsonc
// trigger.type: "message_received"
{
  "type": "message_received",
  "channel": "whatsapp",            // whatsapp | facebook | instagram | any
  "match": "keyword",               // exact | contains | regex | any
  "value": "precio",
  "caseSensitive": false
}
// trigger.type: "message_unanswered"
{ "type": "message_unanswered", "minutes": 30, "channel": "any" }
// trigger.type: "contact_created"
{ "type": "contact_created", "channel": "instagram" }
// trigger.type: "tag_added"
{ "type": "tag_added", "tagId": "uuid" }
// trigger.type: "schedule"
{ "type": "schedule", "cron": "0 9 * * *", "timezone": "Europe/Madrid" }
```

### 11.2 Modelo JSON de steps

```jsonc
[
  { "type": "send_text", "text": "Hola {{contact.name}}!" },
  { "type": "send_template", "templateId": "uuid", "vars": {"1": "{{contact.name}}"} },
  { "type": "add_tag", "tagId": "uuid" },
  { "type": "remove_tag", "tagId": "uuid" },
  { "type": "set_field", "fieldId": "uuid", "value": "VIP" },
  { "type": "wait", "duration": "1h" },                     // 5m | 30m | 1h | 1d
  { "type": "assign_to", "userId": "uuid" },
  { "type": "set_status", "status": "pending" },
  { "type": "close_conversation" },
  { "type": "webhook", "url": "https://...", "method": "POST",
    "headers": {"X-Token": "abc"}, "body": { "contact": "{{contact.id}}" } },
  { "type": "ai_reply", "agentId": "uuid", "handoffMessage": "Te paso con un humano" },
  { "type": "branch",
    "if": { "field": "tag", "operator": "has", "value": "uuid" },
    "then": [ ... ],          // sub-steps anidados
    "else": [ ... ]
  }
]
```

### 11.3 Contexto de ejecución

```ts
type RunContext = {
  run: AutomationRun;
  automation: Automation;
  workspace: Workspace;
  conversation?: Conversation;
  contact: Contact;
  contactChannel: ContactChannel;
  channel: Channel;
  triggerData: Record<string, any>;     // ej. texto del mensaje
  vars: Record<string, any>;            // acumulador entre steps
};
```

### 11.4 Engine

```ts
// src/lib/automations/engine.ts
export async function executeRun(runId: string) {
  const ctx = await loadContext(runId);
  if (ctx.run.status !== "pending") return;
  await updateRun(runId, { status: "running" });

  for (let i = ctx.run.current_step; i < ctx.automation.steps.length; i++) {
    const step = ctx.automation.steps[i];
    const stepStart = Date.now();
    try {
      const result = await runStep(step, ctx);
      await appendLog(runId, {
        step: i, type: step.type, status: "ok",
        duration_ms: Date.now() - stepStart, output: result
      });
      if (step.type === "wait") {
        // programa continuación
        await updateRun(runId, { current_step: i + 1,
          scheduled_at: addDuration(new Date(), step.duration), status: "pending" });
        return;
      }
    } catch (err) {
      await appendLog(runId, {
        step: i, type: step.type, status: "failed",
        duration_ms: Date.now() - stepStart, error: err.message
      });
      await updateRun(runId, { status: "failed", completed_at: new Date() });
      await notifyOnFailure(ctx);
      return;
    }
  }
  await updateRun(runId, { status: "succeeded", completed_at: new Date() });
  await updateAutomationStats(ctx.automation.id);
}
```

### 11.5 Trigger evaluation

Tras insert en `messages`, trigger SQL (no en v1, lo hacemos desde el webhook handler) evalúa `automations` activos y crea `automation_runs`:

```ts
async function evaluateTriggers(event: InboundEvent) {
  const active = await db.automations.findActive(event.workspace_id);
  for (const auto of active) {
    if (matches(auto.trigger, event)) {
      await db.runs.create({
        automation_id: auto.id,
        conversation_id: event.conversationId,
        status: "pending"
      });
      // ejecuta inmediatamente (no espera) salvo que el primer step sea wait
      await enqueueRun(auto.id);
    }
  }
}
```

### 11.6 Cron job

`/api/cron/automation-runner` (protegido con `x-cron-secret`):

```ts
export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== env.CRON_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  const pending = await db.runs.findPendingScheduled();    // status=pending AND scheduled_at <= now
  for (const run of pending) {
    await executeRun(run.id);
  }
  return Response.json({ processed: pending.length });
}
```

Configurar en Vercel Cron (`vercel.json`):
```json
{
  "crons": [
    { "path": "/api/cron/automation-runner", "schedule": "* * * * *" }
  ]
}
```

---

## 12. AI Agents — diseño completo

### 12.1 Chat function

```ts
// src/lib/ai/chat.ts
export async function generateAgentReply(args: {
  agent: AIAgent;
  contact: Contact;
  conversation: Conversation;
  messages: Message[];                 // últimos 20
}): Promise<{ content: string; tokens_in: number; tokens_out: number; latency_ms: number; sources: any[] }> {
  const apiKey = await getApiKey(args.agent.workspace_id, args.agent.provider);
  if (!apiKey) throw new Error("No API key for provider");

  const recentMsgs = args.messages.slice(-20).map(m => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.text || ""
  }));

  let sources: any[] = [];
  let systemPrompt = args.agent.system_prompt;

  if (args.agent.kb_enabled) {
    const lastUserMsg = recentMsgs.filter(m => m.role === "user").pop();
    if (lastUserMsg?.content) {
      const docs = await searchKnowledge(args.agent.id, lastUserMsg.content, 3);
      sources = docs;
      if (docs.length > 0) {
        systemPrompt += "\n\nKnowledge base (use only if relevant):\n" +
          docs.map(d => `- ${d.title}: ${d.content.slice(0, 500)}`).join("\n");
      }
    }
  }

  const start = Date.now();
  let reply: string;
  let tokens_in = 0, tokens_out = 0;

  if (args.agent.provider === "openai") {
    const openai = new OpenAI({ apiKey });
    const res = await openai.chat.completions.create({
      model: args.agent.model,
      temperature: args.agent.temperature,
      max_tokens: args.agent.max_tokens,
      messages: [
        { role: "system", content: substituteVars(systemPrompt, args.contact) },
        ...recentMsgs as any
      ]
    });
    reply = res.choices[0].message.content!;
    tokens_in = res.usage?.prompt_tokens ?? 0;
    tokens_out = res.usage?.completion_tokens ?? 0;
  } else {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model: args.agent.model,
      max_tokens: args.agent.max_tokens,
      system: substituteVars(systemPrompt, args.contact),
      messages: recentMsgs as any
    });
    reply = (res.content[0] as any).text;
    tokens_in = res.usage.input_tokens;
    tokens_out = res.usage.output_tokens;
  }

  return { content: reply, tokens_in, tokens_out, latency_ms: Date.now() - start, sources };
}
```

### 12.2 Handoff logic

```ts
// Antes de auto-responder
function shouldHandoff(agent: AIAgent, messages: Message[]): boolean {
  const lastUser = [...messages].reverse().find(m => m.direction === "in");
  if (!lastUser) return true;
  const text = (lastUser.text || "").toLowerCase();
  if (agent.handoff_keywords.some(k => text.includes(k.toLowerCase()))) return true;
  const aiReplies = messages.filter(m => m.direction === "out" && m.sent_by === null).length;
  if (aiReplies >= agent.max_replies_per_conversation) return true;
  return false;
}
```

### 12.3 Knowledge Base — chunking y FTS

```ts
// src/lib/ai/knowledge.ts
export function chunkDocument(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

export async function searchKnowledge(agentId: string, query: string, limit = 3) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("ai_knowledge_docs")
    .select("id, title, content")
    .eq("agent_id", agentId)
    .textSearch("tsv", query, { type: "websearch", config: "spanish" })
    .limit(limit);
  return data ?? [];
}
```

### 12.4 Flujo end-to-end de un mensaje entrante con auto-reply

```
1. Webhook llega → processInbound()
2. Insert messages + actualizar conversation
3. Evaluar triggers → encolar automation runs
4. Si la conversation tiene ai_agent_id y ese agent.auto_reply_enabled:
   a. Cargar últimos 20 mensajes
   b. shouldHandoff? → sí: marcar conversation para handoff humano, NOT stop
   c. generateAgentReply()
   d. Insert messages (direction=out, sent_by=null) con status='sent'
   e. channel.sendText() → actualizar external_id + status
   f. Insert ai_messages (tokens, latency)
   g. Insert activities + notifications
5. Realtime empuja a todos los clientes suscritos
```

---

## 13. Dashboard — queries

```ts
// src/lib/dashboard/queries.ts

export async function getKpis(workspaceId: string) {
  const supabase = createServerClient();
  const todayStart = startOfDay(new Date());
  const weekAgo = subDays(new Date(), 7);
  const prevWeek = subDays(new Date(), 14);

  const [{ count: openConv }, { count: msgsToday },
         { data: respTimes }, { count: contacts }] = await Promise.all([
    supabase.from("conversations").select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).neq("status", "closed"),
    supabase.from("messages").select("*", { count: "exact", head: true })
      .eq("direction", "in").gte("created_at", todayStart.toISOString())
      .eq("workspace_id", workspaceId),
    supabase.rpc("get_response_times", { ws: workspaceId, since: weekAgo.toISOString() }),
    supabase.from("contacts").select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
  ]);

  return { openConversations: openConv ?? 0, messagesToday: msgsToday ?? 0,
           avgResponseMin: average(respTimes), totalContacts: contacts ?? 0 };
}

export async function getMessagesPerDay(workspaceId: string, days = 14) {
  const supabase = createServerClient();
  const { data } = await supabase.rpc("messages_per_day", {
    ws: workspaceId, days
  });
  return data ?? [];
}
```

Migración SQL helper (en `007_activities.sql` o aparte):

```sql
create or replace function public.messages_per_day(ws uuid, days int)
returns table(date date, whatsapp bigint, facebook bigint, instagram bigint)
language sql stable as $$
  select
    d::date as date,
    count(*) filter (where ch.type = 'whatsapp') as whatsapp,
    count(*) filter (where ch.type = 'facebook') as facebook,
    count(*) filter (where ch.type = 'instagram') as instagram
  from generate_series(current_date - days, current_date, '1 day') d
  left join public.messages m on date_trunc('day', m.created_at) = d
    and m.direction = 'in'
    and exists(select 1 from public.conversations c
               where c.id = m.conversation_id and c.workspace_id = ws)
  left join public.conversations c on c.id = m.conversation_id
  left join public.contact_channels cc on cc.id = c.contact_channel_id
  left join public.channels ch on ch.id = cc.channel_id
  group by d order by d;
$$;
```

---

## 14. Roadmap de implementación (Fases 0-9)

### Fase 0 · Andamiaje (~2h)

**Entregables:**
- Repo `wechat/` con `git init`
- `package.json` con todas las dependencias instaladas
- `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- `src/app/layout.tsx`, `src/app/page.tsx` (redirect a /login)
- `src/app/globals.css` con vars de Tailwind + tema base
- shadcn configurado, primeros componentes (`button`, `input`)
- `supabase init` + `supabase start` funcionando
- ESLint + Prettier + Vitest configurados (test smoke pasa)
- `.env.local.example` completo
- `src/lib/env.ts` con validación zod
- `README.md` con setup y roadmap

**Verificación:** `npm run dev` arranca, `npm run typecheck` pasa, `npm run test` corre un test dummy, abrir `localhost:3000` redirige a `/login` (que aún muestra placeholder).

### Fase 1 · Auth + Workspaces (~4h)

**Migración:** `001_init_workspaces.sql`

**Tareas:**
- `(auth)/login/page.tsx` + `login-form.tsx` + `actions.ts`
- `(auth)/signup/page.tsx` + `signup-form.tsx`
- `(auth)/forgot-password/page.tsx`
- `accept-invite/[token]/page.tsx`
- `(workspace)/layout.tsx` con sidebar + topbar (placeholders)
- `middleware.ts` con auth check + redirect
- `onboarding/page.tsx` (wizard mínimo, sin OAuth aún)
- Server action: signup crea workspace + membership owner

**Verificación:** signup → onboarding → dashboard (con mensaje "bienvenido") → signout → login → dashboard.

### Fase 2 · Canales Meta (~8h)

**Migración:** `002_channels.sql`

**Tareas:**
- `settings/channels/page.tsx` (lista vacía inicialmente)
- `settings/channels/components/channel-connect-dialog.tsx` con 3 tabs
- `oauth/meta/start/route.ts` + `callback/route.ts`
- `lib/channels/types.ts` + `whatsapp.ts` + `facebook.ts` + `instagram.ts`
- `lib/meta/verify-signature.ts` + `oauth.ts` + `normalize.ts`
- `api/webhooks/whatsapp/route.ts` (GET verification + POST signed)
- `api/webhooks/facebook/route.ts` y `instagram/route.ts` (mismo handler)
- `lib/crypto.ts`
- Lógica de `processInbound` (en `lib/channels/process.ts`)
- Suscripción a webhooks desde callback OAuth

**Verificación:** conectar WA real → enviar mensaje desde tu teléfono → ver en `webhook_events` → message en DB → aparece en `/inbox`.

### Fase 3 · Inbox (~10h)

**Migración:** `003_messaging.sql`

**Tareas:**
- `(workspace)/inbox/page.tsx` + `[conversationId]/page.tsx`
- Componentes `conversation-list`, `conversation-item`, `conversation-header`, `message-thread`, `message-bubble`, `reply-box`, `contact-detail-panel`
- `api/conversations/route.ts` + `[id]/route.ts` + `[id]/messages/route.ts` + `[id]/read/route.ts`
- Hooks `use-conversations`, `use-conversation`, `use-messages`, `use-realtime`
- Indicadores de estado (delivered/read) vía webhooks de status
- Adjuntos: upload a storage + enviar a Meta

**Verificación:** enviar y recibir mensajes por los 3 canales; tiempo real funciona entre 2 pestañas; asignar conversación; cambiar estado.

### Fase 4 · Contactos (~4h)

**Migración:** `004_contacts_extras.sql`

**Tareas:**
- `contacts/page.tsx` + tabla + filtros + drawer
- `contacts/[id]/page.tsx` (versión completa con edición)
- Modal "nuevo contacto" + dialog import CSV (papaparse)
- Acciones bulk (tag, delete)
- Multi-canal: vincular/desvincular `contact_channels`

**Verificación:** crear contacto manual, importar CSV de 100 filas, asignar tags, ver conversación desde el contacto.

### Fase 5 · Equipo (~2h)

**Tareas:**
- `team/page.tsx` con tablas
- `invite-dialog.tsx` con generación de token + email (Supabase Auth: signup link)
- `accept-invite/[token]` refinado (ya creado en fase 1, ahora funcional)
- Cambio de rol + quit member

**Verificación:** invitar a un email real → aceptar → aparece como agent; cambiar a admin; quit.

### Fase 6 · Automatizaciones (~8h)

**Migración:** `005_automations.sql`

**Tareas:**
- `automations/page.tsx` + tabla
- `automations/new/page.tsx` + `[id]/page.tsx` con editor
- Componentes `trigger-editor`, `step-editor`, `step-types`, `runs-log`
- `api/automations/*` endpoints
- `lib/automations/engine.ts` + `triggers.ts` + `steps.ts`
- `api/cron/automation-runner/route.ts`
- `vercel.json` con cron config

**Verificación:** crear automatización "keyword precio → send template + add tag + wait 5m → AI reply"; probarla con mensaje real; ver logs.

### Fase 7 · AI Agents (~8h)

**Migración:** `006_ai.sql`

**Tareas:**
- `ai-agents/page.tsx` + cards
- `ai-agents/[id]/page.tsx` con 4 tabs
- `api/ai/agents/*` + `ai/knowledge/*` + `ai/embed/route.ts`
- `lib/ai/providers.ts` + `chat.ts` + `knowledge.ts`
- Integración con reply box del inbox (botón "✨ Sugerir")
- Auto-reply con handoff logic
- Settings → AI: form para API keys

**Verificación:** configurar OpenAI key → crear agente → subir KB → probar en inbox con "Sugerir" → activar auto-reply → mandar mensajes y ver respuestas IA con handoff.

### Fase 8 · Dashboard (~2h)

**Migración:** añadir `messages_per_day` SQL function

**Tareas:**
- `dashboard/page.tsx` con todas las secciones
- Componentes `kpi-card`, `messages-chart`, `channels-donut`, `recent-conversations`, `activity-feed`
- Queries en `lib/dashboard/queries.ts`

**Verificación:** tras actividad real, dashboard muestra datos coherentes.

### Fase 9 · Polish (~6h)

**Tareas:**
- Dark mode (next-themes)
- Empty states ilustrados (lottie o svg simple) en inbox/contacts/automations/agents
- Loading skeletons (shadcn)
- Onboarding wizard pulido (3 pasos reales)
- Command palette (Cmd+K) con buscador global
- Error boundaries
- Tests críticos:
  - `crypto.test.ts` (encrypt/decrypt roundtrip)
  - `verify-signature.test.ts` (firma válida/inválida)
  - `automations/engine.test.ts` (flujo lineal, wait, branch, error)
  - `ai/chat.test.ts` (mock provider)
  - `meta/normalize.test.ts` (payloads reales de Meta)
  - `rate-limit.test.ts`
- README final con instrucciones completas + screenshots
- `docker-compose.yml` opcional (Supabase local + Next.js)
- Deploy Vercel

**Verificación final:** Lighthouse score > 90 en dashboard; tests pasan; deploy a Vercel funciona con env vars reales; conexión real con Meta.

---

## 15. Roadmap futuro

### v2 — Push + MCP

**Push Notifications (OneSignal):**
- Instalar `@onesignal/onesignal-web-push` en cliente
- Service worker `/public/sw.js`
- Manifest PWA
- Trigger SQL con `pg_net` → API OneSignal
- Toggle opt-in en `/settings/notifications`
- Migración `009_push.sql`
- Variables de entorno: `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`

**MCP server (`mcp-server/`):**
- Nuevo directorio hermano, Node.js standalone
- Tools expuestos:
  - `list_contacts` (filtros: name, tag, channel)
  - `search_conversations` (full-text)
  - `get_messages` (conversation_id, limit)
  - `send_message` (conversation_id, text) — requiere scope `write`
  - `create_contact` (name, channel, external_id)
  - `update_contact` (id, fields)
  - `add_tag` / `remove_tag`
  - `get_dashboard_stats`
  - `list_automations` (read-only)
- Auth: API key con scopes (read / write)
- Documentación en README

### v3 — Pipeline + API

**Pipeline / Kanban:**
- Migración `010_pipelines.sql` con `pipelines`, `pipeline_stages`, `deals`
- Página `/pipelines` con `@dnd-kit`
- Edición de etapas (drag para reordenar)
- Modal de deal (título, valor, contacto, fecha)
- Conexión deal ↔ conversation (link desde inbox)
- Dashboard: widget "valor en pipeline"

**Public REST API (`/api/v1`):**
- Migración `011_api_keys.sql` con `api_keys(id, workspace_id, name, scopes, hash, last_used_at, expires_at)`
- Endpoints públicos:
  - `POST /api/v1/messages` — enviar
  - `GET /api/v1/contacts` — listar
  - `POST /api/v1/contacts` — crear
  - `POST /api/v1/automations/{id}/trigger` — disparar
  - `GET /api/v1/conversations` — listar
- Documentación OpenAPI auto-generada
- Rate limit por key
- UI en `/settings/api-keys` para crear/revocar

---

## 16. Patrones a rescatar de wacrm

Cuando se implemente, revisar estos archivos en `wacrm/` para ideas (no copiar literal):

| Concepto | Archivo wacrm | Adaptar en wechat |
|---|---|---|
| Cifrado AES-256-GCM | `src/lib/encryption.ts` | `src/lib/crypto.ts` (sección 7.2) |
| Verificación firma Meta | `src/lib/whatsapp/webhook.ts` | `src/lib/meta/verify-signature.ts` |
| Server actions tipadas | `src/app/(dashboard)/.../actions.ts` | patrón general |
| RLS helpers | `src/lib/supabase/rls.ts` | `src/lib/supabase/server.ts` |
| Multi-tenant query pattern | `src/lib/queries.ts` | usar `user_workspace_ids()` |
| Inbox real-time | `src/lib/inbox/realtime.ts` | `src/hooks/use-realtime.ts` |

---

## 17. Convenciones de código

- **Naming:** PascalCase para componentes, camelCase para funciones/variables, snake_case para SQL.
- **Files:** kebab-case para nombres de archivo (`conversation-list.tsx`).
- **Imports:** usar alias `@/` siempre que sea posible.
- **Server vs Client:** default server components. Solo marcar `"use client"` cuando se necesite interactivity, state o effects.
- **Forms:** siempre `react-hook-form` + zod schema, nunca uncontrolled manual.
- **Server actions:** siempre en archivos `actions.ts` separados, validados con zod, con try/catch que devuelve `{ error }` o datos.
- **Errores:** toast con `sonner` para feedback inmediato; logs con `console.error` solo para debug server-side.
- **Estilos:** utility classes de Tailwind; evitar `<style>` inline. Usar `cn()` helper para clases condicionales.
- **Comentarios:** solo para "por qué", no para "qué". Si necesitas explicar qué hace, el código debería ser más claro.

---

## 18. Testing

- **Unit tests** (Vitest): funciones puras (crypto, normalize, engine, rate-limit, signature).
- **Integration tests**: flujos completos con Supabase local (`supabase start`).
- **NO mockear Supabase** — usar test database con seed.
- **Mocks para providers externos:** OpenAI, Anthropic, Meta API.
- **Coverage target:** ≥70% en `lib/`, sin覆盖率 obligatoria en componentes UI.
- **Una assertion por concepto**, no mega-tests.

Estructura:
```
src/lib/crypto.test.ts
src/lib/meta/verify-signature.test.ts
src/lib/meta/normalize.test.ts
src/lib/automations/engine.test.ts
src/lib/ai/knowledge.test.ts
src/lib/rate-limit.test.ts
```

---

## 19. Deploy

### Opción A — Vercel (recomendado)

1. Push del repo a GitHub
2. Importar en Vercel
3. Configurar env vars (panel de Vercel)
4. Crear proyecto Supabase (cloud, no local)
5. Aplicar migraciones: `supabase db push --db-url <production-url>`
6. Configurar app Meta en developers.facebook.com:
   - Tipo "Business"
   - Producto "WhatsApp" + "Messenger" + "Instagram"
   - Configurar OAuth redirect URI
   - Crear Embedded Signup config
7. Suscribir webhooks apuntando a `https://wechat.app/api/webhooks/{channel}`
8. Verificar cada webhook con GET challenge (solo WA)
9. Listo

### Opción B — Docker propio

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env.production
  # Supabase va aparte (supabase.com cloud o self-hosted)
```

---

## 20. Lista de comprobación pre-lanzamiento

- [ ] Todas las migraciones aplicadas en producción
- [ ] Variables de entorno configuradas en Vercel
- [ ] App Meta creada con productos WA + Messenger + Instagram
- [ ] OAuth redirect URI apuntando a producción
- [ ] Embedded Signup config probado
- [ ] Webhook URL configurada y verificada para los 3 canales
- [ ] ENCRYPTION_KEY generado con `openssl rand -base64 32`
- [ ] Al menos un canal conectado de prueba
- [ ] Mensaje de prueba recibido en /inbox
- [ ] Respuesta enviada y recibida por los 3 canales
- [ ] IA configurada con API key válida y KB con al menos 1 doc
- [ ] Auto-reply probado con handoff
- [ ] Una automatización creada y probada end-to-end
- [ ] Un invitado aceptado y con rol asignado
- [ ] Dark mode funcional
- [ ] Lighthouse > 90 en dashboard y inbox
- [ ] Tests pasan en CI
- [ ] README con instrucciones de setup
- [ ] Documentación de API para auto-hospedaje
- [ ] Plan de backup de DB (Supabase tiene automático en plan Pro)

---

## 🎯 TL;DR para arrancar

```bash
mkdir wechat && cd wechat
git init
npm init -y
# ... (sección 4.1 completa)
npm run dev
# Abre localhost:3000 → /login (placeholder) → empieza Fase 1
```

**Cuando arranques Fase 0, los primeros archivos a crear son:**
1. `package.json` (con todas las deps de la sección 2)
2. `tsconfig.json` (sección 4.3)
3. `next.config.ts` (sección 4.4)
4. `.env.local.example` (sección 5)
5. `src/lib/env.ts` (sección 5)
6. `src/app/layout.tsx` + `page.tsx` + `globals.css`
7. `tailwind.config.ts` + `postcss.config.mjs`
8. `components.json` (config shadcn)
9. `supabase/config.toml` (tras `supabase init`)
10. Primer test dummy para verificar Vitest

¡Éxito con Wechat! 🚀