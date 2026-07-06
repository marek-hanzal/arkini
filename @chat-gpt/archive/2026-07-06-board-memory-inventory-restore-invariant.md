# 2026-07-06 — board memory inventory restore invariant

Follow-up to `123ee185`: the direct board-memory restore shortcut was wrong for the intended architecture.

Decision:
- Board memory restore uses inventory as the only cleanup/restore staging layer for inventory-backed items.
- No temp storage layer.
- Inventory-backed layout items are not opportunistically preserved just because the board already visually matches the saved layout.
- Restore now preflights the full board cleanup + layout restore against a cloned save. If cleanup into inventory cannot fully complete or the saved layout cannot be fully restored, the real save is left untouched and the memory layout remains pending.
- Board-only inventory-forbidden utility tiles still use the board-only restore path, because they cannot enter inventory by config.
- Stack-copy board-to-inventory transfer keeps the earlier full-capacity guard to avoid partial stack dupes.

Important invariant:
- For memory restore, inventory-backed board items must go board -> inventory -> board. This keeps board/inventory state accounting deterministic. Avoid future shortcuts that directly move inventory-backed board items back to saved cells.

Validation:
- `npm run typecheck`
- `npx vitest run --no-color src/board-memory`
