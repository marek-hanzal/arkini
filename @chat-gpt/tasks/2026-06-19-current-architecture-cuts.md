# Current architecture cuts

Status: active task queue for the current cleanup/refactor block.

## Done in this block

- `2026-06-19`: item-to-board-item interaction planner unified.
- `2026-06-19`: action readiness/apply dispatch and basic readiness checks tightened.
- `2026-06-19`: effective config overlay contracts covered by tests.
- `2026-06-19`: `@chat-gpt` notes reorganized into `tasks/`, `backlog/`, `archive/`.
- `2026-06-19`: persistence retry safety fixed; failed writes keep latest pending save.
- `2026-06-19`: board read-model bridge split into focused activation/craft/item readers.

## Next candidates

1. Item capability matrix audit: document and validate allowed combinations such as stackable resource, board actor, producer, stash, craft target, removable item.
2. Schema split prep: reduce `GameConfigSchema` / `GameSaveSchema` mental load without changing public exports.
3. Scheduled event policy audit: decide which events are live runtime primitive vs legacy complexity.

Before coding any risky item, inspect source and propose exact files/shape first.
