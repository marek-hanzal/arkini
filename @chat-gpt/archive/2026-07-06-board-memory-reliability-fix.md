# 2026-07-06 — board memory reliability fix

- Fixed identity-backed board memory layout entries, especially `item:board-memory`, so restore can move an existing board instance directly back to its saved cell instead of depending on an inventory round-trip.
- Fulfillment planning now protects moved identity-backed saved items from being stashed before the restore step can reposition them.
- Board-to-inventory stack-copy transfer now checks total inventory capacity before mutating slots, avoiding partial copies when the whole board stack cannot fit.
- Added regressions for restoring a moved memory tile with a full inventory and for avoiding partial stack duplication during memory restore cleanup.

Validation:
- `npm run typecheck`
- targeted board-memory / board-inventory / placement / runtime invariant tests
- full test suite covered in chunks because the monolithic `npm test` command exceeds the sandbox command timeout in this environment
- `npm run build`
