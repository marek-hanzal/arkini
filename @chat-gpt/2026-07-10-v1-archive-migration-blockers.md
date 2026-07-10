# v1 archive migration blockers

Branch: `migration/v1-archive`

## Migrated

- 189 canonical items now exist in `game/arkini`.
- 131 authoring fragments were added on top of the 58 fragments already migrated.
- Migrated content includes simple items, deposits, 74 craft items, 15 producers and four supported special items.
- `game/arkini/game.json` gained the `building`, `treasure` and `utility` categories.
- Schema tests now discover every `game/arkini/**/*.json` fragment recursively instead of maintaining a manual import list.

All 190 source fragments pass `GameSourceSchema`; the merged 189-item configuration passes `GameSchema`.

## Hard model gaps

### Game state cannot be authored

`GameSchema`/`MetaSchema` have no equivalent of archive `startingState`, so the initial board and inventory cannot be migrated.

### Missing special item types

- `item:inventory`
- `item:board-memory`

The four other root special items are representable and were migrated.

### Autonomous product lines are forbidden

`LineSchema.input` is a non-empty tuple. This blocks legitimate zero-material production lines:

- `producer:cookhouse-t1`
- `producer:quarry-t2`
- `producer:sand-pit`
- `producer:townhall-t2`
- `producer:townhall-t3`
- `producer:townhall-t4`
- `producer:well-t1`

A line must be allowed to have `input: []`; otherwise the model cannot represent producers driven only by runtime, proximity or an output/effect.

### Persistent and timed grants do not exist

Queries can inspect items only. They cannot inspect persistent gameplay state such as:

- `grant:active:shrine-minor-haste`
- `grant:active:shrine-bountiful-offering`
- `grant:path:engineers`
- `grant:path:faith`
- `grant:path:mages`

This blocks the shrine itself, three mutually exclusive path blueprints and path-dependent University drops.

### Dynamic output chance cannot be expressed

There is no rule that modifies a roll's chance or adds an extra output chance based on a condition. This blocks the shrine's bountiful bonus on 39 producers and the Lumberjack's per-nearby-source output chance.

### Conditional runtime bands are not safely expressible

The archive uses mutually exclusive distance bands such as `close => 2x`, `near => 1.5x`. Current board queries are cumulative radii, so two independent multiplier rules would stack for a close item and change the behavior.

Affected producer families include farms, animal producers, Brewery and Winery.

### `board_then_inventory` placement is missing

`PlacementEnumSchema` has only `drop`, `random` and `replace`. It cannot preserve explicit board-first, inventory-fallback delivery used by:

- `item:chest-t1` through `item:chest-t4`
- `producer:waste-processor-t1`
- `producer:waste-processor-t2`
- `producer:bio-waste-processor-t1`
- `producer:bio-waste-processor-t2`

### Blocked archive entities

- 49 producers
- 4 stash items
- 3 path blueprints
- 2 special items

Because those canonical entities cannot yet be represented, the migrated WIP config currently contains 53 dangling item references to blocked producers and chests. This is intentional for the schema-design branch and must be resolved before the configuration is treated as runtime-complete.
