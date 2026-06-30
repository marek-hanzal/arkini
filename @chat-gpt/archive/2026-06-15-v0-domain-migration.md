# v0 domain migration - 2026-06-15

Continued the v0 migration by cutting active runtime imports away from legacy root modules. v0 is now intended to be self-contained and should only import assets from the root asset folder.

Moved or recreated in v0:

- item UI components and item display logic under `src/v0/item`.
- upgrade card UI under `src/v0/upgrade/ui`.
- sheet/status/style utilities under concrete v0 domains instead of root `shared`.
- hard reset as `hardResetBrowserStorageFx` plus `useHardResetMutation`, replacing the old local reset hook.
- action errors and visual action result schemas under `src/v0/play/action`, removing active v0 dependence on legacy `src/command`.
- active view/schema/type models for board, inventory, item, upgrade, activation, craft, item-instance, and play inputs.
- active Effect service tags/live providers for date, id, hash, random, game config, and database runtime.
- active manifest/config and database/local implementation under v0.
- board/inventory/activation/craft/upgrade/merge logic currently needed by v0 effects and surfaces.

Validation guards now pass with no non-v0 imports in `src/v0` except `~/assets`, which stays intentionally shared as static bundled content.

Checked:

- `npm run format`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- grep for legacy imports from `src/v0`
