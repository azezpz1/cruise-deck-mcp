# Working in cruise-deck-mcp

This file gives Claude the context that isn't obvious from reading the code.

## What this is

An MCP server that answers questions about cruise ship cabins and deck plans —
e.g. "is cabin 8420 under the nightclub?", "what are the quietest balcony cabins
on Symphony of the Seas?". It runs on Cloudflare Workers, backed by a Supabase
Postgres database that's populated from extracted deck-plan PDFs/images.

## Stack at a glance

- Cloudflare Workers + Hono — Worker runtime and routing
- Supabase Postgres + Drizzle ORM — storage + schema/migrations
- Bun — package manager and runtime for ingestion scripts
- Node — runtime for the `wrangler` CLI only (see local-dev gotcha below)

## Local dev gotcha — wrangler doesn't work under bun

`bun run wrangler dev` (or `bunx wrangler dev`) starts workerd, binds the port,
and never serves requests. wrangler officially does not support being launched
under the bun runtime. Always invoke wrangler via `npx`:

```bash
npx wrangler dev
```

`bun` stays the package manager and is fine for everything else (ingestion
scripts, type-checking, drizzle-kit). Only the wrangler process needs node.

## MCP transport — manual JSON-RPC dispatch

`src/index.ts` does **not** use `@modelcontextprotocol/sdk`'s `McpServer` +
transport classes. Reason: the SDK's server is stateful (requires an
`initialize` handshake before responding to `tools/list` etc.), but a
Cloudflare Worker is stateless per request — each request gets a fresh server
that's never been initialized, so calls hang. The dispatch in `index.ts` is
hand-rolled JSON-RPC: `initialize`, `tools/list`, `tools/call`, `ping`.

If you want session-stateful MCP later, the right move is Cloudflare Durable
Objects (one DO instance per session_id) — not bringing back the SDK transport.

The SDK is still listed as a dependency because we'll lift its types when the
tool surface grows.

## Tools

Each tool lives in `src/tools/<name>.ts` and exports `{ name, description,
inputSchema, handler }`. JSON Schema is written by hand for the `inputSchema`;
zod is in deps for runtime arg validation when handlers stop being stubs.

## Status

Scaffolding only. The four tools all return `STUB:` text. Ingestion
(`ingestion/extract.ts`, `ingestion/seed.ts`) and noise scoring
(`src/scoring/noise-score.ts`) are explicit next phases — don't expand them
without the user asking.

## Conventions

- Drizzle schema in `src/db/schema.ts`; relations live in the same file.
- Migrations land in `migrations/` via `bun run db:generate`.
- MCP discovery served from both `/.well-known/mcp/server.json` (static file)
  and the same path on the Worker — keep them in sync if you change tool names.
