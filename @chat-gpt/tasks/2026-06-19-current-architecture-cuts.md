# Current architecture cuts

Status: active task queue and current source-state summary. Keep this file short. Completed details belong in `archive/`.

## Current source state

- `src/v0/game/engine/fx` is gone.
- `src/v0/game/engine` is now orchestration only: action parsing/apply, readiness, tick, plus engine-level `logic`, `model`, `runtime`, and `test` support.
- Domain behavior now lives in top-level `src/v0/game/*` folders: `board`, `config`, `craft`, `inventory`, `job`, `loot`, `merge`, `placement`, `producer`, `remove`, `requirements`, `save`, `stash`, `storage`, `upgrade`.
- TileEngine cleanup first pass is done: pointer-up phases, actor layout motion, actor debug/memo, and slot long-press/debug/memo were split. Do not continue TileEngine cleanup without browser feedback or a concrete bug.
- Game visual planning was split by event family and remains a `GameEvent` output interpreter, not gameplay logic.
- Job/event split is done: delayed/scheduled/retry/future processing is a job; `GameEvent` is output for work processed now.
- `GameConfig` is the primary gameplay contract. Do not add a separate item capability whitelist outside `GameConfigSchema`.

## Archived completed task docs

- `archive/2026-06-19-game-engine-domain-topology-audit.md` - completed engine `fx` removal/domain extraction plan and history.
- `archive/2026-06-19-tile-engine-complexity-audit.md` - completed first TileEngine complexity cleanup pass and guardrails.

## Next candidates

1. `game/engine/model` topology audit. Goal: identify whether model files are truly engine-level contracts or whether some small domain models belong beside top-level domains. Do not move `GameSaveSchema`, `GameConfigSchema`, or dense core contracts for line count.
2. Runtime adapter audit. Check `RuntimeGameEngineAdapter.ts` only if it starts carrying domain behavior instead of orchestration.
3. Pure vs Effect boundary audit. Promote from `backlog/2026-06-19-pure-vs-effect-boundary-audit.md` only when ready to inspect duplicated business decisions.
4. UI/browser pass. Use screenshots/manual feedback for board/inventory/sheet polish; do not do visual refactors blind.

## Not current tasks

- No capability matrix enforcement. Config validation defines legality.
- No `GameConfigSchema` / `GameSaveSchema` split for line count.
- No `TileMotionRuntime.ts` split for line count.
- No resurrection of `engine/fx` or nested `engine/<domain>` folders.
- No further TileEngine cleanup without browser feedback or a concrete bug.

## Recommended next action

If continuing architecture cleanup, start with a read-only `game/engine/model` topology audit. The output should be a short table of model groups: keep in engine, candidate domain move, or intentional dense core contract.
