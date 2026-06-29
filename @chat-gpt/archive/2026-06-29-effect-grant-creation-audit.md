# 2026-06-29 — Effect grant creation audit

Status: DONE

## Context

Deep review after moving unlocks/requirements to Effect grants. The current Arkini content has product-line/craft grant gates and passive global/local grant sources, but no authored `items.*.grantSelector` yet. The runtime contract still supports item creation gates, so every creation path must honor them before future content starts relying on it.

## Findings

- Config validation, dependency cruise, typecheck, and the full test suite pass.
- Current content grant graph is internally consistent: no missing grant ids, no stale requirement fields, no hidden product lines without a reveal source, and no active-effect-only grant gates hiding in config.
- The real bug was a future-facing engine hole: item creation grants were checked for exact board placement, merge, and debug readiness, but not consistently for delayed craft completion or inventory fallback from generic item placement.
- The UI-facing inventory placement readiness also collapsed “missing grant” and “blocked create” into `effect:block-create` when nearest-cell planning found no allowed board cell.

## Fix

- Added `effect:missing-grant` as a placement failure reason and marked it retryable for delayed deliveries.
- Generic item placement now rejects inventory fallback when the created item is missing its required grant, instead of letting gated items sneak into inventory like a tiny rules-lawyering goblin.
- Board placement failure now preserves `effect:missing-grant` when every empty board cell is denied by missing local/global creation grants.
- Delayed craft completion now checks the result item grant at the target cell and blocks/retries with `effect:missing-grant` if the grant disappeared between start and completion.
- Inventory placement readiness now reports missing grants distinctly instead of lying with `effect:block-create`.

## Tests added

- `placeGameSaveItemsFx` rejects inventory fallback for an item whose `grantSelector` is not currently satisfied.
- `runGameTickFx` keeps a completed craft pending when the result item creation grant is missing.

## Verification

- `npm run check` passed.
- Existing warning remains: `game/arkini.assets.json` exceeds Biome max file size and several packaged resources are unused by assets. These were pre-existing content/tooling warnings, not failures.
