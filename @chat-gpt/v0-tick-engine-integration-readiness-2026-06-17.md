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

2. **Upgrade runtime support** — DONE / FOLLOW-UP
   - Upgrade actions/jobs live in the tick engine.
   - Config stays immutable; save stores completed/in-progress upgrade state.
   - Runtime config mutation uses `GameConfigLayer`: base `GameConfig` + derived layer from save -> effective config service.
   - Entry points build/provide `GameConfigFx` so downstream Fx read effective config and do not care whether a value came from base config or upgrade patch.
   - Persist only minimal upgrade state (`completedTiers`, jobs), not the derived full layer; rebuild layer from config + save on each engine call.
   - Follow-up hygiene done in the stored requirements pass: producer jobs now snapshot missing `outputTableId` as explicit `null`, so delayed sink jobs cannot accidentally see a future upgraded output table.

3. **Stored requirements save model** — DONE
   - Added `save.storedRequirements[targetItemInstanceId].items[itemId] = quantity` as the runtime home for long-lived producer/stash stored requirement slots.
   - Added generic `stored_requirement.store` and `stored_requirement.withdraw` engine actions.
   - Producer/stash readiness now evaluates stored requirements from the concrete target board item instance, not from global inventory or config wishful thinking, the worst database known to humankind.
   - Added regression coverage for producer stored requirements, missing stored requirements, withdraw flow and stash stored requirements.

4. **Product line enable/disable runtime state** — DONE / CURRENT
   - Added `save.producerLines[producerItemInstanceId].disabledProductIds` as per-producer runtime state.
   - Product lines stay enabled by default; save stores only disabled exceptions.
   - Added `producer.product_line.set_enabled` action and `producer.product_line.enabled_changed` event.
   - Product start/readiness rejects disabled lines with `product_line_disabled`.
   - Running producer jobs are not cancelled by toggling a line; the toggle affects future starts only.

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

Current task: item 4 is implemented; next continue into item 5, the in-memory engine integration adapter, once tests pass in a dependency-installed workspace.
