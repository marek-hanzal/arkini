# Board race and input cleanup fixes

Date: 2026-06-23  
Status: DONE

## User correction

The old audit recommendation to lock DnD for running producers is intentionally obsolete. Producers may move on the board while running because movement is board-only and producer jobs/state are keyed by item instance, not by fixed cell. Do not reintroduce a broad busy-producer DnD lock unless the interaction model changes.

## Completed

- Serialized runtime mutations in `RuntimeGameEngineAdapter` so `dispatch`, `tick`, and `replaceSave` cannot commit stale full-save results over each other.
- Added regression tests for concurrent independent board moves and `replaceSave` after an in-flight dispatch.
- Fixed `removeBoardItemRuntimeState` to remove `producerInputs` in addition to stashes, stash inputs, producer line state, craft input state, stored requirements, producer jobs, and craft jobs.
- Made board input consumption call runtime-state cleanup after deleting the board item.
- Made board input ref resolution reject board items with busy or preservable runtime state as consumable inputs. Movement is still allowed; consumption as an input is not.
- Replaced producer/craft/stash auto-fill planner duplication with one shared `planActivationInputRefsFx` in the requirements domain.
- The shared auto-fill planner skips non-consumable board candidates and continues to inventory instead of selecting a poisoned board candidate and exploding the action.
- Extracted one runtime activation input availability reader for producer, craft, and stash views so UI availability follows the same consumability policy.
- Cleared transient visual stores on runtime save replacement and store destroy.
- Fixed TileEngine dependency-cruiser rule drift by importing motion store functions through the public `~/v0/tile-engine` barrel.

## Checks

- `npm run format:check` passed with the existing generated `game/arkini.assets.json` size warning.
- `npm run game:validate -- game/arkini` passed with the existing `item:leather` terminal-item warning.
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json` passed with the same warning.
- `npm run dc` passed.
- `npm run typecheck` passed.
- `npm run test -- --pool=threads --fileParallelism=false` passed: 58 files, 314 tests.
- `npm run build` passed with the existing Vite large chunk warning.

## Watchouts

- `readiness` is still a non-mutating snapshot read. It may be stale while queued mutations are pending, but actual `dispatch` runs against the newest committed save and remains authoritative.
- Visual stores are global and are now cleared on runtime reset/destroy. Do not clear them on ordinary gameplay updates, or normal motion effects will be killed early.
- Board movement of running/stateful producers remains allowed by design. Board consumption of busy/stateful/preservable input candidates is blocked.
