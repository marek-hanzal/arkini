# Root domain layout cleanup

Completed the cleanup that removes the stale `src/v0` namespace and dissolves the overloaded `src/game/*` tree into root owning domains.

## Changes

- Removed `src/v0`; active runtime code now lives directly under `src/*`.
- Kept `<root>/game` as the authoring config package. The browser/default config still imports the compiled root JSON through `src/config/compiled/defaultGameConfig.ts`.
- Removed `src/game`; former subdomains now live under the owning root domains:
  - `game/action` -> `src/action`
  - `game/config` + `game/compiled` -> `src/config` / `src/config/compiled`
  - `game/engine` -> `src/engine`
  - `game/event` -> `src/event`
  - `game/world` -> `src/world`
  - board/inventory runtime helpers moved into `src/board/logic` and `src/inventory/logic` beside their UI/view models.
  - craft/producer/merge/stash/remove/placement/effects/job/loot/limit/save/storage/etc. moved into matching root domains.
- Updated imports from `~/v0/*` and `~/game/*` to root-domain aliases.
- Renamed the default Dexie database name from `arkini-v0-game-storage` to `arkini-game-storage` as part of removing the version namespace. This is a deliberate no-legacy cleanup, not a compatibility shim.
- Updated dependency-cruiser boundaries so TileEngine remains generic and gameplay domains still cannot import UI/play/runtime infrastructure.
- Updated README/source-layout documentation and layer tests for the new root-domain layout.

## Verification

- `npm run format`
- `npm run game:validate -- game/arkini`
- `npm run typecheck`
- `npm run dc`
- `npm run test`

Known warning remains the existing Biome max-size warning for `game/arkini.assets.json`.
