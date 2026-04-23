import { Hono } from "hono";
import { sql } from "drizzle-orm";

import { createDb } from "./db/client";
import { getCabinInfo } from "./tools/get-cabin-info";
import { findQuietCabins } from "./tools/find-quiet-cabins";
import { compareCabins } from "./tools/compare-cabins";
import { getDeckLayout } from "./tools/get-deck-layout";

export interface Env {
  DATABASE_URL?: string;
}

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "cruise-deck-mcp", version: "0.1.0" };

const TOOLS = [getCabinInfo, findQuietCabins, compareCabins, getDeckLayout];
const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function ok(id: JsonRpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}

function err(id: JsonRpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

async function dispatch(req: JsonRpcRequest) {
  switch (req.method) {
    case "initialize":
      return ok(req.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case "tools/list":
      return ok(req.id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case "tools/call": {
      const name = req.params?.name as string | undefined;
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      const tool = name ? TOOL_BY_NAME.get(name) : undefined;
      if (!tool) return err(req.id, -32602, `Unknown tool: ${name}`);
      return ok(req.id, await tool.handler(args));
    }

    case "ping":
      return ok(req.id, {});

    default:
      return err(req.id, -32601, `Method not found: ${req.method}`);
  }
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) =>
  c.text("cruise-deck-mcp — POST JSON-RPC requests to /mcp"),
);

app.get("/.well-known/mcp/server.json", (c) =>
  c.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    description:
      "MCP server for cruise ship deck plans and cabin noise analysis",
    transport: { type: "http", endpoint: "/mcp" },
  }),
);

app.get("/health/db", async (c) => {
  const url = c.env.DATABASE_URL;
  if (!url) return c.json({ ok: false, error: "DATABASE_URL not set" }, 500);
  try {
    const db = createDb(url);
    const rows = await db.execute<{ ok: number }>(sql`select 1 as ok`);
    return c.json({ ok: rows[0]?.ok === 1 });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 500);
  }
});

app.post("/mcp", async (c) => {
  const body = (await c.req.json()) as JsonRpcRequest;

  // Notifications (no id) get acked with 202 and no body.
  if (body.id == null) return c.body(null, 202);

  const response = await dispatch(body);
  return c.json(response);
});

export default app;
