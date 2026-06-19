# v0 standalone Effect tick engine plan

Status: HISTORICAL - implemented by the live runtime tick/action engine path; keep as rationale/reference.
Created: 2026-06-17

## Idea

Build a standalone Effect-based game engine that evaluates the validated `GameConfig` plus mutable save state outside React/UI. The engine should accept explicit actions and external time ticks, produce domain events, and return updated save state. Board/UI then subscribes to those events and renders/animates them, instead of carrying gameplay logic in component hooks like a backpack full of bees.

This can be implemented beside the current game and switched over once parity is proven.

## Target shape

Conceptually:

```ts
type GameEngineInput = {
	config: GameConfig;
	save: GameSave;
	nowMs: number;
};

type GameEngineResult = {
	save: GameSave;
	events: GameEvent[];
};
```

The tick runner should be boring:

```ts
runTickFx({ config, save, nowMs }) -> Effect<GameEngineResult, GameEngineError>
```

Actions can use the same boundary:

```ts
applyActionFx({ config, save, action, nowMs }) -> Effect<GameEngineResult, GameEngineError>
```

The caller decides how often ticks happen. The engine does not own timers. The browser may tick every animation frame, every 250 ms, on tab resume, on player action, or after loading an offline save. Engine logic must be deterministic for a given `(config, save, nowMs, action)`.


## Persistence boundary

The engine must not touch persistence. No SQLite, Dexie, OPFS, Kysely, IndexedDB, localStorage or React Query imports inside engine code. Storage loads `GameSave`, the engine evaluates rules, and storage persists the returned save. The engine is the game law; the database is only a box. We do not put legislation in the box, because apparently we still have standards.

This also means the first engine prototype does not need the final persistence layer. It can derive an initial `GameSave` from `GameConfig.startingState`, run ticks/actions in memory and prove the event/save model before storage migration begins.

## Responsibilities

The standalone engine should own all gameplay rule evaluation:

- producer product line readiness.
- producer feeding/start rules.
- product completion.
- product lines with no output table, e.g. shredder/destructor.
- stash opening, charge depletion and replacement/removal.
- craft start/completion, including requirement return capacity checks.
- merge eligibility and result creation.
- generic tile removal through `items.*.removeBy`.
- passive/stored requirement checks.
- upgrade start/completion/effect application.
- output placement planning: board first, then inventory stacking/slots.
- offline catch-up by evaluating jobs against real `nowMs` instead of watched timers.

The engine should not own rendering, drag geometry, animation timings, React Query cache patching or TileEngine pointer interactions. UI adapters translate user intent into engine actions and translate engine events into visual events. That boundary is the whole point, because otherwise React will happily become the gameplay engine while pretending not to.

## Event model

Events should describe what happened, not how to animate it. Example event families:

```ts
type GameEvent =
	| { type: "item.created"; itemId: string; target: PlacementTarget }
	| { type: "item.removed"; boardItemId: string; reason: "merge" | "stash" | "craft" | "removeBy" | "input" }
	| { type: "item.moved"; from: PlacementTarget; to: PlacementTarget }
	| { type: "producer.line.started"; producerInstanceId: string; productId: string; completesAtMs: number }
	| { type: "producer.line.completed"; producerInstanceId: string; productId: string }
	| { type: "stash.opened"; stashInstanceId: string; outputItemIds: string[] }
	| { type: "craft.started"; craftInstanceId: string; recipeId: string; completesAtMs: number }
	| { type: "craft.completed"; craftInstanceId: string; recipeId: string }
	| { type: "upgrade.completed"; upgradeInstanceId: string };
```

A tick may return an empty event array. Empty ticks are normal, not a failure, despite being emotionally disappointing.

## Save state requirements

The save model will need explicit runtime structures for things currently hidden in UI/domain flows:

- board item instances with stable IDs and positions.
- inventory stacks/slots.
- running producer jobs per producer instance/product line.
- stored requirements/inputs attached to producer/product/stash/craft targets.
- disabled product lines per producer instance.
- running craft jobs.
- running upgrades.
- depleted/removed/replaced stash state.
- randomness supplied through `RandomServiceFx`; tests use fake/scripted services instead of engine-local RNG helpers.

The static `GameConfig` says what can happen. Save state says what is currently happening.

## Time and randomness

Time must be injected as `nowMs`. Do not call `Date.now()` inside engine logic. Tests must be able to fake time without séance-level mocking.

Loot randomness must be injected through `RandomServiceFx`. App callsites already get it through `runEffect`; engine tests must provide fake or scripted services. Do not add engine-local seeded helpers such as `nextGameRandom`, and do not let loot tables call `Math.random()` directly from domain logic. That is how tests become astrology.

## Validation of the idea

This design fits the new JSON schema well:

- `GameConfigSchema` gives a single validated static contract.
- The engine can be tested with hand-authored configs and tiny saves.
- React/UI can become thinner: user action in, engine events out.
- Existing runtime can be kept until parity tests are green.
- Offline production naturally falls out of comparing `nowMs` with persisted completion timestamps.

It also gives a clean route to validate that the engine honors the config: for each mechanic, build a fixture `(config, save, action/tick, nowMs)` and assert both output events and resulting save.

## Risks / flies in the soup

- Event vocabulary can bloat if it tries to serve animation details directly. Keep events domain-level and map to visual events outside the engine.
- Placement planning must be atomic. A craft completion that cannot place returned requirements plus result must not partially mutate save.
- Multiple completed jobs on one tick need deterministic ordering. Use saved completion time, then stable instance ID as tie-breaker.
- Output placement can fail when board/inventory is full. The engine needs explicit blocked/completion-pending semantics instead of dropping items into the void like a badly supervised toddler.
- Long offline catch-up may create huge event lists. We may need compact summary events or a max event budget for UI while still applying full save changes.
- Existing DB/React Query action code may resist extraction. Implement beside the old flow first; do not big-bang rewrite the swamp.
- Effect is useful for dependency injection, typed errors, logging and test services, but pure helpers should stay pure. Do not wrap every arithmetic operation in Effect just to prove we own a hammer.

## Proposed implementation path

1. Define `GameSave` and `GameEvent` draft types in a new domain area beside the current runtime, not inside UI.
2. Add a small bootstrap helper that creates initial `GameSave` from validated `GameConfig.startingState`; this is enough for engine tests before final persistence exists.
3. Implement Effect-first placement planner against `GameConfig` + save.
4. Implement Effect-first requirement/input evaluators.
5. Implement `runTickFx` for already-running jobs only.
6. Add tests with fake `nowMs` and fake `RandomServiceFx`.
7. Implement action reducers: feed producer, open stash, start craft, merge, removeBy, start upgrade.
8. Add adapter that converts current UI actions to engine actions while current UI still renders from existing state.
9. Switch one mechanic at a time once event parity is proven.
10. Only then migrate persistence/storage, likely through the Dexie cleanup task in `v0-dexie-save-storage-migration-2026-06-17.md`.

## Current decision

The idea is valid and fits the config migration. It should be a deliberate side-by-side runtime engine, not a hidden refactor inside components. It is now the next architectural priority before the persistence rewrite: the engine can run from `GameConfigSchema` and `startingState`, while final Dexie/SQLite decisions can wait until the `GameSave` shape is real. Tests are mandatory because this engine becomes the game’s actual law, and laws without tests are just folklore with TypeScript syntax.

## 2026-06-17 implementation checkpoint

First side-by-side engine slice is implemented under `src/v0/game/engine`.

Added:

- `GameSaveSchema` with board item instances, inventory slots/stacks, deterministic ID counters, running producer jobs and running craft jobs.
- `GameEventSchema` with domain events for item creation, product completion/blocking and craft completion/blocking.
- `createInitialGameSaveFx(config, nowMs)` bootstrapping from `GameConfig.startingState`.
- `placeGameSaveItemsFx(...)` implementing the current `board_then_inventory` contract atomically: board tiles first, then inventory stacks/empty slots, no partial mutation on overflow.
- loot-table rolling for guaranteed/chance/weighted output through `RandomServiceFx`; no engine-local RNG helper exists.
- `runGameTickFx(...)` for already-running producer/craft jobs. Completed product jobs either emit output through loot tables, finish as delayed sinks when no output table exists, or stay pending with a blocked event when placement is unavailable.
- The engine remains persistence-free and imports no database/storage/UI modules.
- focused tests for initial save bootstrap, placement, product completion, blocked completion and sink products.

Still deliberately not done:

- action reducers for player intent: feed producer, start product, open stash, start craft, merge, removeBy, start upgrade.
- readiness evaluation for product lines/stashes/craft.
- upgrade state/effect application.
- UI adapter from current actions to engine actions.
- persistence/Dexie integration.

Design note: empty ticks should not mutate save timestamps. Persistence should not write just because time passed and nothing happened, protože jinak si vyrobíme storage treadmill pro nic za nic.

## 2026-06-17 scheduler checkpoint

The tick engine now owns a persisted scheduler queue in `GameSave.scheduledEvents`. This is the intended place for "spawn now vs spawn gradually" rules so sequencing does not leak into React/UI adapters.

Current implemented scheduler contract:

- Scheduled events are part of save state and survive reload/offline gaps.
- `item.spawn` scheduled events mutate save only when processed by `processScheduledGameEventsFx(...)` / `runGameTickFx(...)`.
- Non-exclusive due events may be processed in the same tick.
- Events with the same `exclusiveKey` are throttled to at most one processed event per tick, even if multiple entries are overdue. This prevents late browser timers from batching a sequential spawn stream into `<spawn, spawn>` after one missed tick.
- Blocked scheduled item spawns stay pending and emit `item.spawn.blocked`.
- `runGameTickFx(...)` processes scheduled events before and after job completion, so existing queued work runs first and freshly completed instant outputs can still appear in the same tick.
- Job completion now schedules item spawns and then lets the scheduler emit `item.created`; the engine still preflights placement for product/craft completion so existing atomic blocked-completion semantics remain intact.
- `GameEngineResult.nextWakeAtMs` is a scheduling hint for the outside orchestrator. The engine still does not own timers or call `setTimeout`.

Important UI boundary: visual animation timing is still outside the engine. The scheduler describes domain timing and event emission order, not CSS/Motion animation duration. UI may still be animating event N while the engine emits event N+1; that is fine and likely desirable as long as save state remains the source of truth.

## 2026-06-17 action-entrypoint checkpoint

- New engine implementation must be Effect-first. Do not add new domain engine code under `src/v0/game/engine/logic/*` as a naked pure function plus a cosmetic `Fx` wrapper.
- `src/v0/game/engine/fx/applyGameActionFx.ts` is the action entrypoint. It currently supports `producer.product.start` and dispatches through `ts-pattern`. Keep it small: dispatch only, flow logic belongs in focused Fx files.
- Action rejection/config problems use the `GameEngineError` typed error channel instead of throwing exceptions.
- `runGameTickFx` is now the tick entrypoint. The old `src/v0/game/engine/logic/*` slice has been removed; do not recreate it. New logic belongs in focused `fx/*` files with one exported function per file and `namespace FunctionName.Props`.
- Current supported action contract: explicit producer tile + product line + input refs. Product inputs are consumed at start. Passive requirements are checked against board/inventory scopes. Stored requirements intentionally fail as unsupported until save state can represent stored requirement slots.

## 2026-06-17 stash-open action slice

Implemented `stash.open` as the second `applyGameActionFx` branch. The action is Effect-first and keeps the scheduler inside the engine boundary:

- `stash.open` validates the board actor through `readStashBoardItemFx`.
- stash-level requirements are checked with the same requirement Fx used by producer products.
- stash inputs use the generic activation input consumer with `reason: "stash-input"`.
- loot is rolled through `RandomServiceFx`, not local RNG helpers.
- stash output is scheduled as `item.spawn` with `reason: "stash-output"`.
- depleted stashes schedule dependent board source changes (`board.item.remove` / `board.item.replace`) after all scheduled output events are processed.
- multi-charge stashes now have per-instance save state under `GameSave.stashes[stashItemInstanceId].remainingCharges`.
- scheduler dependencies use `afterEventIds` so source removal/replacement does not fire while exclusive/sequential output events are still pending.

The old product-specific input helper was replaced with activation-level helpers so products and stashes share one input-consumption path. Keep new gameplay actions in `fx/*` and keep adding focused schema/type files instead of embedding more anonymous object schemas into parent schemas.

## 2026-06-17 action-closure checkpoint

Implemented the remaining initial tick-engine action slice so the standalone engine can cover core gameplay intent before UI/storage integration:

- `producer.product.start` now queues jobs per producer instance instead of starting parallel jobs. A producer may be fed again while a job is running, but the next job starts at the previous job's `completesAtMs`.
- `craft.start` is supported. Craft inputs are consumed at start with `reason: "craft-input"`; stored craft requirements are reserved/removed at start with `reason: "craft-requirement"`; the craft job stores `returnItems`, which completion returns together with the craft result.
- `tile.remove` is supported through `items.*.removeBy`. `mode: "keep"` leaves the tool in place/inventory, `mode: "consume"` consumes one tool unit. The target board tile emits `item.removed` with `reason: "tile-remove"`.
- `item.merge` is supported as an asymmetric source-driven action. The source item chooses the merge rule through its `mergeIds`; the target must currently be a board tile and is replaced with the merge result. Source is consumed unless the merge rule says `consumeSource: false`.
- Scheduled blocked item spawns now mark `lastBlockedAtMs` and emit `item.spawn.blocked` only the first time they get blocked. The event remains pending and can still complete after space becomes available, but repeated ticks no longer spam duplicate blocked events.
- Engine code continues to use Effect-first `fx/*` files. New action schemas live in their own files.
- `GameConfigSchema` now validates starting-state inventory slot count, starting inventory quantities against `maxStackSize`, and duplicate starting board cells.
- Product/stash/product-completion placement is explicitly matched even though `board_then_inventory` is still the only supported enum value. Keep this pattern so future placement modes force exhaustive handling.

Still not done in this slice:

- UI adapter from existing gameplay events to the new engine events.
- readiness/selectors for “what can the player do now?”.
- upgrades.
- persistence/Dexie integration.
- active runtime DB/inventory hardening from the review report.
