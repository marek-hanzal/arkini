# V0 complexity scan

Status: archived scan note from the current cleanup block.

## Areas with high mental load

1. `GameSaveSchema` mixed save shape definitions with almost 1k lines of cross-save/config validation. The complexity is legitimate because save/config invariants are central, but mixing schema shape and validation flow made the entry file too expensive to scan.
2. `GameConfigSchema` is still large. A lot of the complexity is legitimate because config validation is a central gate. Do not split behavior blindly; prefer domain extraction while preserving public exports.
3. TileEngine pointer/motion runtime remains complex. This is partly inherent because pointer capture, motion requests, DOM measurement, and animation sequencing are genuinely stateful UI mechanics.
4. Capability matrix is design-sensitive. Existing config intentionally combines roles on some items, so validation needs an explicit approved matrix before code changes.
5. Scheduled event policy is still conceptually heavy. Need a policy decision before deleting or simplifying it.

## Completed cut

Split cross-save/config validation out of `GameSaveSchema.ts` into `GameSaveValidation.ts`.

This keeps `GameSaveSchema.ts` as the public schema/type barrel and moves the inherently noisy central invariant checks into a dedicated validation file.

## Remaining follow-up

If `GameSaveValidation.ts` grows painful, split it by domain validators next: board, inventory, producer, craft, upgrade, stash, stored requirements, scheduled events. Do this only as a mechanical extraction with tests green; do not change validation behavior while moving code.
