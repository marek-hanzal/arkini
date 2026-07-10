# v1 archive migration blockers

Branch: `migration/v1-archive`

## Migrated

- 189 canonical items now exist in `game/arkini`.
- Their 189 legacy definitions were removed from `game/archive`; the archive now contains only unresolved migration backlog.
- 131 authoring fragments were added on top of the 58 fragments already migrated.
- Migrated content includes simple items, deposits, 74 craft items, 15 producers and four supported special items.
- `game/arkini/game.json` gained the `building`, `treasure` and `utility` categories.
- Schema tests now discover every `game/arkini/**/*.json` fragment recursively instead of maintaining a manual import list.

All 190 source fragments pass `GameSourceSchema`; the merged 189-item configuration passes `GameSchema`.

## Migration decisions and remaining model work

### Deferred: authored initial game state

`GameSchema`/`MetaSchema` have no equivalent of archive `startingState`. Initial board and inventory authoring is intentionally deferred until the game implementation needs it; it does not block the current definition-schema pass.

### Reserved special item types

- `inventory`
- `memory`

Both discriminators now exist in `ItemEnumSchema`. Their concrete item schemas and runtime behavior remain deferred. The canonical type is `memory`, not `board-memory`.

### Resolved model: explicit simple input

`LineSchema.input` remains a non-empty tuple. Legitimate zero-material production lines use the explicit `{ "type": "simple" }` input, which carries no material consumption, reservation, quantity, capacity, or deposit operation.

Affected producers include:

- `producer:cookhouse-t1`
- `producer:lumberjack-t1`
- `producer:quarry-t1`
- `producer:quarry-t2`
- `producer:sand-pit`
- `producer:townhall-t2`
- `producer:townhall-t3`
- `producer:townhall-t4`
- `producer:well-t1`

### Deferred redesign: effects as temporary items

Do not add a detached persistent-grant state subsystem. The intended redesign is for a shrine or another source to create a real item with a temporary effect duration. The item occupies board space, participates in existing item mechanics, and disappears when its duration expires. Schema support for item lifetime/expiry will be designed with that gameplay pass.

Historical grant identities that need remapping include:

- `grant:active:shrine-minor-haste`
- `grant:active:shrine-bountiful-offering`
- `grant:path:engineers`
- `grant:path:faith`
- `grant:path:mages`

This work remains deferred together with the shrine, path blueprints and path-dependent University behavior.

### Obsolete: legacy dynamic output-effect subsystem

The archived dynamic output-effect subsystem will not be migrated. The current rule system remains the canonical model. Legacy effects will be deleted from migrated definitions first; any genuinely missing behavior will be reconsidered later as a dedicated rule-system quest.

### Deferred simplification: conditional runtime bands

The archived mutually exclusive distance-band behavior is intentionally not preserved during the first migration. It was overcomplicated and will be redesigned later using the current rule system.

Affected producer families include farms, animal producers, Brewery and Winery.

### Resolved runtime policy: implicit inventory fallback

`board_then_inventory` is not an authored placement strategy. Every placement type only selects how runtime attempts board placement. Independently of that type, runtime checks available board space and uses the emitted item's scope to decide whether anything that does not fit may fall back to inventory. Archived `board_then_inventory` fields are omitted during migration.

This unblocks placement mapping for:

- `item:chest-t1` through `item:chest-t4`
- `producer:waste-processor-t1`
- `producer:waste-processor-t2`
- `producer:bio-waste-processor-t1`
- `producer:bio-waste-processor-t2`

### Remaining archive entities

The remaining 58 legacy definitions are the actual migration backlog:

- 49 producers
- 4 stash items
- 3 path blueprints
- 2 special items

The migrated WIP config still contains dangling item references to producers and chests that remain in the archive. This is intentional during the schema-design pass and must reach zero before the configuration is treated as definition-complete.
