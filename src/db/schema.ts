import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const cabinCategoryEnum = pgEnum("cabin_category", [
  "inside",
  "oceanview",
  "balcony",
  "suite",
]);

export const cabinPositionEnum = pgEnum("cabin_position", [
  "forward",
  "mid",
  "aft",
]);

export const cabinSideEnum = pgEnum("cabin_side", [
  "port",
  "starboard",
  "interior",
]);

export const amenityTypeEnum = pgEnum("amenity_type", [
  "pool",
  "theater",
  "elevator",
  "nightclub",
  "buffet",
  "restaurant",
  "bar",
  "lounge",
  "spa",
  "gym",
  "kids_club",
  "casino",
  "atrium",
  "promenade",
  "engine_room",
  "laundry",
  "crew_area",
  "other",
]);

export const adjacencyRelationshipEnum = pgEnum("adjacency_relationship", [
  "above",
  "below",
  "adjacent",
  "near",
]);

export const ships = pgTable(
  "ships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    cruiseLine: text("cruise_line").notNull(),
    class: text("class"),
  },
  (t) => ({
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
    position: cabinPositionEnum("position").notNull(),
    side: cabinSideEnum("side").notNull(),
  },
  (t) => ({
    deckNumberUnique: uniqueIndex("cabins_deck_number_uniq").on(
      t.deckId,
      t.number,
    ),
    categoryIdx: index("cabins_category_idx").on(t.category),
  }),
);

export const amenities = pgTable(
  "amenities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    type: amenityTypeEnum("type").notNull(),
    name: text("name").notNull(),
    position: cabinPositionEnum("position").notNull(),
  },
  (t) => ({
    deckTypeIdx: index("amenities_deck_type_idx").on(t.deckId, t.type),
  }),
);

export const cabinAdjacencies = pgTable(
  "cabin_adjacencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cabinId: uuid("cabin_id")
      .notNull()
      .references(() => cabins.id, { onDelete: "cascade" }),
    amenityId: uuid("amenity_id")
      .notNull()
      .references(() => amenities.id, { onDelete: "cascade" }),
    relationship: adjacencyRelationshipEnum("relationship").notNull(),
    distanceScore: real("distance_score").notNull(),
  },
  (t) => ({
    cabinAmenityRelUnique: uniqueIndex("cabin_adj_unique").on(
      t.cabinId,
      t.amenityId,
      t.relationship,
    ),
    cabinIdx: index("cabin_adj_cabin_idx").on(t.cabinId),
    amenityIdx: index("cabin_adj_amenity_idx").on(t.amenityId),
  }),
);

export const shipsRelations = relations(ships, ({ many }) => ({
  decks: many(decks),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  ship: one(ships, { fields: [decks.shipId], references: [ships.id] }),
  cabins: many(cabins),
  amenities: many(amenities),
}));

export const cabinsRelations = relations(cabins, ({ one, many }) => ({
  deck: one(decks, { fields: [cabins.deckId], references: [decks.id] }),
  adjacencies: many(cabinAdjacencies),
}));

export const amenitiesRelations = relations(amenities, ({ one, many }) => ({
  deck: one(decks, { fields: [amenities.deckId], references: [decks.id] }),
  adjacencies: many(cabinAdjacencies),
}));

export const cabinAdjacenciesRelations = relations(
  cabinAdjacencies,
  ({ one }) => ({
    cabin: one(cabins, {
      fields: [cabinAdjacencies.cabinId],
      references: [cabins.id],
    }),
    amenity: one(amenities, {
      fields: [cabinAdjacencies.amenityId],
      references: [amenities.id],
    }),
  }),
);

export type Ship = typeof ships.$inferSelect;
export type Deck = typeof decks.$inferSelect;
export type Cabin = typeof cabins.$inferSelect;
export type Amenity = typeof amenities.$inferSelect;
export type CabinAdjacency = typeof cabinAdjacencies.$inferSelect;
