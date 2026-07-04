# 2026-07-04 Deep quality pass: Fx boundaries and schema cleanup

A second brutal review pass after `arkini-brutal-quality-pass-2dae6f53` focused on code-quality smells, redundant schema/type wrappers, and plain helpers that were carrying mutation/impurity outside Effect boundaries.

## Fixed

- Removed the empty action type alias files and switched call sites to `GameAction...Schema.Type` directly.
- Moved board-item runtime-state cleanup into `removeBoardItemRuntimeStateFx` and converted callers that mutate save state to yield through Effect.
- Normalized depleted-producer replacement naming to `replaceDepletedProducerSourceCellOutputFx`.
- Added active audit coverage for exported `Effect.fn` functions without the `Fx` suffix.
- Replaced remaining detail metadata `filter(Boolean)` string joins with explicit `joinTextParts` usage.
- Simplified action readiness from three unused Zod schemas to a direct `GameActionReadiness` type, since readiness is produced internally and was not parsed at runtime.
- Fixed same-id board swap readiness: a missing board item no longer returns success just because source and target IDs are equal.
- Fixed board-memory restore losing runtime state when inventory was too full to store a board item. Runtime state is now removed only after a storage target is confirmed.
- Embedded game ID generation directly in concrete `*Fx` boundaries and removed the plain `createGameEntityId` / `genId` layer.
- Removed redundant `export type XSchema = typeof XSchema` aliases from action/placement schemas; schema namespace `Type` remains the contract.
- Added audit rules to prevent reintroducing impure cuid2 generation outside Fx files and redundant schema type aliases.

## Verification

`npm run check` passes end-to-end, including format, active audit, schema check, game validation, dependency cruise, typecheck, and all Vitest suites.

`npm run build` passes. Vite still warns about chunk size, which is not a build failure.

Expected game validation warnings remain for limited finite deposits without sustainable replacement paths: `item:double-tree`, `item:micro-forest`, `item:rock`, and `item:tree`.
