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
- Producer/product `hinderedBy` entries are negative production effects: every active hindrance instance slows duration, active penalties stack, and they do not gate or block product start.
- Townhall era progression is one-way: the next Town Hall craft consumes the current Town Hall and requires ownership of every physical building/place unlocked by the current era via passive `board_or_inventory` requirements. Higher Town Halls do not inherit older blueprint products.
- Loaded JSON `GameConfig` is the canonical immutable source of truth. There is no save-driven config overlay/layer and no global upgrade patch system.
- Item-level `exclusiveToIds` is directional and explicit, never auto-symmetric. It is a hard ownership/creation constraint for path choices. UI must warn early on blueprints/craft targets before resource investment.
- Heroes Guild I is the current post-goldsmith test branch: Town Hall IV sells its blueprint for coins, guild expeditions consume coins plus food/drink, return tiered locked hero chests, and chests open as keyed stashes. Stash clicks auto-fill open-time inputs from board/inventory when available, and missing inputs open detail instead of surfacing an action error. Goldsmith produces Hero Key III; other hero key tiers are cheat-only acquisition placeholders for now, but all four key tiers have dedicated key art.
- Job/event split: anything delayed, scheduled, retrying, blocked, or persisted for future processing is a job. `GameEvent` is only an output for something processed now.

## Hard rules

- Do not revive SQLite/Kysely or gameplay React Query.
- Do not add special UI for filling requirements; use core DnD/merge-style interactions.
- Before non-trivial work, inspect current source and existing library capabilities.
- Keep active notes short. Archive completed task notes immediately.
- Do not reintroduce pending/scheduled event queues; future delayed gameplay belongs in explicit job maps/families.
