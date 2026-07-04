# Runtime state boundary pass

Commit: see git log entry for this archive note

Goal: continue the deep cleanup after job/effect/input boundaries by centralizing remaining save-state writes that still represented lifecycle ownership instead of arbitrary data edits.

Changes:

- Added `writeBoardItemToSaveFx` and routed board item creation/replacement writes through it, including debug readiness simulation.
- Added item capacity write/remove boundaries and routed nearby capacity spending plus board-item cascade cleanup through them.
- Added producer charge write/remove boundaries and routed producer completion plus cascade cleanup through them.
- Added producer line state write/remove boundaries and routed default-line selection plus cascade cleanup through them.
- Added board-memory layout write/remove boundaries and routed save/restore/clear actions through them.
- Updated `removeBoardItemRuntimeStateFx` to use job-removal and runtime-state-removal boundaries instead of raw map deletes.
- Tightened `audit:current` to reject raw board item writes and raw runtime-state writes/removals outside the named boundaries.

Rationale:

After removing prop-only scopes and centralizing job/effect/input lifecycle, the next low-risk cleanup surface was direct map mutation around board/producible runtime state. These mutations were simple assignments/deletes, but their ownership matters because later lifecycle metadata or cleanup rules should not require hunting random save map writes through producer, capacity, debug, and board-memory routes.
