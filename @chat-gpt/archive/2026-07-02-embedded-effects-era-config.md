# Embedded effects and era config split

Completed a production-grade cleanup pass after embedded item capabilities.

- Removed authored `effects.json`; grant-source effects now live on the owning item as `items.*.effects` or on the owning active line as `line.effect`.
- Removed top-level compiled `effects` and all `passiveEffectIds` / `activatesEffectId` source references from active config/runtime code.
- Split Arkini source config into `game/arkini/game.json` plus `era-I.json` through `era-XI.json`; removed standalone `items.json`, `assets.json`, `version.json`, and `starting-state.json` authoring files.
- `game.json` now owns `version`, `game`, `startingState`, asset overrides, and global utility/no-era items.
- Compiler merges source fragments, derives conventional item assets, normalizes embedded line/drop selectors, and emits the compiled immutable `game/arkini.game.json` + `game/arkini.assets.json`.
- Runtime reads passive effect facts from concrete item definitions and active effect facts from concrete line definitions. Test fixtures use item-owned effect sources, not detached effect registries.

Do not reintroduce detached one-off registries for effect sources, items, assets, starting state, producer lines, stash lines, craft recipes, or merge rules. Source config should stay item-centric and era-sliced for authoring sanity.
