# Craft/world scope flattening pass

Commit: recorded in git history for this archive entry

Goal: continue the deep review series by removing remaining prop-only `Context.Tag` scopes where the service only carried stable call props and made orchestration harder to follow.

Changes:

- Removed `WorldSnapshotValidationScopeFx` from `src/world/validateWorldSnapshotFx.ts`. Snapshot validation helpers now receive an explicit validation scope while staying inside named Fx helpers.
- Removed `CraftJobCompletionScopeFx` from `src/craft/completeCraftJobFx.ts`. Craft completion, blocked retry, failed completion, and result replacement now pass an explicit scope through private Fx helpers.
- Removed `CraftRealtimeSyncScopeFx` from `src/craft/syncRealtimeCraftJobsFx.ts`. Craft realtime sync still uses `GameSaveDraftScopeFx` because that is a real mutable draft boundary, but config/nowMs are explicit props now.

Notes:

- `GameConfigFx`, `RandomServiceFx`, and `GameSaveDraftScopeFx` remain valid ambient services.
- Producer realtime sync, producer completion, line start readiness/execution, and board-memory activation still have local scopes and are the next review candidates.
