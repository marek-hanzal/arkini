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
- Board-only restrictions are reserved for explicit danger/effect mechanics, such as future fire, fog, enemies, pollution, or other hazards.

### Capability ownership

Every placeable board tile lives in `items.json`. If that tile can produce, store, or craft, the capability definition is keyed by the same item id in `producers.json`, `stashes.json`, or `craft-recipes.json`. Items do not carry `producerId`, `stashId`, or `craftRecipeId`. Source items also omit derived `assetId`: the compiler derives it from the item id and synthesizes conventional assets. Item `code` no longer exists; the item id is the single stable identity. `assets.json` is only for overrides, such as one producer deliberately reusing another producer image. Asset overrides do not carry `kind`; asset ownership and rendering are already implied by the item `assetId`, asset id, render mode, and resource id. One owner id is enough; making the config repeat itself was paperwork wearing fake architecture glasses. Omit boring product names when they equal the primary output item name, omit quantity `1` in source inputs/outputs, and omit blueprint craft `resultItemId` when it is derived from the blueprint id.

Producer building item ids intentionally use the `producer:<name>-t<tier>` shape because those ids are the stable item/capability identity used by saves, effects, and UI. Do not create alias items like `item:lumberjack-t1` unless the gameplay model truly needs a separate item.


### Townhall blueprint progression

Townhall is the civic blueprint vendor and progression spine. The starting board is intentionally small: it contains Town Hall I, one lumberjack/tree pair, one quarry/rock pair, and one well. The player first learns to run producers, feed Town Hall for a concrete blueprint, place that blueprint on the board, feed its craft inputs, and complete it into a real building. Tiny tutorial loop, fewer spreadsheets wearing clown shoes.

Blueprints are concrete from the moment they enter gameplay. There is no blank blueprint and no imprint/bind action. A blueprint is a craft target: it accepts its build resources on the board and completes into its configured building. Construction resources such as planks and stone blocks live in the blueprint craft recipe, not in the Town Hall purchase cost.

Townhall tiers are authored as separate producer buildings:

```txt
producer:townhall-t1  Era I construction foundation blueprints
producer:townhall-t2  Era II raw food and livestock blueprints
producer:townhall-t3  Era III food processing and first trade blueprints
producer:townhall-t4  Era IV civic administration, Market II, Era V textile/clothing, and Prospector Guild 1
producer:civic-office  Era IV permits, Academy blueprint bridge, and Era IX Guild Charter
producer:academy      Era VII mining expansion, Era VIII dirty-processing/material plans, and Era IX smith/armory/goldsmith/university blueprints
producer:university   Era IX Master Knowledge / Heroes Guild blueprint, Era X prestige plans, House IV, and Choose The Path blueprints
```

Townhall tier progression is a one-way era gate. Crafting the next Town Hall consumes the current Town Hall tier and requires ownership of every physical building/place unlocked by the current era. Ownership is checked with passive `board_or_inventory` requirements, so the player may keep those buildings on the board or store them in inventory. The goal is to prove the era was actually built, not to force the player to stage an inspection parade on the board like some tiny bureaucratic nightmare.

Higher Town Hall tiers do not re-issue lower-era blueprints. If the player wants duplicate lower-era infrastructure, they should build it before moving to the next era. Missing duplicates should slow later economy, not soft-lock progression.

Townhall products use era-proof inputs, while blueprint craft recipes use construction inputs. Current era spine:

```txt
Town Hall I
  Log -> Lumberjack I Blueprint
  Log -> Sawmill I Blueprint
  Stone -> Quarry I Blueprint
  Stone -> Stonemason I Blueprint
  Water -> Well I Blueprint
  Plank + Stone Block + Water -> Town Hall II Blueprint

Town Hall II
  Grain -> Wheat Field
  Grain -> Farm I Blueprint
  Grain + Water -> Pig Farm I Blueprint
  Milk + Grain -> Cattle Farm I Blueprint
  Egg + Grain -> Chicken Coop I Blueprint
  Wool + Grain -> Sheep Pasture I Blueprint
  Vegetables + Water -> Vegetable Garden I Blueprint
  Grain + Piglet + Milk + Egg + Vegetables -> Food Supply
  Food Supply + Water -> House I Blueprint
  Food Supply + Wool + Plank + Stone Block + Morale I -> Town Hall III Blueprint

Town Hall III
  Grain + Plank -> Windmill I Blueprint
  Flour + Stone Block -> Bakery I Blueprint
  Piglet + Plank -> Slaughterhouse I Blueprint
  Milk + Plank -> Dairy I Blueprint
  Vegetables + Plank + Stone Block -> Cookhouse I Blueprint
  Grain + Water -> Hop Field
  Grain + Water + Plank -> Brewery I Blueprint
  Beer Barrel + Plank -> Tavern I Blueprint
  Grain + Water -> Vineyard
  Grain + Water + Plank -> Winery I Blueprint
  Bread + Sausage + Plank -> Market Blueprint
  Bread + Beer + Coin -> House II Blueprint
  Feast + 2 Coin + Plank + Stone Block + Morale II + Morale I -> Town Hall IV Blueprint

Town Hall IV
  Coin + Water + Plank -> Paper Mill I Blueprint
  Paper + Coin -> School Blueprint
  Basic Knowledge + Paper + Coin -> Civic Office I Blueprint
  Building Permit + Feast + 2 Coin -> Market II Blueprint
  Building Permit + Basic Knowledge + 2 Coin -> Prospector Guild 1 Blueprint
  Building Permit + Raw Hide + Paper -> Tannery I Blueprint
  Building Permit + Wool + Paper -> Weaver Hut I Blueprint
  Building Permit + Common Cloth + Vegetables + Paper -> Dye Workshop I Blueprint
  Building Permit + Common Cloth + Leather + Paper -> Tailor Workshop I Blueprint
  Building Permit + Common Clothing + Feast + Coin -> House III Blueprint

Civic Office I
  Paper + Basic Knowledge + Coin -> Building Permit
  Building Permit + Basic Knowledge + Paper + Luxury Clothing + Coin -> Academy Blueprint

Academy
  Paper + Coin -> Basic Knowledge
  Basic Knowledge + Paper + Coin -> Advanced Knowledge
  Advanced Knowledge + Building Permit + Paper + Coin -> Prospector Guild 2 Blueprint
  Advanced Knowledge + Building Permit + Paper + Coin -> Mine Blueprints
  Advanced Knowledge + Coal + Water + Coin -> Purifier I Blueprint
  Advanced Knowledge + Coal/Clay/Sand/Charcoal + Building Permit + Coin -> dirty processing blueprints
  Guild Charter + Construction Bundle + ingots/materials -> smith, armory, goldsmith, and university blueprints
  Master Knowledge + Guild Charter + Construction Bundle -> Heroes Guild Blueprint
  Master Knowledge + Marble Block + Stained Glass + Coin Stack -> House IV Blueprint

Prospector Guild 1
  Building Permit + Basic Knowledge + Coin -> Clay Deposit
  Building Permit + Basic Knowledge + Coin -> Sand Deposit

Prospector Guild 2
  Building Permit + Basic Knowledge + Coin -> Clay Deposit
  Building Permit + Basic Knowledge + Coin -> Sand Deposit
  Advanced Knowledge + Building Permit + Coin -> Coal Deposit
  Advanced Knowledge + Building Permit + Coin -> Iron Deposit
  Advanced Knowledge + Building Permit + Coin -> Gold Deposit
```

Market is a tiered trade building line. Market I starts first trade in Era III; Market II is a new Era IV building upgrade with stronger trade options, civic-era possibilities, and later luxury/textile trades.

### Implemented first wave

The package currently contains wood, stone, raw food, food processing, brewing, wine, early trade, civic administration, permits, housing morale, prospecting, an improved Market II trade step, Era V textile/clothing production with Pigment, Era VII mining through Academy-driven Prospector Guild 2 plans, Era VIII dirty processing / advanced construction materials, Era IX guild institutions / equipment / expeditions, and Era X prestige glass/marble materials. The old “all heavy industry at once” blob has been split because apparently pacing is healthier than throwing every furnace at the player like a drunk civil engineer.

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
product inputs live inline on `product:sawmill-t1:plank`
outputs live inline on the product lines
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
product inputs live inline on `product:stonemason-t1:stone-block`
outputs live inline on the product lines
```

Food and trade lines:

```txt
Era II raw food
  Well -> Water
  Wheat Field + Farm I + Water -> Grain
  Pig Farm I + Grain + Water -> Piglet
  Cattle Farm I + Grain + Water -> Milk
  Chicken Coop I + Grain + Water -> Egg
  Sheep Pasture I + Grain + Water -> Wool
  Vegetable Garden I + Water -> Vegetables
  Town Hall II -> Food Supply
  House I + Water + Log -> Morale I

Era III processing
  Windmill I + Grain -> Flour
  Bakery I + Flour + Water -> Bread
  Slaughterhouse I + Piglet -> Sausage + Raw Hide
  Dairy I + Milk -> Cheese
  Cookhouse I + Bread + Sausage + Cheese + Vegetables + Egg -> Feast
  Brewery I + Water near Hop Field -> Hops
  Brewery I + Hops + Water -> Beer Barrel
  Tavern I + Beer Barrel -> Beer
  Winery I + Water near Vineyard -> Grapes
  Winery I + Grapes + Water -> Wine Barrel
  Tavern I + Wine Barrel -> Wine Glass
  Market I + processed food/drink -> Coin
  House II + Bread + Water + Coin -> Morale II + Morale I

Era IV civic administration
  Paper Mill I + Plank + Water -> Paper
  School + Paper + Coin -> Basic Knowledge
  Civic Office I + Paper + Basic Knowledge + Coin -> Building Permit
  Market II + Paper -> Coin
  Market II + Feast -> more Coin
  Prospector Guild 1 + Building Permit + Basic Knowledge + Coin -> Clay Deposit
  Prospector Guild 1 + Building Permit + Basic Knowledge + Coin -> Sand Deposit

Era V textile and clothing
  Slaughterhouse I + Piglet -> Sausage + Raw Hide
  Tannery I + Raw Hide + Water -> Leather
  Weaver Hut I + Wool -> Common Cloth
  Dye Workshop I + Common Cloth + Vegetables + Water -> Luxury Cloth
  Tailor Workshop I + Common Cloth + Leather -> Common Clothing
  Tailor Workshop I + Luxury Cloth + Leather + Coin -> Luxury Clothing
  Market II + Common Clothing -> Coin
  Market II + Luxury Clothing -> more Coin
  House III + Common Clothing + Feast + Beer + Coin -> Morale III + Morale II + Morale I
Era VII mining expansion
  Civic Office I + Building Permit + Basic Knowledge + Paper + Luxury Clothing + Coin -> Academy Blueprint
  Academy + Basic Knowledge + Paper + Coin -> Advanced Knowledge
  Academy + Advanced Knowledge + Building Permit + Paper + Coin -> Prospector Guild 2 Blueprint
  Prospector Guild 2 + Advanced Knowledge + Building Permit + Coin -> Coal Deposit
  Prospector Guild 2 + Advanced Knowledge + Building Permit + Coin -> Iron Deposit
  Prospector Guild 2 + Advanced Knowledge + Building Permit + Coin -> Gold Deposit
  Academy + Advanced Knowledge + Building Permit + Paper + Coin -> Mine Blueprints
  Mines + crew supplies + nearby deposit -> Coal / Iron Ore / Gold Ore
  Gold Ore is the current Era VII master output.

Era VIII dirty processing and advanced construction materials
  Academy + Coal + Water + Advanced Knowledge -> Purifier I Blueprint
  Purifier I must be owned and nearby before dirty product lines run.
  Charcoal Burner I + Log + nearby Purifier -> Charcoal + random Pollution
  Clay Pit + Water + nearby Clay Deposit -> Clay
  Sand Pit + nearby Sand Deposit -> Sand
  Brickyard + Clay + Charcoal + Water + nearby Purifier -> Bricks + random Pollution
  Glassworks + Sand + Charcoal + nearby Purifier -> Glass + random Pollution
  Roof Tile Factory + Clay + Charcoal + Water + nearby Purifier -> Roof Tiles + random Pollution
  Smelter + Ore + Coal + Water + nearby Purifier -> Ingot + random Pollution
  Purifier + Pollution + Water + Charcoal -> nothing
  Construction Yard I + Bricks + Glass + Roof Tiles + Gold Ingot + Building Permit + Luxury Clothing -> Construction Bundle
  Construction Bundle is the Era VIII master output.

Era IX guild institutions, equipment, keys, and expeditions
  Civic Office I + Construction Bundle + Advanced Knowledge + Building Permit + Luxury Clothing + Coin -> Guild Charter
  Academy + Guild Charter + Construction Bundle + ingots/materials -> Blacksmith / Armory / Goldsmith / University blueprints
  University + Master Knowledge + Guild Charter + Construction Bundle -> Heroes Guild Blueprint
  Blacksmith I + Iron Ingot + Charcoal + nearby Purifier -> Nails / Axe / Sword + random Pollution
  Armory I + Leather + Common Clothing + Nails -> Leather Armor
  Armory I + Leather Armor + Iron Ingot + Nails + Charcoal + nearby Purifier -> Iron Armor + random Pollution
  Goldsmith I + Gold Ingot + Charcoal + nearby Purifier -> Coin Stack + random Pollution
  Goldsmith I + Gold Ingot + Iron/Gems + Charcoal + nearby Purifier -> Key I-IV + random Pollution
  University + Advanced Knowledge + Paper + Glass + Coin Stack -> Master Knowledge
  Heroes Guild I + gear + food + luxury + keys + knowledge -> Chests and Treasure Chest
  Treasure Chest is the current Era IX master output.

Era X prestige construction materials
  Dye Workshop I + Vegetables + Water -> Pigment
  Dye Workshop I + Common Cloth + Pigment + Water -> Luxury Cloth
  University + Master Knowledge + Guild Charter + Glass + Pigment + Coin Stack -> Glazier Workshop I Blueprint
  Glazier Workshop I + Construction Bundle + Guild Charter + Glass + Bricks + Roof Tiles + Master Knowledge + Coin Stack -> Glazier Workshop I
  Glazier Workshop I + Glass + Pigment + Charcoal + Water + nearby Glassworks + nearby Purifier -> Stained Glass + random Pollution
  Prospector Guild 2 + Master Knowledge + Guild Charter + Building Permit + Coin Stack -> Marble Deposit
  University + Master Knowledge + Guild Charter + advanced materials -> Quarry 2 / Stonemason 2 blueprints
  Quarry 2 near Marble Deposit -> Stone / Marble
  Stonemason 2 near Quarry 2 -> Stone Block / Marble Block
  House IV + Luxury Clothing + Feast + Wine Glass + Coin Stack -> Morale IV + Morale III + Morale II + Morale I
  Stained Glass and Marble Block are the current Era X prestige construction outputs.
```

### Initial balance placeholder

Most first-pass production durations stay in the `5000` to `9000` ms range. Windmill flour takes `6000` ms, bakery bread and slaughterhouse sausage/raw-hide and tannery leather take `8000` ms, dairy cheese takes `7000` ms, cookhouse feast takes `9000` ms, and market trades are intentionally short conversions. Timing balance is still placeholder territory; the point is getting the production language and data shape right before humans inevitably demand seventeen exceptions.

Pollution is authored as passive local effects on `item:pollution`, not as producer/product-specific hindrance config. Nearby pollution applies separate product-scoped `duration.proximityPenalty` effects: radius `2` slows configured farm/animal/vegetable/brewery product lines, radius `3` slows winery product lines, multiple pollution tiles stack, and closer tiles hurt more. Tiny ecological disaster, now without a duplicate subsystem. Very touching.

Current processor input buffers use capacity `4`:

- `input:sawmill-t1:log`
- `input:stonemason-t1:stone`
- `input:farm-t1:water`
- `input:windmill-t1:grain`
- `input:bakery-t1:flour-water`
- `input:pig-farm-t1:grain-water`
- `input:slaughterhouse-t1:piglet`
- `input:tannery-t1:leather`
- `input:weaver-hut-t1:common-cloth`
- `input:dye-workshop-t1:luxury-cloth`
- `input:tailor-workshop-t1:common-clothing`
- `input:tailor-workshop-t1:luxury-clothing`
- `input:brewery-t1:water`
- `input:brewery-t1:hops-water`
- `input:brewery-t1:beer-to-barrel`
- `input:tavern-t1:beer-barrel`
- `input:tavern-t1:wine-barrel`
- `input:winery-t1:water`
- `input:winery-t1:grapes-water`
- `input:winery-t1:wine-glass-to-barrel`
- `input:dairy-t1:milk`
- `input:cookhouse-t1:feast`
- `input:market-t1:coin-from-bread`
- `input:market-t1:coin-from-sausage`
- `input:market-t1:coin-from-cheese`
- `input:market-t1:coin-from-beer`
- `input:market-t1:coin-from-wine-glass`
- `input:market-t1:coin-from-feast`
- `input:paper-mill-t1:paper`
- `input:school:basic-knowledge`
- `input:civic-office-t1:building-permit`
- `input:market-t2:coin-from-paper`
- `input:market-t2:coin-from-feast`
- `input:market-t2:coin-from-common-clothing`
- `input:market-t2:coin-from-luxury-clothing`
- `input:prospector-guild-t1:clay-deposit`
- `input:prospector-guild-t1:sand-deposit`
- `input:prospector-guild-t2:clay-deposit`
- `input:prospector-guild-t2:sand-deposit`
- `input:prospector-guild-t2:coal-deposit`
- `input:prospector-guild-t2:iron-deposit`
- `input:prospector-guild-t2:gold-deposit`
- `input:prospector-guild-t2:marble-deposit`
- `input:charcoal-burner-t1:charcoal`
- `input:clay-pit:clay`
- `input:brickyard:bricks`
- `input:glassworks:glass`
- `input:roof-tile-factory:roof-tiles`
- `input:construction-yard-t1:construction-bundle`
- `input:stonemason-t2:stone-block`
- `input:stonemason-t2:marble-block`

### Era V textile asset IDs

The textile and clothing pass adds dedicated 128x128 transparent PNG coverage for all new textile producers and products:

- `asset:producer:tannery-t1` -> `game/arkini/assets/producer-tannery-t1.png`
- `asset:producer:weaver-hut-t1` -> `game/arkini/assets/producer-weaver-hut-t1.png`
- `asset:producer:dye-workshop-t1` -> `game/arkini/assets/producer-dye-workshop-t1.png`
- `asset:producer:tailor-workshop-t1` -> `game/arkini/assets/producer-tailor-workshop-t1.png`
- `asset:item:raw-hide` -> `game/arkini/assets/item-raw-hide.png`
- `asset:item:common-cloth` -> `game/arkini/assets/item-common-cloth.png`
- `asset:item:luxury-cloth` -> `game/arkini/assets/item-luxury-cloth.png`
- `asset:item:common-clothing` -> `game/arkini/assets/item-common-clothing.png`
- `asset:item:luxury-clothing` -> `game/arkini/assets/item-luxury-clothing.png`

`Pigment` is now produced by Dye Workshop from vegetables and water, then reused by both `Luxury Cloth` and later stained-glass work. `Luxury Clothing` remains the current Era V master item. It is also sellable through Market II so the chain stays useful before the next era consumes it.

### Era VIII advanced construction / dirty processing asset IDs

The dirty processing / advanced construction pass uses the existing dedicated 128x128 transparent PNG coverage for the charcoal and construction-yard pieces:

- `asset:producer:charcoal-burner-t1` -> `game/arkini/assets/producer-charcoal-burner-t1.png`
- `asset:producer:construction-yard-t1` -> `game/arkini/assets/producer-construction-yard-t1.png`
- `asset:item:charcoal` -> `game/arkini/assets/item-charcoal.png`
- `asset:item:construction-bundle` -> `game/arkini/assets/item-construction-bundle.png`

Existing prepared construction assets are now connected into Era VIII: Clay Pit, Sand Pit, Brickyard, Glassworks, Roof Tile Factory, Clay, Sand, Bricks, Glass, and Roof Tiles.

`Construction Bundle` is the Era VIII master item and becomes the material base for later advanced civic/guild buildings.

### Era X prestige construction material asset IDs

The prestige construction pass adds dedicated 128x128 transparent PNGs for guild paperwork, pigment, stained glass, marble, and the prestige producers:

- `asset:item:guild-charter` -> `game/arkini/assets/item-guild-charter.png`
- `asset:item:pigment` -> `game/arkini/assets/item-pigment.png`
- `asset:item:stained-glass` -> `game/arkini/assets/item-stained-glass.png`
- `asset:producer:glazier-workshop-t1` -> `game/arkini/assets/producer-glazier-workshop-t1.png`
- `asset:item:marble-deposit` -> `game/arkini/assets/item-marble-deposit.png`
- `asset:item:marble` -> `game/arkini/assets/item-marble.png`
- `asset:item:marble-block` -> `game/arkini/assets/item-marble-block.png`
- `asset:producer:quarry-t2` -> `game/arkini/assets/producer-quarry-t2.png`
- `asset:producer:stonemason-t2` -> `game/arkini/assets/producer-stonemason-t2.png`

`Stained Glass` and `Marble Block` are currently terminal Era X prestige construction outputs. Future high-civic buildings should consume them instead of pretending a university, observatory, or guild palace is just a heroic pile of planks with branding.

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
- `asset:item:milk` -> `game/arkini/assets/item-milk.png`
- `asset:item:egg` -> `game/arkini/assets/item-egg.png`
- `asset:item:wool` -> `game/arkini/assets/item-wool.png`
- `asset:item:vegetables` -> `game/arkini/assets/item-vegetables.png`
- `asset:item:food-supply` -> `game/arkini/assets/item-food-supply.png`
- `asset:producer:cattle-farm-t1` -> `game/arkini/assets/producer-cattle-farm-t1.png`
- `asset:producer:chicken-coop-t1` -> `game/arkini/assets/producer-chicken-coop-t1.png`
- `asset:producer:sheep-pasture-t1` -> `game/arkini/assets/producer-sheep-pasture-t1.png`
- `asset:producer:vegetable-garden-t1` -> `game/arkini/assets/producer-vegetable-garden-t1.png`
- `asset:item:cheese` -> `game/arkini/assets/item-cheese.png`
- `asset:item:feast` -> `game/arkini/assets/item-feast.png`
- `asset:producer:dairy-t1` -> `game/arkini/assets/producer-dairy-t1.png`
- `asset:producer:cookhouse-t1` -> `game/arkini/assets/producer-cookhouse-t1.png`
- `asset:producer:market-t1` -> `game/arkini/assets/producer-market-t1.png`
- `asset:item:coin` -> `game/arkini/assets/item-coin.png`
- `asset:item:paper` -> `game/arkini/assets/item-paper.png`
- `asset:item:building-permit` -> `game/arkini/assets/item-building-permit.png`
- `asset:producer:paper-mill-t1` -> `game/arkini/assets/producer-paper-mill-t1.png`
- `asset:producer:civic-office-t1` -> `game/arkini/assets/producer-civic-office-t1.png`
- `asset:producer:prospector-guild-t1` -> `game/arkini/assets/producer-prospector-guild-t1.png`
- `asset:producer:prospector-guild-t2` -> `game/arkini/assets/producer-prospector-guild-t1.png`
- `asset:producer:market-t2` -> `game/arkini/assets/producer-market-t2.png`

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

### Mining and dirty industry gameplay

Mining is now the focused Era VII progression through Academy and Prospector Guild 2. Dirty processing is the following Era VIII layer: Purifier comes first, and any coal/charcoal product line must run near it and may emit board-only pollution. Tiny OSHA, but with worse paperwork.

`item:sausage` is now produced by the slaughterhouse branch of the food chain instead of being a placeholder. Good, the economy no longer pretends sausages grow in config comments.

Mining producers consume tavern/food outputs, require nearby deposits just like lumberjacks require trees, and create mine-cart resources:

```txt
producer:coal-mine-t1
  requires nearby Coal Deposit
  Bread + Water + Common Clothing -> Coal Cart

producer:iron-mine-t1
  requires nearby Iron Deposit
  Sausage + Beer + Common Clothing -> Iron Ore Cart

producer:gold-mine-t1
  requires nearby Gold Deposit
  Bread + Wine Glass + Luxury Clothing -> Gold Ore Cart
```

The smelter consumes ore, coal fuel, and water for every ingot. It requires nearby Purifier support and emits pollution through chance side outputs instead of guaranteed soot every single run. Worker provisions stay in the mines; the furnace gets actual fuel and cooling because apparently metallurgy is not catering.

```txt
producer:smelter-t1
  Iron Ore Cart + Coal Cart + Water + nearby Purifier -> Iron Ingot + random Pollution
  Gold Ore Cart + 2 Coal Cart + Water + nearby Purifier -> Gold Ingot + random Pollution
```

The purifier is an early required sink for board-only pollution. Its product lines intentionally define no `output`; the product consumes pollution and finishes without spawning anything. It has a single-cleanup line plus a bulk quality-of-life line:

```txt
producer:purifier-t1
  1 Pollution + Water + Charcoal -> nothing
  4 Pollution + 4 Water + 2 Charcoal -> nothing
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
- `asset:item:paper` -> `game/arkini/assets/item-paper.png`
- `asset:item:building-permit` -> `game/arkini/assets/item-building-permit.png`
- `asset:producer:paper-mill-t1` -> `game/arkini/assets/producer-paper-mill-t1.png`
- `asset:producer:civic-office-t1` -> `game/arkini/assets/producer-civic-office-t1.png`
- `asset:producer:prospector-guild-t1` -> `game/arkini/assets/producer-prospector-guild-t1.png`
- `asset:producer:prospector-guild-t2` -> `game/arkini/assets/producer-prospector-guild-t1.png`
- `asset:producer:market-t2` -> `game/arkini/assets/producer-market-t2.png`

### Coin economy gameplay

The goldsmith turns refined gold plus late food/wine comfort and coal fuel into raw currency. It is authored as a simple producer, not a merge chain, because apparently even medieval capitalism needs a tiny furnace, a snack break, and actual gold. Wild concept.

```txt
producer:goldsmith-t1
  Gold Ingot + Wine Glass + Bread + Coal Cart -> 4 Coin
  Gold Ingot + 3 Coin -> Key III
```

This currently introduces `item:coin` as the first playable currency item and gives the goldsmith the first non-cheat key hook. Higher coin merge tiers already have asset slots prepared, but this pass intentionally wires only the basic coin output.

### Heroes guild expedition loop

Heroes Guild I is prepared late-era content but is not connected to the current townhall progression. When it comes back, it should remain a producer with long product lines: the player pays coins plus food/drink supplies, waits for the hero expedition, and receives exactly one locked chest. Lower expedition tiers have a small weighted chance to upgrade the returned chest by one tier.

```txt
future late-era blueprint source
  8 Coin -> Heroes Guild I Blueprint

craft:heroes-guild-t1
  4 Plank + 4 Stone Block + 2 Gold Ingot + 8 Coin
  requires owning Goldsmith I
  -> Heroes Guild I

producer:heroes-guild-t1
  1 Coin + Beer + Bread -> Chest I, 10% chance Chest II instead, 2 min
  2 Coin + Beer Barrel + Sausage -> Chest II, 10% chance Chest III instead, 3 min
  4 Coin + 2 Wine Glass + Sausage + Bread -> Chest III, 10% chance Chest IV instead, 5 min
  8 Coin + Wine Barrel + Beer Barrel + 2 Sausage + 2 Bread -> Chest IV, 10 min
```

Guild chests are finite stashes. Each chest tier requires a matching Key tier as an open-time input, consumes that key, releases its loot, and then removes itself. Chest clicks auto-fill the matching key from board/inventory when available; if the key is missing, the chest opens its detail instead of throwing an action error. Key III is currently produced by Goldsmith I from a Gold Ingot plus 3 Coin. Other key tiers are intentionally cheat-only placeholders for now; all four key tiers already have dedicated key art.

Guild branch asset IDs:

- `asset:producer:heroes-guild-t1` -> `game/arkini/assets/producer-heroes-guild-t1.png`
- `asset:item:blueprint-heroes-guild-t1` -> blueprint render over the guild asset
- `asset:item:chest-t1` -> `game/arkini/assets/item-chest-t1.png`
- `asset:item:chest-t2` -> `game/arkini/assets/item-chest-t2.png`
- `asset:item:chest-t3` -> `game/arkini/assets/item-chest-t3.png`
- `asset:item:chest-t4` -> `game/arkini/assets/item-chest-t4.png`
- `asset:item:key-t1` -> `game/arkini/assets/item-key-t1.png`
- `asset:item:key-t2` -> `game/arkini/assets/item-key-t2.png`
- `asset:item:key-t3` -> `game/arkini/assets/item-key-t3.png`
- `asset:item:key-t4` -> `game/arkini/assets/item-key-t4.png`


### Housing morale side economy

Housing is a parallel morale subsystem layered on top of the core producer economy. Houses consume comfort goods from the era where they appear and produce morale tokens. Morale is intentionally not required for ordinary production lines; base lines stay available. Where morale appears in producer products, it is authored as a duplicate boosted line with better output/speed. Where morale appears in crafts, it is reserved for bigger civic upgrades and prestige buildings, because even a tiny city should occasionally ask whether its people are miserable before building another giant marble ego box.

```txt
House I  + Water + Log -> Morale I
House II + Bread + Water + Coin -> Morale II + Morale I
House III + Common Clothing + Feast + Beer + Coin -> Morale III + Morale II + Morale I
House IV + Luxury Clothing + Feast + Wine Glass + Coin Stack -> Morale IV + Morale III + Morale II + Morale I

Morale boosted examples:
  Farm I + Water + Morale I -> 2 Grain
  Bakery I + Flour + Water + Morale I -> 2 Bread
  School + Paper + Coin + Morale II -> 2 Basic Knowledge
  Construction Yard I + materials + Morale III -> 2 Construction Bundle
  Glazier Workshop I + materials + Morale IV -> 2 Stained Glass + random Pollution
```

Housing asset IDs:

- `asset:producer:house-t1` -> `game/arkini/assets/producer-house-t1.png`
- `asset:producer:house-t2` -> `game/arkini/assets/producer-house-t2.png`
- `asset:producer:house-t3` -> `game/arkini/assets/producer-house-t3.png`
- `asset:producer:house-t4` -> `game/arkini/assets/producer-house-t4.png`
- `asset:item:morale-t1` -> `game/arkini/assets/item-morale-t1.png`
- `asset:item:morale-t2` -> `game/arkini/assets/item-morale-t2.png`
- `asset:item:morale-t3` -> `game/arkini/assets/item-morale-t3.png`
- `asset:item:morale-t4` -> `game/arkini/assets/item-morale-t4.png`

### Era XI Choose The Path keystones

Era XI starts as a commitment gate, not a full branch yet. University can now issue one of three mutually exclusive path blueprints after the player has reached guild, treasure, and prestige-construction infrastructure.

```txt
University
  Master Knowledge + Guild Charter + Treasure Chest + prestige materials + branch-flavored inputs
  -> House of Engineers Blueprint / Cathedral Blueprint / Mage Lodge Blueprint
```

The actual keystone buildings emit passive global path-lock effects. Owning any one of them blocks University from producing the two counter-path blueprints through `line.blockStart` and also blocks creation of the counter-path blueprints/buildings through `item.blockCreate`. There is no separate item-level exclusivity mechanic. Later branch-specific product lines should be baseline-hidden and revealed by path effects emitted from the chosen keystone building.

```txt
producer:house-of-engineers blocks Cathedral/Mage Lodge blueprint products and creation of Cathedral/Mage Lodge blueprints/buildings
producer:cathedral blocks House of Engineers/Mage Lodge blueprint products and creation of House of Engineers/Mage Lodge blueprints/buildings
producer:mage-lodge blocks House of Engineers/Cathedral blueprint products and creation of House of Engineers/Cathedral blueprints/buildings
```

The branches are intentionally only keystone buildings for now. Unconnected Energy/Power Plant placeholder content is not present in live config; add it back only when Engineers actually use it. Follow-up eras should give branches passive path effects that reveal branch-tagged product lines:

```txt
Engineers -> machines, energy, power upgrades, Pollution pressure
Faith -> order, cleansing, protection, Corruption pressure
Mages -> rune/mana/arcane science, Void pressure
```

Choose The Path asset IDs:

- `asset:producer:house-of-engineers` -> `game/arkini/assets/producer-house-of-engineers.png`
- `asset:producer:cathedral` -> `game/arkini/assets/producer-cathedral.png`
- `asset:producer:mage-lodge` -> `game/arkini/assets/producer-mage-lodge.png`
- `asset:item:blueprint-house-of-engineers` -> blueprint render over House of Engineers
- `asset:item:blueprint-cathedral` -> blueprint render over Cathedral
- `asset:item:blueprint-mage-lodge` -> blueprint render over Mage Lodge


### Runtime effect source scope

Passive effects can choose where their source item counts through `sourceScope`: `board`, `inventory`, or `both`. The Choose The Path keystone locks use `both`, so storing the chosen keystone does not accidentally reopen counter-path blueprints. Global effects work from inventory; local effects must be board-sourced because inventory has no board position for distance.
