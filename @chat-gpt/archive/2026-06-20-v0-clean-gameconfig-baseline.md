# V0 clean GameConfig baseline

Completed 2026-06-20.

- Cleared gameplay source data under `game/arkini`: items, merge rules, inputs, requirements, producers, products, loot tables, stashes, craft recipes, upgrades, and starting state.
- Kept package metadata and visual asset definitions/resources so the next gameplay pass can rebuild content from scratch without losing PNG work.
- Removed the broken Epic Key asset from `game/arkini/assets.json`, `game/arkini/assets/item-epic-key.png`, and `src/assets/item-epic-key.png`.
- Recompiled `game/arkini.game.json` and `game/arkini.assets.json`; current compiled package has 0 items and 38 resources.
- Moved merge-rule tests that used the mutable default gameplay config onto a dedicated test config helper, so tests no longer depend on authored game content.
