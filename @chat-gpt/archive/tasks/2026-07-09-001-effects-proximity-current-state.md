# Effects/proximity current-state map

Status: analysis/reference task. No runtime behavior change.

## What effects can do today

There are three different effect surfaces:

1. Passive item effects: `items.*.effects` grant ids while matching item instances exist. Default `sourceScope` is `board`; `inventory` and `both` are supported. Board and inventory stack quantities create repeated source instances. These are collapsed to grant ids by `readGameWorldGrantIds`.
2. Active line effects: `producer.lines[*].effect` creates timed grants through producer jobs and `save.activeEffects`. Live config currently uses this only for the shrine haste/bountiful lines.
3. Runtime line/drop effects: `line.effects`, `craft.effects`, and output-entry `effects` change availability, visibility, duration, capacity spending, and bonus loot.

Supported common line/drop effect kinds:

- `grant.require`: requires an active/passive grant; supports `phase: "start" | "visibility"`.
- `grant.blockStart`: disables start while a grant selector matches.
- `nearby.require`: requires a matching board item in a distance bucket; supports `phase: "start" | "visibility"`.
- `nearby.capacity.spend`: line-owned capacity consumption from nearest matching nearby board source; live config uses it for lumberjack/quarry deposits.
- `nearby.duration.multiply`: multiplies duration per matching nearby source and per distance band; supports `maxSources`.
- `grant.duration.multiply`: multiplies duration while a grant selector matches.

Output/drop-only effect kinds:

- `grant.drop.hide` / `grant.drop.show`
- `grant.drop.disable` / `grant.drop.enable`
- `grant.loot.extraOutputChance.add`
- `nearby.loot.outputChance.add`

Craft runtime support is intentionally narrower: `grant.require` with `phase: "start"` and `grant.blockStart` only.

## What proximity/distance can do today

The old `proximity` concept is now implemented as `nearby.*` effects. `proximity` mostly survives in docs/history.

Distance is Chebyshev grid distance from the target item instance cell:

```ts
Math.max(Math.abs(dx), Math.abs(dy))
```

Buckets are hard-coded:

- `neighbour`: distance `<= 1`, including diagonals and the same cell if selectors ever allow self-match.
- `near`: distance `<= 2`.
- `any`: any board distance.

Nearby matching scans `save.board.items`, filters by resolved domain selector, computes distance, filters by bucket, then sorts by distance and item instance id. Inventory never participates in local nearby checks because it has no board position.

Current nearby behaviors:

- `nearby.require`: at least one nearby match gates line/drop start or visibility.
- `nearby.capacity.spend`: chooses the nearest matching board item with enough remaining capacity and spends it when the job starts.
- `nearby.duration.multiply`: finds matching board sources up to the widest authored band, then applies the multiplier from the exact distance bucket of each source.
- `nearby.loot.outputChance.add`: adds chance per matching nearby source.

## Live content shape

Approximate source-config counts from `game/arkini`:

- Passive item grant effects: 60.
- Active line effects: 2.
- Craft effects: 44 (`grant.require` 38, `grant.blockStart` 6).
- Line-level effects: 2 (`nearby.capacity.spend` only).
- Output/drop effects: 208 total.
  - `nearby.require`: 102
  - `grant.loot.extraOutputChance.add`: 76
  - `nearby.duration.multiply`: 14
  - `grant.duration.multiply`: 9
  - `grant.drop.hide`: 6
  - `nearby.loot.outputChance.add`: 1

## Main pain points

- The same broad effect union is accepted in multiple places, then runtime silently treats some kinds differently depending on owner. Example: duration effects live on output entries but are ignored by `readEffectiveDrop` and handled in a separate duration pass. Cute little footgun factory.
- `nearby.require` is duplicated heavily on output entries, often repeated for guaranteed and chance variants in the same line.
- Distance is an enum of semantic buckets, not an explicit radius. That is readable for content, but hard to tune globally or per item without changing hard-coded helper logic.
- Nearby matching logic is repeated across requirements, duration, loot chance, and capacity spending instead of one explicit distance/match service.
- `nearby.capacity.spend` is line-owned while most other meaningful output behavior is output-owned, so effect ownership rules are harder to explain than they should be.
- UI/runtime display rules (`display`, `active`, `ready`, `phase`, bonus lines) are spread across several helpers and are easy to desync.

