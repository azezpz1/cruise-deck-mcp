CREATE TYPE "public"."adjacency_relationship" AS ENUM('above', 'below', 'adjacent', 'near');--> statement-breakpoint
CREATE TYPE "public"."amenity_type" AS ENUM('pool', 'theater', 'elevator', 'nightclub', 'buffet', 'restaurant', 'bar', 'lounge', 'spa', 'gym', 'kids_club', 'casino', 'atrium', 'promenade', 'engine_room', 'laundry', 'crew_area', 'other');--> statement-breakpoint
CREATE TYPE "public"."cabin_category" AS ENUM('inside', 'oceanview', 'balcony', 'suite');--> statement-breakpoint
CREATE TYPE "public"."cabin_position" AS ENUM('forward', 'mid', 'aft');--> statement-breakpoint
CREATE TYPE "public"."cabin_side" AS ENUM('port', 'starboard', 'interior');--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"type" "amenity_type" NOT NULL,
	"name" text NOT NULL,
	"position" "cabin_position" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cabin_adjacencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cabin_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	"relationship" "adjacency_relationship" NOT NULL,
	"distance_score" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cabins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"number" text NOT NULL,
	"category" "cabin_category" NOT NULL,
	"position" "cabin_position" NOT NULL,
	"side" "cabin_side" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ship_id" uuid NOT NULL,
	"deck_number" integer NOT NULL,
	"name" text
);
--> statement-breakpoint
CREATE TABLE "ships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cruise_line" text NOT NULL,
	"class" text
);
--> statement-breakpoint
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cabin_adjacencies" ADD CONSTRAINT "cabin_adjacencies_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cabin_adjacencies" ADD CONSTRAINT "cabin_adjacencies_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cabins" ADD CONSTRAINT "cabins_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_ship_id_ships_id_fk" FOREIGN KEY ("ship_id") REFERENCES "public"."ships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amenities_deck_type_idx" ON "amenities" USING btree ("deck_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "cabin_adj_unique" ON "cabin_adjacencies" USING btree ("cabin_id","amenity_id","relationship");--> statement-breakpoint
CREATE INDEX "cabin_adj_cabin_idx" ON "cabin_adjacencies" USING btree ("cabin_id");--> statement-breakpoint
CREATE INDEX "cabin_adj_amenity_idx" ON "cabin_adjacencies" USING btree ("amenity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cabins_deck_number_uniq" ON "cabins" USING btree ("deck_id","number");--> statement-breakpoint
CREATE INDEX "cabins_category_idx" ON "cabins" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "decks_ship_number_uniq" ON "decks" USING btree ("ship_id","deck_number");--> statement-breakpoint
CREATE UNIQUE INDEX "ships_name_line_uniq" ON "ships" USING btree ("name","cruise_line");