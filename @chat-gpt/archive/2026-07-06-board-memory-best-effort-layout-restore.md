# 2026-07-06 — board memory best-effort layout restore

Correction to the inventory-backed restore invariant:

- Memory restore cleanup is strict: inventory-backed board items must still be cleared through inventory first, and any cleanup failure leaves the real save untouched with the memory layout pending.
- Memory restore layout rebuild is best-effort: saved layout entries that are no longer available in inventory/board-only sources are skipped instead of blocking the whole restore.
- This matters because resources can be legitimately consumed between memory save and restore. A missing saved resource should not prevent restoring the remaining available layout.
- Inventory-backed stack restore now consumes quantity across multiple matching inventory stacks after prechecking total quantity, avoiding both partial mutation on missing quantity and false misses when the required stack is split across slots.

Important invariant:
- Do not add temp storage. Inventory is the only staging layer for inventory-backed memory restore.
- Do not require `restoredCount === savedItems.length` for restore success. The success gate is cleanup safety, not perfect historical replay.

Validation:
- `npm run format:check`
- `npm run typecheck`
- `npx vitest run --no-color src/board-memory`
- `npm run build`
- `npm run game:validate -- game/arkini`
- `npm run audit:current`
