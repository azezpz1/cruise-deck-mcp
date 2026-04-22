// Deck plan extraction — to be implemented in a separate phase.
// Input: PDF / image of a cruise ship deck plan.
// Output: structured JSON conforming to src/db/schema.ts entities, ready for
// insertion via ingestion/seed.ts.
//
// Plan: send the image(s) to Claude (Anthropic API) with a structured prompt
// asking it to enumerate decks, cabins, and amenities with positions.

export async function extractDeckPlan(_path: string): Promise<unknown> {
  throw new Error("deck plan extraction not yet implemented");
}

if (import.meta.main) {
  console.error("ingestion/extract.ts: not yet implemented");
  process.exit(1);
}
