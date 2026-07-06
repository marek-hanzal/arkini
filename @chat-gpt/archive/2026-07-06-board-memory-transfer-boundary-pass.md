# 2026-07-06 — board memory transfer boundary pass

- extracted board memory layout item matching helpers:
  - identity match: item id, optional instance id, quantity
  - cell match: x/y
  - full layout match: identity + cell
- updated fulfillment planning to use the shared full layout matcher
- updated board-only restore source lookup to use the same identity semantics, including quantity
- extracted `readBoardMemoryBoardItemStorePlan` so memory store decisions are explicit:
  - skip unknown item
  - skip inventory-forbidden item
  - skip busy runtime item
  - preserve board memory/preservable instances
  - stack-copy normal board items
- replaced scattered `memoryItem.quantity ?? 1` reads with `readBoardMemoryLayoutItemQuantity`
- added focused regression tests for memory layout matching and store plan routing
