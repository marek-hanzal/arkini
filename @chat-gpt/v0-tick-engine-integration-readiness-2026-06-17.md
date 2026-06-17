# V0 tick engine integration readiness plan

Status: ACTIVE NEXT
Created: 2026-06-17

The standalone Effect tick/action engine has the first core gameplay actions, but it is not ready to wire into UI until the engine exposes readiness/explain helpers and the remaining runtime mechanics are closed.

Priority order:

1. **Readiness/explain API + guidance cleanup**
   - Add an Effect-first readiness entrypoint for a concrete proposed action.
   - Readiness must return `ready` or `rejected` with the same typed reason/message shape as the action error channel.
   - UI must not duplicate gameplay rules to decide whether something is clickable/draggable/processable.
   - Readiness should reuse focused validation Fx used by `applyGameActionFx`; do not create a parallel rules engine.
   - Keep single exported item per file and namespace props.

2. **Upgrade runtime support**
   - Add upgrade actions/jobs after readiness is in place.
   - Config stays immutable; save stores completed/in-progress upgrade state.
   - Product runtime values must be resolved from base config + completed upgrades.

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

Current task: implement item 1.
