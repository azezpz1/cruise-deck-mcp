import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  boolean,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const cabinCategoryEnum = pgEnum("cabin_category", [
  "interior",
  "oceanview",
  "balcony",
  "suite",
]);

export const spaceTypeEnum = pgEnum("space_type", [
  // loud
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
  // medium
  "main_dining_room",
  "specialty_dining",
  "buffet",
  "cafe",
  "shops",
  "photo_studio",
  "reception",
  "guest_services",
  // quiet
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
  // functional
  "elevator_bank",
  "stairs",
  "corridor",
  "crew_area",
  "galley",
  "mechanical",
  "laundry",
  "restroom",
  "storage",
  // exterior
  "open_deck",
  "sun_deck",
  "promenade",
  "jogging_track",
  "helipad",
  // catch-all
  "other",
]);

export const ships = pgTable(
  "ships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    cruiseLine: text("cruise_line").notNull(),
    class: text("class"),
    grossTonnage: integer("gross_tonnage"),
    yearBuilt: integer("year_built"),
    lengthM: real("length_m"),
    beamM: real("beam_m"),
    deckCount: integer("deck_count").notNull(),
    notes: text("notes"),
  },
  (t) => ({
    slugUnique: uniqueIndex("ships_slug_uniq").on(t.slug),
    nameLineUnique: uniqueIndex("ships_name_line_uniq").on(t.name, t.cruiseLine),
  }),
);

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shipId: uuid("ship_id")
      .notNull()
      .references(() => ships.id, { onDelete: "cascade" }),
    deckNumber: integer("deck_number").notNull(),
    name: text("name"),
    passenger: boolean("passenger").notNull().default(true),
  },
  (t) => ({
    shipDeckUnique: uniqueIndex("decks_ship_number_uniq").on(
      t.shipId,
      t.deckNumber,
    ),
  }),
);

export const cabins = pgTable(
  "cabins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    category: cabinCategoryEnum("category").notNull(),
    foreAft: real("fore_aft").notNull(),
    portStarboard: real("port_starboard").notNull(),
    accessible: boolean("accessible").notNull().default(false),
    connecting: boolean("connecting").notNull().default(false),
    obstructedView: boolean("obstructed_view").notNull().default(false),
    notes: text("notes"),
  },
  (t) => ({
    deckNumberUnique: uniqueIndex("cabins_deck_number_uniq").on(
      t.deckId,
      t.number,
    ),
    categoryIdx: index("cabins_category_idx").on(t.category),
    foreAftRange: check(
      "cabins_fore_aft_range",
      sql`${t.foreAft} BETWEEN 0 AND 100`,
    ),
    portStarboardRange: check(
      "cabins_port_starboard_range",
      sql`${t.portStarboard} BETWEEN 0 AND 100`,
    ),
  }),
);

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    type: spaceTypeEnum("type").notNull(),
    name: text("name").notNull(),
    foreAftMin: real("fore_aft_min").notNull(),
    foreAftMax: real("fore_aft_max").notNull(),
    portStarboardMin: real("port_starboard_min").notNull(),
    portStarboardMax: real("port_starboard_max").notNull(),
    noiseLevel: integer("noise_level").notNull(),
    enclosed: boolean("enclosed").notNull().default(true),
    openToAbove: boolean("open_to_above").notNull().default(false),
    openToBelow: boolean("open_to_below").notNull().default(false),
    notes: text("notes"),
  },
  (t) => ({
    deckTypeIdx: index("spaces_deck_type_idx").on(t.deckId, t.type),
    foreAftBbox: check(
      "spaces_fore_aft_bbox",
      sql`${t.foreAftMin} <= ${t.foreAftMax} AND ${t.foreAftMin} >= 0 AND ${t.foreAftMax} <= 100`,
    ),
    portStarboardBbox: check(
      "spaces_port_starboard_bbox",
      sql`${t.portStarboardMin} <= ${t.portStarboardMax} AND ${t.portStarboardMin} >= 0 AND ${t.portStarboardMax} <= 100`,
    ),
    noiseLevelRange: check(
      "spaces_noise_level_range",
      sql`${t.noiseLevel} BETWEEN 0 AND 100`,
    ),
  }),
);

export const cabinSpaceProximity = pgTable(
  "cabin_space_proximity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cabinId: uuid("cabin_id")
      .notNull()
      .references(() => cabins.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    verticalDecks: integer("vertical_decks").notNull(),
    horizontalDistance: real("horizontal_distance").notNull(),
  },
  (t) => ({
    cabinSpaceUnique: uniqueIndex("cabin_space_proximity_uniq").on(
      t.cabinId,
      t.spaceId,
    ),
    cabinIdx: index("cabin_space_proximity_cabin_idx").on(t.cabinId),
    spaceIdx: index("cabin_space_proximity_space_idx").on(t.spaceId),
    spaceVerticalIdx: index("cabin_space_proximity_space_vertical_idx").on(
      t.spaceId,
      t.verticalDecks,
    ),
    horizontalDistanceRange: check(
      "proximity_horizontal_distance_range",
      sql`${t.horizontalDistance} BETWEEN 0 AND 100`,
    ),
    verticalDecksRange: check(
      "proximity_vertical_decks_range",
      sql`${t.verticalDecks} BETWEEN -50 AND 50`,
    ),
  }),
);

export const shipsRelations = relations(ships, ({ many }) => ({
  decks: many(decks),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  ship: one(ships, { fields: [decks.shipId], references: [ships.id] }),
  cabins: many(cabins),
  spaces: many(spaces),
}));

export const cabinsRelations = relations(cabins, ({ one, many }) => ({
  deck: one(decks, { fields: [cabins.deckId], references: [decks.id] }),
  proximities: many(cabinSpaceProximity),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  deck: one(decks, { fields: [spaces.deckId], references: [decks.id] }),
  proximities: many(cabinSpaceProximity),
}));

export const cabinSpaceProximityRelations = relations(
  cabinSpaceProximity,
  ({ one }) => ({
    cabin: one(cabins, {
      fields: [cabinSpaceProximity.cabinId],
      references: [cabins.id],
    }),
    space: one(spaces, {
      fields: [cabinSpaceProximity.spaceId],
      references: [spaces.id],
    }),
  }),
);

export type Ship = typeof ships.$inferSelect;
export type Deck = typeof decks.$inferSelect;
export type Cabin = typeof cabins.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type CabinSpaceProximity = typeof cabinSpaceProximity.$inferSelect;
