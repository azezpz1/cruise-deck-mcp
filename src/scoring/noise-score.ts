// Noise scoring algorithm — to be implemented in a separate phase.
// Inputs: a cabin and its `cabin_space_proximity` rows joined to `spaces`.
// Each row carries `vertical_decks` (signed deck offset) and
// `horizontal_distance` (point-to-bbox, 0–100), and the joined space supplies
// `noise_level` (0–100), `enclosed`, `open_to_above`, `open_to_below`.
//
// Output: a numeric quietness score and a breakdown of contributing factors.

export interface NoiseScore {
  cabinId: string;
  score: number;
  factors: Array<{
    spaceType: string;
    verticalDecks: number;
    horizontalDistance: number;
    contribution: number;
  }>;
}

export function scoreCabin(_cabinId: string): NoiseScore {
  throw new Error("noise scoring not yet implemented");
}
