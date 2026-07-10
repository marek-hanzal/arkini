# v1 archive migration remainder

Branch: `migration/v1-archive`

## Migrated baseline

- 189 canonical items now exist in `game/arkini`.
- Their 189 legacy definitions were removed from `game/archive`; the archive now contains only unresolved migration backlog.
- 131 authoring fragments were added on top of the 58 fragments already migrated.
- Migrated content includes simple items, deposits, 74 craft items, 15 producers and four supported special items.
- `game/arkini/game.json` gained the `building`, `treasure` and `utility` categories.
- Schema tests now discover every `game/arkini/**/*.json` fragment recursively instead of maintaining a manual import list.

## 2026-07-10 migration pass

- Migrated another 55 canonical entities: 48 producers, four stash items and three path blueprints.
- `game/arkini` now contains 248 canonical items, including Shrine, its two temporary effect items, Inventory and Memory.
- Legacy `board_then_inventory` authoring was omitted; runtime board placement falls back according to the emitted item's scope independently of placement type.
- Zero-material lines use the explicit `{ "type": "simple" }` input.
- Legacy nearby requirements became current item-query `require` rules.
- Legacy nearby capacity spending became deposit inputs.
- University and path exclusivity now query owned keystone items directly instead of indirect path grants.
- Legacy dynamic output/grant modifiers and distance bands were intentionally removed.
- Lumberjack's dynamic per-source log chance became three explicit source lines: Tree `0.5`, Double Tree `0.65`, and Micro-Forest `0.85`. Counting and stacking multiple nearby sources remains deferred with the future rule pass.

All 249 source fragments pass `GameSourceSchema`; the merged 248-item configuration passes `GameSchema`.

## Migration decisions and remaining model work

### Migrated: authored initial game state

`GameSchema` now owns an explicit `startingState` with board placements and inventory quantities. Completed-game validation requires referenced items to exist, keeps board coordinates inside the configured dimensions, and rejects duplicate initial board cells.

### Migrated special item types

- `inventory`
- `memory`

Both discriminators now have concrete item schemas and canonical definitions. Inventory is a singleton board item. Memory is an individual board-or-inventory item with ordered empty/full assets. Their runtime behavior remains deferred.

### Migrated redesign: effects as temporary items

Do not add a detached persistent-grant state subsystem. Shrine creates real items with temporary effect durations. Each item occupies board space, participates in existing item mechanics, and disappears when its duration expires.

Historical active grant identities were remapped as follows:

- `grant:active:shrine-minor-haste` -> `item:effect:minor-haste`
- `grant:active:shrine-bountiful-offering` -> `item:effect:bountiful-offering`

The Shrine remains a normal producer: the player supplies its materials, waits for the production line, and then receives the board-only temporary effect item. Rules reacting to those items remain a later gameplay concern and do not block the canonical entity migration.

### Removed: legacy dynamic output-effect subsystem

The archived dynamic output-effect subsystem was not migrated. The current rule system remains the canonical model. Any genuinely missing behavior will be reconsidered later as a dedicated rule-system quest.

### Removed pending redesign: conditional runtime bands

The archived mutually exclusive distance-band behavior was intentionally not preserved. It will be redesigned later using the current rule system.

### Archive status

No JSON configuration remains in the archive. It now preserves historical design prose only.
