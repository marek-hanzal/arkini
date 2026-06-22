# Arkini authored game package

This folder is the source package for the current Arkini game configuration. JSON files here are authored source data; compiled root outputs are generated from this package.

## Current gameplay draft

This is a working design note for the current package, kept next to the data it describes. It is not the global gameplay contract. When the package changes, update this note with the current content direction instead of letting the source JSON turn into folklore with braces.

### Core loop direction

The current gameplay direction is producer-driven rather than merge-chain-driven.

- Producers are the main magic: they generate and transform useful items.
- Merge should be used mostly where merging is logical or abstract, such as coins, energy/lightning, or recipe discovery.
- Avoid fake material merge chains such as `twig + twig -> bigger twig` unless there is a strong gameplay reason.
- Low-level materials are plain semantic items. A log is `item:log`, not `item:log-t1`.
- Upgrade tiers belong primarily to producers/buildings and their product lines, not to ordinary resources.

### Movement and storage default

Everything is movable and storable by default unless a concrete mechanic says otherwise.

- Default storage policy should be `both`.
- Board proximity only counts things currently placed on the board.
- Items in inventory do not satisfy board proximity requirements.
- Source items like `tree` and `rock` are normal movable/storable items, not permanent terrain.
- Board-only restrictions are reserved for explicit danger/blocker mechanics, such as future fire, fog, enemies, or other hazards.

### Current compatibility note

The current config schema still stores every placeable board tile in the `items` table. Producer tiles therefore appear in `items.json` with `producer:*` IDs and a matching `producerId` field.

This is intentional for this package pass:

- do not create `item:lumberjack-t1` / `item:sawmill-t1` style producer aliases
- keep the real producer identity as `producer:<name>-t<tier>`
- treat the `items.json` entry as the current placeable tile shell required by the config contract
- do not change runtime/schema just to clean this up during gameplay data authoring

Yes, it is slightly weird. It is also contained, explicit, and better than quietly teaching the content layer that every building is secretly a log with ambitions.


### Townhall blueprint progression

Townhall is the civic blueprint vendor and progression spine. The starting board is intentionally small: it contains Town Hall I, one lumberjack/tree pair, one quarry/rock pair, one well, and one wheat field. The player first learns to run producers, feed Town Hall for a concrete blueprint, place that blueprint on the board, feed its craft inputs, and complete it into a real building. Tiny tutorial loop, fewer spreadsheets wearing clown shoes.

Blueprints are concrete from the moment they enter gameplay. There is no blank blueprint and no imprint/bind action. A blueprint is a craft target: it accepts its build resources on the board and completes into its configured building. Construction resources such as planks and stone blocks live in the blueprint craft recipe, not in the Town Hall purchase cost.

Townhall tiers are authored as separate producer buildings:

```txt
producer:townhall-t1  Starter settlement blueprints
producer:townhall-t2  Food-chain blueprints
producer:townhall-t3  Heavy industry and cleanup blueprints
producer:townhall-t4  Coin-economy specialist blueprints
```

Townhall tier progression is a one-way era gate. Crafting the next Town Hall consumes the current Town Hall tier and requires ownership of every physical building/place unlocked by the current era. Ownership is checked with passive `board_or_inventory` requirements, so the player may keep those buildings on the board or store them in inventory. The goal is to prove the era was actually built, not to force the player to stage an inspection parade on the board like some tiny bureaucratic nightmare.

Higher Town Hall tiers do not re-issue lower-era blueprints. If the player wants duplicate lower-era infrastructure, they should build it before moving to the next era. Missing duplicates should slow later economy, not soft-lock progression.

Townhall products use era-proof inputs, while blueprint craft recipes use construction inputs:

```txt
Town Hall I
  Log -> Lumberjack I Blueprint
  Log -> Sawmill I Blueprint
  Stone -> Quarry I Blueprint
  Stone -> Stonemason I Blueprint
  Water -> Well I Blueprint
  Water -> Farm I Blueprint
  Grain -> Town Hall II Blueprint

Town Hall II
  Grain -> Windmill I Blueprint
  Flour -> Bakery I Blueprint
  Grain + Water -> Pig Farm I Blueprint
  Piglet -> Slaughterhouse I Blueprint
  Grain + Water -> Brewery I Blueprint
  Beer Barrel -> Tavern I Blueprint
  Grain + Water -> Winery I Blueprint
  Grain + Water -> Hop Field
  Grain + Water -> Vineyard
  Bread + Beer + Sausage -> Town Hall III Blueprint

Town Hall III
  Bread + Water -> Coal Deposit
  Bread + Water -> Coal Mine I Blueprint
  Sausage + Beer -> Iron Deposit
  Sausage + Beer -> Iron Mine I Blueprint
  Coal + Water -> Smelter I Blueprint
  Pollution -> Purifier I Blueprint
  Bread + Wine Glass -> Gold Deposit
  Bread + Wine Glass -> Gold Mine I Blueprint
  Iron Ingot + Gold Ingot -> Town Hall IV Blueprint

Town Hall IV
  Gold Ingot -> Goldsmith I Blueprint
```

### Implemented first wave

The package currently contains wood, stone, food, brewing, wine, heavy industry, cleanup, and basic coin economy production lines.

Wood pair:

```txt
item:tree
item:log
item:plank
producer:lumberjack-t1
producer:sawmill-t1
proximity:lumberjack-t1:tree
proximity:sawmill-t1:lumberjack-t1
product:lumberjack-t1:log
product:sawmill-t1:plank
input:sawmill-t1:log
loot:lumberjack-t1:log
loot:sawmill-t1:plank
```

Stone pair:

```txt
item:rock
item:stone
item:stone-block
producer:quarry-t1
producer:stonemason-t1
proximity:quarry-t1:rock
proximity:stonemason-t1:quarry-t1
product:quarry-t1:stone
product:stonemason-t1:stone-block
input:stonemason-t1:stone
loot:quarry-t1:stone
loot:stonemason-t1:stone-block
```

Food line:

```txt
item:wheat-field
item:water
item:grain
item:flour
item:bread
item:piglet
item:sausage
item:leather
producer:well-t1
producer:farm-t1
producer:windmill-t1
producer:bakery-t1
producer:pig-farm-t1
producer:slaughterhouse-t1
proximity:farm-t1:wheat-field
product:well-t1:water
product:farm-t1:grain
product:windmill-t1:flour
product:bakery-t1:bread
product:pig-farm-t1:piglet
product:slaughterhouse-t1:sausage-leather
input:farm-t1:water
input:windmill-t1:grain
input:bakery-t1:flour-water
input:pig-farm-t1:grain-water
input:slaughterhouse-t1:piglet
loot:well-t1:water
loot:farm-t1:grain
loot:windmill-t1:flour
loot:bakery-t1:bread
loot:pig-farm-t1:piglet
loot:slaughterhouse-t1:sausage-leather
```

### Initial balance placeholder

Most first-pass production durations stay at `5000` ms. The new food processors are slightly longer on purpose: windmill flour takes `6000` ms, while bakery bread and slaughterhouse sausage/leather take `8000` ms. Timing balance is still placeholder territory; the point is getting the production language and data shape right before humans inevitably demand seventeen exceptions.

Farm grain and pig-farm piglet production have product-level pollution blockers: nearby `item:pollution` within proximity `2` slows those product lines. Brewery now has a producer-level pollution blocker with proximity `2`, and winery has a producer-level pollution blocker with proximity `3`, so every production line on those buildings reacts to nearby pollution. Tiny ecological disaster, very charming.

Current processor input buffers use capacity `4`:

- `input:sawmill-t1:log`
- `input:stonemason-t1:stone`
- `input:farm-t1:water`
- `input:windmill-t1:grain`
- `input:bakery-t1:flour-water`
- `input:pig-farm-t1:grain-water`
- `input:slaughterhouse-t1:piglet`
- `input:brewery-t1:water`
- `input:brewery-t1:hops-water`
- `input:brewery-t1:beer-to-barrel`
- `input:tavern-t1:beer-barrel`
- `input:tavern-t1:wine-barrel`
- `input:winery-t1:water`
- `input:winery-t1:grapes-water`
- `input:winery-t1:wine-glass-to-barrel`

### Asset alignment and current art gaps

Current gameplay definitions now point to dedicated asset IDs and dedicated PNG filenames when possible.

Runtime asset note: the app runtime consumes the compiled `game/arkini.assets.json` resource package. Do not mirror authored PNGs into `src/assets`; `game/arkini/assets` is the source input and `game/arkini.assets.json` is the runtime output.

Current first-wave asset IDs:

- `asset:item:tree` -> `game/arkini/assets/item-tree.png`
- `asset:item:rock` -> `game/arkini/assets/item-rock.png`
- `asset:item:log` -> `game/arkini/assets/item-log.png`
- `asset:item:plank` -> `game/arkini/assets/item-plank.png`
- `asset:item:stone` -> `game/arkini/assets/item-stone.png`
- `asset:item:stone-block` -> `game/arkini/assets/item-stone-block.png`
- `asset:producer:lumberjack-t1` -> `game/arkini/assets/producer-lumberjack-t1.png`
- `asset:producer:sawmill-t1` -> `game/arkini/assets/producer-sawmill-t1.png`
- `asset:producer:quarry-t1` -> `game/arkini/assets/producer-quarry-t1.png`
- `asset:producer:stonemason-t1` -> `game/arkini/assets/producer-stonemason-t1.png`

Current PNG coverage status:

- `item:tree`, `item:rock`, `item:log`, `item:plank`, `item:stone`, `item:stone-block`, `producer:lumberjack-t1`, `producer:sawmill-t1`, `producer:quarry-t1`, and `producer:stonemason-t1` all have usable dedicated PNG coverage.

Current first-wave art gaps:

- none

### Food line asset IDs

The first food production line is wired into gameplay and uses these prepared asset IDs:

- `asset:item:wheat-field` -> `game/arkini/assets/item-wheat-field.png`
- `asset:producer:farm-t1` -> `game/arkini/assets/producer-farm-t1.png`
- `asset:item:grain` -> `game/arkini/assets/item-grain.png`
- `asset:producer:windmill-t1` -> `game/arkini/assets/producer-windmill-t1.png`
- `asset:item:flour` -> `game/arkini/assets/item-flour.png`
- `asset:producer:bakery-t1` -> `game/arkini/assets/producer-bakery-t1.png`
- `asset:item:bread` -> `game/arkini/assets/item-bread.png`
- `asset:producer:pig-farm-t1` -> `game/arkini/assets/producer-pig-farm-t1.png`
- `asset:item:piglet` -> `game/arkini/assets/item-piglet.png`
- `asset:producer:slaughterhouse-t1` -> `game/arkini/assets/producer-slaughterhouse-t1.png`
- `asset:item:sausage` -> `game/arkini/assets/item-sausage.png`
- `asset:item:leather` -> `game/arkini/assets/item-leather.png`
- `asset:producer:well-t1` -> `game/arkini/assets/producer-well-t1.png`
- `asset:item:water` -> `game/arkini/assets/item-water.png`

### Brewing and wine asset IDs

The brewing and wine production waves are wired into gameplay JSON. Wine content is not placed onto the starting board; use cheat inventory to spawn and test it.

Brewing asset IDs:

- `asset:item:hop-field` -> `game/arkini/assets/item-hop-field.png`
- `asset:item:hops` -> `game/arkini/assets/item-hops.png`
- `asset:producer:brewery-t1` -> `game/arkini/assets/producer-brewery-t1.png`
- `asset:item:beer-barrel` -> `game/arkini/assets/item-beer-barrel.png`
- `asset:producer:tavern-t1` -> `game/arkini/assets/producer-tavern-t1.png`
- `asset:item:beer` already exists from the base item set

Wine asset IDs:

- `asset:item:vineyard` -> `game/arkini/assets/item-vineyard.png`
- `asset:item:grapes` -> `game/arkini/assets/item-grapes.png`
- `asset:producer:winery-t1` -> `game/arkini/assets/producer-winery-t1.png`
- `asset:item:wine-barrel` -> `game/arkini/assets/item-wine-barrel.png`
- `asset:item:wine-glass` -> `game/arkini/assets/item-wine-glass.png`

### Wine chain and updated brewing flow

The wine chain is authored but not placed onto the starting board. Use cheat inventory to spawn these items/producers during testing.

Brewing now works in two producer steps:

```txt
producer:brewery-t1
  Water -> Hops
  Hops + Water -> Beer Barrel
  4 Beer -> Beer Barrel

producer:tavern-t1
  Beer Barrel -> 4 Beer
```

Wine mirrors the same shape:

```txt
producer:winery-t1
  Water -> Grapes
  Grapes + Water -> Wine Barrel
  4 Wine Glass -> Wine Barrel

producer:tavern-t1
  Wine Barrel -> 4 Wine Glass
```

Passive proximity sources:

```txt
proximity:brewery-t1:hop-field
proximity:winery-t1:vineyard
```

### Staged mining and smelting assets

The mining / smelting consumer wave now has prepared art assets, but it is not wired into gameplay JSON yet.

Prepared producer asset IDs:

- `asset:producer:coal-mine-t1` -> `game/arkini/assets/producer-coal-mine-t1.png`
- `asset:producer:gold-mine-t1` -> `game/arkini/assets/producer-gold-mine-t1.png`
- `asset:producer:iron-mine-t1` -> `game/arkini/assets/producer-iron-mine-t1.png`
- `asset:producer:smelter-t1` -> `game/arkini/assets/producer-smelter-t1.png`
- `asset:producer:purifier-t1` -> `game/arkini/assets/producer-purifier-t1.png`

Prepared item asset IDs:

- `asset:item:coal` -> `game/arkini/assets/item-coal.png` (updated to the new mine-cart art)
- `asset:item:gold-ore` -> `game/arkini/assets/item-gold-ore.png`
- `asset:item:iron-ore` -> `game/arkini/assets/item-iron-ore.png`
- `asset:item:iron-ingot` -> `game/arkini/assets/item-iron-ingot.png`
- `asset:item:gold-ingot` -> `game/arkini/assets/item-gold-ingot.png`
- `asset:item:pollution` -> `game/arkini/assets/item-pollution.png`
- `asset:item:coal-deposit` -> `game/arkini/assets/item-coal-deposit.png`
- `asset:item:iron-deposit` -> `game/arkini/assets/item-iron-deposit.png`
- `asset:item:gold-deposit` -> `game/arkini/assets/item-gold-deposit.png`
- `asset:item:hops` -> `game/arkini/assets/item-hops.png` (refreshed with the improved hop illustration)

### Heavy industry gameplay

Heavy industry is authored but not placed onto the starting board. Use cheat inventory to spawn and test it.

`item:sausage` is now produced by the slaughterhouse branch of the food chain instead of being a placeholder. Good, the economy no longer pretends sausages grow in config comments.

Mining producers consume tavern/food outputs, require nearby deposits just like lumberjacks require trees, and create mine-cart resources:

```txt
producer:coal-mine-t1
  requires nearby Coal Deposit
  Bread + Water -> Coal Cart

producer:iron-mine-t1
  requires nearby Iron Deposit
  Sausage + Beer -> Iron Ore Cart

producer:gold-mine-t1
  requires nearby Gold Deposit
  Bread + Wine Glass -> Gold Ore Cart
```

The smelter consumes ore, coal fuel, and water for every ingot. Worker provisions stay in the mines; the furnace gets actual fuel and cooling because apparently metallurgy is not catering.

```txt
producer:smelter-t1
  Iron Ore Cart + Coal Cart + Water -> Iron Ingot + Pollution
  Gold Ore Cart + 2 Coal Cart + Water -> Gold Ingot + Pollution
```

The purifier is a delayed sink for board-only pollution. It intentionally has no output table; the product consumes pollution and finishes without spawning anything. It has a single-cleanup line plus a bulk quality-of-life line:

```txt
producer:purifier-t1
  1 Pollution -> nothing
  4 Pollution -> nothing
```

Heavy industry asset IDs:

- `asset:producer:coal-mine-t1` -> `game/arkini/assets/producer-coal-mine-t1.png`
- `asset:producer:iron-mine-t1` -> `game/arkini/assets/producer-iron-mine-t1.png`
- `asset:producer:gold-mine-t1` -> `game/arkini/assets/producer-gold-mine-t1.png`
- `asset:producer:smelter-t1` -> `game/arkini/assets/producer-smelter-t1.png`
- `asset:producer:purifier-t1` -> `game/arkini/assets/producer-purifier-t1.png`
- `asset:item:coal` -> `game/arkini/assets/item-coal.png`
- `asset:item:iron-ore` -> `game/arkini/assets/item-iron-ore.png`
- `asset:item:gold-ore` -> `game/arkini/assets/item-gold-ore.png`
- `asset:item:iron-ingot` -> `game/arkini/assets/item-iron-ingot.png`
- `asset:item:gold-ingot` -> `game/arkini/assets/item-gold-ingot.png`
- `asset:item:pollution` -> `game/arkini/assets/item-pollution.png`
- `asset:item:coal-deposit` -> `game/arkini/assets/item-coal-deposit.png`
- `asset:item:iron-deposit` -> `game/arkini/assets/item-iron-deposit.png`
- `asset:item:gold-deposit` -> `game/arkini/assets/item-gold-deposit.png`
- `asset:producer:goldsmith-t1` -> `game/arkini/assets/producer-goldsmith-t1.png`
- `asset:item:coin` -> `game/arkini/assets/item-coin.png`

### Coin economy gameplay

The goldsmith turns refined gold plus late food/wine comfort and coal fuel into raw currency. It is authored as a simple producer, not a merge chain, because apparently even medieval capitalism needs a tiny furnace, a snack break, and actual gold. Wild concept.

```txt
producer:goldsmith-t1
  Gold Ingot + Wine Glass + Bread + Coal Cart -> 4 Coin
```

This currently introduces `item:coin` as the first playable currency item. Higher coin merge tiers already have asset slots prepared, but this pass intentionally wires only the basic coin output.

