# Duplicate route continuation pass - 2026-07-04

Started from `cef04fb2` and continued the deep cleanup of duplicate routes, long orchestration bodies, and hidden parallel paths.

## Changes

- Shared stored input withdrawal mutation/event emission through `withdrawCraftStoredInputFx` and `withdrawProducerStoredInputFx`.
- Split item spawn job processing into seed, placement, retryable block, permanent failure, and success routes.
- Split item spawn batch processing into explicit due-job, dependency/exclusive skip, blocked retry, and completed-result steps.
- Added `placeBoardItemInstanceFx` as the single board item placement mutation + `item.created` event path, reused by generic placement and inventory-to-board placement.
- Split debug item spawning into request resolution, board/inventory routes, and result assembly. Debug board spawn now uses shared board item placement mutation.
- Shared inventory stack capacity calculation through `readInventoryStackCapacityFx` and reused it from inventory placement readiness, stash readiness, and debug spawn readiness.
- Split board item stash execution into explicit preserve-instance vs stack-copy modes.
- Split debug spawn readiness into config/storage, board capacity, simulated board reservation, and inventory capacity routes.

## Verification

- `npm run format:check`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `timeout 240s npm run test`

Expected limited-deposit warnings remain for `item:double-tree`, `item:micro-forest`, `item:rock`, and `item:tree`.
