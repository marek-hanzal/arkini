# 2026-07-06 — default pack refresh audit

- Root cause: gameplay source JSON/assets contained `item:cracked-rock`, magnifying glass, and depletion `replace` rules, but `game/arkini.game.arkpack` was stale.
- Runtime loads the binary arkpack, so cheat inventory and board replacement used the old compiled config.
- Recompiled `game/arkini.game.arkpack` from `game/arkini` sources.
- Added compiled default config regression coverage for rock -> cracked rock, tree -> seed, cracked rock craft, magnifying glass, and both assets.
- Added `audit:current` guard comparing default arkpack against source config so stale pack changes fail loudly next time.
