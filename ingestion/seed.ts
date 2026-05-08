// Load normalized ship data into Postgres via Drizzle.
//
// `bun run ingest:seed --ship=<slug>` reads `data/ships/<slug>/`, normalizes
// it via `normalizeShip`, then upserts ship/decks/cabins keyed on natural
// keys, wipes-and-replaces spaces for the ship, and bulk-inserts the
// derived `cabin_space_proximity` rows. Whole pipeline runs in one
// transaction so partial failures roll back.

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { inArray, sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import {
  ships,
  decks,
  cabins,
  spaces,
  cabinSpaceProximity,
} from "../src/db/schema";
import { normalizeShip, type NormalizedShipData } from "./normalize";

const PROXIMITY_INSERT_CHUNK = 1000;

export type SeedSummary = {
  decks: number;
  cabins: number;
  spaces: number;
  proximity: number;
};

export function parseShipArg(argv: readonly string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg.startsWith("--ship=")) {
      const value = arg.slice("--ship=".length);
      return value.length > 0 ? value : null;
    }
    if (arg === "--ship") {
      const next = argv[i + 1];
      return next !== undefined && next.length > 0 ? next : null;
    }
  }
  return null;
}

export function parseDevVars(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function loadDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  let text: string;
  try {
    text = await fs.readFile(".dev.vars", "utf8");
  } catch {
    throw new Error(
      "DATABASE_URL not set and .dev.vars not found in current directory",
    );
  }
  const vars = parseDevVars(text);
  const url = vars["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL not present in .dev.vars");
  return url;
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

export async function seedShip(
  db: Db,
  data: NormalizedShipData,
): Promise<SeedSummary> {
  return db.transaction(async (tx) => {
    // 1. Upsert ship row keyed on slug.
    const shipInsert = await tx
      .insert(ships)
      .values({
        slug: data.ship.slug,
        name: data.ship.name,
        cruiseLine: data.ship.cruiseLine,
        class: data.ship.class,
        grossTonnage: data.ship.grossTonnage,
        yearBuilt: data.ship.yearBuilt,
        lengthM: data.ship.lengthM,
        beamM: data.ship.beamM,
        deckCount: data.ship.deckCount,
        notes: data.ship.notes,
      })
      .onConflictDoUpdate({
        target: ships.slug,
        set: {
          name: sql`excluded.name`,
          cruiseLine: sql`excluded.cruise_line`,
          class: sql`excluded.class`,
          grossTonnage: sql`excluded.gross_tonnage`,
          yearBuilt: sql`excluded.year_built`,
          lengthM: sql`excluded.length_m`,
          beamM: sql`excluded.beam_m`,
          deckCount: sql`excluded.deck_count`,
          notes: sql`excluded.notes`,
        },
      })
      .returning({ id: ships.id });
    const shipRow = shipInsert[0];
    if (!shipRow) throw new Error("ship upsert returned no rows");
    const shipId = shipRow.id;

    // 2. Upsert decks keyed on (ship_id, deck_number).
    const deckIdByNumber = new Map<number, string>();
    if (data.decks.length > 0) {
      const deckRows = await tx
        .insert(decks)
        .values(
          data.decks.map((d) => ({
            shipId,
            deckNumber: d.deckNumber,
            name: d.name,
            passenger: d.passenger,
          })),
        )
        .onConflictDoUpdate({
          target: [decks.shipId, decks.deckNumber],
          set: {
            name: sql`excluded.name`,
            passenger: sql`excluded.passenger`,
          },
        })
        .returning({ id: decks.id, deckNumber: decks.deckNumber });
      for (const row of deckRows) {
        deckIdByNumber.set(row.deckNumber, row.id);
      }
    }

    // 3. Upsert cabins keyed on (deck_id, number). Re-query after to build
    // the natural-key map rather than rely on RETURNING ordering under
    // ON CONFLICT.
    const cabinIdByKey = new Map<string, string>(); // `${deckNumber}:${number}`
    if (data.cabins.length > 0) {
      const values = data.cabins.map((c) => {
        const deckId = deckIdByNumber.get(c.deckNumber);
        if (!deckId) {
          throw new Error(
            `cabin ${c.number} references deck ${c.deckNumber} which has no inserted row`,
          );
        }
        return {
          deckId,
          number: c.number,
          category: c.category,
          foreAft: c.foreAft,
          portStarboard: c.portStarboard,
          accessible: c.accessible,
          connecting: c.connecting,
          obstructedView: c.obstructedView,
          notes: c.notes,
        };
      });
      await tx
        .insert(cabins)
        .values(values)
        .onConflictDoUpdate({
          target: [cabins.deckId, cabins.number],
          set: {
            category: sql`excluded.category`,
            foreAft: sql`excluded.fore_aft`,
            portStarboard: sql`excluded.port_starboard`,
            accessible: sql`excluded.accessible`,
            connecting: sql`excluded.connecting`,
            obstructedView: sql`excluded.obstructed_view`,
            notes: sql`excluded.notes`,
          },
        });

      const deckIds = Array.from(deckIdByNumber.values());
      const deckNumberById = new Map<string, number>();
      for (const [num, id] of deckIdByNumber) deckNumberById.set(id, num);
      const cabinRows = await tx
        .select({
          id: cabins.id,
          deckId: cabins.deckId,
          number: cabins.number,
        })
        .from(cabins)
        .where(inArray(cabins.deckId, deckIds));
      for (const row of cabinRows) {
        const dn = deckNumberById.get(row.deckId);
        if (dn === undefined) continue;
        cabinIdByKey.set(`${dn}:${row.number}`, row.id);
      }
    }

    // 4. Wipe-and-replace spaces for this ship's decks. The FK on
    // cabin_space_proximity.space_id cascades, so existing proximity rows
    // get cleaned up here too.
    const deckIds = Array.from(deckIdByNumber.values());
    const spaceIdByKey = new Map<string, string>(); // `${deckNumber}:${localIndex}`
    if (deckIds.length > 0) {
      await tx.delete(spaces).where(inArray(spaces.deckId, deckIds));
    }
    if (data.spaces.length > 0) {
      const values = data.spaces.map((s) => {
        const deckId = deckIdByNumber.get(s.deckNumber);
        if (!deckId) {
          throw new Error(
            `space references deck ${s.deckNumber} which has no inserted row`,
          );
        }
        return {
          deckId,
          type: s.type,
          name: s.name,
          foreAftMin: s.foreAftMin,
          foreAftMax: s.foreAftMax,
          portStarboardMin: s.portStarboardMin,
          portStarboardMax: s.portStarboardMax,
          noiseLevel: s.noiseLevel,
          enclosed: s.enclosed,
          openToAbove: s.openToAbove,
          openToBelow: s.openToBelow,
          notes: s.notes,
        };
      });
      // Plain INSERT (no conflict) — postgres preserves VALUES ordering in
      // RETURNING, so inserted[i] matches data.spaces[i].
      const inserted = await tx
        .insert(spaces)
        .values(values)
        .returning({ id: spaces.id });
      if (inserted.length !== data.spaces.length) {
        throw new Error(
          `space insert returned ${inserted.length} rows, expected ${data.spaces.length}`,
        );
      }
      for (let i = 0; i < data.spaces.length; i++) {
        const s = data.spaces[i];
        const row = inserted[i];
        if (!s || !row) continue;
        spaceIdByKey.set(`${s.deckNumber}:${s.localIndex}`, row.id);
      }
    }

    // 5. Bulk-insert proximity rows, resolving natural keys to UUIDs.
    let proximityInserted = 0;
    if (data.proximity.length > 0) {
      const values = data.proximity.map((p) => {
        const cabinId = cabinIdByKey.get(
          `${p.cabinDeckNumber}:${p.cabinNumber}`,
        );
        if (!cabinId) {
          throw new Error(
            `proximity references cabin ${p.cabinDeckNumber}/${p.cabinNumber} not in inserted set`,
          );
        }
        const spaceId = spaceIdByKey.get(
          `${p.spaceDeckNumber}:${p.spaceLocalIndex}`,
        );
        if (!spaceId) {
          throw new Error(
            `proximity references space ${p.spaceDeckNumber}/${p.spaceLocalIndex} not in inserted set`,
          );
        }
        return {
          cabinId,
          spaceId,
          verticalDecks: p.verticalDecks,
          horizontalDistance: p.horizontalDistance,
        };
      });
      for (let i = 0; i < values.length; i += PROXIMITY_INSERT_CHUNK) {
        const chunk = values.slice(i, i + PROXIMITY_INSERT_CHUNK);
        await tx.insert(cabinSpaceProximity).values(chunk);
        proximityInserted += chunk.length;
      }
    }

    return {
      decks: data.decks.length,
      cabins: data.cabins.length,
      spaces: data.spaces.length,
      proximity: proximityInserted,
    };
  });
}

export async function seed(connectionString: string, slug: string): Promise<SeedSummary> {
  const shipDir = path.join("data", "ships", slug);
  await assertShipDir(shipDir);
  const data = await normalizeShip(shipDir);
  const client = postgres(connectionString, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });
  try {
    return await seedShip(db, data);
  } finally {
    await client.end();
  }
}

async function assertShipDir(shipDir: string): Promise<void> {
  let stat;
  try {
    stat = await fs.stat(shipDir);
  } catch {
    throw new Error(`ship dir not found: ${shipDir}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`${shipDir} exists but is not a directory`);
  }
}

if (import.meta.main) {
  const slug = parseShipArg(process.argv.slice(2));
  if (!slug) {
    console.error("usage: bun run ingest:seed --ship=<slug>");
    process.exit(1);
  }
  try {
    const connectionString = await loadDatabaseUrl();
    const summary = await seed(connectionString, slug);
    console.log(
      `Seeded ${slug}: ${summary.decks} decks, ${summary.cabins} cabins, ${summary.spaces} spaces, ${summary.proximity} proximity rows.`,
    );
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
