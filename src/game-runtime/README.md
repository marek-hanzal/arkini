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
- Runtime and events become visible in the same `CommittedTransition`; events are never a second store.
- Nested `RuntimeFx` reads inside a write see the pinned pre-transition snapshot passed to the update; they never observe a partially built candidate.
- Failure, interruption and an unchanged event-free result publish nothing.

## Neighboring owners

| Domain | Owns | Start at |
| --- | --- | --- |
| `game-event` | Strict downstream event vocabulary and committed-result projection | [`../game-event/schema/GameEventSchema.ts`](../game-event/schema/GameEventSchema.ts) |
| `simulation-time` | Fixed simulation quantum | [`../simulation-time/constant/SimulationStepMs.ts`](../simulation-time/constant/SimulationStepMs.ts) |
| `game-tick` | Elapsed budget, fixed-step replay, lifecycle order and loop | [`../game-tick/fx/advanceRuntimeStepFx.ts`](../game-tick/fx/advanceRuntimeStepFx.ts) |
| `temporary-item` | Duration advancement and atomic expiry output | [`../temporary-item/fx/attemptTemporaryItemExpiryFx.ts`](../temporary-item/fx/attemptTemporaryItemExpiryFx.ts) |
| `game-persistence` | Serializable State, hydration, save codec and autosave | [`../game-persistence/schema/StateSchema.ts`](../game-persistence/schema/StateSchema.ts) |
| `game-session` | One Runtime/Tick/save scope, command admission, subscriptions and fail-stop | [`../game-session/fx/createGameSessionFx.ts`](../game-session/fx/createGameSessionFx.ts) |
| `playable-game` | Package-independent Game capability and resource URLs | [`../playable-game/type/PlayableGame.ts`](../playable-game/type/PlayableGame.ts) |
| `installed-game` | Arkpack/save bootstrap, resource leases, recovery, incident and finalization | [`../installed-game/fx/createGameEngineResourceServiceFx.ts`](../installed-game/fx/createGameEngineResourceServiceFx.ts) |

## Dependency shape

The module graph is acyclic; this domain-level island is not.

- `game-runtime ↔ production-{line,input,job,delivery}` is real behavior coupling. Runtime validation and identity cleanup call exact production operations; production resolves and mutates the canonical Runtime. Do not describe either side as globally upstream.
- `game-runtime → item-location` includes behavior for aggregate location checks. The reverse edge is type-only where location calculations accept `RuntimeSchema`.
- `game-runtime ↔ game-event` crosses at different layers. Runtime owns publication and imports event contracts; event projection may read already-committed Runtime facts. Events stay downstream truth.
- `game-session → game-runtime + game-tick + game-persistence` is lifecycle composition. Those owners do not import Game Session.
- `installed-game → playable-game → game-session` is the live capability direction. Package identity never enters Game Session.
- `game-tick → production-delivery + production-job + temporary-item` is orchestration. Those lifecycle owners cannot import Tick's clock, replay or loop.

See [`../production-line/README.md`](../production-line/README.md) for the production half of the behavior cluster.

## Canonical flow

```text
GameConfig or State
→ GameRuntimeLayerFx
→ GameSessionLayerFx (Runtime + Tick)
→ createGameSessionFx (commands + subscriptions + save + disposal)
→ PlayableGame (resources and presentation guard)
→ InstalledGame (Arkpack/save identity and process lifecycle)
```

Runtime commits are immediate. Tick, persistence, diagnostics, audio and Pixi observe committed facts and may lag without becoming truth.

Ordinary session shutdown order is:

```text
stop Tick
→ stop command producers
→ flush or discard the latest stable Runtime as requested
→ release the owner scope, subscriptions and runtime
```

Fatal quiesce additionally closes transition subscriptions before final disposal so observers cannot keep processing after the first failure.

Concurrent cleanup callers join the same attempt. Failed ordinary final save freezes the session for retry; reset and Editor replacement use discard-only disposal.

## Changing this island?

Likely affected:

- Game Session creation, command admission, fail-stop and disposal.
- Tick order and fixed-step lifecycle owners.
- Production validation, cleanup, queueing and delivery.
- Runtime event, persistence, diagnostic and presentation consumers.
- Focused tests under `test/game-runtime`, `test/game-session`, `test/game-tick`, `test/game-persistence`, and the exact changed command owner.

Usually not affected:

- Portable Editor project persistence and Version object storage.
- Authored source parsing, compiler diagnostics or Arkpack envelope/provenance.
- Pixi geometry and motion tuning unless the committed Runtime/Event projection changes.

If a Runtime schema changes, the last two groups can become affected through State, Arkpack or renderer contracts. Follow the changed field rather than trusting this default.
