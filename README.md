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
ingestion/            YAML → row-shaped data → seed (runs locally under Bun)
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

- **CI (production):** `.github/workflows/deploy.yml` runs `bun run db:migrate`
  as the first job on every push to `main` that touches the worker code,
  `migrations/**`, or `drizzle.config.ts`. The job runs in the `production`
  GitHub Environment — set the `DATABASE_URL` secret there, and add a required
  reviewer on the environment so migrations need an explicit approval click
  before they apply. Can also be triggered manually from the Actions tab
  (`workflow_dispatch`).
- **Local:** `bun run db:migrate` against your own Supabase project /
  `.dev.vars`. Avoid running this against the shared production database —
  let CI do it.

## Production deployment

The Worker reads `DATABASE_URL` from a Cloudflare secret binding (the same name
as the local `.dev.vars` key). Once set, it's available on `env` inside the
Worker — `src/index.ts` exposes it as `c.env.DATABASE_URL` and consumes it from
`/health/db`.

### One-time secret setup

Push the Supabase Transaction-pooler URL to the production Worker:

```bash
npx wrangler secret put DATABASE_URL
# paste the connection string when prompted
```

Or non-interactively (don't leave the value in shell history):

```bash
printf '%s' "$DATABASE_URL" | npx wrangler secret put DATABASE_URL
```

Inspect / rotate:

```bash
npx wrangler secret list
npx wrangler secret put DATABASE_URL     # overwrites if it exists
npx wrangler secret delete DATABASE_URL
```

Verify the binding is reachable from the deployed Worker:

```bash
curl -s https://<worker-host>/health/db
# {"ok":true}
```

### CI deploys

`.github/workflows/deploy.yml` runs on every push to `main` that touches
worker code, migrations, or related config. It has two jobs in sequence:
`migrate` (drizzle-kit migrate) and `deploy` (typecheck + `wrangler deploy`),
with `deploy` gated on `needs: migrate`. This guarantees a new schema is in
place before code that depends on it ships — and since drizzle-kit tracks
applied migrations, the migrate job is a no-op when nothing has changed.

Wrangler authenticates non-interactively from two repository secrets:

| Secret | Source |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens. Use the **Edit Cloudflare Workers** template, scoped to the account that owns this Worker. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages overview (right sidebar). |

Both jobs run under the `production` GitHub Environment, so each one prompts
for approval if reviewers are configured (one click for migrate, one for
deploy). `DATABASE_URL` is set on the environment for the migrate job; the
Worker's runtime `DATABASE_URL` is **not** in GitHub — it lives only in
Cloudflare's secret store (set via `wrangler secret put` above) and is bound
at runtime.

`workflow_dispatch` is enabled, so you can also trigger the pipeline manually
from the Actions tab.

## Ingestion

Deck plans are encoded as YAML under `data/ships/<slug>/` — one `ship.yaml`
plus one `deck-<n>.yaml` per passenger deck. The contract Claude follows when
encoding from a screenshot is `docs/data-schema.md`.

`ingestion/normalize.ts` is the thin layer between the YAML and the database:
it validates each file, maps to row-shaped output for `ships`, `decks`,
`cabins`, `spaces`, and derives `cabin_space_proximity` rows by computing
point-to-bbox euclidean distance from each cabin to spaces on nearby decks
(`|vertical_decks| ≤ 3`, `horizontal_distance ≤ 30`). Run it standalone to
inspect the output for a single ship:

```bash
bun run ingestion/normalize.ts data/ships/<slug>
```

The seed script (`ingestion/seed.ts`) consumes this output and writes to
Supabase. It's a separate phase — see issue #8.

## Status

Scaffolding plus a normalization layer. Tool handlers still return stub
responses. The seed script and the noise scoring algorithm are the next
phases.
