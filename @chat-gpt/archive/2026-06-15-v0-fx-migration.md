# v0 Fx migration - 2026-06-15

Active v0 query and action hooks now call Fx roots from `src/v0/**/fx` instead of importing legacy root domain effects from `src/**/fx`.

Migrated into v0:

- `src/v0/board/fx`: board read/move/swap/merge/insert roots.
- `src/v0/inventory/fx`: inventory read/place/stash/swap/spend roots.
- `src/v0/activation/fx`: activation/producer/stash roots used by board item actions.
- `src/v0/craft/fx`: craft claim/input roots.
- `src/v0/upgrade/fx`: upgrade buy/list/complete roots.
- `src/v0/database/fx`: db helpers and database status read roots.
- `src/v0/play/fx`: bootstrap/save/config/runtime roots.
- `src/v0/item/fx`: item catalog read root and catalog shaping helper.
- `src/v0/item-instance/fx`: item instance row readers.

Naming rule applied: v0 Fx roots use explicit action/read names at the file/export boundary, such as `moveBoardItemFx`, `swapInventorySlotsFx`, `readBoardViewFx`, and `readDatabaseStatusFx`. The old generic names such as `moveFx`, `swapFx`, and `readViewFx` are still present in legacy root folders, but active v0 imports no longer use them.

Boundary rule:

- Query options call `runGameFx({ effect: someReadFx() })`.
- Mutation hooks call `runGameFx({ effect: someActionFx(input) })`.
- Tagged/typed Effect failures continue to leave the mutation/query as `unknown`, so UI code does not lie that everything is a generic `Error`.
- React Query cache patch helpers stay plain because they are client cache operations, not server-like gameplay roots.

Still intentionally not migrated in this pass:

- Legacy Zod schemas and compatibility command result types.
- Pure deterministic helpers such as board/inventory planning, view rebuilding, and item config shaping when they are not async/domain boundaries.
- Shared UI components used by v0 sheets/cards.

Next migration slice should move v0-facing view schemas/types and pure domain helpers into v0 domains where it removes root legacy imports without creating another fake `shared` trash pile.
