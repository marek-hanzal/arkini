# GAME.MD

This document is the canonical gameplay specification for Arkini.

It is intentionally written as an LLM-optimized source of truth. When game logic, economy balance, data definitions, migrations, UI behavior, or tests are validated, this document should be checked before reading implementation details.

`GameConfig` is implementation data. It may be older than this document. When `GameConfig` and `GAME.MD` disagree, `GAME.MD` wins and the implementation must be updated.

## 1. Purpose

Arkini is a client-only offline merge/economy game played on a grid.

The player collects items, merges low-tier items into better items, feeds producers, opens finite stashes, builds or crafts incomplete objects, stores surplus in inventory, and spends materials on construction and tier progression. Progress is mostly driven by producers, stashes, and craft/construction requirements. Merge is important, but it is not the whole core loop.

## 2. Canonical design rules

These rules define how the game should be interpreted when implementation details are unclear.

1. `GAME.MD` is the source of truth for gameplay semantics.
2. All gameplay entities should be data-driven from a central game configuration.
3. Game definitions must describe items, merge chains, producers, stashes, loot tables, blueprints, craft/construction requirements, building tiers, grid sizes, inventory sizes, starting state, and other game rules.
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
14. Active board timers use real-world wall-clock time. If the app is closed and later reopened, eligible active timers may already be complete.

## 3. Current fixed constants

| Concept | Value |
| --- | --- |
| Board size | `7 x 11` |
| Board slot count | `63` |
| Inventory size | `7 x 5` |
| Inventory slot count | `35` |
| Inventory model | one canonical player inventory |
| Inventory capacity changes | not part of current gameplay |
| Merge role | basic mechanic, not complete core loop |
| Main economy source | click-triggered producers, finite stashes, crafting, construction |
| Blueprint model | concrete target-specific blueprint items |
| Blueprint acquisition | specific blueprint is acquired directly through gameplay |
| Craft/construction location | board or inventory, with active progress only on board |
| Building tier progression | physical item/producer tiers, not global config patches |
| Loot table model | named loot table entities referenced by products and stashes |
| Time model | real-world wall-clock time for active board/global timers |

## 4. Vocabulary

### 4.1 Board / game grid

The board is the primary visible grid where the player places items and interacts with active gameplay entities.

The current board size is `7 x 11` cells.

An item may be on the board when it occupies one board cell. If multi-cell items are introduced later, their footprint must be defined in the central game configuration.

Board is an active location. Producers, stashes, craft timers, construction timers, and growth timers can run only while the relevant item is on the board and its own rules allow it. Active board timers use real-world wall-clock time, including time while the app is closed.

### 4.2 Inventory

The inventory is the only canonical player storage.

The current inventory size is `7 x 5` slots, for `35` total slots.

There is no separate `playerInventory`, wallet inventory, currency inventory, or second player storage layer. Coins, diamonds, and other currency-like objects are normal inventory items unless a future mechanic explicitly introduces a different model.

Inventory may contain ordinary items, currency items, unfinished craft/construction entities, blueprint items, producers, stashes, and any other item that is allowed to be stored.

Inventory is passive. Nothing active happens inside inventory, even if real-world time passes while the app is closed:

- producer product jobs do not advance
- stash timers do not advance, if a stash ever has one
- craft/construction timers do not advance
- growth timers do not advance
- items cannot be merged inside inventory
- items cannot receive craft/construction inputs inside inventory
- producers cannot produce inside inventory
- stashes cannot be opened inside inventory

Inventory must preserve item state. Moving a stateful item into inventory must not erase deposited inputs, timers, producer jobs, producer stored inputs, construction progress, or other runtime state. State must be preserved across storage and movement.

### 4.3 Inventory slot

Inventory is slot-based.

Each inventory slot can hold either:

1. a stack of identical stackable stateless items, or
2. one non-stackable item instance.

A slot cannot contain multiple different item IDs.

Inventory stacking is automatic. When an item enters inventory, the inventory first fills compatible existing stacks up to `maxStackSize`, then creates the next stack only when needed. The player should not be responsible for manually combining split stacks, because inventory normalization is a system responsibility.

Inventory is not a universal hiding place. Item definitions declare `storage`: `board`, `inventory`, or `both`, with `both` as the default. Board-only items, such as future fire/danger tiles, must never be moved into inventory, saved there, or loaded there. Inventory-only items likewise must not be placed onto the board.

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
- concrete building blueprint
- lumber camp
- quarry
- coal mine
- finite chest/stash

### 4.5 Currency item

A currency item is an item used as rare progression payment, sink currency, or future trade material.

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
- producer product-line job/queue state
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

Merge is a basic mechanic, but it is not the whole core game. The main long-term economy comes from producers, stashes, feeding producers, construction/craft progress, and craft/construction progression.

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

A producer is player-started and then runs a timed product job. Producers do not automatically start new jobs without player activation, but already started jobs may finish later through the tick/runtime job system.

A producer does not use a separate generic cooldown model. Product lines define their own durations, queue behavior, inputs, requirements, and outputs. Those rules are defined by the concrete producer/product tier in config; they are not patched by save-driven global upgrades.

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

### 4.12 Item-owned input storage and requirements

Some board item instances own nested input state. This is not a second player inventory. It belongs to the target item instance and exists only for mechanics that explicitly define it.

Current persistent nested storage is used by:

- producer product-line inputs
- craft/construction/growth inputs
- stored requirements

Producer input storage defines:

- which product line owns the stored input
- which input item is accepted
- how many units are consumed per production start
- how many units can be stored in advance

Example:

A coal mine may require `1 sausage` and `1 beer` per production cycle and may store up to `4 sausage` and `4 beer` in advance. The player can later withdraw stored producer inputs through item detail when rules allow it. Withdrawal places items onto the board first, then falls back to normal inventory.

Stash consumable inputs are currently open-time inputs, not persistent stash input storage. A locked chest can consume a key when opened. Persistent stash gates should use stored requirements instead.

### 4.13 Loot table

A loot table is a standalone data entity defining possible outputs and probabilities for a producer, stash, or other generation mechanic.

Loot tables should have stable IDs, for example:

- `loot:lumber-camp-1`
- `loot:lumber-camp-1:better-1`
- `loot:quarry-1`

Producer product lines and stashes reference loot tables by ID. Better output should be modeled as another product/building tier with its own named loot table instead of mutating probability numbers inside scattered item definitions.

### 4.14 Blueprint

A blueprint is a concrete craft/construction entity used to create a specific structure/entity or replace it with a higher physical tier.

Blueprints are target-specific from the moment they enter gameplay. There is no blank blueprint imprint/binding step.

Examples:

- lumber camp blueprint
- quarry blueprint
- townhall blueprint
- lumber camp level 2 blueprint

A blueprint is just a craftable item with a recipe and optional completion timer. The exact recipe is data, not special hardcoded blueprint behavior.

### 4.15 Specific building blueprint

A specific building blueprint already knows what it constructs or improves.

It may be acquired through loot, barter, quests, producer outputs, or any other explicit config path. The challenge is acquiring the correct blueprint, not binding a generic one later.

### 4.16 Craft/construction progress

Craft/construction progress is the state of an incomplete item that requires input items, time, or both before becoming complete.

This mechanic applies to blueprints, building construction, growth, and similar incomplete entities.

Examples:

- concrete blueprint becoming a lumber camp
- lumber camp level 2 blueprint becoming lumber camp level 2
- watered sprout becoming a sapling after a timer

### 4.17 Building tier progression

A building tier progression is a physical replacement of one concrete building/item tier with another. The usual model is a blueprint/craft recipe that consumes the previous tier plus materials and produces the next tier.

Global/world-wide upgrade effects are intentionally not part of gameplay. If a farm should become better, define `farm-t2`. If a producer needs different duration, inputs, requirements, hindrances, queue size, or loot, define those rules on the concrete higher-tier producer/product.

## 5. Time model

Arkini uses real-world wall-clock time as the single source of truth for active timers.

If the app is closed, reloaded, suspended, or reopened later, every timer that was allowed to run keeps advancing according to wall-clock elapsed time. If the player returns after a month, every eligible board timer, producer job, stash timer, and craft/construction/growth timer may be ready.

Changing the device clock can affect timers. This is accepted for current gameplay because Arkini is client-only/offline and does not try to punish offline players.

Location still matters:

- board items are active and their timers can advance
- inventory items are passive and their timers are paused

A paused inventory timer stores remaining duration or equivalent paused state. When the item returns to the board, it resumes from that preserved state using wall-clock time again.

## 6. Starting state

The current starting state is tutorial-oriented: it starts with Town Hall I plus a tiny wood/stone/water/source setup so the player can learn production, blueprint acquisition, and blueprint construction before the full economy opens up.

### 6.1 Starting board

| Item ID | Position |
| --- | --- |
| `item:tree` | `x=0, y=1` |
| `producer:lumberjack-t1` | `x=1, y=1` |
| `item:wheat-field` | `x=0, y=3` |
| `producer:townhall-t1` | `x=3, y=4` |
| `producer:well-t1` | `x=5, y=4` |
| `item:rock` | `x=0, y=6` |
| `producer:quarry-t1` | `x=1, y=6` |

### 6.2 Starting inventory

| Item ID | Quantity |
| --- | ---: |
| none | `0` |

## 7. Inventory mechanics

### 7.1 Single inventory rule

There is exactly one player inventory.

All player-owned stored items go into this inventory, including currency items. Any implementation table, state slice, UI panel, or mechanic referring to a separate player inventory is obsolete and must be removed or migrated into the normal inventory model.

Item-owned input storage, such as producer product-line inputs, craft inputs, and stored requirements, is allowed because it belongs to the target item instance and is not player storage.

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

A pure stateless producer may stack only if its item definition allows it. A producer with queued/running jobs, stored inputs, blocked delivery, or any other state cannot stack.

When an item enters inventory from board, withdrawal, production overflow, stash output, or any future source, the inventory must normalize placement automatically:

1. fill existing compatible stacks first
2. create a new stack only after compatible stacks are full
3. store stateful/non-stackable items as single-slot item instances
4. fail only when no valid inventory slot exists

The game should not create avoidable split stacks of the same stateless item under `maxStackSize`. Avoidable split stacks after an operation indicate an inventory normalization bug.

### 7.3 Board to inventory

Board item storage is an explicit item-detail action. Long press a board item, open its detail, and use the store action. Board double-click is deliberately unused and must not store, produce, exhaust, open, activate, or collect.

The action succeeds when the item definition allows inventory storage and inventory has a valid slot for the item:

- an existing compatible stack with available capacity, or
- an empty slot for a new stack/item instance

If the board item has preservable runtime state, it enters inventory as a single item instance with the same item instance ID. If it has no runtime state, it may normalize into an existing inventory stack.

The action fails when inventory has no valid slot or the item definition forbids inventory storage. Failure should produce clear player feedback.

### 7.4 Inventory to board

Double-clicking/tapping an inventory item attempts to move one item from that inventory slot onto the board.

If no placement target is active, the item goes to the first valid free board cell in deterministic scan order.

Long press on an empty board cell opens inventory in placement-target mode. In this mode, selecting an inventory item attempts to place one item at the chosen cell first. If that exact cell is no longer available, or if a stack/batch placement needs additional cells, placement uses the same nearest-by-Manhattan policy around the chosen seed cell that producer and stash output use.

The action succeeds when the item definition allows board storage and at least one valid board cell exists. Stateful inventory instances move as the same preserved item instance. Stateless stack items split one item from the stack unless a future explicit batch action says otherwise.

The action fails when the board has no valid free cell or the item definition forbids board storage. Failure should produce clear player feedback.

### 7.5 Inventory passivity

Inventory preserves state but does not advance state.

If a running timer item is moved into inventory:

1. its timer pauses immediately
2. remaining duration is preserved
3. it cannot receive more input items while stored
4. it cannot complete while stored
5. it resumes only after being placed back on the board, if its rules still allow progress

This applies to every active timer in the game: craft timers, construction timers, growth timers, producer jobs, stash timers, and future active mechanics.

### 7.6 Inventory drag/swap

Inventory-to-inventory drag/drop is an organization action only.

Dragging an inventory slot onto another inventory slot swaps their contents.

Dragging inside inventory must not trigger merge, craft input deposit, producer input deposit, stash opening, production, or any other active gameplay behavior.

Dragging an inventory item out to the board is a board interaction and may place the item onto an empty board cell or apply it to an occupied board item through the same interaction plan as board-source feeding/merge.

Inventory does not need a manual stack-combine interaction because stack normalization is automatic whenever items enter inventory.

### 7.7 Visual tile engine

Board cells and inventory slots are visual geometry and drop targets, not item owners. Rendered item tiles are stable actors managed through the generic `TileEngine` visual layer. A gameplay mutation may update durable board/inventory data, but the visual tile must not be replaced by a separate flyer copy just to animate movement.

Tile actions that create or move items should stage the final actor from an external rect, drop rect, producer, or stash source and let it settle into its committed slot. Spawn supports both instant batch output and stack/staggered output. This is visual state only; gameplay data remains owned by the runtime game engine.

## 8. Interaction rules

### 8.1 Single-click

Single-click is the default active interaction.

Single-click may:

- start the default producer product line, when it can start
- open/collect/exhaust from a ready stash
- activate another explicit item action, if later defined

Single-click is allowed to start production, consume producer inputs, consume successful stash open-time inputs, advance stash depletion, or otherwise perform active gameplay.

### 8.2 Double-click

Double-click is an inventory-only placement interaction.

Double-click may:

- move an inventory item to the board

Board double-click is deliberately unused. Board item storage belongs to the explicit item-detail store action.

Double-click must not have hidden production, stash opening, exhaust, special collect behavior, or board storage behavior.

### 8.3 Board drag/drop

Board drag/drop is the default direct manipulation interaction on the board.

Dragging a board item to an empty valid board cell moves the item.

Dragging a board item to an occupied board cell attempts the first valid behavior in this order:

1. source-owned merge
2. stored requirement deposit
3. craft/construction/growth input deposit
4. producer product-line input deposit
5. stash open with the dragged item as a consumable input, when the stash definition accepts that input
6. swap board item positions

A reverse-directed merge is intentionally not invented. If the dragged source item does not own a matching merge rule, merge is not considered and later interaction rules may still apply, including swap. Directional rules are data, not vibes in a trench coat.

Producer product-line input deposit respects runtime line priority: an explicitly selected default product line is filled first, then later product lines in configured order. If the default line is full, feeding continues to the next matching line with capacity.

Stash consumable inputs are open-time inputs, not persistent stash input storage. Dragging a matching key/item onto a stash attempts to open the stash with that input immediately. Persistent stash gates use stored requirements instead.

If none of merge, stored requirement deposit, craft feed, producer feed, or stash-open input is valid, occupied-cell drag/drop swaps the two board items.

Game data must avoid ambiguous source-target pairs. The same source item and target item pair must not be both a merge pair and an input-feed pair. If a pair matches multiple active behaviors, the game definition is invalid unless an explicit rule documents the intended priority.

### 8.4 Inventory drag/drop

Inventory-to-inventory drag/drop swaps inventory slots and does nothing else.

Inventory is passive. Dragging inside inventory must not merge items, feed craft, feed producer, feed stash, start timers, or collect output.

Inventory-to-board drag/drop is different: dragging an inventory item onto an empty board cell attempts `inventory.item.place`, while dragging it onto an occupied board item applies the same source-to-board-item interaction plan used by board drag/drop. This can merge, fill stored requirements, feed craft, feed producer product-line inputs, or open a keyed stash if the data allows it. Invalid inventory-to-board interactions are rejected, not swapped.

Stacking is handled automatically by inventory normalization when items enter inventory, so the player does not need a manual stack-combine action.

### 8.5 Long press / item detail

Long press on a board item opens the item detail for that item instance.

Long press on an empty board cell opens inventory in placement-target mode using that empty cell as the placement seed.

The item detail must show every gameplay-relevant piece of information available for that item, including when relevant:

- item identity, kind, tags, and description
- merge chain participation
- valid merge outputs
- craft/construction/growth requirements
- path-choice warnings and exclusive branch conflicts before the player invests resources
- deposited inputs
- remaining inputs
- active, ready, or paused timers
- producer product-line jobs, queue, readiness, and blocked delivery
- producer input storage
- stash requirements, inputs, charges, and depletion state
- stash remaining charges or depletion state
- active loot table ID
- possible loot drops and their rules/probabilities, when known to the player
- explicit actions available from the detail

Item detail is gameplay UI. If a mechanic exists and the player can reasonably inspect it, the detail is the canonical place to expose it.

### 8.6 Withdrawal from item-owned storage

Stored producer product-line inputs and craft inputs may be withdrawn only through item detail.

Producer product-line input withdrawal withdraws the entire stored quantity for that product line and item ID. Craft input withdrawal may withdraw a configured quantity, currently one item from the UI.

Withdrawal placement rule for producer and craft inputs:

1. try to place withdrawn items onto board cells near the source item
2. if board placement cannot fit them, place the remaining items into normal inventory using inventory normalization
3. if neither board nor inventory can fit them, reject the withdrawal and keep the items stored

Stored requirement withdrawal exists at the engine/action level and currently returns items to inventory normalization. UI exposure for stored requirement withdrawal is not part of the current surface.

Withdrawal must not silently destroy items.

### 8.7 Consistency rule

If an interaction behaves differently for one item type, that difference must come from a clear mechanic and must use the correct interaction channel.

Examples:

- producer product start belongs to single-click or explicit item-detail product action
- stash opening/exhaust belongs to single-click
- board item storage belongs to the explicit item-detail store action
- inventory placement belongs to inventory double-click
- feeding belongs to board-target drag/drop, whether the source comes from board or inventory
- withdrawal belongs to item detail

Do not add item-specific double-click exceptions. If a special behavior is needed, assign it to the correct interaction channel and document it.

### 8.8 Input source state rule

Any gameplay action that consumes a source item as input must preserve or explicitly handle source state.

Default rule: a stateful item cannot be consumed as input. This applies to craft inputs, producer inputs, and stash inputs. Merge has its own stricter stateful-item rejection unless an explicit merge rule defines otherwise.

Exception: if the only runtime state is withdrawable nested storage, such as stored producer inputs or craft inputs, the game may empty that storage before consuming the source item. Emptying uses board-first, inventory-fallback placement. If every nested item cannot be placed, the input action is rejected and the source item remains unchanged.

After nested storage is emptied, the source item may be consumed only if no remaining runtime state would be lost.

### 8.9 Tile removal

Some board tiles can define `removeBy` rules. A remove rule says which tool item can remove the target tile and whether that tool is kept or consumed.

Tile removal is an explicit engine action, `tile.remove`, and only applies to board items. A tile cannot remove itself, the tool quantity must be exactly one, and a tile with a running producer job cannot be removed.

Removal deletes the target board item and clears its runtime state. If the rule mode is `consume`, the tool is consumed. If the rule mode is `keep`, the tool remains.

The current drag/drop UI does not treat removal as a generic fallback. If removal is surfaced in gameplay, it must be surfaced intentionally instead of accidentally eating board hazards because two item IDs happened to touch.

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
- items with stored item-owned inputs or stored requirements cannot be merged

### 9.5 Blueprint imprinting is not supported

Blueprints are not bound or imprinted through board drag/drop.

A build blueprint must already be a concrete target-specific item, such as `item:blueprint-lumberjack-t1`, before it can enter the construction/craft flow. Dragging a building onto a blueprint does not create a new blueprint and does not have special non-consuming merge behavior.

## 10. Producers

### 10.1 Producer purpose

Producers are the main repeatable source of economy inputs and advanced items.

Merge can create needed items, but feeding and upgrading producers should become the main driver of progression.

### 10.2 Producer trigger

A producer is triggered by single-click on the board or by an explicit product-line start action from item detail.

There are no automatic producers in current gameplay. A producer that can start does nothing until the player activates it.

Single-click on the board starts the current runtime default product line only when the player explicitly selected one for that concrete producer instance. Without an explicit default, the click is a noop.

Item detail may show all product lines and can start any line directly.

### 10.3 Producer product jobs and queue

Current producers do not use a separate refresh/cooldown clock. A successful activation starts a timed product job. Product duration is the production time between start and completion.

Each producer definition has `maxQueueSize`. This is a per-producer-instance limit over running plus queued jobs. If a producer already has `maxQueueSize` jobs, starting another product is rejected with a queue-full failure.

Jobs for one producer instance run sequentially. Starting a second job while the first is running queues it after the previous job's completion time instead of running it in parallel.

Product duration may be changed by concrete product tier data, requirements, hindrances, and proximity duration multipliers. The computed duration is captured when the job starts. Moving a resource after job start does not retroactively change that running job.

Because inventory is passive, producer jobs require the producer item to be on the board. A producer item with a running job cannot be moved into inventory by normal storage.

### 10.4 Producer product lines

A producer owns ordered product lines through `productIds`. Each product line defines its own duration, optional input reference, requirements, placement, optional visibility markers, and optional output table.

Product lines may define `showIf`, an OR list of marker item IDs. A hidden line is not shown in runtime producer detail, cannot be selected as default, cannot receive producer inputs through normal priority routing, and cannot be started. `showIf` only checks whether any marker item exists anywhere in the current save; it does not consume that marker and is not a replacement for inputs or requirements. This is meant for late-game path-specific variants where one building can offer different recipes depending on whether the player chose Engineers, Faith, or Mages, because apparently civilization must eventually pick a flavor of nonsense.

### Board max count

Items may define `maxCount` to cap how many copies of that item can exist on the board at once. Missing `maxCount` means unlimited. The cap is board-only: inventory stacks and stored inputs are not counted. Runtime placement, debug spawn, merge results, craft completion, and save/config validation all honor the limit. Board-and-inventory outputs may spill remainder into inventory; board-only outputs fail with `board:max-count`. This is mainly for buildings like wells, path keystones, or other content that should not be spammed across the board like a zoning disaster with icons.

Runtime save state may store a default product line per concrete producer item instance. The default affects:

- board single-click activation
- generic producer feeding when multiple lines accept the same item

Producer feeding priority is:

1. current default product line, if it accepts the item with available capacity
2. the next product line in configured order with available capacity

If the default line is full, feeding continues to the next matching line.

### 10.5 Producer loot output and sink products

A product line may reference a named loot table to decide generated outputs.

A loot-producing product may generate:

- one item
- multiple different items
- multiple copies of the same item

The output count and probability rules must be encoded in named loot table data, not hidden in UI code or inline in random item definitions.

A product line may also omit `outputTableId`. Missing output table means a valid delayed sink/destructor product: the product job consumes its inputs, waits for its duration, completes, and creates no output. This is not a zero-output loot table. It is an explicit no-output product.

### 10.6 Producer output placement and blocked delivery

Default producer output placement is `board_then_inventory`.

When a producer job completes, output placement tries to:

1. place produced items onto valid board cells near the producer origin
2. place any remaining produced items into normal inventory using inventory normalization
3. block delivery if the complete output cannot fit across board and inventory

Producer output placement is atomic per completion attempt. A completion attempt either places the complete generated output and removes the job, or places nothing and keeps the job blocked with its already-rolled delivery saved on the job.

A blocked producer delivery retries later. The output is not rerolled while blocked. The saved delivery must eventually be placed as rolled, or remain blocked until the board/inventory state changes.

Board placement uses deterministic nearest-free-cell policy based on the producer origin: Manhattan distance from the seed cell, then scan order by `y`, then `x`. Without a seed cell, placement uses scan order by `y`, then `x`. Yes, the little grid goblin has rules.

### 10.7 Producer inputs and requirements

A producer may define consumable product-line inputs and reusable requirement gates.

Consumable inputs are items consumed per successful product start. They belong to product lines through named input references.

Producer and product requirements are referenced by `requirementIds`, not embedded inline. The IDs point into the central top-level `requirements` table. Producer-level `requirementIds` gate every product line on that producer. Product-level `requirementIds` gate only that concrete product line. When both exist, all producer and product requirements must pass.

Central requirement definitions currently support:

- `stored`: an item must be stored inside the target item instance and is not consumed by production
- `passive`: an item quantity must exist in `board`, `inventory`, or `board_or_inventory` according to scope
- `proximity`: at least one configured item ID must exist near the producer tile within configured grid distance; it may also slow production through `durationFactor`

Proximity requirements use Chebyshev grid distance:

`distance = max(abs(dx), abs(dy))`

That means `distance: 1` includes all 8 neighboring cells around the producer, including diagonals. This is deliberate. We are building a grid game, not submitting lumber camps to a geometry tribunal.

Proximity can affect producer product duration. Each satisfied proximity requirement uses the nearest matching resource distance and multiplies it by `durationFactor` (missing factor behaves as `1`). The final product duration multiplier is the average of all satisfied proximity requirement multipliers from both the producer and selected product line. The result is clamped so proximity never makes a product faster than its base duration.

Examples with `durationFactor: 1`:

- nearest tree at distance `1` keeps base product duration
- nearest tree at distance `2` makes the product take roughly `2×` base duration
- if both producer and product define proximity rules, their multipliers are averaged

Example:

A lumber camp may have `requirementIds: ["requirement:lumber-camp-1-near-tree"]`, where that requirement is a proximity requirement for `item:tree` within distance `2`. A later concrete building tier may define looser requirement IDs, lower duration penalties, or no proximity gate at all.

Stored requirements use the same owner item-instance storage principles as producer inputs. They are not player inventory and they make the owner item instance stateful while stored.

Production hindrances are negative effects on producers or product lines. They do not prevent production from starting. Every active hindrance instance applies a duration penalty, and active penalties stack multiplicatively. Passive hindrances react to item presence in a configured scope. Proximity hindrances react to every matching nearby board item; closer hindrances are worse. Example: each pollution tile within radius `2` near a farm slows grain production without making the farm invalid.


### 10.8 Producer input storage and auto-fill

Producer product-line input storage exists to store required production input items per concrete producer instance and product line.

Producer input storage is item-instance state. It makes that producer instance stateful and therefore non-stackable.

A product line may contain more input items than one production cycle requires, up to configured capacity.

The player may feed producer inputs by dragging matching items onto the producer. The engine selects the target product line using default-line priority, configured order, and remaining input capacity.

The player may also start a product line with empty or partially filled inputs. In that case, the engine auto-fills only the missing quantities before starting the product. Auto-fill searches board items first in deterministic scan order, excluding the producer itself, then inventory slots in slot order. Board-sourced auto-fill emits visual producer-input movement; inventory-sourced auto-fill has no board flight animation because the item is already hidden in inventory, the coward.

If auto-fill cannot find enough matching inputs, the product start is rejected with no state change.

The player may withdraw stored producer input items only through item detail. Withdrawal places items onto the board first, then falls back to normal inventory.

### 10.9 Producer readiness

A product line can start when:

1. the producer item is on the board
2. the product line belongs to the producer
3. the producer queue has room
4. all producer-level and product-level requirements pass
5. every consumable input is already stored or can be auto-filled from board/inventory

Starting production consumes configured input quantities immediately. Persistent/stored requirements are never consumed by production. If validation fails, activation is rejected without consuming inputs or changing job state.

Output capacity is checked at completion time, not start time. If completion output cannot fit, the job becomes blocked and preserves its rolled delivery for retry.

### 10.10 Exclusive path choices

Items may define directional `exclusiveToIds`. This is a hard coexistence constraint, not a slowdown. If item A lists item B, A cannot be created or owned while B is owned. The reverse is not implied in config; asymmetric design is allowed. Runtime still checks both the item being created and already-owned items so an action cannot create a save where any owned item violates its declared exclusivity.

This rule is intended for branch choices such as faith versus engineering. The player must see the choice early enough to make an informed decision. For construction flows this means the blueprint/craft target must show the warning before any resources are invested. If the exclusive target is already owned, the craft cannot accept manual inputs, auto-fill inputs, partial-fill inputs, start, or complete. Final creation and save validation also enforce the same rule, because UI-only truth is how tiny civilizations die screaming.

Choice warnings are not hidden just because they are currently valid. Fulfilled normal requirements may be hidden, but an exclusive choice remains visible as a warning until the item exists or the player leaves that path alone.

## 11. Stashes

### 11.1 Stash purpose

A stash is a finite source of items.

Stashes cover chests, crates, finite caches, reward containers, and similar entities.

### 11.2 Stash trigger

A stash is opened/collected by single-click when its requirements are satisfied and any open-time inputs are either already supplied by the click action or available for auto-fill from board/inventory. If required inputs are missing, single-click opens the stash detail instead of raising an action error.

A board stash may also be opened by dragging a matching consumable input onto it, when the stash definition accepts that input. This is an immediate open attempt, not persistent stash input deposit.

Board item storage still belongs to the explicit item-detail store action. Double-click does not store, open, or exhaust a board stash.

### 11.3 Stash depletion

A stash must define its finite behavior explicitly.

Current gameplay opens the whole stash in one action. If the stash has multiple remaining charges, one successful open rolls/releases every remaining charge and then depletes the stash. This avoids turning a chest into a weird loot vending machine that needs ten taps because apparently fingers are free.

Possible depletion models:

- fixed number of charges
- fixed stored contents
- fixed number of loot table rolls
- removal on depletion
- transformation into an empty item on depletion

The selected depletion behavior must be data-driven.

### 11.4 Stash inputs and requirements

A stash may require consumable input items before opening.

Example:

An epic chest may require a key.

Consumable stash inputs are supplied at open time. Single-click may auto-fill these inputs from board/inventory. The input item is consumed only if the whole stash open succeeds. If placement fails, the input remains unchanged.

If a stash needs a persistent non-consumed gate, it should use stored requirements. Stored requirements must be present to satisfy the gate, but they are not consumed when the stash opens unless a future rule explicitly says otherwise.

### 11.5 Stash output placement

Default stash output placement is `board_then_inventory`, using the same deterministic nearest-free-cell policy based on the stash origin.

Stash output is all-or-nothing for the whole open action. Activation must not consume inputs, advance charges, deplete contents, or mutate state unless the complete generated output can be placed across board and inventory.

Random stash output is rolled during the open attempt. If the rolled output cannot fit, activation is rejected and the player does not receive a free extra roll.

## 12. Loot tables

### 12.1 Loot table as standalone entity

Loot tables are standalone data entities.

A producer or stash references its active loot table by ID.

Preferred ID pattern:

- `loot:<entity-id>` for base table
- `loot:<entity-id>:better-1` for a higher-tier table
- `loot:<entity-id>:better-2` for a later higher-tier table

Example:

- `item:lumber-camp-1` references `loot:lumber-camp-1`
- a higher-tier product references `loot:lumber-camp-1:better-1`

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

### 12.3 Higher-tier loot tables

Higher-tier producers/products may reference different named loot tables.

Do not patch drop rates directly inside runtime logic. Probability changes belong in named loot tables attached to concrete product tiers.

## 13. Blueprint mechanics

### 13.1 Blueprint purpose

Blueprints turn construction progress into concrete target construction.

A blueprint is acquired already target-specific. It may represent a building, higher-tier replacement, or other future constructed entity.

### 13.2 Blueprint lifecycle

Blueprint lifecycle:

1. Player obtains a concrete target-specific blueprint through gameplay.
2. The blueprint accepts its configured craft/construction inputs.
3. The blueprint runs its optional completion timer.
4. Completion produces or unlocks the configured target result.

There is no blank blueprint completion step and no later bind/imprint action.

### 13.3 Concrete blueprint as craftable item

A concrete blueprint is a craftable item.

It defines a recipe and optional completion timer. It is not a special hardcoded building-tier system.

Example pattern:

- `item:blueprint-lumber-camp-2` may require its own recipe and then complete into `item:lumber-camp-2`

The exact recipe belongs to economy design and central data, not to special gameplay branching.

### 13.4 Era gate blueprint

A progression blueprint may require ownership of an entire era before it can complete.

The current Town Hall model uses this for era advancement: crafting the next Town Hall consumes the current Town Hall tier and passively requires every physical building/place from the current era. These requirements use `board_or_inventory`, because the game cares that the player owns the infrastructure, not whether every building is staged on the board for a tiny zoning hearing.

Higher Town Hall tiers do not need to re-issue lower-era blueprints if the era gate already proves the old era has been physically built. Players who want duplicate older buildings should build them before moving to the next era; failing to do so may slow later economy, but must not soft-lock progression.

## 14. Craft / construction / growth progress

### 14.1 Purpose

Craft/construction/growth progress represents incomplete entities that require input items, time, or both.

This mechanic applies to blueprints, building construction, growth, and similar transformations.

Examples:

- concrete blueprint becoming a building
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

Current gameplay uses explicit start. Depositing the last required input makes the craft/progress item ready to start, but it does not automatically start the timer. The player starts it through the item detail action. Yes, we are letting the player press the big obvious button instead of hiding state transitions in the floorboards.

Rules:

1. If duration is `0`, completion happens instantly after the explicit start action succeeds.
2. If duration is greater than `0`, the item enters a running timer after the explicit start action succeeds.
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

## 15. Building tier progression

Arkini does not have global/world-wide upgrades. There is no top-level upgrade config, no upgrade job map, no save-driven config overlay, and no runtime upgrade effect that patches product or producer rules.

Progression to a better building is modeled as a concrete physical tier:

1. The player acquires a target-specific blueprint or craft target.
2. The craft recipe consumes required materials and usually the previous building tier.
3. Completion replaces the old tier with the new concrete item/producer tier.
4. The new tier carries its own config: product lines, requirements, hindrances, durations, queue size, loot tables, art, and labels.

This keeps gameplay readable. The player owns `farm-t2`, not an invisible save overlay that secretly mutates `farm-t1`. Capacity or world-scale mechanics may be introduced later as explicit systems, but not through a generic global upgrade patch layer.

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
- successful merge
- invalid merge/feed attempt
- craft/construction/growth input deposit
- craft/construction/growth timer start
- craft/construction/growth timer pause/resume
- craft/construction/growth completion
- producer ready state
- producer product job progress
- producer product start
- producer output blocked by insufficient placement capacity
- stash ready state
- stash opening/exhaust
- stash output blocked by insufficient placement capacity
- input withdrawal
- inventory full / board full failure
- craft/tier completion

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

Same-item board merge, mixed consumption, producer drops, stash dumps, and inventory placement all use the same visual rule: the final board/inventory item actor is the real actor. There is no separate duplicate overlay representation for the same item. Cells/slots provide geometry and feedback; items live in stable item layers and animate transform/priority there.

Newly committed actors may be staged from a source rectangle through `useVisualItemMotions`. During that transient phase they can render above their source with raised priority, then settle back to normal priority when Motion completes. Drag/drop keeps the active source hidden until the durable command and query invalidation settle, preventing the source actor from reappearing on its old slot and then animating a second time.


## 17. Economy validation rules

The economy should be validated using these rules:

1. Every required input item must have at least one defined source.
2. Every producer product-line or stash output must be useful in at least one merge chain, craft requirement, construction requirement, building tier recipe, or future unlock path.
3. Merge chains must not create unrelated materials without an explicit transformation system.
4. Producer product-line inputs, stash open-time inputs, and stored requirements must be satisfiable from existing sources.
5. Producer product-line input capacity must be high enough to support intended cycles.
6. Loot table changes must be traceable through named product/building tiers.
7. Currency item sources and sinks must be balanced intentionally.
8. Inventory capacity must be considered when adding new chains or producers.
9. Stateful items must preserve state through all allowed movement.
10. No important economy behavior should live only in UI interaction code.
11. Exclusive branch constraints must be enforced by config/save validation and runtime creation guards, not only by detail-sheet warnings.
11. Existing `GameConfig` economy data is inspiration until a dedicated economy pass rewrites it to match this document.
12. No successful loot table activation may produce zero output.
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
- `storage`: `board`, `inventory`, or `both`; default `both`
- `tags`
- optional producer definition reference
- optional stash definition reference
- optional craft/construction definition reference
- optional `removeBy` rules for board/tile removal

### 18.2 Item instance state

Expected fields:

- instance ID, if stored as instance
- item definition ID
- location: board, inventory, item-owned input storage, stored requirement storage, or other explicit scope
- board position, if on board
- inventory slot, if in inventory
- quantity, if stackable stateless stack
- runtime state object, if stateful

Runtime state must be able to represent:

- deposited craft/construction/growth inputs
- remaining or ready-at timer state
- paused timer state
- producer product-line jobs, queued timings, blocked delivery, and stored input state
- producer input storage
- craft/construction/growth input storage
- stored requirement state
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
- `secret`, if needed

Merge is always a two-item interaction. Anything more complex belongs to producers, stashes, craft recipes or another explicit mechanic, not a fake variable-input merge rule.

### 18.6 Producer definition

Expected fields:

- `id`
- `name`
- ordered product line IDs
- producer-level requirements
- maximum queue size
- product-level duration/input/output-table rules
- optional sink product behavior when no output table is defined
- product-level requirements
- product-line enable/default runtime state
- input requirements
- input storage capacities
- auto-fill source priority rules
- output placement rules
- blocked delivery retry behavior

### 18.7 Stash definition

Expected fields:

- `id`
- `name`
- trigger: `click`
- finite behavior model
- charges/contents/roll count
- current whole-stash open behavior
- active loot table ID, if table-driven
- open-time consumable inputs, if any
- persistent stored requirements, if any
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
- concrete target/result reference
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
9. Can merge chains require more than two input items?

Until these questions are answered, implementation should choose the simplest explicit behavior and document it here before coding.

Current placement tie-break is no longer open: seeded nearest-free placement uses Manhattan distance, then row `y`, then column `x`. Unseeded board placement scans row-major by `y`, then `x`.

## 21. Implementation conformance notes

These notes track where the current implementation already matches this document and where the remaining cleanup is still intentional. This section is not a graveyard for already-fixed migration work, because keeping solved problems around as “urgent” is how teams summon project-management demons.

### 21.1 Current implementation alignment

1. Inventory is the single player storage surface. Separate `playerInventory` gameplay has been removed from the active model.
2. Inventory supports stateless stacks and stateful item instances. Stateful items are non-stackable.
3. Board -> inventory storage preserves runtime state through the explicit item-detail store action.
4. Inventory -> board placement restores runtime state and supports empty-cell long-press placement targets.
5. Producers and stashes are separate entity types.
6. Producer and stash outputs use named loot tables when they generate items.
7. Producer output capacity is handled at completion time with blocked delivery retry and preserved rolled delivery.
8. Stash activation is all-or-nothing for the whole open action.
9. Producer and craft input withdrawal is exposed through item detail and must not silently destroy nested items.
10. Active timers/jobs use real-world timestamps and are processed by the runtime tick. Inventory remains passive.
11. Merge direction, requirement definitions, storage policy, starting state invariants, and ambiguous interaction rules are centralized in game config/schema validation where they belong.
12. Current `GameConfig` economy chains may still be replaced during the dedicated economy design pass.
13. Feedback and animation rules exist as a baseline but can still be polished as long as they do not invent gameplay behavior.

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
11. Player-inventory capacity mechanics as a separate storage layer.
12. Inventory capacity changes as current gameplay. Inventory size is fixed at `7 x 5`.
13. Any global upgrade UI, schema, or copy that implies save-driven config patching.
14. Resource/currency storage outside item inventory unless a future mechanic explicitly reintroduces it here.
15. Inline base producer output definitions once named loot tables are introduced for all loot-producing producer/stash outputs.

Obsolete means delete or migrate unless this document explicitly reintroduces the concept later.

## 22. Implementation testing checklist

A gameplay implementation should provide tests or validation for:

1. moving item from board to inventory through the explicit item-detail store action
2. moving item from inventory to board by double-click/tap
3. empty-board-cell long press opens inventory placement-target mode
4. inventory placement target prefers the chosen cell, then nearest-by-Manhattan fallback
5. board double-click has no gameplay behavior
6. double-click never triggers producer output
7. double-click never opens/exhausts stash output
8. single-click starts the default producer product line when ready
9. single-click opens a ready stash
10. inventory full failure behavior
11. board full failure behavior
12. automatic inventory normalization fills compatible stacks before creating new stacks
13. stackable stateless item stacking up to `maxStackSize`
14. non-stackable building occupying one slot
15. stateful item occupying one slot and not stacking
16. inventory slot drag swaps slot contents
17. inventory-to-inventory drag never triggers merge/feed/production
18. board drag moves item to empty cell
19. board drag swaps incompatible occupied cells
20. board drag performs valid merge before swap
21. board drag feeds craft/construction/growth before swap
22. board drag feeds producer product-line input storage before swap
23. board drag can open keyed stashes with open-time consumable inputs
24. stateful item state preserved through board -> inventory -> board
25. inventory pauses craft/construction/growth timers
26. inventory item cannot receive craft/construction inputs
27. ordinary merge chain success
28. invalid merge rejection
29. thematic merge chain validation from data
30. stateful item merge rejection unless explicit rule exists
31. producer product duration timing on board
32. producer queue size and sequential queued start/completion timing
33. producer default product-line selection
34. producer proximity requirements affect duration through `durationFactor`
35. producer proximity effects average across producer-level and product-level proximity requirements
36. producer loot table rolls from named table ID
37. producer generating multiple items
38. producer generating duplicate item outputs when allowed
39. producer input deposit
40. producer auto-fill consumes board sources before inventory sources
41. producer input withdrawal from item detail
42. withdrawal places to board first, then inventory
43. withdrawal keeps remaining stored items when board and inventory cannot fit them
44. producer production blocked by missing inputs
45. producer production consumes required inputs only for production that actually starts
46. producer blocked delivery preserves rolled output and retries without rerolling
47. producer output uses deterministic nearest-free-cell placement from producer origin
48. sink product lines with no output table complete without spawning output
49. stash finite depletion
50. stash single open releases all remaining charges
51. stash open-time input requirement, for keyed/locked stashes
52. stash activation rejects when full generated output cannot fit
53. stash output uses deterministic nearest-free-cell placement from stash origin
54. concrete blueprint item can enter craft/construction flow
55. concrete blueprint receiving construction inputs
56. concrete blueprint completion produces configured target
57. blank blueprint imprinting is absent from config/runtime
58. craft/construction timer starts only after explicit start action
59. craft/construction timer pauses in inventory
60. craft/construction completion on board
61. item detail shows merge information
62. item detail shows craft/construction/growth progress and timers
63. item detail shows producer/stash state, inputs, charges, and loot information
64. obsolete `playerInventory` concepts are absent from gameplay logic
65. obsolete `collect` behavior is absent from gameplay logic
66. obsolete double-click exhaust behavior is absent from gameplay logic
67. save compatibility behavior when game definition version changes
68. board timers advance while the app is closed
69. inventory timers do not advance while the app is closed
70. zero-output loot tables are rejected as invalid data
71. ambiguous source-target interaction definitions are rejected as invalid data
72. blueprint imprinting/binding behavior is absent from board drag/drop
73. craft completion replaces the progress item in the same board cell
74. stateful source items are rejected as inputs unless nested storage is fully ejected first
75. nested producer/craft storage ejection rejects the input action when board and inventory cannot fit the nested contents
76. tile `removeBy` rules support `keep` and `consume` modes when surfaced by gameplay actions
