# Current architecture cuts

Status: active task queue for the current cleanup/refactor block.

## Done in this block

- `2026-06-19`: item-to-board-item interaction planner unified.
- `2026-06-19`: action readiness/apply dispatch and basic readiness checks tightened.
- `2026-06-19`: effective config overlay contracts covered by tests.
- `2026-06-19`: `@chat-gpt` notes reorganized into `tasks/`, `backlog/`, `archive/`.
- `2026-06-19`: persistence retry safety fixed; failed writes keep latest pending save.
- `2026-06-19`: board read-model bridge split into focused activation/craft/item readers.
- `2026-06-19`: reverted `GameSaveSchema` validation split; schema core contracts are not line-count cleanup targets.
- `2026-06-19`: split future work from now-events; old delayed item-spawn records are now `itemSpawnJobs`.
- `2026-06-19`: job/event follow-up checked active notes/source naming; active rules now say scheduled/pending means job, event means now/output.
- `2026-06-19`: removed obsolete `src/v0/manifest` TS manifest tree and moved runtime ID schemas to `game/config`.
- `2026-06-19`: completed v0 line-count/topology audit; TileEngine is the main future complexity cluster.
- `2026-06-19`: completed TileEngine complexity audit; next safe cut is `useTilePointerUp.ts` phase extraction.
- `2026-06-19`: split `useTilePointerUp.ts` drop finalization into focused motion/commit/handoff helpers.
- `2026-06-19`: split `useTileActorMotion.ts` layout motion into `useTileActorLayoutMotion.ts`.
- `2026-06-19`: split `TileEngineActor.tsx` memo comparison and feedback debug effect into focused helpers.
- `2026-06-19`: split `TileEngineSlot.tsx` long-press, feedback debug, and memo comparison into focused helpers.
- `2026-06-19`: split `createGameEngineVisualPlan.ts` into event-family visual mappers; visual planning remains a GameEvent output interpreter, not gameplay logic.
- `2026-06-19`: split giant `applyGameActionFx.test.ts` into domain-family action tests; this anchors future game-domain moves.
- `2026-06-19`: moved producer runtime files from `game/engine/fx` into top-level `game/producer`; `game/engine` now imports producer as a domain instead of owning it.
- `2026-06-19`: moved craft runtime files from `game/engine/fx` into top-level `game/craft`; `game/engine` now imports craft as a domain instead of owning it.
- `2026-06-19`: moved stash runtime files from `game/engine/fx` into top-level `game/stash`; `game/engine` now imports stash as a domain instead of owning it.
- `2026-06-19`: moved placement runtime files from `game/engine/fx` into top-level `game/placement`; placement is now a shared game domain, not engine-owned Effect plumbing.
- `2026-06-19`: moved requirements/input-ref/stored-requirement runtime files from `game/engine/fx` into top-level `game/requirements`; requirements are now a shared game domain, not engine-owned Effect plumbing.
- `2026-06-19`: moved upgrade runtime files from `game/engine/fx` into top-level `game/upgrade`; upgrade lifecycle is now a game domain, while engine only dispatches/ticks it.
- `2026-06-19`: moved job/id/wake/item-spawn runtime files from `game/engine/fx` into top-level `game/job`; delayed/retry gameplay stays a job domain, not engine-owned Effect plumbing.
- `2026-06-19`: moved loot/random roll helpers from `game/engine/fx` into top-level `game/loot`; loot rolling is now a game domain, not engine-owned Effect plumbing.
- `2026-06-19`: moved board move/swap helpers to `game/board`, inventory slot swap helpers to `game/inventory`, and inventory-to-board placement readiness to `game/placement`.
- `2026-06-19`: moved merge execution/readiness to `game/merge`, remove execution/readiness to `game/remove`, and shared board runtime-state cleanup/status helpers to `game/board`.

- `2026-06-19`: moved effective config layer/service files from `game/engine/fx` and `game/engine/context/model` into top-level `game/config`; config overlay is now a config domain, not engine-owned plumbing.
- `2026-06-19`: moved initial save creation, save cloning, and item-instance ID creation into top-level `game/save`; save bootstrap/helpers are no longer engine-owned plumbing.
- `2026-06-19`: removed `game/engine/fx`; action/readiness/tick orchestration now lives directly in `game/engine`, while domain behavior lives under top-level `game/*` folders.

## Next candidates

1. Review whether `game/engine/model` contains domain models that should eventually move beside their top-level domains. Do not move dense core contracts (`GameSaveSchema`, `GameConfigSchema`) just for line count.
2. Audit `RuntimeGameEngineAdapter.ts` only if it starts carrying domain behavior instead of runtime orchestration.
3. TileEngine follow-up: current browser feel is acceptable. Do not split `TileMotionRuntime.ts` just for line count.
4. GameEventSchema audit: only if event schema starts carrying behavior. It is an intentional output-event contract and should not be split just for line count.

Not a task: item capability whitelist/matrix enforcement. `GameConfigSchema` defines legal item/capability combinations; if validation accepts the config, engine/runtime must support the combination deterministically. Revisit only for a concrete bug or new config validation rule.

Before coding any risky item, inspect source and propose exact files/shape first.
