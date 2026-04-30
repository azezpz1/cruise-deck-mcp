# cruise-deck-mcp

MCP server for cruise ship deck plans and cabin noise analysis.

Given a ship and a cabin, answer questions like *"is this cabin under the
nightclub?"*, *"what are the quietest balcony cabins on Symphony of the Seas?"*,
or *"compare cabins 8420 and 9220."*

## Stack

- **Cloudflare Workers** (TypeScript) — MCP server runtime
- **Hono** — HTTP routing on the Worker
- **Supabase Postgres** — data storage
- **Drizzle ORM** — schema and migrations
- **Bun** — local package manager / runtime

## Layout

```
src/
  index.ts            Worker entry, MCP server wiring
  tools/              MCP tool handlers (stubs)
  db/                 Drizzle schema + Supabase client
  scoring/            Noise scoring logic (TBD)
ingestion/            PDF/image → structured data (TBD, runs locally)
migrations/           Drizzle-generated SQL migrations
.well-known/mcp/      MCP registry discovery
```

## Local development

```bash
bun install
cp .dev.vars.example .dev.vars   # fill in DATABASE_URL
npx wrangler dev                 # http://localhost:8787
```

> **Why `npx wrangler dev` and not `bun run dev`?** Wrangler does not support
> being launched under the Bun runtime — `workerd` binds the port but never
> serves requests. Run wrangler under Node (`brew install node`). Bun stays as
> the package manager and the runtime for the ingestion scripts.

Test the MCP endpoint:

```bash
curl -s http://localhost:8787/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Database

```bash
bun run db:generate   # generate SQL migration from schema.ts
bun run db:migrate    # apply pending migrations to DATABASE_URL
bun run db:studio     # open Drizzle Studio
```

### Migration workflow

Migrations are SQL files in `migrations/`, generated from `src/db/schema.ts` and
committed to the repo. A migration is applied to a database exactly once —
drizzle-kit tracks applied migrations in a `__drizzle_migrations` table.

**When making a schema change:**

1. Edit `src/db/schema.ts`.
2. Run `bun run db:generate`. This writes a new `migrations/NNNN_<name>.sql`
   plus a snapshot under `migrations/meta/`. Commit both.
3. Open a PR. Review the generated SQL — rename files are auto-detected but
   ambiguous renames may be generated as drop+create (data loss).
4. On merge to `main`, CI applies the migration (see below).

**Applying migrations:**

- **CI (production):** `.github/workflows/migrate.yml` runs `bun run db:migrate`
  on every push to `main` that touches `migrations/**` or `drizzle.config.ts`.
  The job runs in the `production` GitHub Environment — set the `DATABASE_URL`
  secret there, and add a required reviewer on the environment so migrations
  need an explicit approval click before they apply. Can also be triggered
  manually from the Actions tab (`workflow_dispatch`).
- **Local:** `bun run db:migrate` against your own Supabase project /
  `.dev.vars`. Avoid running this against the shared production database —
  let CI do it.

## Status

Scaffolding only. Tool handlers return stub responses. Ingestion pipeline and
noise scoring algorithm are separate phases.
