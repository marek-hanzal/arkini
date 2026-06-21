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

### First production pairs

The first package pass should focus on two simple logical production pairs.

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

### Initial balance placeholder

Use `5000` ms for all first-pass production durations. Timing balance is not the point of this phase; the point is getting the production language and data shape right before humans inevitably demand seventeen exceptions.
