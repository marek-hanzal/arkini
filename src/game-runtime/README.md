# Runtime and session map

This map covers the live-game island. `game-runtime` is the canonical mutable state owner; the neighboring roots own time, persistence, session execution, package lifecycle, and downstream facts. This README does not make them one domain.

Gameplay meaning remains in [`GAME.MD`](../../GAME.MD). Use [`DOMAIN_ATLAS.md`](../../DOMAIN_ATLAS.md) for the wider repository.

## `game-runtime`

Role: canonical mutable gameplay state.

Owns:

- `RuntimeSchema` and runtime validation.
- The one `SubscriptionRef<CommittedTransition>` store.
- Runtime Item identity, revision and aggregate reads.
- Atomic mutation and publication.

Public entrypoints:

- [`context/RuntimeStoreFx.ts`](context/RuntimeStoreFx.ts) — serialized store capability.
- [`fx/modifyRuntimeWithTransitionFx.ts`](fx/modifyRuntimeWithTransitionFx.ts) — mutation plus exact committed transition.
- [`fx/modifyRuntimeFx.ts`](fx/modifyRuntimeFx.ts) — result-only mutation surface.
- [`layer/GameRuntimeLayerFx.ts`](layer/GameRuntimeLayerFx.ts) — config plus fresh or hydrated Runtime composition.

Depends on:

- behavior: Item resolution/revision/location checks and Production Line/Input/Job/Delivery validation or cleanup.
- contracts: Game Config, Game Value, Item Definition, Item Location, Game Event and production state schemas.

Used by:

- Game Session, Tick, gameplay commands, save/hydration, diagnostics and presentation projections.
- Production operations that read or mutate the same Runtime transaction.

Important invariants:

- Every write resolves live facts, plans from one pinned snapshot, validates the complete candidate, then publishes once.
- Runtime and events become visible in the same `CommittedTransition`; events are never a second store. Successful removal operations emit `item:removed` with the complete terminal `RuntimeItem` snapshot. The snapshot follows the unpublished draft through the normal result/event flow, so abandoned plans and rejected commits publish nothing. Presentation may retain the exact removed instance while its detail stays open; it never reconstructs terminal state from earlier renders or uses retained data as gameplay authority.
- Nested `RuntimeFx` reads inside a write default to the pinned pre-transition snapshot passed to the update. Explicit-snapshot operations scope nested reads to their own immutable input, so successive Tick lifecycle operations see earlier results without exposing their partially built candidates.
- Failure, interruption and an unchanged event-free result publish nothing.

## Neighboring owners

| Domain | Owns | Start at |
| --- | --- | --- |
| `game-event` | Strict downstream event vocabulary and committed-result projection | [`../game-event/schema/GameEventSchema.ts`](../game-event/schema/GameEventSchema.ts) |
| `simulation-time` | Fixed simulation quantum | [`../simulation-time/constant/SimulationStepMs.ts`](../simulation-time/constant/SimulationStepMs.ts) |
| `game-tick` | Elapsed budget, fixed-step replay, lifecycle order and loop | [`../game-tick/fx/advanceRuntimeStepFx.ts`](../game-tick/fx/advanceRuntimeStepFx.ts) |
| `item-schedule` | Optional periodic admission, lifetime across storage, enable evaluation and atomic owner/material expiry | [`../item-schedule/fx/advanceItemSchedulesFx.ts`](../item-schedule/fx/advanceItemSchedulesFx.ts) |
| `item-expiry` | Shared atomic identity removal and expiry Output | [`../item-expiry/fx/expireItemRuntimeFx.ts`](../item-expiry/fx/expireItemRuntimeFx.ts) |
| `game-persistence` | Serializable State, hydration, save codec and autosave | [`../game-persistence/schema/StateSchema.ts`](../game-persistence/schema/StateSchema.ts) |
| `game-session` | One Runtime/Tick/save scope, command admission, subscriptions and fail-stop | [`../game-session/fx/createGameSessionFx.ts`](../game-session/fx/createGameSessionFx.ts) |
| `playable-game` | Package-independent Game capability, semantic Resource catalog and URLs | [`../playable-game/type/PlayableGame.ts`](../playable-game/type/PlayableGame.ts) |
| `installed-game` | Serapack/save bootstrap, resource leases, recovery, incident and finalization | [`../installed-game/fx/createGameEngineResourceServiceFx.ts`](../installed-game/fx/createGameEngineResourceServiceFx.ts) |

## Dependency shape

The module graph is acyclic; this domain-level island is not.

- `game-runtime ↔ production-{line,input,job,delivery}` is real behavior coupling. Runtime validation and identity cleanup call exact production operations; production resolves and mutates the canonical Runtime. Do not describe either side as globally upstream.
- `game-runtime → item-location` includes behavior for aggregate location checks. The reverse edge is type-only where location calculations accept `RuntimeSchema`.
- `game-runtime ↔ game-event` crosses at different layers. Runtime owns publication and imports event contracts; event projection may read already-committed Runtime facts. Events stay downstream truth.
- `game-session → game-runtime + game-tick + game-persistence` is lifecycle composition. Those owners do not import Game Session.
- `installed-game → playable-game → game-session` is the live capability direction. Package identity never enters Game Session.
- `game-tick → production-delivery + production-job + item-schedule` is orchestration. Those lifecycle owners cannot import Tick's clock, replay or loop.

See [`../production-line/README.md`](../production-line/README.md) for the production half of the behavior cluster.

## Canonical flow

```text
GameConfig or State
→ GameRuntimeLayerFx
→ GameSessionLayerFx (Runtime + Tick)
→ createGameSessionFx (commands + subscriptions + save + disposal)
→ PlayableGame (resources and presentation guard)
→ InstalledGame (Serapack/save identity and process lifecycle)
```

Runtime commits are immediate. Tick, persistence, diagnostics, audio and Pixi observe committed facts and may lag without becoming truth.

Installed Game may defer its initial `startFx` behind an authored first-game introduction. That pending session has an empty Runtime and suppresses durable writes; Continue drains the empty Tick cursor, initializes the world and opens save admission in one joined command. This is installed-package bootstrap policy, not a second Runtime or a general pause mode.

Ordinary session shutdown order is:

```text
stop Tick
→ stop command producers
→ flush or discard the latest stable Runtime as requested
→ release the owner scope, subscriptions and runtime
```

Fatal quiesce additionally closes transition subscriptions before final disposal so observers cannot keep processing after the first failure.

Concurrent cleanup callers join the same attempt. Failed ordinary final save freezes the underlying session for retry or explicit discard. Installed Game adds a terminal finalization boundary: it retains one critical error and blocks successors instead of retrying that session. Reset and Editor replacement use discard-only disposal.

## Changing this island?

Likely affected:

- Game Session creation, command admission, fail-stop and disposal.
- Tick order and fixed-step lifecycle owners.
- Production validation, cleanup, queueing and delivery.
- Runtime event, persistence, diagnostic and presentation consumers.
- Focused tests under `test/game-runtime`, `test/game-session`, `test/game-tick`, `test/game-persistence`, and the exact changed command owner.

Usually not affected:

- Portable Editor project persistence and Version object storage.
- Authored source parsing, compiler diagnostics or Serapack envelope/provenance.
- Pixi geometry and motion tuning unless the committed Runtime/Event projection changes.

If a Runtime schema changes, the last two groups can become affected through State, Serapack or renderer contracts. Follow the changed field rather than trusting this default.

Game and Editor inject the fixed `GameplaySpeedUpMultiplier` from `game-cheat` into `createGameSessionFx`, then `GameSessionLayerFx` and `TickLayerFx`. `TickLayerFx` reads the saved switches and converts the injected multiplier into the wall cadence. Each accelerated wake advances at most one ordinary 100 ms step and drops overdue accelerated wall-time debt. `GameLoopLayerFx` uses Tick's next-delay result, compensates computation time, and yields between wakes; overload slows playback instead of creating catch-up batches. Normal gameplay retains full elapsed-time replay. `advanceRuntimeElapsedFx` accepts simulation time only. Jobs, deliveries, Clock intervals and lifetimes keep their ordinary simulation-step logic; toggling speed-up never settles work. Generic sessions default to normal speed when no multiplier is supplied.

Runtime item IDs, revisions, and job IDs use the injectable [`RuntimeIdentityFx`](../runtime-identity/context/RuntimeIdentityFx.ts) entropy source, backed by host UUIDs. Identity entropy stays separate from seeded gameplay Random so retries cannot reuse identities merely by replaying the same roll seed. Tokens remain opaque; saved identities are not rewritten.

Merge owns the persisted per-item `mergeSequence` random-stream cursor. Successful source merges advance it atomically, including nested participant depletion rolls; blocked retries and hydration retain it. It is history for the surviving identity, not input/production ownership, and does not restrict merge reuse. Runtime and State item schemas carry it; `fromRuntimeFn` and `fromStateFx` preserve it while session revisions remain transient.

### Performance diagnostics

Official installed games keep `tick-performance` records in the support-ready `~/.serakki/diagnostics/support.jsonl` stream (logger `serakki.game.performance`, correlated by `sessionId`). Community and Editor Board sessions are discarded by the diagnostic sink. Tick aggregates numeric counters over wall-time windows of at least one second; there is no per-step IPC, full-runtime serialization, or extra sampling timer. Closing the diagnostic session detaches its listener. Diagnostic sink failures cannot stop gameplay.

- `windowMs`, `wakes`, `advances`, `failedAdvances`: elapsed observation window, loop wakes, actual replay calls, and rejected advances. Stable no-op wakes need no replay call.
- `advanceMs`, `maxAdvanceMs`: summed and peak Tick work in the window, measured with Effect Clock. This includes runtime acquisition/replay/commit, excludes the observer callback, and does not measure GPU rendering.
- `maxWakeGapMs`: largest wall gap between wakes, including prior work and host scheduling delay. Large gaps with small advance cost point toward host/main-thread scheduling rather than replay cost.
- `simulationBudgetMs / windowMs`: achieved simulation-time budget per wall time; `speedMultiplier` is the selected effective multiplier at the last wake. A window spanning a toggle may contain both modes.
- `droppedWallMs`: overdue accelerated wall time discarded to prevent catch-up bursts; always zero for normal wakes.
- `items`, `jobs`, `queuedJobs`: counts at the last wake's input snapshot, without copying that snapshot into the log.

For a slow Board, compare normal and accelerated windows for the same session and item population. High `maxAdvanceMs` points to Tick/runtime work; high wake gaps alone are not proof of a renderer/GPU bottleneck. Production animation frame timing is not included in these counters.

### Forced owner removal

[`forceRemoveRuntimeItemFx`](fx/forceRemoveRuntimeItemFx.ts) plans general forced removal on an explicit Runtime: cancel owned jobs/queue, consume aborted inputs, remove the root, return reservations before buffers, and reconcile any parent material job. [`discardRuntimeItemTreeFx`](fx/discardRuntimeItemTreeFx.ts) destroys only an idle passive ownership tree and returns exact loss facts. [`placeRuntimeItemBestEffortFx`](../item-placement/fx/placeRuntimeItemBestEffortFx.ts) returns the exact item identity when a cell is available and reports explicit capacity overflow otherwise. These operations never publish; the enclosing Runtime transaction commits state and all events together.

Clock kill-switch is the first explicit caller through `item-expiry`; ordinary removal, merge, queued cancellation, job completion and loose-kill retain their strict placement semantics. Speed-up does not select removal policy. Expiry Output resolves from the original operation snapshot and follows returns in the same transaction.


### Installed save slots

The existing Runtime Save mutex serializes autosave, manual snapshots and final flush. Installed-game storage keeps `current.serasave`, `manual.serasave`, `5-min.serasave`, `30-min.serasave`, and `4-hour.serasave` in the exact package directory. Each slot publishes its bytes and timestamp together by renaming a temporary file; its filesystem modification time is the persisted snapshot time. A failed replacement leaves that slot's previous bytes and time intact. A save pass is not an aggregate transaction across slots: already-published slots may advance if a later checkpoint fails, and remaining due slots are retryable.

Explicit restore first pins and validates the selected bytes, then joins installed resource finalization with discard-only session shutdown, and replaces Current without checkpoint rotation. Reset removes the complete package save directory. No save slots are added to Editor Board persistence.
