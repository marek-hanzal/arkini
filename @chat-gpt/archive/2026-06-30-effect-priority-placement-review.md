# 2026-06-30 Effect priority + placement review

Follow-up deep review after effect/grant migration.

Findings fixed:

- Product line visibility was sticky for `line.hide`. The engine already applies local sources farthest-to-nearest so the nearest source can override, but `line.hide` set a separate sticky flag that a later `line.reveal` could not clear. Visibility is now a single override state (`visible`/`hidden`), preserving the invariant: nearest visibility effect wins.
- Item create block reasons were sorted farthest-first. Blocking itself remained correct, but the surfaced reason could come from a weaker/farther source. Block reasons now sort closest-first.
- `inventory.item.place` with `nearest_by_manhattan` could succeed without placing anything on the board when the board had zero legal cells, because the generic placement fallback returned the consumed item back to inventory. Readiness now requires at least one legal board cell for this board-placement action; partial overflow to inventory is still allowed after at least one board placement is possible.
- Runtime producer line views computed `outputLimitBlocked` and `targetLimits` from static `product.output`, ignoring effect-replaced output. UI now uses `effectiveProductLine.lootPlan.baseOutput` so it matches runtime start constraints.

Validation:

- format check passed with the existing large `game/arkini.assets.json` warning.
- game config validated with existing unused packaged resource warnings.
- dependency cruiser passed.
- typecheck passed.
- full Vitest suite passed: 77 files, 555 tests.
- build passed with the existing Vite chunk-size warning.
