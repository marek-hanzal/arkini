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
   - Follow-up hygiene done in the adapter pass: stored requirement withdraw now places returned items into inventory only, instead of leaking through generic board-then-inventory placement. Withdrawing a tool onto the board because the board had a free cell was peak goblin UX.

4. **Product line enable/disable runtime state** — DONE
   - Added `save.producerLines[producerItemInstanceId].disabledProductIds` as per-producer runtime state.
   - Product lines stay enabled by default; save stores only disabled exceptions.
   - Added `producer.product_line.set_enabled` action and `producer.product_line.enabled_changed` event.
   - Product start/readiness rejects disabled lines with `product_line_disabled`.
   - Running producer jobs are not cancelled by toggling a line; the toggle affects future starts only.

5. **Engine integration adapter, without persistence first** — DONE
   - Added `RuntimeGameEngineAdapter` as the first app-facing runtime boundary around `(config, save)`.
   - Loads the default compiled config by default, or accepts an injected test/config package. The engine default synthesizes resource placeholders from asset references so the runtime adapter does not drag base64 art payloads into gameplay code.
   - Bootstraps a `GameSave` from `startingState` when no save is injected.
   - Dispatches `applyGameActionFx`, ticks via `runGameTickFx`, stores the returned next save in memory and publishes raw domain `GameEngineResult` events to subscribers.
   - Added `runGameEngineEffect`, a narrow engine runner that provides only `RandomServiceFx`. Do not use the app-level `runEffect` here because it currently wires SQLite/Kysely/browser storage and would make the no-persistence adapter lie through its teeth.
   - This adapter deliberately does not import Dexie, SQLite, React Query or TileEngine. Persistence and visuals wrap it later instead of leaking into game rules like some kind of architectural sewage.

6. **Domain-event to visual-event bridge** — DONE / FOLLOW-UP
   - Added the first bridge under `src/v0/play/game-engine-bridge`, intentionally outside `src/v0/game/engine` so the standalone engine does not import UI visual language.
   - `createActionVisualEventsFromGameEvents` maps raw engine events into `ActionVisualEvent` values for board spawns, inventory quantity patches, board source merges, standalone replacements, board removals and upgrade-start state visuals.
   - Added `createActionVisualEventsFromGameEngineResult` convenience wrapper for runtime adapter subscribers.
   - Extended the visual event vocabulary with `inventory.quantity_changed`, because engine inventory slots are stack snapshots, not item-instance rows, and pretending every inventory delta is an item spawn would make cache patching beautifully wrong.
   - Added `item.replaced` visual support so non-consuming directed merge/replacement events can patch board state even when there is no consumed source event to fold into `item.merged`.
   - Runtime cache bridge now exists: `connectRuntimeGameEngineToQueryCache` primes board/inventory React Query caches from a `RuntimeGameEngineAdapter` snapshot, subscribes to runtime results, maps domain events to visual events and feeds the existing cache patch + TileEngine motion request pipeline.
   - Added runtime snapshot readers for board/inventory views so the new engine can seed the old UI cache contract without importing React Query or TileEngine into the standalone engine.
   - Added stash-open visual mapping to keep cache activation state/remaining charges in sync with runtime `stash.opened` results.
   - Follow-up closed in the runtime store pass: PlayShell now mounts a `GameRuntimeProvider`, board/inventory read state comes from a `useSyncExternalStore` selector layer and gameplay drops/taps dispatch into the runtime adapter instead of React Query mutation hooks.
   - Runtime visual effects now subscribe to runtime updates directly and register TileEngine enter/merge motion from domain->visual events without patching board/inventory React Query caches.

7. **Runtime selector/action layer** — DONE / CURRENT
   - Added `GameRuntimeStore` as a React-facing wrapper around `RuntimeGameEngineAdapter`.
   - Added `useGameRuntimeSelector` based on `useSyncExternalStore`; selectors return stable selected values when the root runtime snapshot changes but the selected slice does not.
   - Board/inventory surfaces now read `BoardView`/`InventoryView` from runtime selectors instead of `useSuspenseQuery(boardViewQueryOptions)` / `inventoryViewQueryOptions`.
   - Replaced gameplay `useMutation` hooks in the live board/inventory/item paths with `useGameAction` and `useGameRuntimeDropActions`. Runtime actions are command functions over `RuntimeGameEngineAdapter`, not fake server mutations with a cache hostage situation.
   - Removed dead board/inventory/item gameplay mutation hooks so React Query stops pretending to be the game state source of truth.
   - Added runtime engine actions for board move, board swap, inventory-to-board placement, board-to-inventory stash and inventory slot swap. This avoids the split-brain disaster where UI reads from the new runtime store but writes to the old SQLite mutation path.
   - Board-to-board drop commands now route merge/craft/producer/stash/stored-requirement interactions into runtime actions where the new engine has coverage. Remaining parity gaps are explicit rather than hidden behind old mutation hooks.
   - Added a checked-in Vitest config so focused tests do not need repeated CLI flag witchcraft.

8. **Persistence/Dexie later**
   - Storage remains outside the engine.
   - Dexie/IndexedDB simplification follows after the engine can run in memory and after the domain-event bridge proves the shape UI actually needs.
   - Do not implement Dexie before the adapter/bridge boundary is clear, otherwise storage starts shaping gameplay state and the project wakes up with database Stockholm syndrome.

Current task: item 7 is the active runtime UI path. Next pass should harden remaining UI parity around inventory-to-target activation feeding, upgrade sheet runtime views and any old debug/scenario paths that still assume SQLite is the gameplay source of truth. After that, remove or retire the old board/inventory React Query cache bridge code once no live path depends on it. Dexie should still wait until the runtime action layer proves the real persistence boundary.
