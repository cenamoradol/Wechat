# Wechat

CRM conversacional multi-canal para **WhatsApp + Facebook Messenger + Instagram DM**, auto-hospedable, multi-equipo, con IA y automatizaciones.

## Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage)
- **UI:** Tailwind CSS v3 + shadcn/ui + Radix UI
- **Estado:** TanStack Query v5
- **Forms:** react-hook-form + zod
- **AI:** OpenAI / Anthropic SDKs (BYOK)
- **Tests:** Vitest + Testing Library
- **Deploy:** Vercel

## Setup local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Edita `.env.local` y rellena:

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (de tu proyecto en supabase.com)
- `SUPABASE_SERVICE_ROLE_KEY` (del panel de Supabase)
- `ENCRYPTION_KEY` — genera con: `openssl rand -base64 32`
- Credenciales de Meta cuando llegues a Fase 2

### 3. Inicializar Supabase local (opcional, solo si no quieres cloud)

Si prefieres cloud, sáltate este paso y crea el proyecto directamente en [supabase.com](https://supabase.com).

```bash
npx supabase start
npx supabase db reset   # aplica todas las migraciones
```

### 4. Arrancar el dev server

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) → redirige a `/login` (placeholder en Fase 0).

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest (single run) |
| `npm run test:watch` | Vitest (watch) |
| `npm run format` | Prettier write |
| `npm run db:types` | Regenerar tipos desde Supabase |
| `npm run db:reset` | Reset DB local |
| `npm run db:migrate` | Aplicar migraciones a DB remota |

## Roadmap

Ver [`plan.md`](./plan.md) para el plan completo.

| Fase | Alcance | Tiempo |
|---|---|---|
| 0 | Setup inicial | ✅ |
| 1 | Auth + Workspaces | — |
| 2 | Canales Meta (WA + FB + IG) | — |
| 3 | Inbox (bandeja unificada) | — |
| 4 | Contactos + CSV import | — |
| 5 | Equipo + invitaciones | — |
| 6 | Automatizaciones + cron | — |
| 7 | AI Agents + KB | — |
| 8 | Dashboard | — |
| 9 | Polish + tests + deploy | — |

## Licencia

MIT