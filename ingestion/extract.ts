// V1 of this project does NOT use an automated extractor. Deck plans are
// encoded interactively: the user pastes a deck screenshot in chat, Claude
// emits per-deck YAML matching `docs/data-schema.md`, and the user commits
// it under `data/ships/<slug>/`. This file is kept as a placeholder for a
// future automated path (e.g. Claude API + structured prompt) but is not
// part of the v1 ingestion pipeline.

export async function extractDeckPlan(_path: string): Promise<unknown> {
  throw new Error("deck plan extraction not yet implemented");
}

if (import.meta.main) {
  console.error("ingestion/extract.ts: not yet implemented");
  process.exit(1);
}
