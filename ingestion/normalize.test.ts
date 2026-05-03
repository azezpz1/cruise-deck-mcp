import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  computeProximities,
  normalizeShip,
  pointToBboxDistance,
  PROXIMITY_HORIZONTAL_DISTANCE_MAX,
  PROXIMITY_VERTICAL_DECKS_MAX,
  type CabinRow,
  type SpaceRow,
} from "./normalize";

describe("pointToBboxDistance", () => {
  test("returns 0 when point is inside the bbox", () => {
    expect(pointToBboxDistance(50, 50, 40, 60, 40, 60)).toBe(0);
  });

  test("returns axis distance when offset along one axis only", () => {
    expect(pointToBboxDistance(70, 50, 40, 60, 40, 60)).toBe(10);
    expect(pointToBboxDistance(30, 50, 40, 60, 40, 60)).toBe(10);
    expect(pointToBboxDistance(50, 75, 40, 60, 40, 60)).toBe(15);
  });

  test("returns euclidean distance when offset along both axes (corner case)", () => {
    expect(pointToBboxDistance(63, 64, 40, 60, 40, 60)).toBeCloseTo(5, 6);
  });

  test("returns 0 on bbox boundary", () => {
    expect(pointToBboxDistance(40, 50, 40, 60, 40, 60)).toBe(0);
    expect(pointToBboxDistance(60, 60, 40, 60, 40, 60)).toBe(0);
  });
});

describe("computeProximities", () => {
  const cabin = (
    deckNumber: number,
    number: string,
    foreAft: number,
    portStarboard: number,
  ): CabinRow => ({
    deckNumber,
    number,
    category: "balcony",
    foreAft,
    portStarboard,
    accessible: false,
    connecting: false,
    obstructedView: false,
    notes: null,
  });

  const space = (
    deckNumber: number,
    localIndex: number,
    bbox: [number, number, number, number],
  ): SpaceRow => ({
    deckNumber,
    localIndex,
    type: "nightclub",
    name: "test",
    foreAftMin: bbox[0],
    foreAftMax: bbox[1],
    portStarboardMin: bbox[2],
    portStarboardMax: bbox[3],
    enclosed: true,
    noiseLevel: 80,
    openToAbove: false,
    openToBelow: false,
    notes: null,
  });

  test("emits one row per cabin/space pair within both thresholds", () => {
    const cabins = [cabin(8, "8420", 50, 50)];
    const spaces = [space(10, 0, [40, 60, 40, 60])];
    const rows = computeProximities(cabins, spaces);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      cabinDeckNumber: 8,
      cabinNumber: "8420",
      spaceDeckNumber: 10,
      spaceLocalIndex: 0,
      verticalDecks: 2,
      horizontalDistance: 0,
    });
  });

  test("verticalDecks is signed: +1 means space is one deck above cabin", () => {
    const cabins = [cabin(5, "5000", 50, 50)];
    const spaces = [
      space(6, 0, [45, 55, 45, 55]),
      space(4, 0, [45, 55, 45, 55]),
    ];
    const rows = computeProximities(cabins, spaces);
    const above = rows.find((r) => r.spaceDeckNumber === 6);
    const below = rows.find((r) => r.spaceDeckNumber === 4);
    expect(above?.verticalDecks).toBe(1);
    expect(below?.verticalDecks).toBe(-1);
  });

  test("excludes pairs beyond the vertical-decks threshold", () => {
    const cabins = [cabin(5, "5000", 50, 50)];
    const justOver = PROXIMITY_VERTICAL_DECKS_MAX + 1;
    const spaces = [
      space(5 + justOver, 0, [45, 55, 45, 55]),
      space(5 - justOver, 0, [45, 55, 45, 55]),
    ];
    expect(computeProximities(cabins, spaces)).toHaveLength(0);
  });

  test("excludes pairs beyond the horizontal-distance threshold", () => {
    const cabins = [cabin(5, "5000", 0, 0)];
    // bbox is at the far corner — its closest point is at (50, 50),
    // distance sqrt(50^2 + 50^2) ≈ 70.7, well past the 30 threshold.
    const spaces = [space(5, 0, [50, 60, 50, 60])];
    expect(computeProximities(cabins, spaces)).toHaveLength(0);
  });

  test("includes pairs exactly at the horizontal-distance threshold", () => {
    const cabins = [cabin(5, "5000", 0, 50)];
    const spaces = [
      space(5, 0, [PROXIMITY_HORIZONTAL_DISTANCE_MAX, 60, 40, 60]),
    ];
    const rows = computeProximities(cabins, spaces);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.horizontalDistance).toBeCloseTo(
      PROXIMITY_HORIZONTAL_DISTANCE_MAX,
      6,
    );
  });
});

describe("normalizeShip", () => {
  test("parses ship.yaml + deck files and produces normalized rows", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "normalize-"));
    await writeFile(
      path.join(dir, "ship.yaml"),
      `slug: test-ship
name: Test Ship
cruise_line: Test Line
deck_count: 12
`,
    );
    await writeFile(
      path.join(dir, "deck-8.yaml"),
      `deck: 8
name: Caribbean
passenger: true
cabins:
  - number: "8420"
    category: balcony
    fore_aft: 50
    port_starboard: 50
spaces:
  - type: corridor
    name: ""
    fore_aft: [40, 60]
    port_starboard: [40, 60]
    enclosed: true
    noise_level: 25
`,
    );
    await writeFile(
      path.join(dir, "deck-10.yaml"),
      `deck: 10
passenger: true
spaces:
  - type: nightclub
    name: The Tube
    fore_aft: [45, 55]
    port_starboard: [45, 55]
    enclosed: true
    noise_level: 85
`,
    );

    const result = await normalizeShip(dir);

    expect(result.ship.slug).toBe("test-ship");
    expect(result.ship.deckCount).toBe(12);
    expect(result.ship.class).toBeNull();
    expect(result.decks.map((d) => d.deckNumber)).toEqual([8, 10]);
    expect(result.cabins).toHaveLength(1);
    expect(result.spaces).toHaveLength(2);

    const proximity = result.proximity.find(
      (p) => p.cabinNumber === "8420" && p.spaceDeckNumber === 10,
    );
    expect(proximity).toBeDefined();
    expect(proximity?.verticalDecks).toBe(2);
    expect(proximity?.horizontalDistance).toBe(0);
  });

  test("rejects deck file whose `deck:` field disagrees with filename", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "normalize-"));
    await writeFile(
      path.join(dir, "ship.yaml"),
      `slug: test
name: Test
cruise_line: Test
deck_count: 12
`,
    );
    await writeFile(
      path.join(dir, "deck-8.yaml"),
      `deck: 9
passenger: true
`,
    );
    await expect(normalizeShip(dir)).rejects.toThrow(
      /filename deck number .* does not match/,
    );
  });

  test("rejects ship dir missing ship.yaml", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "normalize-"));
    await mkdir(path.join(dir, "empty"), { recursive: true });
    await expect(normalizeShip(path.join(dir, "empty"))).rejects.toThrow();
  });
});
