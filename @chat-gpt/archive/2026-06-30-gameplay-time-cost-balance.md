# Gameplay timing and conversion balance pass

Status: DONE

Commit: `f927877 Balance gameplay timings and yields`

## What changed

- Replaced universal 1s product/craft placeholder timings with authored gameplay durations across all Arkini products and blueprint construction recipes.
- Early gathering stays quick, processing is slower, civic/knowledge work is slower again, construction scales by era, and guild/prestige projects take the longest.
- Broke obvious 1:1 conversion loops where a more believable ratio exists:
  - Log -> multiple Planks with bonus chance.
  - 2 Stone -> 1 Stone Block.
  - Water/raw gatherers can produce small bonus yields.
  - Grain/Flour/Bread, Wool/Cloth/Clothing, Raw Hide/Leather, Clay/Bricks/Roof Tiles, Sand/Glass, Ore/Ingot chains now have stronger batch ratios.
- Market, mine, smelter, knowledge, and expedition lines got distinct durations and more differentiated outputs/costs.
- Added a default config regression test rejecting any shipped product/craft still using 1000ms placeholder timing.

## Rationale

The game should feel like a small economy, not a vending machine that swaps one icon for one icon every second. Source yields and processing ratios are data-level balance choices. Runtime should not infer economy math.
