# 08 — Multi-space board runtime

**Status:** In progress

## Goal

Replace the rejected board-memory concept with one persistent multi-space board runtime.

The world owns multiple fully isolated board spaces plus one universe-wide passive inventory. Every board item belongs to exactly one explicit space. The current space is persistent navigation state only; all spaces continue simulating together.

## Canonical contract

### Board location

Every board location is explicit and complete:

```text
scope: board
space: non-negative integer
position: board coordinate
```

`space` is mandatory in authoring, runtime, state, tests, and command inputs. There is no default, migration fallback, or implicit space `0`.

A board cell is uniquely identified by:

```text
space + x + y
```

Equal coordinates in different spaces do not conflict.

### Runtime root

```text
runtime.currentSpace
state.currentSpace
```

`currentSpace` is mandatory, persistent, and restored from save. It is separate from runtime-only `session` state.

`currentSpace` controls only the board currently presented to the player and the destination space of explicit inventory-to-board placement. It never filters simulation.

### Simulation

All spaces belong to one runtime world and advance together:

- jobs continue outside the current space;
- queues dispatch outside the current space;
- temporary items age and expire outside the current space;
- charges and completion continue outside the current space.

### Spatial isolation

All board-space operations are strictly local to one space:

- occupancy and free-cell search;
- stacking and spawn placement;
- random placement origin;
- distance, proximity, and external charge targets;
- merge, move, and swap;
- outputs, buffered release, and reservation release.

A board origin carries both `space` and `position`. Placement may fall back to the universe-wide inventory according to item scope, but it never searches or lands in another board space.

There is no direct board-to-board cross-space move, swap, merge, output, or placement. Inventory is the only bridge:

```text
board space A → inventory → board space B
```

### Navigation

```ts
setCurrentSpaceFx({ space })
```

is a normal root runtime command. It has no item dependency, unlock lookup, or revision. Jump/Home items are future UI representations only.

The first slice accepts any valid non-negative integer space. Unlock progression and destination authoring are explicitly out of scope.

## Scope

1. Add mandatory `space` to every board location.
2. Add mandatory persistent `currentSpace` to runtime and state roots.
3. Make occupancy, placement, random origin, and board queries space-aware.
4. Keep inventory global and passive.
5. Prevent every direct cross-space board operation.
6. Keep all spaces advancing through the same Tick runtime.
7. Add `setCurrentSpaceFx` and a committed navigation event.
8. Persist and restore `currentSpace` exactly.
9. Prepare engine readers so UI can filter board items by `currentSpace` without owning spatial rules.
10. Migrate current Arkini content and fixtures explicitly to space `0`.

## Out of scope

- board memory capture or restore;
- board-memory payloads, loss policies, or reconstruction;
- space unlock progression;
- jump/home gameplay authoring;
- UI navigation controls;
- different board dimensions per space;
- direct cross-space portals or placement fallbacks.

## Acceptance criteria

- no board location exists without explicit `space`;
- two board items may occupy the same x/y in different spaces;
- two board items may not occupy the same space/x/y;
- all spatial resolution stays inside the origin space;
- inventory fallback remains global and preserves live item state;
- direct cross-space move/swap/merge is rejected atomically;
- inventory-to-board placement targets `runtime.currentSpace`;
- off-screen spaces keep ticking and completing normally;
- `setCurrentSpaceFx` changes only persistent navigation state;
- save/restore round-trips `currentSpace` and every board item space;
- current Arkini content behaves identically in explicit space `0`;
- no optional/default space compatibility path exists.

## Required tests

- strict schema rejection for missing board `space` and missing `currentSpace`;
- occupancy independence across spaces;
- same-space placement, stacking, random origin, and inventory fallback;
- output and existing-item relocation remain in owner/origin space;
- proximity, deposit target, and distance rules ignore other spaces;
- cross-space move, swap, and merge rollback;
- inventory → board uses current space;
- board → inventory → another board space is the only supported bridge;
- background job completion and temporary expiry outside current space;
- navigation event and idempotent same-space command behavior;
- state round-trip with multiple spaces;
- explicit space `0` parity for current game content.

## Historical decision

The original board-memory concept is rejected and must not be implemented. It relied on destructive collect/reconstruct behavior with fragile identity, capacity, loss, and animation semantics. Multi-space boards use existing runtime identity, placement, inventory, Tick, and save contracts instead.
