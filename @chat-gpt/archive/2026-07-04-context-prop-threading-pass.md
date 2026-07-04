# Context prop-threading pass

Date: 2026-07-04
Commit: see git history for this archive file

## Goal

Continue the deep low-quality-code review by removing local Effect `Context.Tag` scopes that only carried stable call props or tiny mutable route state. These were not real services; they hid direct data flow and made routes harder to grep.

## Changes

- Flattened `src/world/processWorldSnapshotFx.ts` so snapshot processing passes `{ config, save, nowMs }` explicitly through private Fx helpers instead of providing `WorldSnapshotProcessingScopeFx`.
- Flattened activation input resolution/consumption:
  - removed `ResolveInputRefsScopeFx` from `src/activation/resolveInputRefsFx.ts`.
  - removed `ConsumeResolvedInputRefScopeFx` from `src/activation/consumeResolvedInputRefFx.ts`.
  - duplicate input tracking now lives as explicit local `seen` state threaded through the resolver.
- Flattened board stash orchestration in `src/stash/stashBoardItemFx.ts`; stash state and inventory placement now receive explicit props instead of `BoardItemStashScopeFx`.
- Flattened tile removal orchestration in `src/remove/removeTileFx.ts`; removal readiness, tool consumption, output placement, and result building now pass props directly instead of `RemoveTileScopeFx`.
- Reused `writeStoredActivationInputQuantityFx` from `src/producer/consumeProducerStoredInputsFx.ts` so producer stored-input consumption uses the shared stored input quantity writer instead of a private `items[itemId]` write/delete snippet.

## Current signals

- `src/**/logic`: 0 files.
- local `Context.Tag` occurrences in `src`: reduced from 33 after the previous pass to 28.
- `audit:current`, formatting, schema check, game validate, depcruise, typecheck, and optional dead/duplicate audits pass.

## Notes

Do not flatten real ambient services such as `GameConfigFx`, `GameSaveDraftScopeFx`, or `RandomServiceFx`. The smell is local one-file scopes that merely avoid passing stable props through private helpers.
