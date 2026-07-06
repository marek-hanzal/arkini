# Arkini GameConfig reference

`GameConfig` is the canonical immutable gameplay contract. Runtime reads it, save data references it, and validation must reject anything the engine cannot execute deterministically. Old config shapes are not supported. If source data is obsolete, delete it instead of teaching runtime to babysit ghosts.

## Package shape

Source packages under `game/arkini` are compiled into `game/arkini.game.arkpack`: an Arkini binary pack containing the normalized MessagePack game config and raw PNG resources. The authoring source stays strict JSON; the runtime artifact is binary.

Canonical game config keys:

```json
{
  "version": 1,
  "game": {},
  "resources": {},
  "assets": {},
  "items": {},
  "startingState": { "board": [], "inventory": [] }
}
```

The authored Arkini package is intentionally small at the root: `game.json` owns version, game metadata, starting state, asset overrides, and global utility items. Era gameplay is split into folders such as `era-I/items`, `era-I/producers`, and `era-I/blueprints`. There are no top-level line, stash, merge, craft, or effect registries. Item capabilities live directly on the item that owns them: `producer`, `stash`, `craft`, `merges`, `removeBy`, and grant-publishing `effects`. Referencing one-off behavior through another file was not architecture, it was paperwork with extra steps. Source fragments may omit conventional defaults; the compiler normalizes them into canonical `GameConfig`.

## Commented JSONC examples

The actual source files must remain **strict JSON**, not JSONC. The examples below are intentionally shown as `jsonc` because comments are the whole point of this section. Copy the shape, not the comments, unless your editor has achieved enlightenment and started compiling Markdown examples by accident.

### Source fragment wrapper

Every authored fragment is a partial package. The compiler recursively reads `game/arkini/**/*.json`, merges compatible top-level maps, and validates the normalized result. Every source JSON file must carry `$schema`; use the relative path from that file to `game/arkini.schema.json`.

```jsonc
{
  // Required for editor hints and audit guardrails.
  // Example from game/arkini/era-I/items/tree.json.
  "$schema": "../../../arkini.schema.json",

  // Most gameplay fragments only define a slice of the global item map.
  // Fragment files may contain one item or several tightly-related items.
  "items": {
    "item:example": {
      "name": "Example"
    }
  }
}
```

### Normal item / stackable resource

```jsonc
{
  "$schema": "../../../arkini.schema.json",
  "items": {
    "item:log": {
      // Player-facing name shown in tiles, inventory, and detail sheets.
      "name": "Log",

      // Keep descriptions gameplay-oriented. This is not flavor-text prison.
      "description": "Basic wood material used by early crafting.",

      // Tags are the coarse targeting surface for selectors.
      // Use tags when several items should satisfy the same rule.
      "tags": ["wood", "material", "era:I"],

      // Omitted storage means both board and inventory are allowed.
      // Use "board" for hazards/deposits/buildings that must not enter inventory.
      "storage": "both",

      // Stack cap for identical items without instance state.
      // Items with instance state such as capacity must stay maxStackSize: 1.
      "maxStackSize": 32,

      // Optional progression metadata used by UI and balance review.
      "tier": 1
    }
  }
}
```

### Finite deposit with replacement on depletion

Use this for sources such as trees and rocks. `capacity` is instance state, so the item must not stack. Producer line `nearby.capacity.spend` subtracts from this capacity when a job starts.

```jsonc
{
  "$schema": "../../../arkini.schema.json",
  "items": {
    "item:tree": {
      "name": "Tree",
      "tags": ["source", "wood-source", "tree", "tree:t1", "era:I"],

      // Capacity is stored per board item instance.
      // This item cannot safely be an anonymous inventory stack.
      "maxStackSize": 1,

      "capacity": {
        // Runtime detail UI shows remaining/max.
        "max": 18,

        // "remove" deletes the exhausted source.
        // "replace" keeps the cell occupied by another item.
        "onDepleted": "replace",

        // Replacement happens on the same board cell when capacity reaches 0.
        "replaceItemId": "item:seed"
      }
    }
  }
}
```

### Producer with capacity spend, output, and output-owned effects

A producer item owns its `producer` capability. The line below spends nearby wood capacity at job start, then rolls output from the line. Output-owned effects explain what modifies that one drop.

```jsonc
{
  "$schema": "../../../arkini.schema.json",
  "items": {
    "producer:lumberjack-t1": {
      "name": "Lumberjack I",
      "tags": ["producer", "wood", "era:I", "unique"],
      "maxStackSize": 1,

      // maxCount caps how many of this producer may exist on board.
      // The "unique" tag is informational; maxCount is the actual rule.
      "maxCount": 1,

      "producer": {
        // Omitted maxQueueSize defaults to 1.
        "lines": [
          {
            // Stable local id. Save jobs point here, so do not rename casually.
            "id": "line:lumberjack-t1:log",

            // Author real balance duration in ms.
            "durationMs": 7000,

            // Line-root effects are for admission costs / line-level rules.
            // Capacity spend happens when the job starts, not when the output rolls.
            "effects": [
              {
                "kind": "nearby.capacity.spend",
                "display": "always",
                "label": "Nearby wood capacity",

                // Item selector refs are documented in SELECTOR.MD.
                // This matches any nearby item tagged wood-source.
                "items": { "anyOf": [{ "tag": "wood-source" }] },
                "radius": 2,
                "amount": 1
              }
            ],

            "output": [
              {
                // chance: 0 is valid when output-owned effects provide chance.
                "type": "chance",
                "chance": 0,
                "itemId": "item:log",

                // These effects belong to this concrete log drop only.
                "effects": [
                  {
                    "kind": "nearby.loot.outputChance.add",
                    "display": "always",
                    "label": "Nearby wood source drop chance",
                    "radius": 2,
                    "quantity": 1,
                    "sources": [
                      {
                        "label": "Single Tree",
                        "items": { "anyOf": [{ "id": "item:tree" }] },
                        "chance": 0.5
                      }
                    ]
                  },
                  {
                    "kind": "grant.duration.multiply",
                    "display": "whenActive",
                    "label": "Minor Haste",
                    "selector": {
                      "allOf": [{ "ids": ["grant:active:shrine-minor-haste"] }]
                    },
                    "multiplier": 0.75
                  }
                ]
              }
            ],

            // Omitted placement defaults to board_then_inventory.
            "placement": "board_then_inventory"
          }
        ]
      }
    }
  }
}
```

### Craft with reusable input and random board result

Craft lives on the target item. Inputs are filled through the normal DnD/autofill model. `consume: false` means the input is required but returned/kept instead of destroyed.

```jsonc
{
  "$schema": "../../../arkini.schema.json",
  "items": {
    "item:cracked-rock": {
      "name": "Cracked Rock",
      "description": "A mined-out rocky crack. Use a Magnifying Glass to survey it.",
      "storage": "board",
      "maxStackSize": 1,
      "tags": ["source", "stone", "depleted", "craft-target", "era:I"],

      "craft": {
        // Two-minute survey job.
        "durationMs": 120000,

        "inputs": [
          {
            // Reusable tool. It satisfies the recipe but is not consumed.
            "itemId": "item:magnifying-glass",
            "consume": false
          }
        ],

        // Craft result item.
        "resultItemId": "item:rock",

        // Default resultPlacement is in-place replacement of the craft target.
        // random-board removes the craft target and spawns the result on a random free board cell.
        "resultPlacement": "random-board"
      }
    }
  }
}
```

### Blueprint craft / construction item

Blueprints are normal craft targets. If `resultItemId` is omitted, the compiler derives a conventional producer id from the blueprint id. Keep planning costs light; do not duplicate the full construction cost in both blueprint producer line and blueprint craft recipe unless you are deliberately balancing a tax simulator.

```jsonc
{
  "$schema": "../../../arkini.schema.json",
  "items": {
    "item:blueprint-sawmill-t1": {
      "name": "Sawmill I Blueprint",
      "storage": "both",
      "maxStackSize": 1,
      "tags": ["blueprint", "craft-target", "era:I"],

      // maxCount on the blueprint limits the final built target too.
      "maxCount": 1,

      "craft": {
        "durationMs": 30000,
        "inputs": [
          { "itemId": "item:log", "quantity": 2, "consume": true },
          { "itemId": "item:stone", "quantity": 1, "consume": true }
        ]

        // Optional explicit form:
        // "resultItemId": "producer:sawmill-t1"
      }
    }
  }
}
```

### Grant source and grant-gated output

Items publish grants through item `effects`. Other producers/crafts then read current grants with grant selectors. Background ownership grants are useful for rules but should not be treated as juicy player-facing UI content. Humanity has suffered enough from labels like “Owned X grant”.

```jsonc
{
  "$schema": "../../../arkini.schema.json",
  "items": {
    "producer:shrine-t1": {
      "name": "Shrine I",
      "producer": {
        "lines": [
          {
            "id": "line:shrine-t1:minor-haste",
            "name": "Minor Haste",
            "durationMs": 45000,

            // Effect lines publish temporary grants instead of item output.
            "effect": {
              "id": "effect:shrine-minor-haste",
              "name": "Minor Haste",
              "polarity": "buff",
              "sourceScope": "both",
              "grants": [
                {
                  "id": "grant:active:shrine-minor-haste",
                  "name": "Minor Haste active"
                }
              ]
            }
          }
        ]
      }
    },

    "producer:sawmill-t1": {
      "name": "Sawmill I",
      "producer": {
        "lines": [
          {
            "id": "line:sawmill-t1:plank",
            "durationMs": 10000,
            "inputs": [{ "itemId": "item:log", "quantity": 1, "consume": true }],
            "output": [
              {
                "type": "guaranteed",
                "itemId": "item:plank",
                "quantity": 1,
                "effects": [
                  {
                    // This specific plank output runs faster while the grant is active.
                    "kind": "grant.duration.multiply",
                    "display": "whenActive",
                    "label": "Minor Haste",
                    "selector": {
                      "allOf": [{ "ids": ["grant:active:shrine-minor-haste"] }]
                    },
                    "multiplier": 0.75
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  }
}
```

### Starting board / inventory

The root `game.json` owns starting state. Starting board entries need coordinates; inventory entries may carry quantity. Starting state is validated against board bounds, duplicate cells, storage policy, and stack caps.

```jsonc
{
  "$schema": "./arkini.schema.json",
  "startingState": {
    "board": [
      // Board cells use zero-based x/y coordinates.
      { "itemId": "producer:townhall-t1", "x": 4, "y": 3 },

      // Keep early nearby requirements safe. One tree near lumberjack is a soft-lock wearing leaves.
      { "itemId": "producer:lumberjack-t1", "x": 1, "y": 1 },
      { "itemId": "item:tree", "x": 0, "y": 1 },
      { "itemId": "item:tree", "x": 1, "y": 0 },
      { "itemId": "item:tree", "x": 2, "y": 1 }
    ],
    "inventory": [
      { "itemId": "item:twig", "quantity": 3 }
    ]
  }
}
```

## Items

Items define physical tiles/stacks. Source items omit identity fields that can be derived from the item id:

```json
{
  "name": "Lumber Camp I",
  "description": "Produces early wood resources.",
  "tier": 1,
  "tags": ["building", "wood"],
  "maxStackSize": 1,
  "effects": [
    {
      "id": "effect:path-engineers-lock",
      "name": "Engineers path lock",
      "polarity": "neutral",
      "sourceScope": "both",
      "grants": [{ "id": "grant:path:engineers-lock", "name": "Engineers path locked" }]
    }
  ],
  "maxCount": 1,
  "label": "1"
}
```

The compiler derives `assetIds` as `["asset:<itemId>"]` and synthesizes conventional item assets; `game.json` only carries asset overrides such as intentional resource reuse. Asset definitions do not carry a `kind` field; the asset id/resource id already describe the render resource, and item ownership is validated through `items.*.assetIds`. Multi-asset craft/blueprint items select an asset by delivered input progress, split evenly across the ordered asset list. Item `code` no longer exists; the item id is the single stable identity. `storage` is `board`, `inventory`, or `both`; omitted means `both`. `tier` defaults to `0`, `maxStackSize` defaults to `10`, and `tags` default to `[]`. Board-only dangers cannot be hidden in inventory. `maxCount` is a board-only cap for the final item, and craft source items such as blueprints inherit that target cap during producer output and job reservation checks. Producer buildings are authored as single-copy board items: `maxCount: 1` plus the informational `unique` tag. The cap itself still comes from `maxCount`; the tag is there so humans do not have to infer intent from numbers like we are decoding a cursed spreadsheet. `effects` on an item make that item a grant source according to each effect's `sourceScope`. Producer, stash, craft, merge, effects, and removal capabilities are embedded directly on the owning item. The item is the authoring unit: take the item and you have the behavior it owns, without asking a second registry for permission like a tiny JSON bureaucrat.

App surfaces may also consume well-known game assets from the same package. The splash screen reads `asset:game:hero`, which should point at the `hero` PNG resource. This keeps branded shell art in config space instead of hard-coding it into `src/app`, because forcing custom builds to inherit our logo would be a tiny but memorable act of software vandalism.

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

`name` may be omitted when the line name is the same as the primary output item name; the compiler derives it for the compiled package. Keep `name` only for action-style labels such as trade, prospecting, expeditions, inspired variants, or blueprint wording that differs from the item name. `placement` defaults to `board_then_inventory`. `inputs` may be omitted for free lines. `output` may be omitted for delayed sink/destructor lines. Producer output gates, visibility, availability, duration modifiers, and loot chance modifiers live directly on the affected `output` entry. The root line does not own producer-facing `effects`; the concrete output that is changed owns the rule, because apparently JSON also deserves accountability. Lines that define an embedded `effect` must not define item output, because their output is runtime influence. For blueprint-output lines, inputs should represent lightweight plan acquisition, research, survey evidence, or paperwork. Do not duplicate the same construction materials/labor inputs that the blueprint craft recipe will consume later; validation tests treat repeated blueprint planning/build costs as a balance bug.

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

Effect definitions are embedded where their source lives. Passive grant sources use `items.*.effects`; timed active grant sources use `items.*.producer.lines.*.effect` or `items.*.stash.line.effect`. There is no top-level `effects` registry and no id-ref hop between the source and the grant definition. Each effect must declare `id`, `name`, `polarity`, and at least one `{ "id", "name" }` grant. `sourceScope` is `board`, `inventory`, or `both`; omitted means board-only. Runtime logic does not infer meaning from math or labels; UI groups effects by this explicit authoring truth, because guessing intent from JSON is how software gets haunted.

```json
{
  "items": {
    "producer:house-of-engineers": {
      "effects": [
        {
          "id": "effect:path:engineers",
          "name": "Engineers path",
          "polarity": "neutral",
          "sourceScope": "both",
          "grants": [{ "id": "grant:path:engineers", "name": "Engineers path chosen" }]
        }
      ]
    },
    "producer:shrine-t1": {
      "producer": {
        "lines": [
          {
            "id": "line:shrine-t1:minor-haste",
            "name": "Minor Haste",
            "durationMs": 30000,
            "effect": {
              "id": "effect:shrine-minor-haste",
              "name": "Minor Haste",
              "polarity": "buff",
              "sourceScope": "both",
              "grants": [{ "id": "grant:active:shrine-minor-haste", "name": "Minor Haste active" }]
            }
          }
        ]
      }
    }
  }
}
```

Effects do not contain operations, targets, line selectors, or config patches. Producer outputs and craft recipes own the question “what does this grant or nearby source do to me?” in their own local `effects` arrays. Producer lines may also own start-only source capacity spending, because consuming a finite tree or rock deposit is a line admission cost, not a single-drop display rule. Grant-publishing effects are just facts in the world. Riveting stuff, but at least it stops the engine from becoming a haunted spreadsheet.

Selectors are documented in `SELECTOR.MD`. Short version: item selectors under nearby `items` fields may use authoring refs (`id`, `ids`, `tag`) that compile into resolved `ids` clauses; grant selectors use resolved `ids` clauses and test the current active grant set. Use `mode: "all"`, `anyOf`, `allOf`, and `noneOf`; do not invent selector dialects just to make future debugging more theatrical.

## Output-owned producer effects

Producer and stash product definitions no longer declare root `effects`. Every producer-facing rule belongs on the concrete `output` entry it affects, including weighted entries. Runtime evaluates the ordered `effects` from top to bottom for that one drop and returns both the rollable output state and UI explanation rows. One output can be hidden, disabled, sped up, slowed down, or given bonus chance without making its sibling outputs inherit the same rule because they had the misfortune of sharing a line.

Supported output-owned effect kinds:

```json
{ "kind": "grant.require", "phase": "visibility", "display": "always", "selector": { "allOf": [{ "id": "grant:path:engineers" }] } }
{ "kind": "grant.require", "phase": "start", "display": "always", "selector": { "allOf": [{ "id": "grant:tooling:advanced" }] } }
{ "kind": "nearby.require", "phase": "start", "display": "whenMissing", "items": { "anyOf": [{ "tag": "tree" }] }, "radius": 2 }
{ "kind": "nearby.capacity.spend", "display": "always", "items": { "anyOf": [{ "tag": "wood-source" }] }, "radius": 2, "amount": 1, "selection": "nearest" }
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

`nearby.capacity.spend` belongs on a line root, not a concrete output entry. It validates at job start, chooses the nearest matching capacity source, immediately subtracts `amount`, and can remove or replace the source when it reaches zero according to that item's `capacity.onDepleted` rule. Running jobs do not keep re-checking this spend rule after start; live proximity and duration effects still do their own normal live evaluation, because apparently one production line can contain both a ticket booth and weather.

Items may define finite source capacity:

```json
{ "capacity": { "max": 18, "onDepleted": "remove" }, "maxStackSize": 1 }
{ "capacity": { "max": 18, "onDepleted": "replace", "replaceItemId": "item:stump" }, "maxStackSize": 1 }
```

Capacity items must use `maxStackSize: 1` so partially depleted item instances do not collapse into anonymous inventory stacks. Runtime stores capacity per item instance and item detail UI shows the current `remaining/max` value.

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

Runtime time math belongs in `src/time/*`.

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
