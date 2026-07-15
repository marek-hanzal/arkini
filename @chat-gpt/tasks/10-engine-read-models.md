# 10 — Engine-owned read models

**Status:** Queued

## Goal

Expose the smallest coherent public engine reads required by the renderer, without moving gameplay truth into React or recreating the historical bridge as a second engine.

## Dependency

Core gameplay lifecycles should be known first so read contracts describe actual behavior rather than anticipated shapes.

## Historical oracle

Treat these as an information-requirement catalogue, not architecture:

- `src/v0/play/game-engine-bridge/`;
- `src/v0/board/view/`;
- `src/v0/producer/view/`;
- `src/v0/item-detail/`;
- relevant debug explanations.

## Candidate read surfaces

- board and inventory item presentation facts;
- line visibility, run/queue/blocked status, progress, and missing inputs;
- charge readiness facts owned by the engine: payer kind (`self | target`), resolved payer runtime item ID when available, required charges, available charges, missing charges, and blocked reason;
- queue facts required to present blocked FIFO work and the explicit clear-all-pending command without implying that active jobs are cancellable;
- item target/max-count facts;
- input slot state and accepted quantity;
- job/reservation state;
- utility capability state;
- human-readable blocked reasons where product needs them.

## Do not port

- previous/current save diffing as gameplay interpretation;
- UI selectors that recompute eligibility;
- one giant universal view model;
- a DTO family mirroring every runtime schema;
- cached read models treated as authoritative state.

## Acceptance criteria

- every gameplay boolean is decided by the engine;
- a charge-blocked input or queued start exposes enough engine-owned facts for UI to explain the exact payer and deficit without reading raw config/runtime and rebuilding charge logic;
- queue reads expose whether pending requests exist so UI can offer clear-all while active-job cancellation remains unavailable;
- reads are pure snapshot projections and never catch up time or mutate state;
- public surfaces are coherent by use case, not one method per field;
- raw runtime remains available where presentation-only projection is sufficient;
- React adapters remain thin.

## Required tests

- read/write agreement for line start and blocked reasons;
- read behavior across Tick boundaries;
- queue, reservation, inventory pause, and special-item states;
- no mutation during reads;
- architecture guard against UI imports of internal planners.

## Historical cleanup on closeout

Delete historical bridge/view computations that are fully represented by public engine reads. Leave animation/audio planning for tasks 14–15 only.
