// Normalize per-ship YAML (matching docs/data-schema.md) into row-shaped
// output the seed script writes to the database. Ships, decks, cabins, and
// spaces map ~1:1 from YAML; cabin_space_proximity rows are derived here by
// scanning each cabin against spaces on nearby decks.
//
// FK references between rows use natural keys (deck number, cabin number,
// space localIndex within its deck) rather than UUIDs — those are generated
// by Postgres at insert time. The seed script resolves natural keys to UUIDs
// after each table is inserted.

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as yaml from "yaml";
import { z } from "zod";

const cabinCategorySchema = z.enum([
  "interior",
  "oceanview",
  "balcony",
  "suite",
]);

const spaceTypeSchema = z.enum([
  "nightclub",
  "live_music_venue",
  "theater",
  "showroom",
  "arcade",
  "casino",
  "bar",
  "lounge",
  "pool",
  "splash_zone",
  "waterslide",
  "kids_club",
  "teen_club",
  "sports_court",
  "atrium",
  "main_dining_room",
  "specialty_dining",
  "buffet",
  "cafe",
  "shops",
  "photo_studio",
  "reception",
  "guest_services",
  "spa",
  "gym",
  "library",
  "chapel",
  "conference_room",
  "lecture_hall",
  "art_gallery",
  "observation_lounge",
  "medical",
  "adults_only_lounge",
  "elevator_bank",
  "stairs",
  "corridor",
  "crew_area",
  "galley",
  "mechanical",
  "laundry",
  "restroom",
  "storage",
  "open_deck",
  "sun_deck",
  "promenade",
  "jogging_track",
  "helipad",
  "other",
]);

export type CabinCategory = z.infer<typeof cabinCategorySchema>;
export type SpaceType = z.infer<typeof spaceTypeSchema>;

const pct = z.number().min(0).max(100);

const bboxTuple = z
  .tuple([pct, pct])
  .refine(([min, max]) => min <= max, {
    message: "bbox tuple must be [min, max] with min <= max",
  });

const shipYamlSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  cruise_line: z.string().min(1),
  class: z.string().optional(),
  gross_tonnage: z.number().int().optional(),
  year_built: z.number().int().optional(),
  length_m: z.number().optional(),
  beam_m: z.number().optional(),
  deck_count: z.number().int().min(1),
  notes: z.string().optional(),
});

const cabinYamlSchema = z.object({
  number: z.string().min(1),
  category: cabinCategorySchema,
  fore_aft: pct,
  port_starboard: pct,
  accessible: z.boolean().optional().default(false),
  connecting: z.boolean().optional().default(false),
  obstructed_view: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

const spaceYamlSchema = z.object({
  type: spaceTypeSchema,
  name: z.string(),
  fore_aft: bboxTuple,
  port_starboard: bboxTuple,
  enclosed: z.boolean(),
  noise_level: z.number().int().min(0).max(100),
  open_to_above: z.boolean().optional().default(false),
  open_to_below: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

const deckYamlSchema = z.object({
  deck: z.number().int(),
  name: z.string().optional(),
  passenger: z.boolean(),
  notes: z.string().optional(),
  cabins: z.array(cabinYamlSchema).optional().default([]),
  spaces: z.array(spaceYamlSchema).optional().default([]),
});

export type ShipRow = {
  slug: string;
  name: string;
  cruiseLine: string;
  class: string | null;
  grossTonnage: number | null;
  yearBuilt: number | null;
  lengthM: number | null;
  beamM: number | null;
  deckCount: number;
  notes: string | null;
};

export type DeckRow = {
  deckNumber: number;
  name: string | null;
  passenger: boolean;
};

export type CabinRow = {
  deckNumber: number;
  number: string;
  category: CabinCategory;
  foreAft: number;
  portStarboard: number;
  accessible: boolean;
  connecting: boolean;
  obstructedView: boolean;
  notes: string | null;
};

export type SpaceRow = {
  deckNumber: number;
  localIndex: number;
  type: SpaceType;
  name: string;
  foreAftMin: number;
  foreAftMax: number;
  portStarboardMin: number;
  portStarboardMax: number;
  enclosed: boolean;
  noiseLevel: number;
  openToAbove: boolean;
  openToBelow: boolean;
  notes: string | null;
};

export type ProximityRow = {
  cabinDeckNumber: number;
  cabinNumber: string;
  spaceDeckNumber: number;
  spaceLocalIndex: number;
  verticalDecks: number;
  horizontalDistance: number;
};

export type NormalizedShipData = {
  ship: ShipRow;
  decks: DeckRow[];
  cabins: CabinRow[];
  spaces: SpaceRow[];
  proximity: ProximityRow[];
};

export const PROXIMITY_VERTICAL_DECKS_MAX = 3;
export const PROXIMITY_HORIZONTAL_DISTANCE_MAX = 30;

export function pointToBboxDistance(
  pointForeAft: number,
  pointPortStarboard: number,
  foreAftMin: number,
  foreAftMax: number,
  portStarboardMin: number,
  portStarboardMax: number,
): number {
  const dx = Math.max(foreAftMin - pointForeAft, 0, pointForeAft - foreAftMax);
  const dy = Math.max(
    portStarboardMin - pointPortStarboard,
    0,
    pointPortStarboard - portStarboardMax,
  );
  return Math.sqrt(dx * dx + dy * dy);
}

export function computeProximities(
  cabins: readonly CabinRow[],
  spaces: readonly SpaceRow[],
): ProximityRow[] {
  const out: ProximityRow[] = [];
  for (const cabin of cabins) {
    for (const space of spaces) {
      const verticalDecks = space.deckNumber - cabin.deckNumber;
      if (Math.abs(verticalDecks) > PROXIMITY_VERTICAL_DECKS_MAX) continue;
      const horizontalDistance = pointToBboxDistance(
        cabin.foreAft,
        cabin.portStarboard,
        space.foreAftMin,
        space.foreAftMax,
        space.portStarboardMin,
        space.portStarboardMax,
      );
      if (horizontalDistance > PROXIMITY_HORIZONTAL_DISTANCE_MAX) continue;
      out.push({
        cabinDeckNumber: cabin.deckNumber,
        cabinNumber: cabin.number,
        spaceDeckNumber: space.deckNumber,
        spaceLocalIndex: space.localIndex,
        verticalDecks,
        horizontalDistance,
      });
    }
  }
  return out;
}

const DECK_FILE_RE = /^deck-(\d+)\.yaml$/;

export async function normalizeShip(
  shipDir: string,
): Promise<NormalizedShipData> {
  const shipText = await fs.readFile(path.join(shipDir, "ship.yaml"), "utf8");
  const shipYaml = shipYamlSchema.parse(yaml.parse(shipText));

  const ship: ShipRow = {
    slug: shipYaml.slug,
    name: shipYaml.name,
    cruiseLine: shipYaml.cruise_line,
    class: shipYaml.class ?? null,
    grossTonnage: shipYaml.gross_tonnage ?? null,
    yearBuilt: shipYaml.year_built ?? null,
    lengthM: shipYaml.length_m ?? null,
    beamM: shipYaml.beam_m ?? null,
    deckCount: shipYaml.deck_count,
    notes: shipYaml.notes ?? null,
  };

  const entries = await fs.readdir(shipDir);
  const deckFiles = entries
    .filter((e) => DECK_FILE_RE.test(e))
    .sort((a, b) => parseDeckFileNumber(a) - parseDeckFileNumber(b));

  const decks: DeckRow[] = [];
  const cabins: CabinRow[] = [];
  const spaces: SpaceRow[] = [];
  const seenDeckNumbers = new Set<number>();

  for (const file of deckFiles) {
    const text = await fs.readFile(path.join(shipDir, file), "utf8");
    const parsed = deckYamlSchema.parse(yaml.parse(text));

    const fileDeckNumber = parseDeckFileNumber(file);
    if (parsed.deck !== fileDeckNumber) {
      throw new Error(
        `${file}: filename deck number (${fileDeckNumber}) does not match \`deck:\` field (${parsed.deck})`,
      );
    }
    if (seenDeckNumbers.has(parsed.deck)) {
      throw new Error(`duplicate deck number ${parsed.deck} across yaml files`);
    }
    seenDeckNumbers.add(parsed.deck);

    decks.push({
      deckNumber: parsed.deck,
      name: parsed.name ?? null,
      passenger: parsed.passenger,
    });

    const cabinNumbersOnDeck = new Set<string>();
    for (const c of parsed.cabins) {
      if (cabinNumbersOnDeck.has(c.number)) {
        throw new Error(
          `${file}: duplicate cabin number "${c.number}" on deck ${parsed.deck}`,
        );
      }
      cabinNumbersOnDeck.add(c.number);
      cabins.push({
        deckNumber: parsed.deck,
        number: c.number,
        category: c.category,
        foreAft: c.fore_aft,
        portStarboard: c.port_starboard,
        accessible: c.accessible,
        connecting: c.connecting,
        obstructedView: c.obstructed_view,
        notes: c.notes ?? null,
      });
    }

    parsed.spaces.forEach((s, i) => {
      spaces.push({
        deckNumber: parsed.deck,
        localIndex: i,
        type: s.type,
        name: s.name,
        foreAftMin: s.fore_aft[0],
        foreAftMax: s.fore_aft[1],
        portStarboardMin: s.port_starboard[0],
        portStarboardMax: s.port_starboard[1],
        enclosed: s.enclosed,
        noiseLevel: s.noise_level,
        openToAbove: s.open_to_above,
        openToBelow: s.open_to_below,
        notes: s.notes ?? null,
      });
    });
  }

  const proximity = computeProximities(cabins, spaces);

  return { ship, decks, cabins, spaces, proximity };
}

function parseDeckFileNumber(filename: string): number {
  const m = filename.match(DECK_FILE_RE);
  if (!m || m[1] === undefined) {
    throw new Error(`not a deck file: ${filename}`);
  }
  return Number.parseInt(m[1], 10);
}

if (import.meta.main) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: bun run ingestion/normalize.ts <ship-dir>");
    process.exit(1);
  }
  const result = await normalizeShip(dir);
  console.log(JSON.stringify(result, null, 2));
}
