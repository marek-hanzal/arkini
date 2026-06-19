# TileEngine complexity audit

Status: first implementation pass completed. Keep for next TileEngine follow-up context.

## Goal

Reduce TileEngine mental load without breaking the generic engine boundary or hiding real DnD/motion complexity behind cute helpers that do nothing. TileEngine is allowed to be complex where pointer lifecycle, DOM measurement, WAAPI, handoff, and commit ordering genuinely require it.

## Current shape

`src/v0/tile-engine` is a flat package-like boundary with 62 TS/TSX files. The flatness is mostly intentional: code outside the directory imports only the public barrel, while internal files can be refactored freely. Do not introduce nested folders unless the folder can strongly defend a domain boundary. For now, prefer flat files with precise names.

Longest files:

- `useTilePointerUp.ts` - 379 lines
- `TileMotionRuntime.ts` - 367 lines
- `TileEngineActor.tsx` - 249 lines
- `useTileActorMotion.ts` - 237 lines
- `TileEngineMotionRequestStore.ts` - 224 lines
- `TileEngineSlot.tsx` - 202 lines

## Inherent complexity to respect

- Pointer lifecycle has real states: tap, long press, drag threshold, move, hover, drop, cancel.
- Drop finalization must coordinate source motion, optional target motion, handoff, commit timing, rollback, and transform cleanup.
- WAAPI runtime must support cancellation, style committing, fallback animation, and stale motion replacement.
- Layout motion must handle actor remount/move without fighting active drag or drop handoff.
- TileEngine must remain domain-generic. No Arkini item/craft/producer logic belongs here.

## Accidental complexity found

### 1. `useTilePointerUp.ts` is the first real cleanup target

This file currently owns too many phases at once:

- tap release handling
- drop rect resolution
- `onDrop` call
- outcome kind/animation/commit decoding
- parallel merge shortcut
- source/target handoff creation
- parallel swap target actor lookup
- source motion + target motion orchestration
- commit execution and rollback on error
- final `finishDrag` / transform reset policy

The behavior is important, but the file is mentally expensive because the happy path, reject path, parallel swap path, parallel merge path, and error recovery are all inline.

Recommended first implementation pass:

- Keep public hook contract unchanged.
- Extract pure/small helpers in the same flat directory, no nested folder:
  - `createTileDropMotionId.ts`
  - `createTileDropHandoffs.ts`
  - `runTileDropCommit.ts`
  - maybe `runTileDropMotion.ts` only if it meaningfully isolates source/target parallel motion.
- Keep the hook as the pointer lifecycle entrypoint, but make the async drop finalization read like phases:
  1. read session/source/release rect
  2. resolve drop and outcome
  3. run accepted drop motion if any
  4. set handoff
  5. commit or rollback
  6. cleanup
- Preserve current behavior exactly, especially:
  - `parallel-merge` commits immediately without snap motion
  - `parallel-swap` moves both source and target when target actor exists
  - cancelled motion skips reset when runtime already froze state
  - commit failure animates source back

### 2. `TileMotionRuntime.ts` is dense but mostly justified

This file combines WAAPI/fallback start, active motion registry, cancellation, style commit/freeze, and transform wrapper. The line count is high, but the boundary is coherent: one runtime for one active motion scope system.

Do not split this first just to satisfy line count. If it becomes a target later, the only useful split is mechanical:

- `startElementAnimation.ts` for WAAPI/fallback control creation
- keep active scope registry in `TileMotionRuntime.ts`

But this is lower priority than pointer-up because splitting it can increase navigation cost without reducing domain complexity.

### 3. `TileEngineActor.tsx` is an orchestrator, not necessarily broken

It wires timers, tap, motion, drag handlers, render props, memo comparison, debug lifecycle, and cancellation on unmount. The file is slightly long, but the component role is clear.

Possible future cleanup after pointer-up:

- move `sameTileEngineActorProps` to `sameTileEngineActorProps.ts`
- avoid changing actor behavior while pointer-up is being cleaned

### 4. `useTileActorMotion.ts` is a second possible cleanup target

It owns two different concepts:

- layout motion after slot change
- imperative drag/drop motion helpers: `animateBack`, `animateToTarget`

This split is understandable but a little cramped. Future possible split:

- `useTileActorLayoutMotion.ts`
- keep `useTileActorMotion.ts` for imperative drop/reject motion helpers

Do this only after pointer-up, because pointer-up depends on the current helper contract.

### 5. `TileEngineMotionRequestStore.ts` is acceptable for now

It is an external store for presence motion requests keyed by engine/tile. It includes cleanup scheduling and group clearing. This is cohesive enough.

Possible future improvement:

- add more tests around cleanup replacement if bugs appear
- do not split now

### 6. `TileEngineSlot.tsx` has mild mixed concerns

It renders a slot, registers a drop target, and owns long-press-on-empty-slot behavior. This is slightly mixed but currently understandable.

Possible future cleanup:

- extract `useTileSlotLongPress.ts`
- extract `sameTileEngineSlotProps.ts`

Lower priority than pointer-up.

## Topology decision

Do not add nested folders during the first TileEngine pass. `tile-engine` is already a package boundary, and deep folders inside it would probably increase lookup cost. The immediate problem is not folder depth; it is a few files holding multiple lifecycle phases inline.

## Completed first implementation task

`useTilePointerUp.ts` phase extraction was completed on `2026-06-19`. The hook now keeps pointer lifecycle orchestration while drop motion, commit logging, motion ids, and handoff creation live in focused flat helper files.

Completed acceptance:

- `useTilePointerUp.ts` is reduced from the pointer-up monolith into phase orchestration.
- Public `TileEngine` barrel/API stayed unchanged.
- No Arkini domain imports entered `src/v0/tile-engine`.
- No nested folders were introduced.
- Existing checks passed.

Second implementation task completed on `2026-06-19`: `useTileActorMotion.ts` now delegates passive layout motion to `useTileActorLayoutMotion.ts` while keeping the same public imperative `animateBack` / `animateToTarget` contract.

Third implementation task completed on `2026-06-19`: `TileEngineActor.tsx` now delegates memo prop comparison to `sameTileEngineActorProps.ts`, feedback debug logging to `useTileActorFeedbackDebug.ts`, and shared active drop feedback equality to `sameTileEngineDropFeedback.ts`.

Fourth implementation task completed on `2026-06-19`: `TileEngineSlot.tsx` now delegates long-press pointer timer lifecycle to `useTileSlotLongPress.ts`, feedback debug logging to `useTileSlotFeedbackDebug.ts`, and memo comparison to `sameTileEngineSlotProps.ts`. The slot component is now a compact slot render/drop registration orchestrator.

Future caution: validate in browser before deeper TileEngine cleanup. `TileEngineSlot.tsx` long-press extraction is done. Do not split `TileMotionRuntime.ts` just for line count.

