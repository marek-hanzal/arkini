# v0 health audit — 2026-06-15

## Verdict

The active `src/v0` runtime is still healthy enough to keep as the migration target. I did not find a new `useGameCommandMutation`-style central hook or a root session/provider replacement sneaking back in. The remaining hooks are concrete action hooks, tile-engine internals, the producer clock, local feedback flags, and the root hard-reset helper.

## Cleanup performed

- Removed the generic `src/v0/play/schema` bucket.
- Moved board schemas into `src/v0/board/schema`.
- Moved inventory schemas into `src/v0/inventory/schema`.
- Moved upgrade schemas into `src/v0/upgrade/schema`.
- Moved save row schema into `src/v0/play/save`.
- Moved static `gameConfig` accessor into `src/v0/game`.
- Removed unused `GameActionActivationSchema`.
- Renamed `src/v0/board/util/cell.ts` to `src/v0/board/cellKey.ts`.
- Renamed manifest config builders from `src/v0/manifest/utils` to `src/v0/manifest/dsl`.
- Split `DragTypes.ts` into `play/drag/DragSource.ts` and `play/drag/DropTarget.ts`.
- Split `Sheet.ts` into `play/sheet/Sheet.ts` and `play/sheet/ActiveSheetState.ts`.
- Moved `BottomSheet` under `play/sheet`.
- Moved `Feedback` under `play/feedback` and made the exported type explicit as `Feedback.Type`.
- Routed the root hard reset through `runGameFx` instead of direct `Effect.runPromise`.

## Audit checks

Clean active runtime checks:

- no `src/v0/shared`
- no `src/v0/mutation`
- no central `src/v0/play/schema`
- no `~/v0/play/schema/*` imports
- no `~/v0/board/util/*` imports
- no `~/v0/manifest/utils/*` imports
- no custom React context/provider in `src/v0` or active `src/app`
- no plain `useQuery(` in `src/v0` or active `src/app`
- no `getQueryData` in `src/v0` or active `src/app`
- no `switch (` in `src/v0` or active `src/app`
- no non-v0 imports from `src/v0` except assets

## Watch list

The following areas are acceptable for now but should stay under pressure:

- `BoardSurface.tsx` and `InventorySurface.tsx` still wire several action hooks and build TileEngine props locally. This is not a central hook problem, but if either grows further, split by component boundary, not by creating a mega hook.
- `play/drop/resolveDrop.ts` is a deliberate cross-surface policy entrypoint. Keep it as a small dispatcher only; case logic belongs in focused resolvers.
- `ActionVisualEventSchema.ts` is large because it is the event contract. Split only if event families start gaining real independent behavior.
- `manifest/config/GameItemDefinitions.ts` is huge because it is data. Do not solve data size with helper sludge; split by content group only when authoring becomes painful.

## Rules reinforced

- Types/schemas live with their domain. No generic schema landfill.
- Query/action/cache/Fx folders are domain-owned; no top-level `v0/query`, `v0/mutation`, or `v0/shared`.
- React Query owns durable reads and mutation lifecycle.
- TileEngine owns interaction and animation mechanics, not game rules.
- Surfaces compose data/action/engine boundaries; they must not become god hooks in component costume.
