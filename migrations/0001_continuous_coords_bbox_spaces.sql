CREATE TYPE "public"."space_type" AS ENUM('nightclub', 'live_music_venue', 'theater', 'showroom', 'arcade', 'casino', 'bar', 'lounge', 'pool', 'splash_zone', 'waterslide', 'kids_club', 'teen_club', 'sports_court', 'atrium', 'main_dining_room', 'specialty_dining', 'buffet', 'cafe', 'shops', 'photo_studio', 'reception', 'guest_services', 'spa', 'gym', 'library', 'chapel', 'conference_room', 'lecture_hall', 'art_gallery', 'observation_lounge', 'medical', 'adults_only_lounge', 'elevator_bank', 'stairs', 'corridor', 'crew_area', 'galley', 'mechanical', 'laundry', 'restroom', 'storage', 'open_deck', 'sun_deck', 'promenade', 'jogging_track', 'helipad', 'other');--> statement-breakpoint
CREATE TABLE "cabin_space_proximity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cabin_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"vertical_decks" integer NOT NULL,
	"horizontal_distance" real NOT NULL,
	CONSTRAINT "proximity_horizontal_distance_range" CHECK ("cabin_space_proximity"."horizontal_distance" BETWEEN 0 AND 100),
	CONSTRAINT "proximity_vertical_decks_range" CHECK ("cabin_space_proximity"."vertical_decks" BETWEEN -50 AND 50)
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"type" "space_type" NOT NULL,
	"name" text NOT NULL,
	"fore_aft_min" real NOT NULL,
	"fore_aft_max" real NOT NULL,
	"port_starboard_min" real NOT NULL,
	"port_starboard_max" real NOT NULL,
	"noise_level" integer NOT NULL,
	"enclosed" boolean DEFAULT true NOT NULL,
	"open_to_above" boolean DEFAULT false NOT NULL,
	"open_to_below" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "spaces_fore_aft_bbox" CHECK ("spaces"."fore_aft_min" <= "spaces"."fore_aft_max" AND "spaces"."fore_aft_min" >= 0 AND "spaces"."fore_aft_max" <= 100),
	CONSTRAINT "spaces_port_starboard_bbox" CHECK ("spaces"."port_starboard_min" <= "spaces"."port_starboard_max" AND "spaces"."port_starboard_min" >= 0 AND "spaces"."port_starboard_max" <= 100),
	CONSTRAINT "spaces_noise_level_range" CHECK ("spaces"."noise_level" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "amenities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cabin_adjacencies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "amenities" CASCADE;--> statement-breakpoint
DROP TABLE "cabin_adjacencies" CASCADE;--> statement-breakpoint
ALTER TABLE "cabins" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."cabin_category";--> statement-breakpoint
CREATE TYPE "public"."cabin_category" AS ENUM('interior', 'oceanview', 'balcony', 'suite');--> statement-breakpoint
ALTER TABLE "cabins" ALTER COLUMN "category" SET DATA TYPE "public"."cabin_category" USING "category"::"public"."cabin_category";--> statement-breakpoint
ALTER TABLE "cabins" ADD COLUMN "fore_aft" real NOT NULL;--> statement-breakpoint
ALTER TABLE "cabins" ADD COLUMN "port_starboard" real NOT NULL;--> statement-breakpoint
ALTER TABLE "cabins" ADD COLUMN "accessible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cabins" ADD COLUMN "connecting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cabins" ADD COLUMN "obstructed_view" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cabins" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "passenger" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ships" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ships" ADD COLUMN "gross_tonnage" integer;--> statement-breakpoint
ALTER TABLE "ships" ADD COLUMN "year_built" integer;--> statement-breakpoint
ALTER TABLE "ships" ADD COLUMN "length_m" real;--> statement-breakpoint
ALTER TABLE "ships" ADD COLUMN "beam_m" real;--> statement-breakpoint
ALTER TABLE "ships" ADD COLUMN "deck_count" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "ships" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "cabin_space_proximity" ADD CONSTRAINT "cabin_space_proximity_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cabin_space_proximity" ADD CONSTRAINT "cabin_space_proximity_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cabin_space_proximity_uniq" ON "cabin_space_proximity" USING btree ("cabin_id","space_id");--> statement-breakpoint
CREATE INDEX "cabin_space_proximity_cabin_idx" ON "cabin_space_proximity" USING btree ("cabin_id");--> statement-breakpoint
CREATE INDEX "cabin_space_proximity_space_idx" ON "cabin_space_proximity" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "cabin_space_proximity_space_vertical_idx" ON "cabin_space_proximity" USING btree ("space_id","vertical_decks");--> statement-breakpoint
CREATE INDEX "spaces_deck_type_idx" ON "spaces" USING btree ("deck_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "ships_slug_uniq" ON "ships" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "cabins" DROP COLUMN "position";--> statement-breakpoint
ALTER TABLE "cabins" DROP COLUMN "side";--> statement-breakpoint
ALTER TABLE "cabins" ADD CONSTRAINT "cabins_fore_aft_range" CHECK ("cabins"."fore_aft" BETWEEN 0 AND 100);--> statement-breakpoint
ALTER TABLE "cabins" ADD CONSTRAINT "cabins_port_starboard_range" CHECK ("cabins"."port_starboard" BETWEEN 0 AND 100);--> statement-breakpoint
DROP TYPE "public"."adjacency_relationship";--> statement-breakpoint
DROP TYPE "public"."amenity_type";--> statement-breakpoint
DROP TYPE "public"."cabin_position";--> statement-breakpoint
DROP TYPE "public"."cabin_side";