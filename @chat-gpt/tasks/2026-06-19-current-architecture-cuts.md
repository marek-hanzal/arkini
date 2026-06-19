# Current architecture cuts

Status: active task queue for the current cleanup/refactor block.

## Done in this block

- `2026-06-19`: item-to-board-item interaction planner unified.
- `2026-06-19`: action readiness/apply dispatch and basic readiness checks tightened.
- `2026-06-19`: effective config overlay contracts covered by tests.
- `2026-06-19`: `@chat-gpt` notes reorganized into `tasks/`, `backlog/`, `archive/`.
- `2026-06-19`: persistence retry safety fixed; failed writes keep latest pending save.
- `2026-06-19`: board read-model bridge split into focused activation/craft/item readers.
- `2026-06-19`: complexity scan added; `GameSaveSchema` split so schema shape and save/config validation are separate.

## Next candidates

1. Item capability matrix audit: document and validate allowed combinations such as stackable resource, board actor, producer, stash, craft target, removable item. Do not code validation before approving allowed combinations.
2. GameSave validation domain split: if `GameSaveValidation.ts` becomes painful, mechanically extract board/inventory/producer/craft/upgrade/stash/stored-requirement/scheduled-event validators without behavior changes.
3. Schema split prep: reduce `GameConfigSchema` mental load without changing public exports.
4. Scheduled event policy audit: decide which events are live runtime primitive vs legacy complexity.
5. TileEngine pointer/motion audit: separate inherent DOM/pointer complexity from accidental orchestration complexity.

Before coding any risky item, inspect source and propose exact files/shape first.
