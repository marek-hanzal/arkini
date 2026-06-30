# Third cleanup pass, mental-load reduction

Date: 2026-06-23
Base: `53b029f Document map lightening pass`

This pass focused on code that was hard to keep in short-term memory: stale service layers, dead schema aliases, fake inventory state fields, duplicated passive quantity loops, and helper files that survived earlier migrations without an active runtime owner.

## Removed stale service islands

Deleted unused service wrappers around date/id/hash utilities. The runtime still keeps the useful leaves:

- `src/v0/id/logic/genId.ts`
- `src/v0/hash/logic/sha256.ts`

The removed `DateService`, `IdService`, and `HashService` layers were not imported by the active runtime and mostly forced readers to wonder whether there was hidden dependency injection policy. There was not. It was just fossilized architecture confetti.

## Removed stale model/schema/helper files

Deleted old DB-era or transitional files that were no longer imported by active code:

- old activation depletion/mode schemas
- old board/inventory/item-instance row/id/location schemas
- old inventory JSON state helpers
- unused debug `StatusPill`
- unused craft requirement splitter
- tiny unused serialization wrappers
- unused game-engine bridge/model barrels

The important rule: this pass did not delete the standalone game engine WIP or its test fixtures just because they are not imported by the browser entrypoint.

## Shared passive quantity reader

Producer, craft, stash, hindrance and requirement views had repeated board/inventory quantity loops. Those now use `readGameSaveItemQuantityByScope`, so passive requirement quantity means one thing in one place.

## Simplified requirement checks

`checkGameRequirementsFx` no longer receives an unused `config` prop. `targetItemInstanceId` is now explicit and required, matching the fact that proximity and stored requirement checks are target-sensitive.

## Removed fake inventory state view fields

Inventory view stacks no longer expose `state`, `stateJson`, or `stateful`. Current runtime inventory slots represent either a stack or an instance, but the view was always emitting empty `{}` state data. That made callers compare fake metadata and made tests carry noise.

Inventory slot projection now has one shared reader: `readRuntimeInventorySlotFromGameSave`.

## Typed CLI merge bootstrap honestly

`createEmptyPackage` no longer uses `undefined as never` for singleton sections. The merge output is now typed as a compiled package with optional singleton fields until full schema validation proves it complete.

## Intentionally not changed

Do not reintroduce a broad DnD lock for running producers. Moving a running producer on the board is currently valid because producer jobs and stored runtime state are keyed by item instance, not by fixed board cell.
