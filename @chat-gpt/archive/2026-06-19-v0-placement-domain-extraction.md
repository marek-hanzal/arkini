# v0 placement domain extraction

Status: done.

## Change

Moved shared placement runtime files from `src/v0/game/engine/fx` into top-level `src/v0/game/placement`.

## Rationale

Placement is a real game domain, not engine orchestration. It is shared by producer delivery, craft/stored input withdrawal, stash opening/stashing, inventory-to-board placement, item spawn jobs, and initial save setup.

`engine/fx` should not own placement just because placement functions are implemented as Effects. The engine now imports placement as a domain.

## Moved files

- `findFirstEmptyBoardCellFx.ts`
- `planEmptyBoardCellsFx.ts`
- `placeGameSaveItemsFx.ts`
- `placeGameSaveItemsFx.test.ts`
- `placeSingleGameSaveItemRequestFx.ts`
- `placeGameSaveInventoryItemsFx.ts`
- `placeGameSaveInventoryInstanceFx.ts`
- `placeGameSaveInventoryRemainderFx.ts`
- `placeInitialInventoryItemFx.ts`
- `placeInventoryItemOnBoardFx.ts`

## Guardrail

Do not use `placement` as a new dump bucket. It owns shared placement planning/apply primitives and inventory/board placement execution. Board move/swap, item merge, tile remove, stored requirements, and job orchestration should get their own domains.
