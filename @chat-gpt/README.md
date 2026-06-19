# Arkini GPT working notes

Read this first, then `tasks/`. Open `backlog/` only when planning. Open `archive/` only for historical rationale. Old notes are reference, not current truth; source code wins.

## Layout

- `tasks/` - active/current work block. If it only contains `README.md`, no active GPT task queue is open.
- `backlog/` - planned/deferred tasks worth solving later.
- `archive/` - completed/obsolete notes and rationale.

`README.md` files are allowed as unprefixed folder anchors. Every other note file in `@chat-gpt` must start with `YYYY-MM-DD-`.

## Current architecture facts

- Runtime truth: compiled JSON `GameConfig` + `GameSave` inside `RuntimeGameEngineAdapter` / `GameRuntimeStore`.
- Action contracts live in `game/action`; output event contracts live in `game/event`; dense save contract stays in `game/engine/model`.
- React reads runtime through `useGameRuntimeSelector` / focused hooks, not React Query.
- Gameplay mutations go through typed engine actions, not `useMutation` wrappers.
- Persistence is Dexie snapshot plumbing around `GameSave`; it is not gameplay truth.
- TileEngine is generic and must not import Arkini domain modules.
- `GameConfigSchema` / `GameSaveConfigSchema` are central validation gates.
- `GameConfig` is the primary gameplay contract: if config validation accepts an item/capability combination, the engine/runtime must support and honor it deterministically.
- Base config is immutable; save upgrades build an effective overlay config.
- Job/event split: anything delayed, scheduled, retrying, blocked, or persisted for future processing is a job. `GameEvent` is only an output for something processed now.

## Hard rules

- Do not revive SQLite/Kysely or gameplay React Query.
- Do not add special UI for filling requirements; use core DnD/merge-style interactions.
- Before non-trivial work, inspect current source and existing library capabilities.
- Keep active notes short. Archive completed task notes immediately.
- Do not reintroduce pending/scheduled event queues; future delayed gameplay belongs in explicit job maps/families.
