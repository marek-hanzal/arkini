# Current architecture cuts

Status: active task queue for the current cleanup/refactor block.

## Done in this block

- `2026-06-19`: item-to-board-item interaction planner unified.
- `2026-06-19`: action readiness/apply dispatch and basic readiness checks tightened.
- `2026-06-19`: effective config overlay contracts covered by tests.
- `2026-06-19`: `@chat-gpt` notes reorganized into `tasks/`, `backlog/`, `archive/`.

## Next candidates

1. Item capability matrix audit: document and validate allowed combinations such as stackable resource, board actor, producer, stash, craft target, removable item.
2. Schema split prep: reduce `GameConfigSchema` / `GameSaveSchema` mental load without changing public exports.
3. Board read-model bridge split: extract producer/craft/stash/stored-requirement readers from the large board view bridge.
4. Scheduled event policy audit: decide which events are live runtime primitive vs legacy complexity.
5. Persistence retry safety: ensure failed Dexie save does not silently drop the latest pending save.

Before coding any risky item, inspect source and propose exact files/shape first.
