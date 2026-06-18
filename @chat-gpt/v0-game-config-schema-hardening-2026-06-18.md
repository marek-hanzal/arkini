# v0 GameConfig schema hardening - 2026-06-18

Commit scope: tighten JSON game config validation before bad authoring data reaches the runtime save/engine layer.

Changes made:

- Added focused `GameConfigSchema.test.ts` coverage for starting state, queue/loot structural checks and newly hardened semantic invariants.
- Preserved existing canonical `GameConfigSchema` as the source of truth for both CLI validation and runtime parsing.
- Added uniqueness checks for `items.*.code` and `upgrades.*.code` so authoring codes cannot collide silently.
- Added validation that item definitions must point to assets with `kind: "item"`; UI assets are not valid item sprites.
- Added duplicate guards for item `mergeIds`, item `tags`, producer `productIds`, activation inputs, craft inputs and activation requirements.
- Added `capacity >= quantity` validation for product/stash activation inputs and stored requirements.
- Existing hardening still covers starting inventory slot count, starting inventory max stack size, starting board bounds and duplicate starting board cells.

Validation status for handoff:

- `npm run format:check` passed with the existing generated `game/arkini.assets.json` size warning.
- `npm run game:validate -- game/arkini` passed.
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json` passed.
- `npm run dc` passed.
- `npm run typecheck` passed.
- `npm run test` passed: 36 files / 156 tests.
- `npm run build` passed with the existing Vite large chunk warning.
- `git diff --check` passed.

Next likely quest:

- Storage/schema version migration policy: decide how Dexie save version, game config hash mismatch, dev reset and future save migrations should behave. Avoid silent save shape drift. Bad persisted saves are just config bugs with a longer memory.
