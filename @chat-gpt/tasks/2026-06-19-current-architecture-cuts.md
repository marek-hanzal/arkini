# Current architecture cuts

Status: active task queue for the current cleanup/refactor block.

## Done in this block

- `2026-06-19`: item-to-board-item interaction planner unified.
- `2026-06-19`: action readiness/apply dispatch and basic readiness checks tightened.
- `2026-06-19`: effective config overlay contracts covered by tests.
- `2026-06-19`: `@chat-gpt` notes reorganized into `tasks/`, `backlog/`, `archive/`.
- `2026-06-19`: persistence retry safety fixed; failed writes keep latest pending save.
- `2026-06-19`: board read-model bridge split into focused activation/craft/item readers.
- `2026-06-19`: reverted `GameSaveSchema` validation split; schema core contracts are not line-count cleanup targets.

## Next candidates

1. Scheduled job/event policy audit: formalize two primitives before refactoring runtime time flow.
   - Job = planned activity that may reschedule itself and eventually emit events.
   - Event = concrete occurrence due now and processed through the standard event pipeline.
2. Item capability matrix audit: document and validate allowed combinations such as stackable resource, board actor, producer, stash, craft target, removable item.

Before coding any risky item, inspect source and propose exact files/shape first.
