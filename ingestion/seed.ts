// Seed extracted, structured deck plan data into Supabase Postgres via Drizzle.
// To be implemented in a separate phase.

import { createDb } from "../src/db/client";

export async function seed(connectionString: string, _data: unknown) {
  const _db = createDb(connectionString);
  throw new Error("seed not yet implemented");
}

if (import.meta.main) {
  console.error("ingestion/seed.ts: not yet implemented");
  process.exit(1);
}
