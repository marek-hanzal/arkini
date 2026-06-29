# 2026-06-29 Effect stack lifecycle review

Status: done
Commit: pending

## Scope

Deep review pass after the effect/grant migration, focused on runtime grant checks, stack lifecycle, merge/craft mutation order, and stale ignored effect source ids.

## Findings

### Inventory stack passive sources are index-derived

Inventory stack passive effect source ids are emitted as `inventory-slot:${slotIndex}:${itemId}:${quantityIndex}`. That is deterministic for a static save, but the ids are not stable across stack consumption because remaining stack items are re-indexed.

The merge flow performed a pre-consumption readiness check using an ignore set that ignored both the merge target and the source item. After consuming one item from an inventory stack, it reused that old ignore set for the post-consumption result creation check. When a stack of 2 became a stack of 1, the remaining source moved from `:1` to `:0`, so the reused ignore set accidentally ignored the remaining source as if it had been consumed.

Effect: a merge result with an item `grantSelector` could fail with `effect:missing-grant` even though the remaining inventory stack item still provided the grant after the action.

Fix: after merge source consumption, re-check result item creation against the post-consumption save while ignoring only the target board item being replaced. The consumed source is already gone; remaining stack sources must count normally.

Regression: `keeps remaining inventory stack grants after consuming one merge source`.

### Craft input storage checked result effects against stale reality

Craft input storage checked whether the eventual craft result item could be created before consuming the input and without passing the craft target cell. That was too early and too spatially blind.

Problems:

- an input item with `item.blockCreate` could block storing itself even though the input is consumed by the storage action and should no longer affect the resulting world state;
- local grants/blockers for the result item could be evaluated without the craft target cell, causing false `effect:missing-grant` for valid local grants near the craft target.

Fix: move the result item create effect check from readiness into `storeCraftInputFx` after the input is consumed on the cloned save. The check now uses the craft target cell and ignores only the craft target item instance that would later be replaced.

Regressions:

- `does not let a consumed input effect block its own craft input storage`;
- `uses the craft target cell when checking result grants during input storage`.

## Verification

- `npm test -- src/v0/game/craft/applyGameActionCraftFx.test.ts src/v0/game/merge/applyGameActionMergeFx.test.ts --no-color`
- `npm test -- --no-color --reporter=dot` passed separately: 75 files, 546 tests.
- `npm run build` passed with existing Vite chunk-size warning.
- `npm run format:check`, `game:validate`, `dc`, and `typecheck` passed; config still reports existing unused packaged resource warnings and Biome still warns that `game/arkini.assets.json` exceeds max file size.

## Notes

No `.git/config` changes were made. Its SHA-256 remained `99e70e2cfd52c0c7d7b658b378674fef027935f80a2d9acde3e5bbb862706ef8`.
