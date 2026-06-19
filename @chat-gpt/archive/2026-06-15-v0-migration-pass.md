# v0 Migration Pass - 2026-06-15

This pass continued the v0 migration after the hygiene audit.

## What changed

- Split large manifest config blobs into domain data chunks:
  - `manifest/config/asset/*`
  - `manifest/config/item/*`
  - `manifest/config/loot-table/*`
- Split `GameConfigSchema` into standalone schema files:
  - `AssetDefinitionSchema`
  - `ResourceDefinitionSchema`
  - `LootTableDefinitionSchema`
  - `UpgradeDefinitionSchema`
  - `ItemDefinitionSchema`
  - `StartingStateDefinitionSchema`
  - `GameMetaDefinitionSchema`
- Fixed manifest asset parsing so blueprint-only fields are preserved:
  - `overlayAssetId`
  - `render`
- Removed `src/v0/style` and moved its tiny helpers into actual domains:
  - `ui/cn`
  - `time/formatMs`
  - `serialization/json`
  - `serialization/parseJson`
- Moved placement writes out of `play/fx` into `placement/fx`.
- Deleted the unused `applyInventoryPlacementPlanFx` helper.
- Moved non-Fx runtime helpers out of Fx folders:
  - bootstrap DB helper into `database/bootstrap`
  - bootstrap mutable state into `play/bootstrap`
  - DB handle type into `database/model`
  - game action promise wrapper into `play/action/tryGameActionFx`
- Converted item catalog view creation into an Effect root, `createItemCatalogViewFx`.
- Split activation validation and visual event creation out of `activateBoardItemFx`:
  - `assertActivationStoredInputsFx`
  - `createActivationVisualEventsFx`

## Hygiene checks

- Active v0 still has no app-owned React context.
- Active v0 still uses Suspense queries, not plain `useQuery`.
- Active v0 still has no `getQueryData` reads.
- Active v0 still has no `switch` statements.
- Active v0 still does not import root/legacy code except assets.

## Watch list

- Manifest item and loot data files are intentionally data-heavy, but now split into topical chunks.
- `runGameFx` remains an async React Query bridge, not an Effect root. It is allowed as boundary plumbing only.
- Further work should continue shrinking large domain Fx by extracting concrete sub-Fx, not by creating a new central router.
