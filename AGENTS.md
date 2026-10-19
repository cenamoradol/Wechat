# AGENTS.md — Hibox (`C:\dev\wechat`)

AI-agent inbox for WhatsApp + Facebook Messenger + Instagram DM. Multi-tenant by
workspace, self-hostable. **Not a CRM.** Product was renamed Wechat → Hibox; the
folder, `plan.md`, and `SETUP_META.md` still say "Wechat".

## Commands

```bash
npm run dev          # next dev
npm run typecheck    # tsc --noEmit        <- works
npm test             # vitest run (14 files / 95 tests, ~40s)
npx vitest run src/lib/crypto.test.ts   # single file
npx vitest -t "loop guard"              # single test name
npm run format       # prettier --write . (100 cols, double quotes, semis)
```

**`npm run lint` is broken — do not report it as passing.** `next lint` was removed
in Next 16 and the script errors with `Invalid project directory provided ... \lint`.
`.eslintrc.json` is also legacy-format for ESLint 9 flat config. The real verification
pair is:

```
npm run typecheck && npm test
```

### Docs that lie about versions

`README.md` and `design-system/hibox/README.md` both say "Next.js 15". Installed is
**next 16.3.7**. Trust `package.json`. Consequences of v16 in this repo:

- Middleware was renamed. The auth gate is **`src/proxy.ts`** exporting `proxy()` —
  there is no `middleware.ts`. New public routes go in `PUBLIC_PATHS` /
  `WEBHOOK_PREFIXES` there; forgetting it means 302-to-login on a route that needs it.
- Tailwind is still **v3** (HSL CSS vars in `src/app/globals.css`), not v4.

## Architecture

### Supabase clients — pick deliberately

| Import                                            | Scope                                | RLS          |
| ------------------------------------------------- | ------------------------------------ | ------------ |
| `createClient()` from `@/lib/supabase/server`     | session cookie, Server Actions + RSC | enforced     |
| `createAdminClient()` from `@/lib/supabase/admin` | service role, bypasses the session   | **bypassed** |

Both are used inside the _same_ action file (e.g. `src/app/(workspace)/actions.ts`:
anon client to read the user, admin client to write). **Any `createAdminClient()` write
must do its own workspace/role check** — nothing enforces it for you.

### Active workspace

Not a URL segment and not React context. It's the httpOnly cookie
`active_workspace_id`, resolved by `getActiveWorkspaceId()` in
`src/app/(workspace)/actions.ts` (re-exported for other modules). It validates
membership and falls back to the user's earliest `workspace_members` row.

### Permissions

There is **no shared guard**. Each feature's `actions.ts` defines its own local
helper and must be copied into new features:

- `requireMember(["owner","admin","agent"])` — `automations/actions.ts`, `ai-agents/actions.ts`
- `requireMemberForConversation(conversationId, roles)` — `inbox/actions.ts`

Roles are `owner | admin | agent | viewer`.

### Route groups

- `src/app/(auth)/` — public; `login`, `signup`, `forgot-password`, `reset-password`
- `src/app/(workspace)/` — behind `proxy.ts`; its `layout.tsx` also bounces users with
  no `workspace_members` row to `/onboarding`
- `src/app/api/webhooks/*` + `src/app/api/cron/*` — public by design
- `src/app/api/debug/*` — see Risks

### Channels

`src/lib/channels/index.ts` → `getAdapter("whatsapp" | "facebook" | "instagram")`.
All three webhook routes parse with the adapter then funnel into
`processInbound` / `processOutboundStatuses` / `logWebhookEvent` in
`src/lib/channels/process.ts`. Put cross-channel logic there, not in a route.

Webhook routes must verify the `x-hub-signature-256` HMAC via
`src/lib/meta/verify-signature.ts` against `META_APP_SECRET` **before** `JSON.parse`.
Cron routes gate on `Authorization: Bearer ${CRON_SECRET}` — note
`.env.local.example` claims an `x-cron-secret` header, which is wrong.

Cron schedules live in `vercel.json` (`poll-messages` and `automation-runner` every
minute). Adding a cron route means adding it there too.

### Database

- Migrations: `supabase/migrations/NNN_name.sql`, next number is **023**. SQL is
  lowercase `create policy` / lowercase DDL — match that.
- Every table is RLS-scoped by `workspace_id` via `workspace_members`. There is a
  history of RLS recursion bugs (see `002`, `003`) — `workspace_members` policies are
  delicate, don't add a "see all members" policy casually.
- **`npm run db:types` requires the local Supabase stack running** (it uses `--local`)
  and rewrites the committed `src/types/database.ts`. Re-run it after every migration;
  typecheck will fail otherwise.

### Encryption / BYOK

`src/lib/crypto.ts` is AES-256-GCM, layout `iv(12) | tag(16) | ciphertext`.

- It reads `process.env.ENCRYPTION_KEY` **directly, not via `@/lib/env`** — t3-oss's
  "client-side access to server-side var" guard breaks under Vitest. Keep it that way.
- `bytea` columns must be written as `"\\x" + buf.toString("hex")`. postgrest-js will
  otherwise stringify the Buffer as a JSON object and GCM auth fails on read.
  See `getApiKey` / `saveApiKey` in `src/lib/ai/providers.ts`.
- New env vars go in `src/lib/env.ts` — both the zod schema **and** the explicit
  `runtimeEnv` block. `vitest.setup.ts` then needs a matching stub or every test fails.

## Tests

- Config `vitest.config.ts`: jsdom, globals on, setup file `./vitest.setup.ts`,
  alias `@` → `./src`.
- `vitest.setup.ts` loads `.env.local` then `.env` and backfills every required var,
  so **tests need no database and no real keys**. Don't add integration tests that
  assume a live Supabase.
- `automations/actions.test.ts` re-declares the Zod schemas locally rather than
  importing them ("use server" files can't be imported). If you change the automation
  step/trigger schemas in `automations/actions.ts`, **update the copy in that test**.

## Conventions

- Server Actions are `"use server"` files named `actions.ts`, colocated with the route.
  Validate with `zod.safeParse` first, `return { error }` — do not throw for
  expected failures. Call `revalidatePath()` after mutations.
- User-facing copy is **Spanish**.
- `ponytail:` and `shortcut:` comments mark deliberate trade-offs with hard-won
  reasoning (MiniMax base URLs, bytea hex encoding, RLS recursion). Read one before
  "fixing" it — several are load-bearing.
- Icons: Lucide only, never emoji. No raw hex in components.

### Design system

Source of truth: `design-system/hibox/MASTER.md` + `tokens.json`, mirrored in
`src/app/globals.css` and `tailwind.config.ts`.

**`MASTER.md` contradicts itself.** The YAML frontmatter is current
(_Terminal Nocturno_: dark-first `#0F0E0C`, amber `#F59E0B`, IBM Plex Sans + JetBrains
Mono, 8–12px radii). The prose below the frontmatter still describes the **old light
warm-cream / orange `#F97316` / Inter** direction. Trust frontmatter, `tokens.json`,
and `globals.css` — ignore the stale prose.

Dark-only: `:root` and `.dark` both carry the dark palette. AI pink `#EC4899` is
reserved exclusively for AI affordances; channel brand colors only as small badges.

Pre-flight before committing UI work:

```bash
node .agents/skills/design-taste-frontend/scripts/lint.mjs src/
```

## Risks (verified, unfixed)

- **`/api/debug/list-bms` and `/api/debug/find-system-user` are fully unauthenticated.**
  They are listed in `PUBLIC_PATHS` in `src/proxy.ts` _and_ have no `auth.getUser()`
  check in the route. The other six `/api/debug/*` routes do check. Delete these or
  move them out of `PUBLIC_PATHS`.
- No CI config in the repo — verification is whatever you run locally.
- `src/hooks/` exists and is empty.
