# Arkini GameConfig reference

`GameConfig` is the canonical immutable gameplay contract. Runtime reads it, save data references it, and validation must reject anything the engine cannot execute deterministically. There is no backward compatibility layer for old config shapes. If source data is obsolete, delete it instead of teaching runtime to babysit ghosts.

## Package shape

Source packages under `game/arkini` are compiled into `game/arkini.game.json` plus `game/arkini.assets.json`.

Canonical game config keys:

```json
{
  "version": 1,
  "game": {},
  "resources": {},
  "assets": {},
  "items": {},
  "merge": {},
  "requirements": {},
  "effects": {},
  "producers": {},
  "products": {},
  "stashes": {},
  "craftRecipes": {},
  "startingState": { "board": [], "inventory": [] }
}
```

There are no top-level reusable product input tables and no top-level reusable loot tables. Normal product/stash data lives directly on the thing that uses it. Referencing one-off data through another file was not architecture, it was paperwork with extra steps.

## Items

Items define physical tiles/stacks. Important fields:

```json
{
  "name": "Lumber Camp I",
  "code": "lumber-camp-1",
  "description": "Produces early wood resources.",
  "assetId": "asset:lumber-camp-1",
  "tier": 1,
  "tags": ["building", "wood"],
  "maxStackSize": 1,
  "storage": "both",
  "producerId": "producer:lumber-camp-1",
  "stashId": "stash:crate-1",
  "craftRecipeId": "craft:townhall-2",
  "passiveEffectIds": ["effect:path-engineers-lock"],
  "maxCount": 1,
  "label": "1"
}
```

`storage` is `board`, `inventory`, or `both`; omitted means `both`. Board-only dangers cannot be hidden in inventory. `maxCount` is a board-only cap. `passiveEffectIds` make the item an effect source according to each effect's `sourceScope`.

## Producers and products

A producer owns ordered product ids. A concrete producer item instance may have queued jobs up to `maxQueueSize`.

```json
{
  "producers": {
    "producer:lumber-camp-1": {
      "type": "producer",
      "productIds": ["product:lumber-camp-1-twigs"],
      "requirementIds": [],
      "hinderedBy": [],
      "maxQueueSize": 1
    }
  }
}
```

A product line owns its inputs and output inline:

```json
{
  "products": {
    "product:lumber-camp-1-twigs": {
      "name": "Twigs",
      "durationMs": 3000,
      "placement": "board_then_inventory",
      "requirementIds": [],
      "inputs": [
        {
          "itemId": "item:water",
          "quantity": 1,
          "capacity": 1,
          "consume": true
        }
      ],
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

`inputs` may be omitted for free products. `output` may be omitted for delayed sink/destructor products. Product lines that define `activatesEffectId` must not define item output, because their output is runtime influence.

Output entries support:

```json
{ "type": "guaranteed", "itemId": "item:twig", "quantity": 2 }
{ "type": "chance", "itemId": "item:pollution", "chance": 0.2, "quantity": 1 }
{
  "type": "weighted",
  "rolls": 1,
  "entries": [
    { "itemId": "item:twig", "weight": 3, "quantity": 1 },
    { "itemId": "item:log", "weight": 1, "quantity": 1 }
  ]
}
```

Quantity may be a number or `{ "min": number, "max": number }`.

## Stashes

A stash is a charged container/loot source. It owns its inputs and output inline.

```json
{
  "stashes": {
    "stash:crate-1": {
      "type": "stash",
      "charges": 1,
      "placement": "board_then_inventory",
      "requirements": [],
      "inputs": [],
      "output": [
        { "type": "guaranteed", "itemId": "item:twig", "quantity": { "min": 1, "max": 3 } },
        { "type": "chance", "itemId": "item:plank", "chance": 0.25, "quantity": 1 }
      ],
      "onDepleted": "remove"
    }
  }
}
```

When depleted, `onDepleted` may be `remove`, `keep`, or `{ "replaceWithItemId": "item:empty-stash" }`. Stash release preflights atomically, counts the removing stash cell as output space when relevant, and emits output through item spawn jobs so backend order and visual order share the same source.

## Craft recipes

Craft recipes belong to items through `craftRecipeId`. Inputs are stored through the normal DnD interaction model.

```json
{
  "craftRecipes": {
    "craft:townhall-2": {
      "durationMs": 10000,
      "inputs": [
        { "itemId": "item:plank", "quantity": 4, "consume": true }
      ],
      "requirements": [],
      "resultItemId": "item:townhall-2"
    }
  }
}
```

## Requirements and hindrances

Requirements can be passive, stored, or proximity-based. Product/producers reference reusable requirements through `requirementIds`. Craft/stash requirements are inline.

```json
{ "type": "passive", "itemId": "item:well", "quantity": 1, "scope": "board_or_inventory" }
{ "type": "stored", "itemId": "item:water", "quantity": 1, "capacity": 2 }
{ "type": "proximity", "itemIds": ["item:purifier"], "distance": 2, "durationFactor": 1.5 }
```

Hindrances use the passive/proximity shapes but slow production instead of gating start. Multiple active hindrances stack.

## Effects

Effects are hard gameplay rules and runtime product-line mutators. They never mutate `GameConfig`; runtime computes an effective view for a concrete producer/product/source situation.

Effect source fields:

```json
{
  "name": "Engineers path lock",
  "scope": "global",
  "sourceScope": "both",
  "operations": []
}
```

`sourceScope` is `board`, `inventory`, or `both`; omitted means `board`. Local effects must be board-sourced because distance needs a board cell.

Operation targets must be explicit. Use `target: { "all": true }` for match-everything. Do not use empty target objects.

Supported operations:

```json
{ "kind": "line.reveal", "target": { "productTags": ["engineers"] } }
{ "kind": "line.hide", "target": { "productIds": ["product:secret"] } }
{ "kind": "line.blockStart", "reason": "Wrong path.", "target": { "productTags": ["faith"] } }
{ "kind": "duration.addMs", "valueMs": 1000, "target": { "all": true } }
{ "kind": "duration.multiply", "multiplier": 0.5, "target": { "productTags": ["engineers"] } }
{ "kind": "loot.appendOutput", "chance": 0.2, "output": [{ "type": "guaranteed", "itemId": "item:pollution", "quantity": 1 }], "target": { "all": true } }
{ "kind": "loot.replaceOutput", "output": [{ "type": "guaranteed", "itemId": "item:void-splinter", "quantity": 1 }], "target": { "productIds": ["product:test"] } }
{ "kind": "loot.addChanceItem", "itemId": "item:pollution", "chance": 0.1, "quantity": 1, "target": { "all": true } }
{ "kind": "loot.dropChance.add", "delta": -0.2, "target": { "all": true } }
{ "kind": "item.blockCreate", "reason": "Counter path locked.", "target": { "itemTags": ["faith"] } }
```

`line.blockStart` blocks new enqueue/start attempts. Already queued jobs keep their chance; the output can still be affected or voided by hard create rules at completion. `item.blockCreate` is hard: immediate creation actions reject, delayed producer/craft/spawn outputs are discarded instead of retrying forever.

## Time model

Config uses `durationMs` for relative authored time. Save/runtime uses normalized absolute fields:

- `startAtMs`: time window begins
- `readyAtMs`: job may process/complete
- `endAtMs`: active effect stops applying
- `nextAttemptAtMs`: retryable blocked delivery can try again
- `atMs`: event emission instant

Runtime time math belongs in `src/v0/game/time/*`.

## Starting state

```json
{
  "startingState": {
    "board": [
      { "itemId": "item:townhall-1", "x": 0, "y": 0 }
    ],
    "inventory": [
      { "itemId": "item:twig", "quantity": 3 }
    ]
  }
}
```

Validation checks board bounds, duplicate cells, inventory slot count, item storage policy, stack caps, item references, duplicate producer ownership, effect targets, output item references, and save/config consistency. If validation accepts it, runtime has to honor it. If runtime cannot honor it, schema should reject it instead of making the player discover our little JSON crime scene.
