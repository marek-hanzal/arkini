# v0 complexity/topology audit

Status: source audit + one cleanup cut.

## Completed cleanup

- Removed the old `src/v0/manifest` TS manifest/config/DSL/validation tree.
- Runtime ID value schemas now live in `src/v0/game/config/GameIdSchema.ts` as generic non-empty strings.
- Cross-reference truth stays in `GameConfigSchema` / `GameSaveConfigSchema`, not stale generated TS enum mirrors.
- Root `README.md` now says runtime config truth is compiled JSON parsed by `GameConfigSchema`.

## Line-count findings

Intentional dense core contracts, do not split as line-count cleanup:

- `src/v0/game/config/GameConfigSchema.ts`
- `src/v0/game/engine/model/GameSaveSchema.ts`

Real future audit candidates:

- `src/v0/tile-engine/useTilePointerUp.ts` - pointer-up orchestration is long and carries drag/drop/motion concerns.
- `src/v0/tile-engine/TileMotionRuntime.ts` - motion queue/runtime is inherently non-trivial, but should be checked for separable policy vs implementation.
- `src/v0/play/game-engine-visual/createGameEngineVisualPlan.ts` - event-to-visual interpretation may want smaller event-family mappers.
- `src/v0/game/engine/model/GameEventSchema.ts` - large event union; splitting only if exported union ergonomics stay simple.
- `src/v0/game/engine/runtime/RuntimeGameEngineAdapter.ts` - bridge between runtime store, ticking, actions, persistence; audit after gameplay engine stabilizes.
- `src/v0/tile-engine/TileEngineActor.tsx`, `useTileActorMotion.ts`, `TileEngineMotionRequestStore.ts`, `TileEngineSlot.tsx` - TileEngine is the main complexity cluster.

## Directory topology findings

Potentially overloaded folders:

- `src/v0/game/engine/fx` has many files, but this is mostly flat Effect-command ownership. Do not split just because count is high.
- `src/v0/game/engine/model` has many schema/event/save files. Keep core contracts central unless a split preserves type ergonomics.
- `src/v0/tile-engine` has many files and several long files. This is the highest-value topology audit target.
- `src/v0/play/game-engine-bridge` is now flatter after board read-model split and currently acceptable.

## Nesting findings

After removing the old manifest, v0 no longer has suspicious deeply nested source folders. New nested folders must justify a real domain boundary, not just topic grouping cosplay.

## Guardrails

- Do not split `GameConfigSchema` / `GameSaveSchema` for line count alone.
- Do not invent nested folder hierarchy as a cleanup ritual.
- Prefer deleting obsolete compatibility layers over moving them around.
- Large files are acceptable when they are central contracts or test fixtures; long orchestration files need stronger justification.
