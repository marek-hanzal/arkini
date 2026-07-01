# 2026-07-01 Final drop/effect truth pass

## Context
After several drop-owned effect review passes, the final pre-feature pass focused on subtle UI/runtime truth drift rather than the obvious disabled/hidden output bugs.

## Findings and fixes
- Drop-owned `grant.require` and `nearby.require` start-phase effects used to report `result: "enabled"` when the requirement was satisfied. That was misleading because satisfied requirements are gates only; they must not re-enable a drop that an earlier effect disabled. The runtime behavior was already correct, but the UI explanation could lie. Ready start requirements now report `"requirement met"`; explicit `grant.drop.enable` remains the only drop effect that reports and performs `"enabled"`.
- Duration effect summaries used `effectiveProductLine.durationMs / baseDurationMs`. That mixed gameplay effect truth with cheat-speed-clamped runtime timing. In instant mode, a real `0.75` haste could be rendered as an absurd almost-100% speedup. `EffectiveProducerProductLine` now carries the pre-cheat `effectDurationMultiplier`; bonus summaries and product-line views use that value, while `durationMs` remains the actual runtime duration after cheat speed is applied.
- Detail UI now accepts and renders faster multipliers (`< 1`) instead of only showing slower multipliers. The view schema was relaxed from `min(1)` to `positive()` because buffs are valid UI data, not a schema crime scene.

## Tests
- Added coverage that a ready drop start requirement says `requirement met` while the same drop remains disabled by an earlier explicit disable effect.
- Added coverage that duration bonus copy uses `effectDurationMultiplier` instead of cheat-clamped `durationMs`.
- Added coverage that detail UI renders faster multipliers.

## Verification
- `npm run format:check` passes with the known large generated asset warning.
- `npm run game:validate -- game/arkini` passes with the known unused packaged resource warnings.
- `npm run dc` passes.
- `npm run typecheck` passes.
- `npm run test -- --run` passes: 87 files, 527 tests.
- `npm run build` passes with the known chunk-size warning.
