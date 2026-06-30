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

The compiler derives `assetId` as `asset:<itemId>` and synthesizes conventional item assets; `assets.json` only contains overrides such as intentional resource reuse. Asset definitions do not carry a `kind` field; the asset id/resource id already describe the render resource, and item ownership is validated through `items.*.assetId`. Item `code` no longer exists; the item id is the single stable identity. `storage` is `board`, `inventory`, or `both`; omitted means `both`. `tier` defaults to `0`, `maxStackSize` defaults to `10`, and `tags` default to `[]`. Board-only dangers cannot be hidden in inventory. `maxCount` is a board-only cap for the final item, and craft source items such as blueprints inherit that target cap during producer output and job reservation checks. Use an informational `unique` tag on intentionally single-copy content when that helps humans read the config; the cap itself still comes from `maxCount`. `passiveEffectIds` make the item an effect source according to each effect's `sourceScope`. Producer, stash, and craft capabilities are not referenced from the item; they are keyed by the owning item id in `producers`, `stashes`, and `craftRecipes`.

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

`maxQueueSize` defaults to `1`. Producer shells do not own gates; product-line availability is resolved through Effect grants. A producer may also define finite `charges` and `onChargesDepleted` (`stop` or `remove`). Product lines may define `chargeCost`; if omitted, the product costs no charges. There is no `type: "producer"` field because the section already says the thing is a producer. Humans, tragically, can infer this too.

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

`name` may be omitted when the product name is the same as the primary output item name; the compiler derives it for the compiled package. Keep `name` only for action-style labels such as trade, prospecting, expeditions, inspired variants, or blueprint wording that differs from the item name. `placement` defaults to `board_then_inventory`. `inputs` may be omitted for free products. `output` may be omitted for delayed sink/destructor products. Product-line gates and modifiers live in the line-owned `effects` array. Product lines that define `activatesEffectId` must not define item output, because their output is runtime influence.

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

Quantity may be a number or `{ "min": number, "max": number }`. Output entries may also define optional `sort` for display ordering when a line has several possible outputs such as trash, pollution, or weighted alternatives. Lower values appear first; omitted values fall back to deterministic item-id ordering.

## Stashes

A stash is an authoring-level producer facade for finite loot/container behavior. It is keyed by the owning item id, has exactly one `productId`, and uses the same product-line execution path as producers. The product line owns inputs, output, placement, grant gates, duration, effects, and `chargeCost`. The stash owns the finite charges and depletion mode.

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

Craft recipes are keyed by the craft target item id, usually a blueprint item. Blueprint recipes may omit `resultItemId`; the compiler derives `producer:<suffix>` from `item:blueprint-<suffix>`. Inputs are stored through the normal DnD interaction model. Input `quantity` defaults to `1`; keep it only when the recipe needs more than one item. Craft `effects` intentionally support only runtime start gates: `grant.require` with `phase: "start"` and `grant.blockStart`. Producer-only nearby/duration/loot effects are rejected on craft recipes so config cannot describe behavior the craft runtime silently ignores. A blueprint recipe must not require its own blueprint item, directly or through another blueprint/building chain; `game:validate` and `game:compile` reject blueprint dependency cycles.

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

## Effects

Effect definitions are deliberately boring now: an effect only publishes one or more global grants while its source exists. The source is an item/building with `passiveEffectIds`, or a timed active producer line with `activatesEffectId`. Each effect must declare `polarity`: `buff`, `debuff`, `neutral`, or `mixed`. Runtime logic does not infer meaning from math or labels; UI groups effects by this explicit authoring truth, because guessing intent from JSON is how software gets haunted. The effect definition also decides where passive item sources count through `sourceScope`: `board`, `inventory`, or `both`; omitted means board-only. Each grant has a stable `id` used by runtime selectors and a player-readable `name` used by detail UI, so UI must not print raw grant ids in player-facing surfaces.

```json
{
  "effects": {
    "effect:path:engineers": {
      "name": "Engineers path",
      "polarity": "neutral",
      "sourceScope": "both",
      "grants": [{ "id": "grant:path:engineers", "name": "Engineers path chosen" }]
    }
  },
  "items": {
    "producer:house-of-engineers": {
      "passiveEffectIds": ["effect:path:engineers"]
    }
  }
}
```

Effects do not contain operations, targets, product-line selectors, or config patches. Product lines and craft recipes own the question “what does this grant or nearby source do to me?” in their own `effects` arrays. Centralized grants are just facts in the world. Riveting stuff, but at least it stops the engine from becoming a haunted spreadsheet.

Authoring selectors use one normalized vocabulary: `mode: "all"`, `anyOf`, `allOf`, and `noneOf`. Each source ref is `{ "id": "..." }`, `{ "ids": ["..."] }`, or `{ "tag": "..." }`. Compile expands tags into deterministic runtime `{ "ids": [...] }` clauses.

## Product-line effects

Producer and stash product lines may declare line-owned `effects`. These are evaluated for the concrete product line at runtime and produce an effective view: visibility, start readiness, blockers, duration, and extra chance loot. Runtime product-line views must carry explicit `lineKind: "product" | "effect"`; effect views must carry `effectPolarity`, product views must not, and UI must not fall back to product or neutral when the view forgets to say what it is.

Supported product-line effect kinds:

```json
{ "kind": "grant.require", "phase": "start", "display": "always", "selector": { "allOf": [{ "id": "grant:path:engineers" }] } }
{ "kind": "grant.blockStart", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:path:faith" }] } }
{ "kind": "nearby.require", "phase": "start", "display": "always", "items": { "anyOf": [{ "tag": "tree" }] }, "radius": 1 }
{ "kind": "nearby.duration.multiply", "display": "whenActive", "items": { "anyOf": [{ "tag": "tree" }] }, "radius": 3, "maxSources": 5, "bands": [{ "minDistance": 0, "maxDistance": 3, "multiplier": 0.9 }] }
{ "kind": "grant.duration.multiply", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:shrine:minor-haste" }] }, "multiplier": 0.75 }
{ "kind": "grant.loot.extraOutputChance.add", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:shrine:bountiful-offering" }] }, "outputItems": { "items": { "anyOf": [{ "tag": "tier-1-resource" }] } }, "chance": 0.35, "quantity": 1 }
```

`phase: "visibility"` hides or reveals a hidden product line based on a requirement. `phase: "start"` leaves the line visible but prevents starting it until the requirement is satisfied. `grant.blockStart` is the opposite shape: if the selector is active, the line is blocked. This is used for path exclusivity and similar “you chose the other door, genius” rules.

`nearby.require` and `nearby.duration.multiply` use Chebyshev distance, so diagonals count. Nearby duration effects stack per matched source up to `maxSources`; at least one authored band must use a multiplier other than `1`, otherwise the whole effect is a pretty no-op. Grant duration and loot effects are global and only activate when the line’s selector is satisfied. `grant.duration.multiply.multiplier` must change timing, so `1` is rejected. `grant.loot.extraOutputChance.add` may only target same-line non-weighted base output items and its `chance` must be greater than `0`; output-less, weighted-only, zero-chance, or selector-no-match bonus loot effects are rejected because otherwise the UI advertises a bonus that runtime cannot ever roll. Modifier effects are reported as active bonuses in UI, not as missing requirements.

`display` controls only UI visibility for requirement-like rows: `always`, `whenActive`, `whenMissing`, or `never`. It must not change runtime validation. Hidden missing requirements still block starts, because otherwise the UI would be decorative nonsense with buttons attached. For `grant.blockStart`, an inactive blocker is "not blocked by" that rule, not a satisfied requirement; UI wording must keep blocker semantics separate from missing-grant semantics.

## Craft recipe effects

Craft recipe `effects` are intentionally narrower than product-line effects. They support only start-gating semantics:

```json
{ "kind": "grant.require", "phase": "start", "display": "always", "selector": { "allOf": [{ "id": "grant:path:engineers" }] } }
{ "kind": "grant.blockStart", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:path:faith" }] } }
```

Craft targets do not have multiple visible product lines, output loot plans, or duration bonus summaries. Validation rejects producer-only line effects on craft recipes instead of silently pretending everything is fine like a tiny bureaucrat with a clipboard.

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
