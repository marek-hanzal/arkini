# v0 proximity requirements

Added central reusable producer/product requirement definitions in `GameConfig.requirements`.

Producer definitions and product line definitions now use `requirementIds` to reference central requirements. Producer IDs gate the whole producer; product IDs gate only the selected line. Runtime checks resolve both lists and require all referenced rules to pass.

Supported central requirement kinds now include:

- `stored`: target-owned durable item storage
- `passive`: required quantity in board/inventory scope
- `proximity`: any configured `itemIds` must be on the board near the producer tile

Proximity distance is Chebyshev grid distance:

```ts
Math.max(Math.abs(dx), Math.abs(dy))
```

So `distance: 1` includes all eight neighboring cells, diagonals included. This was explicitly chosen after user clarification.

Upgrade effects now support replacing requirement IDs:

- `producer.requirementIds.set`
- `product.requirementIds.set`

These are replace semantics, not merge semantics. Setting `requirementIds: []` removes all requirements for that target.

Runtime/UI notes:

- Producer start readiness receives the producer item instance ID so proximity can be checked from the producer tile.
- Runtime producer activation views now expose resolved requirement views on product lines.
- UI displays proximity requirements in producer/product detail cards with ready/missing state.
- `missingRequirementItemIds` intentionally does not include missing proximity items, because dragging a nearby item into the building would incorrectly route it as a stored requirement. Proximity is a spatial rule, not storage.

Content notes:

- `game/arkini/requirements.json` defines lumber camp near-tree requirements.
- `producer:lumber-camp-1` requires a nearby tree at distance 1.
- Starting board includes `item:tree` diagonally adjacent to the lumber camp to exercise diagonal radius 1.
- `upgrade:lumber-camp-1-reach` first loosens the producer requirement to distance 2, then removes it.
