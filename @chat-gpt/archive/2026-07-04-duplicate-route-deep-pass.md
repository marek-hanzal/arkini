# 2026-07-04 Duplicate route deep pass

Scope: continued quality/refactor pass after route-map cleanup. Focused on semantic duplicate routes where the same guard/result/wake behavior existed in several places, plus long orchestration flows that made path tracking mentally expensive.

Completed commits:

- `ed199abc Centralize engine result wake assembly`
  - Added `createGameEngineResultFx` for the repeated `{ save, events, nextWakeAtMs }` route.
  - Replaced the first batch of duplicated wake assembly paths in board, inventory, cheat, debug, producer, and craft input flows.
- `4d25e999 Unify inventory stack expectation checks`
  - Added `readExpectedInventorySlotStack`.
  - Reused it across inventory cell drop, inventory slot drop, and runtime drop dispatch, so stale stack validation has one route.
- `406fae53 Unify board item expectation checks`
  - Added `readExpectedBoardViewItem`.
  - Reused it across board cell drop, runtime drop dispatch, board item activation, and board tile model sheet-open guard.
- `f74c5f83 Split producer line start flow`
  - Split `startLineFx` into explicit Fx phases using `LineStartExecutionScopeFx`: explicit input refs, autofill/stored-input consume, queued start scheduling, active-effect creation, job insertion, and event assembly.
- `ca2f27b2 Share activation input withdraw placement`
  - Added `placeWithdrawnActivationInputFx` to centralize the identical producer/craft input-withdraw placement and failure wrapping route.
- `729533f7 Split world wake route assembly`
  - Split `readWorldWakePlanFx` into item-spawn, producer-queue, active-effect, and craft-job wake reason builders.
- `6080a020 Use shared engine result assembly`
  - Replaced more duplicated wake/result assembly in craft, stash, set-default, remove, merge, inventory placement, and debug spawn flows.

Important notes:

- `createGameEngineResultFx` is the preferred route for game mutations that need to return a `GameEngineResult` with a recomputed wake plan. Avoid reintroducing local `readNextWakeAtMsFx` return blocks unless a flow truly has a special wake contract.
- `readExpectedInventorySlotStack` and `readExpectedBoardViewItem` should be used for stale UI drag/drop guards. Do not add fresh ad-hoc `bySlotIndex`/`byId` expected-id checks in drop or runtime UI dispatch paths.
- `startLineFx` is still a large file, but its main exported function is now a small orchestration wrapper and the individual steps are named Fx phases. Future work can decide whether to split helper phases into separate files if ownership stays clear.

Validation performed:

- `npm run format:check`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run audit:optional`
- `npm run build`

The only game validation warnings were the expected limited-deposit softlock warnings for `item:double-tree`, `item:micro-forest`, `item:rock`, and `item:tree`.
