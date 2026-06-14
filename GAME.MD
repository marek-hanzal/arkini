# GAME.MD

This document is the canonical gameplay specification for Arkini.

It is intentionally written as an LLM-optimized source of truth. When game logic, economy balance, data definitions, migrations, UI behavior, or tests are validated, this document should be checked before reading implementation details.

`GameConfig` is implementation data. It may be older than this document. When `GameConfig` and `GAME.MD` disagree, `GAME.MD` wins and the implementation must be updated.

## 1. Purpose

Arkini is a client-only offline merge/economy game played on a grid.

The player collects items, merges low-tier items into better items, feeds producers, opens finite stashes, builds or crafts incomplete objects, stores surplus in inventory, and spends currency items on upgrades. Progress is mostly driven by producers, stashes, and craft/construction requirements. Merge is important, but it is not the whole core loop.

## 2. Canonical design rules

These rules define how the game should be interpreted when implementation details are unclear.

1. `GAME.MD` is the source of truth for gameplay semantics.
2. All gameplay entities should be data-driven from a central game configuration.
3. Game definitions must describe items, merge chains, producers, stashes, loot tables, blueprints, craft/construction requirements, upgrades, grid sizes, inventory sizes, starting state, and other game rules.
4. The game is client-only and must be able to run offline in the browser.
5. Saved state is not considered backwards-compatible unless a migration explicitly supports it.
6. If a saved game is incompatible with the active game definition version after migrations, the save may be dropped.
7. Game mechanics should be simple, explicit, and consistent. If a rule needs a special exception, the design should be questioned first.
8. Prefer one clean mechanic over several similar mechanics that behave slightly differently.
9. Empty values should be stable and predictable. Avoid optional/null gameplay data unless absence is a meaningful game state.
10. Names and IDs must be stable enough to be referenced by saves, tests, migrations, and this document.
11. Economy logic should be validated from this document and central game data, not by reverse-engineering UI code.
12. Inventory is passive storage. Active timers, production, growth, and craft progress do not advance while an item is stored in inventory.

## 3. Current fixed constants

| Concept | Value |
| --- | --- |
| Board size | `7 x 9` |
| Board slot count | `63` |
| Inventory size | `7 x 5` |
| Inventory slot count | `35` |
| Inventory model | one canonical player inventory |
| Inventory capacity upgrades | not part of current gameplay |
| Merge role | basic mechanic, not complete core loop |
| Main economy source | click-triggered producers, finite stashes, crafting, construction |
| Blueprint binding | completed blank blueprint + target entity creates bound blueprint |
| Blueprint target consumption | target entity is not consumed |
| Craft/construction location | board or inventory, with active progress only on board |
| Upgrade targeting | concrete entity-specific targets |
| Loot table model | named loot table entities referenced by items/producers/upgrades |

## 4. Vocabulary

### 4.1 Board / game grid

The board is the primary visible grid where the player places items and interacts with active gameplay entities.

The current board size is `7 x 9` cells.

An item may be on the board when it occupies one board cell. If multi-cell items are introduced later, their footprint must be defined in the central game configuration.

Board is an active location. Producers, stashes, craft timers, construction timers, and growth timers can run only while the relevant item is on the board and its own rules allow it.

### 4.2 Inventory

The inventory is the only canonical player storage.

The current inventory size is `7 x 5` slots, for `35` total slots.

There is no separate `playerInventory`, wallet inventory, currency inventory, or second player storage layer. Coins, diamonds, and other currency-like objects are normal inventory items unless a future mechanic explicitly introduces a different model.

Inventory may contain ordinary items, currency items, unfinished craft/construction entities, blueprint items, producers, stashes, and any other item that is allowed to be stored.

Inventory is passive. Nothing active happens inside inventory:

- production cooldowns do not advance
- stash timers do not advance, if a stash ever has one
- craft/construction timers do not advance
- growth timers do not advance
- items cannot be merged inside inventory
- items cannot receive craft/construction inputs inside inventory
- producers cannot produce inside inventory
- stashes cannot be opened inside inventory

Inventory must preserve item state. Moving a stateful item into inventory must not erase deposited inputs, timers, cooldowns, producer stored inputs, construction progress, or other runtime state. Humanity has invented enough ways to lose state already.

### 4.3 Inventory slot

Inventory is slot-based.

Each inventory slot can hold either:

1. a stack of identical stackable stateless items, or
2. one non-stackable item instance.

A slot cannot contain multiple different item IDs.

### 4.4 Item

An item is any gameplay entity that can exist on the board or in inventory.

Examples:

- twig
- branch
- log
- wood bundle
- plank
- beam
- pebble
- stone
- stone block
- water
- sausage
- beer
- coin
- coin stack
- sprout
- bush
- completed blank blueprint
- bound blueprint
- lumber camp
- quarry
- coal mine
- finite chest/stash

### 4.5 Currency item

A currency item is an item used as upgrade payment or other rare progression payment.

Examples:

- coin
- coin pair
- coin stack
- coin chest
- diamond, if introduced later

Currency items are stored in the normal inventory and follow normal inventory stack rules. They are not stored in a separate wallet layer.

### 4.6 Stateful item

A stateful item is an item instance with non-empty runtime state.

Examples of runtime state:

- deposited craft/construction inputs
- active or paused completion timer
- producer cooldown state
- producer stored input items
- finite stash remaining charges/contents
- growth progress
- any other instance-specific value

Any item with non-empty runtime state is automatically non-stackable while that state exists. This preserves state instead of smashing multiple unique items into one cursed blob of ambiguity.

### 4.7 Stateless item

A stateless item is an item instance with no runtime state.

Stateless items may stack only when their item definition allows it through `maxStackSize > 1`.

### 4.8 Merge

Merge is the mechanic where compatible board items are combined into a better or more advanced item.

Merge is a basic mechanic, but it is not the whole core game. The main long-term economy comes from producers, stashes, feeding producers, construction/craft progress, and upgrades.

### 4.9 Merge chain

A merge chain is an ordered sequence of related items where merging lower-tier items produces the next tier.

Merge chains must make thematic and economic sense. A chain must not suddenly turn one material category into an unrelated rare material unless a specific transformation mechanic explains it.

Valid direction examples:

- twig -> branch -> log -> wood-related material
- pebble -> stone -> stone block

Invalid direction example:

- pebble -> diamond

This is invalid because a normal stone chain should not magically become a diamond chain without an explicit geology/refining/transmutation rule.

Current concrete economy chains are not finalized in this document yet. Existing `GameConfig` chains may be used as inspiration, but they are not the final source of truth for economy balance.

### 4.10 Producer

A producer is an infinite or long-lived gameplay entity that generates items when activated by the player and when its rules allow production.

A producer is always click-triggered. Producers do not automatically generate or eject items without player activation.

A producer always has a cooldown/refresh time. Upgrades may modify the cooldown.

Examples:

- lumber camp generates wood-related items
- quarry generates stone-related items
- coal mine generates coal/fuel-related items
- iron mine generates ore/metal-related items

### 4.11 Stash

A stash is a finite producer-like entity.

A stash can output concrete contents or roll from a loot table, but unlike a normal producer it has finite charges, finite stored contents, or another explicit depletion rule.

A stash may require input items before it can be opened or collected.

Example:

- a normal chest can be opened for finite loot
- an epic chest may require a key before it can output loot

Stash and producer are separate entity types even if they share large parts of their implementation. Do not merge finite and infinite production into one vague type just because 80% of the code looks similar. That road leads to the swamp.

### 4.12 Producer/stash input storage

A producer or stash may have its own internal storage for input items required by its behavior.

This is not a second player inventory. It is item-instance state belonging to that producer/stash.

Input storage defines:

- which input item is accepted
- how many units are consumed per activation/cycle
- how many units can be stored in advance

Example:

A coal mine may require `1 sausage` and `1 beer` per production cycle and may store up to `4 sausage` and `4 beer` in advance. The player can later withdraw stored inputs back into normal inventory when rules allow it.

### 4.13 Loot table

A loot table is a standalone data entity defining possible outputs and probabilities for a producer, stash, or other generation mechanic.

Loot tables should have stable IDs, for example:

- `loot:lumber-camp-1`
- `loot:lumber-camp-1:better-1`
- `loot:quarry-1`

A producer/stash references a loot table by ID. Upgrades switch the active loot table by ID instead of mutating probability numbers inside scattered item definitions.

### 4.14 Blueprint

A blueprint is a craft/construction entity used to create or upgrade structures/entities.

A completed blank blueprint is generic. It becomes specific only when it is bound to a target entity.

Binding creates a new item ID.

Example:

- completed blank blueprint + lumber camp -> lumber camp blueprint

The original lumber camp remains in the game after binding.

### 4.15 Bound blueprint

A bound blueprint is a blueprint that already knows what it constructs or improves.

Examples:

- lumber camp blueprint
- quarry blueprint
- townhall blueprint
- lumber camp level 2 blueprint

A bound blueprint is just a craftable item with a recipe and optional completion timer. The exact recipe is data, not special hardcoded blueprint behavior.

### 4.16 Craft/construction progress

Craft/construction progress is the state of an incomplete item that requires input items, time, or both before becoming complete.

This mechanic applies to blueprints, building construction, growth, and similar incomplete entities.

Examples:

- bound blueprint becoming a lumber camp
- lumber camp level 2 blueprint becoming lumber camp level 2
- watered sprout becoming a sapling after a timer

### 4.17 Upgrade

An upgrade is a global progression effect that modifies a specific entity or mechanic.

Upgrades are data-driven and target concrete entities. For example, an upgrade may target `item:lumber-camp-1` and change that producer's cooldown or active loot table.

Global upgrades have a timer. Paying the cost starts the upgrade. The upgrade becomes active only when its timer completes.

## 5. Starting state

The current starting state is based on the existing implementation, with obsolete split inventory merged into the normal inventory.

### 5.1 Starting board

| Item ID | Position |
| --- | --- |
| `item:townhall-1` | `x=3, y=4` |
| `item:lumber-camp-1` | `x=1, y=4` |
| `item:quarry-1` | `x=5, y=4` |
| `item:coal-mine-1` | `x=3, y=6` |

### 5.2 Starting inventory

| Item ID | Quantity |
| --- | ---: |
| `item:blueprint-scrap` | `10` |
| `item:twig` | `8` |
| `item:pebble` | `8` |
| `item:water` | `4` |
| `item:sausage` | `3` |
| `item:beer` | `3` |
| `item:coin-stack` | `1` |

## 6. Inventory mechanics

### 6.1 Single inventory rule

There is exactly one player inventory.

All player-owned stored items go into this inventory, including currency items. Any implementation table, state slice, UI panel, or upgrade referring to a separate player inventory is obsolete and must be removed or migrated into the normal inventory model.

Producer/stash input storage is allowed because it belongs to the item instance and is not player storage.

### 6.2 Stack rules

Inventory respects both item definition and runtime state.

An item can stack only when all of these are true:

1. the item definition has `maxStackSize > 1`
2. the item has no runtime state
3. the target stack contains the same item ID
4. the target stack has room under `maxStackSize`

An item cannot stack when any of these are true:

1. `maxStackSize = 1`
2. the item has non-empty runtime state
3. the item is a building or entity type that is explicitly non-stackable
4. combining it would lose, merge, or obscure runtime state

Buildings currently use `maxStackSize = 1` unless a future design explicitly says otherwise.

A pure stateless producer may stack only if its item definition allows it. A producer with cooldown, stored inputs, or any other state cannot stack.

### 6.3 Board to inventory

Double-clicking an item on the board attempts to move that item into the normal inventory.

This rule is consistent across item types. Double-click does not produce, exhaust, open, activate, or collect. It stores.

The action succeeds when inventory has a valid slot for the item:

- an existing compatible stack with available capacity, or
- an empty slot for a new stack/item instance

The action fails when inventory has no valid slot. Failure should produce clear player feedback.

### 6.4 Inventory to board

Double-clicking an item in inventory attempts to move that item onto the board.

The action succeeds when the board has a valid free cell for the item. If the player does not provide a target cell, the game may choose the first valid free cell using a deterministic placement policy.

The action fails when the board has no valid free cell. Failure should produce clear player feedback.

### 6.5 Inventory passivity

Inventory preserves state but does not advance state.

If a running timer item is moved into inventory:

1. its timer pauses immediately
2. remaining duration is preserved
3. it cannot receive more input items while stored
4. it cannot complete while stored
5. it resumes only after being placed back on the board, if its rules still allow progress

This applies to every active timer in the game: craft timers, construction timers, growth timers, producer cooldowns, stash timers, and future active mechanics.

## 7. Interaction rules

### 7.1 Single-click

Single-click is the default active interaction.

Single-click may:

- collect from a ready producer
- open/collect from a ready stash
- activate another explicit item action, if later defined

### 7.2 Double-click

Double-click is the default storage/placement interaction.

Double-click may:

- move board item to inventory
- move inventory item to board

Double-click must not have hidden production, stash opening, exhaust, or special collect behavior.

### 7.3 Consistency rule

If an interaction behaves differently for one item type, that difference must come from a clear mechanic and must use the correct interaction channel.

Example:

- producer collection belongs to single-click
- inventory storage belongs to double-click

Do not add item-specific double-click exceptions for convenience. Convenience exceptions turn into gameplay debt, then architecture debt, then someone has to debug it at midnight like a gremlin with a keyboard.

## 8. Merge mechanics

### 8.1 Merge purpose

Merge creates a better item from compatible lower-tier board items.

Merge provides access to needed materials, helps compress low-tier items, and supports early progression. It is not the only progression system.

### 8.2 Merge chain rules

A merge chain must define:

- chain ID
- ordered list of item tiers
- required input count per step
- output item per step
- whether the chain is reversible, if ever supported
- whether the merge consumes all input items
- whether the output inherits any state

Default assumption:

- merge happens on the board
- merge consumes inputs
- merge produces one output
- merge requires compatible items from the same chain and tier
- merge is not reversible

### 8.3 Thematic consistency rule

Merge chains must remain semantically consistent.

A chain may improve, refine, bundle, process, or grow an item into a higher form. It must not become an unrelated category without explicit design.

Good examples:

- twig chain ends in wood-related material
- pebble chain ends in stone-related material
- ore chain ends in metal-related material only through smelting/refining mechanics if defined

Bad examples:

- pebble chain ending in diamond
- twig chain ending in iron ore
- sausage chain ending in beer

The final concrete merge/economy chains will be specified during dedicated economy design. Until then, existing implementation chains are inspiration, not canonical economy truth.

### 8.4 Merge and stateful entities

An item with active or paused state must not be merged unless an explicit rule defines how that state is handled.

Default rule:

- stateful items cannot be merged
- running timer items cannot be merged
- items waiting for construction/growth/craft completion cannot be merged
- items with stored producer/stash inputs cannot be merged

### 8.5 Blueprint binding as merge-like interaction

Blueprint binding is a special merge-like interaction:

- completed blank blueprint + target entity -> bound blueprint for target entity
- binding creates a new item ID
- target entity is not consumed
- completed blank blueprint is consumed or transformed into the bound blueprint

This must be explicitly represented in data and tests so it does not get mixed with generic merge-chain behavior.

## 9. Producers

### 9.1 Producer purpose

Producers are the main repeatable source of economy inputs and advanced items.

Merge can create needed items, but feeding and upgrading producers should become the main driver of progression.

### 9.2 Producer trigger

A producer is triggered by single-click.

There are no automatic producers in current gameplay. A producer that is ready does nothing until the player activates it.

### 9.3 Producer cooldown

Each producer has a cooldown/refresh time.

When the cooldown is complete, required input items are available, and output placement is possible, a single-click activation may produce output from the active loot table.

Refresh time may be changed by upgrades.

Because inventory is passive, producer cooldown does not advance while the producer item is stored in inventory.

### 9.4 Producer loot output

A producer uses a named loot table to decide generated outputs.

A producer may generate:

- zero items, if allowed by the loot table
- one item
- multiple different items
- multiple copies of the same item

The output count and probability rules must be encoded in named loot table data, not hidden in UI code or inline in random item definitions.

### 9.5 Producer output placement

Default producer output placement is `board_then_inventory`.

This means:

1. try to place generated items onto valid board cells
2. if board placement cannot fit all output, try to place remaining output into normal inventory
3. if neither board nor inventory can fit the output, the producer must not silently destroy generated items unless an explicit overflow rule says so

Exact placement ordering must be deterministic and testable.

### 9.6 Producer input requirements

A producer may require input items before producing.

Input requirements define:

- accepted input item ID
- quantity consumed per production cycle
- storage capacity for that input item

Example:

A coal mine may require `1 sausage` and `1 beer` per production cycle. It may also allow up to `4 sausage` and `4 beer` to be stored in advance.

### 9.7 Producer input storage

Producer input storage exists to store required production input items.

Producer input storage is item-instance state. It makes that producer instance stateful and therefore non-stackable.

A producer may contain more input items than one production cycle requires, up to configured capacity.

The player may withdraw stored producer input items back into normal inventory when rules allow it.

### 9.8 Producer readiness

A producer is ready when:

1. its cooldown has completed
2. every required input item is present in the producer input storage
3. output placement is possible, or output overflow handling is explicitly defined

Production consumes configured input quantities from producer input storage.

## 10. Stashes

### 10.1 Stash purpose

A stash is a finite source of items.

Stashes cover chests, crates, finite caches, reward containers, and similar entities.

### 10.2 Stash trigger

A stash is opened/collected by single-click when its requirements are satisfied.

Double-click stores the stash in inventory. It does not open or exhaust the stash.

### 10.3 Stash depletion

A stash must define its finite behavior explicitly.

Possible models:

- fixed number of charges
- fixed stored contents
- fixed number of loot table rolls
- removal on depletion
- transformation into an empty item on depletion

The selected depletion behavior must be data-driven.

### 10.4 Stash inputs

A stash may require input items before opening or collecting.

Example:

An epic chest may require a key.

Stash input storage follows the same storage principles as producer input storage, but stash remains a separate entity type.

## 11. Loot tables

### 11.1 Loot table as standalone entity

Loot tables are standalone data entities.

A producer or stash references its active loot table by ID.

Preferred ID pattern:

- `loot:<entity-id>` for base table
- `loot:<entity-id>:better-1` for upgraded table
- `loot:<entity-id>:better-2` for next upgraded table

Example:

- `item:lumber-camp-1` references `loot:lumber-camp-1`
- an upgrade switches it to `loot:lumber-camp-1:better-1`

### 11.2 Loot table definition

A loot table must define:

- stable ID
- roll model
- possible item outputs
- probability or weight per output
- min/max quantity per output
- duplicate behavior
- whether zero output is possible

### 11.3 Loot table upgrades

Loot table upgrades switch the active loot table ID.

Do not patch drop rates directly inside upgrade logic. Probability changes belong in named loot tables.

## 12. Blueprint mechanics

### 12.1 Blueprint purpose

Blueprints turn abstract construction progress into concrete target construction.

They allow the player to prepare a generic completed blueprint first, then bind it to a target entity later.

### 12.2 Blank blueprint lifecycle

Blueprint lifecycle:

1. Player obtains or creates blueprint components.
2. Player completes a blank blueprint through merge, craft, or construction progress.
3. Completed blank blueprint is generic and has no target.
4. Player binds the completed blank blueprint to a target entity.
5. Binding creates a bound blueprint item ID.
6. Bound blueprint has craft/construction requirements.
7. Completing bound blueprint produces, upgrades, or unlocks the target result.

### 12.3 Binding blueprint to entity

Binding rule:

- completed blank blueprint + target entity -> bound blueprint for that target
- target entity remains and does not disappear
- blank blueprint becomes target-specific
- the result is a new item ID

Example:

- completed blank blueprint + `item:lumber-camp-1` -> `item:blueprint-lumber-camp-1`
- `item:lumber-camp-1` still exists after binding

Implementation details such as `imprint` or `consumeSource: false` are not the mechanic. The mechanic is: bind blueprint, create specific blueprint, keep target entity.

### 12.4 Bound blueprint as craftable item

A bound blueprint is a craftable item.

It defines a recipe and optional completion timer. It is not a special hardcoded building-tier system.

Example pattern:

- `item:blueprint-lumber-camp-2` may require its own recipe and then complete into `item:lumber-camp-2`

The exact recipe belongs to economy design and central data, not to special gameplay branching.

## 13. Craft / construction / growth progress

### 13.1 Purpose

Craft/construction/growth progress represents incomplete entities that require input items, time, or both.

This mechanic applies to blueprints, building construction, growth, and similar transformations.

Examples:

- bound blueprint becoming a building
- watered sprout becoming a sapling
- sapling becoming a tree

### 13.2 Location behavior

A craftable/progress item may exist on the board or in inventory.

Board is active. Inventory is passive.

When the item is on the board, it may accept input items and advance timers according to its definition.

When the item is in inventory, it preserves state but does not accept inputs, does not advance timers, and cannot complete.

### 13.3 Requirement model

A craft/construction/growth entity should define:

- entity ID
- accepted input item IDs
- required quantities
- already deposited quantities in runtime state
- optional completion duration, including `0` for instant completion
- output/result item ID
- completion behavior

### 13.4 Feeding progress

Input items can be deposited into an incomplete craft/construction/growth entity only when the entity is on the board and can currently accept input.

Deposited items are consumed into the progress state and should not remain as separate inventory items.

### 13.5 Completion timer

A craftable/progress item may define a completion duration.

Rules:

1. If duration is `0`, completion happens instantly once required inputs are deposited.
2. If duration is greater than `0`, the item enters a running timer once required inputs are deposited.
3. While the timer is running, the item cannot accept additional inputs.
4. While the timer is running, the item cannot be merged.
5. While the timer is running, the item can be moved on the board.
6. While the timer is running, the item can be moved into inventory.
7. Moving it into inventory pauses the timer.
8. Moving it back to the board resumes the timer.
9. Completion happens only while the item is on the board and the timer finishes.

### 13.6 Stateful progress preservation

Progress state must survive all allowed movement.

This includes:

- board movement
- board to inventory movement
- inventory to board movement
- app reload
- save/load

State loss during movement is a gameplay bug.

## 14. Upgrade system

### 14.1 Upgrade purpose

Upgrades are global progression modifiers.

They make specific entities better or unlock more advanced behavior.

### 14.2 Upgrade targeting

Each upgrade targets a concrete entity or exact mechanic scope.

Examples:

- `item:lumber-camp-1` cooldown
- `item:lumber-camp-1` loot table
- `item:coal-mine-1` cooldown

This keeps upgrade data explicit and avoids unclear global magic.

### 14.3 Upgrade lifecycle

Upgrade lifecycle:

1. Player pays explicit item costs.
2. Upgrade starts.
3. Upgrade has `durationMs`.
4. Upgrade is inactive while the timer is running.
5. Upgrade becomes active when the timer completes.
6. Active upgrade effects are permanent for the save unless a future rule says otherwise.

### 14.4 Supported upgrade effect types

Current implementation-supported effect types are:

- `producer.cooldown.add`
- `producer.outputTable.set`
- `inventory.capacity.add`

Canonical gameplay currently uses producer cooldown and producer loot table upgrades.

Inventory size is fixed at `7 x 5`. No current upgrade should change normal inventory size. Any existing player-inventory capacity upgrade is obsolete and should be removed with the split inventory system.

### 14.5 Loot table upgrades

Loot table upgrades should switch active loot table IDs by tier.

Preferred model:

- producer starts with `loot:lumber-camp-1`
- upgrade changes producer to `loot:lumber-camp-1:better-1`
- next upgrade changes producer to `loot:lumber-camp-1:better-2`

Avoid scattering probability patches throughout logic. Probability changes belong in named loot tables.

### 14.6 Upgrade costs

Upgrades cost explicit item stacks or item instances.

Currency items such as coins are normal items stored in normal inventory and may be used as upgrade costs.

## 15. Economy validation rules

The economy should be validated using these rules:

1. Every required input item must have at least one defined source.
2. Every producer/stash output must be useful in at least one merge chain, craft requirement, construction requirement, upgrade, or future unlock path.
3. Merge chains must not create unrelated materials without an explicit transformation system.
4. Producer/stash input requirements must be satisfiable from existing sources.
5. Producer/stash input capacity must be high enough to support intended cycles.
6. Upgrades must target concrete entities and must not rely on implicit string matching or UI assumptions.
7. Loot table changes must be traceable through named upgrade tiers.
8. Currency item sources and sinks must be balanced intentionally.
9. Inventory capacity must be considered when adding new chains or producers.
10. Stateful items must preserve state through all allowed movement.
11. No important economy behavior should live only in UI interaction code.
12. Existing `GameConfig` economy data is inspiration until a dedicated economy pass rewrites it to match this document.

## 16. Data model expectations

The central game configuration should be able to express at least these concepts.

### 16.1 Item definition

Expected fields:

- `id`
- `name`
- `kind`
- `description`
- `asset`
- `maxStackSize`
- `placeable`
- `storageRules`
- `tags`
- optional producer definition reference
- optional stash definition reference
- optional craft/construction definition reference
- optional blueprint binding rules

### 16.2 Item instance state

Expected fields:

- instance ID, if stored as instance
- item definition ID
- location: board, inventory, producer/stash input storage, or other explicit scope
- board position, if on board
- inventory slot, if in inventory
- quantity, if stackable stateless stack
- runtime state object, if stateful

Runtime state must be able to represent:

- deposited craft/construction/growth inputs
- remaining or ready-at timer state
- paused timer state
- producer cooldown state
- producer input storage
- stash charges/contents/depletion state

### 16.3 Inventory definition

Expected fields:

- slot count: `35`
- slot placement rules
- stack merge rules
- max stack handling
- stateful item handling

### 16.4 Merge chain definition

Expected fields:

- `id`
- `name`
- `tiers`
- `inputCount`
- `consumeInputs`
- `result`
- `specialRules`, if needed

### 16.5 Producer definition

Expected fields:

- `id`
- `name`
- trigger: `click`
- cooldown/refresh time
- active loot table ID
- input requirements
- input storage capacities
- output placement rules
- upgrade targets

### 16.6 Stash definition

Expected fields:

- `id`
- `name`
- trigger: `click`
- finite behavior model
- charges/contents/roll count
- active loot table ID, if table-driven
- input requirements, if any
- depletion behavior
- output placement rules

### 16.7 Loot table definition

Expected fields:

- `id`
- `rolls`
- `entries`
- `itemId`
- `weight` or `probability`
- `minCount`
- `maxCount`
- `allowDuplicateResults`
- zero-output behavior

### 16.8 Blueprint definition

Expected fields:

- `id`
- `targetEntityId`, for bound blueprints
- `bindingRules`
- craft/construction reference
- completion result

### 16.9 Craft/construction/growth definition

Expected fields:

- `id`
- `targetEntityId`, if any
- accepted inputs
- required quantities
- completion duration, including `0`
- completion result
- allowed locations
- timer pause/resume behavior

### 16.10 Upgrade definition

Expected fields:

- `id`
- `name`
- `targetEntityId`
- `targetProperty`
- `tier`
- `cost`
- `durationMs`
- `effect`
- `nextUpgradeId`, if linear

## 17. Current example chains and entities

These examples are canonical directionally, but exact item IDs and tiers will be finalized during economy design.

### 17.1 Wood chain

A wood chain starts from small natural wood items and ends in useful wood material.

Example direction:

- twig
- branch
- log
- wood bundle
- plank
- beam

The chain must not become stone, ore, coins, diamonds, or food.

### 17.2 Stone chain

A stone chain starts from small stones and ends in useful construction stone material.

Example direction:

- pebble
- stone
- stone block

The chain must not become gem/diamond unless a separate geology/refining mechanic explicitly supports it.

### 17.3 Producer examples

- lumber camp: wood material source
- quarry: stone material source
- coal mine: coal/fuel source
- iron mine: ore/metal source

### 17.4 Producer feed examples

- coal mine may consume sausage and beer
- producer may store more feed items than one production cycle requires
- stored feed items may be withdrawn back to normal inventory

### 17.5 Stash examples

- basic crate: finite output, removed or emptied after depletion
- epic chest: finite output, requires key input before opening

## 18. Open design questions

These are intentionally not finalized yet.

1. What are the final concrete economy merge chains?
2. Which exact producers exist in the first balanced economy pass?
3. Which exact stashes exist in the first balanced economy pass?
4. What are the exact named loot tables and their probabilities?
5. What are the exact blueprint recipes for each building/tier?
6. Which craft/construction/growth items use timers, and what are their durations?
7. Are blueprints consumed on completion, or do some blueprint types remain as reusable plans?
8. Can a bound blueprint ever be rebound to another target?
9. Are upgrade tiers strictly linear, or can some branches exist?
10. Can merge chains require more than two input items?
11. Can special merges use non-consuming participants besides blueprint binding?
12. What exact deterministic placement order is used for board/inventory overflow?

Until these questions are answered, implementation should choose the simplest explicit behavior and document it here before coding.

## 19. Implementation migration notes

These notes describe known differences from the current implementation that must be fixed.

1. Remove the separate `playerInventory` gameplay concept.
2. Move all starting `playerInventory` items into normal inventory.
3. Remove or migrate `playerInventoryStack` storage.
4. Remove collectible behavior that stores items into a separate player inventory.
5. Currency items must go into normal inventory.
6. Remove the current player-inventory capacity upgrade from gameplay.
7. Keep normal inventory size fixed at `7 x 5`.
8. Inventory must support stateful item instances, not only stateless stacks.
9. Stateful inventory items must be non-stackable.
10. Double-click on board must store the item. It must not exhaust producers or stashes.
11. Producer/stash activation belongs to single-click.
12. Split infinite producers and finite stashes into separate entity types.
13. Move producer/stash outputs to named loot table entities and reference them by ID.
14. Current `GameConfig` economy chains may be replaced during the economy design pass.

## 20. Implementation testing checklist

A gameplay implementation should provide tests or validation for:

1. moving item from board to inventory by double-click
2. moving item from inventory to board by double-click
3. double-click never triggers producer output
4. double-click never opens/exhausts stash output
5. single-click triggers ready producer
6. single-click triggers ready stash
7. inventory full failure behavior
8. board full failure behavior
9. stackable stateless item stacking up to `maxStackSize`
10. non-stackable building occupying one slot
11. stateful item occupying one slot and not stacking
12. stateful item state preserved through board -> inventory -> board
13. inventory pauses craft/construction/growth timers
14. inventory pauses producer cooldowns
15. inventory item cannot receive craft/construction inputs
16. ordinary merge chain success
17. invalid merge rejection
18. thematic merge chain validation from data
19. stateful item merge rejection unless explicit rule exists
20. producer cooldown timing on board
21. producer cooldown paused in inventory
22. producer loot table rolls from named table ID
23. producer generating multiple items
24. producer generating duplicate item outputs when allowed
25. producer input deposit
26. producer input withdrawal
27. producer production blocked by missing inputs
28. producer production consumes required inputs
29. stash finite depletion
30. stash input requirement, for keyed/locked stashes
31. blank blueprint completion
32. blank blueprint binding to target entity
33. target entity not consumed by blueprint binding
34. bound blueprint receiving construction inputs
35. craft/construction timer starts after required inputs are deposited
36. craft/construction timer pauses in inventory
37. craft/construction completion on board
38. upgrade cost payment from normal inventory
39. upgrade timer lifecycle
40. upgrade reducing producer cooldown
41. upgrade switching producer loot table ID
42. save compatibility behavior when game definition version changes
