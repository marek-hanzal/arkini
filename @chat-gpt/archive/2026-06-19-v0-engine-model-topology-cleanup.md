# Engine model topology cleanup

Status: done.

## What changed

`src/v0/game/engine/model` was audited after removing `engine/fx`. It had become a second bucket for contracts that now have clearer top-level game domains.

Moved out of `engine/model`:

- Action input contracts -> `src/v0/game/action`
- Output event contract -> `src/v0/game/event`
- Board primitive `BoardCell` -> `src/v0/game/board`
- Inventory slot helpers -> `src/v0/game/inventory`
- Placement request/result/failure models -> `src/v0/game/placement`
- Requirement/input requirement models -> `src/v0/game/requirements`
- Loot/quantity models -> `src/v0/game/loot`
- Upgrade definitions/save upgrade schemas -> `src/v0/game/upgrade`

Removed dead unused model:

- `GameProductPlacement.ts`

## What intentionally stayed

`src/v0/game/engine/model` now holds only engine-level dense/core contracts:

- `GameSaveSchema.ts`
- `GameSaveSchema.test.ts`
- `GameEngineError.ts`
- `GameEngineResult.ts`
- `GameEngineCompletionResult.ts`

`GameSaveSchema` remains an intentional dense core contract. Do not split or move it merely for line count. If it ever moves, it must be because the save contract itself has a clearly better architectural home, not because the file is long.

## Rationale

The cleanup follows the current top-level game-domain direction: `engine` is orchestration, not a home for every model in the game. Small model contracts should live beside the domain that owns their meaning.

Avoid creating new technology buckets such as `model`, `schema`, or `fx` when a real domain folder already exists.
