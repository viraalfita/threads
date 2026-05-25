# ThreadLens

Threads content analytics + LLM insights. Single-user MVP per `PRD-threads-analytics.md`.

## Stack

- Next.js 14 App Router + TypeScript
- shadcn-style components on Radix UI + Tailwind v3
- Recharts (charts), next-themes (dark/light), sonner (toasts), lucide-react
- Supabase (PostgreSQL, schema `threadlens`) — accessed via service-role on the server only
- Threads Graph API — `threads_basic`, `threads_manage_insights`
- LLM via patunganai gateway (Anthropic Messages-compatible; gateway picks the model)
- Vercel Cron for incremental sync every 6h

## Setup

```bash
npm install
cp .env.local.example .env.local        # then fill in the blanks
openssl rand -hex 32                     # → TOKEN_ENCRYPTION_KEY
openssl rand -hex 24                     # → CRON_SECRET
openssl rand -hex 32                     # → MCP_BEARER_TOKEN (only needed for claude.ai Connector)
```

### Supabase

1. Open the SQL editor on your Supabase project and run `supabase/migrations/20260418000000_threadlens_init.sql`.
2. Add `threadlens` to `PGRST_DB_SCHEMAS` (Project Settings → API → Exposed schemas) and **Save**. PostgREST needs to know the schema exists.
3. Copy your `service_role` key into `SUPABASE_SERVICE_ROLE_KEY`.

### Meta / Threads app

Register a Meta Developer app with the **Threads** product enabled.
- App ID → `META_APP_ID`
- App Secret → `META_APP_SECRET`
- Redirect URI (must match Meta dashboard exactly) → `META_REDIRECT_URI=http://localhost:3000/api/auth/threads/callback`
- Permissions/scopes requested: `threads_basic`, `threads_manage_insights`, `threads_content_publish`
- `threads_content_publish` powers the Compose feature and needs **Advanced Access** (Meta App Review) before non-tester accounts can publish. Existing testers/admins can publish without review.

### LLM gateway

- API key → `LLM_GATEWAY_API_KEY` (patunganai gateway, Anthropic Messages-compatible)
- Optional URL override via `LLM_GATEWAY_URL`. The gateway selects the model itself.

## Run

```bash
npm run dev      # http://localhost:3000
```

1. Visit `/register` untuk membuat admin pertama (pendaftaran otomatis ditutup setelah ada 1 admin).
2. Setelah login, ke `/settings` → **Connect Threads** untuk OAuth.

## Sync

- **Manual:** the **Sync now** button on the dashboard / settings page.
- **Cron:** belum dipasang. Endpoint `/api/cron/sync` tersedia (guarded by `CRON_SECRET`) — bisa dipanggil manual atau dijadwalkan nanti.

## LLM analysis

- **Performance** (per post): open `/posts`, click a row → "Analisa dengan AI".
- **Pattern detection** (across posts): `/analysis` → choose period + sample size → Generate.

## Compose & publish

- `/compose` — write a post and publish it to Threads. Optional **Saranin draft** asks the LLM to draft variants grounded in your best-performing posts; you pick one, edit it, then press **Publish** (human-in-the-loop, no auto-posting). 500-char limit enforced.

Both calls go through the LLM gateway (`POST /api/analysis/{performance,pattern}`) and are persisted to `threadlens.llm_analysis`.

## MCP Connector (claude.ai)

ThreadLens exposes an MCP server at `POST /api/mcp` so the same compose+publish flow is available inside claude.ai's Custom Connectors.

### Setup

1. Generate a bearer token and put it in `.env.local`:
   ```bash
   openssl rand -hex 32      # → MCP_BEARER_TOKEN
   ```
2. Deploy (Vercel Pro recommended — needs `maxDuration: 120` for thread chains) or expose `localhost:3000` via a tunnel (`cloudflared tunnel`).
3. In claude.ai → **Settings → Connectors → Add custom connector**:
   - URL: `https://<your-domain>/api/mcp`
   - Auth: custom header `Authorization: Bearer <MCP_BEARER_TOKEN>`

### Tools

| Tool | Use |
|---|---|
| `list_accounts` | List connected Threads accounts. First account is the default. |
| `generate_draft` | Draft 1–5 variants grounded in that account's top posts. Default = multi-part thread. |
| `publish_thread` | Publish a post or thread chain. Side-effecting — claude.ai will ask for approval per call. |

All tools accept an optional `account` parameter (username, no `@`); omitted = default account.

### Resources (read-only inspect)

- `threadlens://{username}/posts/top` — top 10 posts by engagement rate.
- `threadlens://{username}/posts/recent` — 20 most recent posts.

## Out of scope (per PRD §7)

`scheduling`, `competitor analysis`, `multi-platform`, `mobile native`, `Idea Generator`, `Chat/Ask Anything`. Idea & Chat modes are slotted for a follow-up — see `lib/analysis/prompts.ts` to extend.

> **Note:** Auto-posting was originally out of scope. The MCP `publish_thread` tool re-introduces a publish path, but every call is consent-gated by claude.ai's Connector UI, so the human-in-the-loop guarantee is preserved.

## Project layout

```
app/
  api/auth/threads/...         OAuth start, callback, disconnect
  api/sync/route.ts            Manual sync trigger
  api/cron/sync/route.ts       Cron-driven sync (auth via secret)
  api/analysis/{performance,pattern}/route.ts
  page.tsx                     Dashboard
  posts/page.tsx               Post list (sortable + CSV export)
  posts/[id]/page.tsx          Post detail + Performance analysis
  analysis/page.tsx            Pattern detection + history
  settings/page.tsx            Connect / disconnect / sync state

components/
  ui/                          shadcn primitives
  dashboard/                   KPI cards, perf chart, period select, sync button
  posts/                       Post table
  analysis/                    Performance button, Pattern runner
  settings/                    Disconnect dialog
  sidebar-nav.tsx, topbar.tsx, theme-toggle.tsx, theme-provider.tsx, empty-connect.tsx

lib/
  env.ts                       Env loader with required-checks
  crypto.ts                    AES-256-GCM for access tokens
  supabase/server.ts           Service-role client (schema: threadlens)
  threads/api.ts               OAuth + Graph API client
  threads/types.ts
  user.ts                      getCurrentUser + token decryption helper
  sync.ts                      Initial + incremental sync logic
  llm/gateway.ts               chat() — patunganai gateway (Anthropic Messages)
  analysis/prompts.ts          Performance + Pattern + Compose prompt templates
  queries.ts                   Dashboard + post queries
  markdown.tsx                 Minimal markdown renderer for LLM output
  utils.ts                     cn(), formatters

supabase/migrations/
  20260418000000_threadlens_init.sql
```
