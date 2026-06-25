# 2026-06-25 construction material asset prep

## Scope
Prepared a construction-material expansion as config assets/items only. No production process, craft recipes, Town Hall unlocks, producer product lines, inputs, loot tables, or requirements were connected in this pass.

## Added item assets
- `item-nails.png`
- `item-clay.png`
- `item-bricks.png`
- `item-roof-tiles.png`
- `item-sand.png`
- `item-glass.png`

## Added building assets
- `producer-clay-pit.png`
- `producer-brickyard.png`
- `producer-roof-tile-factory.png`
- `producer-glassworks.png`

## Added items
- `item:nails`
- `item:clay`
- `item:bricks`
- `item:roof-tiles`
- `item:sand`
- `item:glass`

## Added prepared building items
These are intentionally not wired with `producerId` yet.

- `producer:clay-pit`
- `producer:brickyard`
- `producer:roof-tile-factory`
- `producer:glassworks`

## Added prepared blueprint items
These are intentionally not wired with `craftRecipeId` yet.

- `item:blueprint-clay-pit`
- `item:blueprint-brickyard`
- `item:blueprint-roof-tile-factory`
- `item:blueprint-glassworks`

## Next gameplay pass
- Add extraction/production flow:
  - Clay Pit -> Clay
  - Brickyard -> Bricks
  - Roof Tile Factory -> Roof Tiles
  - Glassworks -> Glass
- Decide where sand comes from.
- Add building craft recipes and Town Hall / knowledge gates.
- Decide whether nails come from Blacksmith or another construction chain.
