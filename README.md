# Tide

Open-publishing formation registry for [OpenReef](https://github.com/openreefai/openreef). Browse, search, publish, and install multi-agent formations.

**Live at [tide.openreef.ai](https://tide.openreef.ai)**

## What it does

Tide is the package registry for OpenReef formations. It handles:

- **Publishing** — Upload formation tarballs via the `reef publish` CLI command. Server-side extraction validates the manifest against the reef.json schema before accepting.
- **Installing** — `reef install <name>` resolves versions (exact, range, or latest), downloads with SHA-256 integrity verification, and deploys locally.
- **Searching** — Text search with optional semantic search via OpenAI embeddings (pg_vector).
- **Discovery** — Web UI for browsing formations by type, stars, downloads, or recency.
- **Authentication** — GitHub OAuth for the web UI, hashed API tokens for CLI access.

## Tech stack

- **Next.js 16** (App Router, server components, server actions)
- **Supabase** (PostgreSQL 17, Auth, Storage, RLS, RPC functions)
- **Tailwind CSS 4** (dark-mode-first)
- **pg_vector** (semantic search via OpenAI `text-embedding-3-small`)
- **Vitest** (unit + integration tests)

## Setup

### Prerequisites

- Node.js >= 18
- A Supabase project
- GitHub OAuth app (configured in Supabase dashboard)

### Local development

```bash
# Clone and install
git clone git@github.com:openreefai/tide.git
cd tide
npm install

# Configure environment
cp .env.example .env
# Fill in your Supabase URL, keys, and optional OpenAI key

# Start Supabase locally (optional — or point at a hosted project)
npx supabase start
npx supabase db push

# Run dev server
npm run dev
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `OPENAI_API_KEY` | No | Enables semantic search via embeddings |
| `CRON_SECRET` | Yes (prod) | Authenticates Vercel Cron cleanup requests |

### Database migrations

14 migrations in `supabase/migrations/`:

| Migration | Purpose |
|-----------|---------|
| 001 | Users table (synced from Supabase Auth), API tokens with hashed storage |
| 002 | Formations and formation_versions tables |
| 003 | Stars, formation_embeddings (pg_vector), reserved names |
| 004 | Row-Level Security policies |
| 005 | Private `tarballs` storage bucket |
| 006 | Transaction RPCs: publish_claim, publish_finalize, unpublish_version |
| 007 | increment_downloads, list_formations_by_stars RPCs |
| 008 | Embedding upsert and semantic search RPCs |
| 009 | RLS on formation_embeddings |
| 010 | Security hardening: REVOKE/GRANT on RPCs, in-function JWT guards |
| 011 | Semantic search support in star-sorted listings |
| 012 | Harden user trigger (multi-key fallback, ON CONFLICT, exception handler) |
| 013 | Wire repository_url through publish_claim, publish_finalize, and unpublish_version RPCs |
| 014 | Fix publish_claim record null check (IS NOT NULL -> FOUND) |

### Deploy to production

1. **Supabase**: Enable `vector` extension, push migrations (`npx supabase db push`), configure GitHub OAuth provider, set redirect URL to `https://tide.openreef.ai/auth/callback`
2. **Vercel**: Connect repo, set environment variables, add custom domain `tide.openreef.ai`
3. **DNS**: CNAME `tide` to `cname.vercel-dns.com`

The `vercel.json` configures a cleanup cron job that runs every 15 minutes to handle failed publishes.

## Architecture

```
Browser / CLI
     │
     ▼
  Next.js API Routes ──── Supabase Auth (GitHub OAuth)
     │                         │
     ├── Public reads ─────── Supabase (anon client, RLS enforced)
     │                         │
     ├── Writes ───────────── Supabase (service-role client)
     │   ├── publish_claim()      ← FOR UPDATE lock, optimistic concurrency
     │   ├── publish_finalize()   ← version count check, retry on conflict
     │   └── unpublish_version()  ← tombstone if last version
     │                         │
     └── Storage ─────────── Supabase Storage (private bucket, signed URLs)
```

**Security model**: Public reads go through the anon client with RLS. All writes use the service-role client with app-level authorization. Privileged RPCs are `SECURITY DEFINER` with EXECUTE revoked from `public` and re-granted only to `service_role`, plus in-function JWT verification as defense-in-depth.

**Publish flow**: CLI sends tarball → server extracts reef.json + README → validates schema → `publish_claim` (atomic name lock + version insert) → upload to storage → `publish_finalize` (optimistic concurrency with retry). Compensation logic cleans up on any failure.

## Tests

```bash
npm test          # 54 tests across 8 files
npm run test:watch
```

## CLI integration

Tide is the default registry for the [OpenReef CLI](https://github.com/openreefai/openreef):

```bash
reef login               # Authenticate with Tide (alias: reef token)
reef logout              # Remove stored credentials
reef whoami              # Check login status
reef publish             # Publish a formation
reef install <name>      # Install latest version
reef install <name>@1.2  # Install specific version or range
reef search <query>      # Search the registry
```

## License

MIT
