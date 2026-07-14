# 01 — Craft lifecycle

**Status:** Ready

## Goal

Complete one craft as a true single-use gameplay lifecycle instead of merely running its generic line.

## Why first

Craft is the smallest specialized completion slice. It will force the engine to express owner-specific completion without prematurely inventing a generic special-item framework. Blueprint and stash must build on observed needs from this real slice, not on speculative abstraction.

## Current engine facts

- craft schema and authored game data exist;
- its line can resolve, start, reserve/consume inputs, run, pause, queue, and complete;
- generic line output already uses deterministic rolls and shared placement;
- the craft owner currently remains after completion;
- completion is atomic and blocked output keeps the job ready for retry.

## Historical oracle

Primary:

- `src/v0/craft/`;
- craft cases in `src/v0/engine/`;
- craft view and detail behavior under `src/v0/board/view/`, `src/v0/item-detail/`, and `src/v0/play/game-engine-bridge/`.

Extract behavior, especially:

- when the owner disappears or is replaced;
- what happens when output cannot be fully placed;
- input visibility and withdrawal rules before start;
- event/animation intent;
- whether identity at the craft cell is preserved or intentionally replaced.

## Do not port

- separate craft job/input save maps;
- wall-clock timestamps;
- craft-specific realtime synchronization;
- readiness that mutates time;
- UI-owned craft truth.

## Intended vertical slice

```text
craft definition
→ specialized completion resolution
→ all-or-nothing owner consumption + output placement
→ runtime invariant validation
→ craft completion events
→ flow tests
```

Reuse generic job, input, Tick, RNG, and placement behavior. Add specialization only where the craft contract differs from an ordinary producer.

## Acceptance criteria

- a completed craft consumes its owner exactly once;
- output is placed through the standard placement path;
- insufficient capacity leaves the ready job, owner, and reservations unchanged;
- retry produces the same deterministic output;
- inventory pause and queue rules remain unchanged;
- generic producer completion is unaffected;
- schema comments and gameplay documentation describe the implemented behavior truthfully.

## Required tests

- successful single-use completion;
- blocked completion and deterministic retry;
- reserved-input return/consumption semantics;
- owner moved to inventory before completion;
- queue successor behavior at the completion boundary;
- state round-trip with an active craft job;
- one end-to-end flow test using real authored shape.

## Historical cleanup on closeout

Delete historical craft runtime/save/timestamp machinery once all remaining UI, animation, and audio knowledge is captured in later task references. Keep only files explicitly listed for tasks 13–15.
