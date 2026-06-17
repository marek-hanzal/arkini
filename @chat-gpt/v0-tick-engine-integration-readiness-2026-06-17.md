# V0 tick engine integration readiness plan

Status: ACTIVE
Created: 2026-06-17
Updated: 2026-06-17

The standalone Effect tick/action engine has the first core gameplay actions. Keep closing runtime mechanics before wiring it into UI. UI must subscribe to domain results instead of duplicating gameplay rules, because duplicate rules are how codebases manufacture ghosts for future debugging sessions.

Priority order:

1. **Readiness/explain API + guidance cleanup** — DONE
   - Added an Effect-first readiness entrypoint for a concrete proposed action.
   - Readiness returns `ready` or `rejected` with typed reason/message shape.
   - Readiness reuses focused validation Fx used by `applyGameActionFx`.
   - UI must use this boundary instead of inventing parallel action availability rules.

2. **Upgrade runtime support** — IN PROGRESS / CURRENT
   - Upgrade actions/jobs live in the tick engine.
   - Config stays immutable; save stores completed/in-progress upgrade state.
   - Runtime config mutation uses `GameConfigLayer`: base `GameConfig` + derived layer from save -> effective config service.
   - Entry points build/provide `GameConfigFx` so downstream Fx read effective config and do not care whether a value came from base config or upgrade patch.
   - Persist only minimal upgrade state (`completedTiers`, jobs), not the derived full layer; rebuild layer from config + save on each engine call.

3. **Stored requirements save model**
   - Stored requirements exist in config and craft currently reserves/returns them for jobs.
   - Producer/stash stored requirement slots need a real save representation before UI integration.

4. **Product line enable/disable runtime state**
   - This is save state, not config.
   - Product start/readiness must respect disabled lines once implemented.

5. **Engine integration adapter, without persistence first**
   - Load default compiled config.
   - Keep save in memory bootstrapped from `startingState`.
   - Run `applyGameActionFx`/`runGameTickFx` through `runEffect`.
   - Emit domain events and translate them to visual events outside the engine.

6. **Domain-event to visual-event bridge**
   - Board/TileEngine subscribes to engine results; it must not recalculate gameplay rules.

7. **Persistence/Dexie later**
   - Storage remains outside the engine.
   - Dexie/IndexedDB simplification follows after the engine can run in memory.

Current task: finish item 2 and keep `GameConfigLayer` hidden behind `GameConfigFx` service so engine internals read effective config, not ad-hoc upgrade resolvers.
