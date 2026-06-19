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
6. If the game crashes during startup or runtime because local storage is corrupt or incompatible, the first recovery action is a full browser-storage hard reset followed by reload. Do not build soft recovery mazes for prototype saves.
7. If a saved game is incompatible with the active game definition version after migrations, the save may be dropped.
8. Game mechanics should be simple, explicit, and consistent. If a rule needs a special exception, the design should be questioned first.
9. Prefer one clean mechanic over several similar mechanics that behave slightly differently.
10. Empty values should be stable and predictable. Avoid optional/null gameplay data unless absence is a meaningful game state.
11. Names and IDs must be stable enough to be referenced by saves, tests, migrations, and this document.
12. Economy logic should be validated from this document and central game data, not by reverse-engineering UI code.
13. Inventory is passive storage. Active timers, production, growth, and craft progress do not advance while an item is stored in inventory.
14. Active board timers and global timers use real-world wall-clock time. If the app is closed and later reopened, eligible active timers may already be complete.

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
| Time model | real-world wall-clock time for active board/global timers |

## 4. Vocabulary

### 4.1 Board / game grid

The board is the primary visible grid where the player places items and interacts with active gameplay entities.

The current board size is `7 x 9` cells.

An item may be on the board when it occupies one board cell. If multi-cell items are introduced later, their footprint must be defined in the central game configuration.

Board is an active location. Producers, stashes, craft timers, construction timers, and growth timers can run only while the relevant item is on the board and its own rules allow it. Active board timers use real-world wall-clock time, including time while the app is closed.

### 4.2 Inventory

The inventory is the only canonical player storage.

The current inventory size is `7 x 5` slots, for `35` total slots.

There is no separate `playerInventory`, wallet inventory, currency inventory, or second player storage layer. Coins, diamonds, and other currency-like objects are normal inventory items unless a future mechanic explicitly introduces a different model.

Inventory may contain ordinary items, currency items, unfinished craft/construction entities, blueprint items, producers, stashes, and any other item that is allowed to be stored.

Inventory is passive. Nothing active happens inside inventory, even if real-world time passes while the app is closed:

- production cooldowns do not advance
- stash timers do not advance, if a stash ever has one
- craft/construction timers do not advance
- growth timers do not advance
- items cannot be merged inside inventory
- items cannot receive craft/construction inputs inside inventory
- producers cannot produce inside inventory
- stashes cannot be opened inside inventory

Inventory must preserve item state. Moving a stateful item into inventory must not erase deposited inputs, timers, cooldowns, producer stored inputs, construction progress, or other runtime state. State must be preserved across storage and movement.

### 4.3 Inventory slot

Inventory is slot-based.

Each inventory slot can hold either:

1. a stack of identical stackable stateless items, or
2. one non-stackable item instance.

A slot cannot contain multiple different item IDs.

Inventory stacking is automatic. When an item enters inventory, the inventory first fills compatible existing stacks up to `maxStackSize`, then creates the next stack only when needed. The player should not be responsible for manually combining split stacks, because inventory normalization is a system responsibility.

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

Any item with non-empty runtime state is automatically non-stackable while that state exists. This preserves state to avoid losing or merging instance-specific state.

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

This is invalid because a normal stone chain must not become a diamond chain without an explicit geology/refining/transmutation rule.

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

Stash and producer are separate entity types even if they share large parts of their implementation. Do not merge finite and infinite production into one vague type. Shared implementation is allowed, but gameplay entity types remain separate.

### 4.12 Producer/stash input storage

A producer or stash may have its own internal storage for input items required by its behavior.

This is not a second player inventory. It is item-instance state belonging to that producer/stash.

Input storage defines:

- which input item is accepted
- how many units are consumed per activation/cycle
- how many units can be stored in advance

Example:

A coal mine may require `1 sausage` and `1 beer` per production cycle and may store up to `4 sausage` and `4 beer` in advance. The player can later withdraw stored inputs through item detail when rules allow it. Withdrawal places items onto the board first, then falls back to normal inventory.

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

Global upgrades have a timer. Paying the cost starts the upgrade. The upgrade becomes active only when its real-world ready time has been reached.

## 5. Time model

Arkini uses real-world wall-clock time as the single source of truth for active timers.

If the app is closed, reloaded, suspended, or reopened later, every timer that was allowed to run keeps advancing according to wall-clock elapsed time. If the player returns after a month, every eligible board timer, producer cooldown, stash timer, craft/construction/growth timer, and global upgrade timer may be ready.

Changing the device clock can affect timers. This is accepted for current gameplay because Arkini is client-only/offline and does not try to punish offline players.

Location still matters:

- board items are active and their timers can advance
- inventory items are passive and their timers are paused
- global upgrade timers are active independently of board/inventory location

A paused inventory timer stores remaining duration or equivalent paused state. When the item returns to the board, it resumes from that preserved state using wall-clock time again.

## 6. Starting state

The current starting state is based on the existing implementation, with obsolete split inventory merged into the normal inventory.

### 6.1 Starting board

| Item ID | Position |
| --- | --- |
| `item:townhall-1` | `x=3, y=4` |
| `item:lumber-camp-1` | `x=1, y=4` |
| `item:quarry-1` | `x=5, y=4` |
| `item:coal-mine-1` | `x=3, y=6` |

### 6.2 Starting inventory

| Item ID | Quantity |
| --- | ---: |
| `item:blueprint-scrap` | `10` |
| `item:twig` | `8` |
| `item:pebble` | `8` |
| `item:water` | `4` |
| `item:sausage` | `3` |
| `item:beer` | `3` |
| `item:coin-stack` | `1` |

## 7. Inventory mechanics

### 7.1 Single inventory rule

There is exactly one player inventory.

All player-owned stored items go into this inventory, including currency items. Any implementation table, state slice, UI panel, or upgrade referring to a separate player inventory is obsolete and must be removed or migrated into the normal inventory model.

Producer/stash input storage is allowed because it belongs to the item instance and is not player storage.

### 7.2 Stack rules

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

When an item enters inventory from board, withdrawal, production overflow, stash output, upgrade refund, or any future source, the inventory must normalize placement automatically:

1. fill existing compatible stacks first
2. create a new stack only after compatible stacks are full
3. store stateful/non-stackable items as single-slot item instances
4. fail only when no valid inventory slot exists

The game should not create avoidable split stacks of the same stateless item under `maxStackSize`. Avoidable split stacks after an operation indicate an inventory normalization bug.

### 7.3 Board to inventory

Double-clicking an item on the board attempts to move that item into the normal inventory.

This rule is consistent across item types. Double-click does not produce, exhaust, open, activate, or collect. It stores.

The action succeeds when inventory has a valid slot for the item:

- an existing compatible stack with available capacity, or
- an empty slot for a new stack/item instance

The action fails when inventory has no valid slot. Failure should produce clear player feedback.

### 7.4 Inventory to board

Double-clicking an item in inventory attempts to move that item onto the board.

The action succeeds when the board has a valid free cell for the item. If the player does not provide a target cell, the game may choose the first valid free cell using a deterministic placement policy.

The action fails when the board has no valid free cell. Failure should produce clear player feedback.

### 7.5 Inventory passivity

Inventory preserves state but does not advance state.

If a running timer item is moved into inventory:

1. its timer pauses immediately
2. remaining duration is preserved
3. it cannot receive more input items while stored
4. it cannot complete while stored
5. it resumes only after being placed back on the board, if its rules still allow progress

This applies to every active timer in the game: craft timers, construction timers, growth timers, producer cooldowns, stash timers, and future active mechanics.

### 7.6 Inventory drag/swap

Inventory drag/drop is an organization action only.

Dragging an inventory slot onto another inventory slot swaps their contents.

Inventory drag/drop must not trigger merge, craft input deposit, producer input deposit, stash input deposit, production, stash opening, upgrade payment, or any other active gameplay behavior.

Inventory does not need a manual stack-combine interaction because stack normalization is automatic whenever items enter inventory.

### 7.7 Visual tile engine

Board cells and inventory slots are visual geometry and drop targets, not item owners. Rendered item tiles are stable actors managed through the generic `TileEngine` visual layer. A gameplay mutation may update durable board/inventory data, but the visual tile must not be replaced by a separate flyer copy just to animate movement.

Tile actions that create or move items should stage the final actor from an external rect, drop rect, producer, or stash source and let it settle into its committed slot. Spawn supports both instant batch output and stack/staggered output. This is visual state only; gameplay data remains owned by the runtime game engine.

## 8. Interaction rules

### 8.1 Single-click

Single-click is the default active interaction.

Single-click may:

- collect from a ready producer
- open/collect/exhaust from a ready stash
- activate another explicit item action, if later defined

Single-click is allowed to produce output, consume producer/stash inputs, advance stash depletion, or otherwise perform active gameplay.

### 8.2 Double-click

Double-click is an inventory-only placement interaction.

Double-click may:

- move an inventory item to the board

Board double-click is deliberately unused. Board item storage belongs to dragging that board item onto the inventory bottom-nav target.

Double-click must not have hidden production, stash opening, exhaust, special collect behavior, or board storage behavior.

### 8.3 Board drag/drop

Board drag/drop is the default direct manipulation interaction on the board.

Dragging a board item to an empty valid board cell moves the item.

Dragging a board item to an occupied board cell attempts the first valid behavior in this order:

1. merge or blueprint binding
2. feed craft/construction/growth progress
3. feed producer input storage
4. feed stash input storage
5. swap board item positions

Feed means the dragged item is deposited into the target entity's state according to that entity's accepted input rules. Producer and stash feeding are both supported. A locked chest requiring a key is a stash input.

If none of merge, binding, craft feed, producer feed, or stash feed is valid, occupied-cell drag/drop swaps the two board items.

Game data must avoid ambiguous source-target pairs. The same source item and target item pair must not be both a merge/binding pair and an input-feed pair. If a pair matches multiple active behaviors, the game definition is invalid unless an explicit rule documents the intended priority.

### 8.4 Inventory drag/drop

Inventory drag/drop swaps inventory slots and does nothing else.

Inventory is passive. Dragging inside inventory must not merge items, feed craft, feed producer, feed stash, start timers, collect output, or pay upgrades.

Stacking is handled automatically by inventory normalization when items enter inventory, so the player does not need a manual stack-combine action.

### 8.5 Long press / item detail

Long press on a board item opens the item detail for that item instance.

The item detail must show every gameplay-relevant piece of information available for that item, including when relevant:

- item identity, kind, tags, and description
- merge chain participation
- valid merge outputs
- blueprint binding rules
- craft/construction/growth requirements
- deposited inputs
- remaining inputs
- active, ready, or paused timers
- producer cooldown and readiness
- producer input storage
- stash input storage
- stash remaining charges or depletion state
- active loot table ID
- possible loot drops and their rules/probabilities, when known to the player
- upgrade effects that currently affect the item
- explicit actions available from the detail

Item detail is gameplay UI. If a mechanic exists and the player can reasonably inspect it, the detail is the canonical place to expose it.

### 8.6 Withdrawal from producer/stash input storage

Stored producer/stash inputs may be withdrawn only through item detail.

Withdrawal placement rule:

1. try to place withdrawn items onto board cells near the source item
2. if board placement cannot fit them, place the remaining items into normal inventory using inventory normalization
3. if neither board nor inventory can fit them, keep the remaining items stored in the producer/stash and show clear feedback

Withdrawal must not silently destroy items. Board-first placement is required so the player can see where withdrawn items went.

### 8.7 Consistency rule

If an interaction behaves differently for one item type, that difference must come from a clear mechanic and must use the correct interaction channel.

Examples:

- producer collection belongs to single-click
- stash opening/exhaust belongs to single-click
- board item storage belongs to dragging onto the inventory bottom-nav target
- inventory placement belongs to inventory double-click
- feeding belongs to board drag/drop
- withdrawal belongs to item detail

Do not add item-specific double-click exceptions. If a special behavior is needed, assign it to the correct interaction channel and document it.

### 8.8 Input source state rule

Any gameplay action that consumes a source item as input must preserve or explicitly handle source state.

Default rule: a stateful item cannot be consumed as input. This applies to craft inputs, producer inputs, stash inputs, and upgrade costs. Merge has its own stricter stateful-item rejection unless an explicit merge rule defines otherwise.

Exception: if the only runtime state is withdrawable nested storage, such as stored producer/stash inputs, the game may empty that storage before consuming the source item. Emptying uses board-first, inventory-fallback placement. If every nested item cannot be placed, the input action is rejected and the source item remains unchanged.

After nested storage is emptied, the source item may be consumed only if no remaining runtime state would be lost.

## 9. Merge mechanics

### 9.1 Merge purpose

Merge creates a better item from compatible lower-tier board items.

Merge provides access to needed materials, helps compress low-tier items, and supports early progression. It is not the only progression system.

### 9.2 Merge chain rules

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

### 9.3 Thematic consistency rule

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

### 9.4 Merge and stateful entities

An item with active or paused state must not be merged unless an explicit rule defines how that state is handled.

Default rule:

- stateful items cannot be merged
- running timer items cannot be merged
- items waiting for construction/growth/craft completion cannot be merged
- items with stored producer/stash inputs cannot be merged

### 9.5 Blueprint binding as merge-like interaction

Blueprint binding is a special merge-like interaction:

- completed blank blueprint + target entity -> bound blueprint for target entity
- binding creates a new item ID
- target entity is not consumed
- completed blank blueprint is transformed into the bound blueprint in its own source cell
- target entity remains in its original cell

This must be explicitly represented in data and tests so it does not get mixed with generic merge-chain behavior. The bound blueprint replaces the source blank blueprint. The target entity remains unchanged.

## 10. Producers

### 10.1 Producer purpose

Producers are the main repeatable source of economy inputs and advanced items.

Merge can create needed items, but feeding and upgrading producers should become the main driver of progression.

### 10.2 Producer trigger

A producer is triggered by single-click.

There are no automatic producers in current gameplay. A producer that is ready does nothing until the player activates it.

### 10.3 Producer cooldown

Each producer has a cooldown/refresh time.

When the cooldown is complete, required input items are available, and output placement is possible, a single-click activation may produce output from the active loot table.

Refresh time may be changed by upgrades.

Because inventory is passive, producer cooldown does not advance while the producer item is stored in inventory.

### 10.4 Producer loot output

A producer uses a named loot table to decide generated outputs.

A producer may generate:

- one item
- multiple different items
- multiple copies of the same item

The output count and probability rules must be encoded in named loot table data, not hidden in UI code or inline in random item definitions.

### 10.5 Producer output placement

Default producer output placement is `board_then_inventory`.

This means:

1. try to place produced items onto valid board cells near the producer origin
2. if board placement cannot fit all produced items, place remaining produced items into normal inventory using inventory normalization
3. if the complete generated output cannot fit across board and inventory, the activation fails with no gameplay state change

Producer output is all-or-nothing. Activation must not consume inputs, start cooldown, or mutate state unless the complete generated output can be placed.

Random output must be rolled as part of activation validation. If the rolled output cannot fit, the activation is rejected. The player does not receive a free extra roll or a delayed reroll opportunity.

Board placement must use a deterministic nearest-free-cell policy based on the producer origin. Exact tie-breaking must be deterministic and testable.

### 10.6 Producer inputs and requirements

A producer may define consumable product-line inputs and reusable requirement gates.

Consumable inputs are items consumed per successful production cycle. They belong to product lines through named input references.

Producer and product requirements are referenced by `requirementIds`, not embedded inline. The IDs point into the central top-level `requirements` table. Producer-level `requirementIds` gate every product line on that producer. Product-level `requirementIds` gate only that concrete product line. When both exist, all producer and product requirements must pass.

Central requirement definitions currently support:

- `stored`: an item must be stored inside the target item instance and is not consumed by production
- `passive`: an item quantity must exist in board, inventory, or both according to scope
- `proximity`: at least one configured item ID must exist near the producer tile within configured grid distance

Proximity requirements use Chebyshev grid distance:

`distance = max(abs(dx), abs(dy))`

That means `distance: 1` includes all 8 neighboring cells around the producer, including diagonals. This is deliberate. We are building a grid game, not submitting lumber camps to a geometry tribunal.

Example:

A lumber camp may have `requirementIds: ["requirement:lumber-camp-1-near-tree"]`, where that requirement is a proximity requirement for `item:tree` within distance `1`. A later upgrade may replace the producer requirement IDs with a looser distance `2` requirement, or with an empty list to remove the proximity gate entirely.

Stored requirements use the same owner item-instance storage principles as producer inputs. They are not player inventory and they make the owner item instance stateful while stored.

### 10.7 Producer input storage

Producer input storage exists to store required production input items.

Producer input storage is item-instance state. It makes that producer instance stateful and therefore non-stackable.

A producer may contain more input items than one production cycle requires, up to configured capacity.

The player may withdraw stored producer input items only through item detail. Withdrawal places items onto the board first, then falls back to normal inventory.

### 10.8 Producer readiness

A producer is ready when:

1. its cooldown has completed
2. every persistent requirement item is present in producer storage
3. every consumable input item is present in producer storage
4. the active loot/production rule can generate a non-empty output
5. the complete generated output can be placed according to output placement rules

Production consumes configured input quantities only when the complete output can be placed. Persistent requirements are never consumed by production. If validation fails, activation is rejected without consuming inputs or changing cooldown/state.

## 11. Stashes

### 11.1 Stash purpose

A stash is a finite source of items.

Stashes cover chests, crates, finite caches, reward containers, and similar entities.

### 11.2 Stash trigger

A stash is opened/collected by single-click when its requirements are satisfied.

Dragging the stash onto the inventory bottom-nav target stores it in inventory. Double-click does not store, open, or exhaust a board stash.

### 11.3 Stash depletion

A stash must define its finite behavior explicitly.

Possible models:

- fixed number of charges
- fixed stored contents
- fixed number of loot table rolls
- removal on depletion
- transformation into an empty item on depletion

The selected depletion behavior must be data-driven.

### 11.4 Stash inputs

A stash may require input items before opening or collecting.

Example:

An epic chest may require a key.

Stash input storage follows the same storage principles as producer input storage, but stash remains a separate entity type. If a stash defines persistent requirements, those requirements must be present but are not consumed when the stash is opened.

### 11.5 Stash output placement

Default stash output placement is `board_then_inventory`, using the same deterministic nearest-free-cell policy based on the stash origin.

Stash output is all-or-nothing. Activation must not consume inputs, advance charges, deplete contents, or mutate state unless the complete generated output can be placed across board and inventory.

Random stash output must be rolled as part of activation validation. If the rolled output cannot fit, the activation is rejected. The player does not receive a free extra roll or a delayed reroll opportunity.

## 12. Loot tables

### 12.1 Loot table as standalone entity

Loot tables are standalone data entities.

A producer or stash references its active loot table by ID.

Preferred ID pattern:

- `loot:<entity-id>` for base table
- `loot:<entity-id>:better-1` for upgraded table
- `loot:<entity-id>:better-2` for next upgraded table

Example:

- `item:lumber-camp-1` references `loot:lumber-camp-1`
- an upgrade switches it to `loot:lumber-camp-1:better-1`

### 12.2 Loot table definition

A loot table must never produce zero output on a successful activation. A zero-output loot table is invalid game data.

A loot table must define:

- stable ID
- roll model
- possible item outputs
- probability or weight per output
- min/max quantity per output
- duplicate behavior
- validation that every successful roll produces at least one output item

### 12.3 Loot table upgrades

Loot table upgrades switch the active loot table ID.

Do not patch drop rates directly inside upgrade logic. Probability changes belong in named loot tables.

## 13. Blueprint mechanics

### 13.1 Blueprint purpose

Blueprints turn abstract construction progress into concrete target construction.

They allow the player to prepare a generic completed blueprint first, then bind it to a target entity later.

### 13.2 Blank blueprint lifecycle

Blueprint lifecycle:

1. Player obtains or creates blueprint components.
2. Player completes a blank blueprint through merge, craft, or construction progress.
3. Completed blank blueprint is generic and has no target.
4. Player binds the completed blank blueprint to a target entity.
5. Binding creates a bound blueprint item ID.
6. Bound blueprint has craft/construction requirements.
7. Completing bound blueprint produces, upgrades, or unlocks the target result.

### 13.3 Binding blueprint to entity

Binding rule:

- completed blank blueprint + target entity -> bound blueprint for that target
- target entity remains and does not disappear
- blank blueprint becomes target-specific
- the result is a new item ID
- the bound blueprint replaces the source blank blueprint in its source cell
- the target entity remains in its original cell

Example:

- completed blank blueprint + `item:lumber-camp-1` -> `item:blueprint-lumber-camp-1`
- `item:lumber-camp-1` still exists after binding

Implementation details such as `imprint` or `consumeSource: false` are not the mechanic. The mechanic is: bind blueprint, replace the source blueprint with the specific blueprint, keep the target entity unchanged.

### 13.4 Bound blueprint as craftable item

A bound blueprint is a craftable item.

It defines a recipe and optional completion timer. It is not a special hardcoded building-tier system.

Example pattern:

- `item:blueprint-lumber-camp-2` may require its own recipe and then complete into `item:lumber-camp-2`

The exact recipe belongs to economy design and central data, not to special gameplay branching.

## 14. Craft / construction / growth progress

### 14.1 Purpose

Craft/construction/growth progress represents incomplete entities that require input items, time, or both.

This mechanic applies to blueprints, building construction, growth, and similar transformations.

Examples:

- bound blueprint becoming a building
- watered sprout becoming a sapling
- sapling becoming a tree

### 14.2 Location behavior

A craftable/progress item may exist on the board or in inventory.

Board is active. Inventory is passive.

When the item is on the board, it may accept input items and advance timers according to its definition.

When the item is in inventory, it preserves state but does not accept inputs, does not advance timers, and cannot complete.

### 14.3 Requirement model

A craft/construction/growth entity should define:

- entity ID
- accepted input item IDs
- required quantities
- already deposited quantities in item-instance input storage
- optional completion duration, including `0` for instant completion
- output/result item ID
- completion behavior

Default completion behavior: the completed result replaces the progress item in the same board cell. If the result cannot occupy that cell, completion is blocked until the state becomes valid. Completion does not spawn the result elsewhere unless an explicit mechanic says so.

### 14.4 Feeding progress

Input items can be deposited into an incomplete craft/construction/growth entity only when the entity is on the board and can currently accept input.

Deposited items are moved into craft/progress input storage owned by the target item instance. They are not kept in normal board or inventory locations and are consumed only as part of successful completion.

Input source state follows the global input source state rule.

### 14.5 Completion timer

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
9. Completion happens only while the item is on the board and the real-world ready time has been reached.

### 14.6 Stateful progress preservation

Progress state must survive all allowed movement.

This includes:

- board movement
- board to inventory movement
- inventory to board movement
- app reload
- save/load

State loss during movement is a gameplay bug.

## 15. Upgrade system

### 15.1 Upgrade purpose

Upgrades are global progression modifiers.

They make specific entities better or unlock more advanced behavior.

### 15.2 Upgrade targeting

Each upgrade targets a concrete entity or exact mechanic scope.

Examples:

- `item:lumber-camp-1` cooldown
- `item:lumber-camp-1` loot table
- `item:coal-mine-1` cooldown

This keeps upgrade data explicit and avoids unclear global behavior.

### 15.3 Upgrade lifecycle

Upgrade lifecycle:

1. Player pays explicit item costs.
2. Upgrade starts.
3. Upgrade has `durationMs` and a real-world ready time.
4. Upgrade is inactive while the timer is running.
5. Upgrade becomes active when the real-world ready time has been reached.
6. Active upgrade effects are permanent for the save unless a future rule says otherwise.

### 15.4 Supported upgrade effect types

Current implementation-supported effect types are:

- `product.duration.add`
- `product.outputTable.set`
- `product.inputRef.set`
- `product.input.quantity.add`
- `product.requirementIds.set`
- `producer.maxQueueSize.add`
- `producer.requirementIds.set`

Requirement ID upgrade effects are replacement operations. They do not merge with current IDs. Setting `requirementIds: []` intentionally removes all requirements for that target. This applies both to producer/building-wide requirements and concrete product-line requirements.

Inventory size is fixed at `7 x 5`. No current upgrade should change normal inventory size. Any existing player-inventory capacity upgrade is obsolete and should be removed with the split inventory system.

### 15.5 Loot table upgrades

Loot table upgrades should switch active loot table IDs by tier.

Preferred model:

- producer starts with `loot:lumber-camp-1`
- upgrade changes producer to `loot:lumber-camp-1:better-1`
- next upgrade changes producer to `loot:lumber-camp-1:better-2`

Avoid scattering probability patches throughout logic. Probability changes belong in named loot tables.

### 15.6 Upgrade costs

Upgrades cost explicit stateless item stacks or explicitly allowed stateless item instances.

Currency items such as coins are normal items stored in normal inventory and may be used as upgrade costs.

Stateful items cannot be used as upgrade payment unless a future mechanic explicitly defines safe state handling. Default upgrade costs should be stateless stackable items.

## 16. Feedback and animation specification

This document must eventually describe animation and interaction feedback rules with enough precision that implementation can wire Motion, CSS transitions, or another animation system without inventing gameplay meaning outside the specification.

Animation specs should define behavior, not final art direction. Exact colors, particle assets, easing constants, and polish values can live in UI/theme files unless they affect gameplay readability.

### 16.1 Feedback principles

Every active interaction should provide clear feedback for success, failure, blocked state, progress, and readiness.

Feedback should be local to the affected board item or inventory slot whenever possible. Global toasts should be reserved for cases where local feedback cannot explain the state.

### 16.2 Required feedback categories

The game should define feedback/animation rules for at least:

- board item movement
- board item swap
- inventory slot swap
- board -> inventory storage
- inventory -> board placement
- successful merge/binding
- invalid merge/feed attempt
- craft/construction/growth input deposit
- craft/construction/growth timer start
- craft/construction/growth timer pause/resume
- craft/construction/growth completion
- producer ready state
- producer cooldown progress
- producer activation
- producer output blocked by insufficient placement capacity
- stash ready state
- stash opening/exhaust
- stash output blocked by insufficient placement capacity
- input withdrawal
- inventory full / board full failure
- upgrade start and completion

### 16.3 Animation data shape

For each interaction, the spec should eventually define:

- trigger
- source element
- target element or target cell
- visual state before animation
- visual state after animation
- movement path, if any
- scale/opacity/position changes, if any
- whether gameplay state changes before, during, or after animation
- what happens when animation is interrupted by another action

Until a concrete animation spec exists, implementation should choose minimal local feedback over ambiguous visual polish.

### 16.4 Current merge/feed animation rules

Same-item board merge, mixed consumption, blueprint imprinting, producer drops, stash dumps, and inventory placement all use the same visual rule: the final board/inventory item actor is the real actor. There is no separate duplicate overlay representation for the same item. Cells/slots provide geometry and feedback; items live in stable item layers and animate transform/priority there.

Newly committed actors may be staged from a source rectangle through `useVisualItemMotions`. During that transient phase they can render above their source with raised priority, then settle back to normal priority when Motion completes. Drag/drop keeps the active source hidden until the durable command and query invalidation settle, preventing the source actor from reappearing on its old slot and then animating a second time.

Blueprint binding remains separate from consumption. It commits the blueprint binding first and then keeps the non-consumed dragged building tied to its own item actor so the player can see that the building survived.

## 17. Economy validation rules

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
13. No successful loot table activation may produce zero output.
14. No source-target item pair may match multiple interaction behaviors unless explicitly documented.

## 18. Data model expectations

The central game configuration should be able to express at least these concepts.

### 18.1 Item definition

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

### 18.2 Item instance state

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

### 18.3 Inventory definition

Expected fields:

- slot count: `35`
- slot placement rules
- automatic stack normalization rules
- inventory slot swap rules
- max stack handling
- stateful item handling

### 18.4 Interaction definition

Expected fields or equivalent rule definitions:

- single-click action mapping
- double-click action mapping
- board drag/drop action priority
- inventory drag/drop action behavior
- long press item detail behavior
- withdrawal placement rules
- failure feedback rules

### 18.5 Merge definition

Expected fields:

- `id`
- `withItemId`
- `resultItemId`
- `consumeSource`, if needed
- `secret`, if needed

Merge is always a two-item interaction. Anything more complex belongs to producers, stashes, craft recipes or another explicit mechanic, not a fake variable-input merge rule.

### 18.6 Producer definition

Expected fields:

- `id`
- `name`
- ordered product line IDs
- producer-level requirements
- product-level duration/input/output-table rules
- input requirements
- input storage capacities
- output placement rules
- all-or-nothing output validation
- upgrade targets

### 18.7 Stash definition

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
- all-or-nothing output validation

### 18.8 Loot table definition

Expected fields:

- `id`
- `rolls`
- `entries`
- `itemId`
- `weight` or `probability`
- `minCount`
- `maxCount`
- `allowDuplicateResults`
- non-empty output validation

### 18.9 Blueprint definition

Expected fields:

- `id`
- `targetEntityId`, for bound blueprints
- `bindingRules`
- craft/construction reference
- completion result

### 18.10 Craft/construction/growth definition

Expected fields:

- `id`
- `targetEntityId`, if any
- accepted inputs
- required quantities
- completion duration, including `0`
- completion result
- allowed locations
- timer pause/resume behavior

### 18.11 Upgrade definition

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

## 19. Current example chains and entities

These examples are canonical directionally, but exact item IDs and tiers will be finalized during economy design.

### 19.1 Wood chain

A wood chain starts from small natural wood items and ends in useful wood material.

Example direction:

- twig
- branch
- log
- wood bundle
- plank
- beam

The chain must not become stone, ore, coins, diamonds, or food.

### 19.2 Stone chain

A stone chain starts from small stones and ends in useful construction stone material.

Example direction:

- pebble
- stone
- stone block

The chain must not become gem/diamond unless a separate geology/refining mechanic explicitly supports it.

### 19.3 Producer examples

- lumber camp: wood material source
- quarry: stone material source
- coal mine: coal/fuel source
- iron mine: ore/metal source

### 19.4 Producer feed examples

- coal mine may consume sausage and beer
- producer may store more feed items than one production cycle requires
- stored feed items may be withdrawn through item detail, board first and inventory fallback

### 19.5 Stash examples

- basic crate: finite output, removed or emptied after depletion
- epic chest: finite output, requires key input before opening

## 20. Open design questions

These are intentionally not finalized yet.

1. What are the final concrete economy merge chains?
2. Which exact producers exist in the first balanced economy pass?
3. Which exact stashes exist in the first balanced economy pass?
4. What are the exact named loot tables and their probabilities?
5. What are the exact blueprint recipes for each building/tier?
6. Which craft/construction/growth items use timers, and what are their durations?
7. Can a bound blueprint ever be rebound to another target?
8. Are upgrade tiers strictly linear, or can some branches exist?
9. Can merge chains require more than two input items?
10. Can special merges use non-consuming participants besides blueprint binding?
11. What exact tie-break order should the nearest-free-cell placement use when multiple cells are equally valid?

Until these questions are answered, implementation should choose the simplest explicit behavior and document it here before coding.

## 21. Implementation migration notes

These notes describe known differences from the current implementation that must be fixed.

### 21.1 Required migration work

1. Inventory must support stateful item instances, not only stateless stacks.
2. Stateful inventory items must be non-stackable.
3. Board -> inventory storage must preserve item runtime state.
4. Inventory -> board placement must restore item runtime state.
5. Producer/stash cooldowns, timers, stored inputs, charges, and craft progress must pause in inventory and resume on board.
6. Split infinite producers and finite stashes into separate entity types.
7. Move producer/stash outputs to named loot table entities and reference them by ID.
8. Producer/stash activation must be all-or-nothing: if the full generated output cannot be placed, reject activation without state changes.
9. Withdrawal from producer/stash input storage must be available only through item detail and must place to board first, then inventory.
10. Add item detail coverage for merge, craft, timers, producer state, stash state, loot drops, inputs, upgrades, and explicit actions.
11. Add or document animation/feedback rules before implementing polished interactions.
12. Current `GameConfig` economy chains may be replaced during the economy design pass.
13. Active board/global timers must use real-world ready times and complete across app reload/closed time.
14. Interaction data validation must reject ambiguous source-target behavior pairs.

### 21.2 Obsolete implementation concepts to remove

These concepts are not part of canonical gameplay and should be removed during cleanup unless this document later reintroduces them explicitly.

1. Separate `playerInventory` gameplay concept.
2. `playerInventoryStack` storage/table/state slice.
3. `playerInventorySlots` save/config capacity.
4. Player inventory UI/sheet as a second storage surface.
5. Starting state that puts currency into `playerInventory`. Currency belongs in normal inventory.
6. Collectible behavior that stores items into a separate player inventory.
7. `collect` as a special item behavior for currency.
8. Double-click exhaust/open/collect behavior. Double-click is inventory placement only.
9. `doubleClickBehavior: "exhaust"`. It is replaced by single-click stash exhaust/open.
10. Mixed `producer.mode` finite/infinite model. Finite entities are `stash`; infinite/long-lived entities are `producer`.
11. Player-inventory capacity upgrade.
12. Inventory capacity upgrade as current gameplay. Inventory size is fixed at `7 x 5`.
13. Any upgrade, UI, schema, or copy that implies a wallet/currency layer separate from normal inventory.
14. Resource/currency storage outside item inventory unless a future mechanic explicitly reintroduces it here.
15. Inline base producer output definitions once named loot tables are introduced for all producer/stash outputs.

Obsolete means delete or migrate unless this document explicitly reintroduces the concept later.

## 22. Implementation testing checklist

A gameplay implementation should provide tests or validation for:

1. moving item from board to inventory by dragging onto the inventory bottom-nav target
2. moving item from inventory to board by double-click
3. board double-click has no gameplay behavior
4. double-click never triggers producer output
5. double-click never opens/exhausts stash output
6. single-click triggers ready producer
7. single-click triggers ready stash
8. inventory full failure behavior
9. board full failure behavior
10. automatic inventory normalization fills compatible stacks before creating new stacks
11. stackable stateless item stacking up to `maxStackSize`
12. non-stackable building occupying one slot
13. stateful item occupying one slot and not stacking
14. inventory slot drag swaps slot contents
15. inventory drag never triggers merge/feed/production
16. board drag moves item to empty cell
17. board drag swaps incompatible occupied cells
18. board drag performs valid merge/binding before swap
19. board drag feeds craft/construction/growth before swap
20. board drag feeds producer input storage before swap
21. board drag feeds stash input storage before swap
22. stateful item state preserved through board -> inventory -> board
23. inventory pauses craft/construction/growth timers
24. inventory pauses producer cooldowns
25. inventory item cannot receive craft/construction inputs
26. ordinary merge chain success
27. invalid merge rejection
28. thematic merge chain validation from data
29. stateful item merge rejection unless explicit rule exists
30. producer cooldown timing on board
31. producer cooldown paused in inventory
32. producer loot table rolls from named table ID
33. producer generating multiple items
34. producer generating duplicate item outputs when allowed
35. producer input deposit
36. producer input withdrawal from item detail
37. withdrawal places to board first, then inventory
38. withdrawal keeps remaining stored items when board and inventory cannot fit them
39. producer production blocked by missing inputs
40. producer production consumes required inputs only for production that actually happens
41. producer activation rejects when full generated output cannot fit
42. producer output uses deterministic nearest-free-cell placement from producer origin
43. stash finite depletion
44. stash input requirement, for keyed/locked stashes
45. stash activation rejects when full generated output cannot fit
46. stash output uses deterministic nearest-free-cell placement from stash origin
47. blank blueprint completion
48. blank blueprint binding to target entity
49. target entity not consumed by blueprint binding
50. bound blueprint receiving construction inputs
51. craft/construction timer starts after required inputs are deposited
52. craft/construction timer pauses in inventory
53. craft/construction completion on board
54. item detail shows merge information
55. item detail shows craft/construction/growth progress and timers
56. item detail shows producer/stash state, inputs, charges, and loot information
57. upgrade cost payment from normal inventory
58. upgrade timer lifecycle
59. upgrade reducing producer cooldown
60. upgrade switching producer loot table ID
61. obsolete `playerInventory` concepts are absent from gameplay logic
62. obsolete `collect` behavior is absent from gameplay logic
63. obsolete double-click exhaust behavior is absent from gameplay logic
64. save compatibility behavior when game definition version changes
65. board timers advance while the app is closed
66. inventory timers do not advance while the app is closed
67. global upgrade timers advance while the app is closed
68. zero-output loot tables are rejected as invalid data
69. ambiguous source-target interaction definitions are rejected as invalid data
70. blueprint binding replaces the source blueprint and keeps the target entity in place
71. craft completion replaces the progress item in the same board cell
72. stateful source items are rejected as inputs unless nested storage is fully ejected first
73. nested producer/stash storage ejection rejects the input action when board and inventory cannot fit the nested contents
