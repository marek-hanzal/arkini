# v0 producer blocked delivery

Status: completed 2026-06-18

Implemented producer delivery blocking semantics:

- Producer output now rolls once. When completion cannot place the output, the rolled items are stored on `producerJobs[jobId].delivery.items`.
- Pending producer delivery keeps the original producer job in `save.producerJobs`, so it continues to count against producer queue capacity. The package is stuck in the doorway; the slot is not free.
- Blocked producer delivery retries through `delivery.retryAtMs` using the same one-second cadence policy as blocked scheduled spawn events.
- Repeated blocked retries do not spam `product.blocked` events. The first block emits, later retries only update delivery timing.
- Successful retry places the persisted delivery items and only then deletes the producer job.
- Runtime board view exposes `activation.deliveryBlocked` for producer tiles with blocked delivery. Board cells map that to a generic TileEngine-ish danger frame via the existing generic feedback variant vocabulary. Keep it subtle.

Placement notes:

- `placeGameSaveItemsFx` remains the placement transaction/reservation layer: it clones the save, mutates placements into that clone as reservations, and only returns placed when the full request fits.
- Producer completions are processed sequentially against the updated save, so multiple producers completing in one tick cannot reserve the same board cell.
- Do not reintroduce producer completion preflight + scheduled spawn for product output unless the pending delivery model is preserved. Preflight without persisted delivery rerolls random output when full, which is wrong.

Tests added/updated:

- Blocked producer delivery stores rolled items and next retry wake.
- Blocked delivery retries without rerolling even if the loot table changes before delivery succeeds.
- Blocked delivery stays quiet until retry and does not spam block events.
- Multiple producers completing in one tick reserve distinct output cells.
- Board view marks blocked producer delivery as `activation.deliveryBlocked`.

Follow-up candidates:

1. Producer board progress bar: show active running job directly on producer tile.
2. Tile detail executable-interaction parity: detail must not promise interactions runtime cannot execute.
3. Touch/long-press polish.
