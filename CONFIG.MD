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

There are no top-level reusable product input tables and no top-level reusable loot tables. Normal product/stash data lives directly on the thing that uses it. Referencing one-off data through another file was not architecture, it was paperwork with extra steps. Source fragments may omit conventional defaults; the compiler normalizes them into canonical `GameConfig`.

## Items

Items define physical tiles/stacks. Source items omit identity fields that can be derived from the item id:

```json
{
  "name": "Lumber Camp I",
  "description": "Produces early wood resources.",
  "tier": 1,
  "tags": ["building", "wood"],
  "maxStackSize": 1,
  "passiveEffectIds": ["effect:path-engineers-lock"],
  "maxCount": 1,
  "label": "1"
}
```

The compiler derives `assetId` as `asset:<itemId>` and synthesizes conventional item assets; `assets.json` only contains overrides such as intentional resource reuse. Asset definitions do not carry a `kind` field; the asset id/resource id already describe the render resource, and item ownership is validated through `items.*.assetId`. Item `code` no longer exists; the item id is the single stable identity. `storage` is `board`, `inventory`, or `both`; omitted means `both`. `tier` defaults to `0`, `maxStackSize` defaults to `10`, and `tags` default to `[]`. Board-only dangers cannot be hidden in inventory. `maxCount` is a board-only cap. `passiveEffectIds` make the item an effect source according to each effect's `sourceScope`. Producer, stash, and craft capabilities are not referenced from the item; they are keyed by the owning item id in `producers`, `stashes`, and `craftRecipes`.

## Producers and products

A producer capability is keyed by the owning item id and owns ordered product ids. A concrete producer item instance may have queued jobs up to `maxQueueSize`.

```json
{
  "producers": {
    "producer:lumber-camp-1": {
      "productIds": ["product:lumber-camp-1-twigs"]
    }
  }
}
```

`maxQueueSize` defaults to `1`; `requirementIds` defaults to `[]`. A producer may also define finite `charges` and `onChargesDepleted` (`stop` or `remove`). Product lines may define `chargeCost`; if omitted, the product costs no charges. There is no `type: "producer"` field because the section already says the thing is a producer. Humans, tragically, can infer this too.

A product line owns its inputs and output inline:

```json
{
  "products": {
    "product:lumber-camp-1-twigs": {
      "durationMs": 3000,
      "inputs": [
        {
          "itemId": "item:water",
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

`name` may be omitted when the product name is the same as the primary output item name; the compiler derives it for the compiled package. Keep `name` only for action-style labels such as trade, prospecting, expeditions, inspired variants, or blueprint wording that differs from the item name. `placement` defaults to `board_then_inventory`; `requirementIds` defaults to `[]`. `inputs` may be omitted for free products. `output` may be omitted for delayed sink/destructor products. Product lines that define `activatesEffectId` must not define item output, because their output is runtime influence.

Product input `quantity` defaults to `1`. Missing input `mode` means `exact`: the product needs and consumes exactly `quantity` items for each run. `mode: "upTo"` changes `quantity` into the per-run maximum: the product can start with at least one stored/selected input and consumes `1..quantity` for the same fixed output. Use this for sink/cleanup lines such as a purifier that can absorb up to four pollution tiles per activation without scaling the output. `capacity` still means how many items may be parked on that product input slot.

```json
{
  "itemId": "item:pollution",
  "quantity": 4,
  "capacity": 4,
  "consume": true,
  "mode": "upTo"
}
```

Output entries support:

```json
{ "type": "guaranteed", "itemId": "item:twig", "quantity": 2 }
{ "type": "chance", "itemId": "item:pollution", "chance": 0.2 }
{
  "type": "weighted",
  "rolls": 1,
  "entries": [
    { "itemId": "item:twig", "weight": 3 },
    { "itemId": "item:log", "weight": 1 }
  ]
}
```

Quantity may be a number or `{ "min": number, "max": number }`.

## Stashes

A stash is an authoring-level producer facade for finite loot/container behavior. It is keyed by the owning item id, has exactly one `productId`, and uses the same product-line execution path as producers. The product line owns inputs, output, placement, requirements, duration, effects, and `chargeCost`. The stash owns the finite charges and depletion mode.

```json
{
  "stashes": {
    "item:crate-1": {
      "charges": 1,
      "onChargesDepleted": "remove",
      "productIds": ["product:crate-1-open"]
    }
  },
  "products": {
    "product:crate-1-open": {
      "chargeCost": 1,
      "durationMs": 0,
      "inputs": [],
      "output": [
        { "type": "guaranteed", "itemId": "item:twig", "quantity": { "min": 1, "max": 3 } },
        { "type": "chance", "itemId": "item:plank", "chance": 0.25, "quantity": 1 }
      ],
      "placement": "board_then_inventory"
    }
  }
}
```

`charges` defaults to `1`, `onChargesDepleted` defaults to `remove`, and stash `productIds` must contain exactly one product. Stash products must spend charges with `chargeCost > 0`; otherwise the finite container would be an infinite loot faucet, because apparently we do need to say that out loud.

For the current chest implementation, depletion mode is `remove`: when the product line completes successfully and spends the last charge, the stash item is removed. Its own board cell is considered available for the output placement attempt, while failed placement keeps the original stash/job state intact through the normal producer blocked-delivery path.

## Craft recipes

Craft recipes are keyed by the craft target item id, usually a blueprint item. Blueprint recipes may omit `resultItemId`; the compiler derives `producer:<suffix>` from `item:blueprint-<suffix>`. Inputs are stored through the normal DnD interaction model. Input `quantity` defaults to `1`; keep it only when the recipe needs more than one item. A blueprint recipe must not require its own blueprint item, directly or through another blueprint/building chain; `game:validate` and `game:compile` reject blueprint dependency cycles.

```json
{
  "craftRecipes": {
    "item:blueprint-townhall-t2": {
      "durationMs": 10000,
      "inputs": [
        { "itemId": "item:plank", "quantity": 4, "consume": true }
      ]
    }
  }
}
```

## Requirements

Requirements can be passive, stored, or proximity-based. Product/producers reference reusable requirements through `requirementIds`. Craft/stash requirements are inline. Requirement `durationFactor` defaults to `1`; write it only when it actually changes duration.

```json
{ "type": "passive", "itemId": "item:well", "quantity": 1, "scope": "board_or_inventory" }
{ "type": "stored", "itemId": "item:water", "quantity": 1, "capacity": 2 }
{ "type": "proximity", "itemIds": ["item:purifier"], "distance": 2 }
```

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

`sourceScope` is `board`, `inventory`, or `both`; omitted means `board`. Local effects must be board-sourced because distance needs a board cell. `duration.proximityPenalty` is local-only and multiplies duration per nearby source item; closer sources apply a stronger penalty and multiple source instances stack.

Operation targets use domain selectors. Product-line operations may target `producers`, `productLines`, or both; if both are present, both must match. Item creation operations target `items`. Source selectors use one vocabulary everywhere: `mode: "all"`, `anyOf`, `allOf`, and `noneOf`. Each authoring ref is either `{ "id": "..." }` or `{ "tag": "..." }`. Tags are authoring sugar: compile expands refs into concrete `{ "ids": [...] }` clauses while keeping the same selector shape, so runtime evaluates a boring deterministic predicate instead of doing tag archaeology in the middle of gameplay. Empty target objects are invalid, because apparently even configs need boundaries.

Supported operations:

```json
{ "kind": "line.reveal", "target": { "productLines": { "anyOf": [{ "tag": "engineers" }] } } }
{ "kind": "line.hide", "target": { "productLines": { "anyOf": [{ "id": "product:secret" }] } } }
{ "kind": "line.blockStart", "reason": "Wrong path.", "target": { "productLines": { "anyOf": [{ "tag": "faith" }] } } }
{ "kind": "duration.addMs", "valueMs": 1000, "target": { "productLines": { "mode": "all" } } }
{ "kind": "duration.multiply", "multiplier": 0.5, "target": { "productLines": { "anyOf": [{ "tag": "engineers" }] } } }
{ "kind": "duration.proximityPenalty", "durationFactor": 0.5, "target": { "productLines": { "anyOf": [{ "id": "product:farm-t1:grain" }] } } }
{ "kind": "loot.appendOutput", "chance": 0.2, "output": [{ "type": "guaranteed", "itemId": "item:pollution", "quantity": 1 }], "target": { "productLines": { "mode": "all" } } }
{ "kind": "loot.replaceOutput", "output": [{ "type": "guaranteed", "itemId": "item:void-splinter", "quantity": 1 }], "target": { "productLines": { "anyOf": [{ "id": "product:test" }] } } }
{ "kind": "loot.addChanceItem", "itemId": "item:pollution", "chance": 0.1, "quantity": 1, "target": { "productLines": { "mode": "all" } } }
{ "kind": "loot.dropChance.add", "delta": -0.2, "target": { "productLines": { "mode": "all" } } }
{ "kind": "loot.quantity.add", "value": 1, "target": { "productLines": { "anyOf": [{ "tag": "resource-output" }] } } }
{ "kind": "loot.extraOutputChance.add", "chance": 0.35, "quantity": 1, "target": { "productLines": { "mode": "all" } }, "outputItems": { "items": { "anyOf": [{ "tag": "tier-1-resource" }] } } }
{ "kind": "item.blockCreate", "reason": "Counter path locked.", "target": { "items": { "anyOf": [{ "tag": "faith" }] } } }
```

`line.blockStart` blocks new enqueue/start attempts. Already queued jobs keep their chance; the output can still be affected or voided by hard create rules at completion. `loot.quantity.add` increases every matched output directly, so use it sparingly unless you enjoy printing resources like a doomed central bank. `loot.extraOutputChance.add` is the safer bounty form: it targets product lines, then only adds a chance-based extra drop for produced output items matching `outputItems`. `item.blockCreate` is hard: immediate creation actions reject, delayed producer/craft/spawn outputs are discarded instead of retrying forever.

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

Validation checks board bounds, duplicate cells, inventory slot count, item storage policy, stack caps, item references, duplicate producer ownership, effect targets, output item references, blueprint dependency cycles, and save/config consistency. If validation accepts it, runtime has to honor it. If runtime cannot honor it, schema should reject it instead of making the player discover our little JSON crime scene.
