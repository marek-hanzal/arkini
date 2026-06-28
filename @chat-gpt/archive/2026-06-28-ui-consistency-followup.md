# UI consistency follow-up

Status: DONE

## Completed

- Stash board tap/readiness now uses the producer-like product-line run state when product-line views exist. Stashes no longer look/open as ready while their shared producer queue is paused, blocked, full, or delivery-blocked.
- Ready craft detail UI now exposes a claim action through the runtime tick path, matching board tap behavior instead of showing a disabled `Ready` button.
- Board/inventory-to-board interaction planning no longer routes merge/replacement actions into busy or runtime-state-preserving targets. It now blocks replacement-style merges for producer/craft jobs, delivery-blocked items, stored inputs, stored requirements, charges, and explicit default product-line state before the backend has to reject it.
- Drop hover feedback no longer shows blocked feedback for board-to-board plain swaps when the actual drop would swap successfully, but still shows blocked feedback for inventory-to-board occupied targets that would be rejected.
- Store/interaction runtime-state checks are shared through UI helpers instead of reimplementing busy checks in multiple components.

## Watchouts

- UI hover/tap/detail affordances should read runtime view state and shared run-state helpers. Do not re-add local readiness/progress math for producer-like stashes, crafts, or product lines.
- If a target replacement would discard preserved runtime state, the UI interaction plan must not present it as a valid merge. Backend safety checks remain canonical, but frontend should not advertise impossible actions.
