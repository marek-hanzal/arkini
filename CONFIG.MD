# Arkini CONFIG.MD

This document describes Arkini game configuration authoring.

The configuration is a JSON data model. It defines game content: game metadata, board size, inventory size, resources, assets, items, merge rules, producer inputs, requirements, producers, products, loot tables, stashes, craft recipes, and starting state.

The main rule is ID composition: each entity has a stable ID and other entities reference it by that ID.

Example links:

```json
{
  "items": {
    "item:twig": {
      "assetId": "asset:item:twig"
    }
  },
  "producers": {
    "producer:lumber-camp-1": {
      "productIds": ["product:lumber-camp-1"]
    }
  },
  "products": {
    "product:lumber-camp-1": {
      "outputTableId": "loot:lumber-camp-1"
    }
  }
}
```

## 1. Top-level structure

A compiled `GameConfig` contains these sections:

```json
{
  "version": 1,
  "game": {},
  "resources": {},
  "assets": {},
  "items": {},
  "merge": {},
  "inputs": {},
  "requirements": {},
  "effects": {},
  "producers": {},
  "stashes": {},
  "craftRecipes": {},
  "products": {},
  "lootTables": {},
  "startingState": {}
}
```

Source JSON files can be fragments. A fragment can contain one section:

```json
{
  "items": {
    "item:twig": {
      "...": "..."
    }
  }
}
```

or multiple sections:

```json
{
  "items": {},
  "merge": {},
  "lootTables": {}
}
```

Fragments are merged into one final config.

## 2. ID conventions

IDs should be short, stable, and obvious from the collection they live in. Do not repeat information that the collection name already provides. A resource item named `log` should be `item:log`, not `item:wood-t1:resource:log`, because humans already lost enough dignity to JSON.

Recommended patterns:

```txt
asset:<kind>:<name>
item:<name>
merge:<source>:<target>:<result>
input:<owner>:<item>
producer:<name>-t<tier>
product:<producer>:<output-item>
proximity:<owner>:<target>
stash:<name>
craft:<result-or-target>
loot:<owner>:<output-item>
```

Guidelines:

- Use lowercase ASCII and kebab-case names.
- Use `:` to separate semantic segments.
- Keep low-level resource/source item IDs plain: `item:tree`, `item:rock`, `item:log`, `item:plank`, `item:stone`, `item:stone-block`.
- Do not add tiers to ordinary resources unless the thing is truly a different semantic material. Prefer `item:hardwood-log` over `item:log-t2`.
- Use tiers for upgradeable producers/buildings: `producer:lumberjack-t1`, `producer:sawmill-t1`.
- Product IDs should show who makes what: `product:lumberjack-t1:log`.
- Input IDs should show who consumes what: `input:sawmill-t1:log`.
- Proximity IDs do not need a `requirement:` prefix. Proximity is already a requirement type, so use `proximity:lumberjack-t1:tree`.
- Loot IDs do not need `output` in the ID. Loot is already output-like, so use `loot:lumberjack-t1:log`.
- Do not rename IDs for balance changes, wording changes, labels, duration changes, or proximity distance changes.

Examples:

```txt
asset:item:tree
asset:item:log
item:tree
item:rock
item:log
item:plank
producer:lumberjack-t1
producer:sawmill-t1
product:lumberjack-t1:log
product:sawmill-t1:plank
input:sawmill-t1:log
proximity:lumberjack-t1:tree
proximity:sawmill-t1:lumberjack-t1
loot:lumberjack-t1:log
loot:sawmill-t1:plank
```

Keep IDs stable. Rename `name`, `label`, or `description` when display text changes. Do not rename IDs for wording or balance changes.

## 3. Common field meanings

- `quantity`: number of items.
- `capacity`: how many items can be stored in the input/requirement slot.
- `durationMs`: relative time in milliseconds. Runtime save state normalizes absolute timestamps as `startAtMs`, `readyAtMs`, `endAtMs`, `nextAttemptAtMs`, and event `atMs`; config does not author those absolute fields.
- `tier`: item/content level.
- `tags`: string labels used to group or describe content.
- `placement`: output placement rule.
- `code`: short unique code for the entity, usually without prefix.

Quantity in loot tables can be fixed:

```json
{
  "quantity": 2
}
```

or a range:

```json
{
  "quantity": {
    "min": 1,
    "max": 3
  }
}
```

Current placement value:

```txt
board_then_inventory
```

This means output tries board placement first, then inventory.

## 4. `version`

Current config format version:

```json
{
  "version": 1
}
```

## 5. `game`

Defines game metadata, board size, and inventory slots.

```json
{
  "game": {
    "id": "arkini",
    "title": "Arkini",
    "board": {
      "width": 7,
      "height": 11
    },
    "inventory": {
      "slots": 35
    }
  }
}
```

When changing board size, update `board.width` and `board.height`:

```json
{
  "game": {
    "id": "arkini",
    "title": "Arkini",
    "board": {
      "width": 7,
      "height": 11
    },
    "inventory": {
      "slots": 35
    }
  }
}
```

When changing inventory size, update `inventory.slots`:

```json
{
  "game": {
    "id": "arkini",
    "title": "Arkini",
    "board": {
      "width": 7,
      "height": 11
    },
    "inventory": {
      "slots": 42
    }
  }
}
```

## 6. `resources`

Contains resource data used by assets.

```json
{
  "resources": {
    "item-tree": {
      "data": "data:image/png;base64,..."
    }
  }
}
```

In source packages, resources are usually generated from PNG files. Assets reference resources by `resourceId`.

## 7. `assets`

Defines visual assets used by items and UI.

Plain item asset:

```json
{
  "assets": {
    "asset:item:log": {
      "kind": "item",
      "resourceId": "item-log",
      "render": "plain",
    }
  }
}
```

Fields:

- `kind`: `item` or `ui`.
- `label`: optional asset/debug label. Normal item names live on `items.*.name`; do not duplicate item names here.
- `resourceId`: resource ID.
- `overlayAssetId`: optional asset rendered as overlay.
- `render`: `plain` or `blueprint`.

Blueprint asset with overlay:

```json
{
  "assets": {
    "asset:item:blueprint-lumber-camp": {
      "kind": "item",
      "resourceId": "item-blueprint",
      "overlayAssetId": "asset:item:lumber-camp",
      "render": "blueprint",
    }
  }
}
```

UI asset:

```json
{
  "assets": {
    "asset:ui:coin": {
      "kind": "ui",
      "label": "Coin UI Icon",
      "resourceId": "ui-coin",
      "render": "plain",
    }
  }
}
```

Item usage:

```json
{
  "items": {
    "item:log": {
      "assetId": "asset:item:log"
    }
  }
}
```

## 8. `items`

Defines all item/tile definitions.

Item shape:

```json
{
  "items": {
    "item:twig": {
      "assetId": "asset:item:twig",
      "code": "twig",
      "name": "Twig",
      "tier": 1,
      "maxStackSize": 50,
      "maxCount": 3,
      "storage": "both",
      "description": "Small wood resource.",
      "label": "I",
      "tags": ["material", "wood"],
      "mergeIds": ["merge:twig-twig-branch"],
      "producerId": "producer:lumber-camp-1",
      "stashId": "stash:crate-1",
      "craftRecipeId": "craft:lumber-camp",
      "passiveEffectIds": ["effect:path.engineers.lock"],
      "removeBy": [
        {
          "itemId": "item:water",
          "mode": "consume"
        }
      ]
    }
  }
}
```

Fields:

- `assetId`: item asset.
- `code`: short unique item code.
- `name`: item display name.
- `tier`: item level.
- `maxStackSize`: max stack size in inventory.
- `maxCount`: optional maximum number of this item that may exist on the board at once. Omit it for unlimited board count. It does not limit inventory stacks or stored inputs.
- `storage`: `board`, `inventory`, or `both`. Defaults to `both`.
- `description`: item text.
- `label`: short label.
- `tags`: descriptive labels.
- `mergeIds`: merge rules available from this item.
- `producerId`: producer definition attached to this item.
- `stashId`: stash definition attached to this item.
- `craftRecipeId`: craft recipe attached to this item.
- `passiveEffectIds`: effects generated by this item. Each referenced effect decides where its source item counts through `effects.*.sourceScope`; omitted means board-only. The UI must list generated effects for buildings/items, including where they are active, so the player can see what rules the item emits.
- `removeBy`: removal rules using another item.

Storage values:

```txt
board
inventory
both
```

### 8.1 Basic resource item

```json
{
  "items": {
    "item:twig": {
      "assetId": "asset:item:twig",
      "code": "twig",
      "name": "Twig",
      "tier": 1,
      "maxStackSize": 50,
      "description": "Small wood resource.",
      "tags": ["material", "wood"],
      "mergeIds": ["merge:twig-twig-branch"]
    }
  }
}
```

### 8.2 Producer item

```json
{
  "items": {
    "item:lumber-camp-1": {
      "assetId": "asset:item:lumber-camp",
      "code": "lumber-camp-1",
      "name": "Lumber Camp I",
      "tier": 1,
      "maxStackSize": 1,
      "description": "Produces basic wood.",
      "label": "1",
      "tags": ["producer", "building", "wood"],
      "producerId": "producer:lumber-camp-1"
    }
  }
}
```

### 8.3 Stash item

```json
{
  "items": {
    "item:crate-4": {
      "assetId": "asset:item:crate-epic",
      "code": "crate-4",
      "name": "Epic Crate",
      "tier": 4,
      "maxStackSize": 1,
      "description": "Epic reward crate.",
      "tags": ["stash", "crate"],
      "stashId": "stash:crate-4"
    }
  }
}
```

### 8.4 Craft target item

```json
{
  "items": {
    "item:blueprint-lumber-camp": {
      "assetId": "asset:item:blueprint-lumber-camp",
      "code": "blueprint-lumber-camp",
      "name": "Lumber Camp Blueprint",
      "tier": 4,
      "maxStackSize": 5,
      "description": "Craft target for Lumber Camp I.",
      "tags": ["blueprint", "craft-target"],
      "craftRecipeId": "craft:lumber-camp"
    }
  }
}
```

### 8.5 Board-only item

```json
{
  "items": {
    "item:fire": {
      "assetId": "asset:item:fire",
      "code": "fire",
      "name": "Fire",
      "tier": 0,
      "maxStackSize": 1,
      "storage": "board",
      "description": "Board danger.",
      "tags": ["danger"],
    }
  }
}
```

### 8.6 Inventory-only item

```json
{
  "items": {
    "item:saw-license": {
      "assetId": "asset:item:saw-license",
      "code": "saw-license",
      "name": "Saw License",
      "tier": 0,
      "maxStackSize": 1,
      "storage": "inventory",
      "description": "Inventory-owned production permission.",
      "tags": ["license"],
    }
  }
}
```

### 8.7 Effect-authored path lock item

Path and faction exclusivity is authored through effects, not a separate item-level exclusivity field. Effects are hard gameplay rules. They are not soft UI gates, warnings, hints, or decorative balance confetti.

Use passive effects on the owned keystone building to close counter-paths:

- `line.blockStart` blocks counter-path production lines, usually blueprint products.
- `item.blockCreate` blocks creation, placement, merge/craft replacement, and product/spawn delivery of counter-path items.

The UI must always list effects generated by buildings/items. A player choosing a keystone must be able to see the emitted lock before and after commitment; invisible rule magic is just a bug wearing a wizard hat.

```json
{
  "items": {
    "producer:engineers-guild-t1": {
      "assetId": "asset:item:engineers-guild-t1",
      "code": "engineers-guild-t1",
      "name": "Engineers Guild I",
      "tier": 1,
      "maxStackSize": 1,
      "description": "Unlocks engineering choices.",
      "tags": ["building", "engineering"],
      "producerId": "producer:engineers-guild-t1",
      "passiveEffectIds": ["effect:path.engineers.lock"]
    }
  },
  "effects": {
    "effect:path.engineers.lock": {
      "name": "Engineering Commitment",
      "scope": "global",
      "operations": [
        {
          "kind": "line.blockStart",
          "target": {
            "producerIds": ["producer:university"],
            "productTagsAny": ["path:faith", "path:mages"]
          },
          "reason": "Engineering path already chosen."
        },
        {
          "kind": "item.blockCreate",
          "target": {
            "itemIds": ["producer:church-t1", "item:blueprint-church-t1"]
          },
          "reason": "Engineering path already chosen."
        }
      ]
    }
  }
}
```

### 8.8 Removal rule

```json
{
  "items": {
    "item:boulder": {
      "assetId": "asset:item:boulder",
      "code": "boulder",
      "name": "Boulder",
      "tier": 0,
      "maxStackSize": 1,
      "storage": "board",
      "description": "Removable obstacle.",
      "tags": ["obstacle"],
      "removeBy": [
        {
          "itemId": "item:pickaxe",
          "mode": "keep"
        },
        {
          "itemId": "item:bomb",
          "mode": "consume"
        }
      ]
    }
  }
}
```

Removal modes:

- `keep`: tool item remains.
- `consume`: tool item is consumed.

## 9. `merge`

Defines explicit merge rules.

```json
{
  "merge": {
    "merge:twig-twig-branch": {
      "withItemId": "item:twig",
      "resultItemId": "item:branch",
      "secret": false
    }
  }
}
```

Fields:

- `withItemId`: target item.
- `resultItemId`: resulting item.
- `secret`: whether rule is hidden/discovery.

Merge rules are attached to source items through `items.*.mergeIds`.

Example: `Twig + Twig -> Branch`:

```json
{
  "items": {
    "item:twig": {
      "assetId": "asset:item:twig",
      "code": "twig",
      "name": "Twig",
      "tier": 1,
      "maxStackSize": 50,
      "description": "Small wood resource.",
      "tags": ["wood"],
      "mergeIds": ["merge:twig-twig-branch"]
    }
  },
  "merge": {
    "merge:twig-twig-branch": {
      "withItemId": "item:twig",
      "resultItemId": "item:branch"
    }
  }
}
```

Secret merge:

```json
{
  "merge": {
    "merge:water-seed-sprout": {
      "withItemId": "item:seed",
      "resultItemId": "item:sprout",
      "secret": true
    }
  }
}
```

All merges consume the dragged source item and replace the target item with the result. Non-consuming merge/imprint behavior is intentionally not part of GameConfig.

## 10. `inputs`

Defines named input bundles for product lines.

```json
{
  "inputs": {
    "input:coal-mine-1-rations": {
      "name": "Coal Mine I Rations",
      "inputs": [
        {
          "itemId": "item:sausage",
          "quantity": 1,
          "capacity": 4,
          "consume": true
        }
      ]
    }
  }
}
```

Input bundle fields:

- `name`: input bundle name.
- `inputs`: input slots.

Input slot fields:

- `itemId`: required item.
- `quantity`: item count required for one run.
- `capacity`: item count that can be stored.
- `consume`: whether the item is consumed.

One-item input:

```json
{
  "inputs": {
    "input:sawmill-log": {
      "name": "Sawmill Log Input",
      "inputs": [
        {
          "itemId": "item:log",
          "quantity": 1,
          "capacity": 4,
          "consume": true
        }
      ]
    }
  }
}
```

Multi-item input:

```json
{
  "inputs": {
    "input:coal-mine-1-rations": {
      "name": "Coal Mine I Rations",
      "inputs": [
        {
          "itemId": "item:sausage",
          "quantity": 1,
          "capacity": 4,
          "consume": true
        },
        {
          "itemId": "item:beer",
          "quantity": 1,
          "capacity": 4,
          "consume": true
        }
      ]
    }
  }
}
```

Tool-like input that is not consumed:

```json
{
  "inputs": {
    "input:sawmill-saw": {
      "name": "Sawmill Saw Input",
      "inputs": [
        {
          "itemId": "item:saw",
          "quantity": 1,
          "capacity": 1,
          "consume": false
        }
      ]
    }
  }
}
```

Product reference:

```json
{
  "products": {
    "product:coal-mine-1": {
      "name": "Coal Mine I Production",
      "durationMs": 5200,
      "placement": "board_then_inventory",
      "inputRefId": "input:coal-mine-1-rations",
      "requirementIds": [],
      "outputTableId": "loot:coal-mine-1"
    }
  }
}
```

## 11. `requirements`

Defines named requirements.

Requirements are referenced by:

- `producers.*.requirementIds`
- `products.*.requirementIds`

Supported types:

```txt
stored
passive
proximity
```

### 11.1 Stored requirement

Requires a stored item.

```json
{
  "requirements": {
    "requirement:sawmill-has-saw": {
      "type": "stored",
      "itemId": "item:saw",
      "quantity": 1,
      "capacity": 1
    }
  }
}
```

Fields:

- `type`: `stored`.
- `itemId`: required item.
- `quantity`: required count.
- `capacity`: storage capacity.

### 11.2 Passive requirement

Requires an item to exist in a scope.

```json
{
  "requirements": {
    "requirement:has-saw-license": {
      "type": "passive",
      "itemId": "item:saw-license",
      "quantity": 1,
      "scope": "inventory"
    }
  }
}
```

Fields:

- `type`: `passive`.
- `itemId`: required item.
- `quantity`: required count.
- `scope`: where to check.

Scopes:

```txt
board
inventory
board_or_inventory
```

### 11.3 Proximity requirement

Requires nearby board item.

```json
{
  "requirements": {
    "requirement:lumber-camp-1-near-tree": {
      "type": "proximity",
      "itemIds": ["item:tree"],
      "distance": 2,
      "durationFactor": 1
    }
  }
}
```

Fields:

- `type`: `proximity`.
- `itemIds`: accepted nearby item IDs.
- `distance`: maximum board distance.
- `durationFactor`: distance penalty for production time.

Distance includes diagonals. Distance `1` means adjacent cells including diagonals.

Multiple accepted resources:

```json
{
  "requirements": {
    "requirement:fishing-hut-near-water": {
      "type": "proximity",
      "itemIds": ["item:pond", "item:river", "item:water"],
      "distance": 1,
      "durationFactor": 1
    }
  }
}
```

Bigger reach with lower penalty:

```json
{
  "requirements": {
    "requirement:lumber-camp-1-near-tree-3-efficient": {
      "type": "proximity",
      "itemIds": ["item:tree"],
      "distance": 3,
      "durationFactor": 0.75
    }
  }
}
```

Producer usage:

```json
{
  "producers": {
    "producer:lumber-camp-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": ["product:lumber-camp-1"],
      "requirementIds": ["requirement:lumber-camp-1-near-tree"]
    }
  }
}
```

Product usage:

```json
{
  "products": {
    "product:lumber-camp-1-log": {
      "name": "Logs",
      "durationMs": 8500,
      "placement": "board_then_inventory",
      "requirementIds": ["requirement:lumber-camp-1-near-tree-3-efficient"],
      "outputTableId": "loot:lumber-camp-1-log"
    }
  }
}
```

## 11.4 Production hindrances

`hinderedBy` defines negative production effects on producers or product lines.

Unlike `requirementIds`, hindrances do not gate the action. Every active hindrance instance applies a duration penalty, and active penalties stack multiplicatively. Production can still start, but multiple nearby hazards can turn a nice little farm into a bureaucratic waiting room with crops.

Supported hindrance types:

```txt
passive
proximity
```

Passive hindrance example:

```json
{
  "products": {
    "product:farm-1:grain": {
      "name": "Grain",
      "durationMs": 5000,
      "placement": "board_then_inventory",
      "requirementIds": [],
      "hinderedBy": [
        {
          "type": "passive",
          "itemId": "item:pollution",
          "quantity": 1,
          "scope": "board",
          "durationFactor": 1
        }
      ],
      "outputTableId": "loot:farm-1:grain"
    }
  }
}
```

Proximity hindrance example:

```json
{
  "products": {
    "product:farm-1:grain": {
      "name": "Grain",
      "durationMs": 5000,
      "placement": "board_then_inventory",
      "requirementIds": [],
      "hinderedBy": [
        {
          "type": "proximity",
          "itemIds": ["item:pollution"],
          "distance": 2,
          "durationFactor": 0.5
        }
      ],
      "outputTableId": "loot:farm-1:grain"
    }
  }
}
```

Fields:

- `type`: `passive` or `proximity`.
- `itemId`: passive hindrance item.
- `itemIds`: accepted proximity hindrance item IDs.
- `quantity`: required passive hindrance count.
- `scope`: passive hindrance search scope.
- `distance`: maximum board distance for proximity hindrance.
- `durationFactor`: slowdown strength. Missing value behaves as `1`.

For proximity hindrances, closer is worse. The multiplier is based on proximity strength inside the configured radius, so pollution at distance `1` hurts more than pollution at distance `2`. Production is never sped up by a hindrance.

Hindrances can live on:

- `producers.*.hinderedBy`, affecting every product line on that producer
- `products.*.hinderedBy`, affecting only that product line

## 12. `producers`

Defines producer shells.

A producer defines product lines, queue size, and producer-level requirements.

```json
{
  "producers": {
    "producer:lumber-camp-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": ["product:lumber-camp-1"],
      "requirementIds": []
    }
  }
}
```

Fields:

- `type`: `producer`.
- `maxQueueSize`: per-producer-instance queue size. Jobs are queued and completed FIFO; a later queued job cannot complete ahead of an earlier unresolved blocked delivery.
- `productIds`: product lines owned by this producer.
- `requirementIds`: producer-level requirements.
- `hinderedBy`: optional producer-level hindrances. Any active hindrance slows every product line on this producer.

One product line:

```json
{
  "producers": {
    "producer:quarry-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": ["product:quarry-1"],
      "requirementIds": []
    }
  }
}
```

Multiple product lines:

```json
{
  "producers": {
    "producer:lumber-camp-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": [
        "product:lumber-camp-1",
        "product:lumber-camp-1-log"
      ],
      "requirementIds": ["requirement:lumber-camp-1-near-tree"]
    }
  }
}
```

Bigger queue:

```json
{
  "producers": {
    "producer:kiln-1": {
      "type": "producer",
      "maxQueueSize": 3,
      "productIds": ["product:kiln-1-brick"],
      "requirementIds": []
    }
  }
}
```

Item reference:

```json
{
  "items": {
    "item:lumber-camp-1": {
      "assetId": "asset:item:lumber-camp",
      "code": "lumber-camp-1",
      "name": "Lumber Camp I",
      "tier": 1,
      "maxStackSize": 1,
      "description": "Produces basic wood.",
      "tags": ["producer", "building", "wood"],
      "producerId": "producer:lumber-camp-1"
    }
  }
}
```

## 13. `products`

Defines producer product lines.

A product line defines production name, tags, duration, placement, inputs, requirements, runtime visibility baseline, optional hindrances, optional active effect activation, and optional output.

```json
{
  "products": {
    "product:lumber-camp-1": {
      "name": "Twigs",
      "durationMs": 5000,
      "placement": "board_then_inventory",
      "inputs": [],
      "requirementIds": [],
      "output": [
        { "type": "guaranteed", "itemId": "item:twig", "quantity": 2 }
      ]
    }
  }
}
```

Fields:

- `name`: product line name.
- `durationMs`: base production duration in ms.
- `placement`: output placement.
- `inputs`: normal product-owned input slots. Use this for product-specific costs.
- `inputRefId`: rare shared/legacy input bundle reference. Do not create one-off `inputs` records for normal products.
- `requirementIds`: product-level requirements.
- `hinderedBy`: optional product-level hindrances. Any active hindrance slows this product line.
- `tags`: product-line tags used by runtime effects. Missing tags default to `[]`. Use tags such as `path:engineers`, `dirty`, `housing`, `morale`, or any content-specific label the effect system can target.
- `visibility`: baseline runtime visibility, either `visible` or `hidden`. Missing visibility defaults to `visible`. Hidden product lines can be revealed by runtime effects. Hidden lines are not shown, cannot be set as default, cannot be fed through producer priority routing, and cannot be started.
- `output`: normal product-owned output entries. Use this for product-specific output.
- `outputTableId`: rare shared/reusable loot table reference. Stashes and effects still use loot tables; normal product lines should usually own `output` inline.
- `activatesEffectId`: optional active effect produced by this line. Active-effect product lines consume inputs, create a timed active effect tied to the source producer, and occupy the producer queue for `durationMs` while that effect counts down. Active-effect lines must not also define `output` or `outputTableId`; their output is runtime influence, not an item pile pretending to be weather.

Baseline-hidden product line:

```json
{
  "products": {
    "product:university-engineering-theory": {
      "name": "Advanced Theory",
      "tags": ["path:engineers"],
      "visibility": "hidden",
      "durationMs": 10000,
      "placement": "board_then_inventory",
      "inputs": [],
      "requirementIds": [],
      "output": [
        { "type": "guaranteed", "itemId": "item:advanced-theory", "quantity": 1 }
      ]
    }
  }
}
```

Use `visibility: "hidden"` for product lines that should exist in config but appear only when an effect reveals them. This replaces the old marker-property style: visibility is now part of the unified effect runtime, because duplicating one gating idea in six properties is how codebases get mold.

No-input product:

```json
{
  "products": {
    "product:lumber-camp-1": {
      "name": "Twigs",
      "durationMs": 5000,
      "placement": "board_then_inventory",
      "inputs": [],
      "requirementIds": [],
      "output": [
        { "type": "guaranteed", "itemId": "item:twig", "quantity": 2 }
      ]
    }
  }
}
```

Product with inputs:

```json
{
  "products": {
    "product:coal-mine-1": {
      "name": "Coal Mine I Production",
      "durationMs": 5200,
      "placement": "board_then_inventory",
      "inputRefId": "input:coal-mine-1-rations",
      "requirementIds": [],
      "outputTableId": "loot:coal-mine-1"
    }
  }
}
```

Product-level requirement:

```json
{
  "products": {
    "product:lumber-camp-1-log": {
      "name": "Logs",
      "durationMs": 8500,
      "placement": "board_then_inventory",
      "requirementIds": ["requirement:lumber-camp-1-near-tree-3-efficient"],
      "outputTableId": "loot:lumber-camp-1-log"
    }
  }
}
```

Product without output:

```json
{
  "products": {
    "product:trash-burner-1": {
      "name": "Burn Trash",
      "durationMs": 3000,
      "placement": "board_then_inventory",
      "inputRefId": "input:trash-burner-1-trash",
      "requirementIds": []
    }
  }
}
```

Producer reference:

```json
{
  "producers": {
    "producer:trash-burner-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": ["product:trash-burner-1"],
      "requirementIds": []
    }
  }
}
```

## 13.1 `effects`

Defines runtime mutators that change product-line interpretation and item-creation rules. Effects never mutate `GameConfig`; they build an effective runtime view for concrete gameplay checks. An effect source may count from board, inventory, or both depending on `sourceScope`. Local effects need a board position, so config validation rejects local effects with `sourceScope: "inventory"` or `sourceScope: "both"`; inventory-sourced effects are for global rules.

Effects can come from two places:

- item `passiveEffectIds`: the effect is active while that item exists in a location allowed by the effect's `sourceScope`
- product `activatesEffectId`: the product consumes inputs, creates a timed active effect instance tied to the source item, and uses its producer job duration as the effect countdown/queue occupancy

Effect fields:

- `name`: display name.
- `scope`: `global` or `local`.
- `sourceScope`: optional `board`, `inventory`, or `both`; defaults to `board`. Local effects must use board scope because inventory sources have no cell for distance checks.
- `radius`: required for local effects.
- `operations`: runtime operations performed by the effect.

Global passive reveal effect example:

```json
{
  "items": {
    "producer:house-of-engineers": {
      "assetId": "asset:producer:house-of-engineers",
      "code": "house-of-engineers",
      "name": "House of Engineers",
      "tier": 11,
      "maxStackSize": 1,
      "description": "Locks the settlement into the engineering path.",
      "tags": ["producer", "building", "path", "path:engineers"],
      "passiveEffectIds": ["effect:path.engineers.reveal"]
    }
  },
  "effects": {
    "effect:path.engineers.reveal": {
      "name": "Engineering Path",
      "scope": "global",
      "sourceScope": "both",
      "operations": [
        {
          "kind": "line.reveal",
          "target": { "productTagsAny": ["path:engineers"] }
        }
      ]
    }
  }
}
```

Local penalty/loot mutation example:

```json
{
  "effects": {
    "effect:chaos": {
      "name": "Chaos",
      "scope": "local",
      "radius": 2,
      "operations": [
        {
          "kind": "duration.multiply",
          "target": { "productTagsAny": ["precise"] },
          "multiplier": 1.25
        },
        {
          "kind": "loot.appendTable",
          "target": { "productTagsAny": ["arcane"] },
          "lootTableId": "loot:void-splinter",
          "chance": 0.2
        },
        {
          "kind": "loot.dropChance.add",
          "target": { "productTagsAny": ["stable"] },
          "delta": -0.15
        }
      ]
    }
  }
}
```

Effect fields:

- `name`: player/debug label.
- `scope`: `global` or `local`.
- `radius`: required for local effects. Radius uses Chebyshev distance, so diagonals count.
- `operations`: one or more typed operations.

Effect operation kinds:

```txt
line.reveal
line.hide
line.blockStart
duration.addMs
duration.multiply
loot.appendTable
loot.replaceTable
loot.addChanceItem
loot.dropChance.add
item.blockCreate
```

Operation semantics:

- `line.reveal`: reveals a baseline-hidden line when the target selector matches.
- `line.hide`: hides a line. Hide has higher priority than reveal.
- `line.blockStart`: leaves the line visible but prevents starting new production. Running jobs are not paused or cancelled.
- `duration.addMs`: adds a signed fixed time delta.
- `duration.multiply`: multiplies the effective duration after fixed duration deltas.
- `loot.appendTable`: evaluates an additional loot table beside the normal loot, optionally behind `chance`.
- `loot.replaceTable`: replaces the base loot table list. Later replacements win by deterministic effect order.
- `loot.addChanceItem`: adds a direct chance item drop, default quantity `1`.
- `loot.dropChance.add`: changes the chance that base loot is evaluated. The final chance is clamped to `0..1`.
- `item.blockCreate`: hard-blocks creation/replacement/placement outputs for matching items while the effect applies. Use it for path/faction locks and other rules where the item must not enter gameplay through normal actions. Immediate actions fail. Delayed product/spawn outputs fail or discard instead of retrying forever, because hard rules are not capacity problems wearing a fake moustache.

Every operation must declare a target. Use `"all": true` for an explicit match-everything operation. Selector-less `{}` is invalid, because silent global mutation is how balance goes off to live in a sewer. `all: true` cannot be combined with other selectors.

Target selectors are ANDed together when multiple fields are present. Product-line operations use producer/product selectors:

```json
{
  "producerIds": ["producer:university"],
  "productTagsAny": ["path:mages"],
  "productTagsAll": ["arcane"]
}
```

`item.blockCreate` uses item selectors:

```json
{
  "itemIds": ["producer:cathedral", "item:blueprint-cathedral"],
  "itemTagsAny": ["path:faith"]
}
```

Supported product-line target fields:

- `all`: explicit match every product line
- `producerIds`
- `productIds`
- `producerTagsAny`
- `producerTagsAll`
- `productTagsAny`
- `productTagsAll`

Supported item target fields:

- `all`: explicit match every item
- `itemIds`
- `itemTagsAny`
- `itemTagsAll`

Hidden and blocked states have priority over their positive counterparts: a matching hide means the line is not visible, and any matching block means the line cannot start. There is no explicit suppression or propagation subsystem. If content wants cleanup, remove the source item or create another effect whose numeric mutations cancel out. If content wants spread, add side loot that drops another source item. Horrifyingly simple, which is usually the part that survives production.

## 14. `lootTables`

Defines reusable output tables for stashes, runtime effects, and rare shared product outputs. Normal product-specific output belongs inline on the product through `output`, because making every product jump through a one-off loot-table ID was bureaucratic cosplay.

```json
{
  "lootTables": {
    "loot:lumber-camp-1": {
      "name": "Lumber Camp I",
      "output": [
        {
          "type": "guaranteed",
          "itemId": "item:twig",
          "quantity": 2
        }
      ]
    }
  }
}
```

Fields:

- `name`: loot table name.
- `output`: output rules.

Output types:

```txt
guaranteed
chance
weighted
```

Guaranteed output:

```json
{
  "lootTables": {
    "loot:lumber-camp-1-log": {
      "name": "Lumber Camp I Logs",
      "output": [
        {
          "type": "guaranteed",
          "itemId": "item:log",
          "quantity": 1
        }
      ]
    }
  }
}
```

Chance output:

```json
{
  "lootTables": {
    "loot:lumber-camp-1": {
      "name": "Lumber Camp I",
      "output": [
        {
          "type": "guaranteed",
          "itemId": "item:twig",
          "quantity": 2
        },
        {
          "type": "chance",
          "itemId": "item:branch",
          "chance": 0.35,
          "quantity": 1
        }
      ]
    }
  }
}
```

`chance` uses values from `0` to `1`:

```txt
0.25 = 25 %
0.5  = 50 %
1    = 100 %
```

Weighted output:

```json
{
  "lootTables": {
    "loot:crate-4": {
      "name": "Epic Crate",
      "output": [
        {
          "type": "weighted",
          "rolls": 1,
          "entries": [
            {
              "itemId": "item:wood-bundle",
              "weight": 25,
              "quantity": 1
            },
            {
              "itemId": "item:beam",
              "weight": 15,
              "quantity": 1
            }
          ]
        }
      ]
    }
  }
}
```

Random quantity:

```json
{
  "lootTables": {
    "loot:bush": {
      "name": "Bush",
      "output": [
        {
          "type": "guaranteed",
          "itemId": "item:leaf",
          "quantity": {
            "min": 1,
            "max": 3
          }
        }
      ]
    }
  }
}
```

Product reference:

```json
{
  "products": {
    "product:lumber-camp-1": {
      "name": "Twigs",
      "durationMs": 5000,
      "placement": "board_then_inventory",
      "inputs": [],
      "requirementIds": [],
      "output": [
        { "type": "guaranteed", "itemId": "item:twig", "quantity": 2 }
      ]
    }
  }
}
```

Stash reference:

```json
{
  "stashes": {
    "stash:crate-4": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:crate-4",
      "inputs": [],
      "requirements": [],
      "charges": 6,
      "onDepleted": "remove"
    }
  }
}
```

## 15. `stashes`

Defines openable containers.

A stash has a loot table, charges, optional inputs, optional requirements, and depleted behavior.

```json
{
  "stashes": {
    "stash:crate-4": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:crate-4",
      "inputs": [],
      "requirements": [],
      "charges": 6,
      "onDepleted": "remove"
    }
  }
}
```

Fields:

- `type`: `stash`.
- `placement`: output placement.
- `outputTableId`: loot table.
- `inputs`: items required to open.
- `requirements`: stored/passive requirements.
- `charges`: number of opens.
- `onDepleted`: depleted behavior.

Crate without key:

```json
{
  "stashes": {
    "stash:crate-1": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:crate-1",
      "inputs": [],
      "requirements": [],
      "charges": 3,
      "onDepleted": "remove"
    }
  }
}
```

Crate with key:

```json
{
  "stashes": {
    "stash:crate-4": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:crate-4",
      "inputs": [
        {
          "itemId": "item:epic-key",
          "quantity": 1,
          "capacity": 1,
          "consume": true
        }
      ],
      "requirements": [],
      "charges": 6,
      "onDepleted": "remove"
    }
  }
}
```

Replace when depleted:

```json
{
  "stashes": {
    "stash:barrel-1": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:barrel-1",
      "inputs": [],
      "requirements": [],
      "charges": 2,
      "onDepleted": {
        "replaceWithItemId": "item:empty-barrel"
      }
    }
  }
}
```

Stash with stored requirement:

```json
{
  "stashes": {
    "stash:sealed-cache": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:sealed-cache",
      "inputs": [],
      "requirements": [
        {
          "type": "stored",
          "itemId": "item:seal-key",
          "quantity": 1,
          "capacity": 1
        }
      ],
      "charges": 1,
      "onDepleted": "remove"
    }
  }
}
```

Item reference:

```json
{
  "items": {
    "item:crate-4": {
      "assetId": "asset:item:crate-epic",
      "code": "crate-4",
      "name": "Epic Crate",
      "tier": 4,
      "maxStackSize": 1,
      "description": "Epic reward crate.",
      "tags": ["stash", "crate"],
      "stashId": "stash:crate-4"
    }
  }
}
```

## 16. `craftRecipes`

Defines craft recipes.

A craft recipe has a result item, inputs, optional requirements, and craft duration.

```json
{
  "craftRecipes": {
    "craft:lumber-camp": {
      "resultItemId": "item:lumber-camp-1",
      "inputs": [
        {
          "itemId": "item:plank",
          "quantity": 1,
          "consume": true
        }
      ],
      "requirements": [],
      "durationMs": 0
    }
  }
}
```

Fields:

- `resultItemId`: result item.
- `inputs`: required input items.
- `requirements`: stored/passive requirements.
- `durationMs`: craft duration in ms.

Input fields:

- `itemId`: input item.
- `quantity`: count.
- `consume`: whether it is consumed.

Blueprint craft:

```json
{
  "craftRecipes": {
    "craft:lumber-camp": {
      "resultItemId": "item:lumber-camp-1",
      "inputs": [
        {
          "itemId": "item:plank",
          "quantity": 1,
          "consume": true
        },
        {
          "itemId": "item:stone-block",
          "quantity": 1,
          "consume": true
        }
      ],
      "requirements": [],
      "durationMs": 0
    }
  }
}
```

Timed craft:

```json
{
  "craftRecipes": {
    "craft:quarry": {
      "resultItemId": "item:quarry-1",
      "inputs": [
        {
          "itemId": "item:stone-block",
          "quantity": 2,
          "consume": true
        }
      ],
      "requirements": [],
      "durationMs": 5000
    }
  }
}
```

Craft with requirement:

```json
{
  "craftRecipes": {
    "craft:sawmill": {
      "resultItemId": "item:sawmill-1",
      "inputs": [
        {
          "itemId": "item:plank",
          "quantity": 4,
          "consume": true
        }
      ],
      "requirements": [
        {
          "type": "passive",
          "itemId": "item:townhall-1",
          "quantity": 1,
          "scope": "board"
        }
      ],
      "durationMs": 8000
    }
  }
}
```

Craft target item reference:

```json
{
  "items": {
    "item:blueprint-lumber-camp": {
      "assetId": "asset:item:blueprint-lumber-camp",
      "code": "blueprint-lumber-camp",
      "name": "Lumber Camp Blueprint",
      "tier": 4,
      "maxStackSize": 5,
      "description": "Craft target for Lumber Camp I.",
      "tags": ["blueprint", "craft-target"],
      "craftRecipeId": "craft:lumber-camp"
    }
  }
}
```

## 17. Global upgrades are intentionally absent

Global/world-wide upgrades are not part of Arkini config anymore. A better building is represented as another concrete item/producer tier, usually produced by a craft recipe that consumes the previous tier plus materials.

Do not add top-level `upgrades`, upgrade jobs, upgrade effects, or save-driven config patches. The loaded JSON config is the hard source of truth.

## 18. `startingState`

Defines initial board and inventory.

```json
{
  "startingState": {
    "board": [
      {
        "itemId": "item:townhall-1",
        "x": 3,
        "y": 4
      }
    ],
    "inventory": [
      {
        "itemId": "item:twig",
        "quantity": 8
      }
    ]
  }
}
```

Board entry:

- `itemId`: board item.
- `x`: horizontal position.
- `y`: vertical position.

Inventory entry:

- `itemId`: inventory item.
- `quantity`: stack quantity.

Starting board:

```json
{
  "startingState": {
    "board": [
      {
        "itemId": "item:townhall-1",
        "x": 3,
        "y": 4
      },
      {
        "itemId": "item:lumber-camp-1",
        "x": 1,
        "y": 4
      },
      {
        "itemId": "item:tree",
        "x": 2,
        "y": 3
      }
    ],
    "inventory": []
  }
}
```

Starting inventory:

```json
{
  "startingState": {
    "board": [],
    "inventory": [
      {
        "itemId": "item:twig",
        "quantity": 8
      },
      {
        "itemId": "item:water",
        "quantity": 4
      }
    ]
  }
}
```

## 19. Validated ID links

Config validation checks references between sections:

```txt
assets.*.resourceId -> resources
assets.*.overlayAssetId -> assets

items.*.assetId -> assets
items.*.mergeIds[] -> merge
items.*.producerId -> producers
items.*.stashId -> stashes
items.*.craftRecipeId -> craftRecipes
items.*.passiveEffectIds[] -> effects
items.*.removeBy[].itemId -> items

merge.*.withItemId -> items
merge.*.resultItemId -> items

inputs.*.inputs[].itemId -> items

requirements.*.itemId -> items
requirements.*.itemIds[] -> items

effects.*.operations[].producerIds[] -> producers
effects.*.operations[].productIds[] -> products
effects.*.operations[].lootTableId -> lootTables
effects.*.operations[].itemId -> items
effects.*.operations[].itemIds[] -> items

producers.*.productIds[] -> products
producers.*.requirementIds[] -> requirements
producers.*.hinderedBy[].itemId -> items
producers.*.hinderedBy[].itemIds[] -> items

products.*.inputs[].itemId -> items
products.*.inputRefId -> inputs (shared/legacy only)
products.*.requirementIds[] -> requirements
products.*.hinderedBy[].itemId -> items
products.*.hinderedBy[].itemIds[] -> items
products.*.output[].itemId -> items
products.*.output[].entries[].itemId -> items
products.*.outputTableId -> lootTables (shared/legacy only)
products.*.activatesEffectId -> effects

stashes.*.outputTableId -> lootTables
stashes.*.inputs[].itemId -> items
stashes.*.requirements[].itemId -> items
stashes.*.onDepleted.replaceWithItemId -> items

craftRecipes.*.resultItemId -> items
craftRecipes.*.inputs[].itemId -> items
craftRecipes.*.requirements[].itemId -> items

lootTables.*.output[].itemId -> items
lootTables.*.output[].entries[].itemId -> items


startingState.board[].itemId -> items
startingState.inventory[].itemId -> items
```

Config validation also checks common data mistakes:

- duplicate `item.code`
- duplicate item tags
- duplicate item `mergeIds`
- duplicate producer `productIds`
- product owned by more than one producer
- input bundle owned by more than one product line
- starting board coordinates outside board
- multiple starting items on the same board cell
- starting inventory with more stacks than available inventory slots
- starting inventory quantity above item `maxStackSize`
- starting state violating item `storage`
- starting board containing more copies of an item than its optional `maxCount`

## 20. Supported values

```txt
asset.kind:
  item
  ui

asset.render:
  plain
  blueprint

item.storage:
  board
  inventory
  both

removeBy.mode:
  keep
  consume

placement:
  board_then_inventory

requirement.type:
  stored
  passive
  proximity

passive.scope:
  board
  inventory
  board_or_inventory

loot output type:
  guaranteed
  chance
  weighted

stash.type:
  stash

stash.onDepleted:
  remove
  { replaceWithItemId: "item:id" }

producer.type:
  producer
```

# Appendix A: Configuration recipes

This appendix shows common gameplay patterns built only from config sections and ID links.

Each example is intentionally minimal. A full config must include every referenced asset, resource, item, loot table, input, requirement, producer, product, stash, and craft recipe.

## A.1 Add a basic resource item

Use `assets` + `items`.

```json
{
  "assets": {
    "asset:item:fiber": {
      "kind": "item",
      "label": "Fiber",
      "resourceId": "item-fiber",
      "render": "plain",
    }
  },
  "items": {
    "item:fiber": {
      "assetId": "asset:item:fiber",
      "code": "fiber",
      "name": "Fiber",
      "tier": 1,
      "maxStackSize": 50,
      "storage": "both",
      "description": "Basic crafting fiber.",
      "tags": ["material", "fiber"],
    }
  }
}
```

## A.2 Add a board-only item

Use `storage: "board"`.

```json
{
  "items": {
    "item:fire": {
      "assetId": "asset:item:fire",
      "code": "fire",
      "name": "Fire",
      "tier": 0,
      "maxStackSize": 1,
      "storage": "board",
      "description": "Board danger.",
      "tags": ["danger"],
    }
  }
}
```

Typical uses:

```txt
danger
obstacle
resource deposit
map feature
board-only building
```

## A.3 Add an inventory-only item

Use `storage: "inventory"`.

```json
{
  "items": {
    "item:saw-license": {
      "assetId": "asset:item:saw-license",
      "code": "saw-license",
      "name": "Saw License",
      "tier": 0,
      "maxStackSize": 1,
      "storage": "inventory",
      "description": "Inventory-owned production permission.",
      "tags": ["license"],
    }
  }
}
```

## A.4 Remove a board item with a tool

Use `items.*.removeBy`.

```json
{
  "items": {
    "item:boulder": {
      "assetId": "asset:item:boulder",
      "code": "boulder",
      "name": "Boulder",
      "tier": 0,
      "maxStackSize": 1,
      "storage": "board",
      "description": "Removable obstacle.",
      "tags": ["obstacle"],
      "removeBy": [
        {
          "itemId": "item:pickaxe",
          "mode": "keep"
        },
        {
          "itemId": "item:bomb",
          "mode": "consume"
        }
      ]
    }
  }
}
```

## A.5 Add basic merge

Use `items.*.mergeIds` + `merge`.

```json
{
  "items": {
    "item:twig": {
      "assetId": "asset:item:twig",
      "code": "twig",
      "name": "Twig",
      "tier": 1,
      "maxStackSize": 50,
      "description": "Small wood resource.",
      "tags": ["wood"],
      "mergeIds": ["merge:twig-twig-branch"]
    },
    "item:branch": {
      "assetId": "asset:item:branch",
      "code": "branch",
      "name": "Branch",
      "tier": 2,
      "maxStackSize": 25,
      "description": "Merged wood resource.",
      "tags": ["wood"],
    }
  },
  "merge": {
    "merge:twig-twig-branch": {
      "withItemId": "item:twig",
      "resultItemId": "item:branch"
    }
  }
}
```

## A.6 Add longer merge chain

Each source item gets its own `mergeIds`.

```json
{
  "items": {
    "item:twig": {
      "assetId": "asset:item:twig",
      "code": "twig",
      "name": "Twig",
      "tier": 1,
      "maxStackSize": 50,
      "description": "Small wood resource.",
      "tags": ["wood"],
      "mergeIds": ["merge:twig-twig-branch"]
    },
    "item:branch": {
      "assetId": "asset:item:branch",
      "code": "branch",
      "name": "Branch",
      "tier": 2,
      "maxStackSize": 25,
      "description": "Merged wood resource.",
      "tags": ["wood"],
      "mergeIds": ["merge:branch-branch-log"]
    },
    "item:log": {
      "assetId": "asset:item:log",
      "code": "log",
      "name": "Log",
      "tier": 3,
      "maxStackSize": 20,
      "description": "Construction wood.",
      "tags": ["wood"],
    }
  },
  "merge": {
    "merge:twig-twig-branch": {
      "withItemId": "item:twig",
      "resultItemId": "item:branch"
    },
    "merge:branch-branch-log": {
      "withItemId": "item:branch",
      "resultItemId": "item:log"
    }
  }
}
```

## A.7 Add secret merge

Use `secret: true`.

```json
{
  "items": {
    "item:water": {
      "assetId": "asset:item:water",
      "code": "water",
      "name": "Water",
      "tier": 1,
      "maxStackSize": 20,
      "description": "Water.",
      "tags": ["material"],
      "mergeIds": ["merge:water-seed-sprout"]
    }
  },
  "merge": {
    "merge:water-seed-sprout": {
      "withItemId": "item:seed",
      "resultItemId": "item:sprout",
      "secret": true
    }
  }
}
```

## A.8 Add one-way merge rule

Attach the merge ID to the item that must be dragged. The dragged source is consumed and the target is replaced by the result.

```json
{
  "items": {
    "item:hammer-charge": {
      "mergeIds": ["merge:hammer-charge-rock-stone"]
    }
  },
  "merge": {
    "merge:hammer-charge-rock-stone": {
      "withItemId": "item:rock",
      "resultItemId": "item:stone"
    }
  }
}
```

## A.9 Add guaranteed loot

Use `lootTables` with `type: "guaranteed"`.

```json
{
  "lootTables": {
    "loot:lumber-camp-1": {
      "name": "Lumber Camp I",
      "output": [
        {
          "type": "guaranteed",
          "itemId": "item:twig",
          "quantity": 2
        }
      ]
    }
  }
}
```

## A.10 Add chance loot

Use `type: "chance"`.

```json
{
  "lootTables": {
    "loot:bush": {
      "name": "Bush",
      "output": [
        {
          "type": "guaranteed",
          "itemId": "item:leaf",
          "quantity": 1
        },
        {
          "type": "chance",
          "itemId": "item:berry",
          "chance": 0.25,
          "quantity": 1
        }
      ]
    }
  }
}
```

## A.11 Add weighted loot

Use `type: "weighted"`.

```json
{
  "lootTables": {
    "loot:crate-rare": {
      "name": "Rare Crate",
      "output": [
        {
          "type": "weighted",
          "rolls": 1,
          "entries": [
            {
              "itemId": "item:coin-stack",
              "weight": 70,
              "quantity": 1
            },
            {
              "itemId": "item:gem",
              "weight": 30,
              "quantity": 1
            }
          ]
        }
      ]
    }
  }
}
```

## A.12 Add random quantity loot

Use quantity range.

```json
{
  "lootTables": {
    "loot:bush": {
      "name": "Bush",
      "output": [
        {
          "type": "guaranteed",
          "itemId": "item:leaf",
          "quantity": {
            "min": 1,
            "max": 3
          }
        }
      ]
    }
  }
}
```

## A.13 Add producer item

Attach item to producer through `producerId`.

```json
{
  "items": {
    "item:lumber-camp-1": {
      "assetId": "asset:item:lumber-camp",
      "code": "lumber-camp-1",
      "name": "Lumber Camp I",
      "tier": 1,
      "maxStackSize": 1,
      "description": "Produces basic wood.",
      "tags": ["producer", "building", "wood"],
      "producerId": "producer:lumber-camp-1"
    }
  }
}
```

## A.14 Add producer with one product line

Use `producers`, `products`, and `lootTables`.

```json
{
  "producers": {
    "producer:lumber-camp-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": ["product:lumber-camp-1"],
      "requirementIds": []
    }
  },
  "products": {
    "product:lumber-camp-1": {
      "name": "Twigs",
      "durationMs": 5000,
      "placement": "board_then_inventory",
      "inputs": [],
      "requirementIds": [],
      "output": [
        { "type": "guaranteed", "itemId": "item:twig", "quantity": 2 }
      ]
    }
  },
  "lootTables": {
    "loot:lumber-camp-1": {
      "name": "Lumber Camp I",
      "output": [
        {
          "type": "guaranteed",
          "itemId": "item:twig",
          "quantity": 2
        }
      ]
    }
  }
}
```

## A.15 Add producer with multiple product lines

Add multiple `productIds`. Order is meaningful.

```json
{
  "producers": {
    "producer:lumber-camp-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": [
        "product:lumber-camp-1-twigs",
        "product:lumber-camp-1-logs"
      ],
      "requirementIds": ["requirement:lumber-camp-1-near-tree"]
    }
  },
  "products": {
    "product:lumber-camp-1-twigs": {
      "name": "Twigs",
      "durationMs": 5000,
      "placement": "board_then_inventory",
      "requirementIds": [],
      "outputTableId": "loot:lumber-camp-1-twigs"
    },
    "product:lumber-camp-1-logs": {
      "name": "Logs",
      "durationMs": 9000,
      "placement": "board_then_inventory",
      "requirementIds": [],
      "outputTableId": "loot:lumber-camp-1-logs"
    }
  }
}
```

## A.16 Add producer with bigger queue

Set `maxQueueSize`.

```json
{
  "producers": {
    "producer:kiln-1": {
      "type": "producer",
      "maxQueueSize": 3,
      "productIds": ["product:kiln-1-brick"],
      "requirementIds": []
    }
  }
}
```

## A.17 Add product with input

Put product-specific input slots directly on the product through `inputs`. Use top-level `inputs` + `inputRefId` only for deliberately shared/legacy bundles.

```json
{
  "products": {
    "product:kiln-1-brick": {
      "name": "Brick",
      "durationMs": 7000,
      "placement": "board_then_inventory",
      "inputs": [
        {
          "itemId": "item:clay",
          "quantity": 1,
          "capacity": 4,
          "consume": true
        }
      ],
      "requirementIds": [],
      "output": [
        { "type": "guaranteed", "itemId": "item:brick", "quantity": 1 }
      ]
    }
  }
}
```

## A.18 Add product with multiple input types

Put multiple slots into the product-owned `inputs` array.

```json
{
  "inputs": {
    "input:coal-mine-1-rations": {
      "name": "Coal Mine I Rations",
      "inputs": [
        {
          "itemId": "item:sausage",
          "quantity": 1,
          "capacity": 4,
          "consume": true
        },
        {
          "itemId": "item:beer",
          "quantity": 1,
          "capacity": 4,
          "consume": true
        }
      ]
    }
  }
}
```

## A.19 Add product with non-consumed tool input

Use `consume: false`.

```json
{
  "inputs": {
    "input:sawmill-saw": {
      "name": "Sawmill Saw",
      "inputs": [
        {
          "itemId": "item:saw",
          "quantity": 1,
          "capacity": 1,
          "consume": false
        }
      ]
    }
  }
}
```

## A.20 Add pollution slowdown to a producer product

Use `hinderedBy` on the product line. This does not prevent production. It only slows it while the hindrance is active.

```json
{
  "products": {
    "product:farm-1:grain": {
      "name": "Grain",
      "durationMs": 5000,
      "placement": "board_then_inventory",
      "requirementIds": [],
      "hinderedBy": [
        {
          "type": "proximity",
          "itemIds": ["item:pollution"],
          "distance": 2,
          "durationFactor": 0.5
        }
      ],
      "outputTableId": "loot:farm-1:grain"
    }
  }
}
```

Use producer-level `hinderedBy` when every line on the building should be affected. Use product-level `hinderedBy` when only one concrete production line should care, because apparently we enjoy having precise tools instead of one giant hammer.

## A.21 Add producer proximity requirement

Define proximity requirement and add it to `producer.requirementIds`.

```json
{
  "requirements": {
    "requirement:lumber-camp-1-near-tree": {
      "type": "proximity",
      "itemIds": ["item:tree"],
      "distance": 2,
      "durationFactor": 1
    }
  },
  "producers": {
    "producer:lumber-camp-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": ["product:lumber-camp-1"],
      "requirementIds": ["requirement:lumber-camp-1-near-tree"]
    }
  }
}
```

## A.22 Add proximity requirement accepting multiple items

Use multiple IDs in `itemIds`.

```json
{
  "requirements": {
    "requirement:fishing-hut-1-near-water": {
      "type": "proximity",
      "itemIds": ["item:pond", "item:river", "item:water"],
      "distance": 1,
      "durationFactor": 1
    }
  }
}
```

## A.23 Add remote resource with lower distance penalty

Lower `durationFactor`.

```json
{
  "requirements": {
    "requirement:lumber-camp-1-near-tree-3-efficient": {
      "type": "proximity",
      "itemIds": ["item:tree"],
      "distance": 3,
      "durationFactor": 0.75
    }
  },
  "producers": {
    "producer:lumber-camp-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": ["product:lumber-camp-1"],
      "requirementIds": [
        "requirement:lumber-camp-1-near-tree-3-efficient"
      ]
    }
  }
}
```

## A.24 Add requirement for only one product line

Put requirement ID into `products.*.requirementIds`.

```json
{
  "products": {
    "product:lumber-camp-1-log": {
      "name": "Logs",
      "durationMs": 8500,
      "placement": "board_then_inventory",
      "requirementIds": [
        "requirement:lumber-camp-1-near-tree-3-efficient"
      ],
      "outputTableId": "loot:lumber-camp-1-log"
    }
  }
}
```

## A.25 Add passive requirement

Use `type: "passive"`.

```json
{
  "requirements": {
    "requirement:has-saw-license": {
      "type": "passive",
      "itemId": "item:saw-license",
      "quantity": 1,
      "scope": "inventory"
    }
  },
  "products": {
    "product:sawmill-1-plank": {
      "name": "Planks",
      "durationMs": 6000,
      "placement": "board_then_inventory",
      "requirementIds": ["requirement:has-saw-license"],
      "outputTableId": "loot:sawmill-1-plank"
    }
  }
}
```

## A.26 Add stored requirement

Use `type: "stored"`.

```json
{
  "requirements": {
    "requirement:sawmill-1-has-saw": {
      "type": "stored",
      "itemId": "item:saw",
      "quantity": 1,
      "capacity": 1
    }
  },
  "producers": {
    "producer:sawmill-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": ["product:sawmill-1-plank"],
      "requirementIds": ["requirement:sawmill-1-has-saw"]
    }
  }
}
```

## A.27 Add product without output

Omit `outputTableId`.

```json
{
  "inputs": {
    "input:trash-burner-1-trash": {
      "name": "Trash Burner Input",
      "inputs": [
        {
          "itemId": "item:trash",
          "quantity": 1,
          "capacity": 4,
          "consume": true
        }
      ]
    }
  },
  "products": {
    "product:trash-burner-1": {
      "name": "Burn Trash",
      "durationMs": 3000,
      "placement": "board_then_inventory",
      "inputRefId": "input:trash-burner-1-trash",
      "requirementIds": []
    }
  }
}
```

## A.28 Add basic stash/crate

Item gets `stashId`, stash gets `outputTableId`.

```json
{
  "items": {
    "item:crate-1": {
      "assetId": "asset:item:crate",
      "code": "crate-1",
      "name": "Crate I",
      "tier": 1,
      "maxStackSize": 1,
      "description": "Basic reward crate.",
      "tags": ["stash", "crate"],
      "stashId": "stash:crate-1"
    }
  },
  "stashes": {
    "stash:crate-1": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:crate-1",
      "inputs": [],
      "requirements": [],
      "charges": 3,
      "onDepleted": "remove"
    }
  },
  "lootTables": {
    "loot:crate-1": {
      "name": "Crate I",
      "output": [
        {
          "type": "weighted",
          "rolls": 1,
          "entries": [
            {
              "itemId": "item:twig",
              "weight": 70,
              "quantity": 2
            },
            {
              "itemId": "item:branch",
              "weight": 30,
              "quantity": 1
            }
          ]
        }
      ]
    }
  }
}
```

## A.29 Add stash with key

Add input to `stashes.*.inputs`. Open-time stash inputs can be supplied by dragging a matching item onto the stash or auto-filled from board/inventory on stash click. If the required inputs are missing, the click should open detail instead of failing noisily.

```json
{
  "stashes": {
    "stash:sealed-crate": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:sealed-crate",
      "inputs": [
        {
          "itemId": "item:rare-key",
          "quantity": 1,
          "capacity": 1,
          "consume": true
        }
      ],
      "requirements": [],
      "charges": 3,
      "onDepleted": "remove"
    }
  }
}
```

## A.30 Add stash with requirement

Use inline `requirements`.

```json
{
  "stashes": {
    "stash:sealed-cache": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:sealed-cache",
      "inputs": [],
      "requirements": [
        {
          "type": "passive",
          "itemId": "item:townhall-1",
          "quantity": 1,
          "scope": "board"
        }
      ],
      "charges": 1,
      "onDepleted": "remove"
    }
  }
}
```

Stored requirement variant:

```json
{
  "stashes": {
    "stash:sealed-cache": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:sealed-cache",
      "inputs": [],
      "requirements": [
        {
          "type": "stored",
          "itemId": "item:seal-key",
          "quantity": 1,
          "capacity": 1
        }
      ],
      "charges": 1,
      "onDepleted": "remove"
    }
  }
}
```

## A.31 Remove stash when depleted

Use `onDepleted: "remove"`.

```json
{
  "stashes": {
    "stash:crate-1": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:crate-1",
      "inputs": [],
      "requirements": [],
      "charges": 3,
      "onDepleted": "remove"
    }
  }
}
```

## A.32 Replace stash when depleted

Use `replaceWithItemId`. Replacement is still a normal board creation rule: the replacement item must be board-storable, pass `maxCount`, and not be blocked by active `item.blockCreate` effects. Board placement planners skip cells blocked by local `item.blockCreate` effects instead of failing the whole request while another allowed cell exists.

```json
{
  "stashes": {
    "stash:barrel-1": {
      "type": "stash",
      "placement": "board_then_inventory",
      "outputTableId": "loot:barrel-1",
      "inputs": [],
      "requirements": [],
      "charges": 2,
      "onDepleted": {
        "replaceWithItemId": "item:empty-barrel"
      }
    }
  }
}
```

## A.33 Add blueprint craft

Item gets `craftRecipeId`; recipe defines result and inputs.

```json
{
  "items": {
    "item:blueprint-kiln": {
      "assetId": "asset:item:blueprint-kiln",
      "code": "blueprint-kiln",
      "name": "Kiln Blueprint",
      "tier": 4,
      "maxStackSize": 5,
      "description": "Craft target for Kiln I.",
      "tags": ["blueprint", "craft-target"],
      "craftRecipeId": "craft:kiln"
    },
    "item:kiln-1": {
      "assetId": "asset:item:kiln",
      "code": "kiln-1",
      "name": "Kiln I",
      "tier": 1,
      "maxStackSize": 1,
      "description": "Turns clay into bricks.",
      "tags": ["producer", "building"],
      "producerId": "producer:kiln-1"
    }
  },
  "craftRecipes": {
    "craft:kiln": {
      "resultItemId": "item:kiln-1",
      "inputs": [
        {
          "itemId": "item:stone-block",
          "quantity": 2,
          "consume": true
        },
        {
          "itemId": "item:plank",
          "quantity": 1,
          "consume": true
        }
      ],
      "requirements": [],
      "durationMs": 5000
    }
  }
}
```

## A.34 Add instant craft

Use `durationMs: 0`.

```json
{
  "craftRecipes": {
    "craft:lumber-camp": {
      "resultItemId": "item:lumber-camp-1",
      "inputs": [
        {
          "itemId": "item:plank",
          "quantity": 1,
          "consume": true
        }
      ],
      "requirements": [],
      "durationMs": 0
    }
  }
}
```

## A.35 Add craft with requirement

Use inline `requirements`.

```json
{
  "craftRecipes": {
    "craft:sawmill": {
      "resultItemId": "item:sawmill-1",
      "inputs": [
        {
          "itemId": "item:plank",
          "quantity": 4,
          "consume": true
        }
      ],
      "requirements": [
        {
          "type": "passive",
          "itemId": "item:townhall-1",
          "quantity": 1,
          "scope": "board"
        }
      ],
      "durationMs": 8000
    }
  }
}
```

Stored requirement variant:

```json
{
  "craftRecipes": {
    "craft:sawmill": {
      "resultItemId": "item:sawmill-1",
      "inputs": [
        {
          "itemId": "item:plank",
          "quantity": 4,
          "consume": true
        }
      ],
      "requirements": [
        {
          "type": "stored",
          "itemId": "item:tool-kit",
          "quantity": 1,
          "capacity": 1
        }
      ],
      "durationMs": 8000
    }
  }
}
```

## A.36 Add starting board

Add entries to `startingState.board`.

```json
{
  "startingState": {
    "board": [
      {
        "itemId": "item:townhall-1",
        "x": 3,
        "y": 4
      },
      {
        "itemId": "item:lumber-camp-1",
        "x": 1,
        "y": 4
      },
      {
        "itemId": "item:tree",
        "x": 2,
        "y": 3
      }
    ],
    "inventory": []
  }
}
```

## A.37 Add starting inventory

Add stacks to `startingState.inventory`.

```json
{
  "startingState": {
    "board": [],
    "inventory": [
      {
        "itemId": "item:twig",
        "quantity": 8
      },
      {
        "itemId": "item:water",
        "quantity": 4
      }
    ]
  }
}
```

## A.46 Add combined starting state

Use board and inventory together.

```json
{
  "startingState": {
    "board": [
      {
        "itemId": "item:townhall-1",
        "x": 3,
        "y": 4
      },
      {
        "itemId": "item:lumber-camp-1",
        "x": 1,
        "y": 4
      },
      {
        "itemId": "item:tree",
        "x": 2,
        "y": 3
      }
    ],
    "inventory": [
      {
        "itemId": "item:twig",
        "quantity": 8
      },
      {
        "itemId": "item:water",
        "quantity": 4
      }
    ]
  }
}
```

## A.47 Add blueprint asset with overlay

Use `overlayAssetId` and `render: "blueprint"`.

```json
{
  "assets": {
    "asset:item:blueprint-kiln": {
      "kind": "item",
      "label": "Kiln Blueprint",
      "resourceId": "item-blueprint",
      "overlayAssetId": "asset:item:kiln",
      "render": "blueprint",
    }
  }
}
```

## A.48 Add UI asset

Use `kind: "ui"`.

```json
{
  "assets": {
    "asset:ui:coin": {
      "kind": "ui",
      "label": "Coin UI Icon",
      "resourceId": "ui-coin",
      "render": "plain",
    }
  }
}
```

## A.49 Add currency as item

Currency is a normal item with large stack size and currency tag.

```json
{
  "items": {
    "item:coin-stack": {
      "assetId": "asset:item:coin-stack",
      "code": "coin-stack",
      "name": "Coin Stack",
      "tier": 1,
      "maxStackSize": 999,
      "storage": "inventory",
      "description": "Currency stack.",
      "tags": ["currency"],
    }
  }
}
```


## A.50 Add resource deposit for proximity

Create board item and use it in proximity requirement.

```json
{
  "items": {
    "item:stone-deposit": {
      "assetId": "asset:item:stone-deposit",
      "code": "stone-deposit",
      "name": "Stone Deposit",
      "tier": 0,
      "maxStackSize": 1,
      "storage": "board",
      "description": "Board resource deposit.",
      "tags": ["deposit", "stone"],
    }
  },
  "requirements": {
    "requirement:quarry-1-near-stone": {
      "type": "proximity",
      "itemIds": ["item:stone-deposit"],
      "distance": 2,
      "durationFactor": 1
    }
  }
}
```

## A.51 Add producer using deposit

Attach deposit requirement to producer.

```json
{
  "items": {
    "item:quarry-1": {
      "assetId": "asset:item:quarry",
      "code": "quarry-1",
      "name": "Quarry I",
      "tier": 1,
      "maxStackSize": 1,
      "description": "Produces stone near deposits.",
      "tags": ["producer", "building", "stone"],
      "producerId": "producer:quarry-1"
    }
  },
  "producers": {
    "producer:quarry-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": ["product:quarry-1-stone"],
      "requirementIds": ["requirement:quarry-1-near-stone"]
    }
  },
  "products": {
    "product:quarry-1-stone": {
      "name": "Stone",
      "durationMs": 6000,
      "placement": "board_then_inventory",
      "requirementIds": [],
      "outputTableId": "loot:quarry-1-stone"
    }
  },
  "lootTables": {
    "loot:quarry-1-stone": {
      "name": "Quarry I Stone",
      "output": [
        {
          "type": "guaranteed",
          "itemId": "item:stone",
          "quantity": 1
        }
      ]
    }
  }
}
```

## A.52 Add alternative product line

Add another product to the same producer.

```json
{
  "producers": {
    "producer:lumber-camp-1": {
      "type": "producer",
      "maxQueueSize": 1,
      "productIds": [
        "product:lumber-camp-1-twigs",
        "product:lumber-camp-1-logs"
      ],
      "requirementIds": ["requirement:lumber-camp-1-near-tree"]
    }
  },
  "products": {
    "product:lumber-camp-1-twigs": {
      "name": "Twigs",
      "durationMs": 5000,
      "placement": "board_then_inventory",
      "requirementIds": [],
      "outputTableId": "loot:lumber-camp-1-twigs"
    },
    "product:lumber-camp-1-logs": {
      "name": "Logs",
      "durationMs": 9000,
      "placement": "board_then_inventory",
      "requirementIds": [],
      "outputTableId": "loot:lumber-camp-1-logs"
    }
  }
}
```

## A.53 Add product line with own input and own output

Each product line gets its own inline `inputs` and `output` unless the data is deliberately shared.

```json
{
  "inputs": {
    "input:lumber-camp-1-log": {
      "name": "Lumber Camp I Log Input",
      "inputs": [
        {
          "itemId": "item:branch",
          "quantity": 1,
          "capacity": 4,
          "consume": true
        }
      ]
    }
  },
  "products": {
    "product:lumber-camp-1-log": {
      "name": "Logs",
      "durationMs": 8500,
      "placement": "board_then_inventory",
      "inputRefId": "input:lumber-camp-1-log",
      "requirementIds": [],
      "outputTableId": "loot:lumber-camp-1-log"
    }
  },
  "lootTables": {
    "loot:lumber-camp-1-log": {
      "name": "Lumber Camp I Logs",
      "output": [
        {
          "type": "guaranteed",
          "itemId": "item:log",
          "quantity": 1
        }
      ]
    }
  }
}
```
