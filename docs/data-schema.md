# Data schema — YAML encoding for cruise ship deck plans

This is the canonical reference for how cruise ship deck plans are encoded
into YAML files for ingestion into the `cruise-deck-mcp` database. When the
user pastes a deck screenshot in chat (or shares it via Claude cowork),
Claude produces YAML matching the rules in this document. The user reviews,
edits if needed, commits the file, and the seed script (issue #8) loads it
into Supabase.

This document is **the contract Claude follows when encoding**. If the rules
need to change, update this file first, then re-encode.

## Layout

```
data/
  ships/
    <slug>/
      ship.yaml          # ship-level metadata, one per ship
      deck-1.yaml        # one file per passenger deck
      deck-2.yaml
      ...
```

One file per screenshot. If you paste a deck-8 screenshot, Claude updates
exactly `data/ships/<slug>/deck-8.yaml` — no other file. This makes
re-encoding a single deck trivial when a screenshot is wrong or improved.

## Coordinate system

All positions use a normalized percentage system:

- `fore_aft`: **0 = bow** (front of ship), **100 = stern** (back of ship)
- `port_starboard`: **0 = port** (left when facing bow), **100 = starboard** (right)

Estimate to ~5% precision from the screenshot. Don't agonize — adjacency math
only needs "close enough." A cabin at `fore_aft: 62` vs `fore_aft: 65` will
score the same against an overhead nightclub.

Cabins are stored as **points** (single fore_aft + port_starboard). Spaces
are stored as **bounding boxes** (`fore_aft_min/max`, `port_starboard_min/max`).
For irregularly-shaped spaces (round atriums, L-shaped pools), the bbox is
the tightest enclosing rectangle.

## `ship.yaml` schema

One file per ship, at `data/ships/<slug>/ship.yaml`.

```yaml
slug: disney-fantasy           # required, kebab-case, stable PK / CLI handle
name: "Disney Fantasy"         # required, human-readable
cruise_line: "Disney Cruise Line"   # required
class: "Dream"                 # optional, ship class for sister-ship grouping
gross_tonnage: 130000          # optional
year_built: 2012               # optional
length_m: 340                  # optional, used to sanity-check coordinate scaling
beam_m: 38                     # optional
deck_count: 14                 # required, total passenger decks
notes: ""                      # optional, free text
```

**Field reference**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `slug` | string | yes | kebab-case, unique across all ships, also the directory name |
| `name` | string | yes | as printed by the cruise line |
| `cruise_line` | string | yes | full name, e.g. "Royal Caribbean International" |
| `class` | string | no | ship class (Oasis, Quantum, Dream, etc.) for grouping |
| `gross_tonnage` | int | no | GT, used as a rough size proxy |
| `year_built` | int | no | year the ship entered service |
| `length_m` | float | no | overall length in meters |
| `beam_m` | float | no | maximum width in meters |
| `deck_count` | int | yes | total number of passenger decks (excludes crew-only) |
| `notes` | string | no | anything else worth recording |

## `deck-<n>.yaml` schema

One file per passenger deck, at `data/ships/<slug>/deck-<n>.yaml`.

```yaml
deck: 8                        # required, integer deck number
name: "Caribbean"              # optional, themed deck name if any
passenger: true                # required; false for crew-only / mechanical decks
notes: ""                      # optional

cabins:
  - number: "8420"             # required, string (preserve leading zeros / letters)
    category: balcony          # required: interior | oceanview | balcony | suite
    fore_aft: 62               # required, 0–100
    port_starboard: 18         # required, 0–100
    accessible: false          # optional, default false
    connecting: false          # optional, default false (has connecting door to neighbor)
    obstructed_view: false     # optional, default false (lifeboat/structure blocks view)
    notes: ""                  # optional

spaces:
  - type: nightclub            # required, controlled vocab (see next section)
    name: "The Tube"           # required if named; "" if generic
    fore_aft: [40, 55]         # required, [min, max] bbox 0–100
    port_starboard: [30, 70]   # required, [min, max] bbox 0–100
    enclosed: true             # required; false for open-air decks/pools
    noise_level: 70            # required, 0–100; 0 means "no sound emitter" (atrium void, corridor)
    open_to_above: false       # optional, default false (sound coupling up — atrium roof)
    open_to_below: false       # optional, default false (sound coupling down)
    notes: ""                  # optional
```

**Cabin field reference**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `number` | string | yes | preserve formatting (`"08420"`, `"8420A"`) |
| `category` | enum | yes | `interior`, `oceanview`, `balcony`, `suite` |
| `fore_aft` | float | yes | 0–100 |
| `port_starboard` | float | yes | 0–100 |
| `accessible` | bool | no | wheelchair-accessible cabin |
| `connecting` | bool | no | has a door connecting to a neighboring cabin |
| `obstructed_view` | bool | no | lifeboat or structure blocks the window/balcony view |
| `notes` | string | no | anything from the legend that doesn't fit above |

**Space field reference**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | enum | yes | controlled vocab — see next section |
| `name` | string | yes | venue's name as printed; `""` if unnamed (e.g. corridor) |
| `fore_aft` | `[min, max]` | yes | bbox along ship length, 0–100 each |
| `port_starboard` | `[min, max]` | yes | bbox across beam, 0–100 each |
| `enclosed` | bool | yes | true for indoor; false for open-air |
| `noise_level` | int | yes | 0–100, peak-hours score; **0 = non-emitter** |
| `open_to_above` | bool | no | sound radiates up (atrium top, exposed dome) |
| `open_to_below` | bool | no | sound radiates down (cutout in floor) |
| `notes` | string | no | unusual details, time-of-day quirks, etc. |

## `space.type` controlled vocab

The full enum, grouped by typical noise profile. The grouping informs the
default `noise_level` (next section) but does **not** change the schema —
all values are siblings in the `space_type` enum.

**Loud** — primary noise emitters, especially during peak hours:
`nightclub`, `live_music_venue`, `theater`, `showroom`, `arcade`, `casino`,
`bar`, `lounge`, `pool`, `splash_zone`, `waterslide`, `kids_club`,
`teen_club`, `sports_court`, `atrium`

**Medium** — moderate noise during meal/operating hours:
`main_dining_room`, `specialty_dining`, `buffet`, `cafe`, `shops`,
`photo_studio`, `reception`, `guest_services`

**Quiet** — designed to be calm:
`spa`, `gym`, `library`, `chapel`, `conference_room`, `lecture_hall`,
`art_gallery`, `observation_lounge`, `medical`, `adults_only_lounge`

**Functional** — utility spaces; usually quiet but mechanical hum:
`elevator_bank`, `stairs`, `corridor`, `crew_area`, `galley`, `mechanical`,
`laundry`, `restroom`, `storage`

**Exterior** — open-deck areas; sound dissipates outdoors:
`open_deck`, `sun_deck`, `promenade`, `jogging_track`, `helipad`

**Catch-all**: `other` — must populate `notes` describing the space.
Treated as medium noise unless overridden.

## `noise_level` defaults by type

When encoding, Claude starts from the default for the type, then adjusts per
cruise-line and per-venue (see next sections). The user can override any
value if they have specific knowledge.

| Bucket | Types | Default `noise_level` |
|---|---|---|
| Loud | `nightclub`, `live_music_venue` | 85 |
| Loud | `theater`, `showroom`, `arcade`, `casino` | 75 |
| Loud | `bar`, `lounge`, `pool`, `splash_zone`, `waterslide`, `kids_club`, `teen_club`, `sports_court`, `atrium` | 70 |
| Medium | `main_dining_room`, `specialty_dining`, `buffet`, `cafe` | 50 |
| Medium | `shops`, `reception`, `guest_services`, `photo_studio` | 40 |
| Quiet | `gym`, `adults_only_lounge`, `observation_lounge` | 30 |
| Quiet | `spa`, `library`, `chapel`, `art_gallery`, `lecture_hall`, `conference_room`, `medical` | 15 |
| Functional | `elevator_bank`, `stairs`, `corridor` | 25 |
| Functional | `crew_area`, `galley`, `mechanical`, `laundry`, `restroom`, `storage` | 20 |
| Exterior | `open_deck`, `sun_deck`, `promenade`, `jogging_track` | 35 |
| Exterior | `helipad` | 50 |
| Catch-all | `other` | 50 |

Any space with no actual sound source (atrium void on a non-emitter deck,
empty corridors, structural shafts) gets `noise_level: 0` regardless of its
type bucket. This keeps the noise scorer from double-counting multi-deck
spaces (see "Encoding rules" below).

## Cruise-line shift heuristics

Same `type`, same default — but a Disney nightclub really is quieter than a
Carnival one. Apply this shift to the type default, then clamp to 0–100:

| Cruise lines | Shift |
|---|---|
| Disney, Cunard, Viking, Princess, Holland America | **−15** |
| Royal Caribbean, NCL, Celebrity, Costa, Oceania | **±0** |
| Carnival, Virgin, MSC, P&O | **+10** |

Then per-venue: if Claude recognizes the venue name (e.g. an adults-only
lounge known to be quiet, a "rock" club known to be loud), adjust ±5–15
on top.

## Encoding rules

When Claude produces YAML from a deck screenshot:

1. **One file per screenshot.** If you paste deck 8, only `deck-8.yaml` is
   touched. No cross-deck synthesis.

2. **Don't invent data.** If a venue's name isn't legible, leave `name: ""`
   and put what's visible in `notes`. If a cabin number is partly cut off,
   skip the cabin rather than guess.

3. **Multi-deck spaces** (atriums, theaters that breach two decks): list the
   space on **every deck where its footprint is visible on the screenshot**,
   so `get_deck_layout` reports the right thing per deck. Set `noise_level:
   0` on the void decks (the atrium "hole") and `noise_level: <real value>`
   on the deck where the actual sound source lives (the band, the bar, the
   stage). This prevents double-counting in the noise scorer while still
   capturing layout accurately.

4. **Bbox over centroids.** Every space gets a bounding box. For round or
   irregular shapes, use the tightest enclosing rectangle. Cabins are
   points, not boxes — they're small enough that a point is fine for
   adjacency math.

5. **Unknown deck name → omit the field**, don't guess.

6. **Estimate to ~5% precision.** A balcony cabin at `fore_aft: 62` vs `65`
   produces the same noise score against an overhead theater. Don't spend
   effort being more precise than the model can use.

7. **List every visible space**, including corridors, restrooms, elevator
   banks, and storage. They contribute to layout queries ("walk distance to
   nearest elevator") even when their `noise_level` is low.

## Mapping to the database

The seed script (`ingestion/seed.ts`, issue #8) reads these YAML files and
inserts rows into the database tables defined in `src/db/schema.ts`. The
shape is mostly 1:1:

| YAML | DB table | Notes |
|---|---|---|
| `ship.yaml` | `ships` (one row) | `slug` is unique |
| `deck-<n>.yaml` (top-level) | `decks` (one row per file) | `passenger` defaults true |
| `cabins[]` | `cabins` | `fore_aft`, `port_starboard` real columns |
| `spaces[]` | `spaces` | bbox stored as four real columns; `noise_level` int |

**Derived (not encoded in YAML)**: `cabin_space_proximity`. The seed script
computes this by stacking decks: for each cabin, find spaces within
`|vertical_decks| ≤ 3` and `horizontal_distance ≤ 30` (point-to-bbox
euclidean distance), insert one row per pair. The noise scoring algorithm
(`src/scoring/noise-score.ts`, issue #14) then aggregates over these rows
at query time using the formula it carries.
