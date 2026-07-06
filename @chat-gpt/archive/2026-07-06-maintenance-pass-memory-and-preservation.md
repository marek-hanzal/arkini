# 2026-07-06 Maintenance pass: memory restore + preservation facts

## Context
Recent bugfixes exposed two high-risk mental-load zones:

- Board memory restore has a non-trivial invariant: strict board cleanup into inventory first, then best-effort layout rebuild from inventory. Missing saved layout items are expected and must not block restore.
- Item replacement/storage logic needs to distinguish real runtime state from control/UI state. Selected producer line state should not be treated like a running job/input payload, but it may still require instance preservation when storing the item.

## Changes

### Board memory restore plan
Added `readBoardMemoryRestorePlanFx` and `BoardMemoryRestorePlan`.

Restore now explicitly computes:

- board-only fulfillment/preserved board item indexes,
- whether current board cleanup can fit safely into inventory,
- cleanup dry-run result.

`restoreSavedBoardMemoryLayoutFx` now reads that plan first and applies the real restore only when board cleanup is safe. This removes the older hidden "full restore dry-run just to know cleanup readiness" path.

### Board view item preservation facts
Added `readBoardViewItemPreservationFacts`.

It separates:

- `hasRuntimeState`: craft delivered inputs, producer charges, producer/stash stored inputs,
- `hasControlState`: selected/default producer line,
- `requiresInstancePreservation`: runtime state or control state.

`readBoardItemInventoryStorageReadiness` now asks explicitly for instance preservation instead of relying on the older ambiguous `isBoardViewItemRuntimeStatePreserved` helper.

## Invariants to keep

- Board memory restore cleanup is strict.
- Board memory layout rebuild is best-effort.
- Do not add temp storage for memory restore. Inventory remains the only inventory-backed intermediate.
- Selected default line is control state, not a runtime blocker.
- Stored inputs, charges, running jobs, craft delivered input, and capacity state are real runtime/preservation state.
