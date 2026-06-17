# v0 producer/product line follow-up

Status: PLANNED
Created: 2026-06-17

## Context

The JSON package schema now separates producer activation from product lines:

- `producers.*.productIds` defines ordered production lines.
- `products.*.inputs` defines consumed/stored line inputs.
- `products.*.requirements` defines per-line requirements.
- `producers.*.requirements` defines producer-level requirements.
- `stashes.*.requirements` defines stash/container-level requirements.
- `items.*.removeBy` defines generic tile removal tools, not producer behavior.

Runtime still uses the legacy TS manifest. This note is for the later loader/runtime migration, not for the current schema-only data pass.

## Production line runtime rules

When a producer is activated/fed, available product lines are evaluated in the producer's `productIds` order. If multiple product lines need the same input item, fill/start the first enabled line first. This top-to-bottom rule is intentional and must stay boring; hidden priority systems are just bugs with stationery.

A producer may already have production running while the player feeds it again. Feeding should be allowed to stage/start another line when its requirements and inputs are satisfied. Runtime state therefore needs to represent product line state independently from the producer tile itself.

Each product line has its own `durationMs`. The old producer-level cooldown is gone from the canonical JSON model. Speed/loot upgrades must target product lines, not producer tiles.

Product lines may have no output table. That is valid and represents a delayed sink/destruction process, e.g. a shredder that consumes inputs and produces nothing. Different shredder levels can expose different product lines by pointing different producer items at different product ids.

## Requirements

Requirements are not one thing anymore, because otherwise the model turns into soup:

- `stored` requirement: item must be placed/stored on the target producer/product/stash. It is not the consumed input itself.
- `passive` requirement: item must exist in the selected scope, currently `board`, `inventory`, or `board_or_inventory`; omitted scope means runtime should treat it as `board_or_inventory` unless the schema later makes this explicit.

Producer-level requirements gate the whole producer. Product-level requirements gate only that line. Stash requirements gate whether the stash can be opened, beside any consumed inputs such as keys.

## Manual line toggles

Runtime should eventually allow disabling a production line on a producer tile. This solves conflicts when two lines share inputs but the player wants to feed a later line. This is player/save state, not static config. Do not add `enabled` flags to the JSON package unless we explicitly need default enabled/disabled authored content later.

## Generic tile removal

`removeBy` belongs on the item/tile definition, not on producers or products.

Example shape:

```json
{
	"items": {
		"item:tree": {
			"removeBy": [
				{
					"itemId": "item:axe",
					"mode": "keep"
				}
			]
		}
	}
}
```

When `mode` is `keep`, the tool item returns to its original position after removing the target tile. When `mode` is `consume`, the tool item is consumed. Removal is a board/tile interaction rule and must not be implemented as a fake producer line. Please do not make the tree run a manufacturing process called “being chopped”, we are troubled enough already.
