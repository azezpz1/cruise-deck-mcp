// Noise scoring algorithm — to be implemented in a separate phase.
// Inputs: a cabin and its adjacencies to noisy amenities (pools, theaters,
// nightclubs, elevators, engine rooms, etc.) along with relationship
// (above/below/adjacent/near) and distance scores.
//
// Output: a numeric quietness score and a breakdown of contributing factors.

export interface NoiseScore {
  cabinId: string;
  score: number;
  factors: Array<{
    amenityType: string;
    relationship: string;
    contribution: number;
  }>;
}

export function scoreCabin(_cabinId: string): NoiseScore {
  throw new Error("noise scoring not yet implemented");
}
