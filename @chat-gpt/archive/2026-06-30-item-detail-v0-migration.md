# Item detail v0 migration

Moved the current item detail surface from temporary `src/v1/item-detail` into `src/v0/item-detail`.

Notes:
- `src/v1` was removed; current detail UI/control/logic now lives under the normal v0 tree.
- `src/v0/item/ItemSheet.tsx` remains the live runtime/action bridge into `src/v0/item-detail/ItemDetailSheet`.
- Detail-specific `craftStatusLabel` moved from `src/v0/item/logic` into `src/v0/item-detail/logic` so old item/detail leftovers are not split across feature folders.
- `src/v0/item` now only keeps generic item rendering/view-schema pieces plus the sheet entry bridge.
- Do not recreate temporary `src/v1` detail code unless we intentionally open a new isolated experiment.
