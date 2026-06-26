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
- Do not add storage buildings; storage is handled by inventory plus passive storage through producer input capacity.
- Building Permit is an Era IV gameplay item/master produced by Civic Office and used for survey, academy, mining, market, and later construction progression.
- Market progression is tiered by real building upgrades, starting with Market I in Era III and Market II in Era IV; use new market tiers for new capabilities instead of treating Market as a single eternal building.
- Era V is textile/clothing production: Raw Hide -> Leather, Wool -> Common Cloth -> Luxury Cloth, then Common Clothing and Luxury Clothing. Do not use Work Clothes as a specific item.
- Era VII is now focused mining expansion: Civic Office issues Academy, Academy produces Advanced Knowledge plus Prospector Guild 2 and mine blueprints, Prospector Guild 2 finds Coal/Iron/Gold deposits, and mines output Coal/Iron Ore/Gold Ore. Gold Ore is the current Era VII master output.
- Era VIII is dirty processing and advanced construction materials: Academy issues Purifier first plus Charcoal Burner, Clay/Sand Pit, Brickyard, Glassworks, Roof Tile Factory, Smelter, and Construction Yard. Product lines using Coal/Charcoal require nearby Purifier and emit random Pollution side outputs. Construction Bundle is the Era VIII master item.
- Loaded JSON `GameConfig` is the canonical immutable source of truth. There is no save-driven config overlay/layer and no global upgrade patch system.
- Item-level `exclusiveToIds` is directional and explicit, never auto-symmetric. It is a hard ownership/creation constraint for path choices. UI must warn early on blueprints/craft targets before resource investment.
- Heroes Guild / Goldsmith / Blacksmith / Armory / University definitions are currently prepared later-era content, not connected to the current townhall progression. Town Hall IV is now civic administration, paper, permits, surveys, and Market II.
- Armory I currently exists only as a prepared producer asset/config asset (`asset:producer:armory-t1`, `producer-armory-t1.png`) for future leather/iron armor production; it is not yet connected as a producer/item/craft.
- Job/event split: anything delayed, scheduled, retrying, blocked, or persisted for future processing is a job. `GameEvent` is only an output for something processed now.

## Hard rules

- Do not revive SQLite/Kysely or gameplay React Query.
- Do not add special UI for filling requirements; use core DnD/merge-style interactions.
- Before non-trivial work, inspect current source and existing library capabilities.
- Keep active notes short. Archive completed task notes immediately.
- Do not reintroduce pending/scheduled event queues; future delayed gameplay belongs in explicit job maps/families.
- Prospector Guild is the long-term tiered source-discovery hub. Use numeric tile labels via item `label` (`1`, `2`, …): T1 finds Clay/Sand deposits, T2 keeps Clay/Sand and adds Coal/Iron/Gold. Do not reintroduce Surveyor Camp as a separate concept.
