# 2026-07-01 – V0 live truth review

Context: follow-up deep review after drop-owned effect refactor. Focus was raw source of truth vs UI/backend intermediate truth.

Findings/fixes:

- Missing-resource bounce hints were still using raw config product outputs through `readProductOutputItemIds`. That ignored effective drop-owned visibility/enabled state. Rewired `readProducerMissingResourceHintTileIds` to inspect the effective `BoardViewItem.activation.productLines[].outputs` only, skipping blocked/start-gated/output-limit-blocked lines and disabled outputs.
- Deleted the raw output helper because no live UI/runtime path should infer producer outputs from static config after drop-owned effects.
- Runtime board reader now accepts an explicit clock: `readBoardView(state, nowMs = state.nowMs)`. UI preflight/drop planning now passes `Date.now()` so effective views are rebuilt at action time instead of stale snapshot time.
- Board and inventory DnD/tap paths now use a single current clock for local pre-checks and the dispatched engine action.
- Removed an unused `visibleProductIds` intermediate from the producer activation view bridge.

Tests/checks:

- Added missing-resource hint coverage for disabled effective source outputs.
- Added runtime reader coverage for explicit clock board rebuilds.
