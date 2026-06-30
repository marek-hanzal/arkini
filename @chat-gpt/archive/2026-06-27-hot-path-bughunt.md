# 2026-06-27 hot-path bughunt

Focused pass over reachable producer/effect/placement hot paths.

Findings fixed:

- Queued producer jobs now re-check the scheduled-start gate when the queue reaches them. If a `line.blockStart`/hide effect appears after queueing but before the queued job's real start, the job pauses instead of silently starting under an invalid current effect state. Paused jobs require the same start gate to become valid before resuming.
- Existing passive effect stack/source creation time is preserved when moving stack items from inventory to board and when storing board items back into inventory. This keeps deterministic effect ordering stable instead of accidentally making old sources young again during DnD/storage.
- Partial consumption of inventory stacks preserves `createdAtMs` on the remaining stack. Without this, consuming one input from a passive stack could rewrite the tie-break age of the leftover effect sources.

Validation after the pass:

- `npm run check` passed.
- Test suite: 65 files, 430 tests.
