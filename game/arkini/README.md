# Arkini authored game package

This folder is the source package for the current Arkini game configuration. JSON files here are authored source data; compiled root outputs are generated from this package.

## Current gameplay draft

This is a working design note for the current package, kept next to the data it describes. It is not the global gameplay contract. When the package changes, update this note with the current content direction instead of letting the source JSON turn into folklore with braces.

### Core loop direction

The current gameplay direction is producer-driven rather than merge-chain-driven.

- Producers are the main magic: they generate and transform useful items.
- Merge should be used mostly where merging is logical or abstract, such as coins, energy/lightning, blueprint fragments, or recipe discovery.
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

### Implemented first wave

The package currently contains two simple logical production pairs plus a first food line.

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
item:piglet
producer:well-t1
producer:farm-t1
producer:pig-farm-t1
proximity:farm-t1:wheat-field
product:well-t1:water
product:farm-t1:grain
product:pig-farm-t1:piglet
input:farm-t1:water
input:pig-farm-t1:grain-water
loot:well-t1:water
loot:farm-t1:grain
loot:pig-farm-t1:piglet
```

### Initial balance placeholder

Use `5000` ms for all first-pass production durations, including the food line. Timing balance is not the point of this phase; the point is getting the production language and data shape right before humans inevitably demand seventeen exceptions.

Current processor input buffers use capacity `4`:

- `input:sawmill-t1:log`
- `input:stonemason-t1:stone`
- `input:farm-t1:water`
- `input:pig-farm-t1:grain-water`

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
- `asset:producer:pig-farm-t1` -> `game/arkini/assets/producer-pig-farm-t1.png`
- `asset:item:piglet` -> `game/arkini/assets/item-piglet.png`
- `asset:producer:well-t1` -> `game/arkini/assets/producer-well-t1.png`
- `asset:item:water` -> `game/arkini/assets/item-water.png`

### Brewing production assets

The brewing / tavern production wave is wired into gameplay JSON.

Prepared asset IDs:

- `asset:item:hop-field` -> `game/arkini/assets/item-hop-field.png`
- `asset:producer:brewery-t1` -> `game/arkini/assets/producer-brewery-t1.png`
- `asset:item:beer-barrel` -> `game/arkini/assets/item-beer-barrel.png`
- `asset:producer:tavern-t1` -> `game/arkini/assets/producer-tavern-t1.png`

Existing beer output art already exists as `asset:item:beer`.

Brewing pair:

```txt
item:hop-field
item:beer-barrel
item:beer
producer:brewery-t1
producer:tavern-t1
proximity:brewery-t1:hop-field
product:brewery-t1:beer-barrel
product:tavern-t1:beer
input:brewery-t1:water
input:tavern-t1:beer-barrel
loot:brewery-t1:beer-barrel
loot:tavern-t1:beer
```

Tavern output note: one `item:beer-barrel` produces four `item:beer` outputs. This keeps the tavern as a serving splitter instead of another generic one-in-one-out box, because apparently even JSON deserves a social life.
