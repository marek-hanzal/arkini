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
- `game/arkini` now contains 244 canonical items.
- Legacy `board_then_inventory` authoring was omitted; runtime board placement falls back according to the emitted item's scope independently of placement type.
- Zero-material lines use the explicit `{ "type": "simple" }` input.
- Legacy nearby requirements became current item-query `require` rules.
- Legacy nearby capacity spending became deposit inputs.
- University and path exclusivity now query owned keystone items directly instead of indirect path grants.
- Legacy dynamic output/grant modifiers and distance bands were intentionally removed.
- Lumberjack's dynamic per-source log chance became three explicit source lines: Tree `0.5`, Double Tree `0.65`, and Micro-Forest `0.85`. Counting and stacking multiple nearby sources remains deferred with the future rule pass.

All 245 source fragments pass `GameSourceSchema`; the merged 244-item configuration passes `GameSchema`.

## Migration decisions and remaining model work

### Deferred: authored initial game state

`GameSchema`/`MetaSchema` have no equivalent of archive `startingState`. Initial board and inventory authoring is intentionally deferred until the game implementation needs it; it does not block the current definition-schema pass.

### Reserved special item types

- `inventory`
- `memory`

Both discriminators now exist in `ItemEnumSchema`. Their concrete item schemas and runtime behavior remain deferred. The canonical type is `memory`, not `board-memory`.

### Deferred redesign: effects as temporary items

Do not add a detached persistent-grant state subsystem. The intended redesign is for a shrine or another source to create a real item with a temporary effect duration. The item occupies board space, participates in existing item mechanics, and disappears when its duration expires. Schema support for item lifetime/expiry will be designed with that gameplay pass.

Historical active grant identities that need remapping include:

- `grant:active:shrine-minor-haste`
- `grant:active:shrine-bountiful-offering`
This work remains deferred together with the shrine. Path ownership no longer needs grants because current rules query keystone items directly.

### Removed: legacy dynamic output-effect subsystem

The archived dynamic output-effect subsystem was not migrated. The current rule system remains the canonical model. Any genuinely missing behavior will be reconsidered later as a dedicated rule-system quest.

### Removed pending redesign: conditional runtime bands

The archived mutually exclusive distance-band behavior was intentionally not preserved. It will be redesigned later using the current rule system.

### Remaining archive entities

The remaining three legacy definitions are the actual migration backlog:

- `producer:shrine-t1`
- `item:inventory`
- `item:board-memory`, whose future v1 type is `memory`

The only remaining canonical dangling reference is `producer:shrine-t1` from its already migrated blueprint. It stays intentional until temporary effect items and expiry are designed.
