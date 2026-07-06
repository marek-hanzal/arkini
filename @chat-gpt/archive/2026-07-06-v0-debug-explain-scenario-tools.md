# Debug explain and scenario tools

Implemented maintenance helpers for the two recurring pain points:

- `src/debug/explain/*`
  - `explainItemToBoardItemDrop` explains source/target facts, accepted transfer quantities, merge/stack/craft/producer/stash/remove decisions, and inventory-to-occupied-cell rejection.
  - `explainCraftInputCandidateFx` wraps craft input readiness and returns accepted quantity or the exact rejected engine reason.
  - `explainBoardMemoryRestoreFx` runs a dry explanation of board memory restore: missing layout, strict board cleanup readiness, preserved board-only items, and best-effort layout restore counts.

- `src/engine/test/GameScenario.ts`
  - Fluent test scenario helper for compact board/inventory/memory setup, chained action dispatch, rejected action probing, and readable board/inventory lookup.

Keep these helpers narrow and diagnostic. Do not turn them into gameplay state owners, alternate runtime dispatchers, or a new temp storage layer. They are there to answer "why did this interaction do that?" and to make real player-flow tests cheap to write.
