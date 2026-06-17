# v0 standalone Effect tick engine plan

Status: TODO
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
- random seed or deterministic RNG state if loot rolls need reproducible tests.

The static `GameConfig` says what can happen. Save state says what is currently happening.

## Time and randomness

Time must be injected as `nowMs`. Do not call `Date.now()` inside engine logic. Tests must be able to fake time without séance-level mocking.

Loot randomness should be injected or deterministic. Candidate approaches:

- pass an RNG service through Effect.
- store a seed in save and return the advanced seed.
- for tests, use a scripted RNG sequence.

Do not let loot tables call `Math.random()` directly from domain logic. That is how tests become astrology.

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
3. Implement pure placement planner against `GameConfig` + save.
4. Implement requirement/input evaluators.
5. Implement `runTickFx` for already-running jobs only.
6. Add tests with fake `nowMs` and deterministic RNG.
7. Implement action reducers: feed producer, open stash, start craft, merge, removeBy, start upgrade.
8. Add adapter that converts current UI actions to engine actions while current UI still renders from existing state.
9. Switch one mechanic at a time once event parity is proven.
10. Only then migrate persistence/storage, likely through the Dexie cleanup task in `v0-dexie-save-storage-migration-2026-06-17.md`.

## Current decision

The idea is valid and fits the config migration. It should be a deliberate side-by-side runtime engine, not a hidden refactor inside components. It is now the next architectural priority before the persistence rewrite: the engine can run from `GameConfigSchema` and `startingState`, while final Dexie/SQLite decisions can wait until the `GameSave` shape is real. Tests are mandatory because this engine becomes the game’s actual law, and laws without tests are just folklore with TypeScript syntax.
