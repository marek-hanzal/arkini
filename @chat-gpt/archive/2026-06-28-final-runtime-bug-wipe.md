# 2026-06-28 final runtime bug wipe

Focus: final high-impact logic/gameplay pass around producers, effects, stash/chest zero-duration output, and board movement/swap semantics.

Findings fixed:

- Running producer items may move and swap on the board because producer jobs follow `producerItemInstanceId`, not coordinates. Craft targets stay pinned. Swap readiness now matches move readiness: craft-busy blocks, producer-busy does not.
- Producer product durations now preserve authored/effective zero. `durationMs: 0`, `duration.multiply: 0`, or negative duration adjustments clamped to zero complete in the same action/tick instead of being silently delayed by 1 ms.
- Stash/chest products using zero duration now open immediately in the same action, including depletion replacement/removal behavior.
- Zero-duration product-activated effects activate, complete, and expire in the same action, leaving no dangling active effect/job state.
- Removed the now-dead generic board-item-idle helper after swap readiness stopped treating producer-busy and craft-busy as the same thing.

Validation after the pass:

- `npm run check` passed: format check, game config validation, dependency cruiser, typecheck, full Vitest suite.
- Full test suite after changes: 69 files, 458 tests passed.
- Known warning remains `game/arkini.assets.json` over Biome max file size; not a gameplay/runtime issue.
