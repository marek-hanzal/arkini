# 01 — Craft lifecycle

**Status:** Done

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

## Final decisions

- Job completion dispatches to explicit producer, craft, blueprint, and stash branches after resolving shared live facts once.
- No schema shape or contract changed. Only the stale craft schema comment was aligned with implemented runtime behavior; craft replacement uses the existing resolved `line.output` placement contract.
- A stacked craft is isolated by the first operation that attaches identity-bound state. Material delivery may therefore isolate it before start; a simple-input craft is isolated when start creates its job. Start still resolves eligibility from the pre-command world, and a split performed by that same start may intentionally change rules and pause the job on its first Tick.
- A placement failure aborts the whole start before the job or split commits.
- The separated remainder can start another independent craft while the first job is active.
- Runtime purity is composed from line input, active-job, and queue state. Generic placement and quantity writes reject non-pure items at both planning and apply boundaries.
- Craft material inputs author only `capacity: 0`; a running zero-capacity input is closed and hydrated buffered state is rejected by runtime validation.
- One completed job consumes its already isolated craft owner exactly once.
- A resolved `replace` drop claims the original craft cell first; without replacement, owner removal frees that cell for ordinary output.
- Completion output claims capacity before reservation return.
- Blueprint and stash lifecycle remain intentionally partial in their own explicit branches until tasks 02 and 03.
- The existing generic `job:completed` event remains the engine event. Presentation-specific enrichment belongs to task 14 and requires an explicit event-contract decision rather than an unreviewed schema change.

## Verification completed

- ordinary output from a consumed owner;
- replacement plus additional output;
- sink craft with no output;
- stacked craft isolation during first input attachment or start;
- parallel starts from successively separated craft quantities;
- atomic start rejection when the remainder has no placement capacity;
- replacement completion while the previously separated remainder stays available;
- blocked deterministic retry;
- consume/reserve semantics;
- inventory pause;
- queue capacity remains one total owner-work slot, so a single-use craft cannot retain a successor behind its active job;
- active-job state round-trip;
- authored seed flow using a stack of three;
- active/queued/buffered owners excluded from stacking;
- paused active owner excluded in inventory;
- direct quantity mutation rejected for stateful owners;
- zero-capacity input closure and positive-capacity live storage;
- effective singleton stack diagnostics for any non-pure owner and closed-input diagnostics;
- explicit pre-command start resolution followed by first-Tick pause after split.

## Historical cleanup result

Craft runtime behavior is fully superseded. Historical `craft/` remains only for tasks 13–15 presentation details and is marked accordingly by its local README.
