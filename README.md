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

## Status

Scaffolding only. Tool handlers return stub responses. Ingestion pipeline and
noise scoring algorithm are separate phases.
