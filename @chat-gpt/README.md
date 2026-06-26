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
- Era V is textile/clothing production: Raw Hide -> Leather, Wool -> Common Cloth, Dye Workshop turns Vegetables + Water into Pigment, Pigment finishes Luxury Cloth, then Tailor makes Common Clothing and Luxury Clothing. Do not use Work Clothes as a specific item.
- Era VII is now focused mining expansion: Civic Office issues Academy, Academy produces Advanced Knowledge plus Prospector Guild 2 and mine blueprints, Prospector Guild 2 finds Coal/Iron/Gold deposits, and mines output Coal/Iron Ore/Gold Ore. Gold Ore is the current Era VII master output.
- Era VIII is dirty processing and advanced construction materials: Academy issues Purifier first plus Charcoal Burner, Clay/Sand Pit, Brickyard, Glassworks, Roof Tile Factory, Smelter, and Construction Yard. Product lines using Coal/Charcoal require nearby Purifier and emit random Pollution side outputs. Construction Bundle is the Era VIII master item.
- Era IX is guild institutions, equipment, keys, and expeditions: Civic Office produces Guild Charter; Academy issues Blacksmith, Armory, Goldsmith, and University blueprints; University issues Heroes Guild blueprint; Blacksmith consumes Iron Ingots for Nails/Axe/Sword; Armory produces Leather/Iron Armor; Goldsmith consumes Gold Ingots for Coin Stack and Keys I-IV; University produces Master Knowledge; Heroes Guild consumes gear, food, luxury, keys, gems, and knowledge for Chests and Treasure Chest. Product lines using Charcoal keep the nearby Purifier + random Pollution rule. Treasure Chest is the Era IX master item. Guild Charter now has its own dedicated PNG asset, not the Building Permit placeholder.
- Loaded JSON `GameConfig` is the canonical immutable source of truth. There is no save-driven config overlay/layer and no global upgrade patch system.
- Item-level `exclusiveToIds` is directional and explicit, never auto-symmetric. It is a hard ownership/creation constraint for path choices. UI must warn early on blueprints/craft targets before resource investment.
- Heroes Guild / Goldsmith / Blacksmith / Armory / University are now connected as Era IX content through Guild Charter and Academy-issued blueprints. Town Hall IV remains civic administration, paper, permits, prospecting, and Market II; do not dump later-era blueprints back into Town Hall.
- Era X is prestige construction materials: Dye Workshop produces Pigment; Glazier Workshop produces Stained Glass from Glass + Pigment + Charcoal + Water with nearby Glassworks/Purifier; Prospector Guild 2 can now find Marble Deposit; University issues Quarry 2 and Stonemason 2 blueprints; Quarry 2 works near Marble Deposit and outputs Stone/Marble; Stonemason 2 works near Quarry 2 and outputs Stone Block/Marble Block. Stained Glass and Marble Block are current Era X prestige construction outputs.
- Runtime effects are the unified product-line mutator layer. Effects never mutate `GameConfig`; they produce an effective runtime view for concrete product lines. Supported operations include line reveal/hide/blockStart, duration add/multiply, loot append/replace/addChanceItem/dropChance. Hidden/blocked states win over reveal/start. There is no explicit storage/placement mutation, suppression, or propagation subsystem. Spread is authored as side loot dropping another effect source item.
- Path/product gating uses `visibility: "hidden"` plus effect `line.reveal`, not another one-off marker property waiting to become archaeological garbage.
- Choose The Path is now represented by three Era XI keystone building items: `producer:house-of-engineers`, `producer:cathedral`, and `producer:mage-lodge`. University issues their blueprints after prestige/treasure inputs. The buildings are mutually exclusive through `exclusiveToIds` and should later emit passive path reveal effects for branch-tagged product variants.
- Housing morale is a side economy, not a core production blocker: `producer:house-t1`..`producer:house-t4` generate `item:morale-t1`..`item:morale-t4` from era-appropriate comfort goods. Higher houses output their own morale plus all lower morale tiers. Morale is spent by selected big crafts (Town Hall III/IV, Academy, Construction Yard, University, Choose The Path keystones) and by duplicate boosted product lines; base production lines remain available without morale.
- Items support optional `maxCount`, a board-only cap. Undefined means unlimited. Placement, debug spawn, merge/craft board replacements, and save/config validation honor it; inventory and stored inputs are not counted. Use this for limited buildings such as wells or Choose The Path keystones.
- Branch drawback concept: Engineers generate/handle Pollution pressure, Faith should generate/handle Corruption pressure, and Mages should generate/handle Void pressure. Each branch should get power plus its own mess, because civilization apparently insists on inventing themed garbage.
- Job/event split: anything delayed, scheduled, retrying, blocked, or persisted for future processing is a job. `GameEvent` is only an output for something processed now.

## Hard rules

- Do not revive SQLite/Kysely or gameplay React Query.
- Do not add special UI for filling requirements; use core DnD/merge-style interactions.
- Before non-trivial work, inspect current source and existing library capabilities.
- Keep active notes short. Archive completed task notes immediately.
- Do not reintroduce pending/scheduled event queues; future delayed gameplay belongs in explicit job maps/families.
- Prospector Guild is the long-term tiered source-discovery hub. Use numeric tile labels via item `label` (`1`, `2`, …): T1 finds Clay/Sand deposits, T2 keeps Clay/Sand and adds Coal/Iron/Gold. Do not reintroduce Surveyor Camp as a separate concept.
