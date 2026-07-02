# Arkini GameConfig reference

`GameConfig` is the canonical immutable gameplay contract. Runtime reads it, save data references it, and validation must reject anything the engine cannot execute deterministically. Old config shapes are not supported. If source data is obsolete, delete it instead of teaching runtime to babysit ghosts.

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
  "effects": {},
  "startingState": { "board": [], "inventory": [] }
}
```

There are no top-level line, stash, merge, or craft registries. Item capabilities live directly on the item that owns them: `producer`, `stash`, `craft`, `merges`, and `removeBy`. Referencing one-off behavior through another file was not architecture, it was paperwork with extra steps. Source fragments may omit conventional defaults; the compiler normalizes them into canonical `GameConfig`.

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

The compiler derives `assetIds` as `["asset:<itemId>"]` and synthesizes conventional item assets; `assets.json` only contains overrides such as intentional resource reuse. Asset definitions do not carry a `kind` field; the asset id/resource id already describe the render resource, and item ownership is validated through `items.*.assetIds`. Multi-asset craft/blueprint items select an asset by delivered input progress, split evenly across the ordered asset list. Item `code` no longer exists; the item id is the single stable identity. `storage` is `board`, `inventory`, or `both`; omitted means `both`. `tier` defaults to `0`, `maxStackSize` defaults to `10`, and `tags` default to `[]`. Board-only dangers cannot be hidden in inventory. `maxCount` is a board-only cap for the final item, and craft source items such as blueprints inherit that target cap during producer output and job reservation checks. Use an informational `unique` tag on intentionally single-copy content when that helps humans read the config; the cap itself still comes from `maxCount`. `passiveEffectIds` make the item an effect source according to each effect's `sourceScope`. Producer, stash, craft, merge, and removal capabilities are embedded directly on the owning item. The item is the authoring unit: take the item and you have the behavior it owns, without asking a second registry for permission like a tiny JSON bureaucrat.

## Lines

A producer capability lives directly on the producer item. The concrete board instance queues jobs up to `maxQueueSize`; the item definition owns the ordered `lines` array. Each line keeps a stable local `id`, because save data and jobs need to point at a line without depending on array order.

```json
{
  "items": {
    "producer:lumber-camp-1": {
      "name": "Lumber Camp I",
      "producer": {
        "maxQueueSize": 1,
        "lines": [
          {
            "id": "line:lumber-camp-1:twigs",
            "durationMs": 3000,
            "inputs": [
              { "itemId": "item:water", "quantity": 1, "capacity": 1, "consume": true }
            ],
            "output": [
              { "type": "guaranteed", "itemId": "item:twig", "quantity": 2 }
            ],
            "placement": "board_then_inventory"
          }
        ]
      }
    }
  }
}
```

`maxQueueSize` defaults to `1`. Producer shells do not own gates; line availability is resolved through Effect grants and output-owned rules. Lines may define `chargeCost`; if omitted, the line costs no charges. There is no top-level product registry and no `type: "producer"` field, because the item capability already says what the thing is. Humans, tragically, can infer this too.

`name` may be omitted when the line name is the same as the primary output item name; the compiler derives it for the compiled package. Keep `name` only for action-style labels such as trade, prospecting, expeditions, inspired variants, or blueprint wording that differs from the item name. `placement` defaults to `board_then_inventory`. `inputs` may be omitted for free lines. `output` may be omitted for delayed sink/destructor lines. Producer output gates, visibility, availability, duration modifiers, and loot chance modifiers live directly on the affected `output` entry. The root line does not own producer-facing `effects`; the concrete output that is changed owns the rule, because apparently JSON also deserves accountability. Lines that define `activatesEffectId` must not define item output, because their output is runtime influence. For blueprint-output lines, inputs should represent lightweight plan acquisition, research, survey evidence, or paperwork. Do not duplicate the same construction materials/labor inputs that the blueprint craft recipe will consume later; validation tests treat repeated blueprint planning/build costs as a balance bug.

Line input `quantity` defaults to `1`. Missing input `mode` means `exact`: the line needs and consumes exactly `quantity` items for each run. `mode: "upTo"` changes `quantity` into the per-run maximum: the line can start with at least one stored/selected input and consumes `1..quantity` for the same fixed output. Use this for sink/cleanup lines such as a purifier that can absorb up to four pollution tiles per activation without scaling the output. `capacity` still means how many items may be parked on that line input slot.

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

Quantity may be a number or `{ "min": number, "max": number }`. Output entries may also define optional `sort` for display ordering when a line has several possible outputs such as trash, pollution, or weighted alternatives. Lower values appear first; omitted values fall back to deterministic item-id ordering. Each concrete drop, including a weighted entry, may also define `visibility`, `enabled`, and ordered drop-owned `effects`. Runtime evaluates those effects from top to bottom on that one drop, so the affected output owns its own reactivity instead of being poked from a bonus table like a JSON voodoo doll.

## Stashes

A stash is an item-owned producer facade for finite loot/container behavior. It owns finite charges and depletion mode, and it has exactly one embedded `line`. The line owns inputs, output, placement, duration, and `chargeCost`; any producer-facing effect rules live on the concrete output entries.

```json
{
  "items": {
    "item:crate-1": {
      "stash": {
        "charges": 1,
        "onChargesDepleted": "remove",
        "line": {
          "id": "line:crate-1:open",
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
  }
}
```

`charges` defaults to `1`, `onChargesDepleted` defaults to `remove`, and stash lines must spend charges with `chargeCost > 0`; otherwise the finite container would be an infinite loot faucet, because apparently we do need to say that out loud.

For the current chest implementation, depletion mode is `remove`: when the line completes successfully and spends the last charge, the stash item is removed. Its own board cell is considered available for the output placement attempt, while failed placement keeps the original stash/job state intact through the normal producer blocked-delivery path.

## Craft

Craft capability lives directly on the craft target item, usually a blueprint item. Blueprint recipes may omit `resultItemId`; the compiler derives `producer:<suffix>` from `item:blueprint-<suffix>`. Inputs are stored through the normal DnD interaction model. Input `quantity` defaults to `1`; keep it only when the recipe needs more than one item. Craft `effects` intentionally support only runtime start gates: `grant.require` with `phase: "start"` and `grant.blockStart`. Producer-only nearby/duration/loot effects are rejected on craft so config cannot describe behavior the craft runtime silently ignores. A blueprint recipe must not require its own blueprint item, directly or through another blueprint/building chain; `game:validate` and `game:compile` reject blueprint dependency cycles.

```json
{
  "items": {
    "item:blueprint-townhall-t2": {
      "craft": {
        "durationMs": 10000,
        "inputs": [
          { "itemId": "item:plank", "quantity": 4, "consume": true }
        ]
      }
    }
  }
}
```

## Merges

Merge rules live on the source item in `items.*.merges`. They are explicit and directional: if water can be merged into a tree, that does not mean the tree can be merged into water unless the tree owns its own rule. Runtime does not invent symmetric behavior, because "helpful" merge inference is just a bug wearing perfume.

```json
{
  "items": {
    "item:water": {
      "merges": [
        { "withItemId": "item:tree", "resultItemId": "item:double-tree" }
      ]
    }
  }
}
```

## Effects

Effect definitions are deliberately boring now: an effect only publishes one or more global grants while its source exists. The source is an item/building with `passiveEffectIds`, or a timed active line with `activatesEffectId`. Each effect must declare `polarity`: `buff`, `debuff`, `neutral`, or `mixed`. Runtime logic does not infer meaning from math or labels; UI groups effects by this explicit authoring truth, because guessing intent from JSON is how software gets haunted. The effect definition also decides where passive item sources count through `sourceScope`: `board`, `inventory`, or `both`; omitted means board-only. Each grant has a stable `id` used by runtime selectors and a player-readable `name` used by detail UI, so UI must not print raw grant ids in player-facing surfaces.

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

Effects do not contain operations, targets, line selectors, or config patches. Producer outputs and craft recipes own the question “what does this grant or nearby source do to me?” in their own local `effects` arrays. Centralized grants are just facts in the world. Riveting stuff, but at least it stops the engine from becoming a haunted spreadsheet.

Authoring selectors use one normalized vocabulary: `mode: "all"`, `anyOf`, `allOf`, and `noneOf`. Each source ref is `{ "id": "..." }`, `{ "ids": ["..."] }`, or `{ "tag": "..." }`. Compile expands tags into deterministic runtime `{ "ids": [...] }` clauses.

## Output-owned producer effects

Producer and stash product definitions no longer declare root `effects`. Every producer-facing rule belongs on the concrete `output` entry it affects, including weighted entries. Runtime evaluates the ordered `effects` from top to bottom for that one drop and returns both the rollable output state and UI explanation rows. One output can be hidden, disabled, sped up, slowed down, or given bonus chance without making its sibling outputs inherit the same rule because they had the misfortune of sharing a line.

Supported output-owned effect kinds:

```json
{ "kind": "grant.require", "phase": "visibility", "display": "always", "selector": { "allOf": [{ "id": "grant:path:engineers" }] } }
{ "kind": "grant.require", "phase": "start", "display": "always", "selector": { "allOf": [{ "id": "grant:tooling:advanced" }] } }
{ "kind": "nearby.require", "phase": "start", "display": "whenMissing", "items": { "anyOf": [{ "tag": "tree" }] }, "radius": 2 }
{ "kind": "grant.blockStart", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:path:faith" }] } }
{ "kind": "nearby.duration.multiply", "display": "whenActive", "items": { "anyOf": [{ "tag": "tree" }] }, "radius": 3, "maxSources": 5, "bands": [{ "minDistance": 0, "maxDistance": 3, "multiplier": 0.9 }] }
{ "kind": "grant.duration.multiply", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:shrine:minor-haste" }] }, "multiplier": 0.75 }
{ "kind": "grant.drop.hide", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:path:faith" }] } }
{ "kind": "grant.drop.show", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:path:engineers" }] } }
{ "kind": "grant.drop.disable", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:polluted" }] } }
{ "kind": "grant.drop.enable", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:purified" }] } }
{ "kind": "grant.loot.extraOutputChance.add", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:shrine:bountiful-offering" }] }, "chance": 0.35, "quantity": 1 }
{ "kind": "nearby.loot.outputChance.add", "display": "always", "radius": 2, "quantity": 1, "sources": [{ "items": { "anyOf": [{ "tag": "wood-source" }] }, "chance": 0.5, "label": "Wood source" }] }
```

`phase: "visibility"` means the drop is completely absent when the condition fails. Use that for choose-the-path content where the player should not even see the other branch. `phase: "start"`, `grant.blockStart`, and `grant.drop.disable` leave the drop visible but unavailable, so UI can say exactly what is missing or blocking it. If a product has output and every visible output is disabled, runtime rejects the start with `effect:disabled-output`.

`nearby.require` and `nearby.duration.multiply` use Chebyshev distance, so diagonals count. Nearby duration effects stack per matched source up to `maxSources`; at least one authored band must use a multiplier other than `1`, otherwise the whole effect is a pretty no-op. Grant duration effects activate when their grant selector is satisfied. `grant.duration.multiply.multiplier` must change timing, so `1` is rejected. Duration modifier effects are reported as active bonuses in UI, not as requirement rows.

`display` controls only UI visibility for output effect rows: `always`, `whenActive`, `whenMissing`, or `never`. It must not change runtime validation. `grant.loot.extraOutputChance.add` adds an independent bonus roll for the same drop item; it does not accept `outputItems` because the drop is already the target. `nearby.loot.outputChance.add` can exceed 100%; runtime converts that into guaranteed quantity plus a remainder roll.

## Craft recipe effects

Craft recipe `effects` are intentionally narrower than producer output effects. They support only start-gating semantics:

```json
{ "kind": "grant.require", "phase": "start", "display": "always", "selector": { "allOf": [{ "id": "grant:path:engineers" }] } }
{ "kind": "grant.blockStart", "display": "whenActive", "selector": { "allOf": [{ "id": "grant:path:faith" }] } }
```

Craft targets do not have multiple visible lines, output loot plans, or duration bonus summaries. Validation rejects producer-only output effects on craft recipes instead of silently pretending everything is fine like a tiny bureaucrat with a clipboard.

## Time model

Product and craft `durationMs` should be authored as real gameplay balance, not as universal placeholders. Keep early gathering short, make processing/construction progressively longer, and avoid 1:1 material conversions when a more believable ratio exists. If a source product can reasonably have variable yield, prefer guaranteed output plus small chance outputs over hardcoding every run to the same one-item result.

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
