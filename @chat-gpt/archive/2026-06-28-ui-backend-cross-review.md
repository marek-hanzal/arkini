# UI/backend cross review

Status: DONE

## Completed

- Removed the remaining UI/static board-layout truth from board and inventory surfaces. Tile slots and column counts now come from the live runtime config instead of `defaultGameConfig` wrappers.
- Removed the old `src/v0/game/gameConfig.ts`, `boardColumns`, `boardRows`, and `inventoryColumns` layout mirrors.
- Moved board cell coordinate bounds out of the generic UI schema; save/config validation remains the canonical place for board-bound checks.
- Fixed board/inventory drop action planning to use the live board cell and live source slot/item from the current runtime view, not stale drag/target snapshots.
- Fixed board hover/drop feedback to read the latest runtime board/inventory snapshot before resolving feedback.
- Replaced hardcoded first-empty-board-cell dimensions with a shared config-driven finder used by both runtime readers and rebuilt board views.
- Added regression coverage for stale source snapshots, stale target snapshots, and config-sized board first-empty-cell derivation.

## Watchouts

- Drag source/target payloads are UI transport hints only. Runtime drop planning must re-read live board/inventory views before deciding anything gameplay-relevant.
- Board layout must come from `state.runtime.config.game.board`; do not reintroduce static `defaultGameConfig` layout imports in UI modules.
- Generic cell schemas should describe coordinate shape only. Config-bounded validation belongs in game config/save schema validation.
