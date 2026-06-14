# GAME.MD

This document is the canonical gameplay specification for Arkini.

It is intentionally written as an LLM-optimized source of truth. When game logic, economy balance, data definitions, migrations, UI behavior, or tests are validated, this document should be checked before reading implementation details.

## 1. Purpose

Arkini is a client-only offline merge/economy game played on a grid.

The player collects items, merges low-tier items into better items, feeds producers, builds or crafts incomplete objects, stores surplus in inventory, and spends hard currency or resources on upgrades. Progress is mostly driven by producers and craft/construction requirements. Merge is important, but it is not the only core loop.

## 2. Canonical design rules

These rules define how the game should be interpreted when implementation details are unclear.

1. GAME.MD is the source of truth for gameplay semantics.
2. All gameplay entities should be data-driven from a central game configuration.
3. Game definitions must describe items, merge chains, producers, loot tables, blueprints, craft/construction requirements, upgrades, grid sizes, inventory sizes, and other game rules.
4. The game is client-only and must be able to run offline in the browser.
5. Saved state is not considered backwards-compatible unless a migration explicitly supports it.
6. If a saved game is incompatible with the active game definition version after migrations, the save may be dropped.
7. Game mechanics should be simple to reason about. Prefer explicit data over hidden behavior.
8. Empty values should be stable and predictable. Avoid optional/null gameplay data unless absence is a meaningful game state.
9. Names and IDs must be stable enough to be referenced by saves, tests, migrations, and this document.
10. Economy logic should be validated from this document and central game data, not by reverse-engineering UI code.

## 3. Vocabulary

### 3.1 Board / game grid

The board is the primary visible grid where the player places items and interacts with gameplay entities.

An item may be on the board when it occupies one board cell. If multi-cell items are introduced later, their footprint must be defined in the central game configuration.

### 3.2 Inventory

The inventory is a secondary storage grid for items the player does not currently need on the board.

The current inventory size is `7 x 5` slots.

Inventory is not just a temporary UI drawer. It is part of the game state and may contain normal items, unfinished craft/construction entities, blueprint items, producer input items, and hard currency representations when represented as items.

### 3.3 Item

An item is any placeable gameplay entity that can exist on the board or in inventory.

Examples:

- twig
- wood
- pebble
- stone block
- sausage
- beer
- sprout
- bush
- blank blueprint
- bound blueprint
- woodcutter
- quarry
- coal mine
- iron mine

### 3.4 Hard currency

Hard currency is a valuable upgrade currency, for example coins or diamonds.

Hard currency is used for upgrades or other premium/rare progression actions. It may be stored or represented in inventory depending on implementation, but its gameplay semantics must be defined as a currency/resource and not accidentally treated as ordinary merge junk.

### 3.5 Merge

Merge is the mechanic where compatible items are combined into a better or more advanced item.

Merge is a basic mechanic, but it is not the whole core game. The main long-term economy comes from producers, feeding producers, construction/craft progress, and upgrades.

### 3.6 Merge chain

A merge chain is an ordered sequence of related items where merging lower-tier items produces the next tier.

Merge chains must make thematic and economic sense. A chain must not suddenly turn one material category into an unrelated rare material unless a specific transformation mechanic explains it.

Example of valid chain direction:

- twig -> branch bundle -> wood
- pebble -> stone -> stone block

Example of invalid chain direction:

- pebble -> diamond

This is invalid because a normal stone chain should not magically become a diamond chain without an explicit geologic/refining/transmutation rule.

### 3.7 Producer / generator

A producer is a gameplay entity that generates items over time.

Producer and generator mean the same mechanic unless future design explicitly splits them.

Examples:

- woodcutter generates wood-related items
- quarry generates stone-related items
- coal mine generates coal-related items
- iron mine generates iron ore-related items

### 3.8 Producer inventory

A producer may have its own internal inventory for items required by production.

Producer inventory is separate from the global player inventory. It stores input/feed items that the producer needs for production and may also allow extra capacity beyond the minimum production requirement.

Example:

A coal mine may require sausage and beer for production. The player can feed it more sausage and beer than one production cycle needs, up to its input capacity. The player can later remove those stored inputs back into the player inventory.

### 3.9 Loot table

A loot table defines possible output items and probabilities for a producer or other generation mechanic.

A producer may generate multiple items from its loot table per refresh. It may generate multiple copies of the same item when the loot table and roll rules allow it.

### 3.10 Blueprint

A blueprint is a craft/construction entity used to create or upgrade structures/entities.

A completed blank blueprint is generic. It becomes specific only when it is bound to a target entity.

Example:

A completed blank blueprint is merged with a woodcutter. The result is a woodcutter blueprint. The original woodcutter does not disappear.

### 3.11 Bound blueprint

A bound blueprint is a blueprint that already knows what it constructs or improves.

Example:

- blank completed blueprint + woodcutter -> woodcutter blueprint

The target entity used for binding remains in the game unless an explicit future rule says otherwise.

### 3.12 Craft/construction progress

Craft/construction progress is the state of an incomplete item that requires other resources before becoming complete.

The incomplete entity may exist on the board or in inventory. Location should not change the meaning of its requirements unless a specific rule says that some progress can only happen on the board.

Examples:

- a bound blueprint requiring resources before construction is complete
- a sprout requiring resources/time before becoming a bush

### 3.13 Upgrade

An upgrade is a global progression effect that modifies a specific entity or mechanic.

Upgrades are data-driven and target concrete entities. For example, an upgrade may target `woodcutter_level_1` or another explicit entity definition.

Upgrade effects may include:

- reducing producer refresh time
- switching a producer to a better loot table
- improving drop probabilities
- increasing producer inventory capacity
- improving output count
- unlocking new producer tiers

Loot table upgrades should preferably switch the active loot table by tier rather than mutating probabilities ad hoc in scattered logic.

## 4. Gameplay loop

The intended economy loop is:

1. The player obtains basic items from starting state, board interactions, producers, or other generation systems.
2. The player merges basic items into better items when a merge chain allows it.
3. The player feeds producers with required input items.
4. Producers refresh over time and generate outputs from their loot tables.
5. Generated outputs are used for more merges, craft/construction progress, producer feeding, or upgrades.
6. Blueprints and craft/construction items create longer-term goals.
7. Hard currency and advanced resources are spent on global upgrades.
8. Upgrades improve producer efficiency, loot quality, or other entity-specific behavior.
9. Better producers and better loot tables push the player into more advanced materials and construction chains.

The long-term progression should rely mainly on producer economy and craft/construction requirements, not only on repeatedly merging low-tier items.

## 5. Inventory mechanics

### 5.1 Inventory size

Current inventory size is fixed at `7 x 5` slots.

This equals `35` total inventory slots.

### 5.2 Moving items from board to inventory

Double-clicking an item on the board attempts to move that item into the player inventory.

The action succeeds when inventory has a valid free slot for the item.

The action fails when inventory has no valid free slot. Failure should produce clear player feedback.

### 5.3 Moving items from inventory to board

Double-clicking an item in inventory attempts to move that item onto the board.

The action succeeds when the board has a valid free cell for the item.

The action fails when the board has no valid free cell. Failure should produce clear player feedback.

### 5.4 Inventory storage semantics

Inventory may store items that are not immediately useful.

Inventory can also contain entities with active state, such as:

- incomplete blueprints
- bound blueprints
- craft/construction progress items
- sprouts or other growth/progress entities
- resources intended for producer feeding
- hard currency items, if currency is represented as item stacks

If an item has progress state, moving it between board and inventory must preserve that progress unless a specific rule says otherwise.

### 5.5 Inventory and producer inventory

Player inventory and producer inventory are different storage scopes.

Moving an item into a producer inventory is a feed/deposit action, not the same as moving it into player inventory.

Producer input items may be removed from producer inventory back into player inventory when allowed by capacity and interaction rules.

## 6. Merge mechanics

### 6.1 Merge purpose

Merge creates a better item from compatible lower-tier items.

Merge provides access to required materials, helps compress low-tier resources, and supports early progression. It is not the only progression system.

### 6.2 Merge chain rules

A merge chain must define:

- chain ID
- ordered list of item tiers
- required input count per step
- output item per step
- whether the chain is reversible, if ever supported
- whether the merge consumes all input items
- whether the output inherits any state

Default assumption:

- merge consumes inputs
- merge produces one output
- merge requires compatible items from the same chain and tier
- merge is not reversible

### 6.3 Thematic consistency rule

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

### 6.4 Merge and special entities

Some merge interactions are not ordinary chain merges.

Blueprint binding is a special merge-like interaction:

- completed blank blueprint + target entity -> bound blueprint for target entity
- target entity is not consumed
- completed blank blueprint is consumed or transformed into bound blueprint

Special interactions must be explicitly represented in data and tests so they do not get mixed with generic merge-chain behavior.

## 7. Producers / generators

### 7.1 Producer purpose

Producers are the main source of economy inputs and advanced items.

Merge can create needed items, but feeding and upgrading producers should become the main driver of progression.

### 7.2 Producer refresh

Each producer has a refresh time.

When the producer is ready and production requirements are satisfied, it may generate output items from its active loot table.

Refresh time may be changed by upgrades.

### 7.3 Producer loot output

A producer uses a loot table to decide generated outputs.

A producer may generate:

- zero items, if allowed by the loot table
- one item
- multiple different items
- multiple copies of the same item

The output count and probability rules must be encoded in loot table data, not hidden in UI code.

### 7.4 Producer examples

Current conceptual producers:

| Producer | Economy role | Example outputs |
| --- | --- | --- |
| Woodcutter | wood economy | twigs, branches, wood |
| Quarry | stone economy | pebbles, stones, stone blocks |
| Coal mine | fuel economy | coal |
| Iron mine | metal economy | iron ore |

Exact item IDs and loot tables must be defined in central game config.

### 7.5 Producer input requirements

A producer may require input/feed items before producing.

Input requirements define:

- required item ID
- amount consumed per production cycle
- whether the input is mandatory or optional
- producer inventory capacity for that input

Example:

A coal mine may require sausage and beer. It may store more sausage and beer than one production cycle needs. The stored excess remains inside the producer until consumed by production or removed by the player.

### 7.6 Producer internal inventory

Producer inventory exists to store required production inputs.

Producer inventory must define capacity. Capacity may be per input item, shared across all input items, or both, but the selected model must be explicit in game data.

Producer inventory may contain more input items than one production cycle requires.

The player may withdraw producer input items back into player inventory when rules allow it.

### 7.7 Producer readiness

A producer is ready when:

1. its refresh timer has completed
2. its required inputs are present in producer inventory, if it has input requirements
3. output placement is possible, or output overflow handling is defined

If output cannot be placed on the board or inventory, the producer must not silently destroy generated items unless an explicit overflow rule says so.

## 8. Blueprint mechanics

### 8.1 Blueprint purpose

Blueprints turn abstract construction progress into concrete target construction.

They allow the player to prepare a generic completed blueprint first, then bind it to a target entity later.

### 8.2 Blank blueprint lifecycle

Blueprint lifecycle:

1. Player obtains or creates blueprint components.
2. Player completes a blank blueprint through merge, craft, or construction progress.
3. Completed blank blueprint is generic and has no target.
4. Player binds the completed blank blueprint to a target entity.
5. Binding creates a bound blueprint.
6. Bound blueprint has construction/craft progress requirements.
7. Completing bound blueprint produces, upgrades, or unlocks the target result.

### 8.3 Binding blueprint to entity

Binding rule:

- completed blank blueprint + target entity -> bound blueprint for that target
- target entity remains and does not disappear
- blank blueprint becomes target-specific

Example:

- completed blank blueprint + woodcutter -> woodcutter blueprint
- the woodcutter still exists after binding

### 8.4 Bound blueprint progress

A bound blueprint has construction/craft progress.

Progress requirements should define:

- required item IDs
- required amounts
- whether requirements are consumed immediately or deposited over time
- completion output/result
- whether completion happens instantly once all requirements are met
- whether progress can be done while the blueprint is in inventory

Default assumption:

- requirements are deposited into the blueprint
- deposited resources are preserved in the blueprint state
- completion happens when all requirements are satisfied
- blueprint may exist on board or in inventory

## 9. Craft / construction progress

### 9.1 Purpose

Craft/construction progress represents incomplete entities that require resources, time, or both.

This mechanic applies to blueprints and may also apply to growth or transformation items.

Examples:

- bound blueprint becoming completed construction
- sprout becoming bush

### 9.2 Location independence

An incomplete craft/construction item may exist on the board or in inventory.

Unless a mechanic explicitly says otherwise, moving the item between board and inventory must not reset progress.

### 9.3 Requirement model

A craft/construction entity should define:

- entity ID
- progress state
- required item IDs
- required amounts
- already deposited amounts
- optional time requirement, if applicable
- output/result entity
- completion behavior

### 9.4 Feeding construction progress

Resources can be deposited into an incomplete craft/construction entity.

Deposited resources are consumed into the progress state and should not remain as separate inventory items.

When all required resources and time conditions are satisfied, the entity completes into its result.

### 9.5 Growth-like craft progress

Growth items, such as sprout -> bush, use the same general progress model unless a dedicated growth system is introduced later.

A sprout may require resources, time, or both before becoming a bush.

## 10. Upgrade system

### 10.1 Upgrade purpose

Upgrades are global progression modifiers.

They make specific entities better or unlock more advanced behavior.

### 10.2 Upgrade targeting

Each upgrade targets a concrete entity or exact mechanic scope.

Examples:

- `woodcutter_level_1.refresh_time`
- `woodcutter_level_1.loot_table`
- `coal_mine_level_1.input_capacity`
- `quarry_level_1.output_count`

This keeps upgrade data explicit and avoids unclear global magic.

### 10.3 Upgrade effects

Allowed upgrade effect types include:

- reduce producer refresh time
- switch producer loot table by tier
- improve producer output count
- improve producer input capacity
- unlock producer/entity level
- unlock new craft/construction recipes
- improve hard currency or resource economy rules, if explicitly defined

### 10.4 Loot table upgrades

Loot table upgrades should switch active loot table IDs by tier.

Preferred model:

- producer starts with `loot_table_tier_1`
- upgrade changes producer to `loot_table_tier_2`
- next upgrade changes producer to `loot_table_tier_3`

Avoid scattering probability patches throughout logic. Probability changes belong in named loot tables.

### 10.5 Upgrade costs

Upgrades may cost resources, hard currency, or completed construction items.

Costs must be explicit in game data.

Hard currency examples:

- coins
- diamonds

## 11. Economy validation rules

The economy should be validated using these rules:

1. Every required resource must have at least one defined source.
2. Every producer output must be useful in at least one merge chain, craft requirement, construction requirement, upgrade, or future unlock path.
3. Merge chains must not create unrelated materials without an explicit transformation system.
4. Producer requirements must be satisfiable from existing sources.
5. Producer inventory capacity must be high enough to support intended production cycles.
6. Upgrades must target concrete entities and must not rely on implicit string matching or UI assumptions.
7. Loot table changes must be traceable through upgrade tiers.
8. Hard currency sources and sinks must be balanced intentionally.
9. Inventory capacity must be considered when adding new chains or producers.
10. No important economy behavior should live only in UI interaction code.

## 12. Data model expectations

The central game configuration should be able to express at least these concepts.

### 12.1 Item definition

Expected fields:

- `id`
- `name`
- `kind`
- `description`
- `asset`
- `stacking`, if supported
- `placeable`
- `storageRules`
- `tags`

### 12.2 Merge chain definition

Expected fields:

- `id`
- `name`
- `tiers`
- `inputCount`
- `consumeInputs`
- `result`
- `specialRules`, if needed

### 12.3 Producer definition

Expected fields:

- `id`
- `name`
- `refreshTime`
- `activeLootTableId`
- `inputRequirements`
- `inputInventoryCapacity`
- `outputPlacementRules`
- `upgradeTargets`

### 12.4 Loot table definition

Expected fields:

- `id`
- `rolls`
- `entries`
- `itemId`
- `weight` or `probability`
- `minCount`
- `maxCount`
- `allowDuplicateResults`

### 12.5 Blueprint definition

Expected fields:

- `id`
- `state`
- `targetEntityId`, for bound blueprints
- `bindingRules`
- `craftRequirements`
- `completionResult`

### 12.6 Craft/construction definition

Expected fields:

- `id`
- `targetEntityId`
- `requirements`
- `depositedResources`
- `timeRequirement`, if used
- `completionResult`
- `allowedLocations`

### 12.7 Upgrade definition

Expected fields:

- `id`
- `name`
- `targetEntityId`
- `targetProperty`
- `tier`
- `cost`
- `effect`
- `nextUpgradeId`, if linear

## 13. Current concrete constants

These values are currently defined by design:

| Concept | Value |
| --- | --- |
| Player inventory size | `7 x 5` |
| Inventory slot count | `35` |
| Merge role | basic mechanic, not complete core loop |
| Main economy source | producers/generators |
| Blueprint binding | blank completed blueprint + target entity creates bound blueprint |
| Blueprint target consumption | target entity is not consumed |
| Craft/construction location | board or inventory unless restricted by explicit rule |
| Upgrade targeting | concrete entity-specific targets |
| Loot table upgrade model | preferably switch named loot table by tier |

## 14. Current example chains and entities

These examples are canonical directionally, but exact item IDs and tiers must be defined in central game config.

### 14.1 Wood chain

A wood chain starts from small natural wood items and ends in useful wood material.

Example direction:

- twig
- better twig/branch form
- wood

The chain must not become stone, ore, coins, diamonds, or food.

### 14.2 Stone chain

A stone chain starts from small stones and ends in useful construction stone material.

Example direction:

- pebble
- stone
- stone block

The chain must not become diamond unless a separate gem/ore/geology mechanic explicitly supports it.

### 14.3 Producer examples

- woodcutter: wood material source
- quarry: stone material source
- coal mine: coal/fuel source
- iron mine: iron ore source

### 14.4 Producer feed examples

- coal mine may consume sausage and beer
- producer may store more feed items than one production cycle requires
- stored feed items may be withdrawn back to player inventory

## 15. Open design questions

These are intentionally not finalized yet.

1. Are ordinary inventory items stackable, or does every item occupy one slot?
2. Is hard currency stored as item stacks in inventory, as separate numeric currency, or both?
3. What is the exact board size and board placement policy?
4. What happens when a producer generates output and no board slot is available?
5. Can producer outputs go directly to inventory, or only to board?
6. Do producers produce automatically when ready, or only after player collection?
7. Are producer inputs consumed at production start or production completion?
8. Can craft/construction progress require time, or only deposited resources?
9. Does craft/construction progress continue while the item is in inventory?
10. Are blueprints consumed on completion?
11. Can a bound blueprint be rebound to another target?
12. Are upgrades permanent global account/save effects?
13. Can upgrade tiers be skipped?
14. Can merge chains require more than two input items?
15. Can special merges use non-consuming participants besides blueprint binding?

Until these questions are answered, implementation should choose the simplest explicit behavior and document it here before coding.

## 16. Implementation testing checklist

A gameplay implementation should provide tests or validation for:

1. moving item from board to inventory by double click
2. moving item from inventory to board by double click
3. inventory full failure behavior
4. board full failure behavior
5. ordinary merge chain success
6. invalid merge rejection
7. thematic merge chain validation from data
8. producer refresh timing
9. producer loot table rolls
10. producer generating multiple items
11. producer generating duplicate item outputs when allowed
12. producer input deposit
13. producer input withdrawal
14. producer production blocked by missing inputs
15. producer production consumes required inputs
16. blank blueprint completion
17. blank blueprint binding to target entity
18. target entity not consumed by blueprint binding
19. bound blueprint receiving construction resources
20. craft/construction progress preserved when moved between board and inventory
21. craft/construction completion
22. upgrade cost payment
23. upgrade reducing refresh time
24. upgrade switching loot table tier
25. save compatibility behavior when game definition version changes

